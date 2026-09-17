from datetime import datetime, timezone, timedelta
from dataclasses import replace
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
import importlib
import json
import pytest
from packages.orchestration.delegation import DelegationPacket,PermissionSnapshot,DataEgressProfile
from packages.orchestration.result_envelope import ResultEnvelope
from packages.queue.dag import TaskGraph,DagNode
from packages.queue.service import DurableQueue
from packages.leases.service import LeaseService
from packages.budget.service import BudgetService
from packages.budget.models import BudgetLimit,BudgetRequest,UsageReceipt
from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository

NOW=datetime(2026,9,17,tzinfo=timezone.utc);TTL=timedelta(minutes=5)
HASH='sha256:'+'a'*64

def module():
    spec=importlib.util.find_spec('packages.agent_team.concurrency')
    assert spec is not None,'E05 concurrency scheduler missing'
    return importlib.import_module('packages.agent_team.concurrency')

def fixtures(*,dependency=False,shared=False,mutable=False,write=False,limit=2):
    c=module();q=DurableQueue();leases=LeaseService();lease=leases.issue_worker('run','main',NOW,TTL)
    budgets=BudgetService(InMemoryInterventionBudgetRepository());budgets.create_budget(BudgetLimit('budget',Decimal(5),1000,4))
    parent=PermissionSnapshot(('src/**',),('read','analyze','write'),('repo_read','test_write'),('local',),(),(),('delete','approve'))
    eg=DataEgressProfile('local_only',(),(),())
    tasks=[]
    for step in ('a','b'):
        perm=replace(parent,allowed_paths=(f'src/{step}/**',),allowed_actions=('read','analyze')+ (('write',) if write else ()),allowed_tools=('repo_read',))
        packet=DelegationPacket('del-'+step,'run','main','wi',1,step,'ws','Analyze code',('read',),('write',),perm.allowed_paths,perm.prohibited_actions,'read-only','subagent_result/v1',('analysis',),'budget',('analysis evidence',),HASH,'sha256:'+('b' if step=='a' else 'c')*64,perm,perm.snapshot_hash,parent.snapshot_hash,eg,eg.snapshot_hash,eg.snapshot_hash)
        req=BudgetRequest('res-'+step,'budget','run',step,'request-'+step,'local','analyzer','fixture',Decimal(1),100)
        budgets.reserve(req)
        tasks.append(c.AnalysisTask(packet,'worker-'+step,'context-'+('a' if shared else step),packet.context_snapshot_hash,'analyze','res-'+step,'request-'+step,mutable))
    graph=TaskGraph('graph','run','repo',tuple(DagNode(t.packet.step_id,('a',) if dependency and t.packet.step_id=='b' else (),(),True,t.packet.packet_hash) for t in tasks))
    service=c.ConcurrencyScheduler(q,leases,budgets,parent_permission=parent,parent_egress=eg,baseline_hash=HASH,run_id='run',main_actor='main',max_concurrency=limit)
    return c,service,tasks,graph,lease,budgets,q

def register(f):
    c,s,t,g,l,b,q=f
    return s.register('batch',g,tuple(t),now=NOW,execution_token=l.execution_fencing_token)

def dispatch(f,key='dispatch'):
    c,s,t,g,l,b,q=f
    return s.dispatch('batch',request_id=key,now=NOW,execution_token=l.execution_fencing_token)

def result(task,claim,status='COMPLETED'):
    d=dict(schema_version='subagent_result/v1',result_id='result-'+task.packet.step_id,delegation_id=task.packet.delegation_id,attempt_id=str(claim.lease_epoch),attempt_number=claim.lease_epoch,step_lineage_id=task.packet.step_id,status=status,target_hash=HASH,summary='analysis summary',actions_taken=['analyze'],changed_paths=[],evidence_refs=[dict(evidence_id='ev-'+task.packet.step_id,checksum=HASH,kind='analysis')],tests=[dict(command='local analysis',status='PASS',exit_code=0)],handoff={},assumptions=[],unresolved=[])
    if status=='BLOCKED':d.update(reason_code='ENVIRONMENT_BLOCKED',decision_needed='runtime unavailable')
    return ResultEnvelope.from_dict(d)

