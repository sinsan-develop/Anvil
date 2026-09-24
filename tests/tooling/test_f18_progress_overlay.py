"""F-18 local/WSL-only start must not imply production acceptance."""

import json
from pathlib import Path
import subprocess

import scripts.f18_progress_overlay as overlay
from scripts.f18_progress_overlay import (
    BASE, BRANCH, MODE, control_paths, product_paths,
    validate_start_git_facts, validate_start_state, validate_final_state,
    r2_product_paths, validate_r2_start_state, validate_r2_final_state,
    r3_product_paths, validate_r3_start_state, validate_r3_final_state,
)


def _real_merged_git_facts(tmp_path: Path, monkeypatch, *, main_drift=False, post_qa_code=False):
    repo = tmp_path / "repo"
    repo.mkdir(parents=True)

    def git(*args):
        return subprocess.check_output(["git", *args], cwd=repo, text=True).strip()

    git("init", "-b", "main")
    git("config", "user.name", "F18 QA")
    git("config", "user.email", "f18-qa@example.invalid")
    paths = set(control_paths()) | set(product_paths()) | set(r3_product_paths())
    for relative in paths | {"unrelated.txt"}:
        path = repo / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("base\n", encoding="utf-8")
    git("add", "--all")
    git("commit", "-m", "base")
    base = git("rev-parse", "HEAD")
    monkeypatch.setattr(overlay, "BASE", base)

    git("checkout", "-b", BRANCH)
    for relative in paths:
        (repo / relative).write_text("feature\n", encoding="utf-8")
    (repo / "docs/progress/build-progress.json").write_text(json.dumps({
        "repository": {"projection_mode": overlay.R3_FINAL_MODE, "local_head": base}
    }), encoding="utf-8")
    git("add", "--all")
    git("commit", "-m", "qa code")
    qa_head = git("rev-parse", "HEAD")
    (repo / "docs/progress/build-progress.json").write_text(json.dumps({
        "repository": {"projection_mode": overlay.R3_FINAL_MODE,
                       "local_head": base, "local_wsl_qa_head": qa_head}
    }), encoding="utf-8")
    git("add", "docs/progress/build-progress.json")
    git("commit", "-m", "record qa")
    if post_qa_code:
        (repo / "scripts/f18_progress_overlay.py").write_text("untested code\n", encoding="utf-8")
        git("add", "scripts/f18_progress_overlay.py")
        git("commit", "-m", "untested code")

    git("checkout", "main")
    if main_drift:
        (repo / "unrelated.txt").write_text("main drift\n", encoding="utf-8")
        git("add", "unrelated.txt")
        git("commit", "-m", "main drift")
        git("merge", "--no-ff", "--no-commit", BRANCH)
        (repo / "unrelated.txt").write_text("base\n", encoding="utf-8")
        git("add", "unrelated.txt")
        git("commit", "-m", "merge discarding drift")
    else:
        git("merge", "--no-ff", "--no-edit", BRANCH)
    git("remote", "add", "development", str(repo))
    git("update-ref", "refs/remotes/development/main", git("rev-parse", "HEAD"))
    git("branch", "--set-upstream-to=development/main", "main")
    return overlay.collect_git(repo)


def test_f18_real_git_merge_accepts_only_tested_code_and_unchanged_main(tmp_path, monkeypatch):
    assert _real_merged_git_facts(tmp_path / "valid", monkeypatch) == []


def test_f18_real_git_merge_rejects_main_drift_hidden_by_merge_tree(tmp_path, monkeypatch):
    assert _real_merged_git_facts(tmp_path / "drift", monkeypatch, main_drift=True)


def test_f18_real_git_merge_rejects_code_commit_after_wsl_qa(tmp_path, monkeypatch):
    assert _real_merged_git_facts(tmp_path / "untested", monkeypatch, post_qa_code=True)


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


def test_f18_local_checkpoint_accepts_only_exact_merged_main_tree():
    paths = set(control_paths()) | set(r3_product_paths()) | set(r2_product_paths()) | set(product_paths())
    facts = dict(branch="main", upstream="development/main", head="merged-head",
                 remote_head="merged-head", staged=set(), dirty=set(), changed=paths,
                 base_is_ancestor=True, allow_merged_main=True,
                 allowed_product_paths=sorted(set(product_paths()) | set(r3_product_paths())),
                 parents=("main-parent", "feature-parent"),
                 first_parent_contains_base=True, first_parent_is_base=True,
                 merge_tree_matches_feature=True,
                 feature_contains_checkpoint=True, qa_head_bound=True,
                 post_qa_changed={"docs/WORK_STATUS.md"}, require_qa_binding=True)
    assert validate_start_git_facts(**facts) == []
    assert validate_start_git_facts(**{**facts, "merge_tree_matches_feature": False})
    assert validate_start_git_facts(**{**facts, "parents": ("main-parent",)})
    assert validate_start_git_facts(**{**facts, "first_parent_contains_base": False})
    assert validate_start_git_facts(**{**facts, "first_parent_is_base": False})
    assert validate_start_git_facts(**{**facts, "feature_contains_checkpoint": False})
    assert validate_start_git_facts(**{**facts, "qa_head_bound": False})
    assert validate_start_git_facts(**{**facts, "post_qa_changed": {"scripts/f18_progress_overlay.py"}})
    assert validate_start_git_facts(**{**facts, "allow_merged_main": False})
    assert validate_start_git_facts(**{**facts, "dirty": {"docs/WORK_STATUS.md"}})
    assert validate_start_git_facts(**{**facts, "changed": paths | {"unrelated.txt"}})


