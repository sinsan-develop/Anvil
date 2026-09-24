"""R6 closeout rejects altered history and any surviving product writer."""

from copy import deepcopy
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
PREDECESSOR = "8e2e89bf820a26fa84f1dc66562d35e87efb4b89"


def _published_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{PREDECESSOR}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r6_close_requires_frozen_predecessor_ancestry():
    close = importlib.import_module("scripts.f18_wsl_ops_r6_close_overlay")
    state = _published_progress()
    assert close.validate_predecessor(ROOT, state) == []
    changed = deepcopy(state)
    changed["worker_lease"]["status"] = "REVOKED"
    assert close.validate_predecessor(ROOT, changed)


def test_r6_close_state_has_no_active_writer_and_keeps_f18_partial():
    close = importlib.import_module("scripts.f18_wsl_ops_r6_close_overlay")
    state = _published_progress()
    state.update(event_sequence=1533, active_agent="main-agent-eoul",
                 worker_lease=None, write_lease=None)
    state["repository"].update(projection_mode=close.MODE,
                               exact_allowed_paths=close.control_paths(),
                               product_write_scope=[], control_qa_head="a" * 40)
    assert close.validate_state(state, "a" * 40) == []
    state["write_lease"] = {"lease_id": "stale"}
    assert close.validate_state(state, "a" * 40)
    state["write_lease"] = None
    state["repository"]["control_qa_head"] = "b" * 40
    assert close.validate_state(state, "a" * 40)
