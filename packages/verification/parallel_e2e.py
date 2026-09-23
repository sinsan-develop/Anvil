"""Deterministic fixture benchmark over real in-memory owners, not a runtime.

Bounded local threads execute fixture work; wall units are fixture work estimates,
not provider latency. capture is a trusted host seam, never agent approval.
"""
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from threading import RLock
from concurrent.futures import ThreadPoolExecutor

from packages.git_adapter import models as values
from packages.orchestration.result_envelope import canonical_hash
from packages.queue.dag import DagNode, TaskGraph, DagQueueService
from packages.queue.service import DurableQueue
from packages.leases.service import LeaseService
from packages.budget import BudgetService, BudgetLimit, BudgetRequest
from packages.budget.models import ProviderOutcome
from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository
from packages.git_adapter import GitAdapterHost
from packages.verification.release_gates import ReleaseGateService, ReleaseEvidenceRef


def deny(code):
    raise ValueError(code)


@dataclass(frozen=True, slots=True)
class FixtureRef:
    fixture_id: str
    content_hash: str


def _fixture(raw):
    data = values.plain(raw)
    fields = {'id','version','kind','max_concurrency','budget_limit','min_speedup_permille',
              'max_cost_ratio_permille','tasks','golden_outputs','expected_findings'}
    if type(data) is not dict or set(data) != fields: deny('FIXTURE_SCHEMA_INVALID')
    if not values.identifier(data['id']) or data['kind'] not in ('large_migration','bug_hunt'): deny('FIXTURE_ID_INVALID')
    for key in ('version','max_concurrency','budget_limit','min_speedup_permille','max_cost_ratio_permille'):
        if type(data[key]) is not int or not 1 <= data[key] <= 100000: deny('FIXTURE_BOUND_EXCEEDED')
    if data['max_concurrency'] > 16: deny('FIXTURE_BOUND_EXCEEDED')
    tasks = data['tasks']
    if type(tasks) is not list or not 1 <= len(tasks) <= 128: deny('FIXTURE_BOUND_EXCEEDED')
    ids = set(); row_ids = set()
    for task in tasks:
        if type(task) is not dict or set(task) != {'id','dependencies','paths','subject','operation',
            'independent','write_lease','mandatory','wall_units','forecast_cost','actual_cost','outcome','rows'}: deny('TASK_SCHEMA_INVALID')
        if not values.identifier(task['id']) or task['id'] in ids or not values.identifier(task['subject']): deny('TASK_ID_INVALID')
        ids.add(task['id']); values.paths(task['paths'])
        if not task['paths'] or task['operation'] not in ('read','analyze'): deny('READ_ONLY_REQUIRED')
        if any(type(task[k]) is not bool for k in ('independent','write_lease','mandatory')): deny('TASK_SCHEMA_INVALID')
        if type(task['dependencies']) is not list or any(not values.identifier(v) for v in task['dependencies']): deny('DEPENDENCY_INVALID')
        for key in ('wall_units','forecast_cost','actual_cost'):
            if type(task[key]) is not int or not 0 <= task[key] <= 10000: deny('TASK_BOUND_EXCEEDED')
        if not task['wall_units'] or task['actual_cost'] > task['forecast_cost']: deny('TASK_BOUND_EXCEEDED')
        if task['outcome'] not in ('SUCCEEDED','FAILED','CANCELLED','UNKNOWN'): deny('OUTCOME_INVALID')
        if type(task['rows']) is not list or not 1 <= len(task['rows']) <= 128: deny('TASK_BOUND_EXCEEDED')
        for row in task['rows']:
            if type(row) is not dict or set(row) != {'id','input'} or not values.identifier(row['id']) or row['id'] in row_ids or type(row['input']) is not str: deny('ROW_INVALID')
            row_ids.add(row['id'])
        task['rows'].sort(key=lambda r:r['id']); task['dependencies'].sort(); task['paths'].sort()
    if (type(data['golden_outputs']) is not dict or set(data['golden_outputs']) != row_ids
            or any(type(v) is not str for v in data['golden_outputs'].values())): deny('GOLDEN_INVALID')
    expected = data['expected_findings']
    if type(expected) is not list or any(type(v) is not str for v in expected) or len(set(expected)) != len(expected) or not set(expected) <= row_ids: deny('GOLDEN_INVALID')
    data['tasks'].sort(key=lambda t:t['id']); expected.sort()
    # E04 owns cycle, unknown/self dependency and canonical graph validation.
    _graph(data)
    return data


