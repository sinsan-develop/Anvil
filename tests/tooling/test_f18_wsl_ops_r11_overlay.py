"""R11 mixed-JWKS writer starts only from the verified R10 closeout."""

import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
R10_CLOSE = "2e6535359b60de1708bea6e25613b3bd6402aa1f"
EXACT3 = sorted(("packages/api/oidc_identity.py", "tests/api/test_oidc_identity.py",
                 "docs/04_test_reports/F-18_WSL_OPS_REPORT.md"))


def _published_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{R10_CLOSE}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r11_binds_published_r10_close_and_exact_product_scope():
    start = importlib.import_module("scripts.f18_wsl_ops_r11_overlay")
    assert start.R10_CLOSE_HEAD == R10_CLOSE
    assert start.write_paths() == EXACT3
    assert start.validate_predecessor(ROOT, _published_progress()) == []
    changed = _published_progress()
    changed["worker_lease"] = {"lease_id": "stale"}
    assert start.validate_predecessor(ROOT, changed)


def test_r11_control_scope_cannot_claim_product_as_evidence():
    start = importlib.import_module("scripts.f18_wsl_ops_r11_overlay")
    assert set(start.write_paths()).isdisjoint(start.evidence_paths())
    assert start.MANIFEST in start.control_paths()
    assert {start.r10_close.MANIFEST, start.r10_close.r10.MANIFEST,
            start.r10_close.r10.r9_close.MANIFEST,
            start.r10_close.r10.r9_close.r9.MANIFEST}.issubset(start.evidence_paths())
