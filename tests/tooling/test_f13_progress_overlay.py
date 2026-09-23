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
