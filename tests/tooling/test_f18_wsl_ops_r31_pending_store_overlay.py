"""R31 pending-store exact-path writer projection guards."""

from copy import deepcopy
import json
from pathlib import Path

from scripts import f18_wsl_ops_r31_pending_store_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r31_exact_product_write_scope():
    assert overlay.write_paths() == sorted([
        "migrations/versions/0017_oidc_pending_auth.py",
        "packages/persistence/oidc_pending_auth.py",
        "tests/persistence/test_oidc_pending_auth.py",
        "tests/persistence/test_oidc_pending_auth_postgres.py",
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
    ])
    assert overlay.PREDECESSOR == "fb8903edc8892aa0f7b0c4bea38325159059c3a5"
    assert overlay.MODE == "F18_WSL_OPS_R31_PENDING_STORE_START"


def test_r31_lease_tokens_are_distinct_and_exact():
    worker = overlay._lease("worker", "2026-09-26T00:00:00+09:00", "2026-09-27T00:00:00+09:00", "abc")
    write = overlay._lease("write", "2026-09-26T00:00:00+09:00", "2026-09-27T00:00:00+09:00", "abc")
    assert worker["execution_fencing_token"] != write["write_fencing_token"]
    assert worker["path_scope"] == write["path_scope"] == overlay.write_paths()
    assert write["worker_lease_id"] == worker["lease_id"]
    assert worker["lease_epoch"] == write["write_epoch"] == 15


def test_r31_projection_rejects_wrong_writer_scope_and_binding():
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"].append("packages/api/runtime.py")
    assert "F18_R31_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["parent_approval_id"] = "forged"
    assert "F18_R31_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
