import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "f03_progress_overlay", ROOT / "scripts/f03_progress_overlay.py"
)
OVERLAY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OVERLAY)


def test_f03_start_scopes_are_exact_and_disjoint():
    assert len(OVERLAY.control_paths()) == len(set(OVERLAY.control_paths())) == 9
    assert len(OVERLAY.product_paths()) == len(set(OVERLAY.product_paths())) == 5
    assert set(OVERLAY.control_paths()).isdisjoint(OVERLAY.product_paths())


def test_f03_start_accepts_exact_precommit_state():
    assert OVERLAY.validate_git_facts(
        head=OVERLAY.BASE,
        branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}",
        remote_head=OVERLAY.BASE,
        staged=set(),
        dirty=set(OVERLAY.control_paths()),
        parent=None,
        committed=None,
    ) == []


def test_f03_start_accepts_control_commit_with_product_dirty_only():
    assert OVERLAY.validate_git_facts(
        head="control",
        branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}",
        remote_head=OVERLAY.BASE,
        staged=set(),
        dirty=set(OVERLAY.product_paths()),
        parent=OVERLAY.BASE,
        committed=set(OVERLAY.control_paths()),
    ) == []


def test_f03_start_rejects_out_of_scope_dirty_path():
    assert OVERLAY.validate_git_facts(
        head=OVERLAY.BASE,
        branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}",
        remote_head=OVERLAY.BASE,
        staged=set(),
        dirty=set(OVERLAY.control_paths()) | {"unexpected.txt"},
        parent=None,
        committed=None,
    ) == ["F03_START_GIT_INVALID"]


def test_f03_final_scopes_include_review_and_exact5_product():
    assert len(OVERLAY.final_control_paths()) == 10
    assert len(OVERLAY.final_paths()) == 15
    assert set(OVERLAY.final_paths()) == set(OVERLAY.final_control_paths()) | set(OVERLAY.product_paths())


def test_f03_final_accepts_exact_precommit_state():
    assert OVERLAY.validate_final_git_facts(
        head=OVERLAY.START_COMMIT,
        branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}",
        remote_head=OVERLAY.START_COMMIT,
        staged=set(),
        dirty=set(OVERLAY.final_paths()),
        parent=None,
        committed=None,
    ) == []


def test_f03_final_accepts_exact_postcommit_state():
    assert OVERLAY.validate_final_git_facts(
        head="final",
        branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}",
        remote_head="final",
        staged=set(),
        dirty=set(),
        parent=OVERLAY.START_COMMIT,
        committed=set(OVERLAY.final_paths()),
    ) == []


def test_f03_merged_reconciliation_accepts_work_branch_precommit():
    assert OVERLAY.validate_merged_git_facts(
        head=OVERLAY.MERGED_BASE,
        branch=OVERLAY.MERGED_BRANCH,
        upstream=f"development/{OVERLAY.MERGED_BRANCH}",
        remote_head=OVERLAY.MERGED_BASE,
        staged=set(), dirty=set(OVERLAY.merged_paths()), parents=[], changed=set(),
    ) == []


def test_f03_merged_reconciliation_accepts_structural_main_merge():
    assert OVERLAY.validate_merged_git_facts(
        head="merge", branch="main", upstream="development/main", remote_head="merge",
        staged=set(), dirty=set(), parents=[OVERLAY.MERGED_BASE, "feature"], changed=set(),
        base_is_ancestor_of_feature=True, feature_paths=set(OVERLAY.merged_paths()),
        merge_tree_matches_feature=True,
    ) == []


def test_f03_merged_reconciliation_rejects_squash_main():
    assert OVERLAY.validate_merged_git_facts(
        head="squash", branch="main", upstream="development/main", remote_head="squash",
        staged=set(), dirty=set(), parents=[OVERLAY.MERGED_BASE], changed=set(OVERLAY.merged_paths()),
    ) == ["F03_MERGED_GIT_INVALID"]
