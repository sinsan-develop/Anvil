"""R45A close projection revokes Main QA without accepting F-18."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r45a_close_overlay")


def test_r45a_close_exact_tested_sha_and_scope():
    overlay = _overlay()
    assert overlay.TESTED == "d36de847842804ca93e405abe9bff687c1162a69"
    assert overlay.PREDECESSOR == "5b92100d7342587f1f471f65d447244c5be127ca"
    assert {overlay.PLAN, overlay.DIGEST, overlay.MANIFEST, overlay.SELF, overlay.TEST} <= set(overlay.control_paths())


def test_r45a_close_projection_rejects_live_worker():
    overlay = _overlay()
    bundle = {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["worker_lease"] = {"status": "ACTIVE"}
    assert "F18_R45A_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
