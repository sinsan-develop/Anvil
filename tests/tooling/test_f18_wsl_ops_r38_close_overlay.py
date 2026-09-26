"""R38 checkpoint revokes write before worker while preserving F-18 hold."""

from copy import deepcopy
import importlib
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    assert importlib.util.find_spec("scripts.f18_wsl_ops_r38_close_overlay") is not None
    return importlib.import_module("scripts.f18_wsl_ops_r38_close_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r38_close_scope_and_product_binding():
    overlay = _overlay()
    assert overlay.PRODUCT == "7c635006fb2fe9878d91580f2a80bf13db2663d8"
    assert overlay.PLAN in overlay.control_paths()
    assert overlay.r38.WRITE != overlay.r38.WORKER
    assert overlay.r38.EXECUTION_TOKEN != overlay.r38.WRITE_TOKEN


def test_r38_close_rejects_reintroduced_writer_and_wrong_event():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"] = {"lease_id": overlay.r38.WRITE}
    assert "F18_R38_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["events"]["events"][-2]["event_type"] = "WORKER_LEASE_REVOKED"
    assert "F18_R38_CLOSE_REVOCATION_INVALID" in overlay.validate(ROOT, tampered)
