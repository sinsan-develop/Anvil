"""E05 host-only bounded read/analyze scheduling; no worker/provider execution.

The host injects current LeaseService, BudgetService and the reference B09 queue.
Registration is a trusted control-plane boundary, never a payload/API authority.
Existing budget reservations are checked, not minted/reconciled (E08 owner).
Only immutable receipts for Main synthesis are returned; no acceptance transition.
"""
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timedelta
from threading import Condition,RLock,get_ident
from weakref import WeakKeyDictionary


def role_team_progress(state, bindings):
    """Pure C23 aggregation: no queue, reservation or worker operation."""
    rows = state['tasks']
    ready = sorted(key for key, row in rows.items() if row['status'] == 'PENDING' and
        all(rows[dep]['status'] == 'COMPLETED' for dep in row['dependency_ids'] +
            ([row['parent_task_id']] if row['parent_task_id'] else [])))
    statuses = [row['status'] for row in rows.values()]
    if state['cancelled']:
        status = 'CANCELLED'
        ready = []
    elif any(v not in ('PENDING', 'CLAIMED', 'COMPLETED') for v in statuses):
        status = 'REVIEW_REQUIRED'
    elif statuses and all(v == 'COMPLETED' for v in statuses):
        status = 'COLLECTED_FOR_MAIN'
    else:
        status = 'ACTIVE'
    exposure = sum(row['reserved_exposure'] for row in rows.values())
    return dict(status=status, ready=ready, forecast_exposure=exposure)

import json

from packages.orchestration.delegation import DelegationPacket,PermissionSnapshot,DataEgressProfile,validate_packet
from packages.orchestration.result_envelope import ResultEnvelope,validate_result
from packages.leases.service import LeaseService
from packages.budget.service import BudgetService
from packages.budget.models import BudgetReservation,ReservationStatus
from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository
from packages.queue.service import DurableQueue,reject_callback_reentry,_outside_callback
from packages.queue.models import QueueClaim,QueueStatus
from packages.queue.dag import DagQueueService,snapshot_graph,graph_job_id
from .collaboration import canonical_hash

# E05 consumption lineage only, shared across schedulers/queues for one budget
# owner. No reservations or budget policy are created here. Protected by the
# existing repository lock; the global lock only installs a repository entry.
_CONSUMPTION = WeakKeyDictionary()
_CONSUMPTION_LOCK = RLock()


class ConcurrencyError(ValueError):
    pass


@dataclass(frozen=True,slots=True)
class AnalysisTask:
    packet: DelegationPacket
    worker_id: str
    context_id: str
    context_hash: str
    operation: str
    reservation_id: str
    request_id: str
    mutable_context: bool = False


def _text(value):
    if type(value) is not str or not value or value != value.strip() or len(value.encode('utf-8'))>256:
        raise ConcurrencyError('IDENTITY_INVALID')


def _overlap(left,right):
    def covers(a,b):
        a=a.casefold();b=b.casefold()
        return a==b or a.endswith('/**') and (b==a[:-3] or b.startswith(a[:-2]))
    return any(covers(a,b) or covers(b,a) for a in left for b in right)


