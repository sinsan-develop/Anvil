"""R43B2 Main runtime verification has no product writer."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r43b2_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r43b2_main_only_epoch29_and_empty_product_scope():
    overlay = _overlay()
    assert overlay.PREDECESSOR == "c6baa6a75da984ba3f077e6e684078aea93100f2"
    assert overlay.ACTOR == "main-agent-eoul"
    assert overlay.EXECUTION_TOKEN != overlay.previous.r43b1.EXECUTION_TOKEN
    assert {overlay.WI, overlay.INVOCATION, overlay.REPORT} <= set(overlay.control_paths())


def test_r43b2_projection_rejects_product_writer():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"] = {"status": "ACTIVE"}
    assert "F18_R43B2_STATE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["repository"]["product_write_scope"] = ["apps/api/anvil_api/asgi.py"]
    assert "F18_R43B2_STATE_INVALID" in overlay.validate(ROOT, tampered)
