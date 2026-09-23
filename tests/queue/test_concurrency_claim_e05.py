from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
import pytest
from packages.queue.service import DurableQueue, QueueError
from packages.queue.models import QueueJob, QueueStatus

NOW=datetime(2026,9,17,tzinfo=timezone.utc)
TTL=timedelta(minutes=1)

def queue(factory=None):
    q=DurableQueue(**({'token_factory':factory} if factory else {}))
    q.enqueue_many(tuple(QueueJob(x,'run',x,NOW,2,graph_id='g',graph_hash='hash') for x in ('a','b')))
    return q

def claim(q, pairs=(('a','wa'),('b','wb'))):
    assert callable(getattr(q,'claim_selected',None)), 'atomic selected claim missing'
    return q.claim_selected(pairs,now=NOW,visibility_timeout=TTL)

def test_batch_claim_is_ordered_and_same_owner_queue_is_used():
    q=queue();claims=claim(q,(('b','wb'),('a','wa')))
    assert [c.job_id for c in claims]==['a','b']
    assert all(q.get(c.job_id).status is QueueStatus.CLAIMED for c in claims)

def test_second_token_failure_leaves_no_partial_claim():
    tokens=iter(('first',''));q=queue(lambda:next(tokens));before=tuple(q.get(x) for x in ('a','b'))
    assert callable(getattr(q,'claim_selected',None)), 'atomic selected claim missing'
    with pytest.raises(QueueError):claim(q)
    assert tuple(q.get(x) for x in ('a','b'))==before

@pytest.mark.parametrize('change',[{'dependency_ids':('a',)},{'conflict_keys':('shared',)},{'input_verified':False},{'status':QueueStatus.QUARANTINED}])
def test_not_ready_batch_has_zero_claims(change):
    q=queue();q._jobs['a']=q.get('a').replace(conflict_keys=('shared',));q._jobs['b']=q.get('b').replace(**change)
    assert callable(getattr(q,'claim_selected',None)), 'atomic selected claim missing'
    before=dict(q._jobs)
    with pytest.raises(QueueError):claim(q)
    assert q._jobs==before

def test_concurrent_batches_only_one_wins():
    q=queue();assert callable(getattr(q,'claim_selected',None)), 'atomic selected claim missing'
    def attempt(_):
        try:return len(claim(q))
        except QueueError:return 0
    with ThreadPoolExecutor(max_workers=8) as pool:result=list(pool.map(attempt,range(20)))
    assert result.count(2)==1 and sum(result)==2

@pytest.mark.parametrize('pairs',[(('a','wa'),('a','wb')),(('a','wa'),('missing','wb')),(),(('a','wa'),('b','wa'))])
def test_invalid_batch_rejected_without_queue_change(pairs):
    q=queue();assert callable(getattr(q,'claim_selected',None)), 'atomic selected claim missing'
    with pytest.raises(QueueError):claim(q,pairs)
    assert all(q.get(x).attempts==0 for x in ('a','b'))

def test_r1_claim_policy_preserves_ordinary_single_claim_and_denies_spoof():
    q=queue();owner=object();q.bind_claim_policy(('a',),owner)
    c=q.claim('ordinary',NOW,visibility_timeout=TTL);assert c.job_id=='b'
    assert q.claim('intruder',NOW,visibility_timeout=TTL) is None
    with pytest.raises(QueueError,match='CLAIM_OWNER_REQUIRED'):
        q.claim_selected((('a','intruder'),),now=NOW,visibility_timeout=TTL,owner=object(),final_guard=lambda:None)
    with pytest.raises(QueueError,match='CLAIM_POLICY_INVALID'):q.bind_claim_policy(('a',),object())
    claims=q.claim_selected((('a','authorized'),),now=NOW,visibility_timeout=TTL,owner=owner,final_guard=lambda:None)
    assert claims[0].worker_id=='authorized'

@pytest.mark.parametrize('kind',['single','token','guard'])
def test_r2_callbacks_run_without_queue_lock_or_cross_budget_inversion(kind):
    from threading import Thread,RLock,Event
    q=queue();budget=RLock();entered=Event();acquired=[];tokens=[]
    def callback():
        def contender():
            with budget:
                entered.set();ok=q._lock.acquire(timeout=.1);acquired.append(ok)
                if ok:q._lock.release()
        thread=Thread(target=contender);thread.start();assert entered.wait(1)
        thread.join(1)
        assert acquired[-1] is True,'queue -> foreign budget lock inversion'
        with budget:pass
        tokens.append(1);return 'token-'+str(len(tokens))
    if kind=='guard':q.claim_selected((('a','wa'),),now=NOW,visibility_timeout=TTL,final_guard=callback)
    else:
        q._token_factory=callback
        if kind=='single':assert q.claim('worker',NOW,visibility_timeout=TTL)
        else:claim(q)
