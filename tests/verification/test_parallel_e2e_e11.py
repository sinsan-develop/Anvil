"""E11 deterministic local fixtures, never real Provider/Git/DB execution."""
import importlib
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dataclasses import replace
import random
from itertools import count
import pytest
from packages.leases.service import LeaseService
from packages.orchestration.result_envelope import canonical_hash

NOW = datetime(2026, 9, 18, tzinfo=timezone.utc)


def fixture(name='large_migration'):
    return json.loads((Path(__file__).parents[1]/'fixtures/e11'/f'{name}.json').read_text())


def host():
    module = importlib.import_module('packages.verification.parallel_e2e')
    tokens=count(); leases = LeaseService(token_factory=lambda:'token-'+str(next(tokens)))
    worker = leases.issue_worker('run', 'main', NOW, timedelta(hours=1))
    write = leases.issue_write(worker, 'benchmark', NOW, timedelta(hours=1))
    return module.ParallelBenchmark(leases, run_id='run', execution_fence=worker.execution_fencing_token,
        write_fence=write.write_fencing_token), leases, worker, write


@pytest.mark.parametrize('name,rows,findings,single_wall,parallel_wall', [
    ('large_migration', 1024, 1024, 64, 16), ('bug_hunt', 512, 128, 48, 12)])
def test_av_agt_034_same_golden_single_parallel(name, rows, findings, single_wall, parallel_wall):
    h, _, _, _ = host(); data = fixture(name); ref = h.capture(data)
    single = h.run('single', ref, mode='SINGLE', at=NOW.isoformat())
    parallel = h.run('parallel', ref, mode='PARALLEL', at=NOW.isoformat())
    assert single['completed'] == parallel['completed'] == 16
    assert len(single['outputs']) == len(parallel['outputs']) == rows
    assert len(single['findings']) == len(parallel['findings']) == findings
    assert single['wall_units'] == single_wall and parallel['wall_units'] == parallel_wall
    assert single['actual_cost'] == parallel['actual_cost'] == 16
    assert single['reserved_total'] == parallel['reserved_total'] == 32
    assert single['delivered_hash'] == parallel['delivered_hash'] == canonical_hash(data['golden_outputs'])
    assert single['quality_pass'] and parallel['quality_pass']
    assert h.compare('single', 'parallel')['recommendation'] == 'ELIGIBLE_FOR_LIMITED_PARALLEL'
    assert parallel['boundary'] == 'SYNTHETIC_LOCAL_ONLY' and parallel['external_side_effects'] == 0


def test_shuffled_task_and_completion_order_is_deterministic():
    data = fixture('bug_hunt'); h, _, _, _ = host(); ref = h.capture(data)
    order = [t['id'] for t in data['tasks']]; random.Random(7).shuffle(order)
    first = h.run('first', ref, mode='PARALLEL', at=NOW.isoformat(), completion_order=order)
    data['tasks'].reverse(); other, _, _, _ = host(); second_ref = other.capture(data)
    second = other.run('first', second_ref, mode='PARALLEL', at=NOW.isoformat(), completion_order=list(reversed(order)))
    assert ref.content_hash == second_ref.content_hash
    assert first == second


@pytest.mark.parametrize('change', ['overlap', 'subject', 'dependency', 'write', 'nonindependent'])
def test_non_independent_work_collapses_to_single(change):
    data = fixture(); a, b = data['tasks'][:2]
    if change == 'overlap': b['paths'] = ['SRC/TASK-00.PY']
    elif change == 'subject': b['subject'] = a['subject']
    elif change == 'dependency': b['dependencies'] = [a['id']]
    elif change == 'write': b['write_lease'] = True
    else: b['independent'] = False
    h, _, _, _ = host(); result = h.run('one', h.capture(data), mode='PARALLEL', at=NOW.isoformat())
    assert result['effective_mode'] == 'SINGLE' and result['wall_units'] == 64