class ConcurrencyScheduler:
    def __init__(self,queue,leases,budgets,*,parent_permission,parent_egress,baseline_hash,
                 run_id,main_actor,max_concurrency=2):
        if type(queue) is not DurableQueue or type(leases) is not LeaseService or type(budgets) is not BudgetService:
            raise ConcurrencyError('OWNER_REQUIRED')
        if type(max_concurrency) is not int or not 1<=max_concurrency<=16:raise ConcurrencyError('FANOUT_INVALID')
        if type(budgets._repository) is not InMemoryInterventionBudgetRepository:
            raise ConcurrencyError('ATOMIC_BUDGET_ADAPTER_NOT_INTEGRATED')
        _text(run_id);_text(main_actor)
        self._queue=queue;self._dag=DagQueueService(queue);self._leases=leases;self._budgets=budgets
        self._parent=PermissionSnapshot.from_dict(parent_permission.to_dict())
        self._egress=DataEgressProfile.from_dict(parent_egress.to_dict())
        self._baseline=baseline_hash;self._run=run_id;self._actor=main_actor;self._limit=max_concurrency
        self._batches={};self._dispatches={};self._results={};self._cancelled=set();self._lock=RLock()
        self._inflight={};self._condition=Condition(self._lock)
        self._budget_owner=budgets._repository;self._claim_owner=object()
        with _CONSUMPTION_LOCK:
            if self._budget_owner not in _CONSUMPTION:_CONSUMPTION[self._budget_owner]={}
            self._consumption=_CONSUMPTION[self._budget_owner]

    def _budget_fingerprint(self):
        """No callbacks/I/O: version-equivalent content snapshot under owner lock."""
        r=self._budget_owner
        return canonical_hash({
            'reservations':{k:{f:str(v) for f,v in asdict(x).items()} for k,x in r._reservations.items()},
            'limits':{k:{f:str(v) for f,v in asdict(x).items()} for k,x in r._limits.items()},
            'allowed':dict(r._allowed),
        })

    def _consumption_keys(self,task):
        return (('reservation',task.reservation_id),('request',task.request_id))

    def _begin(self,key):
        try:reject_callback_reentry()
        except Exception as exc:raise ConcurrencyError('DISPATCH_REENTRANCY') from exc
        with self._condition:
            while key in self._inflight:
                if self._inflight[key]==get_ident():raise ConcurrencyError('DISPATCH_REENTRANCY')
                self._condition.wait()
            self._inflight[key]=get_ident()

    def _end(self,key):
        with self._condition:
            self._inflight.pop(key,None);self._condition.notify_all()

    def _guard(self,now,token):
        if type(now) is not datetime or now.tzinfo is None:raise ConcurrencyError('TIME_INVALID')
        current=self._leases.active_worker(self._run)
        if (current is None or current.worker_id!=self._actor or current.execution_fencing_token!=token
                or now>=current.expires_at):raise ConcurrencyError('STALE_FENCING_TOKEN')

    def _reservation(self,task,expected=None,*,public=True):
        try:
            if public:
                r=_outside_callback(lambda:self._budgets.reservation(task.reservation_id))
                snap=_outside_callback(lambda:self._budgets.snapshot(task.packet.budget_ref))
            with self._budget_owner._lock:
                canonical=self._budget_owner._reservations.get(task.reservation_id)
                canonical_snapshot=InMemoryInterventionBudgetRepository._snapshot_unlocked(self._budget_owner,task.packet.budget_ref)
                if not public:r=canonical;snap=canonical_snapshot
                if (type(r) is not BudgetReservation or r.status is not ReservationStatus.RESERVED or not snap.new_action_allowed
                        or r!=canonical or snap!=canonical_snapshot
                        or (r.budget_id,r.run_id,r.step_id,r.request_id)!=(task.packet.budget_ref,self._run,task.packet.step_id,task.request_id)
                        or r.reserved_tokens<0 or r.reserved_cost<0
                        or snap.reserved_tokens+snap.consumed_tokens>snap.hard_token_limit
                        or snap.reserved_cost+snap.consumed_cost>snap.hard_cost_limit):raise ValueError()
                signature=canonical_hash({k:str(v) for k,v in asdict(r).items()})
                if expected is not None and signature!=expected:raise ValueError()
                return signature
        except Exception as exc:raise ConcurrencyError('BUDGET_RECEIPT_INVALID') from exc

    def _task(self,task):
        if type(task) is not AnalysisTask or type(task.packet) is not DelegationPacket:raise ConcurrencyError('PACKET_REQUIRED')
        for value in (task.worker_id,task.context_id,task.context_hash,task.reservation_id,task.request_id):_text(value)
        p=DelegationPacket.from_dict(task.packet.to_dict())
        if len(p.to_json().encode())>16384:raise ConcurrencyError('CONTEXT_LIMIT')
        check=validate_packet(p,baseline_hash=self._baseline,context_snapshot_hash=task.context_hash,
                              parent_permission_snapshot=self._parent,parent_egress_profile=self._egress)
        if (not check.valid or p.parent_run_id!=self._run or p.parent_agent_id!=self._actor
                or task.worker_id==self._actor or task.operation not in ('read','analyze')
                or task.operation not in p.permission_snapshot.allowed_actions
                or not set(p.permission_snapshot.allowed_tools)&{'repo_read','repo_analyze'}
                or task.operation in p.prohibited_actions or p.expected_result_schema!='subagent_result/v1'
                or type(task.mutable_context) is not bool):raise ConcurrencyError('PACKET_AUTHORITY_INVALID')
        if _overlap(p.allowed_paths,p.permission_snapshot.protected_paths+p.permission_snapshot.prohibited_paths):
            raise ConcurrencyError('PATH_SCOPE_DENIED')
        return replace(task,packet=p)

    def register(self,batch_id,graph,tasks,*,now,execution_token):
        """Trusted host capture; packets supplied to dispatch cannot self-register."""
        _text(batch_id);key=('register',batch_id);self._begin(key)
        try:
            if type(tasks) is not tuple or not 1<=len(tasks)<=16:raise ConcurrencyError('FANOUT_INVALID')
            checked=tuple(self._task(t) for t in tasks)
            with self._budget_owner._lock:before=self._budget_fingerprint()
            for task in checked:self._reservation(task)
            return self._register_locked(batch_id,graph,checked,now=now,execution_token=execution_token,budget_before=before)
        finally:self._end(key)

    def _register_locked(self,batch_id,graph,tasks,*,now,execution_token,budget_before):
        with self._lock,self._leases._lock,self._budget_owner._lock,self._queue._lock:
            self._guard(now,execution_token);_text(batch_id)
            if self._budget_fingerprint()!=budget_before:raise ConcurrencyError('BUDGET_OWNER_DRIFT')
            try:
                if type(tasks) is not tuple or not 1<=len(tasks)<=16:raise ConcurrencyError('FANOUT_INVALID')
                graph=snapshot_graph(graph);checked=tuple(sorted((self._task(t) for t in tasks),key=lambda t:t.packet.step_id))
                if (graph.run_id!=self._run or len({t.packet.step_id for t in checked})!=len(checked)
                        or {n.step_id:n.input_hash for n in graph.nodes}!={t.packet.step_id:t.packet.packet_hash for t in checked}
                        or len({t.reservation_id for t in checked})!=len(checked)
                        or len({t.request_id for t in checked})!=len(checked)
                        or len({t.worker_id for t in checked})!=len(checked)
                        or sum(len(t.packet.to_json().encode()) for t in checked)>65536):raise ConcurrencyError('BATCH_BINDING_INVALID')
                reservations=tuple(self._reservation(t,public=False) for t in checked)
                single=(self._limit==1 or graph.execution_mode=='SINGLE_WORKER'
                    or len({t.context_id for t in checked})!=len(checked)
                    or len({t.context_hash for t in checked})!=len(checked)
                    or any(t.mutable_context or set(t.packet.permission_snapshot.allowed_actions)-{'read','analyze'} for t in checked)
                    or any(_overlap(a.packet.allowed_paths,b.packet.allowed_paths) for i,a in enumerate(checked) for b in checked[i+1:]))
                digest=canonical_hash([graph.content_hash,[(t.packet.to_dict(),t.worker_id,t.context_id,t.context_hash,t.operation,t.mutable_context,t.reservation_id,t.request_id) for t in checked],reservations,single,self._limit])
                if batch_id in self._batches:
                    if self._batches[batch_id]['hash']!=digest:raise ConcurrencyError('BATCH_REBIND')
                    return digest
                if any(b['graph'].graph_id==graph.graph_id for b in self._batches.values()):raise ConcurrencyError('GRAPH_ALREADY_BOUND')
                self._guard(now,execution_token)
                self._dag.register(graph,now=now,verified_inputs={t.packet.step_id:t.packet.packet_hash for t in checked},max_attempts=1)
                self._queue.bind_claim_policy(tuple(graph_job_id(graph,t.packet.step_id) for t in checked),self._claim_owner)
                self._batches[batch_id]={'graph':graph,'tasks':checked,'reservations':reservations,'hash':digest,'single':single,'created_at':now}
                return digest
            except ConcurrencyError:raise
            except Exception as exc:raise ConcurrencyError('BATCH_INVALID') from exc

    def dispatch(self,batch_id,*,request_id,now,execution_token):
        _text(batch_id);_text(request_id);operation=('dispatch',batch_id);self._begin(operation)
        try:
            prepared=self._select_locked(batch_id,request_id=request_id,now=now,execution_token=execution_token)
            if 'replay' in prepared:return prepared['replay']
            b=prepared['batch'];ready=prepared['ready'];bindings=prepared['bindings']
            # All injected reads/token callbacks happen without owner locks.
            for task,expected in zip(b['tasks'],b['reservations']):self._reservation(task,expected)
            try:tokens=self._queue.prepare_claim_tokens(len(ready))
            except Exception as exc:raise ConcurrencyError('BATCH_CLAIM_REJECTED') from exc
            for task,expected in zip(b['tasks'],b['reservations']):self._reservation(task,expected)
            with self._lock,self._leases._lock,self._budget_owner._lock,self._queue._lock:
                self._guard(now,execution_token)
                if batch_id in self._cancelled:raise ConcurrencyError('BATCH_CANCELLED')
                if self._budget_fingerprint()!=prepared['budget_stamp']:raise ConcurrencyError('BUDGET_OWNER_DRIFT')
                for task,expected in zip(b['tasks'],b['reservations']):self._reservation(task,expected,public=False)
                if any(k in self._consumption for k in bindings):raise ConcurrencyError('RESERVATION_ALREADY_DISPATCHED')
                try:
                    claimed=self._queue.claim_selected(ready,now=now,visibility_timeout=timedelta(minutes=1),
                        owner=self._claim_owner,prepared_tokens=tokens,expected_stamp=prepared['queue_stamp'])
                except Exception as exc:raise ConcurrencyError('BATCH_CLAIM_REJECTED') from exc
                by_job={c.job_id:c for c in claimed};claims=tuple(by_job[j] for j,_ in ready)
                self._consumption.update(bindings);self._dispatches[(batch_id,request_id)]=claims
                return tuple(replace(c) for c in claims)
        finally:self._end(operation)

    def _select_locked(self,batch_id,*,request_id,now,execution_token):
        # Same owner lock used by reserve/reconcile/snapshot spans the complete
        # callback-free publication phase, not arbitrary preparation callbacks.
        with self._lock,self._leases._lock,self._budget_owner._lock,self._queue._lock:
            self._guard(now,execution_token);_text(request_id);b=self._batch(batch_id)
            if now<b['created_at']:raise ConcurrencyError('DISPATCH_TIME_INVALID')
            if batch_id in self._cancelled:raise ConcurrencyError('BATCH_CANCELLED')
            key=(batch_id,request_id)
            if key in self._dispatches:
                previous=self._dispatches[key]
                for c in previous:self._claim(b,c,now,allow_completed=True)
                return {'replay':tuple(replace(c) for c in previous)}
            budget_before=self._budget_fingerprint()
            for t,h in zip(b['tasks'],b['reservations']):self._task(t);self._reservation(t,h,public=False)
            graph=b['graph'];limit=1 if b['single'] else self._limit
            active=sum(j.status is QueueStatus.CLAIMED for j in self._queue._jobs.values())
            ready=[]
            for task in b['tasks']:
                j=self._queue.get(graph_job_id(graph,task.packet.step_id))
                if (j.status is QueueStatus.PENDING
                        and all(self._queue.get(d).status is QueueStatus.SUCCEEDED
                                and self._results.get((batch_id,d),{}).get('status')=='COMPLETED' for d in j.dependency_ids)):
                    if any(set(j.conflict_keys)&set(self._queue.get(x[0]).conflict_keys) for x in ready):continue
                    if any(other.status is QueueStatus.CLAIMED and set(j.conflict_keys)&set(other.conflict_keys) for other in self._queue._jobs.values()):continue
                    ready.append((j.job_id,b['tasks'][0].worker_id if b['single'] else task.worker_id))
            ready=tuple(ready[:max(0,limit-active)])
            if not ready:return {'replay':()}
            selected=[t for t in b['tasks'] if graph_job_id(graph,t.packet.step_id) in {j for j,_ in ready}]
            bindings={k:(batch_id,b['hash'],graph.content_hash,t.packet.packet_hash,t.operation,request_id)
                      for t in selected for k in self._consumption_keys(t)}
            if any(k in self._consumption for k in bindings):raise ConcurrencyError('RESERVATION_ALREADY_DISPATCHED')
            return {'batch':b,'ready':ready,'bindings':bindings,'budget_stamp':budget_before,'queue_stamp':self._queue.state_stamp()}

    def _batch(self,batch_id):
        if type(batch_id) is not str or batch_id not in self._batches:raise ConcurrencyError('BATCH_NOT_REGISTERED')
        return self._batches[batch_id]

    def _claim(self,b,claim,now,allow_completed=False):
        if type(claim) is not QueueClaim:raise ConcurrencyError('CLAIM_INVALID')
        candidates=[c for (batch,_),claims in self._dispatches.items() if self._batches[batch] is b for c in claims]
        if claim not in candidates:raise ConcurrencyError('CLAIM_AUTHORITY_INVALID')
        j=self._queue.get(claim.job_id)
        if j.lease_epoch!=claim.lease_epoch or now>=claim.lease_expires_at:raise ConcurrencyError('STALE_QUEUE_FENCE')
        if j.status is QueueStatus.SUCCEEDED and allow_completed:return
        if j.status is not QueueStatus.CLAIMED or j.execution_fencing_token!=claim.execution_fencing_token:raise ConcurrencyError('STALE_QUEUE_FENCE')

    def collect(self,batch_id,claim,result,*,now,execution_token):
        with self._lock,self._leases._lock,self._queue._lock:
            self._guard(now,execution_token);b=self._batch(batch_id)
            if batch_id in self._cancelled:raise ConcurrencyError('BATCH_CANCELLED')
            try:
                if type(result) is not ResultEnvelope:raise ConcurrencyError('RESULT_INVALID')
                result=ResultEnvelope.from_dict(result.to_dict());check=validate_result(result)
                self._claim(b,claim,now,allow_completed=True)
                if now<claim.lease_expires_at-timedelta(minutes=1):raise ConcurrencyError('RESULT_TIME_INVALID')
                task=next(t for t in b['tasks'] if graph_job_id(b['graph'],t.packet.step_id)==claim.job_id)
                if (not check.valid or result.target_hash!=self._baseline or result.delegation_id!=task.packet.delegation_id
                        or result.step_lineage_id!=task.packet.step_id or result.attempt_number!=claim.lease_epoch
                        or result.attempt_id!=str(claim.lease_epoch) or result.changed_paths or not result.evidence_refs
                        or result.status.value=='COMPLETED' and any(test.status!='PASS' or test.exit_code!=0 for test in result.tests)
                        or any(a not in ('read','analyze','inspect') for a in result.actions_taken)
                        or len(result.to_json().encode())>16384 or len(result.summary.encode())>2048):raise ConcurrencyError('RESULT_BINDING_INVALID')
                key=(batch_id,claim.job_id);old=self._results.get(key)
                if old:
                    if old['result_hash']!=result.canonical_hash:raise ConcurrencyError('RESULT_REBIND')
                    return old['result_hash']
                row={'step_id':task.packet.step_id,'worker_id':claim.worker_id,'context_id':task.context_id,
                     'context_hash':task.context_hash,'packet_hash':task.packet.packet_hash,'target_hash':result.target_hash,
                     'result_hash':result.canonical_hash,'status':result.status.value,'summary':result.summary,
                     'evidence_refs':[e.to_dict() for e in result.evidence_refs]}
                # Sixteen bounded rows plus envelope metadata stay below 64 KiB.
                if len(json.dumps(row,ensure_ascii=False).encode('utf-8'))>3072:
                    raise ConcurrencyError('RESULT_PROJECTION_LIMIT')
                self._guard(now,execution_token)
                # Queue success means delivery finished, not that an analysis is PASS.
                self._dag.complete(claim,now=now)
                self._results[key]=row
                return result.canonical_hash
            except ConcurrencyError:raise
            except Exception as exc:raise ConcurrencyError('RESULT_INVALID') from exc

    def cancel(self,batch_id,*,now,execution_token):
        with self._lock,self._leases._lock:
            self._guard(now,execution_token);self._batch(batch_id);self._cancelled.add(batch_id)

    def project(self,batch_id):
        with self._lock:
            b=self._batch(batch_id);rows=[]
            for t in b['tasks']:
                row=self._results.get((batch_id,graph_job_id(b['graph'],t.packet.step_id)))
                rows.append(row or {'step_id':t.packet.step_id,'packet_hash':t.packet.packet_hash,'status':'CANCELLED' if batch_id in self._cancelled else 'PENDING'})
            statuses=[r['status'] for r in rows]
            status=('CANCELLED' if batch_id in self._cancelled else 'REVIEW_REQUIRED' if any(s not in ('PENDING','COMPLETED') for s in statuses)
                    else 'COLLECTED_FOR_MAIN' if all(s=='COMPLETED' for s in statuses) else 'PENDING')
            value={'schema':'analysis_synthesis_input/v1','batch_id':batch_id,'batch_hash':b['hash'],'baseline_hash':self._baseline,
                   'mode':'SINGLE_WORKER' if b['single'] else 'LIMITED_PARALLEL','status':status,'results':rows,
                   'automatic_acceptance':False,'provider_execution':'NOT_EXECUTED','db_batch_integration':'NOT_INTEGRATED'}
            return json.loads(json.dumps(value))
