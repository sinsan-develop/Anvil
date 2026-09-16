"""D12 read-only evidence projection. 원 repository의 refresh/query/run을 호출하지 않는다.

공통 host lock 아래 원본 JSON을 검증·복제한다. 반환값은 원문 대신 최소 metadata와
hash이며 UI/HTTP/runtime consumer 연결 및 durable 재시작은 NOT_INTEGRATED다.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import wraps
import json
from .memory import MemoryError, MemoryScope, _canonical, _hash, _time, to_primitive
from .sources import _text, _digest
from .candidates import CandidateRepository, snapshot
from .skills import SkillRepository
from .skill_evolution import SkillEvolutionRepository
from .hooks import HookRegistry, merge_results
from .hook_runtime import HookRuntime
from .model_registry import ModelRegistry


class JourneyError(MemoryError):
    pass


def boundary(fn):
    @wraps(fn)
    def call(*args, **kwargs):
        try: return fn(*args, **kwargs)
        except JourneyError: raise
        except MemoryError as error: raise JourneyError(error.reason) from None
        except (KeyError, ValueError, TypeError, IndexError, StopIteration, RecursionError):
            raise JourneyError("JOURNEY_INVALID_EVIDENCE") from None
    return call


def fields(data, names):
    if type(data) is not dict or set(data) != set(names.split()): raise JourneyError("INVALID_JOURNEY_INPUT")


def decode(value):
    return json.loads(value) if type(value) is str else to_primitive(value)


def checked(value, field="content_hash", omit=()):
    value = decode(value)
    if value.get(field) != _hash({k:v for k,v in value.items() if k != field and k not in omit}):
        raise JourneyError("JOURNEY_HASH_DRIFT")
    return value


def validate_dag(nodes, edges):
    ids = {node["node_id"] for node in nodes}
    if len(ids) != len(nodes): raise JourneyError("JOURNEY_IDENTITY_CONFLICT")
    children = {key:set() for key in ids}; degree = dict.fromkeys(ids, 0)
    for edge in edges:
        left, right = edge["from"], edge["to"]
        if left not in ids or right not in ids: raise JourneyError("JOURNEY_DANGLING_EDGE")
        if right not in children[left]: children[left].add(right); degree[right] += 1
    ready = sorted(k for k,v in degree.items() if not v); count = 0
    while ready:
        key = ready.pop(); count += 1
        for child in children[key]:
            degree[child] -= 1
            if not degree[child]: ready.append(child)
    if count != len(ids): raise JourneyError("JOURNEY_CYCLE")


class _Graph:
    def __init__(self, host):
        self.host, self.nodes, self.raw, self.parents, self.by_hash = host, {}, {}, {}, {}

    def add(self, kind, value, *, identity=None, digest=None, parents=(), status=None, version=None):
        value = decode(value); digest = digest or value.get("content_hash") or value.get("record_hash") or _hash(value)
        for name in ("actor", "created_by", "principal_id"):
            if name in value and value[name] != self.host[2]: raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
        if "context_id" in value and value["context_id"] != self.host[1]: raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
        if "scope" in value and isinstance(value["scope"], dict) and value["scope"] != to_primitive(MemoryScope(*self.host[3])):
            raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
        identity = identity or next((value[k] for k in ("source_id","review_id","candidate_id","activation_id","selection_id","invocation_id","evolution_id","snapshot_id","entry_id","id") if k in value), digest)
        _text(str(identity))
        key = kind + ":" + digest
        node = dict(node_id=key, kind=kind, artifact_id=identity, version=version or value.get("version", value.get("state_version", 1)),
                    artifact_hash=digest, status=status or value.get("status", "RECORDED"),
                    created_at=value.get("created_at", value.get("issued_at")), evidence_hash=digest)
        if key in self.nodes and (self.nodes[key] != node or self.raw[key] != value): raise JourneyError("JOURNEY_IDENTITY_CONFLICT")
        self.nodes[key], self.raw[key] = node, value
        self.parents.setdefault(key, set()).update(p for p in parents if p)
        self.by_hash.setdefault(digest, set()).add(key)
        return digest

    def chain(self, kind, values, parent):
        previous, instant = None, None
        for raw in values:
            value = checked(raw)
            if value.get("previous_hash") != previous: raise JourneyError("JOURNEY_HASH_DRIFT")
            current = datetime.fromisoformat(value["created_at"])
            if instant and current < instant: raise JourneyError("JOURNEY_TIME_DRIFT")
            self.add(kind, value, parents=[parent, previous]); previous, instant = value["content_hash"], current

    def finish(self):
        edges = []
        for child, parents in self.parents.items():
            for parent in parents:
                matches = self.by_hash.get(parent)
                if not matches: raise JourneyError("JOURNEY_DANGLING_EDGE")
                for node in matches: edges.append(dict(from_node=node, to_node=child))
        edges = [{"from":e["from_node"],"to":e["to_node"]} for e in edges]
        nodes = sorted(self.nodes.values(), key=lambda n:(n["kind"], str(n["artifact_id"]), n["version"], n["artifact_hash"]))
        edges.sort(key=lambda e:(e["from"],e["to"])); validate_dag(nodes, edges)
        return nodes, edges


class LearningJourneyAuthority:
    """Host-owned in-memory read checkpoint/cursor authority; no API minting."""
    def __init__(self):
        self.checkpoints, self.cursors, self._replays = {}, {}, {}


class LearningJourney:
    def __init__(self, candidates, context, authority, *, skills=None, evolution=None, hooks=None, runtime=None, models=None):
        if type(candidates) is not CandidateRepository or type(authority) is not LearningJourneyAuthority:
            raise JourneyError("JOURNEY_REPOSITORY_MISMATCH")
        for item, expected in ((skills,SkillRepository),(evolution,SkillEvolutionRepository),(hooks,HookRegistry),(runtime,HookRuntime),(models,ModelRegistry)):
            if item is not None:
                actual = item._registry._candidates if type(item) is HookRuntime else getattr(item, "_candidates", None)
                if type(item) is not expected or actual is not candidates: raise JourneyError("JOURNEY_REPOSITORY_MISMATCH")
        if evolution and evolution._skills is not skills: raise JourneyError("JOURNEY_REPOSITORY_MISMATCH")
        if runtime and runtime._registry is not hooks: raise JourneyError("JOURNEY_REPOSITORY_MISMATCH")
        self._candidates, self._context, self._authority = candidates, context, authority
        self._skills, self._evolution, self._hooks, self._runtime, self._models = skills, evolution, hooks, runtime, models

    @contextmanager
    def _session(self, ctx, now):
        if ctx is not self._context: raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
        with self._candidates._session(ctx, now) as host:
            for repo in (self._runtime, self._models):
                if repo is not None and (repo._context is not ctx or repo._state["context_id"] != host[1] or repo._state["principal_id"] != host[2]):
                    raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
                if repo is not None:
                    owners=repo._authority._owners if repo is self._runtime else repo._authority.owners
                    if owners.get(host[1]) is not repo: raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
            yield host

    def _collect(self, ctx, host):
        g = _Graph(host); c = self._candidates; reviews = c._reviews; sources = reviews._sources
        for key, history in sources._sources.items():
            if key[0] != host[3]: continue
            previous = None
            for raw in history:
                value = checked(raw, "record_hash")
                if value["previous_hash"] != previous: raise JourneyError("JOURNEY_HASH_DRIFT")
                g.add("SOURCE", value, digest=value["record_hash"], parents=[previous], status=sources._states[key][0]); previous=value["record_hash"]
        for key, history in sources._derived.items():
            if key[0]!=host[3]: continue
            for raw in history:
                value=checked(raw,"record_hash"); parent=value.get("parent_ref")
                g.add("DERIVED_SOURCE",value,identity=value["item_id"],digest=value["record_hash"],
                      parents=[value["source_ref"]["record_hash"],parent["record_hash"] if parent else None])
        for scope,raw in sources._usages:
            if scope!=host[3]: continue
            value=checked(raw,"record_hash"); derived=value.get("derived_ref")
            g.add("SOURCE_USAGE",value,digest=value["record_hash"],parents=[value["source_ref"]["record_hash"],derived["record_hash"] if derived else None],status="RECORDED_NOT_EXECUTED")
        for key,raw in sources._impacts.items():
            if key[0]!=host[3]: continue
            value=checked(raw,"record_hash")
            g.add("SOURCE_IMPACT",value,identity=value["impact_id"],digest=value["record_hash"],
                  parents=[value["source_ref"]["record_hash"],*[item["record_hash"] for item in value["derived_items"]]])
        if reviews._memory:
            for kind, partitions in reviews._memory._stores.items():
                for history in partitions.get(host[3], {}).values():
                    for raw in history:
                        value = checked(raw)
                        if value["source"]["created_by"]!=host[2] or (value["user_id"],value["scope"],value["project_id"])!=host[3]:
                            raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
                        g.add(kind, value, parents=[value.get("previous_hash")])
        if reviews._patterns:
            for key, history in reviews._patterns._records.items():
                if key[0] != host[3]: continue
                for raw in history:
                    value = checked(raw,"record_hash")
                    g.add(value["kind"], value, identity=value["artifact_id"], digest=value["record_hash"],
                          parents=[value["source_ref"]["record_hash"],value.get("previous_hash"),*[r["record_hash"] for r in value["details"].get("example_refs",[])]])
        for key, raw in reviews._records.items():
            if key[0] != host[3]: continue
            value = checked(raw, omit=("reflection",))
            subject = reviews._key(host, value["subject_ref"])
            if not reviews._owned(ctx, host, subject): raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
            checked(value["reflection"])
            g.add("REVIEW", value, parents=[p["reference"]["content_hash"] for p in value["provenance"]])
        for key, raw in c._records.items():
            if key[0] != host[3]: continue
            if c._owners.get(key, (None,))[0] is not ctx: raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
            value = checked(raw); target = value["content_hash"]
            g.add("CANDIDATE", value, parents=[value["review_ref"]["content_hash"], *[s["record_hash"] for s in value["source_roots"]]], status=json.loads(c._events[key][-1])["status"])
            g.chain("CANDIDATE_EVENT", c._events[key], target)
            if key in c._evaluations: g.add("EVALUATION", checked(c._evaluations[key]), parents=[target])
            if key in c._decisions:
                decision=decode(c._decisions[key]); g.add("APPROVAL", decision, parents=[target,decision["binding"]["evaluation_hash"]])
            for raw_impact in c._impacts.get(key, []): g.add("IMPACT", checked(raw_impact), parents=[target])
        for raw in c._activations.values():
            value=checked(raw)
            if value["context_id"] != host[1] or value["actor"] != host[2]: continue
            g.add("ACTIVATION", value, parents=[value["candidate_ref"]["content_hash"],value["approval_hash"]])
        for identity, stored in c._selections.items():
            if stored[0] is not ctx: continue
            value=checked(stored[1]); sr=value["snapshot_ref"]
            actual=c._snapshots.get_task_run(sr["session_id"],sr["task_id"],sr["run_id"],MemoryScope(*host[3]))
            actual=checked(actual)
            if any(actual[k] != v for k,v in sr.items()): raise JourneyError("JOURNEY_HASH_DRIFT")
            g.add("LEARNING_SNAPSHOT", actual)
            g.add("SELECTION",value,parents=[sr["content_hash"],*[a["content_hash"] for a in value["activations"]]])
        for raw in c._uses.values():
            value=checked(raw)
            if value["actor"] != host[2] or value["scope"] != to_primitive(MemoryScope(*host[3])): continue
            g.add("APPLICATION",value,parents=[value["selection_hash"],value["activation_hash"]],status="RECORDED_NOT_EXECUTED")
        self._collect_skills(g, ctx, host)
        self._collect_hooks(g, ctx, host)
        self._collect_models(g, ctx, host)
        return g

    def _collect_skills(self, g, ctx, host):
        skills = self._skills
        if skills:
            for raw in skills._materials.values():
                value=decode(raw); capture=value["capture"]; binding=capture["binding"]
                if binding["context_id"] != host[1] or binding["actor"] != host[2]: continue
                if _hash(capture) != value["capture_hash"] or _hash(value["data"]) != binding["skill_ref"]["content_hash"]:
                    raise JourneyError("JOURNEY_HASH_DRIFT")
                g.add("SKILL",value,identity=value["data"]["skill_id"],version=value["data"]["version"],digest=binding["skill_ref"]["content_hash"],
                      parents=[binding["activation_ref"]["content_hash"],binding["selection_ref"]["content_hash"]])
            for raw in skills._invocations.values():
                value=checked(raw)
                if value["context_id"] != host[1] or value["actor"] != host[2]: continue
                g.add("SKILL_INVOCATION",value,parents=[value["selection_ref"]["content_hash"],value["skill_ref"]["content_hash"]])
            for attr, kind in (("_l1","SKILL_L1"),("_l2","SKILL_L2"),("_uses","SKILL_USE")):
                for raw in getattr(skills,attr).values():
                    value=checked(raw); invocation=value["invocation_ref"]["content_hash"]
                    g.add(kind,value,parents=[invocation],status="RECORDED_NOT_EXECUTED")
            for selection_id, events in skills._events.items():
                selected=self._candidates._selections.get(selection_id)
                if selected and selected[0] is ctx: g.chain("SKILL_EVENT",events,checked(selected[1])["content_hash"])
        if self._evolution:
            evo=self._evolution
            for key, raw in evo._records.items():
                if key[0] != id(ctx): continue
                if evo._owners.get(key) is not ctx: raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
                value=checked(raw); g.add("EVOLUTION",value,parents=[value["candidate_ref"]["content_hash"]])
                g.chain("EVOLUTION_EVENT",evo._events[key],value["content_hash"])
                target=value["content_hash"]
                if key in evo._evaluations: g.add("EVOLUTION_EVALUATION",checked(evo._evaluations[key]),parents=[target])
                if key in evo._approvals:
                    approval=decode(evo._approvals[key])
                    g.add("EVOLUTION_APPROVAL",approval,parents=[target,approval["binding"]["evaluation_hash"]])
                for raw_policy in evo._policies.values():
                    policy=decode(raw_policy)
                    if policy["context_id"]==host[1]: g.add("EVOLUTION_POLICY",policy)
                if key in evo._activations:
                    active=checked(evo._activations[key])
                    g.add("EVOLUTION_ACTIVATION",active,parents=[target,active["authority_hash"],active["evaluation_hash"]])
                for impact in evo._impacts.get(key,[]): g.add("EVOLUTION_IMPACT",checked(impact),parents=[target])
            for raw in evo._selections.values():
                value=checked(raw)
                if value["context_id"]!=host[1]: continue
                active=next((checked(r) for r in evo._activations.values() if decode(r)["activation_id"]==value["activation_id"]),None)
                if not active: raise JourneyError("JOURNEY_DANGLING_EDGE")
                sr=value["snapshot_ref"]
                actual=checked(self._candidates._snapshots.get_task_run(sr["session_id"],sr["task_id"],sr["run_id"],MemoryScope(*host[3])))
                if any(actual[k]!=v for k,v in sr.items()): raise JourneyError("JOURNEY_HASH_DRIFT")
                g.add("LEARNING_SNAPSHOT",actual)
                g.add("EVOLUTION_SELECTION",value,parents=[active["content_hash"],sr["content_hash"]],status="NOT_INTEGRATED")

    def _collect_hooks(self, g, ctx, host):
        if self._hooks:
            for key, raw in self._hooks._programs.items():
                if key[0] != id(ctx): continue
                value=decode(raw)
                if _hash(value["data"]) != value["ref"]["content_hash"]: raise JourneyError("JOURNEY_HASH_DRIFT")
                g.add("HOOK_PROGRAM",value,identity=value["ref"]["program_id"],version=value["ref"]["version"],digest=value["ref"]["content_hash"],parents=[value["candidate_ref"]["content_hash"]],status="NOT_EXECUTED")
            for key, raw in self._hooks._hooks.items():
                if key[0] != id(ctx): continue
                value=decode(raw)
                if _hash(value["contract"]) != value["hook_ref"]["content_hash"] or any(value["contract"].get(k)!=v for k,v in value["definition"].items()):
                    raise JourneyError("JOURNEY_HASH_DRIFT")
                g.add("HOOK",value,identity=value["hook_ref"]["hook_id"],version=value["hook_ref"]["version"],digest=value["hook_ref"]["content_hash"],parents=[value["candidate_ref"]["content_hash"],value["definition"]["program_ref"]["content_hash"]])
        if self._runtime:
            state=self._runtime._state
            for record in state["records"].values():
                original=decode(self._hooks._hooks.get((id(ctx),record["target"]["hook_id"],record["target"]["version"])))
                if original is None or original["definition"] != record["definition"] or original["hook_ref"] != record["target"]:
                    raise JourneyError("JOURNEY_HASH_DRIFT")
                g.chain("HOOK_EVENT",record["events"],record["target"]["content_hash"])
                for name in ("shadow","pilot","trust","fallback"):
                    if record[name]: g.add("HOOK_"+name.upper(),checked(record[name]),parents=[record["target"]["content_hash"]])
            for value in state["selections"].values():
                checked(value,omit=("selection_id",))
                if value["principal"]!=host[2] or value["context_id"]!=host[1]: raise JourneyError("JOURNEY_AUTHORITY_MISMATCH")
                if value["selection_id"]!="automation-selection-"+value["content_hash"]: raise JourneyError("JOURNEY_HASH_DRIFT")
                g.add("HOOK_SELECTION",value,parents=[h["target"]["content_hash"] for h in value["hooks"]])
            for value in state["receipts"].values():
                result=checked(value["result"])
                selection=state["selections"].get(result["selection_id"])
                if not selection: raise JourneyError("JOURNEY_DANGLING_EDGE")
                for child in result["receipts"]: checked(child)
                g.add("HOOK_RECEIPT",result,parents=[selection["content_hash"]],status="RECORDED_NOT_EXECUTED")
                # Stored decision inspection is not replay: packetless recursion
                # and builtin fallback receipts remain explainable without IO.
                _digest(value["signature"]); _digest(result["event_hash"])
                _text(result["reason"]); _text(result["selection_id"])
                decisions={"HOOK_ALLOW":"allow","HOOK_DENY":"deny","HOOK_MODIFY_CONFLICT":"deny","HOOK_ASK":"ask",
                           "HOOK_MODIFY":"modify","HOOK_FAULT_DENY":"deny","HOOK_RECURSION_BLOCKED":"deny"}
                if decisions.get(result["reason"])!=result["decision"]:
                    raise JourneyError("JOURNEY_INVALID_EVIDENCE")
                fallbacks=[]
                for item in selection["hooks"]:
                    record=state["records"].get(item["target"]["content_hash"])
                    if not record or record["target"]!=item["target"]: raise JourneyError("JOURNEY_DANGLING_EDGE")
                    if record["fallback"]:
                        fallback=checked(record["fallback"])
                        if fallback["target"]!=item["target"] or fallback["decision"]!="deny": raise JourneyError("JOURNEY_HASH_DRIFT")
                        fallbacks.append(fallback["content_hash"])
                g.nodes["HOOK_RECEIPT:"+result["content_hash"]]["stored_receipt"]=dict(
                    receipt_hash=result["content_hash"],decision=result["decision"],reason=result["reason"],
                    idempotency_hash=value["signature"],event_hash=result["event_hash"],selection_id=result["selection_id"],
                    selection_hash=selection["content_hash"],fallback_hashes=sorted(set(fallbacks)),
                    result_evidence_hashes=[r["content_hash"] for r in result["receipts"]],
                    evidence_status="RECORDED_NOT_REPLAYED",actual_os="NOT_EXECUTED",io_count=0)

    def _collect_models(self, g, ctx, host):
        if not self._models: return
        state=self._models._state
        for value in state["captures"].values(): g.add("MODEL_CAPTURE",checked(value))
        for bucket,kind in (("prompts","PROMPT"),("models","MODEL"),("benchmarks","BENCHMARK"),("routing_candidates","ROUTING")):
            for raw in state[bucket].values():
                value=checked(raw); parents=[]; data=value["data"]
                if kind=="PROMPT": parents=[data["candidate_ref"]["content_hash"],value["capture_hash"]]
                elif kind=="MODEL": parents=[value["capture_hash"]]
                elif kind=="BENCHMARK": parents=[data["target"][k]["content_hash"] for k in ("prompt","model")]
                elif kind=="ROUTING": parents=[r[k]["content_hash"] for r in data["routes"] for k in ("prompt","model","benchmark")]
                g.add(kind,value,parents=parents)
        for value in state["activations"]: g.add("ROUTING_ACTIVATION",checked(value),parents=[value["candidate_ref"]["content_hash"],value["approval_hash"]])
        for value in state["runs"].values(): g.add("ROUTING_SELECTION",checked(value),parents=[value["activation_hash"]],status="NOT_INTEGRATED")
        for value in state["quarantine"]: g.add("ROUTING_QUARANTINE",checked(value),parents=[value["activation_hash"]],status="QUARANTINED")

    def _view(self, ctx, host):
        graph=self._collect(ctx,host); nodes,edges=graph.finish()
        # Include head/status ledgers so pagination cannot silently cross a rollback.
        head = dict(source_states=sorted((str(k),str(v)) for k,v in self._candidates._reviews._sources._states.items() if k[0]==host[3]),
                    candidate_heads=sorted((str(k),str(v)) for k,v in self._candidates._heads.items() if k[0]==host[3]),
                    evolution_heads=sorted((str(k),str(v)) for k,v in self._evolution._heads.items() if k[0]==id(ctx)) if self._evolution else None,
                    runtime=_hash(self._runtime._state) if self._runtime else None, models=_hash(self._models._state) if self._models else None)
        timeline=self._timeline(graph,nodes,edges)
        result=dict(nodes=nodes,edges=edges,timeline=timeline,head_hash=_hash(head),context_id=host[1],principal_id=host[2],scope=to_primitive(MemoryScope(*host[3])),
                    hook_states=self._hook_states(),runtime_boundary="NOT_INTEGRATED",actual_ui="NOT_EXECUTED",available=dict(skills=self._skills is not None,hooks=self._hooks is not None))
        result["content_hash"]=_hash(result)
        return result,graph

    def _timeline(self, graph, nodes, edges):
        """Canonical lifecycle chronology; undated evidence never acquires a made-up time."""
        rows={}; observed={}; parents={n["node_id"]:set() for n in nodes}
        for node in nodes:
            raw=graph.raw[node["node_id"]]
            for field in ("evidence", "evidence_hash", "receipt_hash"):
                ref=raw.get(field)
                if isinstance(ref,str) and raw.get("created_at"):
                    observed.setdefault(ref,[]).append((raw["created_at"],node["artifact_hash"]))
        for node in nodes:
            raw=graph.raw[node["node_id"]]; date=None; basis=None; source=None
            for field in ("created_at","issued_at","captured_at"):
                if raw.get(field): date,basis,source=raw[field],field,node["artifact_hash"]; break
            if date is None and node["kind"]=="SKILL":
                date,basis,source=raw["capture"]["issued_at"],"capture.issued_at",raw["capture_hash"]
            if date is None and node["artifact_hash"] in observed:
                date,source=min(observed[node["artifact_hash"]]); basis="referencing_event.created_at"
            if date is not None: date=_time(datetime.fromisoformat(date)).astimezone(timezone.utc).isoformat()
            status=node["status"]
            if node["kind"] in ("SOURCE","CANDIDATE"): status="REGISTERED" if node["kind"]=="SOURCE" else "CREATED"
            rows[node["node_id"]]=dict(node_id=node["node_id"],kind=node["kind"],created_at=date,status=status,
                                        time_basis=basis or "NOT_RECORDED",time_source_hash=source,
                                        previous_hash=raw.get("previous_hash"),evidence_hash=node["artifact_hash"])
        for edge in edges: parents[edge["to"]].add(edge["from"])
        pending=set(rows); done=set(); ordered=[]; bounds={}
        while pending:
            ready=[key for key in pending if parents[key]<=done]
            if not ready: raise JourneyError("JOURNEY_CYCLE")
            for key in ready:
                lower=max((bounds[p] for p in parents[key]),default="")
                date=rows[key]["created_at"]
                if date and lower and date<lower: raise JourneyError("JOURNEY_TIME_DRIFT")
                bounds[key]=date or lower
            key=min(ready,key=lambda k:(bounds[k],rows[k]["kind"],k))
            ordered.append(rows[key]); done.add(key); pending.remove(key)
        return ordered

    def _hook_states(self):
        if not self._runtime: return []
        values=[]
        for key,record in sorted(self._runtime._state["records"].items()):
            definition=record["definition"]
            values.append(dict(hook_ref=record["target"],event=definition["event"],matcher_hash=_hash(definition["matcher"]),
                               program_ref=definition["program_ref"],failure_policy=definition["failure_policy"],
                               fault_policy_hash=_hash([definition["event"],definition["failure_policy"]]),status=record["status"],
                               trust_hash=record["trust"]["content_hash"] if record["trust"] else None,
                               fallback_hash=record["fallback"]["content_hash"] if record["fallback"] else None,
                               rollback_ref=record["rollback_ref"],affected_runs=sorted(record["affected_runs"]),
                               notifications_hash=_hash(record["notifications"]),audit_hash=_hash(record["audit"]),
                               runtime_snapshot_hash=_hash(self._runtime._state["automation"]),actual_os="NOT_EXECUTED"))
        # Only structured identity/status metadata, never command or environment.
        for value in values:
            for run in value["affected_runs"]: _text(run)
        return values

    @boundary
    def query(self, ctx, *, now):
        with self._session(ctx,now) as host: return snapshot(self._view(ctx,host)[0])

    @boundary
    def list(self, ctx, *, limit=25, cursor=None, now):
        with self._session(ctx,now) as host:
            if type(limit) is not int or not 1<=limit<=100: raise JourneyError("INVALID_JOURNEY_INPUT")
            view,_=self._view(ctx,host); start=0
            if cursor is not None:
                stored=self._authority.cursors.get(cursor)
                if not stored or stored[0] is not ctx: raise JourneyError("JOURNEY_CURSOR_INVALID")
                if stored[1]!=view["content_hash"]: raise JourneyError("JOURNEY_SNAPSHOT_MISMATCH")
                start=stored[2]
            end=min(start+limit,len(view["nodes"])); next_cursor=None
            if end<len(view["nodes"]):
                next_cursor="cursor-"+_hash([host[1],view["content_hash"],end])
                self._authority.cursors[next_cursor]=(ctx,view["content_hash"],end)
            return snapshot(dict(items=view["nodes"][start:end],next_cursor=next_cursor,snapshot_hash=view["content_hash"]))

    @boundary
    def detail(self, ctx, node_id, *, snapshot_hash, now):
        with self._session(ctx,now) as host:
            view,_=self._view(ctx,host)
            if view["content_hash"]!=snapshot_hash: raise JourneyError("JOURNEY_SNAPSHOT_MISMATCH")
            item=next((n for n in view["nodes"] if n["node_id"]==node_id),None)
            if item is None: raise JourneyError("JOURNEY_NOT_FOUND")
            return snapshot(item)

    @boundary
    def lineage(self, ctx, node_id, *, snapshot_hash, now):
        with self._session(ctx,now) as host:
            view,_=self._view(ctx,host)
            if view["content_hash"]!=snapshot_hash: raise JourneyError("JOURNEY_SNAPSHOT_MISMATCH")
            if node_id not in {n["node_id"] for n in view["nodes"]}: raise JourneyError("JOURNEY_NOT_FOUND")
            selected={node_id}
            while True:
                expanded=selected|{e["from"] for e in view["edges"] if e["to"] in selected}
                if expanded==selected: break
                selected=expanded
            return snapshot(dict(nodes=[n for n in view["nodes"] if n["node_id"] in selected],edges=[e for e in view["edges"] if e["to"] in selected],snapshot_hash=snapshot_hash))

    @boundary
    def skill_explanation(self, ctx, invocation_id, *, now):
        with self._session(ctx,now) as host:
            view,g=self._view(ctx,host)
            found=next((k for k,n in g.nodes.items() if n["kind"]=="SKILL_INVOCATION" and n["artifact_id"]==invocation_id),None)
            if not found: raise JourneyError("JOURNEY_NOT_FOUND")
            invocation=g.raw[found]
            material=g.raw["SKILL:"+invocation["skill_ref"]["content_hash"]]
            binding=material["capture"]["binding"]; data=material["data"]
            if invocation["capture_hash"]!=material["capture_hash"] or invocation["selection_ref"]!=binding["selection_ref"]:
                raise JourneyError("JOURNEY_HASH_DRIFT")
            selected=g.raw["SELECTION:"+invocation["selection_ref"]["content_hash"]]
            uses=[v for k,v in g.raw.items() if g.nodes[k]["kind"]=="SKILL_USE" and v["invocation_ref"]["content_hash"]==invocation["content_hash"]]
            task=invocation["task"].casefold()
            def facts(values): return [dict(index=i,condition_hash=_hash(text),matched=text.casefold() in task) for i,text in enumerate(values)]
            candidate=g.nodes["CANDIDATE:"+binding["candidate_ref"]["content_hash"]]
            return snapshot(dict(skill_ref=invocation["skill_ref"],invocation_ref=dict(invocation_id=invocation_id,content_hash=invocation["content_hash"]),
                                 mode=invocation["mode"],reason=invocation["reason"],input_hash=_hash(invocation["task"]),
                                 triggers=facts(data["triggers"]),exclusions=facts(data["exclusions"]),source_roots=binding["source_roots"],
                                 activation_ref=binding["activation_ref"],trust_hash=material["capture_hash"],snapshot_ref=selected["snapshot_ref"],
                                 application_status="RECORDED_NOT_EXECUTED" if uses else "NOT_EXECUTED",application_hashes=[u["content_hash"] for u in uses],
                                 rollback_status=candidate["status"],actual_program_execution="NOT_EXECUTED",runtime_boundary="NOT_INTEGRATED",snapshot_hash=view["content_hash"]))

    @boundary
    def hook_replay(self, ctx, receipt_hash, *, now):
        return self._replay(ctx,receipt_hash,now=now,capture=False)

    @boundary
    def capture_replay_evidence(self, ctx, receipt_hash, *, now):
        """Trusted host-only archival seam, not an API route or program execution.

        Validate the existing D10 result and packet once before its executor is
        released. Store canonical immutable bytes under host authority; replay
        never consults the executor. No caller packet/approval is accepted.
        """
        self._replay(ctx,receipt_hash,now=now,capture=True)
        entry=self._authority._replays[(id(ctx),receipt_hash)]
        return snapshot(dict(receipt_hash=receipt_hash,evidence_hash=entry[1],executed=False,io_count=0))

    def _replay(self, ctx, receipt_hash, *, now, capture):
        with self._session(ctx,now) as host:
            view,g=self._view(ctx,host)
            if not self._runtime: raise JourneyError("JOURNEY_MISSING_EVIDENCE")
            runtime=self._runtime
            stored=next((v for v in runtime._state["receipts"].values() if v["result"]["content_hash"]==receipt_hash),None)
            if not stored: raise JourneyError("JOURNEY_NOT_FOUND")
            result=checked(stored["result"]); selected=runtime._state["selections"].get(result["selection_id"])
            if not selected: raise JourneyError("JOURNEY_DANGLING_EDGE")
            replay_key=(id(ctx),receipt_hash)
            sealed=self._authority._replays.get(replay_key)
            if sealed:
                if sealed[0] is not ctx or _hash(json.loads(sealed[2]))!=sealed[1]: raise JourneyError("JOURNEY_HASH_DRIFT")
                evidence=json.loads(sealed[2])
                if (evidence["receipt"]!=stored or evidence["selection"]!=selected or evidence["context_id"]!=host[1]
                        or evidence["principal_id"]!=host[2]): raise JourneyError("JOURNEY_HASH_DRIFT")
                packets=evidence["packets"]
            elif capture:
                packets=[to_primitive(p) for p in getattr(runtime._executor,"calls",()) if _hash(p["event"])==result["event_hash"]
                         and _hash([result["selection_id"],p["event"],p["input"]])==stored["signature"]]
                # Sorting/deduplication makes repeated host captures deterministic.
                packets=[json.loads(raw) for raw in sorted({_canonical(p) for p in packets})]
                evidence=dict(receipt=stored,selection=selected,packets=packets,context_id=host[1],principal_id=host[2])
            else: raise JourneyError("JOURNEY_MISSING_EVIDENCE")
            if not packets: raise JourneyError("JOURNEY_MISSING_EVIDENCE")
            event=packets[0]["event"]; input_hash=_hash(packets[0]["input"])
            if any(p["event"]!=event or _hash(p["input"])!=input_hash for p in packets): raise JourneyError("JOURNEY_HASH_DRIFT")
            if _hash(event)!=result["event_hash"] or _hash([result["selection_id"],event,packets[0]["input"]])!=stored["signature"]:
                raise JourneyError("JOURNEY_HASH_DRIFT")
            traces=[]; results=[]; faults=[]; deny=False; program_hashes=set()
            selected_hashes={h["target"]["content_hash"] for h in selected["hooks"]}
            for receipt in result["receipts"]:
                checked(receipt)
                if not receipt.get("executor_called"): continue
                matches=[p for p in packets if _hash(p["program"])==receipt["program_hash"] and p["target"]["content_hash"] in selected_hashes]
                targets={p["target"]["content_hash"] for p in matches}
                if len(targets)!=1: raise JourneyError("JOURNEY_MISSING_EVIDENCE")
                packet=matches[0]; record=runtime._state["records"][packet["target"]["content_hash"]]
                if packet["program"]!=record["registry_record"]["program"]["data"] or _hash(packet["profile"])!=receipt["profile_hash"]:
                    raise JourneyError("JOURNEY_HASH_DRIFT")
                definition=record["definition"]; matcher=definition["matcher"]
                include=[self._hooks._matches(c,event["payload"]) for c in matcher["all"]]
                exclude=[self._hooks._matches(c,event["payload"]) for c in matcher["exclude"]]
                if definition["event"]!=event["event"] or not all(include) or any(exclude): raise JourneyError("JOURNEY_HASH_DRIFT")
                traces.append(dict(hook_ref=record["target"],matcher_hash=_hash(matcher),include=include,exclude=exclude,matched=True,
                                   payload_facts=[dict(field=k,value_hash=_hash(v)) for k,v in sorted(event["payload"].items())]))
                program_hashes.add(receipt["program_hash"])
                if receipt.get("fault"):
                    projection=checked(receipt["fault_projection"]); closed=definition["failure_policy"]=="fail_closed"
                    expected=to_primitive(self._hooks._fault(record["registry_record"],record["target"],"timeout" if receipt["fault"]=="timeout" else "error"))
                    if (projection!=expected or receipt["projection_hash"]!=projection["content_hash"]
                            or receipt["failure_policy"]!=definition["failure_policy"] or receipt["canonical_decision"]!=("deny" if closed else "allow")
                            or receipt["warning"] is not (not closed) or receipt["log"] is not True):
                        raise JourneyError("JOURNEY_HASH_DRIFT")
                    checked(receipt["fault_merge"]); deny |= closed
                    faults.append(dict(fault=receipt["fault"],failure_policy=definition["failure_policy"],decision=projection["decision"],
                                       warning=projection["warning"],log=projection["log"],projection_hash=projection["content_hash"]))
                elif receipt.get("result"):
                    if receipt["result"]["result"] not in record["trust"]["allowed_results"]: raise JourneyError("JOURNEY_HASH_DRIFT")
                    results.append(receipt["result"])
            outcome=to_primitive(merge_results(event["event"],results))
            if deny: outcome.update(decision="deny",reason="HOOK_FAULT_DENY",modifications={})
            if any(result.get(k)!=outcome.get(k) for k in ("decision","reason","modifications","messages")):
                raise JourneyError("JOURNEY_HASH_DRIFT")
            if capture and not sealed:
                raw=_canonical(evidence)
                self._authority._replays[replay_key]=(ctx,_hash(json.loads(raw)),raw)
            return snapshot(dict(receipt_hash=receipt_hash,event_hash=result["event_hash"],input_hash=input_hash,event=event["event"],depth=event["depth"],
                                 decision=outcome["decision"],reason=outcome["reason"],modifications_hash=_hash(outcome["modifications"]),
                                 matcher_trace=traces,faults=faults,program_hashes=sorted(program_hashes),selection_hash=selected["content_hash"],
                                 hook_states=[v for v in view["hook_states"] if v["hook_ref"]["content_hash"] in selected_hashes],
                                 idempotency_hash=stored["signature"],snapshot_hash=view["content_hash"],executed=False,io_count=0,
                                 actual_os="NOT_EXECUTED",runtime_boundary="NOT_INTEGRATED"))

    @boundary
    def menu(self, ctx, name, *, snapshot_hash=None, now):
        with self._session(ctx,now) as host:
            if name not in ("Learning Studio","Skills","Hooks","Learning Journey"): raise JourneyError("INVALID_JOURNEY_INPUT")
            base=dict(menu=name,source=[],evidence=[],last_verified=None,rollback="PENDING",next_action="LOAD_READ_SNAPSHOT",actual_ui="NOT_EXECUTED")
            if snapshot_hash is None: return snapshot(dict(base,state="loading"))
            try: view,_=self._view(ctx,host)
            except JourneyError as error: return snapshot(dict(base,state="blocked",reason=error.reason,next_action="VERIFY_EVIDENCE"))
            if snapshot_hash!=view["content_hash"]: return snapshot(dict(base,state="error",reason="JOURNEY_SNAPSHOT_MISMATCH",next_action="RELOAD_READ_SNAPSHOT"))
            group={"Skills":{"SKILL","SKILL_INVOCATION"},"Hooks":{"HOOK","HOOK_RECEIPT"},"Learning Studio":{"SOURCE","REVIEW","CANDIDATE"}}
            nodes=[n for n in view["nodes"] if name=="Learning Journey" or n["kind"] in group[name]]
            if (name=="Skills" and not self._skills) or (name=="Hooks" and not self._hooks): state="not_executed"
            elif any(n["status"] in ("REVOKED","QUARANTINED","ROLLED_BACK") for n in view["nodes"]): state="blocked"
            else: state="ready" if nodes else "empty"
            base.update(source=[n["node_id"] for n in nodes],evidence=[n["evidence_hash"] for n in nodes],
                        last_verified=max((n["created_at"] for n in nodes if n["created_at"]),default=None),
                        rollback="READ_ONLY_OWNER_ACTION_REQUIRED",next_action="INSPECT_LINEAGE",snapshot_hash=snapshot_hash)
            return snapshot(dict(base,state=state))

    @boundary
    def export_state(self, ctx, *, now):
        with self._session(ctx,now) as host:
            view,_=self._view(ctx,host)
            cursors={k:list(v[1:]) for k,v in self._authority.cursors.items() if v[0] is ctx and v[1]==view["content_hash"]}
            replays={key[1]:value[1] for key,value in self._authority._replays.items() if value[0] is ctx}
            envelope=dict(snapshot=view,cursors=cursors,replay_evidence_hashes=replays,context_id=host[1],principal_id=host[2]); envelope["content_hash"]=_hash(envelope)
            self._authority.checkpoints[envelope["content_hash"]]=(ctx,_canonical(envelope))
            return snapshot(envelope)

    @boundary
    def import_state(self, ctx, envelope, *, now):
        with self._session(ctx,now) as host:
            envelope=to_primitive(envelope); fields(envelope,"snapshot cursors replay_evidence_hashes context_id principal_id content_hash")
            saved=self._authority.checkpoints.get(envelope["content_hash"])
            view,_=self._view(ctx,host)
            if not saved or saved[0] is not ctx or saved[1]!=_canonical(envelope) or envelope["snapshot"]!=view:
                raise JourneyError("JOURNEY_CHECKPOINT_INVALID")
            for receipt,digest in envelope["replay_evidence_hashes"].items():
                sealed=self._authority._replays.get((id(ctx),receipt))
                if not sealed or sealed[0] is not ctx or sealed[1]!=digest or _hash(json.loads(sealed[2]))!=digest:
                    raise JourneyError("JOURNEY_CHECKPOINT_INVALID")
            for key,(digest,offset) in envelope["cursors"].items(): self._authority.cursors[key]=(ctx,digest,offset)
            return snapshot(view)
