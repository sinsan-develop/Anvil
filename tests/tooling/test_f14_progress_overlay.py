"""F-14 control projection is restricted to the one active branch and lease."""

from scripts.f14_progress_overlay import BASE, BRANCH, control_paths, product_paths, validate_start_git_facts


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