def test_parallel_read_synthesis_retains_every_step_and_never_accepts():
    f=fixtures();register(f);claims=dispatch(f);assert len(claims)==2
    c,s,t,g,l,b,q=f
    for task,claim in zip(t,claims):s.collect('batch',claim,result(task,claim),now=NOW,execution_token=l.execution_fencing_token)
    p=s.project('batch');assert p['status']=='COLLECTED_FOR_MAIN';assert p['mode']=='LIMITED_PARALLEL'
    assert len(p['results'])==2 and p['automatic_acceptance'] is False
    assert p['provider_execution']=='NOT_EXECUTED'

@pytest.mark.parametrize('kwargs',[{'dependency':True},{'shared':True},{'mutable':True},{'write':True},{'limit':1}])
def test_non_independent_work_collapses_to_single_worker(kwargs):
    f=fixtures(**kwargs);register(f);assert len(dispatch(f))==1
    assert f[1].project('batch')['mode']=='SINGLE_WORKER'

@pytest.mark.parametrize('field,value',[('baseline_hash','sha256:'+'d'*64),('parent_run_id','foreign'),('parent_agent_id','other'),('budget_ref','other')])
def test_entire_batch_validated_before_queue_publication(field,value):
    f=fixtures();c,s,t,g,l,b,q=f;t[1]=replace(t[1],packet=replace(t[1].packet,**{field:value}))
    with pytest.raises(c.ConcurrencyError):register(f)
    assert q._jobs=={}

def test_packet_hash_rebind_and_forced_mutation_rejected():
    f=fixtures();c,s,t,g,l,b,q=f;register(f)
    object.__setattr__(t[1].packet,'objective','tamper')
    with pytest.raises(c.ConcurrencyError):register(f)
    assert len(dispatch(f))==2  # caller mutation did not alter canonical captured packets

def test_idempotent_dispatch_and_result_replay():
    f=fixtures();register(f);first=dispatch(f);assert dispatch(f)==first
    c,s,t,g,l,b,q=f;r=result(t[0],first[0]);s.collect('batch',first[0],r,now=NOW,execution_token=l.execution_fencing_token)
    assert s.collect('batch',first[0],r,now=NOW,execution_token=l.execution_fencing_token)==r.canonical_hash
    with pytest.raises(c.ConcurrencyError):s.collect('batch',first[0],replace(r,summary='different'),now=NOW,execution_token=l.execution_fencing_token)

def test_failure_or_missing_result_not_promoted_to_success():
    f=fixtures();register(f);claims=dispatch(f);c,s,t,g,l,b,q=f
    s.collect('batch',claims[0],result(t[0],claims[0],'BLOCKED'),now=NOW,execution_token=l.execution_fencing_token)
    p=s.project('batch');assert p['status']=='REVIEW_REQUIRED';assert [x['status'] for x in p['results']]==['BLOCKED','PENDING']

@pytest.mark.parametrize('kind',['cancel','lease','token','queue_fence','foreign_worker','target','write','empty_evidence'])
def test_untrusted_result_cannot_complete_claim(kind):
    f=fixtures();register(f);claims=dispatch(f);c,s,t,g,l,b,q=f;r=result(t[0],claims[0]);claim=claims[0];token=l.execution_fencing_token
    if kind=='cancel':s.cancel('batch',now=NOW,execution_token=token)
    elif kind=='lease':s._leases.revoke_run('run')
    elif kind=='token':token='stale'
    elif kind=='queue_fence':claim=replace(claim,execution_fencing_token='stale')
    elif kind=='foreign_worker':claim=replace(claim,worker_id='intruder')
    elif kind=='target':r=replace(r,target_hash='sha256:'+'d'*64)
    elif kind=='write':r=replace(r,changed_paths=('src/write.py',))
    else:r=replace(r,evidence_refs=())
    with pytest.raises(c.ConcurrencyError):s.collect('batch',claim,r,now=NOW,execution_token=token)
    assert s.project('batch')['results'][0]['status'] in ('PENDING','CANCELLED')

