"""R45A QA projection binds one Main worker and no product writer."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r45a_overlay")


def test_r45a_exact_predecessor_and_control_paths():
    overlay = _overlay()
    assert overlay.PREDECESSOR == "dfdbdcb95be53ff15bec7224864f759982e83525"
    assert {overlay.PLAN, overlay.WI, overlay.INVOCATION, overlay.REPORT,
            overlay.DIGEST, overlay.MANIFEST, overlay.SELF, overlay.TEST} <= set(overlay.control_paths())


def test_r45a_projection_rejects_product_writer():
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
    assert "F18_R45A_STATE_INVALID" in overlay.validate(ROOT, tampered)
