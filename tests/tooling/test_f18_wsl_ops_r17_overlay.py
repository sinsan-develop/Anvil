"""R17 role-image lease is bound to the R12 closeout and exact product paths."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
PREVIOUS_STATE = "4c5b40db2a49e34dc6279012d5f86901991e400d"
EXACT4 = sorted(("deploy/wsl/Dockerfile.f18", "deploy/wsl/Dockerfile.f18.dockerignore",
                 "tests/deploy/test_f18_role_images.py", "docs/04_test_reports/F-18_WSL_OPS_REPORT.md"))


def _previous_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{PREVIOUS_STATE}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r17_binds_exact_issued_scope_and_predecessor():
    start = importlib.import_module("scripts.f18_wsl_ops_r17_overlay")
    assert start.PREVIOUS_STATE == PREVIOUS_STATE
    assert start.write_paths() == EXACT4
    assert start.validate_predecessor(ROOT, _previous_progress()) == []
    changed = _previous_progress()
    changed["worker_lease"] = {"lease_id": "stale"}
    assert start.validate_predecessor(ROOT, changed) == ["F18_WSL_OPS_R17_PREDECESSOR_INVALID"]


def test_r17_role_image_writer_fence_and_control_disjoint():
    start = importlib.import_module("scripts.f18_wsl_ops_r17_overlay")
    assert set(start.write_paths()).isdisjoint(start.control_paths())
    assert set(start.write_paths()).isdisjoint(start.evidence_paths())
    lease = start._lease("write", "2026-09-26T10:00:00+09:00",
                         "2026-09-26T22:00:00+09:00", "control-qa")
    assert lease["lease_epoch"] == lease["write_epoch"] == 11
    assert lease["path_scope"] == EXACT4
    assert lease["worker_lease_id"] == start.WORKER


def test_r17_rejects_stale_or_broadened_writer_state():
    start = importlib.import_module("scripts.f18_wsl_ops_r17_overlay")
    prior = _previous_progress()
    now = datetime.now(timezone(timedelta(hours=9)))
    at, expiry, qa = now.isoformat(timespec="seconds"), (now + timedelta(hours=12)).isoformat(timespec="seconds"), "a" * 40
    state = deepcopy(prior)
    state.update(event_sequence=1566, active_agent=start.ACTOR,
                 worker_lease=start._lease("worker", at, expiry, qa),
                 write_lease=start._lease("write", at, expiry, qa))
    state["repository"].update(projection_mode=start.MODE, control_qa_head=qa,
                                exact_allowed_paths=start.control_paths(),
                                product_write_scope=start.write_paths())
    state["active_work_instruction"] = {"path": start.WI, "sha256": "wi",
        "invocation_path": start.INVOCATION, "invocation_sha256": "inv",
        "revision_classification": "MAIN_RECONFIRMED_NON_SEMANTIC",
        "parent_approval_id": "APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001"}
    assert start.validate_state(state, "wi", "inv", qa) == []
    state["write_lease"]["path_scope"] += ["deploy/ysna/forbidden"]
    assert "F18_WSL_OPS_R17_STATE_INVALID" in start.validate_state(state, "wi", "inv", qa)
