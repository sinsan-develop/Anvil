"""E-01 deterministic role authority; no worker, filesystem, shell or Provider I/O.

RolePolicyService is an in-memory HOST control-plane adapter, not an authentication
mechanism. Its constructor/register/revoke methods must never be exposed to LLM
payloads. Runtime sandbox enforcement and transport belong to their owner packages.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass, fields, is_dataclass, field
from datetime import datetime
from typing import Any

from packages.orchestration.delegation import (
    PermissionSnapshot, DataEgressProfile, DelegationPacket, validate_packet,
)


def _plain(value):
    if is_dataclass(value):
        return {f.name:_plain(getattr(value,f.name)) for f in fields(value) if f.name!="content_hash"}
    if isinstance(value,datetime): return value.isoformat()
    if isinstance(value,(tuple,list)): return [_plain(v) for v in value]
    if isinstance(value,Mapping): return {k:_plain(v) for k,v in value.items()}
    return value


def contract_hash(value):
    return "sha256:"+hashlib.sha256(json.dumps(_plain(value),sort_keys=True,separators=(",",":"),
        ensure_ascii=False,allow_nan=False).encode("utf-8")).hexdigest()


def _text(value):
    if type(value) is not str or not value or value!=value.strip() or any(ord(c)<32 for c in value):
        raise ValueError("INVALID_TEXT")
    value.encode("utf-8")


def _hash(value):
    if type(value) is not str or not re.fullmatch(r"sha256:[0-9a-f]{64}",value): raise ValueError("INVALID_HASH")


def _utc(value):
    if type(value) is not datetime or value.tzinfo is None or value.utcoffset().total_seconds()!=0:
        raise ValueError("UTC_REQUIRED")


def _path(value,scope=False):
    _text(value)
    raw=value[:-3] if scope and value.endswith("/**") else value
    if (not raw or raw.startswith("/") or any(c in raw for c in "\\:%*?[]~")
        or any(p in {"",".",".."} or p.endswith(("."," ")) or p.casefold().split(".")[0] in
            {"con","prn","aux","nul",*("com"+str(i) for i in range(1,10)),*("lpt"+str(i) for i in range(1,10))}
            for p in raw.split("/"))): raise ValueError("PATH_NOT_CANONICAL")


def _paths(values):
    if type(values) is not tuple or len(set(values))!=len(values): raise ValueError("SCOPE_INVALID")
    for v in values: _path(v,True)


def _covers(scope,path):
    # Windows identity is case-insensitive; keep original contract bytes for hashing.
    scope,path=scope.casefold(),path.casefold()
    return scope==path or (scope.endswith("/**") and path.startswith(scope[:-3]+"/"))


def _within(paths,scope):
    return all(any(_covers(s,p) for s in scope) for p in paths)


def _overlap(left,right):
    return any(_covers(a,b) or _covers(b,a) for a in left for b in right)


TOOLS={"repo_read":"read","repo_diff":"read","requirements_read":"read","quality_read":"read",
       "test_read":"read","test_run":"execute","test_write":"write","test_patch":"patch"}


@dataclass(frozen=True,slots=True)
class BudgetLimits:
    """Cost is integer accounting units; never float currency or actual provider settlement."""
    calls:int
    tokens:int
    cost:int
    duration:int

    def __post_init__(self):
        if any(type(v) is not int or v<0 for v in (self.calls,self.tokens,self.cost,self.duration)):
            raise ValueError("BUDGET_INVALID")

    def fits(self,ceiling):
        return type(ceiling) is BudgetLimits and all(getattr(self,f.name)<=getattr(ceiling,f.name) for f in fields(self))


@dataclass(frozen=True,slots=True)
class AgentDefinition:
    definition_id:str
    version:int
    role:str
    read_scope:tuple[str,...]
    write_scope:tuple[str,...]
    prohibited_scope:tuple[str,...]
    permission_ceiling:PermissionSnapshot
    budget:BudgetLimits
    result_schema:str
    required_evidence:tuple[str,...]
    persistent_memory:str="none"
    schema_version:str="agent_definition/v1"
    content_hash:str=field(init=False)

    def __post_init__(self):
        _text(self.definition_id)
        if type(self.version) is not int or self.version<1 or self.role not in {"REVIEWER","TESTER"}:
            raise ValueError("DEFINITION_INVALID")
        if self.schema_version!="agent_definition/v1" or self.persistent_memory!="none": raise ValueError("DEFINITION_INVALID")
        if self.result_schema!={"REVIEWER":"reviewer_result/v1","TESTER":"tester_result/v1"}[self.role]:
            raise ValueError("ROLE_SCHEMA_MISMATCH")
        for v in (self.read_scope,self.write_scope,self.prohibited_scope): _paths(v)
        if not self.read_scope or type(self.permission_ceiling) is not PermissionSnapshot or type(self.budget) is not BudgetLimits:
            raise ValueError("DEFINITION_INVALID")
        if not _within(self.read_scope+self.write_scope,self.permission_ceiling.allowed_paths): raise ValueError("SCOPE_EXPANSION")
        if _overlap(self.read_scope+self.write_scope,self.prohibited_scope+self.permission_ceiling.protected_paths+self.permission_ceiling.prohibited_paths):
            raise ValueError("PROTECTED_SCOPE")
        if not _within(self.write_scope,("tests/**",)): raise ValueError("TEST_WRITE_SCOPE_DENIED")
        allowed={"read"} if self.role=="REVIEWER" else {"read","execute","write","patch"}
        if (not set(self.permission_ceiling.allowed_actions)<=allowed
            or any(t not in TOOLS or TOOLS[t] not in allowed for t in self.permission_ceiling.allowed_tools)
            or (self.role=="REVIEWER" and self.write_scope)): raise ValueError("ROLE_ACTION_DENIED")
        expected="diff_review" if self.role=="REVIEWER" else "independent_execution"
        if type(self.required_evidence) is not tuple or expected not in self.required_evidence or len(set(self.required_evidence))!=len(self.required_evidence):
            raise ValueError("REQUIRED_EVIDENCE_INVALID")
        for v in self.required_evidence: _text(v)
        object.__setattr__(self,"content_hash",contract_hash(self))


@dataclass(frozen=True,slots=True)
class TestWriteGrant:
    grant_id:str
    assignment_id:str
    actor_id:str
    paths:tuple[str,...]
    lease_id:str
    write_fence:str
    issued_at:datetime
    expires_at:datetime

    def __post_init__(self):
        for v in (self.grant_id,self.assignment_id,self.actor_id,self.lease_id,self.write_fence): _text(v)
        _paths(self.paths); _utc(self.issued_at); _utc(self.expires_at)
        if not self.paths or not _within(self.paths,("tests/**",)) or self.issued_at>=self.expires_at: raise ValueError("TEST_WRITE_GRANT_INVALID")


@dataclass(frozen=True,slots=True)
class TestWriteLease:
    lease_id:str
    assignment_id:str
    actor_id:str
    workspace_id:str
    paths:tuple[str,...]
    execution_fence:str
    write_fence:str
    issued_at:datetime
    expires_at:datetime

    def __post_init__(self):
        for name in ("lease_id","assignment_id","actor_id","workspace_id","execution_fence","write_fence"): _text(getattr(self,name))
        _paths(self.paths); _utc(self.issued_at); _utc(self.expires_at)
        if not self.paths or not _within(self.paths,("tests/**",)) or self.issued_at>=self.expires_at: raise ValueError("WRITE_LEASE_INVALID")


@dataclass(frozen=True,slots=True)
class RoleAssignment:
    assignment_id:str
    definition:AgentDefinition
    packet:DelegationPacket
    actor_id:str
    context_id:str
    thread_id:str
    workspace_id:str
    session_id:str
    target_hash:str
    baseline_hash:str
    implementation_actor:str
    implementation_context:str
    implementation_workspace:str
    issued_at:datetime
    expires_at:datetime
    execution_fence:str
    test_write_grant:TestWriteGrant|None
    content_hash:str=field(init=False)

    def __post_init__(self):
        for name in ("assignment_id","actor_id","context_id","thread_id","workspace_id","session_id",
                     "implementation_actor","implementation_context","implementation_workspace","execution_fence"):
            _text(getattr(self,name))
        _hash(self.target_hash); _hash(self.baseline_hash); _utc(self.issued_at); _utc(self.expires_at)
        if self.issued_at>=self.expires_at: raise ValueError("ASSIGNMENT_EXPIRED")
        if (self.actor_id==self.implementation_actor or self.context_id==self.implementation_context
            or self.workspace_id==self.implementation_workspace): raise ValueError("INDEPENDENCE_REQUIRED")
        if type(self.definition) is not AgentDefinition or type(self.packet) is not DelegationPacket: raise ValueError("ASSIGNMENT_INVALID")
        object.__setattr__(self,"content_hash",contract_hash(self))


@dataclass(frozen=True,slots=True)
class RoleDecision:
    allowed:bool
    reason:str
    assignment_hash:str|None
    request_hash:str
    io_count:int=0
    content_hash:str=field(init=False)

    def __post_init__(self): object.__setattr__(self,"content_hash",contract_hash(self))


class RolePolicyService:
    """Host-only registration + untrusted consumption. Never an API authority mint."""
    def __init__(self,*,session_id,baseline_hash,target_hash,implementation_actor,implementation_context,
                 implementation_workspace,implementation_context_hash,parent_permission,parent_egress,parent_budget):
        for v in (session_id,implementation_actor,implementation_context,implementation_workspace): _text(v)
        _hash(baseline_hash); _hash(target_hash)
        _hash(implementation_context_hash)
        if type(parent_permission) is not PermissionSnapshot or type(parent_egress) is not DataEgressProfile or type(parent_budget) is not BudgetLimits:
            raise ValueError("HOST_AUTHORITY_REQUIRED")
        self._session=session_id; self._baseline=baseline_hash; self._target=target_hash
        self._implementation=(implementation_actor,implementation_context,implementation_workspace)
        self._implementation_context_hash=implementation_context_hash
        self._parent=copy.deepcopy(parent_permission); self._egress=copy.deepcopy(parent_egress); self._budget=copy.deepcopy(parent_budget)
        self._records={}; self._seals={}; self._definitions={}; self._revoked=set(); self._spent={}; self._requests={}; self._audits=[]
        self._write_leases={}; self._write_seals={}; self._write_revoked=set()

    @property
    def implementation_context_hash(self): return self._implementation_context_hash

    def register_test_write_lease(self,lease):
        """HOST ONLY: current lease observation, separate from a requested grant."""
        if type(lease) is not TestWriteLease: raise ValueError("WRITE_LEASE_INVALID")
        digest=contract_hash(lease)
        if lease.lease_id in self._write_leases:
            if self._write_seals[lease.lease_id]!=digest or lease.lease_id in self._write_revoked: raise ValueError("WRITE_LEASE_REBIND")
            return
        if any(k not in self._write_revoked and v.workspace_id==lease.workspace_id and _overlap(v.paths,lease.paths)
               and v.issued_at<lease.expires_at and lease.issued_at<v.expires_at for k,v in self._write_leases.items()):
            raise ValueError("WRITE_LEASE_CONFLICT")
        self._write_leases[lease.lease_id]=copy.deepcopy(lease); self._write_seals[lease.lease_id]=digest

    def revoke_test_write_lease(self,lease_id):
        if lease_id not in self._write_leases: raise ValueError("WRITE_LEASE_INVALID")
        self._write_revoked.add(lease_id)

    def validate_test_write_lease(self,assignment,now):
        grant=assignment.test_write_grant
        if grant is None: return "TEST_WRITE_GRANT_REQUIRED"
        lease=self._write_leases.get(grant.lease_id)
        if (lease is None or grant.lease_id in self._write_revoked or contract_hash(lease)!=self._write_seals[grant.lease_id]
            or (lease.assignment_id,lease.actor_id,lease.workspace_id,lease.execution_fence,lease.write_fence)!=
               (assignment.assignment_id,assignment.actor_id,assignment.workspace_id,assignment.execution_fence,grant.write_fence)
            or not _within(grant.paths,lease.paths) or not lease.issued_at<=now<lease.expires_at): return "WRITE_LEASE_INVALID"
        if not grant.issued_at<=now<grant.expires_at: return "TEST_WRITE_GRANT_EXPIRED"
        return None

    @property
    def audits(self): return tuple(copy.deepcopy(self._audits))

    def register(self,*,assignment_id,definition,packet,actor_id,context_id,thread_id,workspace_id,session_id,
                 context_snapshot_hash,issued_at,expires_at,execution_fence,test_write_grant=None):
        if session_id!=self._session: raise ValueError("ASSIGNMENT_IDENTITY_MISMATCH")
        if any(a==b for a,b in zip((actor_id,context_id,workspace_id),self._implementation)):
            raise ValueError("INDEPENDENCE_REQUIRED")
        _hash(context_snapshot_hash)
        if context_snapshot_hash==self._implementation_context_hash: raise ValueError("INDEPENDENCE_REQUIRED")
        if type(definition) is not AgentDefinition or definition.content_hash!=contract_hash(definition): raise ValueError("DEFINITION_TAMPERED")
        if type(packet) is not DelegationPacket: raise ValueError("PACKET_REQUIRED")
        receipt=validate_packet(packet,baseline_hash=self._baseline,context_snapshot_hash=context_snapshot_hash,
            parent_permission_snapshot=self._parent,parent_egress_profile=self._egress)
        if not receipt.valid: raise ValueError(receipt.reason_codes[0])
        ceiling=definition.permission_ceiling; effective=packet.permission_snapshot
        if (not _within(effective.allowed_paths,ceiling.allowed_paths) or not set(effective.allowed_actions)<=set(ceiling.allowed_actions)
            or not set(effective.allowed_tools)<=set(ceiling.allowed_tools) or not set(effective.allowed_backends)<=set(ceiling.allowed_backends)
            or not _within(ceiling.prohibited_paths,effective.prohibited_paths) or not _within(ceiling.protected_paths,effective.protected_paths)
            or not set(ceiling.prohibited_actions)<=set(effective.prohibited_actions)): raise ValueError("ROLE_CEILING_EXPANSION")
        if packet.expected_result_schema!=definition.result_schema or packet.workspace_id!=workspace_id: raise ValueError("ROLE_PACKET_MISMATCH")
        if not definition.budget.fits(self._budget): raise ValueError("BUDGET_EXPANSION")
        if test_write_grant is not None:
            if (type(test_write_grant) is not TestWriteGrant or definition.role!="TESTER"
                or test_write_grant.assignment_id!=assignment_id or test_write_grant.actor_id!=actor_id
                or not _within(test_write_grant.paths,definition.write_scope)
                or test_write_grant.issued_at<issued_at or test_write_grant.expires_at>expires_at): raise ValueError("TEST_WRITE_GRANT_INVALID")
        current=self._definitions.get(definition.definition_id)
        if current and (definition.version<current[0] or (definition.version==current[0] and definition.content_hash!=current[1])):
            raise ValueError("STALE_DEFINITION")
        assignment=RoleAssignment(assignment_id,copy.deepcopy(definition),copy.deepcopy(packet),actor_id,context_id,thread_id,
            workspace_id,session_id,self._target,self._baseline,*self._implementation,issued_at,expires_at,execution_fence,copy.deepcopy(test_write_grant))
        if test_write_grant is not None:
            reason=self.validate_test_write_lease(assignment,issued_at)
            if reason: raise ValueError(reason)
        if assignment_id in self._records:
            if assignment.content_hash!=self._seals[assignment_id] or assignment_id in self._revoked: raise ValueError("ASSIGNMENT_REBIND")
            return self.get_assignment(assignment_id)
        self._records[assignment_id]=assignment; self._seals[assignment_id]=assignment.content_hash
        self._definitions[definition.definition_id]=(definition.version,definition.content_hash)
        self._spent[assignment_id]=BudgetLimits(0,0,0,0)
        return copy.deepcopy(assignment)

    def get_assignment(self,assignment_id): return copy.deepcopy(self._records[assignment_id])

    def revoke(self,assignment_id):
        if assignment_id not in self._records: raise ValueError("ASSIGNMENT_UNKNOWN")
        self._revoked.add(assignment_id)

    def set_current_target(self,target_hash):
        _hash(target_hash); self._target=target_hash

    def validate_assignment(self,assignment,*,actor_id,session_id,context_id,target_hash,execution_fence,now):
        if type(assignment) is not RoleAssignment: return "ASSIGNMENT_REQUIRED"
        try: _text(assignment.assignment_id)
        except (TypeError,ValueError): return "ASSIGNMENT_INVALID"
        canonical=self._records.get(assignment.assignment_id)
        if canonical is None: return "ASSIGNMENT_UNKNOWN"
        try:
            if (contract_hash(assignment)!=self._seals[assignment.assignment_id] or assignment.content_hash!=self._seals[assignment.assignment_id]
                or contract_hash(canonical)!=self._seals[assignment.assignment_id]): return "ASSIGNMENT_TAMPERED"
        except (TypeError,ValueError): return "ASSIGNMENT_TAMPERED"
        if assignment.assignment_id in self._revoked: return "ASSIGNMENT_REVOKED"
        if (actor_id,session_id,context_id)!=(canonical.actor_id,canonical.session_id,canonical.context_id): return "ASSIGNMENT_IDENTITY_MISMATCH"
        if target_hash!=self._target or canonical.target_hash!=self._target: return "TARGET_MISMATCH"
        if execution_fence!=canonical.execution_fence: return "STALE_EXECUTION_FENCE"
        if self._definitions.get(canonical.definition.definition_id)!=(canonical.definition.version,canonical.definition.content_hash): return "STALE_DEFINITION"
        try: _utc(now)
        except ValueError: return "ASSIGNMENT_EXPIRED"
        if not canonical.issued_at<=now<canonical.expires_at: return "ASSIGNMENT_EXPIRED"
        return None

    def authorize_action(self,*,assignment,actor_id,session_id,context_id,target_hash,execution_fence,now,
                         action,tool,backend,path,write_fence=None,request_id=None,usage=None):
        # Identity is checked before idempotency, so expired/revoked requests cannot replay an old ALLOW.
        reason=self.validate_assignment(assignment,actor_id=actor_id,session_id=session_id,context_id=context_id,
            target_hash=target_hash,execution_fence=execution_fence,now=now)
        invalid=None
        try:
            amount=usage if usage is not None else BudgetLimits(1,0,0,0)
            if type(amount) is not BudgetLimits: raise ValueError("BUDGET_INVALID")
            amount=BudgetLimits(*(getattr(amount,f.name) for f in fields(amount)))
            if amount.calls<1: raise ValueError("BUDGET_INVALID")
        except (TypeError,ValueError): invalid="BUDGET_INVALID"
        if any(type(v) is not str for v in (action,tool,backend,path)) or (write_fence is not None and type(write_fence) is not str):
            invalid="ACTION_INVALID"
        try:
            if request_id is not None: _text(request_id)
        except ValueError: invalid="ACTION_INVALID"
        request_hash=contract_hash((action,tool,backend,path,write_fence,_plain(amount))) if invalid is None else contract_hash(("invalid",invalid))
        def finish(why):
            receipt=RoleDecision(why=="ALLOWED",why,getattr(assignment,"content_hash",None),request_hash)
            self._audits.append(receipt)
            return copy.deepcopy(receipt)
        if reason: return finish(reason)
        if invalid: return finish(invalid)
        a=self._records[assignment.assignment_id]; d=a.definition; p=a.packet.permission_snapshot
        if action not in p.allowed_actions or tool not in p.allowed_tools or TOOLS.get(tool)!=action or (d.role=="REVIEWER" and action!="read"):
            return finish("ROLE_ACTION_DENIED")
        if backend not in p.allowed_backends: return finish("BACKEND_DENIED")
        try: _path(path)
        except (TypeError,ValueError): return finish("PATH_NOT_CANONICAL")
        if _overlap((path,),p.prohibited_paths+p.protected_paths+d.prohibited_scope): return finish("PROTECTED_SCOPE")
        if action in {"write","patch"}:
            grant=a.test_write_grant
            if grant is None: return finish("TEST_WRITE_GRANT_REQUIRED")
            reason=self.validate_test_write_lease(a,now)
            if reason: return finish(reason)
            if not _within((path,),d.write_scope) or not _within((path,),grant.paths): return finish("TEST_WRITE_SCOPE_DENIED")
            if write_fence!=grant.write_fence: return finish("STALE_WRITE_FENCE")
            if not grant.issued_at<=now<grant.expires_at: return finish("TEST_WRITE_GRANT_EXPIRED")
        elif action=="execute" and not _within((path,),("tests/**",)): return finish("TEST_EXECUTION_SCOPE_DENIED")
        if not _within((path,),p.allowed_paths) or (action in {"read","execute"} and not _within((path,),d.read_scope)):
            return finish("PATH_SCOPE_DENIED")
        if request_id is not None:
            _text(request_id)
            old=self._requests.get((a.assignment_id,request_id))
            if old:
                return copy.deepcopy(old[1]) if old[0]==request_hash else finish("REQUEST_REPLAY_CONFLICT")
        spent=self._spent[a.assignment_id]
        total=BudgetLimits(*(getattr(spent,f.name)+getattr(amount,f.name) for f in fields(spent)))
        if not total.fits(d.budget): return finish("BUDGET_EXHAUSTED")
        receipt=finish("ALLOWED"); self._spent[a.assignment_id]=total
        if request_id is not None: self._requests[(a.assignment_id,request_id)]=(request_hash,receipt)
        return copy.deepcopy(receipt)
