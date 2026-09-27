"""R43D Main QA projection has no product writer."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r43d_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r43d_main_only_scope_and_predecessor():
    overlay = _overlay()
    assert overlay.PREDECESSOR == "567514f0801c70871d6baa570b37a48c0a8f789b"
    assert {overlay.WI, overlay.INVOCATION, overlay.REPORT, overlay.SELF} <= set(overlay.control_paths())
    assert overlay.WORKER != overlay.previous.r43c.WORKER


def test_r43d_projection_rejects_product_writer():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"] = {"status": "ACTIVE"}
    assert "F18_R43D_STATE_INVALID" in overlay.validate(ROOT, tampered)
