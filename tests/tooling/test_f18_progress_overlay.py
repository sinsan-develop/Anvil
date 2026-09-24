"""F-18 local/WSL-only start must not imply production acceptance."""

from scripts.f18_progress_overlay import (
    BASE, BRANCH, MODE, control_paths, product_paths,
    validate_start_git_facts, validate_start_state, validate_final_state,
    r2_product_paths, validate_r2_start_state, validate_r2_final_state,
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


def test_f18_checkpoint_revokes_writer_without_accepting_production():
    progress = {"repository": {"projection_mode": "F18_LOCAL_WSL_CHECKPOINT_EXACT11_PRODUCT_EXACT5"},
                "event_sequence": 1498, "current_work_package": "F-18",
                "status": "PAUSED", "f18_overall_status": "PARTIAL_LOCAL_WSL_VERIFIED",
                "active_agent": None, "worker_lease": None, "write_lease": None,
                "next_work_package": {"package_id": "F-19",
                                      "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}}
    assert validate_final_state(progress) == []
    assert validate_final_state({**progress, "status": "ACCEPTED"})
    assert validate_final_state({**progress, "write_lease": {"status": "ACTIVE"}})
    assert validate_final_state({**progress, "next_work_package":
                                 {"package_id": "F-19", "status": "READY"}})


def test_f18_r2_start_issues_exact_read_only_git_guard_scope():
    assert r2_product_paths() == sorted([
        "packages/deployment/promotion_preflight.py",
        "tests/deploy/test_f18_promotion_preflight.py",
        "docs/04_test_reports/F-18_LOCAL_WSL_PREFLIGHT_REPORT.md",
    ])
    progress = {"repository": {"projection_mode": "F18_LOCAL_WSL_R2_START_EXACT3"},
                "event_sequence": 1501, "current_work_package": "F-18",
                "status": "ACTIVE", "f18_overall_status": "IN_PROGRESS_LOCAL_WSL_ONLY",
                "next_work_package": {"package_id": "F-19",
                                      "status": "BLOCKED_PENDING_F18_ACCEPTANCE"},
                "worker_lease": {"lease_id": "worker-lease-f18-local-r2-20260924-001",
                                 "status": "ACTIVE"},
                "write_lease": {"lease_id": "write-lease-f18-local-r2-20260924-001",
                                "status": "ACTIVE",
                                "worker_lease_id": "worker-lease-f18-local-r2-20260924-001",
                                "path_scope": r2_product_paths()}}
    assert validate_r2_start_state(progress) == []
    assert validate_r2_start_state({**progress, "status": "ACCEPTED"})
    assert validate_r2_start_state({**progress, "write_lease": None})


def test_f18_r2_checkpoint_revokes_writer_and_keeps_f19_blocked():
    progress = {"repository": {"projection_mode": "F18_LOCAL_WSL_R2_CHECKPOINT_EXACT3"},
                "event_sequence": 1504, "current_work_package": "F-18",
                "status": "PAUSED", "f18_overall_status": "PARTIAL_LOCAL_WSL_VERIFIED",
                "active_agent": None, "worker_lease": None, "write_lease": None,
                "next_work_package": {"package_id": "F-19",
                                      "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}}
    assert validate_r2_final_state(progress) == []
    assert validate_r2_final_state({**progress, "status": "ACCEPTED"})