def test_av_flow_023_failure_blocks_transitive_only_and_no_false_success():
    data = fixture(); data['tasks'][0]['outcome'] = 'FAILED'
    data['tasks'][1]['dependencies'] = ['task-00']; data['tasks'][2]['dependencies'] = ['task-01']
    h, _, _, _ = host(); ref = h.capture(data)
    result = h.run('failure', ref, mode='PARALLEL', at=NOW.isoformat())
    states = {r['step_id']: r['status'] for r in result['results']}
    assert states['task-00'] == 'FAILED'
    assert states['task-01'] == states['task-02'] == 'BLOCKED_DEPENDENCY'
    assert states['task-03'] == 'SUCCEEDED'
    assert result['status'] == 'FINISHED_WITH_FAILURES' and not result['quality_pass']
    assert result['failed'] == 1 and result['blocked'] == 2 and result['completed'] == 13


def test_stale_fence_and_hostile_alias_replay_bounds_fail_closed():
    h, leases, worker, write = host(); data = fixture(); ref = h.capture(data)
    result = h.run('one', ref, mode='SINGLE', at=NOW.isoformat()); result['outputs'].clear()
    assert h.run('one', ref, mode='SINGLE', at=NOW.isoformat())['outputs']
    with pytest.raises(ValueError): h.run('one', ref, mode='PARALLEL', at=NOW.isoformat())
    with pytest.raises(ValueError): h.run('foreign', replace(ref), mode='SINGLE', at=NOW.isoformat())
    leases.revoke_run('run')
    with pytest.raises(ValueError, match='STALE_FENCING_TOKEN'): h.run('one', ref, mode='SINGLE', at=NOW.isoformat())


def test_hostile_fixture_is_rejected_without_callback():
    h, _, _, _ = host(); calls = []
    class Bad:
        def __deepcopy__(self, memo): calls.append(1)
        def __iter__(self): calls.append(2); return iter([])
    data = fixture(); data['tasks'] = Bad()
    with pytest.raises(ValueError): h.capture(data)
    assert calls == []


def trust_chain():
    from packages.git_adapter import GitAdapterHost, FakeGitDriver
    spec=importlib.util.spec_from_file_location('e11_release_fixture',Path(__file__).with_name('test_gates_e09.py'))
    e09=importlib.util.module_from_spec(spec); spec.loader.exec_module(e09)
    data=fixture('bug_hunt'); target=canonical_hash(data['golden_outputs'])
    e09.NOW=NOW; e09.SUBJECT={k:(target if v==e09.H else v) for k,v in e09.SUBJECT.items()}; e09.H=target
    release, _, bundle, tester, human, decision=e09.release_fixture()
    approval=release.approve_action('git',bundle,decision,human,operation='APPLY',at=NOW.isoformat(),expires_at=(NOW+timedelta(minutes=20)).isoformat())
    h, leases, worker, write=host(); ref=h.capture(data); h.run('ready',ref,mode='PARALLEL',at=NOW.isoformat())
    driver=FakeGitDriver(); git=GitAdapterHost(driver,release_service=release)
    A,B,C='a'*40,'b'*40,'c'*40
    git.register_repository(dict(repository_id='repo',workspace_id='workspace',physical_identity=target,head=B,branch='codex/target',
        refs={'codex/target':B,'codex/source':A},tracked={},untracked={},index={},owned_changes={},user_paths=[],protected_paths=['.git'],
        protected_branches=['main'],remote_id='development',revision=1,execution_fence=worker.execution_fencing_token,
        write_fence=write.write_fencing_token,merge_conflicts=[],related_history=True))
    req=dict(request_id='merge',operation='MERGE',repository_id='repo',workspace_id='workspace',baseline=B,source_ref='codex/source',source_commit=A,
        target_ref='codex/target',target_commit=B,target_hash=target,delivered_hash=target,allowed_paths=['src/a.py'],changes={},diff_hash=canonical_hash({}),
        expected_commit=C,expected_tree=C,message='fixture contract',remote_id='development',
        metadata=dict(purpose='benchmark',impact='synthetic',validation='local',unverified='runtime',rollback='baseline'))
    grant=git.authorize('grant',req,actor_id='main',authenticated=True,issued_at=NOW.isoformat(),expires_at=(NOW+timedelta(minutes=20)).isoformat(),release_bundle=bundle,release_approval=approval)
    args=dict(release=release,bundle=bundle,approval=approval,git=git,grant=grant,git_request=req,at=NOW.isoformat())
    return h, ref, args, driver, e09, tester


