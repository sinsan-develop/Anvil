"""F-18 local/WSL-only start must not imply production acceptance."""

from scripts.f18_progress_overlay import (
    BASE, BRANCH, MODE, control_paths, product_paths,
    validate_start_git_facts, validate_start_state,
)


def test_f18_start_accepts_only_bounded_published_branch():
    paths = set(control_paths())
    facts = dict(branch=BRANCH, upstream=f"development/{BRANCH}",
                 head="feature-head", remote_head="feature-head",
                 staged=set(), dirty=set(), changed=paths,
                 base_is_ancestor=True)
    assert validate_start_git_facts(**facts) == []
    assert validate_start_git_facts(**{**facts, "branch": "main"})
    assert validate_start_git_facts(**{**facts, "dirty": {"other.txt"}})
    assert validate_start_git_facts(**{**facts, "changed": paths | {"other.txt"}})
    assert validate_start_git_facts(**{**facts, "base_is_ancestor": False})


def test_f18_start_state_explicitly_blocks_production_and_f19():
    progress = {"repository": {"projection_mode": MODE},
                "event_sequence": 1495, "current_work_package": "F-18",
                "status": "ACTIVE", "f18_overall_status": "IN_PROGRESS_LOCAL_WSL_ONLY",
                "next_work_package": {"package_id": "F-19",
                                      "status": "BLOCKED_PENDING_F18_ACCEPTANCE"},
                "worker_lease": {"lease_id": "worker-lease-f18-local-r1-20260924-001",
                                 "status": "ACTIVE"},
                "write_lease": {"lease_id": "write-lease-f18-local-r1-20260924-001",
                                "status": "ACTIVE",
                                "worker_lease_id": "worker-lease-f18-local-r1-20260924-001",
                                "path_scope": product_paths()}}
    assert validate_start_state(progress) == []
    assert validate_start_state({**progress, "f18_overall_status": "ACCEPTED"})
    assert validate_start_state({**progress, "next_work_package":
                                 {"package_id": "F-19", "status": "READY"}})


def test_f18_product_paths_are_local_preflight_only():
    assert len(product_paths()) == 5
    assert all(not path.startswith("deploy/ysna/") for path in product_paths())
