"""R30 OIDC principal exact-path writer projection guards."""

from copy import deepcopy
import json
from pathlib import Path

from scripts import f18_wsl_ops_r30_oidc_principal_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r30_exact_product_write_scope():
    assert overlay.write_paths() == sorted([
        "packages/api/oidc_principal.py",
        "tests/api/test_oidc_principal.py",
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
    ])
    assert overlay.PREDECESSOR == "1dfe23d453a93fca1aa9710c3bd0acbdbe085d33"
    assert overlay.MODE == "F18_WSL_OPS_R30_OIDC_PRINCIPAL_START"


def test_r30_lease_tokens_are_distinct_and_exact():
    worker = overlay._lease("worker", "2026-09-26T00:00:00+09:00", "2026-09-27T00:00:00+09:00", "abc")
    write = overlay._lease("write", "2026-09-26T00:00:00+09:00", "2026-09-27T00:00:00+09:00", "abc")
    assert worker["execution_fencing_token"] != write["write_fencing_token"]
    assert worker["path_scope"] == write["path_scope"] == overlay.write_paths()
    assert write["worker_lease_id"] == worker["lease_id"]
    assert worker["lease_epoch"] == write["write_epoch"] == 14


def test_r30_projection_rejects_wrong_writer_scope_and_binding():
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return  # pre-issuance baseline; exact issuance is tested after materialize
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"].append("packages/api/runtime.py")
    assert "F18_R30_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["parent_approval_id"] = "forged"
    assert "F18_R30_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
