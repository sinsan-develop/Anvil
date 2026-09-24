"""R6 object-store writer is fenced to the reviewed R5 checkpoint."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
R5_HEAD = "17c0f839e8b3ce544aa49d3e3ac3edb94e189ad8"


def _predecessor():
    raw = subprocess.check_output(
        ["git", "show", f"{R5_HEAD}:docs/progress/build-progress.json"], cwd=ROOT)
    return json.loads(raw)


def test_r6_writer_requires_exact_epoch_scope_and_qa_baseline():
    r6 = importlib.import_module("scripts.f18_wsl_ops_r6_overlay")
    state = _predecessor()
    qa = "a" * 40
    issued = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    lease = {"actor_id": r6.ACTOR, "status": "ACTIVE",
             "execution_fencing_token": r6.EXECUTION_TOKEN,
             "path_scope": r6.write_paths(), "issued_at": issued,
             "expires_at": expires, "lease_epoch": 4,
             "baseline_git_commit": qa, "dispatch_head": qa}
    state.update({"event_sequence": 1531, "active_agent": r6.ACTOR,
                  "worker_lease": {**lease, "lease_id": r6.WORKER},
                  "write_lease": {**lease, "lease_id": r6.WRITE,
                                  "worker_lease_id": r6.WORKER, "write_epoch": 4,
                                  "write_fencing_token": r6.WRITE_TOKEN},
                  "active_work_instruction": {"path": r6.WI, "sha256": "A" * 64,
                      "invocation_path": r6.INVOCATION, "invocation_sha256": "B" * 64}})
    state["repository"].update({"projection_mode": r6.MODE,
        "control_qa_head": qa, "exact_allowed_paths": r6.control_paths(),
        "product_write_scope": r6.write_paths()})
    assert r6.validate_state(state, "A" * 64, "B" * 64, qa) == []
    expired = deepcopy(state)
    expired["worker_lease"]["expires_at"] = "2020-01-01T00:00:00+00:00"
    assert r6.validate_state(expired, "A" * 64, "B" * 64, qa)
    rebound = deepcopy(state)
    rebound["repository"]["control_qa_head"] = "b" * 40
    assert r6.validate_state(rebound, "A" * 64, "B" * 64, qa)
    wrong_scope = deepcopy(state)
    wrong_scope["write_lease"]["path_scope"].append("unrelated")
    assert r6.validate_state(wrong_scope, "A" * 64, "B" * 64, qa)


def test_r6_rejects_qa_not_descended_from_r5_checkpoint():
    r6 = importlib.import_module("scripts.f18_wsl_ops_r6_overlay")
    assert r6.validate_predecessor_ancestry(ROOT, R5_HEAD) == []
    assert r6.validate_predecessor_ancestry(ROOT,
        "d27c5264a56c80ccf4f96571fcca15ec50ca93e7")
