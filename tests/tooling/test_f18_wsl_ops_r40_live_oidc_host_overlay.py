"""R40 live OIDC host QA writer projection binds one exact3 lease."""

from copy import deepcopy
import importlib
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    assert importlib.util.find_spec("scripts.f18_wsl_ops_r40_live_oidc_host_overlay") is not None
    return importlib.import_module("scripts.f18_wsl_ops_r40_live_oidc_host_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r40_exact3_scope_and_distinct_fences():
    overlay = _overlay()
    assert overlay.write_paths() == [
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
        "tests/integration/f18_oidc_live_host.py",
        "tests/integration/test_f18_oidc_live_host.py",
    ]
    assert overlay.EXECUTION_TOKEN != overlay.WRITE_TOKEN
    assert overlay.EXECUTION_TOKEN != overlay.previous.r39.EXECUTION_TOKEN
    assert overlay.PREDECESSOR == "8969e4e57b543131fd231ad1047d68695217bed7"
    assert overlay.PLAN in overlay.control_paths()
    assert overlay.WI in overlay.control_paths()
    assert overlay.INVOCATION in overlay.control_paths()


def test_r40_projection_rejects_writer_scope_and_binding_tampering():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"] += ["packages/api/runtime.py"]
    assert "F18_R40_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["parent_approval_id"] = "forged"
    assert "F18_R40_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
