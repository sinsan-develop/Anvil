"""R32 writer projection binds the approved product paths and fresh leases."""

from copy import deepcopy
import json
from pathlib import Path

from scripts import f18_wsl_ops_r32_trusted_directory_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _bundle():
    return {
        "progress": json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")),
        "events": json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8")),
    }


def test_r32_scope_and_fresh_lease_bindings():
    assert overlay.PREDECESSOR == "ae3d7b24165ff9dd3aa34c536a564486ba1d0dbf"
    assert overlay.MODE == "F18_WSL_OPS_R32_TRUSTED_DIRECTORY_START"
    assert overlay.write_paths() == sorted((
        "migrations/versions/0018_oidc_principal_directory.py",
        "packages/persistence/oidc_principal_directory.py",
        "tests/persistence/test_oidc_principal_directory.py",
        "tests/persistence/test_oidc_principal_directory_postgres.py",
        "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
    ))
    assert overlay.WORKER != overlay.previous.r31.WORKER
    assert overlay.WRITE != overlay.previous.r31.WRITE


def test_r32_projection_rejects_writer_scope_and_binding_tampering():
    bundle = _bundle()
    if bundle["progress"]["repository"]["projection_mode"] != overlay.MODE:
        return  # exact projection checked after materialize
    assert overlay.validate(ROOT, bundle) == []
    tampered = deepcopy(bundle)
    tampered["progress"]["write_lease"]["path_scope"] = []
    assert "F18_R32_LEASE_INVALID" in overlay.validate(ROOT, tampered)
    tampered = deepcopy(bundle)
    tampered["progress"]["active_work_instruction"]["sha256"] = "forged"
    assert "F18_R32_INSTRUCTION_INVALID" in overlay.validate(ROOT, tampered)
