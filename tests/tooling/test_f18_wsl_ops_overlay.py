"""F-18 WSL operational writer is fenced to its exact first task."""

from copy import deepcopy

from scripts import f18_wsl_ops_overlay as overlay


def _state():
    worker = {"lease_id": overlay.WORKER, "actor_id": overlay.ACTOR,
              "status": "ACTIVE", "execution_fencing_token": overlay.EXECUTION_TOKEN,
              "path_scope": overlay.product_paths()}
    write = {"lease_id": overlay.WRITE, "actor_id": overlay.ACTOR,
             "status": "ACTIVE", "worker_lease_id": overlay.WORKER,
             "execution_fencing_token": overlay.EXECUTION_TOKEN,
             "write_fencing_token": overlay.WRITE_TOKEN,
             "path_scope": overlay.product_paths()}
    return {"event_sequence": 1515, "status": "ACTIVE", "current_work_package": "F-18",
            "f18_overall_status": "IN_PROGRESS_WSL_OPS", "active_agent": overlay.ACTOR,
            "worker_lease": worker, "write_lease": write,
            "next_work_package": {"package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"},
            "active_work_instruction": {"path": overlay.WI, "sha256": "A" * 64,
                                        "invocation_path": overlay.INVOCATION,
                                        "invocation_sha256": "B" * 64},
            "repository": {"projection_mode": overlay.MODE, "branch": overlay.BRANCH,
                           "validated_base_commit": overlay.BASE,
                           "exact_allowed_paths": overlay.control_paths(),
                           "product_write_scope": overlay.product_paths()},
            "scope_revision_binding": {"approval_id": overlay.APPROVAL_ID,
                                       "production": "NOT_EXECUTED", "release_decision": "DEFER"}}


def test_start_state_requires_exact_leases_and_instruction_hash():
    state = _state()
    assert overlay.validate_state(state, "A" * 64, "B" * 64) == []
    for change in ("path_scope", "worker_lease_id", "write_fencing_token"):
        altered = deepcopy(state)
        altered["write_lease"][change] = "invalid"
        assert overlay.validate_state(altered, "A" * 64, "B" * 64)
    assert overlay.validate_state(state, "C" * 64, "B" * 64)
    promoted = deepcopy(state)
    promoted["scope_revision_binding"]["production"] = "PASS"
    assert overlay.validate_state(promoted, "A" * 64, "B" * 64)
    wrong_approval = deepcopy(state)
    wrong_approval["scope_revision_binding"]["approval_id"] = "other"
    assert overlay.validate_state(wrong_approval, "A" * 64, "B" * 64)


def test_git_scope_rejects_unrelated_and_dirty_control():
    facts = dict(branch=overlay.BRANCH, upstream=f"development/{overlay.BRANCH}",
                 head="feature", remote_head="feature", staged=set(), dirty=set(),
                 changed=set(overlay.control_paths()), base_is_ancestor=True)
    assert overlay.validate_git_facts(**facts) == []
    assert overlay.validate_git_facts(**{**facts, "changed": facts["changed"] | {"unrelated"}})
    assert overlay.validate_git_facts(**{**facts, "dirty": {"docs/progress/build-progress.json"}})
    assert overlay.validate_git_facts(**{**facts, "changed": facts["changed"] | set(overlay.product_paths())}) == []