def test_consumed_budget_receipt_blocks_new_dispatch_and_reservation_not_minted(monkeypatch):
    f=fixtures();register(f);c,s,t,g,l,b,q=f
    monkeypatch.setattr(b,'reserve',lambda *a:pytest.fail('E08 reservation policy must not be implemented'))
    b.reconcile(UsageReceipt('usage','res-b','request-b','ABORTED',Decimal(0),0,None,None,'HOST'))
    with pytest.raises(c.ConcurrencyError):dispatch(f)
    assert all(job.attempts==0 for job in q._jobs.values())

def test_partial_claim_failure_rolls_back_and_retry_recovers():
    f=fixtures();register(f);c,s,t,g,l,b,q=f;tokens=iter(('ok',''));q._token_factory=lambda:next(tokens)
    with pytest.raises(c.ConcurrencyError):dispatch(f)
    assert all(job.attempts==0 for job in q._jobs.values())
    tokens=iter(('recovered-a','recovered-b'));q._token_factory=lambda:next(tokens)
    assert len(dispatch(f))==2

def test_projection_detached_and_bounded():
    f=fixtures();register(f);p=f[1].project('batch');p['results'][0]['status']='FORGED'
    assert f[1].project('batch')['results'][0]['status']=='PENDING'
    assert len(json.dumps(f[1].project('batch')))<65536

def test_concurrent_dispatch_does_not_exceed_limit():
    f=fixtures();register(f)
    with ThreadPoolExecutor(max_workers=4) as pool:got=list(pool.map(lambda _:dispatch(f),range(12)))
    assert all(x==got[0] for x in got) and len(got[0])==2

def test_same_context_content_with_different_ids_is_not_independent():
    f=fixtures();c,s,t,g,l,b,q=f
    t[1]=replace(t[1],context_hash=t[0].context_hash,packet=replace(t[1].packet,context_snapshot_hash=t[0].context_hash))
    g=replace(g,nodes=tuple(replace(n,input_hash=t[i].packet.packet_hash) for i,n in enumerate(g.nodes)))
    f=(c,s,t,g,l,b,q);register(f)
    assert len(dispatch(f))==1 and s.project('batch')['mode']=='SINGLE_WORKER'

def test_revoke_during_final_token_preparation_has_no_partial_dispatch():
    f=fixtures();register(f);c,s,t,g,l,b,q=f;calls=[]
    def token():
        calls.append(1)
        if len(calls)==2:s._leases.revoke_run('run')
        return 'token-'+str(len(calls))
    q._token_factory=token
    with pytest.raises(c.ConcurrencyError,match='STALE_FENCING_TOKEN'):dispatch(f)
    assert all(j.attempts==0 for j in q._jobs.values()) and s._dispatches=={}

def test_failed_analysis_delivery_does_not_unlock_dependent_analysis():
    f=fixtures(dependency=True);register(f);c,s,t,g,l,b,q=f;claim=dispatch(f)[0]
    s.collect('batch',claim,result(t[0],claim,'BLOCKED'),now=NOW,execution_token=l.execution_fencing_token)
    assert dispatch(f,'dependent')==()
    assert s.project('batch')['status']=='REVIEW_REQUIRED'

@pytest.mark.parametrize('delta',[timedelta(minutes=5),timedelta(minutes=6)])
def test_worker_half_open_expiry_blocks_dispatch(delta):
    f=fixtures();register(f);c,s,t,g,l,b,q=f
    with pytest.raises(c.ConcurrencyError,match='STALE_FENCING_TOKEN'):
        s.dispatch('batch',request_id='late',now=NOW+delta,execution_token=l.execution_fencing_token)
    assert all(j.attempts==0 for j in q._jobs.values())

def test_cancel_blocks_new_dispatch_and_preserves_existing_lineage():
    f=fixtures();register(f);c,s,t,g,l,b,q=f;s.cancel('batch',now=NOW,execution_token=l.execution_fencing_token)
    with pytest.raises(c.ConcurrencyError,match='BATCH_CANCELLED'):dispatch(f)
    assert len(s.project('batch')['results'])==2

