"""R3 runtime bundle writer is issued only after R2 lease revocation."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

from scripts import f18_wsl_ops_r3_overlay as overlay


def _state():
    now = datetime.now(timezone.utc)
    issued, expires = (now - timedelta(minutes=1)).isoformat(), (now + timedelta(hours=1)).isoformat()
    qa_head = "0f0ff0df5495edcec8a3e49cacea516e5d1de3c6"
    base = {"actor_id": overlay.ACTOR, "status": "ACTIVE",
            "execution_fencing_token": overlay.EXECUTION_TOKEN,
            "path_scope": overlay.write_paths(), "issued_at": issued,
            "expires_at": expires, "lease_epoch": 3,
            "baseline_git_commit": qa_head,
            "dispatch_head": qa_head}
    worker = {**base, "lease_id": overlay.WORKER}
    write = {**base, "lease_id": overlay.WRITE, "worker_lease_id": overlay.WORKER,
             "write_epoch": 3, "write_fencing_token": overlay.WRITE_TOKEN}
    return {"event_sequence": 1525, "status": "ACTIVE", "current_work_package": "F-18",
            "f18_overall_status": "IN_PROGRESS_WSL_OPS", "active_agent": overlay.ACTOR,
            "worker_lease": worker, "write_lease": write,
            "next_work_package": {"package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"},
            "active_work_instruction": {"path": overlay.WI, "sha256": "A" * 64,
                                        "invocation_path": overlay.INVOCATION,
                                        "invocation_sha256": "B" * 64},
            "repository": {"projection_mode": overlay.MODE, "branch": overlay.BRANCH,
                           "validated_base_commit": overlay.BASE,
                           "control_qa_head": qa_head,
                           "exact_allowed_paths": overlay.control_paths(),
                           "product_write_scope": overlay.write_paths()},
            "scope_revision_binding": {"approval_id": overlay.APPROVAL_ID,
                                       "production": "NOT_EXECUTED", "release_decision": "DEFER"}}


def test_r3_new_exact_lease_excludes_r2_and_expired_token():
    state = _state()
    assert overlay.validate_state(state, "A" * 64, "B" * 64) == []
    old = deepcopy(state)
    old["write_lease"]["lease_id"] = overlay.R2_WRITE
    assert overlay.validate_state(old, "A" * 64, "B" * 64)
    expired = deepcopy(state)
    expired["worker_lease"]["expires_at"] = "2020-01-01T00:00:00+00:00"
    assert overlay.validate_state(expired, "A" * 64, "B" * 64)


def test_r3_rejects_rebound_qa_even_when_both_leases_follow():
    state = _state()
    moved = "d27c5264a56c80ccf4f96571fcca15ec50ca93e7"
    state["repository"]["control_qa_head"] = moved
    for lease in (state["worker_lease"], state["write_lease"]):
        lease["baseline_git_commit"] = moved
        lease["dispatch_head"] = moved
    assert overlay.validate_state(state, "A" * 64, "B" * 64)


def test_r3_git_scope_rejects_outside_path():
    facts = dict(branch=overlay.BRANCH, upstream=f"development/{overlay.BRANCH}",
                 head="feature", remote_head="feature", staged=set(), dirty=set(),
                 changed=set(overlay.control_paths()), base_is_ancestor=True)
    assert overlay.validate_git_facts(**facts) == []
    assert overlay.validate_git_facts(**{**facts, "changed": facts["changed"] | {"unrelated"}})
    assert overlay.validate_git_facts(**{**facts, "changed": facts["changed"] | set(overlay.all_product_paths())}) == []


def test_r3_transition_rejects_changed_r2_revocation_after_rehash():
    root = Path(__file__).resolve().parents[2]
    rows = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    events = deepcopy(rows[:1520])
    wi_sha = overlay._sha((root / overlay.WI).read_bytes())
    invocation_sha = overlay._sha((root / overlay.INVOCATION).read_bytes())
    at = "2026-09-25T04:00:00+09:00"
    overlay._event(events, "WRITE_LEASE_REVOKED", {"lease_id": overlay.R2_WRITE}, at=at, step="WSL_OPS_R3_START")
    overlay._event(events, "WORKER_LEASE_REVOKED", {"lease_id": overlay.R2_WORKER}, at=at, step="WSL_OPS_R3_START")
    overlay._event(events, "WORK_INSTRUCTION_ISSUED", {"path": overlay.WI, "sha256": wi_sha,
        "invocation_path": overlay.INVOCATION, "invocation_sha256": invocation_sha,
        "control_qa_head": "a" * 40}, at=at, step="WSL_OPS_R3_START")
    overlay._event(events, "WORKER_LEASE_ISSUED", {"lease_id": overlay.WORKER,
        "actor_id": overlay.ACTOR, "execution_fencing_token": overlay.EXECUTION_TOKEN}, at=at, step="WSL_OPS_R3_START")
    overlay._event(events, "WRITE_LEASE_ISSUED", {"lease_id": overlay.WRITE,
        "worker_lease_id": overlay.WORKER, "write_fencing_token": overlay.WRITE_TOKEN,
        "path_scope": overlay.write_paths()}, at=at, step="WSL_OPS_R3_START")
    actual = events[1519:1525]
    assert overlay.validate_transition_events(actual, wi_sha, invocation_sha, "a" * 40) == []
    altered = deepcopy(actual)
    altered[1]["details"]["lease_id"] = "different-write"
    for index in range(2, len(altered)):
        altered[index]["previous_event_sha256"] = overlay._sha(overlay._canonical(altered[index - 1]))
    assert overlay.validate_transition_events(altered, wi_sha, invocation_sha, "a" * 40)
