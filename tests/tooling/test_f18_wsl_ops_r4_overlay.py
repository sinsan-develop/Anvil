"""R4 control checkpoint must reject a mutually rebound R3 QA baseline."""

from copy import deepcopy
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _predecessor():
    progress = json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    events = json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    return progress, events


def test_r4_historical_anchor_rejects_coordinated_rebind():
    r4 = importlib.import_module("scripts.f18_wsl_ops_r4_overlay")
    progress, events = _predecessor()
    assert r4.validate_predecessor_anchor(ROOT, progress, events) == []
    altered_progress, altered_events = deepcopy(progress), deepcopy(events)
    moved = "d27c5264a56c80ccf4f96571fcca15ec50ca93e7"
    altered_progress["repository"]["control_qa_head"] = moved
    for lease in (altered_progress["worker_lease"], altered_progress["write_lease"]):
        lease["baseline_git_commit"] = moved
        lease["dispatch_head"] = moved
    altered_events[1522]["details"]["control_qa_head"] = moved
    assert r4.validate_predecessor_anchor(ROOT, altered_progress, altered_events)


def test_r4_checkpoint_rejects_remaining_writer_and_wrong_qa():
    r4 = importlib.import_module("scripts.f18_wsl_ops_r4_overlay")
    predecessor, _ = _predecessor()
    checkpoint = deepcopy(predecessor)
    checkpoint["event_sequence"] = 1527
    checkpoint["active_agent"] = "main-agent-eoul"
    checkpoint["worker_lease"] = None
    checkpoint["write_lease"] = None
    checkpoint["repository"]["projection_mode"] = r4.MODE
    checkpoint["repository"]["product_write_scope"] = []
    checkpoint["repository"]["exact_allowed_paths"] = r4.control_paths()
    checkpoint["repository"]["control_qa_head"] = "a" * 40
    assert r4.validate_state(checkpoint, "a" * 40) == []
    checkpoint["worker_lease"] = predecessor["worker_lease"]
    assert r4.validate_state(checkpoint, "a" * 40)
    checkpoint["worker_lease"] = None
    checkpoint["repository"]["control_qa_head"] = "b" * 40
    assert r4.validate_state(checkpoint, "a" * 40)
