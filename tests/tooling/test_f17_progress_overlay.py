"""F-17 start projection is limited to declared control and product paths."""

from scripts.f17_progress_overlay import (
    BASE, BRANCH, FINAL_MODE, control_paths, product_paths,
    validate_changed_scope, validate_final_contract, validate_final_git_facts,
    validate_start_git_facts,
)


def test_f17_scope_rejects_missing_control_and_unrelated_paths():
    controls = set(control_paths())
    assert len(controls) == 13 and len(product_paths()) == 5
    assert validate_changed_scope(controls)
    assert validate_changed_scope(controls | set(product_paths()))
    assert not validate_changed_scope(controls - {"docs/WORK_STATUS.md"})
    assert not validate_changed_scope(controls | {"deploy/ysna/rollback.sh"})


def test_f17_clean_base_and_published_head_require_exact_branch():
    base = dict(branch=BRANCH, upstream=f"development/{BRANCH}", head=BASE,
        remote_head=BASE, staged=set(), dirty=set(control_paths()), changed=set(),
        base_is_ancestor=True, remote_is_ancestor=True)
    assert validate_start_git_facts(**base) == []
    assert validate_start_git_facts(**{**base, "dirty": {"unknown.md"}})
    feature = {**base, "head": "feature-head", "remote_head": "feature-head",
               "dirty": set(), "changed": set(control_paths())}
    assert validate_start_git_facts(**feature) == []
    assert validate_start_git_facts(**{**feature, "branch": "main"})
    assert validate_start_git_facts(**{**feature, "remote_head": "wrong",
                                     "remote_is_ancestor": False})


def test_f17_final_contract_requires_acceptance_and_released_leases():
    progress = {"repository": {"projection_mode": FINAL_MODE},
                "event_sequence": 1491, "status": "ACCEPTED",
                "current_work_package": "F-17", "worker_lease": None,
                "write_lease": None, "active_agent": None,
                "completed_packages": ["F-17"]}
    ledger = {"last_sequence": 1491,
              "events": [{"event_type": kind} for kind in
                         ("PACKAGE_COMPLETED", "INDEPENDENT_TEST_JUDGMENT_RECORDED",
                          "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED",
                          "MAIN_PACKAGE_ACCEPTED")]}
    manifest = {"accepted": True, "projection_mode": FINAL_MODE,
                "product_head": "7083e2aa90ced5bb109fd268cf22e34de34ff6d9",
                "runtime_boundary": {"shared_pg15": "PASS_F17_SCOPE",
                    "isolated_pg18": "PASS_F17_SCOPE",
                    "actual_e2e": "PASS_SAME_GIT_IMAGE",
                    "browser": "PASS_DASHBOARD_NETWORK_SCOPE",
                    "production": "NOT_EXECUTED"}}
    assert validate_final_contract(progress, ledger, manifest) == []
    assert validate_final_contract({**progress, "write_lease": {"status": "ACTIVE"}},
                                   ledger, manifest)
    assert validate_final_contract(progress, ledger,
                                   {**manifest, "runtime_boundary": {}})


def test_f17_final_git_allows_exact_merged_main_and_rejects_wrong_tree():
    paths = set(control_paths()) | set(product_paths())
    facts = dict(branch=BRANCH, upstream=f"development/{BRANCH}",
                 remote_head="feature-head", head="feature-head",
                 staged=set(), dirty=set(), changed=paths,
                 parents=["merged-main-parent"], base_is_ancestor=True,
                 first_parent_contains_base=False,
                 merge_tree_matches_feature=False)
    assert validate_final_git_facts(**facts) == []
    merged = {**facts, "branch": "main", "upstream": "development/main",
              "head": "merged-main", "remote_head": "merged-main",
              "parents": ["merged-main-parent", "feature-head"],
              "first_parent_contains_base": True,
              "merge_tree_matches_feature": True}
    assert validate_final_git_facts(**merged) == []
    assert validate_final_git_facts(**{**merged, "merge_tree_matches_feature": False})
    assert validate_final_git_facts(**{**merged, "first_parent_contains_base": False})
    assert validate_final_git_facts(**{**merged, "dirty": {"scratch.txt"}})
