"""R43C writer projection binds only the five runtime-rework paths."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r43c_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r43c_exact5_and_distinct_epoch30_fences():
    overlay = _overlay()
    assert overlay.write_paths() == [
        "apps/worker/anvil_worker/main.py",
        "deploy/wsl/compose.f18.oidc.yml",
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
        "tests/deploy/test_f18_oidc_formal_host_contract.py",
        "tests/integration/test_f15_local_stack.py",
    ]
    assert overlay.EXECUTION_TOKEN != overlay.WRITE_TOKEN
    assert overlay.PREDECESSOR == "d3481ae6e086bcbf03c600b4d70ec51e28cc795d"
    assert {overlay.PLAN, overlay.WI, overlay.INVOCATION} <= set(overlay.control_paths())


def test_r43c_projection_rejects_scope_and_binding_tampering():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"] += ["apps/api/anvil_api/asgi.py"]
    assert "F18_R43C_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["parent_approval_id"] = "forged"
    assert "F18_R43C_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
