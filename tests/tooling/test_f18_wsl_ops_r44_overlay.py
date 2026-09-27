"""R44 writer projection binds the three current manifest-head paths."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r44_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r44_exact3_and_distinct_epoch32_fences():
    overlay = _overlay()
    assert overlay.write_paths() == [
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
        "packages/deployment/release_manifest.py",
        "tests/deploy/test_f16_release_manifest.py",
    ]
    assert overlay.EXECUTION_TOKEN != overlay.WRITE_TOKEN
    assert overlay.PREDECESSOR == "838a7591fd63f641dfc9cdf4db147a4461320dd1"
    assert {overlay.PLAN, overlay.WI, overlay.INVOCATION} <= set(overlay.control_paths())


def test_r44_projection_rejects_scope_and_binding_tampering():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"] += ["deploy/wsl/f17_validation.py"]
    assert "F18_R44_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["parent_approval_id"] = "forged"
    assert "F18_R44_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