def test_real_e09_e10_chain_is_consumed_without_execution_or_automatic_acceptance():
    h,ref,args,driver,_,_=trust_chain()
    result=h.admit_git('ready',ref,**args)
    assert result['git']['mode']=='FAKE_DRIVER_CONTRACT' and result['external_side_effects']==0
    assert result['benchmark_hash']==h.run('ready',ref,mode='PARALLEL',at=NOW.isoformat())['content_hash']
    assert result['main_acceptance'] is False and len(driver.calls)==1
    assert h.admit_git('ready',ref,**args)==result and len(driver.calls)==1


@pytest.mark.parametrize('failure',['target','delivered','defect','validation','forged','revoked'])
def test_trust_chain_mismatch_and_incomplete_validation_send_zero(failure):
    h,ref,args,driver,e09,tester=trust_chain()
    if failure in ('target','delivered'):
        args['git_request'][failure+'_hash']='sha256:'+'b'*64
    elif failure=='defect': args['release'].record_defect(args['bundle'],tester,e09.defect(),at=NOW.isoformat())
    elif failure=='validation':
        pv=e09.product_validation(); pv['verdict']='BLOCKED'
        args['release'].record_product_validation(args['bundle'],tester,pv,at=NOW.isoformat())
    elif failure=='forged': args['approval']=replace(args['approval'])
    else: args['release'].revoke_action_approval(args['approval'])
    with pytest.raises(ValueError): h.admit_git('ready',ref,**args)
    assert driver.calls==[]


def test_fixture_publication_guard_blocks_every_stale_boundary_after_takeover():
    h, leases, worker, write=host(); future=NOW+timedelta(hours=1,seconds=1)
    replacement=leases.take_over_expired('run','replacement',future,timedelta(hours=1))
    new_write=leases.issue_write(replacement,'benchmark',future,timedelta(hours=1))
    for boundary in ('QUEUE','STEP','TOOL','COMMIT'):
        with pytest.raises(ValueError,match='STALE_FENCING_TOKEN'): h.publication_guard(boundary,at=future.isoformat())
    assert leases.active_worker('run')==replacement and new_write.write_fencing_token!=write.write_fencing_token


def test_fix_conflict_100_real_in_memory_owner_races_have_no_double_acquire():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from packages.leases.service import LeaseError
    wins=[]
    for i in range(100):
        leases=LeaseService(); worker=leases.issue_worker('run','owner',NOW,timedelta(hours=1)); barrier=Barrier(2)
        def attempt(_):
            barrier.wait(timeout=5)
            try: return leases.issue_write(worker,'FIX-CONFLICT',NOW,timedelta(minutes=1))
            except LeaseError:return None
        with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(attempt,range(2)))
        wins.append(sum(r is not None for r in results))
        assert len(leases.active_writes())==1
    assert wins==[1]*100


def test_hard_limit_100_way_atomic_budget_reservation_and_unknown_abort_exposure():
    from concurrent.futures import ThreadPoolExecutor
    from decimal import Decimal
    from packages.budget import BudgetService,BudgetLimit,BudgetRequest
    from packages.budget.models import ProviderOutcome
    from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository
    budget=BudgetService(InMemoryInterventionBudgetRepository()); budget.create_budget(BudgetLimit('budget',Decimal(3),3,3)); sent=[]
    def run(i):
        req=BudgetRequest(f'res-{i}','budget','run',f'step-{i}',f'req-{i}','synthetic','fixture','v1',Decimal(1),1)
        def sender(r):
            assert budget.reservation(r.reservation_id).reserved_cost==1
            sent.append(r.request_id)
            return ProviderOutcome(r.request_id,r.provider,r.model,'CLIENT_DISCONNECTED',None,None,'UNKNOWN','30','fixture',None)
        return budget.dispatch(req,admission_hash=canonical_hash('boundary'),sender=sender)
    with ThreadPoolExecutor(max_workers=16) as pool: results=list(pool.map(run,range(100)))
    assert len(sent)==sum(r.send_count for r in results)==3
    assert sum(r.status=='PAUSED_QUOTA' and r.send_count==0 for r in results)==97
    assert budget.snapshot('budget').reserved_cost==3
    assert all(r.usage.abort_status=='CLIENT_DISCONNECTED' and r.usage.actual_cost is None for r in results if r.send_count)


