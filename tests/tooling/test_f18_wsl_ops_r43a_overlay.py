"""R43A formal OIDC host writer projection binds one exact4 lease."""

from copy import deepcopy
import importlib
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    assert importlib.util.find_spec("scripts.f18_wsl_ops_r43a_overlay") is not None
    return importlib.import_module("scripts.f18_wsl_ops_r43a_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r43a_exact4_and_distinct_epoch27_fences():
    overlay = _overlay()
    assert overlay.write_paths() == [
        "deploy/wsl/compose.f18.oidc.yml",
        "deploy/wsl/nginx-f18-oidc.conf",
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
        "tests/deploy/test_f18_oidc_formal_host_contract.py",
    ]
    assert overlay.EXECUTION_TOKEN != overlay.WRITE_TOKEN
    assert overlay.EXECUTION_TOKEN != overlay.previous.r42.EXECUTION_TOKEN
    assert overlay.PREDECESSOR == "955102978eb5c68735980fb98b0b65c268bb0884"
    assert {overlay.PLAN, overlay.WI, overlay.INVOCATION} <= set(overlay.control_paths())


def test_r43a_projection_rejects_scope_and_binding_tampering():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"] += ["packages/api/runtime.py"]
    assert "F18_R43A_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["parent_approval_id"] = "forged"
    assert "F18_R43A_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
