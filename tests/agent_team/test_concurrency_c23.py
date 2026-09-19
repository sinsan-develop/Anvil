from concurrent.futures import ThreadPoolExecutor
from tests.agent_team.test_orchestration_c23 import fixture, claim, complete, NOW


def test_concurrent_exact_claim_replay_has_one_event_and_one_exposure():
    s,_,_,_,tasks=fixture();s.register_plan(tasks,actor_id="main",now=NOW)
    with ThreadPoolExecutor(max_workers=8) as pool:
        receipts=list(pool.map(lambda _:claim(s,tasks[0]),range(100)))
    assert len({r.content_hash for r in receipts})==1
    value=s.project().to_dict()
    assert value["forecast_exposure"]==5
    assert [e["kind"] for e in value["events"]].count("TASK_CLAIMED")==1


def test_failed_task_does_not_erase_other_results_or_synthesize_success():
    s,_,r,_,tasks=fixture();s.register_plan(tasks,actor_id="main",now=NOW)
    claim(s,tasks[0]);complete(s,r,tasks[0]);claim(s,tasks[1])
    value=s.record_failure("task2",actor_id=tasks[1].assignment.actor_id,execution_fence=tasks[1].assignment.execution_fence,
        now=NOW,request_id="failed",fingerprint="C23-SYNTHETIC-FAILURE",cost=3).to_dict()
    assert value["status"]=="REVIEW_REQUIRED" and value["spent"]==5
    assert value["tasks"]["task1"]["status"]=="COMPLETED"
    assert value["tasks"]["task2"]["status"]=="FAILED"
    assert value["tasks"]["task2"]["failure_fingerprint"]=="C23-SYNTHETIC-FAILURE"