@pytest.mark.parametrize('outcome',['CANCELLED','UNKNOWN'])
def test_abort_does_not_hide_cost_or_make_fixture_success(outcome):
    data=fixture(); data['tasks'][0]['outcome']=outcome
    h,_,_,_=host(); result=h.run('abort',h.capture(data),mode='PARALLEL',at=NOW.isoformat())
    first=result['results'][0]
    assert not result['quality_pass'] and result['status']=='FINISHED_WITH_FAILURES'
    assert first['actual_cost']==(1 if outcome=='CANCELLED' else None)
    if outcome=='CANCELLED':assert first['abort_status']=='CLIENT_DISCONNECTED' and result['actual_cost']==16
    else:assert result['retained_exposure']=='2'


def test_receipt_binds_dual_fence_and_budget_to_fixture_subject():
    h,_,worker,write=host(); data=fixture(); ref=h.capture(data)
    result=h.run('subject',ref,mode='PARALLEL',at=NOW.isoformat())
    assert result['execution_fence']==worker.execution_fencing_token
    assert result['write_fence']==write.write_fencing_token and result['budget_limit']==128


def test_actual_queue_rejects_old_claim_after_visibility_takeover():
    from packages.queue.service import DurableQueue,QueueTokenError
    from packages.queue.dag import DagNode,TaskGraph,DagQueueService
    q=DurableQueue(); dag=DagQueueService(q)
    graph=TaskGraph('graph','run','repo',(DagNode('a',(),(),True,canonical_hash('a')),))
    dag.register(graph,now=NOW,verified_inputs={'a':canonical_hash('a')})
    old=dag.claim('A',now=NOW,visibility_timeout=timedelta(seconds=1))
    new=dag.claim('B',now=NOW+timedelta(seconds=2),visibility_timeout=timedelta(seconds=10))
    with pytest.raises(QueueTokenError,match='STALE_FENCING_TOKEN'):dag.complete(old,now=NOW+timedelta(seconds=2))
    assert q.get(new.job_id).status.value=='CLAIMED'


def test_actual_git_owner_rejects_old_commit_grant_fence_after_takeover():
    h,ref,args,driver,_,_=trust_chain(); git=args['git']; state=git.repository('repo')
    state.update(revision=2,execution_fence='replacement-exec',write_fence='replacement-write')
    git.register_repository(state)
    with pytest.raises(ValueError,match='STALE_FENCING_TOKEN'): h.admit_git('ready',ref,**args)
    assert driver.calls==[] and git.repository('repo')['head']=='b'*40


def test_hard_limit_fixture_failures_preserve_send_zero_and_no_quality_pass():
    h,_,_,_=host(); data=fixture(); data['budget_limit']=3
    result=h.run('quota',h.capture(data),mode='PARALLEL',at=NOW.isoformat())
    denied=[r for r in result['results'] if r['reason']=='BUDGET_RESERVATION_FAILED']
    assert len(denied)==15 and all(r['send_count']==0 for r in denied)
    assert result['send_count']==1 and result['actual_cost']==1 and not result['quality_pass']
    assert not result['new_action_allowed']


@pytest.mark.parametrize('change',['quality','cost','speed'])
def test_parallel_is_not_recommended_if_quality_or_threshold_fails(change):
    h,_,_,_=host(); data=fixture('bug_hunt')
    if change=='quality': data['golden_outputs']['task-00-row-00']='CLEAN'
    if change=='cost': data['max_cost_ratio_permille']=500
    if change=='speed': data['min_speedup_permille']=5000
    ref=h.capture(data); h.run('single',ref,mode='SINGLE',at=NOW.isoformat()); h.run('parallel',ref,mode='PARALLEL',at=NOW.isoformat())
    assert h.compare('single','parallel')['recommendation']=='DO_NOT_ENABLE_PARALLEL'


