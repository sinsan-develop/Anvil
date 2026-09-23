"""C25 host-only, transport-neutral boundary. No sender, auth protocol or IO.

Identity captures consume already authenticated host observations, not SNS
payload claims. Only opaque artifact references enter this owner; the artifact
store, transport verification, Web Console step-up and durable inbox are later
integration boundaries. C22/C23 remain the role/session authority.
"""
from dataclasses import dataclass, fields
from datetime import datetime, timedelta
from copy import deepcopy
from threading import RLock
import json
import re
from packages.git_adapter.models import plain
from packages.model_registry.models import utc
from .provider_catalog import _snapshot, _c24_hash, _c24_read
from .role_contracts import RoleAssignment, RolePolicyService
from .orchestration import RoleTeamOrchestrator


def _id(value):
    if type(value) is not str or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}',value) is None:
        raise ValueError('IDENTIFIER_INVALID')
    return value


def _integer(value,minimum,maximum):
    if type(value) is not int or not minimum<=value<=maximum:raise ValueError('INPUT_BOUND_EXCEEDED')
    return value


def _ref(value):
    value=plain(value)
    if type(value) is not dict or set(value)!={'artifact_id','sha256','privacy'}:raise ValueError('PAYLOAD_REF_REQUIRED')
    _id(value['artifact_id']);_c24_hash(value['sha256'])
    if value['privacy']!='PRIVATE':raise ValueError('PRIVACY_DENIED')
    return value


def _value(kind,key,data):
    value=_snapshot(kind,key,data)
    if len(value.payload_json.encode('utf-8'))>262144:raise ValueError('PROJECTION_BOUND_EXCEEDED')
    return value


@dataclass(frozen=True,slots=True)
class SNSMessageEnvelope:
    message_id:str
    channel:str
    session_id:str
    task_id:str
    parent_task_id:str|None
    external_actor_hash:str
    internal_user:str
    tenant_id:str
    project_id:str
    role:str
    target_hash:str
    baseline_hash:str
    command:str
    payload_ref:dict
    correlation_id:str
    idempotency_key:str
    replay_nonce:str
    attempt:int
    privacy:str
    retention_seconds:int
    issued_at:datetime
    expires_at:datetime


