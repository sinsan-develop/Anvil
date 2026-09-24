"""F-15 exact scope and one fenced writer contract."""

from scripts.f15_progress_overlay import (
    BRANCH, MODE, control_paths, product_paths, validate_changed_scope,
)


def test_f15_scope_is_exact_and_disjoint():
    assert MODE == "F15_START_EXACT11_PRODUCT_EXACT19"
    assert BRANCH == "codex/f15-common-shell-local-stack"
    assert len(control_paths()) == 11
    assert len(product_paths()) == 19
    assert not set(control_paths()) & set(product_paths())
    assert "apps/web/src/console/App.tsx" in product_paths()
    assert "packages/api/security.py" not in product_paths()


def test_f15_operational_and_regression_paths_are_scoped():
    product = set(product_paths())
    assert {"docker-compose.local.yml", "apps/api/anvil_api/asgi.py",
            "packages/api/fastapi_app.py", "apps/worker/anvil_worker/main.py",
            "tests/api/test_f15_web_security.py"} <= product


def test_f15_changed_scope_requires_all_controls_but_only_used_products():
    controls = set(control_paths())
    product = set(product_paths())
    assert validate_changed_scope(controls)
    assert validate_changed_scope(controls | {"apps/api/anvil_api/asgi.py"})
    assert validate_changed_scope(controls | product)
    assert not validate_changed_scope(controls - {"docs/WORK_STATUS.md"})
    assert not validate_changed_scope(controls | {"unrelated.py"})
