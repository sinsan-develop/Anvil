"""F-13 control projection must be scoped to its one work branch."""

from scripts.f13_progress_overlay import BASE, BRANCH, control_paths, product_paths, validate_start_git_facts


def test_f13_start_accepts_exact_control_and_then_scoped_product_dirty():
    control = set(control_paths())
    product = set(product_paths())
    common = dict(branch=BRANCH, upstream=f"development/{BRANCH}", remote_head=BASE, staged=set())
    assert not validate_start_git_facts(head=BASE, changed=set(), dirty=control, **common)
    assert not validate_start_git_facts(
        head="f" * 40, changed=control, dirty=product, base_is_ancestor=True, **common
    )


def test_f13_start_rejects_foreign_branch_and_unleased_file():
    control = set(control_paths())
    common = dict(head=BASE, upstream=f"development/{BRANCH}", remote_head=BASE,
                  staged=set(), changed=set())
    assert validate_start_git_facts(branch="main", dirty=control, **common)
    assert validate_start_git_facts(branch=BRANCH, dirty=control | {"packages/queue/service.py"}, **common)


def test_f13_final_git_accepts_exact_clean_feature_and_merge():
    from scripts.f13_progress_overlay import final_paths, validate_final_git_facts

    expected = set(final_paths())
    feature = dict(head="f" * 40, branch=BRANCH, upstream=f"development/{BRANCH}",
                   remote_head="f" * 40, staged=set(), dirty=set(), parents=["e" * 40],
                   feature_paths=expected, base_is_ancestor=True, merge_tree_matches_feature=False)
    assert not validate_final_git_facts(**feature)
    assert validate_final_git_facts(**{**feature, "feature_paths": expected - {"packages/api/operations.py"}})
    assert validate_final_git_facts(**{**feature, "dirty": {"unrelated.txt"}})
    merged = {**feature, "head": "a" * 40, "branch": "main", "upstream": "development/main",
              "remote_head": "a" * 40, "parents": [BASE, "f" * 40],
              "merge_tree_matches_feature": True}
    assert not validate_final_git_facts(**merged)
    assert validate_final_git_facts(**{**merged, "merge_tree_matches_feature": False})