class SNSGateway:
    """In-memory admission/receipt projection, not transport delivery permission."""
    COMMANDS=frozenset({'QUESTION','STATUS','RESULT'})

    def __init__(self,policy,team,*,tenant_id,project_id,rate_limit=20,rate_window_seconds=60,max_attempts=3):
        if type(policy) is not RolePolicyService or type(team) is not RoleTeamOrchestrator:
            raise ValueError('CANONICAL_OWNER_REQUIRED')
        self._tenant=_id(tenant_id);self._project=_id(project_id)
        self._rate=_integer(rate_limit,1,1000);self._window=_integer(rate_window_seconds,1,3600)
        self._attempts=_integer(max_attempts,1,8)
        self._policy=policy;self._team=team;self._lock=RLock();self._identities={};self._assignments={};self._revoked=set()
        view=team.project().to_dict()
        if not view['plan_hash']:raise ValueError('TEAM_PLAN_REQUIRED')
        self._trace=(view['session'],view['target_hash'],view['plan_hash'])
        self._state=dict(receipts={},idem={},messages={},nonces={},rates={},audit=[],retry={},latest={},last_at=None)

    def _clock(self,now):
        now=utc(now)
        if self._state['last_at'] and now.isoformat()<self._state['last_at']:raise ValueError('PAST_EVENT')
        return now

    def _team_view(self):
        view=self._team.project().to_dict()
        if (view['session'],view['target_hash'],view['plan_hash'])!=self._trace:raise ValueError('TRACE_MISMATCH')
        return view

    def _role(self,a,fence,now):
        if type(a) is not RoleAssignment:raise ValueError('ASSIGNMENT_REQUIRED')
        reason=self._policy.validate_assignment(a,actor_id=a.actor_id,session_id=self._trace[0]['session_id'],
            context_id=a.context_id,target_hash=self._trace[1],execution_fence=fence,now=now)
        if reason:raise ValueError(reason)
        self._team.mailbox(a.packet.step_id,actor_id=a.actor_id,execution_fence=fence,now=now)
        task=self._team_view()['tasks'][a.packet.step_id]
        if task['assignment_hash']!=a.content_hash:raise ValueError('ASSIGNMENT_MISMATCH')
        return task

    def capture_identity(self,identity_id,*,assignment,external_actor_hash,authn_hash,authz_hash,commands,
                         retention_seconds,now,expires_at):
        _id(identity_id);now=utc(now);expires_at=utc(expires_at)
        for value in (external_actor_hash,authn_hash,authz_hash):_c24_hash(value)
        retention_seconds=_integer(retention_seconds,1,86400)
        if type(commands) is not tuple or not commands or any(type(v) is not str for v in commands):raise ValueError('COMMAND_DENIED')
        if len(set(commands))!=len(commands) or not set(commands)<=self.COMMANDS:raise ValueError('CONSOLE_STEP_UP_REQUIRED')
        with self._lock:
            self._clock(now)
            if type(assignment) is not RoleAssignment:raise ValueError('ASSIGNMENT_REQUIRED')
            task=self._role(assignment,assignment.execution_fence,now)
            if not now<expires_at<=assignment.expires_at:raise ValueError('IDENTITY_WINDOW_INVALID')
            row=dict(identity_id=identity_id,external_actor_hash=external_actor_hash,internal_user=assignment.actor_id,
                task_id=assignment.packet.step_id,role=assignment.definition.role,session_id=self._trace[0]['session_id'],
                parent_task_id=task['parent_task_id'],parent_run_id=assignment.packet.parent_run_id,
                baseline_hash=self._trace[0]['baseline_hash'],target_hash=self._trace[1],
                tenant_id=self._tenant,project_id=self._project,assignment_hash=assignment.content_hash,
                authn_hash=authn_hash,authz_hash=authz_hash,commands=sorted(commands),privacy='PRIVATE',
                retention_seconds=retention_seconds,issued_at=now.isoformat(),expires_at=expires_at.isoformat())
            receipt=_value('SNS_IDENTITY',identity_id,row)
            if identity_id in self._revoked:raise ValueError('IDENTITY_REVOKED')
            old=self._identities.get(identity_id)
            if old is not None and old!=receipt.payload_json:raise ValueError('IDENTITY_REBIND')
            if old is None and len(self._identities)>=128:raise ValueError('IDENTITY_BOUND_EXCEEDED')
            detached=deepcopy(assignment)
            self._role(detached,detached.execution_fence,now)
            self._identities[identity_id]=receipt.payload_json;self._assignments[identity_id]=detached
            return receipt

    def revoke_identity(self,identity_id):
        _id(identity_id)
        with self._lock:
            if identity_id not in self._identities:raise ValueError('IDENTITY_INVALID')
            self._revoked.add(identity_id)

    def _identity(self,identity,fence,now):
        _id(fence)
        try:
            row=_c24_read(identity)
            if identity.kind!='SNS_IDENTITY' or self._identities.get(identity.record_id)!=identity.payload_json:
                raise ValueError('IDENTITY_INVALID')
        except (ValueError,TypeError):raise ValueError('IDENTITY_INVALID') from None
        if identity.record_id in self._revoked:raise ValueError('IDENTITY_REVOKED')
        if not row['issued_at']<=now.isoformat()<row['expires_at']:raise ValueError('IDENTITY_EXPIRED')
        self._role(self._assignments[identity.record_id],fence,now)
        return row

    def _envelope(self,envelope,identity,now):
        if type(envelope) is not SNSMessageEnvelope:raise ValueError('ENVELOPE_REQUIRED')
        row={f.name:getattr(envelope,f.name) for f in fields(SNSMessageEnvelope)}
        start=utc(row['issued_at']);end=utc(row['expires_at'])
        row['issued_at']=start.isoformat();row['expires_at']=end.isoformat();row=plain(row)
        for key in ('message_id','channel','session_id','task_id','internal_user','tenant_id','project_id',
                    'role','command','correlation_id','idempotency_key','replay_nonce'):_id(row[key])
        if row['parent_task_id'] is not None:_id(row['parent_task_id'])
        for key in ('external_actor_hash','target_hash','baseline_hash'):_c24_hash(row[key])
        if row['channel'] not in ('SNS','DAON_USER'):raise ValueError('TRANSPORT_DEFERRED')
        if row['command'] not in self.COMMANDS:raise ValueError('CONSOLE_STEP_UP_REQUIRED')
        if row['command'] not in identity['commands']:raise ValueError('COMMAND_DENIED')
        for key in ('session_id','task_id','parent_task_id','external_actor_hash','internal_user','tenant_id','project_id',
                    'role','target_hash','baseline_hash'):
            if row[key]!=identity[key]:raise ValueError('TRACE_MISMATCH')
        if row['privacy']!='PRIVATE':raise ValueError('PRIVACY_DENIED')
        _integer(row['retention_seconds'],1,identity['retention_seconds'])
        if not start<=now<end or end>datetime.fromisoformat(identity['expires_at']):raise ValueError('RECEIPT_EXPIRED')
        if end-start>timedelta(seconds=row['retention_seconds']):raise ValueError('RETENTION_WINDOW_INVALID')
        if type(row['attempt']) is not int or row['attempt']!=1:raise ValueError('ATTEMPT_INVALID')
        row['payload_ref']=_ref(row['payload_ref'])
        return row

    def _publish(self,state,receipt,kind,now):
        if len(state['audit'])>=512:raise ValueError('AUDIT_BOUND_EXCEEDED')
        state['audit'].append(dict(sequence=len(state['audit'])+1,kind=kind,receipt_hash=receipt.content_hash,
            occurred_at=now.isoformat(),delivery='NOT_EXECUTED',io_count=0))
        state['receipts'][receipt.record_id]=(receipt.content_hash,receipt.payload_json)
        state['last_at']=now.isoformat()
        self._state=state
        return receipt

    def receive(self,envelope,*,identity,execution_fence,now):
        with self._lock:
            now=self._clock(now);who=self._identity(identity,execution_fence,now);row=self._envelope(envelope,who,now)
            fingerprint=_snapshot('SNS_INBOUND',row['message_id'],dict(envelope=row,identity_hash=identity.content_hash)).content_hash
            prior=self._state['idem'].get(row['idempotency_key'])
            if prior:
                if prior[0]!=fingerprint:raise ValueError('IDEMPOTENCY_CONFLICT')
                return _value('SNS_RECEIPT',prior[1],json.loads(self._state['receipts'][prior[1]][1]))
            if row['replay_nonce'] in self._state['nonces']:raise ValueError('REPLAY_NONCE')
            if row['message_id'] in self._state['messages']:raise ValueError('MESSAGE_REBIND')
            recent=[t for t in self._state['rates'].get(who['internal_user'],[]) if now-datetime.fromisoformat(t)<timedelta(seconds=self._window)]
            if len(recent)>=self._rate:raise ValueError('RATE_LIMITED')
            trace={k:row[k] for k in ('session_id','task_id','parent_task_id','role','target_hash','baseline_hash','tenant_id','project_id')}
            trace['parent_run_id']=who['parent_run_id']
            receipt=_value('SNS_RECEIPT','in-'+row['message_id'],dict(status='ACCEPTED_HOST_ONLY',direction='INBOUND',
                delivery='NOT_EXECUTED',io_count=0,automatic_acceptance=False,trace=trace,identity_hash=identity.content_hash,
                envelope_hash=fingerprint,authn_hash=who['authn_hash'],authz_hash=who['authz_hash'],
                channel=row['channel'],command=row['command'],payload_ref=row['payload_ref'],correlation_id=row['correlation_id'],
                attempt=1,receipt_ref=None,expires_at=row['expires_at'],retry_at=now.isoformat(),
                privacy='PRIVATE',retention_seconds=row['retention_seconds']))
            state=deepcopy(self._state);key=receipt.record_id
            state['idem'][row['idempotency_key']]=(fingerprint,key);state['messages'][row['message_id']]=key
            state['nonces'][row['replay_nonce']]=key;state['rates'][who['internal_user']]=recent+[now.isoformat()]
            state['latest'][key]=key
            self._identity(identity,execution_fence,now)
            return self._publish(state,receipt,'INBOUND_ADMITTED',now)

    def _receipt(self,handle,identity,fence,now):
        self._identity(identity,fence,now)
        try:
            row=_c24_read(handle)
            if handle.kind!='SNS_RECEIPT' or self._state['receipts'].get(handle.record_id)!=(handle.content_hash,handle.payload_json):
                raise ValueError('RECEIPT_INVALID')
        except (ValueError,TypeError):raise ValueError('RECEIPT_INVALID') from None
        if row['identity_hash']!=identity.content_hash:raise ValueError('RECEIPT_AUTHORITY_MISMATCH')
        if now>=datetime.fromisoformat(row['expires_at']):raise ValueError('RECEIPT_EXPIRED')
        return row

    def receipt(self,handle,*,identity,execution_fence,now):
        with self._lock:
            now=self._clock(now);row=self._receipt(handle,identity,execution_fence,now)
            return _value('SNS_RECEIPT',handle.record_id,row)

    def retry(self,handle,*,identity,execution_fence,request_id,failure_code,now):
        _id(request_id);_id(failure_code)
        if failure_code not in ('TRANSIENT_FAILURE','ADAPTER_UNAVAILABLE','PERMANENT_FAILURE'):raise ValueError('FAILURE_CODE_INVALID')
        with self._lock:
            now=self._clock(now);row=self._receipt(handle,identity,execution_fence,now)
            fingerprint=(handle.content_hash,identity.content_hash,failure_code)
            prior=self._state['retry'].get(request_id)
            if prior:
                if tuple(prior[0])!=fingerprint:raise ValueError('IDEMPOTENCY_CONFLICT')
                stored=self._state['receipts'][prior[1]]
                return _value('SNS_RECEIPT',prior[1],json.loads(stored[1]))
            if row['status']=='DLQ':raise ValueError('TERMINAL_RECEIPT')
            root=row.get('root_receipt_ref',handle.record_id)
            if self._state['latest'].get(root)!=handle.record_id:raise ValueError('STALE_RECEIPT')
            if now<datetime.fromisoformat(row['retry_at']):raise ValueError('RETRY_NOT_DUE')
            value=dict(row,attempt=row['attempt']+1,receipt_ref=handle.content_hash,root_receipt_ref=root,
                failure_code=failure_code,retry_at=(now+timedelta(seconds=2**(row['attempt']-1))).isoformat())
            value['status']='DLQ' if value['attempt']>=self._attempts or failure_code=='PERMANENT_FAILURE' else 'RETRY_WAIT'
            receipt=_value('SNS_RECEIPT','retry-'+request_id,value);state=deepcopy(self._state)
            state['retry'][request_id]=(fingerprint,receipt.record_id);state['latest'][root]=receipt.record_id
            self._identity(identity,execution_fence,now)
            return self._publish(state,receipt,value['status'],now)

    def prepare_result(self,handle,*,identity,execution_fence,payload_ref,now):
        payload_ref=_ref(payload_ref)
        with self._lock:
            now=self._clock(now);row=self._receipt(handle,identity,execution_fence,now)
            if row['direction']!='INBOUND' or row['status']!='ACCEPTED_HOST_ONLY':raise ValueError('INBOUND_REQUIRED')
            latest=self._state['latest'].get(handle.record_id)
            if latest!=handle.record_id:
                current=json.loads(self._state['receipts'][latest][1])
                raise ValueError('TERMINAL_RECEIPT' if current['status']=='DLQ' else 'STALE_RECEIPT')
            task=self._team_view()['tasks'][row['trace']['task_id']]
            if task['status']!='COMPLETED' or not task['result_hash']:raise ValueError('VERIFIED_RESULT_REQUIRED')
            value=dict(row,direction='OUTBOUND',command='RESULT',status='PREPARED_NOT_SENT',payload_ref=payload_ref,
                inbound_hash=handle.content_hash,source_result_hash=task['result_hash'],receipt_ref=handle.content_hash)
            receipt=_value('SNS_RECEIPT','out-'+handle.record_id,value)
            old=self._state['receipts'].get(receipt.record_id)
            if old:
                if old!=(receipt.content_hash,receipt.payload_json):raise ValueError('IDEMPOTENCY_CONFLICT')
                return receipt
            state=deepcopy(self._state);self._identity(identity,execution_fence,now)
            return self._publish(state,receipt,'RESULT_PREPARED',now)

    def audit(self,*,offset=0,limit=50):
        _integer(offset,0,512);_integer(limit,1,50)
        with self._lock:
            events=self._state['audit'][offset:offset+limit]
            return _value('SNS_AUDIT','audit',dict(events=events,next_offset=offset+limit if offset+limit<len(self._state['audit']) else None,
                total=len(self._state['audit']),io_count=0))


__all__=['SNSMessageEnvelope','SNSGateway']
