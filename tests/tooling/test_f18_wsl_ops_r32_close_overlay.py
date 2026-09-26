"""R32 trusted-directory writer closure preserves scope and revokes both leases."""

from copy import deepcopy
import json
from pathlib import Path

from scripts import f18_wsl_ops_r32_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r32_close_scope_and_source_binding():
    assert overlay.PRODUCT == "ca5f6597239fb8f031925ee5e1ffc8ee921a7075"
    assert overlay.MODE == "F18_WSL_OPS_R32_TRUSTED_DIRECTORY_CHECKPOINT"
    assert overlay.PLAN in overlay.control_paths()
    assert overlay.MANIFEST in overlay.control_paths()


def test_r32_close_projection_rejects_reintroduced_writer_and_wrong_event():
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["worker_lease"] = {"status": "ACTIVE"}
    assert "F18_R32_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["events"]["events"][-1]["details"]["reason"] = "forged"
    assert "F18_R32_CLOSE_REVOCATION_INVALID" in overlay.validate(ROOT, tampered)
