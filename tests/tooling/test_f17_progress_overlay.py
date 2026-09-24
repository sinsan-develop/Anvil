"""F-17 start projection is limited to declared control and product paths."""

from scripts.f17_progress_overlay import (
    BASE, BRANCH, control_paths, product_paths, validate_changed_scope,
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
