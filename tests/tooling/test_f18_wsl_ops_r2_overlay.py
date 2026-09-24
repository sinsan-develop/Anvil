"""R2 dependency writer must replace, not overlap, the R1 lease."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

from scripts import f18_wsl_ops_r2_overlay as overlay


def _state():
    now = datetime.now(timezone.utc)
    issued, expires = (now - timedelta(minutes=1)).isoformat(), (now + timedelta(hours=1)).isoformat()
    worker = {"lease_id": overlay.WORKER, "actor_id": overlay.ACTOR,
              "status": "ACTIVE", "execution_fencing_token": overlay.EXECUTION_TOKEN,
              "path_scope": overlay.write_paths(), "issued_at": issued,
              "expires_at": expires, "lease_epoch": 2,
              "baseline_git_commit": "3b968e900b07d82f487090bf4de89748d057a221",
              "dispatch_head": "3b968e900b07d82f487090bf4de89748d057a221"}
    write = {"lease_id": overlay.WRITE, "actor_id": overlay.ACTOR,
             "status": "ACTIVE", "worker_lease_id": overlay.WORKER,
             "execution_fencing_token": overlay.EXECUTION_TOKEN,
             "write_fencing_token": overlay.WRITE_TOKEN,
             "path_scope": overlay.write_paths(), "issued_at": issued,
             "expires_at": expires, "lease_epoch": 2, "write_epoch": 2,
             "baseline_git_commit": "3b968e900b07d82f487090bf4de89748d057a221",
             "dispatch_head": "3b968e900b07d82f487090bf4de89748d057a221"}
    return {"event_sequence": 1520, "status": "ACTIVE", "current_work_package": "F-18",
            "f18_overall_status": "IN_PROGRESS_WSL_OPS", "active_agent": overlay.ACTOR,
            "worker_lease": worker, "write_lease": write,
            "next_work_package": {"package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"},
            "active_work_instruction": {"path": overlay.WI, "sha256": "A" * 64,
                                        "invocation_path": overlay.INVOCATION,
                                        "invocation_sha256": "B" * 64},
            "repository": {"projection_mode": overlay.MODE, "branch": overlay.BRANCH,
                           "validated_base_commit": overlay.BASE,
                           "exact_allowed_paths": overlay.control_paths(),
                           "product_write_scope": overlay.write_paths()},
            "scope_revision_binding": {"approval_id": overlay.APPROVAL_ID,
                                       "production": "NOT_EXECUTED", "release_decision": "DEFER"}}


def test_r2_requires_new_exact_lease_and_rejects_r1_scope():
    state = _state()
    assert overlay.validate_state(state, "A" * 64, "B" * 64) == []
    for field in ("lease_id", "write_fencing_token", "path_scope"):
        altered = deepcopy(state)
        altered["write_lease"][field] = "invalid"
        assert overlay.validate_state(altered, "A" * 64, "B" * 64)
    old = deepcopy(state)
    old["worker_lease"]["lease_id"] = overlay.R1_WORKER
    assert overlay.validate_state(old, "A" * 64, "B" * 64)
    assert overlay.validate_state(state, "C" * 64, "B" * 64)


def test_r2_git_scope_rejects_unrelated_and_staged():
    facts = dict(branch=overlay.BRANCH, upstream=f"development/{overlay.BRANCH}",
                 head="feature", remote_head="feature", staged=set(), dirty=set(),
                 changed=set(overlay.control_paths()), base_is_ancestor=True)
    assert overlay.validate_git_facts(**facts) == []
    assert overlay.validate_git_facts(**{**facts, "changed": facts["changed"] | {"unrelated"}})
    assert overlay.validate_git_facts(**{**facts, "staged": {"pyproject.toml"}})
    assert overlay.validate_git_facts(**{**facts, "changed": facts["changed"] | set(overlay.all_product_paths())}) == []


def test_r2_rejects_expired_or_wrong_epoch_active_lease():
    state = _state()
    expired = deepcopy(state)
    expired["write_lease"]["expires_at"] = "2020-01-01T00:00:00+00:00"
    assert overlay.validate_state(expired, "A" * 64, "B" * 64)
    wrong_epoch = deepcopy(state)
    wrong_epoch["worker_lease"]["lease_epoch"] = 1
    assert overlay.validate_state(wrong_epoch, "A" * 64, "B" * 64)


def test_r2_transition_requires_exact_revocation_and_issuance_sequence():
    root = Path(__file__).resolve().parents[2]
    rows = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    original = deepcopy(rows[1514:1520])
    wi_sha = overlay._sha((root / overlay.WI).read_bytes())
    invocation_sha = overlay._sha((root / overlay.INVOCATION).read_bytes())
    assert overlay.validate_transition_events(original, wi_sha, invocation_sha) == []
    tampered = deepcopy(original)
    tampered[1]["event_type"] = "WRITE_LEASE_ISSUED"
    for index in range(2, len(tampered)):
        tampered[index]["previous_event_sha256"] = overlay._sha(overlay._canonical(tampered[index - 1]))
    assert overlay.validate_transition_events(tampered, wi_sha, invocation_sha)
    wrong_target = deepcopy(original)
    wrong_target[2]["details"]["lease_id"] = "different-worker"
    for index in range(3, len(wrong_target)):
        wrong_target[index]["previous_event_sha256"] = overlay._sha(overlay._canonical(wrong_target[index - 1]))
    assert overlay.validate_transition_events(wrong_target, wi_sha, invocation_sha)
