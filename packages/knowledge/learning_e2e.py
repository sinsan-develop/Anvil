"""D13 trusted-host fixture coordinator. In-memory selection, not runtime execution.

Host fixture admission is deliberately not an API operation. Human/evaluation/
run-start authorities stay with D05/D06; this module cannot grant those rights.
"""
from contextlib import contextmanager
from datetime import datetime
from functools import wraps
import json
from .memory import MemoryError,MemoryScope,MemoryRepository,_canonical,_hash,_time,to_primitive
from .sources import _text,_digest
from .candidates import CandidateRepository,RunStartBoundary,snapshot
from .learning_journey import LearningJourney,checked,fields
from .skills import SkillRepository
from .hooks import HookRegistry
from .hook_runtime import HookRuntime
from .model_registry import ModelRegistry


class LearningE2EError(MemoryError): pass


def boundary(fn):
    @wraps(fn)
    def call(*args,**kwargs):
        try: return fn(*args,**kwargs)
        except LearningE2EError: raise
        except MemoryError as error: raise LearningE2EError(error.reason) from None
        except (ValueError,TypeError,KeyError,IndexError,StopIteration): raise LearningE2EError("INVALID_LEARNING_E2E_INPUT") from None
    return call


class LearningE2EAuthority:
    """Host-owned canonical fixtures and verified D-Gate observations; no HTTP mint."""
    def __init__(self): self.fixtures,self.gates,self.emitted,self.terminals={},{},set(),{}


