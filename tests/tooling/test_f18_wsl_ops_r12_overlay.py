"""R12 auth-ingress writer starts only from the verified R11 closeout."""

import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
PREVIOUS_STATE = "79a857c332a029e31bb0ce0c4ea220be072a56ce"
EXACT3 = sorted(("deploy/local/nginx.conf", "tests/integration/test_f15_local_stack.py",
                 "docs/04_test_reports/F-18_WSL_OPS_REPORT.md"))


def _published_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{PREVIOUS_STATE}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r12_binds_published_r11_close_and_exact_auth_ingress_scope():
    start = importlib.import_module("scripts.f18_wsl_ops_r12_overlay")
    assert start.PREVIOUS_STATE == PREVIOUS_STATE
    assert start.write_paths() == EXACT3
    assert start.validate_predecessor(ROOT, _published_progress()) == []
    changed = _published_progress()
    changed["worker_lease"] = {"lease_id": "stale"}
    assert start.validate_predecessor(ROOT, changed) == ["F18_WSL_OPS_R12_PREDECESSOR_INVALID"]


def test_r12_control_scope_cannot_claim_product_as_evidence():
    start = importlib.import_module("scripts.f18_wsl_ops_r12_overlay")
    assert set(start.write_paths()).isdisjoint(start.evidence_paths())
    assert start.MANIFEST in start.control_paths()
    assert start.previous.MANIFEST in start.evidence_paths()
    assert start.previous.r11.MANIFEST in start.evidence_paths()


def test_r12_write_lease_carries_new_epoch_and_exact_scope():
    start = importlib.import_module("scripts.f18_wsl_ops_r12_overlay")
    lease = start._lease("write", "2026-09-25T10:00:00+09:00",
                         "2026-09-25T22:00:00+09:00", "control-qa")
    assert lease["lease_epoch"] == 10 and lease["write_epoch"] == 10
    assert lease["path_scope"] == EXACT3
    assert lease["worker_lease_id"] == start.WORKER
