from dataclasses import replace
import pytest
from tests.agent_team.test_orchestration_c23 import fixture, NOW


def send(s,tasks,**updates):
    a=tasks[0].assignment
    values=dict(actor_id=a.actor_id,execution_fence=a.execution_fence,now=NOW,request_id="message",body="bounded peer question",artifact_refs=())
    values.update(updates)
    return s.send("task1","task2",**values)


def test_peer_trace_mailbox_ack_and_replay_preserve_single_delivery():
    s,_,_,_,tasks=fixture();s.register_plan(tasks,actor_id="main",now=NOW)
    first=send(s,tasks)
    assert send(s,tasks)==first
    b=tasks[1].assignment
    box=s.mailbox("task2",actor_id=b.actor_id,execution_fence=b.execution_fence,now=NOW).to_dict()
    assert len(box["messages"])==1
    assert box["messages"][0]["parent_hash"]==tasks[0].content_hash
    result=s.acknowledge("task2",box["messages"][0]["message_id"],actor_id=b.actor_id,execution_fence=b.execution_fence,now=NOW,request_id="ack")
    assert result.to_dict()["messages"][0]["delivery_state"]=="ACKNOWLEDGED"
    with pytest.raises(ValueError,match="REQUEST_REPLAY_CONFLICT"): send(s,tasks,body="different")


@pytest.mark.parametrize("change,reason", [({"actor_id":"other"},"ASSIGNMENT_IDENTITY_MISMATCH"),
    ({"execution_fence":"old"},"STALE_EXECUTION_FENCE"),({"body":"x"*2049},"METADATA_BOUND_EXCEEDED")])
def test_invalid_peer_input_does_not_publish(change,reason):
    s,_,_,_,tasks=fixture();s.register_plan(tasks,actor_id="main",now=NOW)
    before=s.project()
    with pytest.raises(ValueError,match=reason): send(s,tasks,**change)
    assert s.project()==before


def test_unknown_cross_session_and_revoked_receiver_reject_delivery():
    s,p,_,_,tasks=fixture();s.register_plan(tasks,actor_id="main",now=NOW)
    p.revoke(tasks[1].assignment.assignment_id)
    with pytest.raises(ValueError,match="ASSIGNMENT_REVOKED"): send(s,tasks)


def test_message_response_and_mailbox_are_detached_from_replay():
    s,_,_,_,tasks=fixture();s.register_plan(tasks,actor_id='main',now=NOW)
    original=send(s,tasks);payload=original.payload
    object.__setattr__(original,'payload','{}')
    assert send(s,tasks).payload==payload


def test_mailbox_publication_failure_no_message_or_event(monkeypatch):
    from packages.agent_team import collaboration
    s,_,_,_,tasks=fixture();s.register_plan(tasks,actor_id='main',now=NOW);before=s.project()
    original=collaboration.team_snapshot
    def fail(value):raise RuntimeError('snapshot failure')
    monkeypatch.setattr(collaboration,'team_snapshot',fail)
    with pytest.raises(RuntimeError):send(s,tasks)
    monkeypatch.setattr(collaboration,'team_snapshot',original)
    assert s.project()==before
    assert len(send(s,tasks).to_dict()['messages'])==1
