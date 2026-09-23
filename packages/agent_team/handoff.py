"""E02 host-captured role handoffs. No worker execution, Gate seal or acceptance.

Constructor/capture methods are trusted in-process host capabilities, not public
authentication endpoints. ArtifactStore is injected; only explicit capture/check
and resolve read it. Tests use a memory store, never a network or OS adapter.
"""
from __future__ import annotations


def validate_team_role_result(service, envelope, assignment, **authority):
    """C23 proposal validation using C22; deliberately no E02 artifact I/O."""
    from .role_results import RoleResultService, RoleEnvelope
    if type(service) is not RoleResultService or type(envelope) is not RoleEnvelope:
        raise ValueError('CANONICAL_ROLE_RESULT_REQUIRED')
    receipt = service.validate_role_envelope(envelope, assignment=assignment, **authority)
    if not receipt.valid:
        raise ValueError(receipt.reason)
    return receipt

import copy
import hashlib
import json
import re
from dataclasses import dataclass, field, fields, replace
from datetime import datetime
from functools import wraps
from threading import RLock

from packages.artifacts import EvidenceManifest, RawArtifactChecksum, ArtifactMetadata, ArtifactStore, AcquisitionMode
from packages.orchestration import DeveloperLifecycleService, LifecycleStatus, RawResultArtifact
from packages.orchestration.delegation import DelegationPacket
from packages.orchestration.result_envelope import ResultEnvelope, validate_result
from .role_contracts import RolePolicyService, RoleAssignment, contract_hash, _plain, _text, _hash, _utc
from .role_results import RoleResultService, RoleResult


class HandoffError(ValueError):
    def __init__(self,reason): self.reason=reason; super().__init__(reason)


def _guard(method):
    @wraps(method)
    def call(*args,**kwargs):
        try: return method(*args,**kwargs)
        except HandoffError: raise
        except (ValueError,TypeError,KeyError,AttributeError,RecursionError,OverflowError):
            raise HandoffError("HANDOFF_INPUT_INVALID") from None
    return call


def _id(value):
    if type(value) is not str or re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}",value) is None:
        raise HandoffError("HANDOFF_ID_INVALID")


def _bytes_hash(value): return "sha256:"+hashlib.sha256(value).hexdigest()


def _manifest_snapshot(value):
    if type(value) is not EvidenceManifest: raise HandoffError("MANIFEST_REQUIRED")
    return replace(value,toolchain_versions=dict(value.toolchain_versions),
        raw_artifact_checksums=tuple(replace(r) for r in value.raw_artifact_checksums))


@dataclass(frozen=True,slots=True)
class ArtifactRef:
    artifact_id:str
    checksum:str
    byte_size:int
    media_type:str


@dataclass(frozen=True,slots=True)
class SourceRef:
    source_id:str
    content_hash:str


@dataclass(frozen=True,slots=True)
class _Source:
    source_id:str
    role:str
    sender_id:str
    sender_hash:str
    actor_id:str
    context_id:str
    workspace_id:str
    execution_fence:str
    result:ResultEnvelope
    role_result:RoleResult|None
    assignment:RoleAssignment|None
    manifest:EvidenceManifest
    metadata:tuple[ArtifactMetadata,...]
    issued_at:datetime
    expires_at:datetime
    raw_result_hash:str|None
    content_hash:str=field(init=False)

    def __post_init__(self): object.__setattr__(self,"content_hash",contract_hash(self))


@dataclass(frozen=True,slots=True)
class RoleHandoff:
    handoff_id:str
    version:int
    project_id:str
    session_id:str
    run_id:str
    step_id:str
    attempt_id:str
    attempt_number:int
    step_lineage_id:str
    stage:str
    predecessor_id:str|None
    predecessor_hash:str|None
    source_id:str
    source_hash:str
    source_result_id:str
    source_result_hash:str
    sender_assignment_id:str
    sender_assignment_hash:str
    recipient_assignment_id:str
    recipient_assignment_hash:str
    target_hash:str
    baseline_hash:str
    work_plan_hash:str
    work_instruction_hash:str
    manifest_id:str
    manifest_hash:str
    environment_id:str
    toolchain_versions:tuple[tuple[str,str],...]
    summary:str
    artifact_refs:tuple[ArtifactRef,...]
    issued_at:datetime
    expires_at:datetime
    execution_fence:str
    schema_version:str="role_handoff/v1"
    content_hash:str=field(init=False)

    def __post_init__(self): object.__setattr__(self,"content_hash",contract_hash(self))


