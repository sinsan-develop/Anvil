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