@pytest.mark.parametrize('operation',['write','execute','approve','READ'])
def test_unapproved_operation_never_enqueues(operation):
    f=fixtures();c,s,t,g,l,b,q=f;t[0]=replace(t[0],operation=operation)
    with pytest.raises(c.ConcurrencyError,match='PACKET_AUTHORITY_INVALID'):register(f)
    assert q._jobs=={}

def test_unknown_dependency_and_forced_cycle_block_before_publication():
    for dependencies in (('unknown',),('a',)):
        f=fixtures();c,s,t,g,l,b,q=f;object.__setattr__(g.nodes[0],'dependency_ids',dependencies)
        with pytest.raises(c.ConcurrencyError,match='BATCH_INVALID'):register(f)
        assert q._jobs=={}

def test_large_context_and_invalid_fanout_do_not_publish():
    f=fixtures();c,s,t,g,l,b,q=f;t[0]=replace(t[0],packet=replace(t[0].packet,objective='x'*20000))
    with pytest.raises(c.ConcurrencyError,match='CONTEXT_LIMIT'):register(f)
    with pytest.raises(c.ConcurrencyError,match='FANOUT_INVALID'):
        s.register('many',g,tuple(t*9),now=NOW,execution_token=l.execution_fencing_token)
    assert q._jobs=={}

def test_result_tests_skipped_cannot_be_claimed_as_completed():
    from packages.orchestration.result_envelope import ResultTest
    f=fixtures();register(f);c,s,t,g,l,b,q=f;claim=dispatch(f)[0]
    r=replace(result(t[0],claim),tests=(ResultTest('analysis','SKIPPED',None),))
    with pytest.raises(c.ConcurrencyError,match='RESULT_BINDING_INVALID'):
        s.collect('batch',claim,r,now=NOW,execution_token=l.execution_fencing_token)
    assert s.project('batch')['results'][0]['status']=='PENDING'

def test_budget_receipt_changed_after_registration_cannot_dispatch():
    f=fixtures();register(f);c,s,t,g,l,b,q=f
    r=b._repository._reservations['res-b'];b._repository._reservations['res-b']=replace(r,model='different')
    with pytest.raises(c.ConcurrencyError,match='BUDGET_RECEIPT_INVALID'):dispatch(f)
    assert all(j.attempts==0 for j in q._jobs.values())

def test_reservation_callback_revocation_rechecked_before_dispatch(monkeypatch):
    f=fixtures();register(f);c,s,t,g,l,b,q=f;original=b.reservation
    def read(identity):
        if identity=='res-b':s._leases.revoke_run('run')
        return original(identity)
    monkeypatch.setattr(b,'reservation',read)
    with pytest.raises(c.ConcurrencyError):dispatch(f)
    assert all(j.attempts==0 for j in q._jobs.values())

def test_real_local_parallel_analysis_collects_same_baseline_evidence():
    from threading import Barrier
    f=fixtures();register(f);c,s,t,g,l,b,q=f;claims=dispatch(f);barrier=Barrier(2)
    def analyze(item):
        task,claim=item;barrier.wait(timeout=3)
        # Actual local immutable fixture computation, not Provider execution.
        assert sum((1,2,3))==6
        return s.collect('batch',claim,result(task,claim),now=NOW,execution_token=l.execution_fencing_token)
    with ThreadPoolExecutor(max_workers=2) as pool:hashes=list(pool.map(analyze,zip(t,claims)))
    assert len(set(hashes))==2
    assert {r['target_hash'] for r in s.project('batch')['results']}=={HASH}

def test_single_worker_collapse_uses_one_worker_across_sequential_claims():
    f=fixtures(shared=True);register(f);c,s,t,g,l,b,q=f;first=dispatch(f)[0]
    s.collect('batch',first,result(t[0],first),now=NOW,execution_token=l.execution_fencing_token)
    second=dispatch(f,'second')[0]
    assert second.worker_id==first.worker_id
    s.collect('batch',second,result(t[1],second),now=NOW,execution_token=l.execution_fencing_token)
    assert {r['worker_id'] for r in s.project('batch')['results']}=={first.worker_id}

