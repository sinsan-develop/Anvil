"""F-16 progress gate rejects out-of-scope writes and ref drift."""

from scripts.f16_progress_overlay import (
    BASE, BRANCH, control_paths, product_paths, validate_changed_scope,
    validate_start_git_facts, final_paths, validate_final_git_facts,
)


def test_f16_scope_rejects_missing_control_and_unrelated_product_path():
    controls = set(control_paths())
    product = set(product_paths())
    assert validate_changed_scope(controls | {"packages/deployment/release_manifest.py"})
    assert validate_changed_scope(controls | product)
    assert not validate_changed_scope(controls - {"docs/WORK_STATUS.md"})
    assert not validate_changed_scope(controls | {"deploy/ysna/rollback.sh"})


def test_f16_gate_rejects_unpushed_or_other_branch_even_when_files_match():
    facts = dict(branch=BRANCH, upstream=f"development/{BRANCH}",
                 head="feature-head", remote_head="feature-head",
                 staged=set(), dirty=set(), changed=set(control_paths()) |
                 {"packages/deployment/release_manifest.py"},
                 base_is_ancestor=True, remote_is_ancestor=True)
    assert validate_start_git_facts(**facts) == []
    assert validate_start_git_facts(**{**facts, "branch": "main"})
    assert validate_start_git_facts(**{**facts, "remote_head": "other-head",
                                     "remote_is_ancestor": False})
    assert validate_start_git_facts(**{**facts, "dirty": {"scratch.txt"}})


def test_f16_clean_base_requires_only_declared_control_projection():
    facts = dict(branch=BRANCH, upstream=f"development/{BRANCH}",
                 head=BASE, remote_head=BASE, staged=set(),
                 dirty=set(control_paths()), changed=set(),
                 base_is_ancestor=True, remote_is_ancestor=True)
    assert validate_start_git_facts(**facts) == []
    assert validate_start_git_facts(**{**facts, "dirty": {"unknown.md"}})


def test_f16_final_gate_requires_exact_clean_feature_or_matching_merge():
    assert set(final_paths()) == set(control_paths()) | set(product_paths())
    facts = dict(branch=BRANCH, upstream=f"development/{BRANCH}",
                 head="feature-head", remote_head="feature-head", staged=set(),
                 dirty=set(), changed=set(final_paths()), parents=["product-head"],
                 base_is_ancestor=True, merge_tree_matches_feature=False)
    assert validate_final_git_facts(**facts) == []
    assert validate_final_git_facts(**{**facts, "dirty": {"scratch.txt"}})
    assert validate_final_git_facts(**{**facts, "changed": set(control_paths())})
    merged = {**facts, "branch": "main", "upstream": "development/main",
              "head": "merge-head", "remote_head": "merge-head",
              "parents": [BASE, "feature-head"], "merge_tree_matches_feature": True}
    assert validate_final_git_facts(**merged) == []
    assert validate_final_git_facts(**{**merged, "merge_tree_matches_feature": False})
