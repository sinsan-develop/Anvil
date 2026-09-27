"""R43B1 issuer writer projection binds one exact5 lease."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r43b1_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r43b1_exact5_and_distinct_epoch28_fences():
    overlay = _overlay()
    assert overlay.write_paths() == [
        "deploy/wsl/Dockerfile.f18.oidc-qa",
        "deploy/wsl/compose.f18.oidc.yml",
        "deploy/wsl/oidc_qa_issuer.py",
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
        "tests/deploy/test_f18_oidc_qa_issuer.py",
    ]
    assert overlay.EXECUTION_TOKEN != overlay.WRITE_TOKEN
    assert overlay.EXECUTION_TOKEN != overlay.previous.r43a.EXECUTION_TOKEN
    assert overlay.PREDECESSOR == "8e45b37ef11f8cd52f901416c0aa1f4b9d09475b"
    assert {overlay.PLAN, overlay.WI, overlay.INVOCATION} <= set(overlay.control_paths())


def test_r43b1_projection_rejects_scope_and_binding_tampering():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"] += ["apps/api/anvil_api/oidc_process.py"]
    assert "F18_R43B1_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["parent_approval_id"] = "forged"
    assert "F18_R43B1_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