def test_last_token_budget_reconcile_cannot_dispatch_spent_receipt():
    f=fixtures();register(f);c,s,t,g,l,b,q=f;tokens=[]
    def token():
        tokens.append(1)
        if len(tokens)==2:b.reconcile(UsageReceipt('late-use','res-b','request-b','ABORTED',Decimal(0),0,None,None,'HOST'))
        return 'token-'+str(len(tokens))
    q._token_factory=token
    with pytest.raises(c.ConcurrencyError):dispatch(f)
    assert all(j.attempts==0 for j in q._jobs.values())

def test_explicit_e05_exports_are_resolvable():
    from packages.agent_team import AnalysisTask,ConcurrencyScheduler,ConcurrencyError
    assert AnalysisTask is module().AnalysisTask
    assert ConcurrencyScheduler is module().ConcurrencyScheduler
    assert ConcurrencyError is module().ConcurrencyError

def test_read_results_cannot_be_backdated_before_dispatch():
    f=fixtures();register(f);c,s,t,g,l,b,q=f;claim=s.dispatch('batch',request_id='later',now=NOW+timedelta(seconds=10),execution_token=l.execution_fencing_token)[0]
    with pytest.raises(c.ConcurrencyError,match='RESULT_TIME_INVALID'):
        s.collect('batch',claim,result(t[0],claim),now=NOW,execution_token=l.execution_fencing_token)

def test_bounded_evidence_projection_rejected_before_queue_completion():
    from packages.orchestration.result_envelope import EvidenceReference
    f=fixtures();register(f);c,s,t,g,l,b,q=f;claim=dispatch(f)[0]
    r=replace(result(t[0],claim),evidence_refs=tuple(EvidenceReference('evidence-'+str(i),HASH,'analysis') for i in range(35)))
    with pytest.raises(c.ConcurrencyError,match='RESULT_PROJECTION_LIMIT'):
        s.collect('batch',claim,r,now=NOW,execution_token=l.execution_fencing_token)
    assert q.get(claim.job_id).status.value=='CLAIMED'
    assert s.project('batch')['results'][0]['status']=='PENDING'

@pytest.mark.parametrize('callback',['token','snapshot'])
def test_r1_cancel_during_callback_never_publishes_claim_or_receipt(callback,monkeypatch):
    f=fixtures();register(f);c,s,t,g,l,b,q=f
    def cancel():s.cancel('batch',now=NOW,execution_token=l.execution_fencing_token)
    if callback=='token':
        ids=iter(('a','b'))
        def token():cancel();return next(ids)
        q._token_factory=token
    else:
        original=b.snapshot
        def snapshot(identity):value=original(identity);cancel();return value
        monkeypatch.setattr(b,'snapshot',snapshot)
    with pytest.raises(c.ConcurrencyError):dispatch(f)
    assert all(j.attempts==0 for j in q._jobs.values()) and s._dispatches=={}

@pytest.mark.parametrize('another_scheduler',[False,True])
def test_r1_reservation_cannot_pay_for_another_batch_or_queue(another_scheduler):
    f=fixtures();register(f);c,s,t,g,l,b,q=f;claims=dispatch(f)
    for task,claim in zip(t,claims):s.collect('batch',claim,result(task,claim),now=NOW,execution_token=l.execution_fencing_token)
    if another_scheduler:
        q2=DurableQueue();s2=c.ConcurrencyScheduler(q2,s._leases,b,parent_permission=s._parent,parent_egress=s._egress,baseline_hash=HASH,run_id='run',main_actor='main')
    else:q2=q;s2=s
    other=replace(g,graph_id='other-graph')
    try:s2.register('other-batch',other,tuple(t),now=NOW,execution_token=l.execution_fencing_token)
    except c.ConcurrencyError:pass
    else:
        with pytest.raises(c.ConcurrencyError):s2.dispatch('other-batch',request_id='other-dispatch',now=NOW,execution_token=l.execution_fencing_token)
    assert not any(j.status.value=='CLAIMED' for j in q2._jobs.values())
    assert len(claims)==2

