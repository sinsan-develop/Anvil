"""R8 code-flow writer must be pinned to the R7 close checkpoint."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
R7_CLOSE = "85b788b570ebd58f252c3952cae8f7d75063f517"


def _predecessor():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{R7_CLOSE}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r8_writer_requires_exact_epoch_fences_and_qa_binding():
    r8 = importlib.import_module("scripts.f18_wsl_ops_r8_overlay")
    state, qa = _predecessor(), "a" * 40
    issued = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    lease = {"actor_id": r8.ACTOR, "status": "ACTIVE",
             "execution_fencing_token": r8.EXECUTION_TOKEN,
             "path_scope": r8.write_paths(), "issued_at": issued,
             "expires_at": expires, "lease_epoch": 6,
             "baseline_git_commit": qa, "dispatch_head": qa}
    state.update({"event_sequence": 1541, "active_agent": r8.ACTOR,
                  "worker_lease": {**lease, "lease_id": r8.WORKER},
                  "write_lease": {**lease, "lease_id": r8.WRITE,
                                  "worker_lease_id": r8.WORKER, "write_epoch": 6,
                                  "write_fencing_token": r8.WRITE_TOKEN},
                  "active_work_instruction": {"path": r8.WI, "sha256": "A" * 64,
                      "invocation_path": r8.INVOCATION, "invocation_sha256": "B" * 64}})
    state["repository"].update({"projection_mode": r8.MODE,
        "control_qa_head": qa, "exact_allowed_paths": r8.control_paths(),
        "product_write_scope": r8.write_paths()})
    assert r8.validate_state(state, "A" * 64, "B" * 64, qa) == []
    expired = deepcopy(state)
    expired["worker_lease"]["expires_at"] = "2020-01-01T00:00:00+00:00"
    assert r8.validate_state(expired, "A" * 64, "B" * 64, qa)
    widened = deepcopy(state)
    widened["write_lease"]["path_scope"].append("packages/api/runtime.py")
    assert r8.validate_state(widened, "A" * 64, "B" * 64, qa)
    rebound = deepcopy(state)
    rebound["repository"]["control_qa_head"] = "b" * 40
    assert r8.validate_state(rebound, "A" * 64, "B" * 64, qa)


def test_r8_predecessor_is_published_r7_close_and_ancestor_of_qa():
    r8 = importlib.import_module("scripts.f18_wsl_ops_r8_overlay")
    assert r8.validate_predecessor_ancestry(ROOT, R7_CLOSE) == []
    assert r8.validate_predecessor_ancestry(ROOT, r8.r7_close.PRODUCT)
