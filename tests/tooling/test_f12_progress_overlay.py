import importlib.util
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "f12_progress_overlay", ROOT / "scripts/f12_progress_overlay.py"
)
OVERLAY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OVERLAY)


def test_f12_scopes_are_exact_and_disjoint():
    assert OVERLAY.BASE == "798ed952ad6900c87db2c0b2e1d6f71c2755f69c"
    assert OVERLAY.BRANCH == "codex/f12-provider-settings"
    assert len(OVERLAY.control_paths()) == len(set(OVERLAY.control_paths())) == 11
    assert len(OVERLAY.product_paths()) == len(set(OVERLAY.product_paths())) == 8
    assert len(OVERLAY.product_paths_r2()) == len(set(OVERLAY.product_paths_r2())) == 10
    assert set(OVERLAY.product_paths()).issubset(OVERLAY.product_paths_r2())
    assert set(OVERLAY.control_paths()).isdisjoint(OVERLAY.product_paths())
    assert set(OVERLAY.final_paths()) == set(OVERLAY.control_paths()) | {
        OVERLAY.REVIEW,
    } | set(OVERLAY.product_paths_r2())


def test_f12_materialize_issues_lease_and_blocks_successor(tmp_path, monkeypatch):
    for relative in (
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        OVERLAY.WI,
        OVERLAY.PROMPT,
    ):
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if relative.startswith("docs/progress/"):
            target.write_bytes(subprocess.check_output(
                ["git", "show", f"{OVERLAY.BASE}:{relative}"], cwd=ROOT
            ))
        else:
            target.write_bytes((ROOT / relative).read_bytes())

    captured = {}

    def capture(_root, progress, ledger, **_kwargs):
        captured["progress"] = progress
        captured["ledger"] = ledger

    monkeypatch.setattr(OVERLAY, "_write_projection", capture)
    OVERLAY.materialize(tmp_path)

    progress = captured["progress"]
    assert progress["event_sequence"] == 1436
    assert progress["current_work_package"] == "F-12"
    assert progress["worker_lease"]["lease_id"] == OVERLAY.WORKER
    assert progress["write_lease"]["lease_id"] == OVERLAY.WRITE
    assert progress["next_work_package"] == {
        "package_id": "F-13", "status": "BLOCKED_PENDING_F12_ACCEPTANCE"
    }
    assert [event["event_type"] for event in captured["ledger"]["events"][-3:]] == [
        "PACKAGE_STARTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED"
    ]


def test_f12_start_accepts_exact_precommit_state():
    assert OVERLAY.validate_start_git_facts(
        head=OVERLAY.BASE,
        branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}",
        remote_head=OVERLAY.BASE,
        staged=set(),
        dirty=set(OVERLAY.control_paths()),
        parents=[],
        changed=set(),
    ) == []


def test_f12_start_rejects_out_of_scope_path():
    assert OVERLAY.validate_start_git_facts(
        head=OVERLAY.BASE,
        branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}",
        remote_head=OVERLAY.BASE,
        staged=set(),
        dirty=set(OVERLAY.control_paths()) | {"unexpected.txt"},
        parents=[],
        changed=set(),
    ) == ["F12_START_GIT_INVALID"]


def test_f12_revision_replaces_write_lease_with_exact10(tmp_path, monkeypatch):
    for relative in ("docs/progress/build-progress.json", "docs/progress/progress-events.json",
                     OVERLAY.WI, OVERLAY.PROMPT):
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((ROOT / relative).read_bytes())
    captured = {}
    def capture(_root, progress, ledger, **_kwargs):
        captured["progress"] = progress
        captured["ledger"] = ledger
    monkeypatch.setattr(OVERLAY, "_write_projection", capture)
    OVERLAY.revise(tmp_path)
    progress = captured["progress"]
    assert progress["event_sequence"] == 1441
    assert progress["repository"]["projection_mode"] == OVERLAY.REVISION_MODE
    assert progress["write_lease"]["lease_id"] == OVERLAY.WRITE_R2
    assert progress["write_lease"]["write_epoch"] == 2
    assert progress["write_lease"]["path_scope"] == OVERLAY.product_paths_r2()
    assert progress["revoked_f12_r1_write_lease"]["status"] == "REVOKED"
    assert [event["event_type"] for event in captured["ledger"]["events"][-5:]] == [
        "WORK_INSTRUCTION_REVISED", "MAIN_RECONFIRMED_NON_SEMANTIC",
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_SCOPE_REVISED", "WRITE_LEASE_ISSUED"]


def test_f12_revision_start_accepts_multi_commit_history():
    assert OVERLAY.validate_start_git_facts(
        head="revision", branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}", remote_head="revision",
        staged=set(), dirty=set(OVERLAY.product_paths()), parents=["start"],
        changed=set(OVERLAY.control_paths()), base_is_ancestor=True,
        revision=True) == []


def test_f12_final_accepts_feature_postcommit():
    expected = set(OVERLAY.final_paths())
    assert OVERLAY.validate_final_git_facts(
        head="feature", branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}", remote_head="feature",
        staged=set(), dirty=set(), parents=["start"], changed=expected,
        base_is_ancestor=True, feature_paths=expected, merge_tree_matches_feature=False,
    ) == []


def test_f12_final_accepts_structural_main_merge_without_reconciliation_branch():
    expected = set(OVERLAY.final_paths())
    assert OVERLAY.validate_final_git_facts(
        head="merge", branch="main", upstream="development/main", remote_head="merge",
        staged=set(), dirty=set(), parents=[OVERLAY.BASE, "feature"], changed=set(),
        base_is_ancestor=True, feature_paths=expected, merge_tree_matches_feature=True,
    ) == []


def test_f12_final_rejects_squash_main():
    assert OVERLAY.validate_final_git_facts(
        head="squash", branch="main", upstream="development/main", remote_head="squash",
        staged=set(), dirty=set(), parents=[OVERLAY.BASE], changed=set(OVERLAY.final_paths()),
        base_is_ancestor=True, feature_paths=set(OVERLAY.final_paths()),
        merge_tree_matches_feature=True,
    ) == ["F12_FINAL_GIT_INVALID"]