def test_r1_same_dispatch_exact_replay_does_not_double_spend_reservation():
    f=fixtures();register(f);first=dispatch(f);second=dispatch(f)
    assert first==second
    assert all(j.attempts==1 for j in f[6]._jobs.values())

def test_r1_reconcile_between_receipt_and_snapshot_cannot_publish(monkeypatch):
    f=fixtures();register(f);c,s,t,g,l,b,q=f;original=b.snapshot;calls=[]
    def snapshot(identity):
        calls.append(identity)
        if len(calls)==4:
            b.reconcile(UsageReceipt('race','res-b','request-b','ABORTED',Decimal(0),0,None,None,'HOST'))
        return original(identity)
    monkeypatch.setattr(b,'snapshot',snapshot)
    with pytest.raises(c.ConcurrencyError):dispatch(f)
    assert all(j.attempts==0 for j in q._jobs.values()) and s._dispatches=={}

def test_r1_budget_owner_lock_is_held_through_queue_publication(monkeypatch):
    from threading import Thread,Event
    f=fixtures();register(f);c,s,t,g,l,b,q=f;acquired=Event();attempted=Event();threads=[]
    def contend():
        attempted.set()
        with b._repository._lock:acquired.set()
    original=q._publish_selected
    def publish(*args,**kwargs):
        thread=Thread(target=contend);thread.start();threads.append(thread)
        assert attempted.wait(1)
        assert not acquired.wait(.05),'budget owner lock released before publication'
        return original(*args,**kwargs)
    monkeypatch.setattr(q,'_publish_selected',publish)
    try:assert len(dispatch(f))==2
    finally:
        for thread in threads:thread.join(2)
    assert acquired.is_set()

@pytest.mark.parametrize('boundary',['single','selected'])
def test_r1_direct_queue_claim_cannot_bypass_cancel_and_budget(boundary):
    f=fixtures();register(f);c,s,t,g,l,b,q=f;s.cancel('batch',now=NOW,execution_token=l.execution_fencing_token)
    b.reconcile(UsageReceipt('spent','res-a','request-a','ABORTED',Decimal(0),0,None,None,'HOST'))
    if boundary=='single':assert q.claim('intruder',NOW,visibility_timeout=TTL) is None
    else:
        from packages.queue.service import QueueError
        with pytest.raises(QueueError,match='CLAIM_OWNER_REQUIRED'):
            q.claim_selected(tuple((j.job_id,'intruder-'+j.payload) for j in q._jobs.values()),now=NOW,visibility_timeout=TTL)
    assert all(j.attempts==0 for j in q._jobs.values())

def test_r1_forged_budget_snapshot_is_not_owner_evidence(monkeypatch):
    f=fixtures();register(f);c,s,t,g,l,b,q=f;honest=b.snapshot('budget')
    b._repository.set_new_action_allowed('budget',False)
    monkeypatch.setattr(b,'snapshot',lambda _:honest)
    with pytest.raises(c.ConcurrencyError,match='BUDGET_RECEIPT_INVALID'):dispatch(f)
    assert s._dispatches=={}

def test_r1_forged_reserved_receipt_cannot_override_owner_consumed_state(monkeypatch):
    f=fixtures();register(f);c,s,t,g,l,b,q=f;honest=b.reservation('res-b');original=b.reservation
    b.reconcile(UsageReceipt('already-spent','res-b','request-b','ABORTED',Decimal(0),0,None,None,'HOST'))
    monkeypatch.setattr(b,'reservation',lambda identity:honest if identity=='res-b' else original(identity))
    with pytest.raises(c.ConcurrencyError,match='BUDGET_RECEIPT_INVALID'):dispatch(f)
    assert all(j.attempts==0 for j in q._jobs.values())

