"""R7 ID Token writer cannot escape the R6 checkpoint or its exact scope."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
R6_HEAD = "dd12b4566204b447339da137b175b7fb0a902f73"


def _predecessor():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{R6_HEAD}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r7_writer_requires_exact_epoch_fences_and_qa_binding():
    r7 = importlib.import_module("scripts.f18_wsl_ops_r7_overlay")
    state, qa = _predecessor(), "a" * 40
    issued = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    lease = {"actor_id": r7.ACTOR, "status": "ACTIVE",
             "execution_fencing_token": r7.EXECUTION_TOKEN,
             "path_scope": r7.write_paths(), "issued_at": issued,
             "expires_at": expires, "lease_epoch": 5,
             "baseline_git_commit": qa, "dispatch_head": qa}
    state.update({"event_sequence": 1536, "active_agent": r7.ACTOR,
                  "worker_lease": {**lease, "lease_id": r7.WORKER},
                  "write_lease": {**lease, "lease_id": r7.WRITE,
                                  "worker_lease_id": r7.WORKER, "write_epoch": 5,
                                  "write_fencing_token": r7.WRITE_TOKEN},
                  "active_work_instruction": {"path": r7.WI, "sha256": "A" * 64,
                      "invocation_path": r7.INVOCATION, "invocation_sha256": "B" * 64}})
    state["repository"].update({"projection_mode": r7.MODE,
        "control_qa_head": qa, "exact_allowed_paths": r7.control_paths(),
        "product_write_scope": r7.write_paths()})
    assert r7.validate_state(state, "A" * 64, "B" * 64, qa) == []
    expired = deepcopy(state)
    expired["worker_lease"]["expires_at"] = "2020-01-01T00:00:00+00:00"
    assert r7.validate_state(expired, "A" * 64, "B" * 64, qa)
    widened = deepcopy(state)
    widened["write_lease"]["path_scope"].append("packages/api/runtime.py")
    assert r7.validate_state(widened, "A" * 64, "B" * 64, qa)
    rebound = deepcopy(state)
    rebound["repository"]["control_qa_head"] = "b" * 40
    assert r7.validate_state(rebound, "A" * 64, "B" * 64, qa)


def test_r7_predecessor_is_published_r6_close_and_ancestor_of_qa():
    r7 = importlib.import_module("scripts.f18_wsl_ops_r7_overlay")
    assert r7.validate_predecessor_ancestry(ROOT, R6_HEAD) == []
    assert r7.validate_predecessor_ancestry(ROOT, r7.r6.R6_QA)
