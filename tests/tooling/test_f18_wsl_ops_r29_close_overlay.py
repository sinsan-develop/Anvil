"""R29 network writer closure preserves F-18 scope and revokes both leases."""

from copy import deepcopy
import json
from pathlib import Path

from scripts import f18_wsl_ops_r29_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r29_close_scope_and_source_binding():
    assert overlay.PRODUCT == "a9550612084aa0b85c75e2c49844ba0367701d5a"
    assert overlay.MODE == "F18_WSL_OPS_R29_NETWORK_CHECKPOINT"
    assert overlay.PLAN in overlay.control_paths()
    assert overlay.MANIFEST in overlay.control_paths()


def test_r29_close_projection_rejects_reintroduced_writer_and_wrong_event():
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return  # exact closure projection is tested after materialize
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["worker_lease"] = {"status": "ACTIVE"}
    assert "F18_R29_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["events"]["events"][-1]["details"]["reason"] = "forged"
    assert "F18_R29_CLOSE_REVOCATION_INVALID" in overlay.validate(ROOT, tampered)