def test_f18_final_feature_requires_bound_wsl_qa_without_later_code_changes():
    paths = set(control_paths()) | set(product_paths()) | set(r3_product_paths())
    facts = dict(branch=BRANCH, upstream=f"development/{BRANCH}",
                 head="feature-head", remote_head="feature-head", staged=set(),
                 dirty=set(), changed=paths, base_is_ancestor=True,
                 allowed_product_paths=sorted(set(product_paths()) | set(r3_product_paths())),
                 require_qa_binding=True, qa_head_bound=True,
                 post_qa_changed={"docs/WORK_STATUS.md"})
    assert validate_start_git_facts(**facts) == []
    assert validate_start_git_facts(**{**facts, "qa_head_bound": False})
    assert validate_start_git_facts(**{**facts, "post_qa_changed": {"tests/tooling/test_f18_progress_overlay.py"}})


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


def test_f18_r3_cli_start_is_bounded_and_not_production_acceptance():
    assert r3_product_paths() == sorted([
        "packages/deployment/production_preflight_cli.py",
        "tests/deploy/test_f18_production_preflight_cli.py",
        "docs/04_test_reports/F-18_LOCAL_WSL_PREFLIGHT_REPORT.md",
    ])
    progress = {"repository": {"projection_mode": "F18_LOCAL_WSL_R3_START_EXACT3"},
                "event_sequence": 1507, "current_work_package": "F-18",
                "status": "ACTIVE", "f18_overall_status": "IN_PROGRESS_LOCAL_WSL_ONLY",
                "next_work_package": {"package_id": "F-19",
                                      "status": "BLOCKED_PENDING_F18_ACCEPTANCE"},
                "worker_lease": {"lease_id": "worker-lease-f18-local-r3-20260924-001",
                                 "status": "ACTIVE"},
                "write_lease": {"lease_id": "write-lease-f18-local-r3-20260924-001",
                                "status": "ACTIVE",
                                "worker_lease_id": "worker-lease-f18-local-r3-20260924-001",
                                "path_scope": r3_product_paths()}}
    assert validate_r3_start_state(progress) == []
    assert validate_r3_start_state({**progress, "status": "ACCEPTED"})