@pytest.mark.parametrize('change',['duplicate-task','duplicate-row','unknown-dependency','self-cycle','cycle','duplicate-dependency',
    'too-many-tasks','boolean-budget','too-many-workers','duplicate-golden','unknown-field'])
def test_fixture_shape_graph_and_duplicate_rejections(change):
    h,_,_,_=host(); data=fixture()
    if change=='duplicate-task':data['tasks'][1]['id']=data['tasks'][0]['id']
    elif change=='duplicate-row':data['tasks'][1]['rows'][0]['id']=data['tasks'][0]['rows'][0]['id']
    elif change=='unknown-dependency':data['tasks'][0]['dependencies']=['absent']
    elif change=='self-cycle':data['tasks'][0]['dependencies']=['task-00']
    elif change=='cycle':
        data['tasks'][0]['dependencies']=['task-01']; data['tasks'][1]['dependencies']=['task-00']
    elif change=='duplicate-dependency':data['tasks'][1]['dependencies']=['task-00','task-00']
    elif change=='too-many-tasks':data['tasks']*=9
    elif change=='boolean-budget':data['budget_limit']=True
    elif change=='too-many-workers':data['max_concurrency']=17
    elif change=='duplicate-golden':data['expected_findings'].append(data['expected_findings'][0])
    else:data['command']='shell'
    with pytest.raises(ValueError):h.capture(data)


@pytest.mark.parametrize('path',['../escape','C:/escape','\\\\host/share','src/../x','src/Ａ.py','src/a~1.py','src/a.','src/CON.txt'])
def test_alias_escape_not_parallelized(path):
    h,_,_,_=host(); data=fixture(); data['tasks'][0]['paths']=[path]
    with pytest.raises(ValueError):h.capture(data)


@pytest.mark.parametrize('field',list(fixture('bug_hunt')))
def test_every_top_level_fixture_field_rejects_hostile_callback(field):
    h,_,_,_=host(); data=fixture('bug_hunt'); callbacks=[]
    class Hostile:
        def __iter__(self):callbacks.append('iter');return iter([])
        def __deepcopy__(self,memo):callbacks.append('copy');return {}
        def __eq__(self,other):callbacks.append('eq');return True
    data[field]=Hostile()
    with pytest.raises(ValueError):h.capture(data)
    assert callbacks==[]


def test_duplicate_result_request_is_single_publication_under_contention():
    from concurrent.futures import ThreadPoolExecutor
    h,_,_,_=host(); ref=h.capture(fixture('bug_hunt'))
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(lambda _:h.run('same',ref,mode='PARALLEL',at=NOW.isoformat()),range(16)))
    assert all(r==results[0] for r in results) and len(h._results)==1
    results[0]['results'][0]['status']='FORGED'
    assert h.run('same',ref,mode='PARALLEL',at=NOW.isoformat())['results'][0]['status']=='SUCCEEDED'


def test_parallel_fixture_executes_bounded_real_local_threads(monkeypatch):
    from threading import Barrier,Lock,get_ident
    module=importlib.import_module('packages.verification.parallel_e2e')
    original=module._transform_task; barrier=Barrier(4); lock=Lock(); thread_ids=set(); active=[0,0]
    def instrument(kind, rows):
        with lock:
            thread_ids.add(get_ident()); active[0]+=1; active[1]=max(active)
        barrier.wait(timeout=5)
        result=original(kind,rows)
        with lock:active[0]-=1
        return result
    monkeypatch.setattr(module,'_transform_task',instrument)
    h,_,_,_=host(); result=h.run('threads',h.capture(fixture('bug_hunt')),mode='PARALLEL',at=NOW.isoformat())
    assert result['completed']==16 and len(thread_ids)>=4 and active==[0,4] and get_ident() not in thread_ids