def _graph(data):
    return TaskGraph(data['id'], 'benchmark', 'fixture-repository', tuple(
        DagNode(t['id'], tuple(t['dependencies']), (), t['independent'], canonical_hash(t)) for t in data['tasks']))


def _transform_task(kind, rows):
    outputs={}; findings=[]
    for row in rows:
        before=row['input']
        after=before.replace('legacyCall(', 'modernCall(') if kind=='large_migration' else ('DEFECT' if before.startswith('BUG:') else 'CLEAN')
        outputs[row['id']]=after
        if (kind=='large_migration' and before!=after) or after=='DEFECT': findings.append(row['id'])
    return outputs,findings


class ParallelBenchmark:
    def __init__(self, leases, *, run_id, execution_fence, write_fence):
        if type(leases) is not LeaseService: deny('LEASE_OWNER_REQUIRED')
        for value in (run_id,execution_fence,write_fence):
            if type(value) is not str or not value or len(value)>256: deny('AUTHORITY_INVALID')
        self._leases=leases; self._run=run_id; self._execution=execution_fence; self._write=write_fence
        self._fixtures={}; self._handles={}; self._results={}; self._requests={}; self._lock=RLock()

    def _guard(self, at):
        now=values.utc(at)
        try: self._leases.require_current(self._run,self._execution,self._write,now)
        except ValueError: deny('STALE_FENCING_TOKEN')
        return now

    def capture(self, fixture):
        data=_fixture(fixture); digest=canonical_hash(data)
        with self._lock:
            prior=self._fixtures.get(data['id'])
            if prior is not None:
                if canonical_hash(prior)!=digest: deny('FIXTURE_REBIND')
                return self._handles[data['id']]
            ref=FixtureRef(data['id'],digest)
            self._fixtures[data['id']]=data; self._handles[data['id']]=ref
            return ref

    def _current(self, ref):
        if type(ref) is not FixtureRef or not values.identifier(ref.fixture_id) or not values.sha(ref.content_hash): deny('FIXTURE_AUTHORITY_INVALID')
        data=self._fixtures.get(ref.fixture_id)
        if self._handles.get(ref.fixture_id) is not ref or data is None or canonical_hash(data)!=ref.content_hash: deny('FIXTURE_AUTHORITY_INVALID')
        return values.plain(data)

    def run(self, request_id, ref, *, mode, at, completion_order=None):
        if not values.identifier(request_id) or type(mode) is not str or mode not in ('SINGLE','PARALLEL'): deny('REQUEST_INVALID')
        order=values.plain(completion_order)
        with self._lock:
            now=self._guard(at); data=self._current(ref); tasks=data['tasks']; ids=[t['id'] for t in tasks]
            if order is None: order=ids
            if type(order) is not list or any(type(i) is not str for i in order) or sorted(order)!=ids: deny('COMPLETION_ORDER_INVALID')
            subject=canonical_hash([ref.content_hash,mode,self._run,self._execution,self._write])
            if request_id in self._results:
                if self._requests[request_id]!=subject: deny('REPLAY_CONFLICT')
                return values.plain(self._results[request_id])
            single=(mode=='SINGLE' or any(t['dependencies'] or t['write_lease'] or not t['independent'] for t in tasks)
                or len({t['subject'].casefold() for t in tasks})!=len(tasks)
                or any(values.overlaps(a,b) for i,t in enumerate(tasks) for u in tasks[i+1:] for a in t['paths'] for b in u['paths']))
            limit=1 if single else data['max_concurrency']
            graph=_graph(data); queue=DurableQueue(); dag=DagQueueService(queue)
            dag.register(graph,now=now,verified_inputs={n.step_id:n.input_hash for n in graph.nodes},max_attempts=1)
            budget=BudgetService(InMemoryInterventionBudgetRepository())
            budget.create_budget(BudgetLimit('budget',Decimal(data['budget_limit']),1000000,limit))
            by_id={t['id']:t for t in tasks}; pending=set(ids); states={}; outputs={}; findings=[]; results=[]
            wall=reserved=actual=0; ledger=[]
            while pending:
                for step in sorted(pending):
                    if any(states.get(dep) in ('FAILED','BLOCKED_DEPENDENCY','BLOCKED_QUOTA','CANCELLED','UNVERIFIED') for dep in by_id[step]['dependencies']):
                        states[step]='BLOCKED_DEPENDENCY'; pending.remove(step)
                        results.append(dict(step_id=step,status=states[step],send_count=0,fixture_outcome=by_id[step]['outcome'],reason='FAILED_DEPENDENCY'))
                ready=[step for step in sorted(pending) if all(states.get(d)=='SUCCEEDED' for d in by_id[step]['dependencies'])][:limit]
                if not ready:
                    if pending: continue
                    break
                claims=queue.claim_selected(tuple((dag.job_id(graph,s),'worker-'+s) for s in ready),now=now,visibility_timeout=timedelta(hours=1))
                claims={queue.get(c.job_id).payload:c for c in claims}; dispatches={}
                for step in ready:
                    task=by_id[step]
                    req=BudgetRequest('reserve-'+step,'budget','benchmark',step,'request-'+step,'synthetic','fixture-program','fixed-v1',Decimal(task['forecast_cost']),1)
                    def sender(r):
                        ledger.append(r.request_id)
                        return ProviderOutcome(r.request_id,r.provider,r.model,'ABORT_PENDING',None,None,'UNKNOWN',None,'fixture',None)
                    dispatches[step]=budget.dispatch(req,admission_hash=subject,sender=sender)
                    reserved+=task['forecast_cost'] if dispatches[step].send_count else 0
                wall+=max((by_id[s]['wall_units'] for s in ready if dispatches[s].send_count),default=0)
                executable=[s for s in ready if dispatches[s].send_count and by_id[s]['outcome']=='SUCCEEDED']
                if single:
                    transformed={s:_transform_task(data['kind'],by_id[s]['rows']) for s in executable}
                else:
                    with ThreadPoolExecutor(max_workers=limit) as pool:
                        futures={s:pool.submit(_transform_task,data['kind'],by_id[s]['rows']) for s in executable}
                        transformed={s:f.result() for s,f in futures.items()}
                for step in sorted(ready,key=order.index):
                    task=by_id[step]; dispatch=dispatches[step]; pending.remove(step)
                    if not dispatch.send_count:
                        status='BLOCKED_QUOTA'; reason='BUDGET_RESERVATION_FAILED'; abort='NOT_SENT'; usage=None
                    else:
                        unknown=task['outcome']=='UNKNOWN'; cancelled=task['outcome']=='CANCELLED'
                        final=budget.finalize(dispatch.request.request_id,ProviderOutcome(dispatch.request.request_id,'synthetic','fixture-program',
                            'CLIENT_DISCONNECTED' if cancelled else 'COMPLETED',None if unknown else Decimal(task['actual_cost']),None if unknown else 1,
                            'UNKNOWN' if unknown else 'PROVIDER_FINAL',None,'fixture',None))
                        usage=None if unknown else task['actual_cost']; actual+=usage or 0
                        abort=final.usage.abort_status; reason=final.status
                        status='UNVERIFIED' if unknown else task['outcome']
                        if status=='SUCCEEDED':
                            step_outputs,step_findings=transformed[step]
                            outputs.update(step_outputs); findings.extend(step_findings)
                    states[step]=status
                    if status=='SUCCEEDED': dag.complete(claims[step],now=now)
                    else: dag.fail(claims[step],now=now,reason=status)
                    results.append(dict(step_id=step,status=status,send_count=dispatch.send_count,fixture_outcome=task['outcome'],reason=reason,abort_status=abort,actual_cost=usage))
            observed=set(findings); golden=set(data['expected_findings']); snap=budget.snapshot('budget')
            complete=sum(s=='SUCCEEDED' for s in states.values()); quality=(outputs==data['golden_outputs'] and observed==golden and complete==len(tasks))
            result=dict(fixture_hash=ref.content_hash,graph_hash=graph.content_hash,golden_hash=canonical_hash(data['golden_outputs']),
                execution_fence=self._execution,write_fence=self._write,budget_limit=data['budget_limit'],subject_hash=subject,
                target_hash=canonical_hash(data['golden_outputs']),delivered_hash=canonical_hash(outputs),
                boundary='SYNTHETIC_LOCAL_ONLY',external_side_effects=0,effective_mode='SINGLE' if single else 'PARALLEL',
                status='SUCCEEDED' if complete==len(tasks) else 'FINISHED_WITH_FAILURES',quality_pass=quality,
                completed=complete,failed=sum(s in ('FAILED','CANCELLED','UNVERIFIED') for s in states.values()),
                blocked=sum(s.startswith('BLOCKED') for s in states.values()),wall_units=wall,reserved_total=reserved,actual_cost=actual,
                retained_exposure=str(snap.reserved_cost),new_action_allowed=snap.new_action_allowed,send_count=len(ledger),
                precision=[len(observed&golden),len(observed)],recall=[len(observed&golden),len(golden)],
                outputs=outputs,findings=sorted(findings),results=sorted(results,key=lambda r:r['step_id']))
            result['content_hash']=canonical_hash(result)
            stored=values.plain(result); returned=values.plain(result); self._guard(at)
            self._results[request_id]=stored; self._requests[request_id]=subject
            return returned

    def compare(self, single_id, parallel_id):
        if not values.identifier(single_id) or not values.identifier(parallel_id): deny('REQUEST_INVALID')
        with self._lock:
            a=self._results.get(single_id); b=self._results.get(parallel_id)
            if a is None or b is None or a['fixture_hash']!=b['fixture_hash']: deny('BENCHMARK_SUBJECT_MISMATCH')
            fixture=next(v for v in self._fixtures.values() if canonical_hash(v)==a['fixture_hash'])
            eligible=(a['quality_pass'] and b['quality_pass'] and a['delivered_hash']==b['delivered_hash']
                and b['effective_mode']=='PARALLEL' and b['wall_units']*fixture['min_speedup_permille']<=a['wall_units']*1000
                and b['actual_cost']*1000<=a['actual_cost']*fixture['max_cost_ratio_permille'])
            return dict(recommendation='ELIGIBLE_FOR_LIMITED_PARALLEL' if eligible else 'DO_NOT_ENABLE_PARALLEL',
                automatic_activation=False,main_acceptance=False,single_hash=a['content_hash'],parallel_hash=b['content_hash'])

    def publication_guard(self, boundary, *, at):
        """Fixture publication gate only; never invoke Tool/worker/filesystem."""
        if type(boundary) is not str or boundary not in ('QUEUE','STEP','TOOL','COMMIT'): deny('BOUNDARY_INVALID')
        self._guard(at)
        return dict(boundary=boundary,status='ADMITTED_NOT_EXECUTED',external_side_effects=0)

    def admit_git(self, request_id, ref, *, release, bundle, approval, git, grant, git_request, at):
        """Consume existing E09/E10 authority, never mint approval from benchmark.

        E10 is itself fake-driver-only. Real cross-owner durable transactions and
        runtime Tool/commit dispatch remain NOT_INTEGRATED.
        """
        if type(release) is not ReleaseGateService or type(git) is not GitAdapterHost: deny('EXACT_OWNER_REQUIRED')
        if type(bundle) is not ReleaseEvidenceRef or type(approval) is not ReleaseEvidenceRef: deny('HOST_EVIDENCE_REQUIRED')
        if not values.identifier(request_id): deny('REQUEST_INVALID')
        data=values.request(git_request)
        with self._lock:
            self._guard(at); self._current(ref)
            result=self._results.get(request_id)
            if result is None or result['fixture_hash']!=ref.content_hash or not result['quality_pass']: deny('BENCHMARK_NOT_VALIDATED')
            benchmark=values.plain(result)
        subject=values.plain(release.project(bundle))['subject']
        target=benchmark['target_hash']
        if (benchmark['delivered_hash']!=target or subject['target_hash']!=target or subject['delivered_artifact_hash']!=target
                or data['target_hash']!=target or data['delivered_hash']!=target or subject['git_head']!=data['source_commit']): deny('RELEASE_SUBJECT_MISMATCH')
        release_receipt=values.plain(release.admit(bundle,approval,operation='APPLY',at=at))
        self.publication_guard('COMMIT',at=at)
        git_receipt=git.execute(grant,data,at=at,execution_fence=self._execution,write_fence=self._write)
        self._guard(at)
        return values.plain(dict(benchmark_hash=benchmark['content_hash'],release=release_receipt,git=git_receipt,
            main_acceptance=False,external_side_effects=0,boundary='SYNTHETIC_LOCAL_ONLY'))
