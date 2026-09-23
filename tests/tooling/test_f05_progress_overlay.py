import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "f05_progress_overlay", ROOT / "scripts/f05_progress_overlay.py"
)
OVERLAY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OVERLAY)


def test_f05_scopes_are_exact_and_disjoint():
    assert OVERLAY.BASE == "10c11d673f2195df19982b85e78b48f7220af6e0"
    assert OVERLAY.BRANCH == "codex/f05-mistral-adapter"
    assert len(OVERLAY.control_paths()) == len(set(OVERLAY.control_paths())) == 11
    assert len(OVERLAY.product_paths()) == len(set(OVERLAY.product_paths())) == 5
    assert set(OVERLAY.control_paths()).isdisjoint(OVERLAY.product_paths())
    assert set(OVERLAY.final_paths()) == set(OVERLAY.control_paths()) | {
        OVERLAY.REVIEW,
    } | set(OVERLAY.product_paths())


def test_f05_event_number_and_successor_contract():
    source = (ROOT / "scripts/f05_progress_overlay.py").read_text(encoding="utf-8")
    assert '"snapshot_id": "snapshot-f05-start-seq1380"' in source
    assert '"snapshot_id": "snapshot-f05-final-seq1385"' in source
    assert '"next_work_package": {"package_id": "F-06"' in source
    assert '"STREAM_ABORT_EMPTY_OUTPUT_CONTRACT"' in source
    assert '"FAILED_REQUEST_ID_INPUT_CONFLICT"' in source
    assert '"GENERATE_POST_SEND_ABORT_STATUS"' in source
    assert '"REQUEST_ID_PREFLIGHT_LENGTH"' in source


def test_f05_start_accepts_exact_precommit_state():
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


def test_f05_start_rejects_out_of_scope_path():
    assert OVERLAY.validate_start_git_facts(
        head=OVERLAY.BASE,
        branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}",
        remote_head=OVERLAY.BASE,
        staged=set(),
        dirty=set(OVERLAY.control_paths()) | {"unexpected.txt"},
        parents=[],
        changed=set(),
    ) == ["F05_START_GIT_INVALID"]


def test_f05_final_accepts_feature_postcommit():
    expected = set(OVERLAY.final_paths())
    assert OVERLAY.validate_final_git_facts(
        head="feature", branch=OVERLAY.BRANCH,
        upstream=f"development/{OVERLAY.BRANCH}", remote_head="feature",
        staged=set(), dirty=set(), parents=["start"], changed=expected,
        base_is_ancestor=True, feature_paths=expected, merge_tree_matches_feature=False,
    ) == []


def test_f05_final_accepts_structural_main_merge_without_reconciliation_branch():
    expected = set(OVERLAY.final_paths())
    assert OVERLAY.validate_final_git_facts(
        head="merge", branch="main", upstream="development/main", remote_head="merge",
        staged=set(), dirty=set(), parents=[OVERLAY.BASE, "feature"], changed=set(),
        base_is_ancestor=True, feature_paths=expected, merge_tree_matches_feature=True,
    ) == []


def test_f05_final_rejects_squash_main():
    assert OVERLAY.validate_final_git_facts(
        head="squash", branch="main", upstream="development/main", remote_head="squash",
        staged=set(), dirty=set(), parents=[OVERLAY.BASE], changed=set(OVERLAY.final_paths()),
        base_is_ancestor=True, feature_paths=set(OVERLAY.final_paths()),
        merge_tree_matches_feature=True,
    ) == ["F05_FINAL_GIT_INVALID"]
