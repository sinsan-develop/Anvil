"""F-14 control projection is restricted to the one active branch and lease."""

from scripts.f14_progress_overlay import (
    BASE, BRANCH, FINAL_MODE, control_paths, final_paths, product_paths,
    validate_final_git_facts, validate_start_git_facts,
)


def test_f14_start_accepts_exact_control_then_scoped_product_dirty():
    control, product = set(control_paths()), set(product_paths())
    common = dict(branch=BRANCH, upstream=f"development/{BRANCH}", remote_head=BASE,
                  staged=set())
    assert not validate_start_git_facts(head=BASE, changed=set(), dirty=control, **common)
    assert not validate_start_git_facts(head="f" * 40, changed=control, dirty=product,
                                        base_is_ancestor=True, **common)
    assert not validate_start_git_facts(head="f" * 40, changed=control | product,
                                        dirty=product, base_is_ancestor=True, **common)
    assert not validate_start_git_facts(head="f" * 40, changed=control | product,
                                        dirty=product, remote_head="e" * 40,
                                        remote_is_ancestor=True, branch=BRANCH,
                                        upstream=f"development/{BRANCH}", staged=set())


def test_f14_start_rejects_foreign_branch_and_unleased_file():
    common = dict(head=BASE, upstream=f"development/{BRANCH}", remote_head=BASE,
                  staged=set(), changed=set())
    assert validate_start_git_facts(branch="main", dirty=set(control_paths()), **common)
    assert validate_start_git_facts(branch=BRANCH,
        dirty=set(control_paths()) | {"packages/queue/service.py"}, **common)
    assert validate_start_git_facts(head="f" * 40, branch=BRANCH,
        dirty=set(product_paths()), changed=set(control_paths()) | set(product_paths())
        | {"packages/queue/service.py"}, remote_head=BASE,
        upstream=f"development/{BRANCH}", staged=set())


def test_f14_final_scope_and_clean_feature_or_merged_main():
    exact = set(control_paths()) | set(product_paths())
    assert FINAL_MODE == "F14_FINAL_ACCEPTANCE_EXACT23"
    assert set(final_paths()) == exact
    common = dict(staged=set(), dirty=set(), feature_paths=exact,
                  base_is_ancestor=True)
    assert not validate_final_git_facts(head="f" * 40, branch=BRANCH,
        upstream=f"development/{BRANCH}", remote_head="f" * 40,
        parents=["e" * 40], merge_tree_matches_feature=False, **common)
    assert not validate_final_git_facts(head="d" * 40, branch="main",
        upstream="development/main", remote_head="d" * 40,
        parents=[BASE, "f" * 40], merge_tree_matches_feature=True, **common)
    assert validate_final_git_facts(head="d" * 40, branch="main",
        upstream="development/main", remote_head="d" * 40,
        parents=[BASE, "f" * 40], merge_tree_matches_feature=False, **common)
    assert validate_final_git_facts(head="f" * 40, branch=BRANCH,
        upstream=f"development/{BRANCH}", remote_head="f" * 40,
        parents=["e" * 40], merge_tree_matches_feature=False,
        **{**common, "feature_paths": exact | {"unleased.py"}})
