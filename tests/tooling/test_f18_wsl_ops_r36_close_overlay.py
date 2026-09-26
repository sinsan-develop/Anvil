"""R36 checkpoint revokes write before worker while preserving F-18 hold."""

from copy import deepcopy
import json
from pathlib import Path

from scripts import f18_wsl_ops_r36_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r36_close_scope_and_product_binding():
    assert overlay.PRODUCT == "5f1b57a21b1b874d3e6af9c6f92605bce9c11c13"
    assert overlay.PLAN in overlay.control_paths()
    assert overlay.r36.WRITE != overlay.r36.WORKER
    assert overlay.r36.EXECUTION_TOKEN != overlay.r36.WRITE_TOKEN


def test_r36_close_rejects_reintroduced_writer_and_wrong_event():
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"] = {"lease_id": overlay.r36.WRITE}
    assert "F18_R36_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["events"]["events"][-2]["event_type"] = "WORKER_LEASE_REVOKED"
    assert "F18_R36_CLOSE_REVOCATION_INVALID" in overlay.validate(ROOT, tampered)
