"""R43B1 local QA checkpoint revokes write before worker."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r43b1_close_overlay")


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r43b1_close_preserves_writer_scope_and_product_head():
    overlay = _overlay()
    assert overlay.PRODUCT == "160e98ee0ee2a71ec047215c58ad40c21eeedc36"
    assert set(overlay.r43b1.write_paths()) <= set(overlay.evidence_paths() | set(overlay.r43b1.write_paths()))
    assert {overlay.PLAN, overlay.DIGEST, overlay.MANIFEST, overlay.SELF, overlay.TEST} <= set(overlay.control_paths())


def test_r43b1_close_projection_rejects_nonempty_scope():
    overlay = _overlay()
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["repository"]["product_write_scope"] = overlay.r43b1.write_paths()
    assert "F18_R43B1_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