@pytest.mark.parametrize('variant',['packet','operation'])
def test_r1_reservation_bound_to_exact_packet_operation(variant):
    f=fixtures();register(f);c,s,t,g,l,b,q=f;claims=dispatch(f)
    for task,claim in zip(t,claims):s.collect('batch',claim,result(task,claim),now=NOW,execution_token=l.execution_fencing_token)
    if variant=='packet':t[0]=replace(t[0],packet=replace(t[0].packet,objective='another analysis'))
    else:t[0]=replace(t[0],operation='read')
    g2=replace(g,graph_id='other',nodes=tuple(replace(n,input_hash=t[i].packet.packet_hash) for i,n in enumerate(g.nodes)))
    s.register('other',g2,tuple(t),now=NOW,execution_token=l.execution_fencing_token)
    with pytest.raises(c.ConcurrencyError,match='RESERVATION_ALREADY_DISPATCHED'):
        s.dispatch('other',request_id='another',now=NOW,execution_token=l.execution_fencing_token)

def test_r1_reconcile_wins_before_dispatch_lock_then_claim_count_zero():
    from threading import Event,Thread
    f=fixtures();register(f);c,s,t,g,l,b,q=f;held=Event();release=Event();errors=[]
    def reconcile():
        with b._repository._lock:
            held.set();assert release.wait(2)
            b.reconcile(UsageReceipt('concurrent','res-b','request-b','ABORTED',Decimal(0),0,None,None,'HOST'))
    def run():
        try:dispatch(f)
        except c.ConcurrencyError as error:errors.append(str(error))
    first=Thread(target=reconcile);first.start();assert held.wait(2)
    second=Thread(target=run);second.start();release.set();first.join(2);second.join(2)
    assert not first.is_alive() and not second.is_alive() and errors
    assert all(j.attempts==0 for j in q._jobs.values())

@pytest.mark.parametrize('foreign',[False,True])
def test_r2_reentrant_dispatch_taints_outer_even_when_callback_catches_denial(foreign):
    from packages.queue.dag import DagQueueService
    f=fixtures();register(f);c,s,t,g,l,b,q=f
    other=f
    if foreign:
        other=fixtures();oc,os,ot,og,ol,ob,oq=other
        os._queue=q;os._dag=DagQueueService(q);other=(oc,os,ot,replace(og,graph_id='foreign-graph'),ol,ob,q);register(other)
    invoked=[];issued=[]
    def token():
        issued.append(1);number=len(issued)
        if not invoked:
            invoked.append(True)
            try:dispatch(other)
            except c.ConcurrencyError:pass
        return 'token-'+str(number)
    q._token_factory=token
    with pytest.raises(c.ConcurrencyError):dispatch(f)
    assert all(j.attempts==0 for j in q._jobs.values())
    assert s._dispatches=={} and other[1]._dispatches=={}
    assert s._inflight=={} and other[1]._inflight=={}
    claims=dispatch(f)
    assert len(claims)==2 and dispatch(f)==claims

def test_r2_register_callback_reconcile_earlier_receipt_publishes_nothing(monkeypatch):
    f=fixtures();c,s,t,g,l,b,q=f;original=b.snapshot;calls=[]
    def snapshot(identity):
        calls.append(identity)
        if len(calls)==2:b.reconcile(UsageReceipt('register-race','res-a','request-a','ABORTED',Decimal(0),0,None,None,'HOST'))
        return original(identity)
    monkeypatch.setattr(b,'snapshot',snapshot)
    with pytest.raises(c.ConcurrencyError):register(f)
    assert q._jobs=={} and s._batches=={} and s._dag._graphs=={}

def test_r2_token_callback_holds_no_scheduler_budget_queue_locks():
    from threading import Thread
    f=fixtures();register(f);c,s,t,g,l,b,q=f;tokens=[]
    def token():
        acquired=[]
        def probe():
            for lock in (s._lock,b._repository._lock,q._lock):
                ok=lock.acquire(timeout=.05);acquired.append(ok)
                if ok:lock.release()
        thread=Thread(target=probe);thread.start();thread.join(1)
        assert acquired==[True,True,True],'callback executed under owner lock'
        tokens.append(1);return 'token-'+str(len(tokens))
    q._token_factory=token
    assert len(dispatch(f))==2
