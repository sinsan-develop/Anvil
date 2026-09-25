"""R12 closeout must revoke the exact writer and keep F-18 partial."""

from copy import deepcopy
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
PRODUCT = "cae47aa8c2dd14d561d03b8eaf25948c860f136e"


def _published_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{PRODUCT}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r12_close_requires_published_active_predecessor():
    close = importlib.import_module("scripts.f18_wsl_ops_r12_close_overlay")
    assert close.control_qa_commit(ROOT) == "b08d0c026a27332f72334bc8f6166457b9d6de07"
    assert close.r12.MANIFEST in close.evidence_paths()
    assert close.r12.SELF in close.evidence_paths()
    assert close.r12.TEST in close.evidence_paths()
    assert close.r12.previous.MANIFEST in close.evidence_paths()
    state = _published_progress()
    assert close.validate_predecessor(ROOT, state) == []
    changed = deepcopy(state)
    changed["write_lease"]["status"] = "REVOKED"
    assert close.validate_predecessor(ROOT, changed)


def test_r12_close_removes_writer_and_keeps_f18_partial():
    close = importlib.import_module("scripts.f18_wsl_ops_r12_close_overlay")
    state = _published_progress()
    state.update(event_sequence=1563, active_agent="main-agent-eoul",
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
