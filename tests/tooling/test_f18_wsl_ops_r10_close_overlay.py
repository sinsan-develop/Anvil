"""R10 closeout preserves the published predecessor and partial F-18 state."""

from copy import deepcopy
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
PRODUCT = "5c0a9ba2ec907b8e7a4b05c92389de9456304736"


def _published_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{PRODUCT}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r10_close_requires_published_active_predecessor():
    close = importlib.import_module("scripts.f18_wsl_ops_r10_close_overlay")
    assert close.r10.MANIFEST in close.evidence_paths()
    assert close.r10.r9_close.r9.MANIFEST in close.evidence_paths()
    assert close.control_qa_commit(ROOT) == subprocess.check_output(
        ["git", "log", "-1", "--format=%H", "--", close.SELF], cwd=ROOT,
        text=True).strip()
    state = _published_progress()
    assert close.validate_predecessor(ROOT, state) == []
    changed = deepcopy(state)
    changed["write_lease"]["status"] = "REVOKED"
    assert close.validate_predecessor(ROOT, changed)


def test_r10_close_removes_writer_and_keeps_f18_partial():
    close = importlib.import_module("scripts.f18_wsl_ops_r10_close_overlay")
    state = _published_progress()
    state.update(event_sequence=1553, active_agent="main-agent-eoul",
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