class LearningE2E:
    def __init__(self,candidates,context,authority,journey,*,memory=None,skills=None,hooks=None,runtime=None,models=None):
        if (type(candidates) is not CandidateRepository or type(authority) is not LearningE2EAuthority
                or type(journey) is not LearningJourney or journey._candidates is not candidates or journey._context is not context):
            raise LearningE2EError("E2E_AUTHORITY_MISMATCH")
        self._c,self._ctx,self._authority,self._journey=candidates,context,authority,journey
        if (memory is not None and (type(memory) is not MemoryRepository or memory is not candidates._reviews._memory)
                or skills is not None and (type(skills) is not SkillRepository or skills._candidates is not candidates)
                or hooks is not None and (type(hooks) is not HookRegistry or hooks._candidates is not candidates)
                or runtime is not None and (type(runtime) is not HookRuntime or runtime._registry is not hooks)
                or models is not None and (type(models) is not ModelRegistry or models._candidates is not candidates)):
            raise LearningE2EError("E2E_OWNER_AUTHORITY_MISMATCH")
        self._memory,self._skills,self._hooks,self._runtime,self._models=memory,skills,hooks,runtime,models
        self._states,self._next={},{ }

    @contextmanager
    def _session(self,ctx,now):
        if ctx is not self._ctx: raise LearningE2EError("E2E_AUTHORITY_MISMATCH")
        with self._c._session(ctx,now) as host: yield host

    def _snapshot(self,host,reference):
        fields(reference,"session_id task_id run_id snapshot_id content_hash")
        value=checked(self._c._snapshots.get_task_run(reference["session_id"],reference["task_id"],reference["run_id"],MemoryScope(*host[3])))
        if any(value[k]!=v for k,v in reference.items()): raise LearningE2EError("E2E_SNAPSHOT_DRIFT")
        return value

    def _fixture(self,ctx,identity,host,now):
        _text(identity); stored=self._authority.fixtures.get((id(ctx),identity))
        if not stored or stored[0] is not self: raise LearningE2EError("E2E_FIXTURE_AUTHORITY_REQUIRED")
        value=checked(stored[1])
        if value["actor"]!=host[2] or value["context_id"]!=host[1]: raise LearningE2EError("E2E_AUTHORITY_MISMATCH")
        if not datetime.fromisoformat(value["issued_at"])<=_time(now)<datetime.fromisoformat(value["expires_at"]): raise LearningE2EError("E2E_FIXTURE_STALE")
        self._snapshot(host,value["data"]["current_snapshot"])
        return value["data"]

    def _require_owner_repository(self,kind):
        owners={"MEMORY":self._memory,"SKILL":self._skills,"HOOK":self._runtime,"PROMPT":self._models}
        if kind in owners and owners[kind] is None: raise LearningE2EError("E2E_OWNER_AUTHORITY_REQUIRED")

    def _bound_use(self,state,host):
        if not state["selection"] or not state["activation"] or not state["uses"]: return False
        if len(state["uses"])!=1: raise LearningE2EError("E2E_USE_BINDING_MISMATCH")
        selected,active=state["selection"],state["activation"]; sr=selected["snapshot_ref"]
        raw=self._c._uses.get((active["activation_id"],selected["selection_id"]))
        if raw is None: return False
        canonical=checked(raw); local=checked(state["uses"][0])
        expected=dict(candidate_ref=state["candidate_ref"],activation_id=active["activation_id"],activation_hash=active["content_hash"],
                      selection_id=selected["selection_id"],selection_hash=selected["content_hash"],snapshot_id=sr["snapshot_id"],
                      snapshot_hash=sr["content_hash"],task_id=sr["task_id"],run_id=sr["run_id"],actor=host[2],scope=to_primitive(MemoryScope(*host[3])))
        if local!=canonical or any(canonical.get(k)!=v for k,v in expected.items()): raise LearningE2EError("E2E_USE_BINDING_MISMATCH")
        if state["owner_revision"] and checked(state["owner_revision"]).get("use_hash")!=canonical["content_hash"]:
            raise LearningE2EError("E2E_USE_BINDING_MISMATCH")
        return True

    def _require_owner_evidence(self,state,host):
        if not state["selection"] or not state["activation"]: raise LearningE2EError("E2E_SELECTION_REQUIRED")
        kind=state["activation"]["kind"]; self._require_owner_repository(kind)
        if kind=="USER":
            if not self._bound_use(state,host): raise LearningE2EError("E2E_USE_REQUIRED")
            return
        if not state["owner_revision"]: raise LearningE2EError("E2E_OWNER_EVIDENCE_REQUIRED")
        value=checked(state["owner_revision"])
        if (value["kind"]!=kind or value["candidate_ref"]!=state["candidate_ref"]
                or value["selection_hash"]!=state["selection"]["content_hash"]
                or value["snapshot_ref"]!=state["selection"]["snapshot_ref"]):
            raise LearningE2EError("E2E_OWNER_EVIDENCE_REQUIRED")
        if not self._bound_use(state,host): raise LearningE2EError("E2E_USE_REQUIRED")

    def _register_use(self,ctx,identity,state,now):
        selected=state["selection"]
        use=self._c.register_use(ctx,state["activation"]["activation_id"],selected["selection_id"],
                                expected_selection_hash=selected["content_hash"],request_id="d13-owner-use-"+identity,now=now)
        return to_primitive(use)

    @boundary
    def capture_scenario(self,ctx,identity,data,*,now,expires_at):
        with self._session(ctx,now) as host:
            _text(identity); data=json.loads(_canonical(data))
            fields(data,"proposal current_snapshot source_ref final_diff_hash pattern_ref needed_refs no_change similarity")
            fields(data["similarity"],"intent language")
            for value in data["similarity"].values(): _text(value)
            if not _time(now)<_time(expires_at)<=host[6]: raise LearningE2EError("E2E_FIXTURE_STALE")
            current=self._snapshot(host,data["current_snapshot"])
            source=self._c._reviews._sources.get(ctx,data["source_ref"]["source_id"],now=now).record
            if any(getattr(source,k)!=v for k,v in data["source_ref"].items()) or source.content_hash!=data["final_diff_hash"]:
                raise LearningE2EError("E2E_SOURCE_TARGET_MISMATCH")
            review=self._c._reviews.get(ctx,data["proposal"]["review_ref"]["review_id"],now=now)
            if any(getattr(review,k)!=v for k,v in data["proposal"]["review_ref"].items()): raise LearningE2EError("E2E_REVIEW_MISMATCH")
            if review.target_hash!=data["final_diff_hash"] or not any(p["reference"]["content_hash"]==source.record_hash for p in review.provenance):
                raise LearningE2EError("E2E_SOURCE_TARGET_MISMATCH")
            pattern=self._c._reviews._patterns.get(ctx,data["pattern_ref"]["artifact_id"],version=data["pattern_ref"]["version"],now=now)
            if (pattern.kind!="CODE_PATTERN" or pattern.record_hash!=data["pattern_ref"]["record_hash"]
                    or to_primitive(pattern.source_ref)!=data["source_ref"]): raise LearningE2EError("E2E_PATTERN_MISMATCH")
            if type(data["needed_refs"]) is not list or not data["needed_refs"] or len({_hash(x) for x in data["needed_refs"]})!=len(data["needed_refs"]):
                raise LearningE2EError("E2E_REFERENCE_SELECTION_REQUIRED")
            if any(ref not in to_primitive(pattern.details["example_refs"]) for ref in data["needed_refs"]): raise LearningE2EError("E2E_REFERENCE_SELECTION_REQUIRED")
            if data["no_change"]["candidate_actions"] or not data["no_change"]["no_change_reason"]: raise LearningE2EError("E2E_NO_CHANGE_REQUIRED")
            body=dict(data=data,actor=host[2],context_id=host[1],issued_at=_time(now),expires_at=_time(expires_at)); body["content_hash"]=_hash(body)
            key=(id(ctx),identity); old=self._authority.fixtures.get(key)
            if old and old!=(self,_canonical(body)): raise LearningE2EError("E2E_FIXTURE_REBIND")
            self._authority.fixtures[key]=(self,_canonical(body))
            self._states.setdefault(identity,dict(candidate_ref=None,activation=None,selection=None,uses=[],loaded=[],no_change=None,completed=[],events=[],owner_revision=None,search=None))
            return snapshot(dict(scenario_id=identity,fixture_hash=body["content_hash"],current_snapshot_hash=current["content_hash"]))

    @boundary
    def bind_next_task(self,ctx,identity,reference,run_start,*,now):
        with self._session(ctx,now) as host:
            fixture=self._fixture(ctx,identity,host,now); self._snapshot(host,reference)
            current=fixture["current_snapshot"]
            if (type(run_start) is not RunStartBoundary or reference["task_id"]==current["task_id"]
                    or reference["session_id"]!=current["session_id"] or reference["run_id"]==current["run_id"]):
                raise LearningE2EError("E2E_NEXT_TASK_REQUIRED")
            state=self._states[identity]
            if not state["activation"]: raise LearningE2EError("E2E_APPROVAL_REQUIRED")
            old=self._next.get(identity); binding=(json.loads(_canonical(reference)),run_start)
            if old and old!=binding: raise LearningE2EError("E2E_NEXT_TASK_REBIND")
            self._next[identity]=binding

    @boundary
    def capture_terminal_evidence(self,ctx,identity,terminal,evidence,*,now,expires_at):
        """Host-only post-RunStart observation; never exposed by the API adapter."""
        with self._session(ctx,now) as host:
            f=self._fixture(ctx,identity,host,now); selected=self._states[identity]["selection"]
            if not selected: raise LearningE2EError("E2E_TERMINAL_CAPTURE_REQUIRED")
            self._require_owner_evidence(self._states[identity],host)
            started=datetime.fromisoformat(self._snapshot(host,selected["snapshot_ref"])["created_at"])
            if (terminal["subject_ref"]!=f["no_change"]["subject_ref"]
                    or terminal["subject_ref"]["subject_id"]!=selected["snapshot_ref"]["run_id"]
                    or terminal["target_hash"]!=f["final_diff_hash"]
                    or not started<=_time(terminal["ended_at"])<=_time(now)):
                raise LearningE2EError("E2E_TERMINAL_BOUNDARY_MISMATCH")
            reviews=self._c._reviews
            reviews.attest(ctx,f["no_change"],terminal,evidence,now=now,expires_at=expires_at)
            raw=reviews._attestations[reviews._key(host,f["no_change"]["subject_ref"])]
            value=dict(selection_hash=selected["content_hash"],attestation_hash=_hash(raw),actor=host[2],context_id=host[1])
            value["content_hash"]=_hash(value)
            self._authority.terminals[(id(ctx),identity)]=(self,_canonical(value))

    @boundary
    def capture_owner_selection(self,ctx,identity,reference,*,now):
        """Host adapter: consume real owner records, never mint trust from API data.

        D01 resolves context; D07 selects/loads L1; D10 and D11 pin their real
        next-run selections. No program, Provider or runtime consumer executes.
        """
        with self._session(ctx,now) as host:
            f=self._fixture(ctx,identity,host,now); s=self._states[identity]
            if not s["selection"]: raise LearningE2EError("E2E_SELECTION_REQUIRED")
            report=self._c.query(ctx,f["proposal"]["candidate_id"],now=now)
            if report["state"]["status"]!="ACTIVE": raise LearningE2EError("E2E_NOT_ACTIVE")
            reference=json.loads(_canonical(reference)); kind=s["activation"]["kind"]
            old=checked(s["owner_revision"]) if s["owner_revision"] else None
            if old:
                if old["revision_ref"]!=reference: raise LearningE2EError("E2E_OWNER_REBIND")
                if self._bound_use(s,host):
                    self._require_owner_evidence(s,host)
                    return self.query(ctx,identity,now=now)
            sr=s["selection"]["snapshot_ref"]; extra={}
            if kind=="MEMORY" and self._memory is not None:
                fields(reference,"entry_id version content_hash")
                entry=self._memory.get("MEMORY",MemoryScope(*host[3]),reference["entry_id"],now=now)
                if (entry is None or any(getattr(entry,k)!=v for k,v in reference.items()) or entry.entry_id!=s["activation"]["target_id"]
                        or entry.source["created_by"]!=host[2]
                        or not {s["candidate_ref"]["content_hash"],f["source_ref"]["record_hash"],s["activation"]["content_hash"]}.issubset({x["ref"] for x in entry.evidence})):
                    raise LearningE2EError("E2E_OWNER_LINEAGE_MISMATCH")
                checked(to_primitive(entry))
                receipt=self._memory.resolve_context("MEMORY",MemoryScope(*host[3]),instructions=[],now=now)
                if not any(x.content_hash==entry.content_hash for x in receipt.entries): raise LearningE2EError("E2E_OWNER_NOT_SELECTED")
                receipt_hash=receipt.content_hash
            elif kind=="SKILL" and self._skills is not None:
                if reference.get("activation_id")!=s["activation"]["activation_id"]: raise LearningE2EError("E2E_OWNER_LINEAGE_MISMATCH")
                selection_ref={k:s["selection"][k] for k in ("selection_id","content_hash")}
                invocation=self._skills.select(ctx,selection_ref,reference,task=f["similarity"]["intent"],mode="explicit",request_id="d13-owner-"+identity,now=now)
                ir={k:invocation[k] for k in ("invocation_id","content_hash")}
                loaded=self._skills.load_l1(ctx,ir,now=now)
                receipt_hash=loaded["content_hash"]; extra=dict(invocation_ref=ir,l1_receipt_hash=receipt_hash)
            elif kind=="HOOK" and self._runtime is not None:
                record=self._hooks.version(ctx,reference,now=now)
                if record["candidate_ref"]!=s["candidate_ref"] or reference["hook_id"]!=s["activation"]["target_id"]:
                    raise LearningE2EError("E2E_OWNER_LINEAGE_MISMATCH")
                prior_id=self._runtime._state["run_ids"].get(sr["run_id"])
                if prior_id is not None:
                    # A prior attempt may have committed the owner selection but
                    # failed before D13 publication. Consume that exact receipt.
                    selected=checked(self._runtime._state["selections"].get(prior_id),omit=("selection_id",))
                    current=self._runtime.query(ctx,reference,now=now)
                    if (selected["snapshot_ref"]!=sr or selected["principal"]!=host[2] or selected["context_id"]!=host[1]
                            or selected["selection_id"]!="automation-selection-"+selected["content_hash"] or current["status"]!="ACTIVE"
                            or not _time(now)<datetime.fromisoformat(current["trust"]["expires_at"])
                            or not any(x["target"]==reference and x["trust_hash"]==current["trust"]["content_hash"] for x in selected["hooks"])):
                        raise LearningE2EError("E2E_OWNER_LINEAGE_MISMATCH")
                else:
                    start=self._runtime.capture_run_start(ctx,sr,now=now)
                    selected=self._runtime.select_next_run(ctx,start,now=now)
                if not any(x["target"]==reference and not x.get("managed_fallback") for x in selected["hooks"]):
                    raise LearningE2EError("E2E_OWNER_NOT_SELECTED")
                receipt_hash=selected["content_hash"]; extra=dict(owner_selection_id=selected["selection_id"])
            elif kind=="PROMPT" and self._models is not None:
                state=self._models.query(ctx,now=now)
                prompt=next((x for x in state["prompts"].values() if all(x.get(k)==v for k,v in reference.items())),None)
                fields(reference,"id version content_hash")
                if not prompt or prompt["data"]["candidate_ref"]!=s["candidate_ref"] or reference["id"]!=s["activation"]["target_id"]:
                    raise LearningE2EError("E2E_OWNER_LINEAGE_MISMATCH")
                checked(prompt)
                selected=self._models.run_guard(ctx,sr,now=now)
                routes=[x for x in selected.get("routing",{}).get("routes",[]) if x["prompt"]==reference]
                if selected["status"]!="PINNED" or not routes: raise LearningE2EError("E2E_OWNER_NOT_SELECTED")
                receipt_hash=selected["content_hash"]; extra=dict(model_refs=[to_primitive(x["model"]) for x in routes])
            else: raise LearningE2EError("E2E_OWNER_AUTHORITY_REQUIRED")
            value=dict(kind=kind,revision_ref=reference,receipt_hash=receipt_hash,candidate_ref=s["candidate_ref"],source_ref=f["source_ref"],
                       selection_hash=s["selection"]["content_hash"],snapshot_ref=sr,actor=host[2],context_id=host[1],created_at=_time(now),**extra)
            use=self._register_use(ctx,identity,s,now)
            value["use_hash"]=use["content_hash"]; value["content_hash"]=_hash(value)
            staged=dict(s,owner_revision=_canonical(value),uses=[use])
            self._require_owner_evidence(staged,host)
            # Publish only after both independent owners have canonical evidence.
            # Earlier owner receipts are retained on failure; D13 never reports
            # cross-repository rollback or APPLIED for those partial operations.
            self._states[identity]=staged
            return self.query(ctx,identity,now=now)

    def _isolate_memory(self,host,state,status,now):
        if not state["owner_revision"]: return
        selected=checked(state["owner_revision"])
        if selected["kind"]!="MEMORY": return
        entry=self._memory.get("MEMORY",MemoryScope(*host[3]),selected["revision_ref"]["entry_id"],now=now)
        if entry is None: return
        if entry.content_hash!=selected["revision_ref"]["content_hash"]: raise LearningE2EError("E2E_OWNER_LINEAGE_MISMATCH")
        data=to_primitive(entry)
        for key in ("version","previous_hash","content_hash"): data.pop(key)
        for key in ("created_at","last_verified_at","expires_at"): data[key]=datetime.fromisoformat(data[key])
        data["status"]=status
        self._memory.version(data,expected_hash=entry.content_hash,now=now)

    @boundary
    def execute(self,ctx,identity,stage,*,now):
        with self._session(ctx,now) as host:
            f=self._fixture(ctx,identity,host,now); s=self._states[identity]; c=self._c
            allowed={"propose","evaluate","request-approval","approve","activate","next-task","load-references","revoke","rollback","no-change"}
            if stage not in allowed: raise LearningE2EError("INVALID_LEARNING_E2E_INPUT")
            report=c.query(ctx,f["proposal"]["candidate_id"],now=now) if s["candidate_ref"] else None
            if report: self._require_owner_repository(report["candidate"]["kind"])
            if stage in ("load-references","revoke","rollback","no-change"):
                self._require_owner_evidence(s,host)
            # Live source checks precede duplicate retrieval for new-use operations.
            if stage in ("next-task","load-references") and (not report or report["state"]["status"]!="ACTIVE"):
                raise LearningE2EError("E2E_NOT_ACTIVE")
            if stage in s["completed"]: return self.query(ctx,identity,now=now)
            request="d13-"+identity+"-"+stage; target=to_primitive(s["candidate_ref"]); version=report["state"]["state_version"] if report else 0
            if stage=="propose":
                proposal=dict(f["proposal"],expires_at=datetime.fromisoformat(f["proposal"]["expires_at"]))
                self._require_owner_repository(c._proposal(ctx,host,proposal,now)[2])
                value=c.create(ctx,proposal,expected_version=0,request_id=request,now=now)
                s["candidate_ref"]={k:value["candidate"][k] for k in ("candidate_id","version","content_hash")}
            elif stage in ("evaluate","request-approval","approve","activate"):
                if not target: raise LearningE2EError("E2E_CANDIDATE_REQUIRED")
                value=getattr(c,stage.replace("-","_"))(ctx,target,expected_version=version,request_id=request,now=now)
                if stage=="activate": s["activation"]=to_primitive(value)
            elif stage=="next-task":
                if identity not in self._next: raise LearningE2EError("E2E_RUN_START_REQUIRED")
                sr,cap=self._next[identity]
                selected=c.select_next_run(ctx,[s["activation"]],sr,run_start=cap,now=now)
                s["selection"]=to_primitive(selected)
                if s["activation"]["kind"]=="USER": s["uses"]=[self._register_use(ctx,identity,s,now)]
            elif stage=="load-references":
                if not s["selection"]: raise LearningE2EError("E2E_SELECTION_REQUIRED")
                patterns=c._reviews._patterns
                found=patterns.search(ctx,dict(kind="CODE_PATTERN",**f["similarity"]),now=now)
                matched=[]
                for item in found:
                    artifact=patterns.get(ctx,item.artifact_id,version=item.version,now=now)
                    if to_primitive(artifact.source_ref)==f["source_ref"]: matched.append(item)
                found=matched
                if not any(x.artifact_id==f["pattern_ref"]["artifact_id"] and x.record_hash==f["pattern_ref"]["record_hash"] for x in found):
                    raise LearningE2EError("E2E_PATTERN_MISMATCH")
                loaded=[patterns.load_reference(ctx,pattern_ref=f["pattern_ref"],reference_ref=ref,now=now) for ref in f["needed_refs"]]
                s["loaded"]=[dict(artifact_id=x.artifact_id,version=x.version,record_hash=x.record_hash) for x in loaded]
                receipt=dict(query_facts=dict(similarity=f["similarity"],source_ref=f["source_ref"],final_diff_hash=f["final_diff_hash"],target_hash=f["final_diff_hash"]),
                             matched_pattern_hashes=sorted(x.record_hash for x in found),loaded_references=s["loaded"],created_at=_time(now))
                receipt["content_hash"]=_hash(receipt); s["search"]=receipt
            elif stage=="revoke":
                sources=c._reviews._sources; source=sources.get(ctx,f["source_ref"]["source_id"],now=now)
                sources.transition(ctx,source.record.source_id,"REVOKED",reason="PERMISSION_REVOKED",expected_version=source.state_version,request_id=request,now=now)
                c.sync_sources(ctx,now=now)
                self._isolate_memory(host,s,"QUARANTINED",now)
            elif stage=="rollback":
                c.rollback(ctx,target,reason="E2E_ROLLBACK",evidence_ref="d13-rollback",expected_version=version,request_id=request,now=now)
                self._isolate_memory(host,s,"INACTIVE",now)
            else:
                terminal_capture=self._authority.terminals.get((id(ctx),identity))
                if not terminal_capture or terminal_capture[0] is not self: raise LearningE2EError("E2E_TERMINAL_CAPTURE_REQUIRED")
                terminal_capture=checked(terminal_capture[1])
                if not s["selection"] or f["no_change"]["subject_ref"]["subject_id"]!=s["selection"]["snapshot_ref"]["run_id"]:
                    raise LearningE2EError("E2E_NO_CHANGE_SUBJECT_MISMATCH")
                raw=c._reviews._attestations.get(c._reviews._key(host,f["no_change"]["subject_ref"]))
                if (terminal_capture["selection_hash"]!=s["selection"]["content_hash"] or terminal_capture["attestation_hash"]!=_hash(raw)
                        or terminal_capture["actor"]!=host[2] or terminal_capture["context_id"]!=host[1]):
                    raise LearningE2EError("E2E_TERMINAL_BOUNDARY_MISMATCH")
                value=c._reviews.create(ctx,f["no_change"],expected_version=0,request_id=request,now=now)
                if value.candidate_actions or not value.no_change_reason: raise LearningE2EError("E2E_NO_CHANGE_REQUIRED")
                s["no_change"]=value.content_hash
            event=dict(stage=stage,created_at=_time(now),previous_hash=s["events"][-1]["content_hash"] if s["events"] else None)
            event["content_hash"]=_hash(event); s["events"].append(event); s["completed"].append(stage)
            return self.query(ctx,identity,now=now)

    @boundary
    def query(self,ctx,identity,*,now):
        with self._session(ctx,now) as host:
            f=self._fixture(ctx,identity,host,now); s=self._states[identity]
            report=self._c.query(ctx,f["proposal"]["candidate_id"],now=now) if s["candidate_ref"] else None
            status=report["state"]["status"] if report else "PENDING"
            live=status=="ACTIVE" and s["selection"] is not None
            baseline=f["current_snapshot"]["content_hash"]
            selected=checked(s["owner_revision"]) if s["owner_revision"] else None
            if selected and (selected["actor"]!=host[2] or selected["context_id"]!=host[1] or selected["candidate_ref"]!=s["candidate_ref"]):
                raise LearningE2EError("E2E_OWNER_AUTHORITY_MISMATCH")
            user_provenance=dict(source_ref=f["proposal"]["user_source_ref"],candidate_ref=s["candidate_ref"]) if report and report["candidate"]["kind"]=="USER" else None
            bound_use=self._bound_use(s,host)
            applied=live and bound_use and (selected is not None or user_provenance is not None)
            projection_status="PENDING_OWNER_EVIDENCE" if live and not applied else status
            # Use D12's canonical owner graph validation, including immutable
            # owner revisions/receipts. Uninitialized owners have no artifacts.
            journey=LearningJourney(self._c,ctx,self._journey._authority,skills=self._skills,hooks=self._hooks,
                                    runtime=self._runtime if self._runtime is not None and self._runtime._context is not None else None,
                                    models=self._models if self._models is not None and self._models._context is not None else None).query(ctx,now=now)
            affected=sorted({u["run_id"] for u in s["uses"]}) if status in ("QUARANTINED","ROLLED_BACK") else []
            result=dict(scenario_id=identity,status=projection_status,candidate_status=status,application_status="APPLIED" if applied else "NOT_APPLIED",
                        candidate_ref=s["candidate_ref"],current_snapshot_hash=baseline,
                        activation_ref={k:s["activation"][k] for k in ("activation_id","version","content_hash")} if s["activation"] else None,
                        selection_hash=s["selection"]["content_hash"] if s["selection"] else None,selected_revision=selected,
                        owner_evidence_status="RECORDED_NOT_EXECUTED" if selected else "NOT_CAPTURED",search_receipt=s["search"],
                        user_correction_provenance=user_provenance,
                        context_projection_hash=_hash([baseline,(selected or user_provenance) if applied else None]),uses=[u["content_hash"] for u in s["uses"]],
                        loaded_references=s["loaded"],affected_runs=affected,no_change_review_hash=s["no_change"],journey_hash=journey["content_hash"],
                        events=s["events"],next_safe_action="OWNER_SAFE_POINT_REVIEW" if affected else "CONTINUE_SCOPED_FIXTURE",
                        actual_program="NOT_EXECUTED",runtime_consumer="NOT_INTEGRATED",io_count=0)
            result["content_hash"]=_hash(result); return snapshot(result)

    @boundary
    def capture_gate_verification(self,ctx,identity,target_hash,findings,*,now,expires_at):
        with self._session(ctx,now) as host:
            f=self._fixture(ctx,identity,host,now); _digest(target_hash)
            review=self._c._reviews.get(ctx,f["proposal"]["review_ref"]["review_id"],now=now)
            if review.target_hash!=target_hash: raise LearningE2EError("E2E_GATE_TARGET_MISMATCH")
            if not _time(now)<_time(expires_at)<=host[6] or type(findings) is not list: raise LearningE2EError("E2E_GATE_AUTHORITY_REQUIRED")
            for item in findings:
                fields(item,"check_id target_hash severity confirmed status evidence_hash")
                _text(item["check_id"]); _digest(item["target_hash"]); _digest(item["evidence_hash"])
                if (item["severity"] not in ("CRITICAL","MAJOR","MINOR") or item["status"] not in ("PASS","FAIL","BLOCKED","SKIPPED")
                        or type(item["confirmed"]) is not bool): raise LearningE2EError("INVALID_LEARNING_E2E_INPUT")
            value=dict(target_hash=target_hash,findings=findings,context_id=host[1],actor=host[2],issued_at=_time(now),expires_at=_time(expires_at))
            value["content_hash"]=_hash(value); key=(id(ctx),identity)
            old=self._authority.gates.get(key)
            if old and old!=(self,_canonical(value)): raise LearningE2EError("E2E_GATE_REBIND")
            self._authority.gates[key]=(self,_canonical(value))

    @boundary
    def dir_x(self,ctx,identity,*,now):
        with self._session(ctx,now) as host:
            self._fixture(ctx,identity,host,now); stored=self._authority.gates.get((id(ctx),identity))
            if not stored or stored[0] is not self: raise LearningE2EError("E2E_GATE_AUTHORITY_REQUIRED")
            value=checked(stored[1])
            if value["actor"]!=host[2] or value["context_id"]!=host[1]: raise LearningE2EError("E2E_AUTHORITY_MISMATCH")
            if not datetime.fromisoformat(value["issued_at"])<=_time(now)<datetime.fromisoformat(value["expires_at"]): raise LearningE2EError("E2E_GATE_STALE")
            hits=sorted({item["check_id"] for item in value["findings"] if item["target_hash"]==value["target_hash"] and item["check_id"] in ("AV-LRN-003","AV-LRN-004","AV-LRN-005")
                         and item["severity"]=="CRITICAL" and item["confirmed"] and item["status"]=="FAIL"})
            key=(host[1],value["target_hash"]); emit=bool(hits) and key not in self._authority.emitted
            if emit: self._authority.emitted.add(key)
            return snapshot(dict(trigger="DIRX-LRN-CRITICAL" if emit else None,target_hash=value["target_hash"],checks=hits,
                                 evidence_hash=value["content_hash"],control_event_emitted=False,control_owner="MAIN"))
