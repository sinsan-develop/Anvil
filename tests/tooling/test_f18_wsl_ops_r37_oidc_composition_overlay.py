"""R37 trusted OIDC composition writer projection binds an exact3 lease."""

from copy import deepcopy
import json
from pathlib import Path

from scripts import f18_wsl_ops_r37_oidc_composition_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r37_exact3_scope_and_distinct_fences():
    assert overlay.write_paths() == [
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
        "packages/api/oidc_runtime_factory.py",
        "tests/api/test_oidc_runtime_factory.py",
    ]
    assert overlay.EXECUTION_TOKEN != overlay.WRITE_TOKEN
    assert overlay.EXECUTION_TOKEN != overlay.previous.r36.EXECUTION_TOKEN
    assert overlay.PREDECESSOR == "77f2f4bd8e15cea808d5964c4394cd41a993a2b2"
    assert overlay.PLAN in overlay.control_paths()
    assert overlay.WI in overlay.control_paths()
    assert overlay.INVOCATION in overlay.control_paths()


def test_r37_projection_rejects_writer_scope_and_binding_tampering():
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"] += ["apps/api/anvil_api/asgi.py"]
    assert "F18_R37_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["parent_approval_id"] = "forged"
    assert "F18_R37_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
