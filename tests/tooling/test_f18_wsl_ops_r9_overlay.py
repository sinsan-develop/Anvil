"""R9 request writer is issued only from the published R8 checkpoint."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
R8_CLOSE = "c8064226835fc142c46350a62009b653c907cbfb"


def _published_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{R8_CLOSE}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r9_predecessor_is_published_r8_closeout():
    r9 = importlib.import_module("scripts.f18_wsl_ops_r9_overlay")
    state = _published_progress()
    assert r9.validate_predecessor(ROOT, state) == []
    changed = deepcopy(state)
    changed["f18_overall_status"] = "ACCEPTED"
    assert r9.validate_predecessor(ROOT, changed)


def test_r9_state_requires_exact_epoch7_writer():
    r9 = importlib.import_module("scripts.f18_wsl_ops_r9_overlay")
    state = _published_progress()
    qa = "a" * 40
    now = datetime.now(timezone.utc)
    issued = now.isoformat(timespec="seconds")
    expires = (now + timedelta(hours=1)).isoformat(timespec="seconds")
    state.update(event_sequence=1546, active_agent=r9.ACTOR,
                 worker_lease=r9._lease("worker", issued, expires, qa),
                 write_lease=r9._lease("write", issued, expires, qa),
                 active_work_instruction={"path": r9.WI, "sha256": "b" * 64,
                                          "invocation_path": r9.INVOCATION,
                                          "invocation_sha256": "c" * 64})
    state["repository"].update(projection_mode=r9.MODE,
                               exact_allowed_paths=r9.control_paths(),
                               product_write_scope=r9.write_paths(), control_qa_head=qa)
    assert set(r9.write_paths()) == {
        "packages/api/oidc_identity.py", "packages/api/oidc_code_flow.py",
        "tests/api/test_oidc_code_flow.py", "docs/04_test_reports/F-18_WSL_OPS_REPORT.md"}
    assert r9.validate_state(state, "b" * 64, "c" * 64, qa) == []
    state["write_lease"]["write_epoch"] = 6
    assert r9.validate_state(state, "b" * 64, "c" * 64, qa)