def test_f18_r3_cli_checkpoint_revokes_writer_and_blocks_f19():
    progress = {"repository": {"projection_mode": "F18_LOCAL_WSL_R3_CHECKPOINT_EXACT3"},
                "event_sequence": 1510, "current_work_package": "F-18",
                "status": "PAUSED", "f18_overall_status": "PARTIAL_LOCAL_WSL_VERIFIED",
                "active_agent": None, "worker_lease": None, "write_lease": None,
                "next_work_package": {"package_id": "F-19",
                                      "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}}
    assert validate_r3_final_state(progress) == []
    assert validate_r3_final_state({**progress, "status": "ACCEPTED"})


def test_successor_integration_rejects_unbounded_git_facts():
    controls = {
        "docs/WORK_STATUS.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json", "docs/progress/BUILD_HANDOFF.md",
        overlay.DIGEST, overlay.MANIFEST,
        "scripts/f18_progress_overlay.py", "tests/tooling/test_f18_progress_overlay.py",
        "scripts/check_project_progress.py",
        "docs/work_orders/F-18_F-19_LOCAL_INTEGRATION_PLAN.md",
    }
    products = {
        "pyproject.toml", "uv.lock", "packages/provider_catalog/service.py",
        "docs/04_test_reports/F-19_LOCAL_PROVIDER_SECURITY_PRECHECK_REPORT.md",
    }
    facts = dict(branch="codex/f19-test-dependency",
                 upstream="development/codex/f19-test-dependency",
                 head="feature", remote_head="feature", staged=set(), dirty=set(),
                 changed=controls | products, base_is_ancestor=True,
                 expected_branch="codex/f19-test-dependency",
                 required_control_paths=controls, allowed_product_paths=products,
                 require_clean_feature=True,
                 require_qa_binding=True, qa_head_bound=True,
                 post_qa_allowed_paths=controls - {
                     "scripts/f18_progress_overlay.py", "tests/tooling/test_f18_progress_overlay.py",
                     "scripts/check_project_progress.py",
                     "docs/work_orders/F-18_F-19_LOCAL_INTEGRATION_PLAN.md"} |
                     {"docs/04_test_reports/F-19_LOCAL_PROVIDER_SECURITY_PRECHECK_REPORT.md"},
                 post_qa_changed={"docs/WORK_STATUS.md"})
    assert validate_start_git_facts(**facts) == []
    assert validate_start_git_facts(**{**facts, "changed": facts["changed"] | {"unrelated"}})
    assert validate_start_git_facts(**{**facts, "qa_head_bound": False})
    assert validate_start_git_facts(**{**facts, "post_qa_changed": {"pyproject.toml"}})
    assert validate_start_git_facts(**{**facts, "dirty": {"pyproject.toml"}})


def test_git_porcelain_parser_preserves_leading_status_column():
    assert overlay.parse_git_porcelain_paths(
        " M docs/WORK_STATUS.md\n?? docs/new.md\n") == {
            "docs/WORK_STATUS.md", "docs/new.md"}


def test_successor_integration_keeps_formal_acceptance_blocked():
    base = {"repository": {"projection_mode": overlay.SUCCESSOR_MODE,
                           "validated_base_commit": overlay.SUCCESSOR_BASE,
                           "branch": overlay.SUCCESSOR_BRANCH,
                           "exact_allowed_paths": overlay.successor_control_paths(),
                           "product_write_scope": overlay.successor_product_paths()},
            "event_sequence": 1511, "current_work_package": "F-18",
            "status": "PAUSED", "f18_overall_status": "PARTIAL_LOCAL_WSL_VERIFIED",
            "active_agent": None, "worker_lease": None, "write_lease": None,
            "next_work_package": {"package_id": "F-19",
                                  "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}}
    assert overlay.validate_successor_state(base) == []
    assert overlay.validate_successor_state({**base, "f18_overall_status": "ACCEPTED"})
    assert overlay.validate_successor_state({**base, "next_work_package":
        {"package_id": "F-19", "status": "READY"}})


def test_successor_real_merge_rejects_main_drift_and_post_qa_code(tmp_path, monkeypatch):
    def scenario(name, *, drift=False, late_code=False):
        repo = tmp_path / name
        repo.mkdir()

        def git(*args):
            return subprocess.check_output(["git", *args], cwd=repo, text=True).strip()

        git("init", "-b", "main")
        git("config", "user.name", "Successor QA")
        git("config", "user.email", "successor-qa@example.invalid")
        scope = set(overlay.successor_control_paths()) | set(overlay.successor_product_paths())
        for relative in scope | {"unrelated.txt"}:
            path = repo / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("base\n", encoding="utf-8")
        git("add", "--all")
        git("commit", "-m", "base")
        base = git("rev-parse", "HEAD")
        monkeypatch.setattr(overlay, "SUCCESSOR_BASE", base)
        git("checkout", "-b", overlay.SUCCESSOR_BRANCH)
        for relative in scope:
            (repo / relative).write_text("feature\n", encoding="utf-8")
        (repo / "docs/progress/build-progress.json").write_text(json.dumps({
            "repository": {"projection_mode": overlay.SUCCESSOR_MODE,
                           "local_head": base}}), encoding="utf-8")
        git("add", "--all")
        git("commit", "-m", "qa code")
        qa = git("rev-parse", "HEAD")
        (repo / "docs/progress/build-progress.json").write_text(json.dumps({
            "repository": {"projection_mode": overlay.SUCCESSOR_MODE,
                           "local_head": base, "local_wsl_qa_head": qa}}), encoding="utf-8")
        git("add", "docs/progress/build-progress.json")
        git("commit", "-m", "bind qa")
        if late_code:
            (repo / "packages/provider_catalog/service.py").write_text("late\n", encoding="utf-8")
            git("add", "packages/provider_catalog/service.py")
            git("commit", "-m", "late code")
        git("checkout", "main")
        if drift:
            (repo / "unrelated.txt").write_text("drift\n", encoding="utf-8")
            git("add", "unrelated.txt")
            git("commit", "-m", "drift")
            git("merge", "--no-ff", "--no-commit", overlay.SUCCESSOR_BRANCH)
            (repo / "unrelated.txt").write_text("base\n", encoding="utf-8")
            git("add", "unrelated.txt")
            git("commit", "-m", "merge hiding drift")
        else:
            git("merge", "--no-ff", "--no-edit", overlay.SUCCESSOR_BRANCH)
        git("remote", "add", "development", str(repo))
        git("update-ref", "refs/remotes/development/main", git("rev-parse", "HEAD"))
        git("branch", "--set-upstream-to=development/main", "main")
        return overlay.collect_git(repo)

    assert scenario("valid") == []
    assert scenario("drift", drift=True)
    assert scenario("late", late_code=True)
