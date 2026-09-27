"""R45A internal fixed-port correction rotates the QA worker lease."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r45a_port_revision_overlay")


def test_r45a_port_revision_has_distinct_epoch_and_control_paths():
    overlay = _overlay()
    assert overlay.PREDECESSOR == "d36de847842804ca93e405abe9bff687c1162a69"
    assert overlay.WORKER != overlay.previous.WORKER
    assert {overlay.DIGEST, overlay.MANIFEST, overlay.SELF, overlay.TEST} <= set(overlay.control_paths())


def test_r45a_port_revision_rejects_old_worker():
    overlay = _overlay()
    bundle = {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["worker_lease"]["lease_id"] = overlay.previous.WORKER
    assert "F18_R45A_PORT_LEASE_INVALID" in overlay.validate(ROOT, tampered)
