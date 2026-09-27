"""R10 transport writer starts only from the verified R9 closeout."""

import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
R9_CLOSE = "752c6b75e939e98b06286a227e7cebaff4876b88"
EXACT6 = sorted(("packages/api/oidc_issuer_transport.py",
                 "tests/api/test_oidc_issuer_transport.py",
                 "pyproject.toml", "uv.lock", "deploy/wsl/requirements-runtime.txt",
                 "docs/04_test_reports/F-18_WSL_OPS_REPORT.md"))


def _published_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{R9_CLOSE}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r10_binds_published_r9_close_and_exact_product_scope():
    start = importlib.import_module("scripts.f18_wsl_ops_r10_overlay")
    assert start.R9_CLOSE_HEAD == R9_CLOSE
    assert start.write_paths() == EXACT6
    assert start.validate_predecessor(ROOT, _published_progress()) == []
    changed = _published_progress()
    changed["worker_lease"] = {"lease_id": "stale"}
    assert start.validate_predecessor(ROOT, changed)


def test_r10_control_scope_cannot_claim_product_as_evidence():
    start = importlib.import_module("scripts.f18_wsl_ops_r10_overlay")
    assert set(start.write_paths()).isdisjoint(start.evidence_paths())
    assert start.MANIFEST in start.control_paths()
    assert start.r9_close.MANIFEST in start.evidence_paths()
    assert start.r9_close.r9.MANIFEST in start.evidence_paths()
