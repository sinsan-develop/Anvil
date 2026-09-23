"""C30R3 host-only typed serialization/hydration, never request authentication.

Only restore() consumes current repository authority. Bundle construction/export
are serialization operations, not permission grants. No engines, migrations,
HTTP, workers or external programs are started here.
"""
from __future__ import annotations

from dataclasses import dataclass, field, fields
from datetime import datetime, timezone
from hashlib import sha256
import json
import re
from types import UnionType
from threading import RLock
from typing import get_args, get_origin, get_type_hints, Union

from packages.persistence import agent_team_owner_repository as repository
from packages.orchestration.delegation import PermissionSnapshot, DataEgressProfile, DelegationPacket, validate_packet
from . import role_contracts as roles, role_results as results, models
from .orchestration import RoleTeamOrchestrator, TeamTaskBinding
from .moa import MoADeliberation
from .collaboration import canonical_hash, DependencyGraph

OwnerBinding = repository.OwnerBinding
OwnerSnapshot = repository.OwnerSnapshot
PrincipalMapping = repository.PrincipalMapping
KINDS = ("ROLE_POLICY", "ROLE_RESULTS", "TEAM", "MOA")


class OwnerContractError(ValueError):
    """Value-safe adapter error; never wraps raw SQL or payload messages."""
    def __init__(self, code="COMPONENT_SHAPE"):
        self.code = code
        super().__init__(code)


def _deny(code="COMPONENT_SHAPE"):
    raise OwnerContractError(code)


def _builtin(value, depth=0):
    if depth > 24: _deny("INPUT_BOUND_EXCEEDED")
    t = type(value)
    if value is None or t is bool: return
    if t is int:
        if abs(value) > 2**63-1: _deny("INPUT_BOUND_EXCEEDED")
        return
    if t is str:
        if len(value.encode("utf-8")) > 262144: _deny("INPUT_BOUND_EXCEEDED")
        return
    if t is list or t is dict:
        if len(value) > 1024: _deny("INPUT_BOUND_EXCEEDED")
        if t is dict:
            for key in value:
                if type(key) is not str: _deny("BUILTIN_REQUIRED")
                _builtin(key, depth+1)
        for item in (value.values() if t is dict else value): _builtin(item, depth+1)
        return
    _deny("BUILTIN_REQUIRED")


