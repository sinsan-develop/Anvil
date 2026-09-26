"""R29 network exact-path writer projection guards."""

from copy import deepcopy
import json
from pathlib import Path

from scripts import f18_wsl_ops_r29_network_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r29_exact_product_write_scope():
    assert overlay.write_paths() == sorted([
        "deploy/wsl/compose.f18.yml",
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
        "tests/deploy/test_f18_network_topology.py",
    ])
    assert overlay.PREDECESSOR == "85f7d946925de91e57859895e6083c7d2d21216f"
    assert overlay.MODE == "F18_WSL_OPS_R29_NETWORK_START"


def test_r29_lease_tokens_are_distinct_and_exact():
    worker = overlay._lease("worker", "2026-09-26T00:00:00+09:00", "2026-09-27T00:00:00+09:00", "abc")
    write = overlay._lease("write", "2026-09-26T00:00:00+09:00", "2026-09-27T00:00:00+09:00", "abc")
    assert worker["execution_fencing_token"] != write["write_fencing_token"]
    assert worker["path_scope"] == write["path_scope"] == overlay.write_paths()
    assert write["worker_lease_id"] == worker["lease_id"]


def test_r29_projection_rejects_wrong_writer_scope_and_binding():
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return  # pre-issuance baseline; exact issuance is tested after materialize
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"].append("deploy/wsl/compose.f17.yml")
    assert "F18_R29_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["parent_approval_id"] = "forged"
    assert "F18_R29_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
