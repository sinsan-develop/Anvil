"""R18 closeout must revoke the exact writer and keep F-18 partial."""

from copy import deepcopy
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
PRODUCT = "3586c8400172a8357d9c239e59a65550c0596d68"


def _published_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{PRODUCT}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r18_close_requires_published_active_predecessor():
    close = importlib.import_module("scripts.f18_wsl_ops_r18_close_overlay")
    assert close.control_qa_commit(ROOT) == "7aff259eee8a4fe5923b5516c34112a2f2332b8b"
    assert close.r18.MANIFEST in close.evidence_paths()
    assert close.r18.SELF in close.evidence_paths()
    assert close.r18.TEST in close.evidence_paths()
    assert close.r18.previous.MANIFEST in close.evidence_paths()
    state = _published_progress()
    assert close.validate_predecessor(ROOT, state) == []
    changed = deepcopy(state)
    changed["write_lease"]["status"] = "REVOKED"
    assert close.validate_predecessor(ROOT, changed)


def test_r18_close_removes_writer_and_keeps_f18_partial():
    close = importlib.import_module("scripts.f18_wsl_ops_r18_close_overlay")
    state = _published_progress()
    state.update(event_sequence=1573, active_agent="main-agent-eoul",
                 worker_lease=None, write_lease=None)
    state["repository"].update(projection_mode=close.MODE,
                               exact_allowed_paths=close.control_paths(),
                               product_write_scope=[], control_qa_head="a" * 40)
    assert close.validate_state(state, "a" * 40) == []
    state["write_lease"] = {"lease_id": "stale"}
    assert close.validate_state(state, "a" * 40)
    state["write_lease"] = None
    state["f18_overall_status"] = "ACCEPTED"
    assert close.validate_state(state, "a" * 40)
