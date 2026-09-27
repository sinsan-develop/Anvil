"""R43B2 Main QA rework checkpoint revokes its only worker lease."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r43b2_close_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r43b2_close_scope_and_tested_sha():
    overlay = _overlay()
    assert overlay.TESTED == "91bdc617ae0c3d1096d173d1e64cbe4207c4022b"
    assert {overlay.PLAN, overlay.DIGEST, overlay.MANIFEST, overlay.SELF, overlay.TEST} <= set(overlay.control_paths())


def test_r43b2_close_projection_rejects_live_lease():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["worker_lease"] = {"status": "ACTIVE"}
    assert "F18_R43B2_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
