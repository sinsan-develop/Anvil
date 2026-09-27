"""R45C Main-only QA control must bind its own audited artifact and lease."""

from copy import deepcopy
import importlib
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = "scripts.f18_wsl_ops_r45c_overlay"


def _overlay():
    assert importlib.util.find_spec(MODULE) is not None, "R45C control overlay absent"
    return importlib.import_module(MODULE)


def test_r45c_control_binds_audit_and_no_product_write():
    overlay = _overlay()
    paths = set(overlay.control_paths())
    assert "docs/04_test_reports/F-18_R45C_ROLLBACK_ARTIFACT_AUDIT.md" in paths
    assert "docs/work_orders/F-18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_PLAN.md" in paths
    assert overlay.WORKER != overlay.previous.r45b.WORKER
    assert overlay.EXECUTION_TOKEN != overlay.previous.r45b.EXECUTION_TOKEN
    assert overlay._lease("2026-09-27T12:00:00+09:00", "2026-09-28T00:00:00+09:00", "a" * 40)["path_scope"] == []


def test_r45c_rejects_wrong_worker_and_accepted_state():
    overlay = _overlay()
    bundle = {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    wrong_worker = deepcopy(bundle)
    wrong_worker["progress"]["worker_lease"]["lease_id"] = "obsolete"
    assert "F18_R45C_LEASE_INVALID" in overlay.validate(ROOT, wrong_worker)
    wrong_acceptance = deepcopy(bundle)
    wrong_acceptance["progress"]["next_work_package"]["status"] = "READY"
    assert "F18_R45C_STATE_INVALID" in overlay.validate(ROOT, wrong_acceptance)
