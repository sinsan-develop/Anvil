"""R45B Main QA transition binds a new worker-only lease and public evidence slots."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _overlay():
    return importlib.import_module("scripts.f18_wsl_ops_r45b_overlay")


def test_r45b_new_epoch_and_public_evidence_paths():
    overlay = _overlay()
    assert overlay.PREDECESSOR == "c655984e0e434223d0586f6ec8c97d46fac785dc"
    assert overlay.WORKER != overlay.previous.r45a.WORKER
    assert overlay.EXECUTION_TOKEN != overlay.previous.r45a.EXECUTION_TOKEN
    assert overlay.PUBLIC <= set(overlay.control_paths())
    assert {overlay.PLAN, overlay.WI, overlay.INVOCATION, overlay.REPORT, overlay.DIGEST, overlay.MANIFEST, overlay.SELF, overlay.TEST} <= set(overlay.control_paths())


def test_r45b_rejects_lease_or_public_evidence_tamper():
    overlay = _overlay()
    bundle = {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["worker_lease"]["lease_id"] = "old-worker"
    assert "F18_R45B_LEASE_INVALID" in overlay.validate(ROOT, tampered)
