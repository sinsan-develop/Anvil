from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from dataclasses import replace
import pytest

from packages.queue.dag import DagNode, TaskGraph, DagQueueService, GraphError
from packages.queue.service import DurableQueue, QueueTokenError
from packages.queue.models import QueueStatus

NOW = datetime(2026, 9, 17, tzinfo=timezone.utc)
HASH = 'sha256:' + 'a'*64

def node(name, deps=(), groups=(), independent=True):
    return DagNode(name, deps, groups, independent, HASH)

def graph(nodes, run='run', graph_id='graph'):
    return TaskGraph(graph_id, run, 'repo', tuple(nodes))

def service(nodes, **kwargs):
    s=DagQueueService(DurableQueue()); g=graph(nodes, **kwargs)
    s.register(g, now=NOW, verified_inputs={n.step_id:n.input_hash for n in g.nodes})
    return s,g

@pytest.mark.parametrize('nodes', [
    (node('a',('a',)),), (node('a',('b',)),node('b',('a',))),
    (node('a',('absent',)),), (node('a'),node('a')), (),
])
def test_cycle_unknown_duplicate_empty_fail_closed(nodes):
    with pytest.raises(GraphError):graph(nodes)

@pytest.mark.parametrize('value',['','../escape','A/B','a b',None])
def test_invalid_step_identity(value):
    with pytest.raises(GraphError):node(value)

def test_graph_hash_order_independent_and_parent_bound():
    a=graph([node('b',('a',)),node('a')]);b=graph([node('a'),node('b',('a',))])
    assert a.content_hash==b.content_hash
    assert a.content_hash!=replace(a,run_id='other').content_hash

def test_dependency_completion_not_claim_or_failure_controls_ready():
    s,g=service([node('a'),node('b',('a',))]);a=s.claim('worker',now=NOW,visibility_timeout=timedelta(seconds=5))
    assert a.job_id==s.job_id(g,'a');assert s.claim('other',now=NOW,visibility_timeout=timedelta(seconds=5)) is None
    s.complete(a,now=NOW)
    assert s.claim('other',now=NOW,visibility_timeout=timedelta(seconds=5)).job_id==s.job_id(g,'b')

def test_unverified_or_drifted_inputs_never_enqueue():
    s=DagQueueService(DurableQueue());g=graph([node('a')])
    for inputs in ({},{'a':'sha256:'+'b'*64},{'a':HASH,'unknown':HASH}):
        with pytest.raises(GraphError,match='INPUT_HASH'):s.register(g,now=NOW,verified_inputs=inputs)
        assert s.claim('w',now=NOW,visibility_timeout=timedelta(seconds=2)) is None

def test_registration_replay_exact_and_rebind_atomic():
    s,g=service([node('a')]);s.register(g,now=NOW,verified_inputs={'a':HASH})
    with pytest.raises(GraphError,match='REBIND'):s.register(graph([node('b')]),now=NOW,verified_inputs={'b':HASH})
    assert len(s.project('graph')['nodes'])==1

def test_registration_retry_budget_rebind_rejected():
    s,g=service([node('a')])
    with pytest.raises(GraphError,match='REBIND'):s.register(g,now=NOW,verified_inputs={'a':HASH},max_attempts=1)

def test_original_graph_forced_mutation_does_not_change_publication():
    s,g=service([node('a')]);before=s.project('graph')
    object.__setattr__(g.nodes[0],'input_hash','sha256:'+'b'*64)
    object.__setattr__(g,'run_id','foreign')
    assert s.project('graph')==before

def test_three_independent_nodes_can_be_reserved_without_worker_execution():
    s,g=service([node('a'),node('b'),node('c')])
    assert s.project('graph')['execution_mode']=='INDEPENDENT_READY'
    results=[s.claim(str(i),now=NOW,visibility_timeout=timedelta(seconds=2)) for i in range(3)]
    assert len({r.job_id for r in results})==3
    assert s.project('graph')['worker_execution']=='NOT_EXECUTED'

def test_non_independent_collapses_and_conflict_group_serializes():
    for nodes in ([node('a',independent=False),node('b')],[node('a',groups=('lockfile',)),node('b',groups=('lockfile',))]):
        s,g=service(nodes);assert s.project('graph')['execution_mode']=='SINGLE_WORKER'
        a=s.claim('w',now=NOW,visibility_timeout=timedelta(seconds=2))
        assert s.claim('x',now=NOW,visibility_timeout=timedelta(seconds=2)) is None
        s.complete(a,now=NOW);assert s.claim('x',now=NOW,visibility_timeout=timedelta(seconds=2)) is not None

def test_conflict_group_cross_run_and_case_identity():
    s,g=service([node('a',groups=('LockFILE',))])
    g2=graph([node('b',groups=('lockfile',))],run='run2',graph_id='graph2')
    s.register(g2,now=NOW,verified_inputs={'b':HASH})
    s.claim('w',now=NOW,visibility_timeout=timedelta(seconds=2))
    assert s.claim('x',now=NOW,visibility_timeout=timedelta(seconds=2)) is None

def test_atomic_concurrent_claim_only_once():
    s,g=service([node('a')])
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(lambda i:s.claim(str(i),now=NOW,visibility_timeout=timedelta(seconds=2)),range(20)))
    assert sum(r is not None for r in results)==1

def test_visibility_redelivery_new_fence_stale_deny_and_duplicate_completion():
    s,g=service([node('a')]);first=s.claim('w',now=NOW,visibility_timeout=timedelta(seconds=2))
    later=NOW+timedelta(seconds=3);second=s.claim('x',now=later,visibility_timeout=timedelta(seconds=5))
    assert second.lease_epoch==first.lease_epoch+1 and second.execution_fencing_token!=first.execution_fencing_token
    with pytest.raises(QueueTokenError):s.complete(first,now=later)
    s.complete(second,now=later);s.complete(second,now=later)
    with pytest.raises(QueueTokenError):s.complete(replace(second,execution_fencing_token='forged'),now=later)

def test_poison_quarantine_blocks_descendants():
    s=DagQueueService(DurableQueue());g=graph([node('a'),node('b',('a',))])
    s.register(g,now=NOW,verified_inputs={'a':HASH,'b':HASH},max_attempts=1)
    c=s.claim('w',now=NOW,visibility_timeout=timedelta(seconds=2));s.fail(c,now=NOW,reason='FAILURE')
    assert s.claim('x',now=NOW,visibility_timeout=timedelta(seconds=2)) is None
    p=s.project('graph');assert p['nodes'][0]['status']=='QUARANTINED' and p['nodes'][1]['status']=='BLOCKED_DEPENDENCY'

def test_graph_projection_detached_and_no_payload_or_fences():
    s,g=service([node('a')]);c=s.claim('w',now=NOW,visibility_timeout=timedelta(seconds=2))
    p=s.project('graph');p['nodes'][0]['status']='SUCCEEDED'
    assert s.project('graph')['nodes'][0]['status']=='CLAIMED'
    assert c.execution_fencing_token not in str(s.project('graph'))
    assert 'payload' not in str(s.project('graph'))

def test_e03_three_symbols_are_exported():
    import packages.agent_team as team
    assert {'ExternalVerifierAdapter','ExternalVerificationError','ManualImportAuthorization'}<=set(team.__all__)