def _dump(value):
    _builtin(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def _hash(value):
    return "sha256:" + sha256(_dump(value).encode("utf-8")).hexdigest()


def _hash_text(value):
    if type(value) is not str or re.fullmatch(r"sha256:[0-9a-f]{64}", value) is None:
        _deny("COMPONENT_HASH_MISMATCH")
    return value


def _time(value):
    if type(value) is not datetime or value.tzinfo is not timezone.utc: _deny("BUILTIN_REQUIRED")
    return datetime(value.year,value.month,value.day,value.hour,value.minute,value.second,value.microsecond,tzinfo=timezone.utc)


def _parse(raw):
    if type(raw) is not str or len(raw.encode("utf-8")) > 262144: _deny("INPUT_BOUND_EXCEEDED")
    def pairs(items):
        data={}
        for key,value in items:
            if key in data: _deny()
            data[key]=value
        return data
    def invalid(_): _deny("BUILTIN_REQUIRED")
    value=json.loads(raw,object_pairs_hook=pairs,parse_constant=invalid)
    _builtin(value)
    if _dump(value)!=raw: _deny()
    return value


DTOS = (OwnerBinding, roles.RoleContract, roles.BudgetLimits, roles.AgentDefinition,
    roles.RoleAssignment, roles.TestWriteGrant, roles.TestWriteLease, roles.CodeWriteLease,
    roles.RoleDecision, results.RoleEvidence, results.RoleResultReceipt,
    PermissionSnapshot, DataEgressProfile, DelegationPacket, models.TeamSession,
    models.TeamTask, models.TeamMailbox, models.TeamMessage, TeamTaskBinding)
ENUMS = (models.TeamSessionState, models.TeamTaskStatus, models.TeamMessageType, models.TeamDeliveryState)
HINTS = {cls:get_type_hints(cls) for cls in DTOS}
HINTS[TeamTaskBinding]["assignment"] = roles.RoleAssignment
LOCK_TYPE = type(RLock())


def _owner_shape(value, depth=0):
    """Before locks, hashing or frozenset conversion, forbid user behavior."""
    if depth>24: _deny("INPUT_BOUND_EXCEEDED")
    t=type(value)
    if value is None or t is str or t is bool or t is int:
        _builtin(value); return
    if t is datetime:
        _time(value); return
    if any(t is cls for cls in ENUMS): return
    if t is tuple or t is list or t is set or t is frozenset:
        if len(value)>1024: _deny("INPUT_BOUND_EXCEEDED")
        for item in value: _owner_shape(item,depth+1)
        return
    if t is dict:
        if len(value)>1024: _deny("INPUT_BOUND_EXCEEDED")
        for key,item in value.items():
            _owner_shape(key,depth+1); _owner_shape(item,depth+1)
        return
    if any(t is cls for cls in DTOS):
        for f in fields(t): _owner_shape(object.__getattribute__(value,f.name),depth+1)
        return
    _deny("BUILTIN_REQUIRED")


def _codec(value, expected, encode=False, depth=0):
    """Closed schema dispatch. Wire never chooses a class, codec or callback."""
    if depth > 24: _deny("INPUT_BOUND_EXCEEDED")
    rec=lambda v,t:_codec(v,t,encode,depth+1)
    if type(expected) is dict:
        if type(value) is not dict or set(value)!=set(expected): _deny()
        return {k:rec(value[k],t) for k,t in expected.items()}
    if type(expected) is tuple and expected[0]=="entries":
        kt,vt=expected[1:]
        if encode:
            if type(value) is not dict or len(value)>1024: _deny("BUILTIN_REQUIRED")
            rows=[{"key":rec(k,kt),"value":rec(v,vt)} for k,v in value.items()]
            return sorted(rows,key=lambda row:_dump(row["key"]))
        if type(value) is not list or len(value)>1024: _deny()
        out={}; previous=None
        for row in value:
            if type(row) is not dict or set(row)!={"key","value"}: _deny()
            keybytes=_dump(row["key"])
            if previous is not None and keybytes<=previous: _deny("COMPONENT_DUPLICATE")
            previous=keybytes; key=rec(row["key"],kt)
            if key in out: _deny("COMPONENT_DUPLICATE")
            out[key]=rec(row["value"],vt)
        return out
    origin,args=get_origin(expected),get_args(expected)
    if origin is UnionType or origin is Union:
        for option in args:
            try: return rec(value,option)
            except (OwnerContractError,ValueError,TypeError): pass
        _deny()
    if expected is type(None):
        if value is not None: _deny()
        return None
    if expected is str or expected is int or expected is bool:
        if type(value) is not expected: _deny("BUILTIN_REQUIRED")
        _builtin(value); return value
    if expected is datetime:
        if encode: return _time(value).isoformat()
        if type(value) is not str: _deny()
        result=_time(datetime.fromisoformat(value))
        if result.isoformat()!=value: _deny()
        return result
    if origin is tuple or origin is frozenset or origin is list:
        if type(value) is not (origin if encode else list) or len(value)>1024: _deny()
        if origin is tuple and args[-1:]!=(Ellipsis,):
            if len(value)!=len(args): _deny()
            items=[rec(v,t) for v,t in zip(value,args)]
        else: items=[rec(v,args[0]) for v in value]
        if origin is frozenset:
            if encode: return sorted(items,key=_dump)
            if len(set(items))!=len(items) or sorted(value,key=_dump)!=value: _deny()
            return frozenset(items)
        return items if encode or origin is list else tuple(items)
    if any(expected is cls for cls in ENUMS):
        if encode:
            if type(value) is not expected: _deny()
            return value.value
        if type(value) is not str: _deny()
        return expected(value)
    if any(expected is cls for cls in DTOS):
        if encode:
            if type(value) is not expected: _deny("BUILTIN_REQUIRED")
            return {f.name:rec(object.__getattribute__(value,f.name),HINTS[expected][f.name]) for f in fields(expected)}
        if type(value) is not dict or set(value)!={f.name for f in fields(expected)}: _deny()
        converted={f.name:rec(value[f.name],HINTS[expected][f.name]) for f in fields(expected)}
        result=expected(**{f.name:converted[f.name] for f in fields(expected) if f.init})
        for f in fields(expected):
            if not f.init and getattr(result,f.name)!=converted[f.name]: _deny("COMPONENT_HASH_MISMATCH")
        return result
    _deny("COMPONENT_SCHEMA")


def M(key,value): return ("entries",key,value)


P_CTOR = dict(session_id=str,baseline_hash=str,target_hash=str,implementation_actor=str,
    implementation_context=str,implementation_workspace=str,implementation_context_hash=str,
    parent_permission=PermissionSnapshot,parent_egress=DataEgressProfile,parent_budget=roles.BudgetLimits)
P_STATE = dict(assignments=M(str,roles.RoleAssignment),assignment_seals=M(str,str),
    definitions=M(str,tuple[int,str]),revoked=frozenset[str],spent=M(str,roles.BudgetLimits),
    requests=M(tuple[str,str],tuple[str,roles.RoleDecision]),audits=list[roles.RoleDecision],
    write_leases=M(str,roles.TestWriteLease),write_seals=M(str,str),write_revoked=frozenset[str],
    code_leases=M(str,roles.CodeWriteLease),code_seals=M(str,str),code_revoked=frozenset[str])
R_STATE = dict(captures=M(str,results.RoleEvidence),seals=M(str,str),
    results=M(tuple[str,str]|tuple[str,str,str],str),audits=list[results.RoleResultReceipt])
SESSION = dict(session_id=str,leader_id=str,baseline_hash=str,revision=int)
TASK_ROW = dict(status=str,binding_hash=str,assignment_hash=str,actor_id=str,
    parent_task_id=str|None,dependency_ids=list[str],cost_limit=int,result_hash=str|None,
    failure_fingerprint=str|None,reserved_exposure=int,usage_status=str,actual_cost=int|None)
EVENT_ROW = dict(sequence=int,kind=str,task_id=str|None,occurred_at=str,request_hash=str)
T_CTOR = dict(session=models.TeamSession,policy_component_hash=str,results_component_hash=str,
    parent_task_id=str,target_hash=str,deadline=datetime)
T_STATE = dict(bindings=M(str,TeamTaskBinding),tasks=M(str,TASK_ROW),boxes=M(str,models.TeamMailbox),
    events=list[EVENT_ROW],spent=int,cancelled=bool,replay=M(str,tuple[str,str]),plan_hash=str,last_at=datetime)
M_CTOR = dict(team_component_hash=str,quorum=int,deadline=datetime,identity=tuple[dict,str,str])
# The dict within identity has a closed schema, not arbitrary JSON.
M_STATE = dict(records=M(tuple[str,str],tuple[str,str]),proposals=M(str,str),critiques=M(str,str),syntheses=M(str,str))
CONSTRUCTORS = (P_CTOR,dict(policy_component_hash=str),T_CTOR,M_CTOR)
STATES = (P_STATE,R_STATE,T_STATE,M_STATE)


def _payload_codec(data,index,encode=False):
    if type(data) is not dict or set(data)!={"constructor","state"}: _deny()
    ctor=data["constructor"]
    if index==3:
        if type(ctor) is not dict or set(ctor)!=set(M_CTOR): _deny()
        identity=ctor["identity"]
        if type(identity) is not (tuple if encode else list) or len(identity)!=3: _deny()
        converted=[_codec(identity[0],SESSION,encode),_codec(identity[1],str,encode),_codec(identity[2],str,encode)]
        c={k:_codec(v,M_CTOR[k],encode) for k,v in ctor.items() if k!="identity"}
        c["identity"]=converted if encode else tuple(converted)
    else: c=_codec(ctor,CONSTRUCTORS[index],encode)
    return dict(constructor=c,state=_codec(data["state"],STATES[index],encode))


@dataclass(frozen=True,slots=True)
class OwnerComponentPayload:
    component_type: str
    schema_version: str
    assignment_id: str
    owner_version: int
    binding: OwnerBinding
    payload: dict
    component_hash: str

    def __post_init__(self):
        try:
            self._validate_capture()
        except OwnerContractError: raise
        except repository.OwnerContractError as exc: raise OwnerContractError(exc.code) from None
        except Exception: _deny("COMPONENT_SHAPE")

    def _validate_capture(self):
        binding=repository._copy(self.binding,OwnerBinding)
        if type(self.component_type) is not str or self.component_type not in KINDS: _deny("COMPONENT_TYPE")
        if type(self.schema_version) is not str or self.schema_version!="owner-component/v1": _deny("COMPONENT_SCHEMA")
        if type(self.assignment_id) is not str or self.assignment_id!=binding.assignment_id: _deny("OWNER_BINDING_MISMATCH")
        if type(self.owner_version) is not int or self.owner_version<1: _deny("OWNER_VERSION")
        _builtin(self.payload)
        _hash_text(self.component_hash)
        value=dict(component_type=self.component_type,schema_version=self.schema_version,
            assignment_id=self.assignment_id,owner_version=self.owner_version,
            binding=_codec(binding,OwnerBinding,True),payload=self.payload)
        raw=_dump(value)
        if len(raw.encode())>262144: _deny("INPUT_BOUND_EXCEEDED")
        if _hash(value)!=self.component_hash: _deny("COMPONENT_HASH_MISMATCH")
        object.__setattr__(self,"binding",binding)
        object.__setattr__(self,"payload",json.loads(_dump(self.payload)))


def _component(kind,binding,version,payload):
    data=dict(component_type=kind,schema_version="owner-component/v1",assignment_id=binding.assignment_id,
        owner_version=version,binding=_codec(binding,OwnerBinding,True),payload=payload)
    return OwnerComponentPayload(kind,"owner-component/v1",binding.assignment_id,version,binding,payload,_hash(data))


def _capture(policy,result_service,team,moa,binding,version):
    if (type(policy) is not roles.RolePolicyService or type(result_service) is not results.RoleResultService
        or type(team) is not RoleTeamOrchestrator or type(moa) is not MoADeliberation): _deny("COMPONENT_TYPE")
    if result_service._policy is not policy or team._policy is not policy or team._results is not result_service or moa._team is not team:
        _deny("OWNER_BINDING_MISMATCH")
    for owner,refs in ((policy,()),(result_service,("_policy",)),
                       (team,("_policy","_results")),(moa,("_team",))):
        for name,value in object.__getattribute__(owner,"__dict__").items():
            if type(name) is not str: _deny("BUILTIN_REQUIRED")
            if name in refs: continue
            if name=="_lock":
                if type(value) is not LOCK_TYPE: _deny("BUILTIN_REQUIRED")
            else: _owner_shape(value)
    # Same order as owner nesting: MoA -> Team -> Policy. Results shares policy.
    with moa._lock,team._lock,policy._lock:
        pc=dict(session_id=policy._session,baseline_hash=policy._baseline,target_hash=policy._target,
            implementation_actor=policy._implementation[0],implementation_context=policy._implementation[1],
            implementation_workspace=policy._implementation[2],implementation_context_hash=policy._implementation_context_hash,
            parent_permission=policy._parent,parent_egress=policy._egress,parent_budget=policy._budget)
        ps=dict(assignments=policy._records,assignment_seals=policy._seals,definitions=policy._definitions,
            revoked=frozenset(policy._revoked),spent=policy._spent,requests=policy._requests,audits=policy._audits,
            write_leases=policy._write_leases,write_seals=policy._write_seals,write_revoked=frozenset(policy._write_revoked),
            code_leases=policy._code_leases,code_seals=policy._code_seals,code_revoked=frozenset(policy._code_revoked))
        p=_component(KINDS[0],binding,version,_payload_codec(dict(constructor=pc,state=ps),0,True))
        rs=dict(captures=result_service._captures,seals=result_service._seals,results=result_service._results,audits=result_service._audits)
        r=_component(KINDS[1],binding,version,_payload_codec(dict(constructor=dict(policy_component_hash=p.component_hash),state=rs),1,True))
        tc=dict(session=team._session,policy_component_hash=p.component_hash,results_component_hash=r.component_hash,
            parent_task_id=team._parent,target_hash=team._target,deadline=team._deadline)
        ts=dict(bindings=team._bindings,**team._state)
        t=_component(KINDS[2],binding,version,_payload_codec(dict(constructor=tc,state=ts),2,True))
        mc=dict(team_component_hash=t.component_hash,quorum=moa._quorum,deadline=moa._deadline,identity=moa._identity)
        ms=dict(records=moa._records,proposals=moa._proposals,critiques=moa._critiques,syntheses=moa._syntheses)
        m=_component(KINDS[3],binding,version,_payload_codec(dict(constructor=mc,state=ms),3,True))
        return p,r,t,m


def _check_components(components,binding,version,now):
    if len(components)!=4: _deny("COMPONENT_STATE_INCOMPLETE")
    decoded=[]
    for i,p in enumerate(components):
        if type(p) is not OwnerComponentPayload: _deny("COMPONENT_TYPE")
        checked=OwnerComponentPayload(*(object.__getattribute__(p,f.name) for f in fields(OwnerComponentPayload)))
        if checked.component_type!=KINDS[i] or checked.binding!=binding or checked.owner_version!=version: _deny("OWNER_BINDING_MISMATCH")
        decoded.append(_payload_codec(checked.payload,i))
    pc,ps=decoded[0]["constructor"],decoded[0]["state"]
    if not ps["assignments"] or binding.assignment_id not in ps["assignments"]: _deny("COMPONENT_STATE_INCOMPLETE")
    if set(ps["assignments"])!=set(ps["assignment_seals"]) or set(ps["assignments"])!=set(ps["spent"]): _deny()
    if not ps["revoked"]<=ps["assignments"].keys(): _deny()
    if binding.assignment_id in ps["revoked"]: _deny("OWNER_AUTHORITY_STALE")
    selected=ps["assignments"][binding.assignment_id]
    for name in ("assignment_id","actor_id","context_id","workspace_id","session_id","baseline_hash","target_hash","execution_fence"):
        if getattr(selected,name)!=getattr(binding,name): _deny("OWNER_BINDING_MISMATCH")
    if selected.content_hash!=binding.assignment_hash: _deny("OWNER_BINDING_MISMATCH")
    if not selected.issued_at<=now<selected.expires_at: _deny("OWNER_AUTHORITY_STALE")
    if (pc["session_id"],pc["baseline_hash"],pc["target_hash"])!=(binding.session_id,binding.baseline_hash,binding.target_hash): _deny("OWNER_BINDING_MISMATCH")
    for key,a in ps["assignments"].items():
        if key!=a.assignment_id or ps["assignment_seals"][key]!=a.content_hash: _deny("COMPONENT_HASH_MISMATCH")
        if (a.session_id,a.baseline_hash,a.target_hash)!=(binding.session_id,binding.baseline_hash,binding.target_hash): _deny("OWNER_BINDING_MISMATCH")
        if (a.implementation_actor,a.implementation_context,a.implementation_workspace)!=(pc["implementation_actor"],pc["implementation_context"],pc["implementation_workspace"]): _deny("OWNER_BINDING_MISMATCH")
        current=ps["definitions"].get(a.definition.definition_id)
        if current is None or current[0]<a.definition.version: _deny("OWNER_AUTHORITY_STALE")
        if key==binding.assignment_id and current!=(a.definition.version,a.definition.content_hash): _deny("OWNER_AUTHORITY_STALE")
        receipt=validate_packet(a.packet,baseline_hash=binding.baseline_hash,context_snapshot_hash=a.packet.context_snapshot_hash,
            parent_permission_snapshot=pc["parent_permission"],parent_egress_profile=pc["parent_egress"])
        if not receipt.valid: _deny("OWNER_BINDING_MISMATCH")
        if a.packet.workspace_id!=a.workspace_id or a.packet.expected_result_schema!=a.definition.result_schema: _deny("OWNER_BINDING_MISMATCH")
        ceiling,effective=a.definition.permission_ceiling,a.packet.permission_snapshot
        if (not roles._within(effective.allowed_paths,ceiling.allowed_paths)
            or not set(effective.allowed_actions)<=set(ceiling.allowed_actions)
            or not set(effective.allowed_tools)<=set(ceiling.allowed_tools)
            or not set(effective.allowed_backends)<=set(ceiling.allowed_backends)
            or not roles._within(ceiling.prohibited_paths,effective.prohibited_paths)
            or not roles._within(ceiling.protected_paths,effective.protected_paths)
            or not set(ceiling.prohibited_actions)<=set(effective.prohibited_actions)):
            _deny("OWNER_BINDING_MISMATCH")
        if not a.definition.budget.fits(pc["parent_budget"]) or not ps["spent"][key].fits(a.definition.budget): _deny()
    for prefix in ("write","code"):
        leases=ps[prefix+"_leases"]; seals=ps[prefix+"_seals"]
        if set(leases)!=set(seals) or not ps[prefix+"_revoked"]<=leases.keys(): _deny()
        for key,lease in leases.items():
            if key!=lease.lease_id or roles.contract_hash(lease)!=seals[key]: _deny("COMPONENT_HASH_MISMATCH")
            a=ps["assignments"].get(lease.assignment_id)
            if a is None or (lease.actor_id,lease.workspace_id,lease.execution_fence)!=(a.actor_id,a.workspace_id,a.execution_fence): _deny("OWNER_BINDING_MISMATCH")
    if binding.write_fence is not None:
        candidates=[v for prefix in ("write","code") for k,v in ps[prefix+"_leases"].items()
            if k not in ps[prefix+"_revoked"] and v.assignment_id==binding.assignment_id and v.write_fence==binding.write_fence and v.issued_at<=now<v.expires_at]
        if len(candidates)!=1: _deny("OWNER_AUTHORITY_STALE")
    for (aid,_),(rh,receipt) in ps["requests"].items():
        if aid not in ps["assignments"] or receipt.assignment_hash!=ps["assignment_seals"][aid] or receipt.request_hash!=rh: _deny()
    if decoded[1]["constructor"]["policy_component_hash"]!=components[0].component_hash: _deny("COMPONENT_HASH_MISMATCH")
    rs=decoded[1]["state"]
    if set(rs["captures"])!=set(rs["seals"]): _deny()
    assignments={a.content_hash:a for a in ps["assignments"].values()}
    for key,e in rs["captures"].items():
        a=assignments.get(e.assignment_hash)
        if key!=e.evidence_id or e.content_hash!=rs["seals"][key]: _deny("COMPONENT_HASH_MISMATCH")
        if a is None or (e.actor_id,e.context_id,e.target_hash)!=(a.actor_id,a.context_id,a.target_hash): _deny("OWNER_BINDING_MISMATCH")
    for key,h in rs["results"].items():
        if key[0] not in ps["assignments"] or len(key)==3 and key[2]!="role_envelope": _deny()
        _hash_text(h)
    tc,ts=decoded[2]["constructor"],decoded[2]["state"]
    if tc["policy_component_hash"]!=components[0].component_hash or tc["results_component_hash"]!=components[1].component_hash: _deny("COMPONENT_HASH_MISMATCH")
    session=tc["session"]
    if (session.session_id,session.baseline_hash,tc["target_hash"])!=(binding.session_id,binding.baseline_hash,binding.target_hash): _deny("OWNER_BINDING_MISMATCH")
    if not 1<=len(ts["bindings"])<=64 or set(ts["bindings"])!=set(ts["tasks"]) or set(ts["bindings"])!=set(ts["boxes"]): _deny("COMPONENT_STATE_INCOMPLETE")
    if canonical_hash(tuple(v for _,v in sorted(ts["bindings"].items())))!=ts["plan_hash"]: _deny("COMPONENT_HASH_MISMATCH")
    DependencyGraph(tuple((k,tuple(sorted(v.task.dependency_ids|({v.parent_task_id} if v.parent_task_id else set())))) for k,v in ts["bindings"].items()))
    for key,b in ts["bindings"].items():
        a=ps["assignments"].get(b.assignment.assignment_id); row=ts["tasks"][key]; box=ts["boxes"][key]
        if a is None or b.assignment!=a or b.task.task_id!=key or b.task.session_id!=session.session_id: _deny("OWNER_BINDING_MISMATCH")
        if a.actor_id not in session.memberships or a.packet.step_id!=key or a.packet.parent_agent_id!=session.leader_id or a.packet.parent_run_id!=(b.parent_task_id or tc["parent_task_id"]): _deny("OWNER_BINDING_MISMATCH")
        if (row["binding_hash"],row["assignment_hash"],row["actor_id"],row["parent_task_id"],row["dependency_ids"],row["cost_limit"])!=(b.content_hash,a.content_hash,a.actor_id,b.parent_task_id,sorted(b.task.dependency_ids),b.cost_limit): _deny("OWNER_BINDING_MISMATCH")
        if row["status"] not in ("PENDING","CLAIMED","COMPLETED","FAILED","COST_EXCEEDED","BLOCKED_BUDGET","BLOCKED_DEPENDENCY","TIMED_OUT","CANCELLED"): _deny()
        if row["usage_status"] not in ("NOT_STARTED","UNRECONCILED","HOST_OBSERVED"): _deny()
        if row["result_hash"] is not None and row["result_hash"] not in [h for k,h in rs["results"].items() if k[0]==a.assignment_id]: _deny("OWNER_BINDING_MISMATCH")
        if row["cost_limit"]<0 or row["reserved_exposure"]<0 or row["actual_cost"] is not None and row["actual_cost"]<0: _deny()
        if row["status"]=="COMPLETED" and row["result_hash"] is None: _deny()
        if (box.session_id,box.owner_id,box.baseline_hash,box.parent_hash)!=(session.session_id,a.actor_id,session.baseline_hash,b.content_hash): _deny("OWNER_BINDING_MISMATCH")
        for message in box.messages:
            if (message.session_id,message.receiver_id,message.baseline_hash)!=(session.session_id,a.actor_id,session.baseline_hash): _deny("OWNER_BINDING_MISMATCH")
    if len(ts["events"])>512 or len(ts["replay"])>512 or ts["spent"]<0: _deny("INPUT_BOUND_EXCEEDED")
    if ts["spent"]!=sum(r["actual_cost"] or 0 for r in ts["tasks"].values()): _deny()
    if len(ts["events"])!=len(ts["replay"]): _deny()
    for i,e in enumerate(ts["events"],1):
        if e["sequence"]!=i or e["task_id"] is not None and e["task_id"] not in ts["bindings"]: _deny()
        if e["kind"] not in ("TASK_CLAIMED","TASK_RESULT","TIME_OBSERVED","SESSION_CANCELLED","PEER_MESSAGE","MESSAGE_ACKNOWLEDGED"): _deny()
        _hash_text(e["request_hash"]); _codec(e["occurred_at"],datetime)
    for rh,payload in ts["replay"].values():
        _hash_text(rh); _check_replay(_parse(payload),ts,tc)
    mc,ms=decoded[3]["constructor"],decoded[3]["state"]
    expected_identity=(dict(session_id=session.session_id,leader_id=session.leader_id,baseline_hash=session.baseline_hash,revision=session.revision),binding.target_hash,ts["plan_hash"])
    if mc["team_component_hash"]!=components[2].component_hash or mc["identity"]!=expected_identity: _deny("OWNER_BINDING_MISMATCH")
    if not 1<=mc["quorum"]<=16 or mc["deadline"]<=session.created_at: _deny()
    _check_moa(ms,ts,binding,expected_identity)
    return decoded


def _check_replay(view,ts,tc):
    if type(view) is not dict: _deny()
    if "schema_version" in view:
        names={"schema_version","session","target_hash","plan_hash","tasks","spent","events",
            "status","ready","forecast_exposure","automatic_acceptance","io_count","runtime","budget_reservation"}
        if set(view)!=names: _deny()
        expected=tc["session"]
        session=dict(session_id=expected.session_id,leader_id=expected.leader_id,baseline_hash=expected.baseline_hash,revision=expected.revision)
        if view["session"]!=session or view["target_hash"]!=tc["target_hash"] or view["plan_hash"]!=ts["plan_hash"]: _deny("OWNER_BINDING_MISMATCH")
        if (view["schema_version"]!="role_team_projection/v1" or view["automatic_acceptance"] is not False
            or type(view["io_count"]) is not int or view["io_count"]!=0 or view["runtime"]!="NOT_EXECUTED"
            or view["budget_reservation"]!="NOT_IMPLEMENTED"): _deny()
        if type(view["tasks"]) is not dict or set(view["tasks"])!=set(ts["bindings"]): _deny()
        for key,row in view["tasks"].items():
            _codec(row,TASK_ROW)
            b=ts["bindings"][key]
            if (row["assignment_hash"],row["binding_hash"],row["actor_id"])!=(b.assignment.content_hash,b.content_hash,b.assignment.actor_id): _deny("OWNER_BINDING_MISMATCH")
        _codec(view["events"],list[EVENT_ROW]); _codec(view["ready"],list[str])
        if any(key not in ts["bindings"] for key in view["ready"]): _deny()
        if type(view["spent"]) is not int or view["spent"]<0 or type(view["forecast_exposure"]) is not int or view["forecast_exposure"]<0: _deny()
    else:
        # Mailbox snapshots use C23's Z timestamp representation; normalize only
        # declared date fields for the strict typed decoder, never arbitrary keys.
        def dates(row,cls):
            if type(row) is not dict or set(row)!={f.name for f in fields(cls)}: _deny()
            out=dict(row)
            for name in ("created_at","delivered_at","acknowledged_at"):
                if name in out and out[name] is not None:
                    if type(out[name]) is not str: _deny()
                    out[name]=_time(datetime.fromisoformat(out[name])).isoformat()
            if cls is models.TeamMailbox:
                if type(out["messages"]) is not list: _deny()
                out["messages"]=[dates(v,models.TeamMessage) for v in out["messages"]]
            return out
        box=_codec(dates(view,models.TeamMailbox),models.TeamMailbox)
        if box.session_id!=tc["session"].session_id or box.baseline_hash!=tc["session"].baseline_hash: _deny("OWNER_BINDING_MISMATCH")
        if box.owner_id not in {b.assignment.actor_id for b in ts["bindings"].values()}: _deny("OWNER_BINDING_MISMATCH")


def _check_moa(ms,ts,binding,identity):
    authority={"task_id","actor_id","execution_fence","assignment_hash","result_hash","parent_task_id","binding_hash"}
    proposal=authority|{"summary","evidence_refs","session_id","baseline_hash","target_hash","plan_hash"}
    critique=authority|{"proposal_id","proposal_hash","verdict","summary","evidence_refs"}
    synthesis={"status","selected_proposal_id","quorum","session_id","baseline_hash","target_hash","team_projection_hash","proposals","critiques","final_owner","spent","unverified","io_count","automatic_acceptance","provider_selection"}
    schemas={"MOA_PROPOSAL":proposal,"MOA_CRITIQUE":critique,"MOA_SYNTHESIS":synthesis}
    if len(ms["records"])>256: _deny("INPUT_BOUND_EXCEEDED")
    for (kind,key),(h,payload) in ms["records"].items():
        if kind not in schemas: _deny()
        row=_parse(payload)
        if type(row) is not dict or set(row)!=schemas[kind] or _hash(row)!=h: _deny("COMPONENT_HASH_MISMATCH")
        if kind in ("MOA_PROPOSAL","MOA_CRITIQUE"):
            if MoADeliberation._metadata(row["summary"],row["evidence_refs"])!=row["evidence_refs"]: _deny()
            b=ts["bindings"].get(row["task_id"])
            if b is None: _deny("OWNER_BINDING_MISMATCH")
            a=b.assignment; task=ts["tasks"][b.task.task_id]
            if (row["actor_id"],row["execution_fence"],row["assignment_hash"],row["result_hash"],row["parent_task_id"],row["binding_hash"])!=(a.actor_id,a.execution_fence,a.content_hash,task["result_hash"],b.parent_task_id,b.content_hash): _deny("OWNER_BINDING_MISMATCH")
            if task["status"]!="COMPLETED" or not row["result_hash"]: _deny()
        if kind!="MOA_CRITIQUE" and (row["session_id"],row["baseline_hash"],row["target_hash"])!=(binding.session_id,binding.baseline_hash,binding.target_hash): _deny("OWNER_BINDING_MISMATCH")
        if kind=="MOA_PROPOSAL" and row["plan_hash"]!=identity[2]: _deny("OWNER_BINDING_MISMATCH")
        if kind=="MOA_CRITIQUE":
            parent=ms["records"].get(("MOA_PROPOSAL",row["proposal_id"]))
            if parent is None or parent[0]!=row["proposal_hash"] or row["verdict"] not in ("SUPPORT","OBJECT"): _deny()
            if _parse(parent[1])["actor_id"]==row["actor_id"]: _deny("OWNER_BINDING_MISMATCH")
        if kind=="MOA_SYNTHESIS":
            if (row["automatic_acceptance"] is not False or type(row["io_count"]) is not int
                or row["io_count"]!=0 or row["provider_selection"] is not None
                or row["status"]!="SYNTHESIZED_FOR_MAIN" or row["final_owner"]!=identity[0]["leader_id"]): _deny()
            _hash_text(row["team_projection_hash"])
            for field_name,typ in (("proposals","MOA_PROPOSAL"),("critiques","MOA_CRITIQUE")):
                if type(row[field_name]) is not dict: _deny()
                for identifier,embedded in row[field_name].items():
                    actual=ms["records"].get((typ,identifier))
                    if actual is None or _dump(embedded)!=actual[1]: _deny("COMPONENT_HASH_MISMATCH")
            if row["selected_proposal_id"] not in row["proposals"]: _deny()
    for field_name,kind in (("proposals","MOA_PROPOSAL"),("critiques","MOA_CRITIQUE"),("syntheses","MOA_SYNTHESIS")):
        for key,payload in ms[field_name].items():
            if ms["records"].get((kind,key))!=(_hash(_parse(payload)),payload): _deny("COMPONENT_HASH_MISMATCH")
        if field_name!="syntheses" and set(ms[field_name])!={k for typ,k in ms["records"] if typ==kind}: _deny()


def _construct_owners(decoded):
    """Validated state only. Explicit field assignments, never dynamic setattr."""
    pc,ps=decoded[0]["constructor"],decoded[0]["state"]
    p=roles.RolePolicyService(**pc)
    p._records=ps["assignments"]; p._seals=ps["assignment_seals"]; p._definitions=ps["definitions"]
    p._revoked=set(ps["revoked"]); p._spent=ps["spent"]; p._requests=ps["requests"]; p._audits=ps["audits"]
    p._write_leases=ps["write_leases"]; p._write_seals=ps["write_seals"]; p._write_revoked=set(ps["write_revoked"])
    p._code_leases=ps["code_leases"]; p._code_seals=ps["code_seals"]; p._code_revoked=set(ps["code_revoked"])
    rs=decoded[1]["state"]; r=results.RoleResultService(p)
    r._captures=rs["captures"]; r._seals=rs["seals"]; r._results=rs["results"]; r._audits=rs["audits"]
    tc,ts=decoded[2]["constructor"],decoded[2]["state"]
    t=RoleTeamOrchestrator(tc["session"],p,r,parent_task_id=tc["parent_task_id"],target_hash=tc["target_hash"],deadline=tc["deadline"])
    t._bindings=ts["bindings"]; t._state={k:v for k,v in ts.items() if k!="bindings"}
    mc,ms=decoded[3]["constructor"],decoded[3]["state"]
    m=MoADeliberation(t,quorum=mc["quorum"],deadline=mc["deadline"])
    m._records=ms["records"]; m._proposals=ms["proposals"]; m._critiques=ms["critiques"]; m._syntheses=ms["syntheses"]
    return p,r,t,m


@dataclass(frozen=True,slots=True)
class OwnerComponentBundle:
    binding: OwnerBinding
    owner_version: int
    owner_snapshot_hash: str
    principal_mapping_hash: str
    component_hashes: tuple[str,...] = field(init=False)
    restored_at: datetime
    receipt_hash: str = field(init=False)
    policy: roles.RolePolicyService
    results: results.RoleResultService
    team: RoleTeamOrchestrator
    moa: MoADeliberation

    def __post_init__(self):
        try:
            b=repository._copy(self.binding,OwnerBinding); now=_time(self.restored_at)
            if type(self.owner_version) is not int or self.owner_version<1: _deny("OWNER_VERSION")
            _hash_text(self.owner_snapshot_hash); _hash_text(self.principal_mapping_hash)
            parts=_capture(self.policy,self.results,self.team,self.moa,b,self.owner_version)
            decoded=_check_components(parts,b,self.owner_version,now)
            owners=_construct_owners(decoded)
            for key,value in zip(("policy","results","team","moa"),owners): object.__setattr__(self,key,value)
            object.__setattr__(self,"binding",b); object.__setattr__(self,"restored_at",now)
            object.__setattr__(self,"component_hashes",tuple(p.component_hash for p in parts))
            object.__setattr__(self,"receipt_hash",_hash(_bundle_metadata(self)))
        except OwnerContractError: raise
        except Exception: _deny("COMPONENT_CONSTRUCTION_FAILED")


def _bundle_metadata(bundle):
    return dict(binding=_codec(bundle.binding,OwnerBinding,True),owner_version=bundle.owner_version,
        owner_snapshot_hash=bundle.owner_snapshot_hash,principal_mapping_hash=bundle.principal_mapping_hash,
        component_hashes=list(bundle.component_hashes),restored_at=_time(bundle.restored_at).isoformat())


def export_owner_components(bundle):
    try:
        if type(bundle) is not OwnerComponentBundle: _deny("BUILTIN_REQUIRED")
        b=repository._copy(bundle.binding,OwnerBinding)
        if type(bundle.component_hashes) is not tuple or len(bundle.component_hashes)!=4: _deny()
        for h in bundle.component_hashes: _hash_text(h)
        _hash_text(bundle.receipt_hash)
        if _hash(_bundle_metadata(bundle))!=bundle.receipt_hash: _deny("COMPONENT_HASH_MISMATCH")
        parts=_capture(bundle.policy,bundle.results,bundle.team,bundle.moa,b,bundle.owner_version)
        _check_components(parts,b,bundle.owner_version,_time(bundle.restored_at))
        return parts
    except OwnerContractError: raise
    except Exception: _deny("COMPONENT_CONSTRUCTION_FAILED")


def restore_owner_components(snapshot,principal,*,session_factory,now):
    try:
        captured=repository._copy(snapshot,OwnerSnapshot)
        mapped=repository._copy(principal,PrincipalMapping)
        now=_time(now)
        if captured.binding!=mapped.binding or mapped not in captured.principal_mappings: _deny("OWNER_BINDING_MISMATCH")
        if not captured.created_at<=now<captured.expires_at or not mapped.issued_at<=now<mapped.expires_at: _deny("OWNER_AUTHORITY_STALE")
        components=[]
        for kind,component in zip(KINDS,(captured.policy,captured.results,captured.team,captured.moa)):
            if component is None: _deny("COMPONENT_STATE_INCOMPLETE")
            row=_parse(component.canonical_json)
            if type(row) is not dict or set(row)!={f.name for f in fields(OwnerComponentPayload)}: _deny()
            if row["component_type"]!=kind: _deny("COMPONENT_TYPE")
            row["binding"]=_codec(row["binding"],OwnerBinding)
            components.append(OwnerComponentPayload(**row))
        decoded=_check_components(components,captured.binding,captured.owner_version,now)
        repo=repository.SqlAlchemyAgentTeamOwnerRepository()
        def current():
            with session_factory() as session,session.begin():
                actual=repo.load_current_owner(session,binding=captured.binding,principal=mapped,expected_version=captured.owner_version)
                if actual!=captured: _deny("OWNER_AUTHORITY_STALE")
        current()
        owners=_construct_owners(decoded)
        # Construct metadata without another hydration/constructor pass after the
        # final authority fence. No temporary owner is published before this point.
        out=object.__new__(OwnerComponentBundle)
        for key,value in dict(binding=repository._copy(captured.binding,OwnerBinding),owner_version=captured.owner_version,
            owner_snapshot_hash=captured.content_hash,principal_mapping_hash=mapped.mapping_hash,
            component_hashes=tuple(p.component_hash for p in components),restored_at=now,
            **dict(zip(("policy","results","team","moa"),owners))).items(): object.__setattr__(out,key,value)
        object.__setattr__(out,"receipt_hash",_hash(_bundle_metadata(out)))
        current()
        # Callback-free local consistency fence after the last repository call.
        if export_owner_components(out)!=tuple(components): _deny("COMPONENT_HASH_MISMATCH")
        return out
    except OwnerContractError: raise
    except repository.OwnerContractError as exc: raise OwnerContractError(exc.code) from None
    except Exception: _deny("COMPONENT_CONSTRUCTION_FAILED")


__all__ = ["OwnerComponentPayload","OwnerComponentBundle","OwnerContractError",
    "restore_owner_components","export_owner_components"]
