"""Role-specific result validation, separate from Main acceptance and execution.

Evidence capture is a trusted host adapter seam, not a public payload endpoint.
It records supplied observations without running their command. Tests using this
adapter prove binding/validation only, never actual independent runtime testing.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import datetime
from packages.execution.models import ResultStatus
from packages.orchestration.result_envelope import ResultEnvelope, EvidenceReference, ResultTest, ResultDomainReasonCode, validate_result
from .role_contracts import RolePolicyService, RoleAssignment, contract_hash, _text, _hash, _utc, _path, _within, _overlap, _ROLE_SPECS, _closed_value


def _result_shape(value):
    _closed_value(value,(RoleResult,RoleEnvelope,RoleEvidence,ReviewFinding,ResultEnvelope,EvidenceReference,
                         ResultTest,ResultStatus,ResultDomainReasonCode))


@dataclass(frozen=True,slots=True)
class RoleEvidence:
    evidence_id:str
    assignment_hash:str
    actor_id:str
    context_id:str
    target_hash:str
    kind:str
    source:str
    mode:str
    status:str
    raw_hash:str
    command:str
    exit_code:int|None
    expected:str
    observed:str
    captured_at:datetime
    content_hash:str=field(init=False)

    def __post_init__(self):
        for name in ("evidence_id","actor_id","context_id","kind","source","command","expected","observed"): _text(getattr(self,name))
        for v in (self.assignment_hash,self.target_hash,self.raw_hash): _hash(v)
        _utc(self.captured_at)
        if self.mode not in {"real","mock","fixture","static","build"} or self.status not in {"PASS","FAIL","SKIPPED","BLOCKED","NOT_EXECUTED"}:
            raise ValueError("EVIDENCE_INVALID")
        if self.exit_code is not None and type(self.exit_code) is not int: raise ValueError("EVIDENCE_INVALID")
        object.__setattr__(self,"content_hash",contract_hash(self))


@dataclass(frozen=True,slots=True)
class ReviewFinding:
    finding_id:str
    requirement_id:str
    severity:str
    path:str
    evidence_id:str
    observation:str

    def __post_init__(self):
        for v in (self.finding_id,self.requirement_id,self.evidence_id,self.observation): _text(v)
        _path(self.path)
        if self.severity not in {"CRITICAL","IMPORTANT","MINOR","INFO"}: raise ValueError("FINDING_INVALID")


@dataclass(frozen=True,slots=True)
class RoleResult:
    schema_version:str
    assignment_id:str
    assignment_hash:str
    role:str
    actor_id:str
    context_id:str
    target_hash:str
    envelope:ResultEnvelope
    decision:str
    requested_actions:tuple[str,...]
    next_step:str|None
    evidence:tuple[RoleEvidence,...]
    review_findings:tuple[ReviewFinding,...]=()
    content_hash:str=field(init=False)

    def __post_init__(self):
        if type(self.role) is str and self.role in _ROLE_SPECS: _result_shape(self)
        for v in (self.schema_version,self.assignment_id,self.role,self.actor_id,self.context_id): _text(v)
        _hash(self.assignment_hash); _hash(self.target_hash)
        if type(self.envelope) is not ResultEnvelope or self.decision not in {"proposed","needs_input","blocked","completed"}:
            raise ValueError("ROLE_RESULT_INVALID")
        if type(self.requested_actions) is not tuple or type(self.evidence) is not tuple or any(type(e) is not RoleEvidence for e in self.evidence):
            raise ValueError("ROLE_RESULT_INVALID")
        for v in self.requested_actions: _text(v)
        if type(self.review_findings) is not tuple or any(type(f) is not ReviewFinding for f in self.review_findings):
            raise ValueError("FINDING_INVALID")
        if len({f.finding_id for f in self.review_findings})!=len(self.review_findings): raise ValueError("FINDING_DUPLICATE")
        if self.next_step is not None: _text(self.next_step)
        object.__setattr__(self,"envelope",ResultEnvelope.from_dict(self.envelope.to_dict()))
        object.__setattr__(self,"evidence",copy.deepcopy(self.evidence))
        object.__setattr__(self,"review_findings",copy.deepcopy(self.review_findings))
        object.__setattr__(self,"content_hash",contract_hash(self))


@dataclass(frozen=True,slots=True)
class RoleResultReceipt:
    valid:bool
    reason:str
    result_hash:str|None
    assignment_hash:str|None
    accepted:bool=False
    state_transitions:tuple[str,...]=()
    io_count:int=0
    content_hash:str=field(init=False)

    def __post_init__(self): object.__setattr__(self,"content_hash",contract_hash(self))


@dataclass(frozen=True,slots=True)
class RoleEnvelope:
    """C22 trace wrapper. The C05 ResultEnvelope is reused, not redefined.

    Integer cost units/latency are observations, not billing or budget approval.
    Parent identity is the DelegationPacket parent run/task and Main actor.
    """
    result:RoleResult
    task_id:str
    parent_task_id:str
    parent_actor_id:str
    baseline_hash:str
    artifact_refs:tuple[EvidenceReference,...]
    unverified_scope:tuple[str,...]
    rollback:str
    cost_units:int
    latency_ms:int
    provenance:tuple[str,...]
    schema_version:str="role_envelope/v1"
    content_hash:str=field(init=False)

    def __post_init__(self):
        _result_shape(self)
        if type(self.result) is not RoleResult or self.schema_version!="role_envelope/v1": raise ValueError("ROLE_ENVELOPE_INVALID")
        for x in (self.task_id,self.parent_task_id,self.parent_actor_id,self.rollback): _text(x)
        _hash(self.baseline_hash)
        if any(type(v) is not int or v<0 for v in (self.cost_units,self.latency_ms)): raise ValueError("ROLE_ENVELOPE_INVALID")
        for values in (self.unverified_scope,self.provenance):
            if type(values) is not tuple or len(values)>64: raise ValueError("ROLE_ENVELOPE_INVALID")
            for value in values: _text(value)
        if not self.provenance or type(self.artifact_refs) is not tuple or not 1<=len(self.artifact_refs)<=64: raise ValueError("ROLE_ENVELOPE_INVALID")
        if any(type(v) is not EvidenceReference for v in self.artifact_refs): raise ValueError("ROLE_ENVELOPE_INVALID")
        artifacts=tuple(EvidenceReference(v.evidence_id,v.checksum) for v in self.artifact_refs)
        if len({v.evidence_id for v in artifacts})!=len(artifacts): raise ValueError("ROLE_ENVELOPE_INVALID")
        object.__setattr__(self,"artifact_refs",artifacts)
        # RoleResult reparses/detaches the canonical C05 envelope and evidence.
        from dataclasses import replace
        object.__setattr__(self,"result",replace(self.result))
        object.__setattr__(self,"content_hash",contract_hash(self))


class RoleResultService:
    def __init__(self,policy):
        if type(policy) is not RolePolicyService: raise ValueError("HOST_AUTHORITY_REQUIRED")
        self._policy=policy; self._captures={}; self._seals={}; self._results={}; self._audits=[]

    @property
    def audits(self): return tuple(copy.deepcopy(self._audits))

    def capture_evidence(self,*,assignment,evidence_id,kind,source,mode,status,raw_hash,command,exit_code,expected,observed,now):
        """HOST ONLY: caller supplies already-observed raw evidence checksum; executes nothing."""
        if type(assignment) is not RoleAssignment: raise ValueError("ASSIGNMENT_REQUIRED")
        reason=self._policy.validate_assignment(assignment,actor_id=assignment.actor_id,session_id=assignment.session_id,
            context_id=assignment.context_id,target_hash=assignment.target_hash,execution_fence=assignment.execution_fence,now=now)
        if reason: raise ValueError(reason)
        capture=RoleEvidence(evidence_id,assignment.content_hash,assignment.actor_id,assignment.context_id,assignment.target_hash,
            kind,source,mode,status,raw_hash,command,exit_code,expected,observed,now)
        if evidence_id in self._seals:
            if self._seals[evidence_id]!=capture.content_hash: raise ValueError("EVIDENCE_REBIND")
            return self.get_evidence(evidence_id)
        self._captures[evidence_id]=capture; self._seals[evidence_id]=capture.content_hash
        return copy.deepcopy(capture)

    def get_evidence(self,evidence_id): return copy.deepcopy(self._captures[evidence_id])

    def validate_role_envelope(self,envelope,**authority):
        """Proposal validation only; no acceptance, handoff, execution or deploy."""
        def deny(reason):
            receipt=RoleResultReceipt(False,reason,None,None)
            self._audits.append(receipt)
            return copy.deepcopy(receipt)
        if type(envelope) is not RoleEnvelope: return deny("ROLE_ENVELOPE_REQUIRED")
        try:
            _result_shape(envelope)
            if envelope.content_hash!=contract_hash(envelope): return deny("ROLE_ENVELOPE_TAMPERED")
            assignment=authority.get("assignment")
            if type(assignment) is not RoleAssignment: return deny("ASSIGNMENT_REQUIRED")
            if ((envelope.task_id,envelope.parent_task_id,envelope.parent_actor_id,envelope.baseline_hash)!=
                (assignment.packet.step_id,assignment.packet.parent_run_id,assignment.packet.parent_agent_id,assignment.baseline_hash)):
                return deny("ROLE_TRACE_MISMATCH")
            # Envelope metadata participates in replay identity, not only the inner result.
            key=(assignment.assignment_id,envelope.result.envelope.result_id,"role_envelope")
            prior=self._results.get(key)
            if prior is not None and prior!=envelope.content_hash: return deny("RESULT_REPLAY_CONFLICT")
            receipt=self._validate(envelope.result,**authority,_role_envelope_checked=True)
            bound=RoleResultReceipt(receipt.valid,receipt.reason,envelope.content_hash,receipt.assignment_hash)
            if receipt.valid: self._results[key]=envelope.content_hash
            self._audits.append(bound)
            return copy.deepcopy(bound)
        except (TypeError,ValueError,AttributeError,KeyError,RecursionError):
            return deny("ROLE_ENVELOPE_INVALID")

    def validate(self,result,*,assignment,actor_id,session_id,context_id,target_hash,execution_fence,now):
        try:
            return self._validate(result,assignment=assignment,actor_id=actor_id,session_id=session_id,
                context_id=context_id,target_hash=target_hash,execution_fence=execution_fence,now=now)
        except (TypeError,ValueError,AttributeError,KeyError,RecursionError):
            receipt=RoleResultReceipt(False,"ROLE_RESULT_INVALID",None,None)
            self._audits.append(receipt)
            return receipt

    def _validate(self,result,*,assignment,actor_id,session_id,context_id,target_hash,execution_fence,now,_role_envelope_checked=False):
        def finish(reason):
            receipt=RoleResultReceipt(reason=="VALIDATED_PROPOSAL",reason,getattr(result,"content_hash",None),getattr(assignment,"content_hash",None))
            self._audits.append(receipt)
            return copy.deepcopy(receipt)
        reason=self._policy.validate_assignment(assignment,actor_id=actor_id,session_id=session_id,context_id=context_id,
            target_hash=target_hash,execution_fence=execution_fence,now=now)
        if reason: return finish(reason)
        if type(result) is not RoleResult: return finish("ROLE_RESULT_REQUIRED")
        a=self._policy.get_assignment(assignment.assignment_id); definition=a.definition
        if definition.schema_version=="agent_definition/v2" and not _role_envelope_checked: return finish("ROLE_ENVELOPE_REQUIRED")
        if result.schema_version!=definition.result_schema or result.role!=definition.role: return finish("ROLE_SCHEMA_MISMATCH")
        if definition.role not in {"REVIEWER","REVIEW"} and result.review_findings: return finish("ROLE_SCHEMA_MISMATCH")
        if ((result.assignment_id,result.assignment_hash,result.actor_id,result.context_id,result.target_hash)!=
            (a.assignment_id,a.content_hash,a.actor_id,a.context_id,a.target_hash)
            or result.envelope.target_hash!=a.target_hash or result.envelope.delegation_id!=a.packet.delegation_id):
            return finish("RESULT_BINDING_MISMATCH")
        if result.requested_actions: return finish("RESERVED_AUTHORITY")
        if definition.role in {"REVIEWER","REVIEW","PLANNING","DEPLOY"} and result.envelope.changed_paths: return finish("ROLE_ACTION_DENIED")
        if result.envelope.changed_paths and definition.role=="CODE":
            reason=self._policy.validate_code_write(a,now,paths=result.envelope.changed_paths,check_fence=False)
            if reason: return finish(reason)
        elif result.envelope.changed_paths:
            grant=a.test_write_grant
            if grant is None: return finish("TEST_WRITE_GRANT_REQUIRED")
            reason=self._policy.validate_test_write_lease(a,now)
            if reason: return finish(reason)
            effective=a.packet.permission_snapshot
            # Validate capability without dispatching an action or consuming its budget.
            if not any(action in effective.allowed_actions and tool in effective.allowed_tools
                       for action,tool in (("write","test_write"),("patch","test_patch"))):
                return finish("ROLE_ACTION_DENIED")
            for path in result.envelope.changed_paths:
                try: _path(path)
                except ValueError: return finish("PATH_NOT_CANONICAL")
                if _overlap((path,),effective.prohibited_paths+effective.protected_paths+definition.prohibited_scope):
                    return finish("PROTECTED_SCOPE")
                if not _within((path,),effective.allowed_paths): return finish("PATH_SCOPE_DENIED")
                if not _within((path,),definition.write_scope) or not _within((path,),grant.paths): return finish("TEST_WRITE_SCOPE_DENIED")
        if not result.evidence or not set(definition.required_evidence)<={e.kind for e in result.evidence}: return finish("REQUIRED_EVIDENCE_MISSING")
        if len({e.evidence_id for e in result.evidence})!=len(result.evidence): return finish("EVIDENCE_DUPLICATE")
        refs={e.evidence_id:e.checksum for e in result.envelope.evidence_refs}
        for finding in result.review_findings:
            if finding.evidence_id not in refs: return finish("FINDING_EVIDENCE_MISMATCH")
            if not _within((finding.path,),definition.read_scope): return finish("FINDING_SCOPE_MISMATCH")
        if set(refs)!={e.evidence_id for e in result.evidence}: return finish("EVIDENCE_REFERENCE_MISMATCH")
        completed=result.decision=="completed" or result.envelope.status is ResultStatus.COMPLETED
        if definition.role=="REVIEW" and completed and any(f.severity in {"CRITICAL","IMPORTANT"} for f in result.review_findings):
            return finish("REVIEW_REWORK_REQUIRED")
        for e in result.evidence:
            stored=self._captures.get(e.evidence_id)
            if stored is None: return finish("EVIDENCE_UNKNOWN")
            if contract_hash(e)!=self._seals[e.evidence_id] or e.content_hash!=self._seals[e.evidence_id] or contract_hash(stored)!=self._seals[e.evidence_id]:
                return finish("EVIDENCE_TAMPERED")
            if (e.assignment_hash,e.actor_id,e.context_id,e.target_hash)!=(a.content_hash,a.actor_id,a.context_id,a.target_hash) or refs[e.evidence_id]!=e.raw_hash:
                return finish("EVIDENCE_BINDING_MISMATCH")
            if not a.issued_at<=e.captured_at<=now<a.expires_at: return finish("EVIDENCE_TIME_INVALID")
            if completed:
                required_source=(_ROLE_SPECS[definition.role][2] if definition.schema_version=="agent_definition/v2"
                    else ("independent_review" if definition.role=="REVIEWER" else "independent_execution"))
                if e.source!=required_source: return finish("INDEPENDENT_EVIDENCE_REQUIRED")
                if e.mode!="real": return finish("EVIDENCE_NOT_REAL")
                if e.status!="PASS" or e.exit_code!=0: return finish("EVIDENCE_NOT_PASS")
        if result.content_hash!=contract_hash(result): return finish("RESULT_TAMPERED")
        # Reparse to validate forced mutation of the otherwise frozen C-05 envelope.
        checked=validate_result(result.envelope.to_dict())
        if not checked.valid: return finish("ENVELOPE_INVALID")
        if completed:
            if result.decision!="completed" or result.envelope.status is not ResultStatus.COMPLETED: return finish("RESULT_STATUS_MISMATCH")
            for test in result.envelope.tests:
                if test.status!="PASS" or test.exit_code!=0 or not any(e.command==test.command and e.exit_code==test.exit_code for e in result.evidence):
                    return finish("TEST_EVIDENCE_MISMATCH")
        key=(a.assignment_id,result.envelope.result_id)
        existing=self._results.get(key)
        if existing is not None and existing!=result.content_hash: return finish("RESULT_REPLAY_CONFLICT")
        self._results[key]=result.content_hash
        return finish("VALIDATED_PROPOSAL")
