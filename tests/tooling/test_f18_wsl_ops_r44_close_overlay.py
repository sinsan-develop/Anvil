"""R44 close projection must revoke the exact product writer."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r44_close_overlay")


def test_r44_close_exact_product_and_control_scope():
    overlay = _overlay()
    assert overlay.PRODUCT == "4e3ba7039894d182fe387420bf978d89f4faf24c"
    assert {overlay.PLAN, overlay.DIGEST, overlay.MANIFEST, overlay.SELF, overlay.TEST} <= set(overlay.control_paths())


def test_r44_close_projection_rejects_live_writer():
    overlay = _overlay()
    bundle = {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"] = {"status": "ACTIVE"}
    assert "F18_R44_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
