"""R43D close projection revokes Main QA without accepting F-18."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r43d_close_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r43d_close_exact_tested_sha_and_scope():
    overlay = _overlay()
    assert overlay.TESTED == "e21c9dc00b40c0c288fd54a2c34cbb4b57a2a6f0"
    assert {overlay.PLAN, overlay.DIGEST, overlay.MANIFEST, overlay.SELF, overlay.TEST} <= set(overlay.control_paths())


def test_r43d_close_projection_rejects_live_worker():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["worker_lease"] = {"status": "ACTIVE"}
    assert "F18_R43D_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