class RoleHandoffService:
    @_guard
    def __init__(self,policy,results,lifecycle,store,*,project_id,session_id,developer_session_id,developer_packet,
                 developer_actor,developer_context,developer_fence,target_hash,baseline_hash,work_plan_hash,
                 work_instruction_hash,environment_id,toolchain_versions):
        if (type(policy) is not RolePolicyService or type(results) is not RoleResultService or results._policy is not policy
            or type(lifecycle) is not DeveloperLifecycleService or not isinstance(store,ArtifactStore)
            or type(developer_packet) is not DelegationPacket): raise HandoffError("HOST_AUTHORITY_REQUIRED")
        for v in (project_id,session_id,developer_session_id,developer_actor,developer_context,developer_fence,environment_id): _id(v)
        for v in (target_hash,baseline_hash,work_plan_hash,work_instruction_hash): _hash(v)
        toolchain=dict(toolchain_versions)
        if not toolchain: raise HandoffError("TOOLCHAIN_REQUIRED")
        for k,v in toolchain.items(): _text(k); _text(v)
        if (len(toolchain)>32 or any(len(k.encode("utf-8"))>64 or len(v.encode("utf-8"))>256 for k,v in toolchain.items())
            or sum(len(k.encode("utf-8"))+len(v.encode("utf-8")) for k,v in toolchain.items())>4096):
            raise HandoffError("TOOLCHAIN_TOO_LARGE")
        self._policy,self._results,self._lifecycle,self._store=policy,results,lifecycle,store
        self._project,self._session=project_id,session_id
        self._developer_session=developer_session_id; self._packet=copy.deepcopy(developer_packet)
        self._packet_hash=developer_packet.packet_hash
        self._developer=(developer_actor,developer_context,developer_packet.workspace_id,developer_fence)
        self._target,self._baseline,self._plan,self._wi=target_hash,baseline_hash,work_plan_hash,work_instruction_hash
        self._environment=environment_id; self._toolchain=tuple(sorted(toolchain.items()))
        self._sources={}; self._source_seals={}; self._handoffs={}; self._handoff_seals={}; self._requests={}; self._lock=RLock()
        self._developer_current()

    @property
    def handoff_count(self): return len(self._handoffs)

    def _developer_current(self):
        current=self._lifecycle.session(self._developer_session)
        if (current.packet_hash!=self._packet_hash or self._packet.packet_hash!=self._packet_hash
            or current.delegation_id!=self._packet.delegation_id or self._packet.baseline_hash!=self._baseline):
            raise HandoffError("DEVELOPER_BINDING_MISMATCH")
        if current.raw_result is not None:
            raw=current.raw_result
            if json.loads(raw.artifact.content)!=raw.to_dict(): raise HandoffError("SOURCE_RESULT_DRIFT")
        return current

    def _assignment(self,ident,*,actor_id,context_id,session_id,target_hash,execution_fence,now):
        _id(ident)
        if session_id!=self._session or target_hash!=self._target: raise HandoffError("HANDOFF_AUTHORITY_MISMATCH")
        a=self._policy.get_assignment(ident)
        reason=self._policy.validate_assignment(a,actor_id=actor_id,context_id=context_id,session_id=session_id,
            target_hash=target_hash,execution_fence=execution_fence,now=now)
        if reason: raise HandoffError(reason)
        if a.baseline_hash!=self._baseline: raise HandoffError("BASELINE_MISMATCH")
        if (a.packet.parent_run_id,a.packet.step_id)!=(self._packet.parent_run_id,self._packet.step_id):
            raise HandoffError("HANDOFF_LINEAGE_MISMATCH")
        return a

    def _source_authority(self,s,now,*,final=False):
        if not s.issued_at<=now<s.expires_at: raise HandoffError("SOURCE_EXPIRED")
        if s.role=="DEVELOPER":
            current=self._developer_current()
            if current.raw_result is None or current.raw_result.artifact.sha256!=s.raw_result_hash:
                raise HandoffError("SOURCE_RESULT_DRIFT")
            RawResultArtifact(current.raw_result.artifact.content,s.raw_result_hash)
        else:
            a=s.assignment
            self._assignment(a.assignment_id,actor_id=a.actor_id,context_id=a.context_id,session_id=a.session_id,
                target_hash=a.target_hash,execution_fence=a.execution_fence,now=now)
            if final:
                # E01 has already validated this exact result before artifact I/O.
                # Recheck its current canonical registration without audit/budget writes.
                r=s.role_result
                if (r.content_hash!=contract_hash(r)
                    or self._results._results.get((a.assignment_id,r.envelope.result_id))!=r.content_hash):
                    raise HandoffError("SOURCE_RESULT_DRIFT")
                for e in r.evidence:
                    current=self._results.get_evidence(e.evidence_id)
                    if (contract_hash(current)!=e.content_hash or current.content_hash!=e.content_hash
                        or self._results._seals.get(e.evidence_id)!=e.content_hash): raise HandoffError("SOURCE_RESULT_DRIFT")
            else:
                receipt=self._results.validate(s.role_result,assignment=a,actor_id=a.actor_id,context_id=a.context_id,
                    session_id=a.session_id,target_hash=a.target_hash,execution_fence=a.execution_fence,now=now)
                if not receipt.valid: raise HandoffError(receipt.reason)

    def _source_fence(self,s,now):
        if (contract_hash(s)!=s.content_hash or self._source_seals.get(s.source_id,s.content_hash)!=s.content_hash
            or (s.source_id in self._sources and contract_hash(self._sources[s.source_id])!=s.content_hash)):
            raise HandoffError("SOURCE_UNKNOWN_OR_TAMPERED")
        self._source_authority(s,now,final=True)

    def _read(self,metadata):
        # Never let an adapter mutate either canonical metadata or the expected
        # validation tuple. Every field, including storage/authority, is bound.
        names=tuple(f.name for f in fields(ArtifactMetadata))
        expected=copy.deepcopy(tuple(getattr(metadata,n) for n in names))
        expected_hash,expected_size=metadata.content_hash,metadata.byte_size
        detached=replace(metadata)
        try: value=self._store.read(detached)
        except Exception: raise HandoffError("ARTIFACT_INTEGRITY") from None
        if (tuple(getattr(metadata,n) for n in names)!=expected or tuple(getattr(detached,n) for n in names)!=expected
            or type(value) is not bytes or len(value)!=expected_size or _bytes_hash(value)!=expected_hash):
            raise HandoffError("ARTIFACT_INTEGRITY")
        return value

    def _check_evidence(self,s,now):
        m=_manifest_snapshot(s.manifest)
        _id(m.manifest_id)
        for entries in (m.unverified_scope,m.skipped_or_blocked):
            if len(entries)>32 or any(type(v) is not str or len(v.encode("utf-8"))>256 for v in entries):
                raise HandoffError("MANIFEST_PROJECTION_TOO_LARGE")
        if ((m.target_hash,m.delivered_artifact_hash,m.design_baseline_hash,m.work_plan_hash,m.work_instruction_hash,m.environment_id)
            !=(self._target,self._target,self._baseline,self._plan,self._wi,self._environment)
            or tuple(sorted(m.toolchain_versions.items()))!=self._toolchain
            or (m.actor_id,m.actor_role)!=(s.actor_id,s.role.lower()) or m.finished_at>now):
            raise HandoffError("MANIFEST_BINDING_MISMATCH")
        if not s.metadata or len(s.metadata)>64: raise HandoffError("ARTIFACT_SET_INVALID")
        if len({a.artifact_id for a in s.metadata})!=len(s.metadata) or len({a.storage_ref for a in s.metadata})!=len(s.metadata):
            raise HandoffError("ARTIFACT_SET_INVALID")
        bypath={r.path:r for r in m.raw_artifact_checksums}
        if set(bypath)!={a.storage_ref for a in s.metadata}: raise HandoffError("ARTIFACT_SET_INVALID")
        found_raw=s.raw_result_hash is None
        for a in s.metadata:
            if type(a) is not ArtifactMetadata: raise HandoffError("ARTIFACT_METADATA_INVALID")
            _id(a.artifact_id); checked=replace(a)
            if (a.project_id,a.run_id,a.step_id,a.actor_id)!=(self._project,self._packet.parent_run_id,self._packet.step_id,s.actor_id):
                raise HandoffError("ARTIFACT_AUTHORITY_MISMATCH")
            if a.created_at>now or a.byte_size>16*1024*1024 or a.media_type not in {"text/plain","application/json"}:
                raise HandoffError("ARTIFACT_METADATA_INVALID")
            row=bypath[a.storage_ref]
            if type(row) is not RawArtifactChecksum or (row.sha256,row.bytes)!=(a.content_hash,a.byte_size):
                raise HandoffError("ARTIFACT_INTEGRITY")
            raw=self._read(checked)
            if a.content_hash==s.raw_result_hash:
                if a.media_type!="application/json": raise HandoffError("ARTIFACT_MEDIA_MISMATCH")
                found_raw=True
        if not found_raw: raise HandoffError("DEVELOPER_RAW_ARTIFACT_REQUIRED")
        byid={a.artifact_id:a.content_hash for a in s.metadata}
        if not validate_result(s.result.to_dict()).valid or any(byid.get(r.evidence_id)!=r.checksum for r in s.result.evidence_refs):
            raise HandoffError("RESULT_EVIDENCE_MISMATCH")

    def _capture(self,s,now):
        _id(s.source_id); _utc(now); _utc(s.expires_at)
        if now!=s.issued_at or not now<s.expires_at: raise HandoffError("SOURCE_EXPIRED")
        if len(s.result.summary.encode("utf-8"))>2048: raise HandoffError("SUMMARY_TOO_LARGE")
        self._source_authority(s,now); self._check_evidence(s,now)
        with self._lock:
            self._source_fence(s,now)
            old=self._source_seals.get(s.source_id)
            if old is not None and old!=s.content_hash: raise HandoffError("SOURCE_REBIND")
            if old is None: self._sources[s.source_id]=s; self._source_seals[s.source_id]=s.content_hash
            return SourceRef(s.source_id,s.content_hash)

    @_guard
    def capture_developer(self,*,source_id,manifest,metadata,now,expires_at):
        """HOST ONLY: capture the already-existing lifecycle result. No runner call."""
        current=self._developer_current()
        if current.raw_result is None or current.status not in {LifecycleStatus.COMPLETED,LifecycleStatus.FAILED,LifecycleStatus.STOPPED}:
            raise HandoffError("DEVELOPER_RESULT_REQUIRED")
        raw=current.raw_result; artifact=raw.artifact; RawResultArtifact(artifact.content,artifact.sha256)
        result=ResultEnvelope.from_dict(raw.to_dict()["payload"]["result"])
        if result.delegation_id!=current.delegation_id or result.target_hash!=self._target: raise HandoffError("SOURCE_RESULT_MISMATCH")
        actor,context,workspace,fence=self._developer
        s=_Source(source_id,"DEVELOPER",current.delegation_id,current.packet_hash,actor,context,workspace,fence,
            result,None,None,_manifest_snapshot(manifest),tuple(replace(a) for a in metadata),now,expires_at,artifact.sha256)
        return self._capture(s,now)

    @_guard
    def capture_reviewer(self,*,source_id,result,assignment,manifest,metadata,now,expires_at):
        """HOST ONLY: source is revalidated by the same E01 authority, not caller receipt."""
        if type(result) is not RoleResult or type(assignment) is not RoleAssignment or assignment.definition.role!="REVIEWER":
            raise HandoffError("REVIEWER_RESULT_REQUIRED")
        a=self._assignment(assignment.assignment_id,actor_id=assignment.actor_id,context_id=assignment.context_id,
            session_id=assignment.session_id,target_hash=assignment.target_hash,execution_fence=assignment.execution_fence,now=now)
        if a.content_hash!=assignment.content_hash: raise HandoffError("ASSIGNMENT_TAMPERED")
        r=replace(result,envelope=ResultEnvelope.from_dict(result.envelope.to_dict()))
        s=_Source(source_id,"REVIEWER",a.assignment_id,a.content_hash,a.actor_id,a.context_id,a.workspace_id,a.execution_fence,
            r.envelope,r,a,_manifest_snapshot(manifest),tuple(replace(a) for a in metadata),now,expires_at,None)
        return self._capture(s,now)

    def _source(self,ident,expected,now):
        _id(ident); _hash(expected); _utc(now)
        s=self._sources.get(ident)
        if s is None or self._source_seals.get(ident)!=expected or contract_hash(s)!=expected or s.content_hash!=expected:
            raise HandoffError("SOURCE_UNKNOWN_OR_TAMPERED")
        self._source_authority(s,now); self._check_evidence(s,now)
        self._source_fence(s,now)
        return s

    def _predecessor(self,ident,expected,s,now):
        previous=self._handoffs.get(ident)
        if (previous is None or previous.content_hash!=expected or contract_hash(previous)!=expected
            or self._handoff_seals.get(ident)!=expected or previous.stage!="DEVELOPER_TO_REVIEWER"
            or previous.recipient_assignment_hash!=s.sender_hash or previous.target_hash!=self._target
            or not previous.issued_at<=now<previous.expires_at): raise HandoffError("PREDECESSOR_MISMATCH")
        # Equality is permitted for coarse host clock resolution; no evidence
        # timestamp may precede delivery. RoleResult capture is s.issued_at.
        times=(s.issued_at,s.manifest.started_at,s.manifest.finished_at,
               *(e.captured_at for e in s.role_result.evidence),*(m.created_at for m in s.metadata))
        if any(t<previous.issued_at for t in times): raise HandoffError("PREDECESSOR_CAUSALITY_MISMATCH")
        parent_source=self._sources[previous.source_id]
        if parent_source.content_hash!=previous.source_hash: raise HandoffError("PREDECESSOR_MISMATCH")
        self._source_fence(parent_source,now)
        return previous

    @_guard
    def create(self,*,handoff_id,request_id,source_id,source_hash,recipient_id,predecessor_id,predecessor_hash,expires_at,
               actor_id,context_id,session_id,target_hash,execution_fence,now):
        auth=dict(actor_id=actor_id,context_id=context_id,session_id=session_id,target_hash=target_hash,execution_fence=execution_fence,now=now)
        with self._lock:
            _id(handoff_id); _id(request_id); _utc(expires_at); _utc(now)
            a=self._assignment(recipient_id,**auth); s=self._source(source_id,source_hash,now)
            if not now<expires_at<=min(a.expires_at,s.expires_at): raise HandoffError("HANDOFF_EXPIRED")
            if any(x==y for x,y in zip((a.actor_id,a.context_id,a.workspace_id),(s.actor_id,s.context_id,s.workspace_id))):
                raise HandoffError("HANDOFF_INDEPENDENCE_REQUIRED")
            if s.role=="DEVELOPER":
                if a.definition.role!="REVIEWER" or predecessor_id is not None or predecessor_hash is not None:
                    raise HandoffError("HANDOFF_STAGE_INVALID")
                stage="DEVELOPER_TO_REVIEWER"
            else:
                if a.definition.role!="TESTER": raise HandoffError("HANDOFF_STAGE_INVALID")
                if type(predecessor_id) is not str: raise HandoffError("PREDECESSOR_REQUIRED")
                previous=self._predecessor(predecessor_id,predecessor_hash,s,now)
                self._source(previous.source_id,previous.source_hash,now)
                if (s.result.attempt_id,s.result.attempt_number,s.result.step_lineage_id)!=(previous.attempt_id,previous.attempt_number,previous.step_lineage_id):
                    raise HandoffError("PREDECESSOR_LINEAGE_MISMATCH")
                stage="REVIEWER_TO_TESTER"
            h=RoleHandoff(handoff_id,1,self._project,self._session,self._packet.parent_run_id,self._packet.step_id,s.result.attempt_id,
                s.result.attempt_number,s.result.step_lineage_id,stage,predecessor_id,predecessor_hash,source_id,source_hash,s.result.result_id,
                contract_hash(s.result),s.sender_id,s.sender_hash,a.assignment_id,a.content_hash,self._target,self._baseline,self._plan,self._wi,
                s.manifest.manifest_id,contract_hash(s.manifest),self._environment,self._toolchain,s.result.summary,
                tuple(ArtifactRef(m.artifact_id,m.content_hash,m.byte_size,m.media_type) for m in s.metadata),now,expires_at,execution_fence)
            # Replay ignores observation time only; all semantic request fields remain bound.
            request_hash=contract_hash(replace(h,issued_at=s.issued_at))
            old=self._requests.get((a.assignment_id,request_id))
            if old is not None:
                if old[0]!=request_hash: raise HandoffError("REPLAY_CONFLICT")
                return copy.deepcopy(self._checked_handoff(old[1],auth))
            if handoff_id in self._handoffs: raise HandoffError("HANDOFF_REBIND")
            self._projection(h)  # Bounded render must succeed before publication.
            # All adapter I/O is finished. These final checks perform no I/O,
            # E01 result registration, audit writes or budget consumption.
            self._source_fence(s,now)
            if predecessor_id is not None: self._predecessor(predecessor_id,predecessor_hash,s,now)
            self._assignment(recipient_id,**auth)
            self._handoffs[handoff_id]=h; self._handoff_seals[handoff_id]=h.content_hash
            self._requests[(a.assignment_id,request_id)]=(request_hash,handoff_id)
            return copy.deepcopy(h)

    def _checked_handoff(self,ident,auth):
        _id(ident); h=self._handoffs.get(ident)
        if h is None or contract_hash(h)!=self._handoff_seals.get(ident) or h.content_hash!=self._handoff_seals.get(ident):
            raise HandoffError("HANDOFF_UNKNOWN_OR_TAMPERED")
        a=self._assignment(h.recipient_assignment_id,**auth)
        if a.content_hash!=h.recipient_assignment_hash or not h.issued_at<=auth["now"]<h.expires_at: raise HandoffError("HANDOFF_EXPIRED_OR_STALE")
        s=self._source(h.source_id,h.source_hash,auth["now"])
        if contract_hash(s.manifest)!=h.manifest_hash: raise HandoffError("MANIFEST_BINDING_MISMATCH")
        if h.stage=="REVIEWER_TO_TESTER":
            previous=self._predecessor(h.predecessor_id,h.predecessor_hash,s,auth["now"])
            self._source(previous.source_id,previous.source_hash,auth["now"])
            self._predecessor(h.predecessor_id,h.predecessor_hash,s,auth["now"])
        if contract_hash(h)!=self._handoff_seals.get(ident) or h.content_hash!=self._handoff_seals.get(ident):
            raise HandoffError("HANDOFF_UNKNOWN_OR_TAMPERED")
        self._source_fence(s,auth["now"])
        self._assignment(h.recipient_assignment_id,**auth)
        return h

    @_guard
    def project(self,handoff_id,**auth):
        with self._lock:
            h=self._checked_handoff(handoff_id,auth)
            return self._projection(h)

    @_guard
    def create_projection(self,**request):
        # All fallible authority/artifact reads precede create's publish. Rendering
        # uses the already-validated snapshot and cannot fail on a second store read.
        with self._lock:
            return self._projection(self.create(**request))

    def _projection(self,h):
        source=self._sources[h.source_id]
        projection={"handoff_id":h.handoff_id,"schema_version":h.schema_version,"version":h.version,"hash":h.content_hash,
                "stage":h.stage,"status":"DELIVERED_NOT_VERIFIED","target_hash":h.target_hash,"manifest_id":h.manifest_id,"manifest_hash":h.manifest_hash,
                "environment_id":h.environment_id,"toolchain_versions":dict(h.toolchain_versions),"summary":h.summary,
                "artifact_refs":[_plain(r) for r in h.artifact_refs],"predecessor_id":h.predecessor_id,"predecessor_hash":h.predecessor_hash,
                "source_status":source.result.status.value,"unverified_scope":list(source.manifest.unverified_scope),
                "skipped_or_blocked":list(source.manifest.skipped_or_blocked),
                "acquisition_mode":source.manifest.acquisition_mode.value,"accepted":False,"state_transitions":[]}
        if len(json.dumps(projection,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode("utf-8"))>32768:
            raise HandoffError("PROJECTION_TOO_LARGE")
        return projection

    @_guard
    def resolve(self,handoff_id,artifact_id,**auth):
        with self._lock:
            _id(artifact_id); h=self._checked_handoff(handoff_id,auth)
            if artifact_id not in {a.artifact_id for a in h.artifact_refs}: raise HandoffError("ARTIFACT_NOT_MEMBER")
            s=self._sources[h.source_id]; metadata=next(m for m in s.metadata if m.artifact_id==artifact_id)
            published=next(r for r in h.artifact_refs if r.artifact_id==artifact_id)
            manifest_hash=h.manifest_hash; handoff_hash=h.content_hash
            raw=self._read(metadata)
            self._source_fence(s,auth["now"])
            if (contract_hash(h)!=handoff_hash or self._handoff_seals.get(h.handoff_id)!=handoff_hash
                or contract_hash(s.manifest)!=manifest_hash): raise HandoffError("HANDOFF_UNKNOWN_OR_TAMPERED")
            row=next(r for r in s.manifest.raw_artifact_checksums if r.path==metadata.storage_ref)
            if ((metadata.artifact_id,metadata.content_hash,metadata.byte_size,metadata.media_type)!=
                (published.artifact_id,published.checksum,published.byte_size,published.media_type)
                or (row.sha256,row.bytes)!=(_bytes_hash(raw),len(raw))
                or (published.checksum,published.byte_size)!=(_bytes_hash(raw),len(raw))): raise HandoffError("ARTIFACT_INTEGRITY")
            if h.predecessor_id is not None: self._predecessor(h.predecessor_id,h.predecessor_hash,s,auth["now"])
            self._assignment(h.recipient_assignment_id,**auth)
            return raw
