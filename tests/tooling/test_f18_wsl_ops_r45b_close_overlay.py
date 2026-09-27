"""R45B close must revoke only the Main QA worker and keep F18 pending."""

from copy import deepcopy
import importlib
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = "scripts.f18_wsl_ops_r45b_close_overlay"


def _overlay():
    assert importlib.util.find_spec(MODULE) is not None, "R45B close projection missing"
    return importlib.import_module(MODULE)


def test_r45b_close_preserves_public_target_evidence_scope():
    overlay = _overlay()
    required = {
        "docs/evidence/f18_r45b/qa-target-evidence.json",
        "docs/evidence/f18_r45b/qa-capability-envelope.json",
        "docs/evidence/f18_r45b/qa-capability-public-key.pem",
    }
    assert required <= set(overlay.control_paths())
    assert overlay.PREDECESSOR == "df45ee12dea7832780d3106a77fbfb9688833808"
    assert overlay.PUBLIC_QA == "1000aa91819cef0fdc4f0512fa32d46042a3c900"


def test_r45b_close_rejects_live_worker_after_revocation():
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
    assert "F18_R45B_CLOSE_STATE_INVALID" in overlay.validate(ROOT, tampered)
