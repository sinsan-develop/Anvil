"""F-20 R5a append-only handoff must restrict the current-contract writer."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess

from scripts import f20_rework_overlay as r1


ROOT = Path(__file__).resolve().parents[2]
PREDECESSOR = "4f681a7471cb7587f470ab9af1c8cd791a16b900"
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def _fixture(tmp_path: Path) -> Path:
    root = tmp_path / "repository"
    subprocess.run(["git", "-c", "core.autocrlf=false", "clone", "--quiet", "--local",
                    "--no-hardlinks", str(ROOT), str(root)], check=True)
    subprocess.run(["git", "checkout", "--quiet", "-B", "codex/f18-wsl-ops", PREDECESSOR],
                   cwd=root, check=True)
    subprocess.run(["git", "remote", "add", "development", str(ROOT)], cwd=root, check=True)
    subprocess.run(["git", "fetch", "--quiet", "development", "codex/f18-wsl-ops"], cwd=root, check=True)
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", PREDECESSOR],
                   cwd=root, check=True)
    subprocess.run(["git", "branch", "--set-upstream-to=development/codex/f18-wsl-ops"],
                   cwd=root, check=True, capture_output=True)
    for relative in ("docs/work_orders/F-20_REWORK_R5A_WORK_INSTRUCTION.md",
                     "docs/work_orders/F-20_REWORK_R5A_INVOCATION.md"):
        target = root / relative
        target.write_bytes((ROOT / relative).read_bytes())
    return root


def _bundle(root: Path) -> dict:
    from scripts.f20_rework_r5a_overlay import EVENTS, PROGRESS

    return {"_root": root, "events": json.loads((root / EVENTS).read_bytes()),
            "progress": json.loads((root / PROGRESS).read_bytes())}


def test_r5a_revokes_r4_before_exact2_grant_and_preserves_prefix(tmp_path):
    from scripts.f20_rework_r5a_overlay import SCOPE, materialize, validate_control

    root = _fixture(tmp_path)
    old_raw = (root / "docs/progress/progress-events.json").read_bytes()
    materialize(root, PREDECESSOR, NOW, "r5atest")
    bundle = _bundle(root)
    rows = bundle["events"]["events"]
    assert rows[:1737] == json.loads(old_raw)["events"]
    assert [row["event_type"] for row in rows[1737:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
        "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert bundle["progress"]["write_lease"]["path_scope"] == SCOPE
    assert "F-20" not in bundle["progress"]["completed_packages"]
    assert validate_control(root, bundle, NOW) == []
    raw = (root / "docs/progress/progress-events.json").read_bytes()
    old_event_bytes = old_raw.split(b'"events": [', 1)[1].split(
        b'\n  ],\n  "last_event_id"', 1)[0]
    assert old_event_bytes in raw


def test_r5a_still_refuses_forged_current_progress(tmp_path):
    from scripts.f20_rework_r5a_overlay import materialize
    from scripts.check_project_progress import validate_bundle, load_bundle

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "r5atest")
    bundle = load_bundle(root)
    assert validate_bundle(bundle) == []
    bundle["progress"]["next_safe_action"] = "FORGED"
    bundle["progress"]["snapshot_hash"] = r1._sha(r1._canonical(
        {key: value for key, value in bundle["progress"].items() if key != "snapshot_hash"}))
    assert validate_bundle(bundle)


def test_r5a_rejects_tampered_predecessor_and_current_artifacts(tmp_path):
    from scripts.f20_rework_r5a_overlay import (
        DIGEST, EVENTS, HANDOFF, MANIFEST, REPORT, WI, materialize, validate_control,
    )

    root = _fixture(tmp_path)
    report = root / REPORT
    report_raw = report.read_bytes()
    report.write_bytes(report_raw + b"\nforged\n")
    try:
        try:
            materialize(root, PREDECESSOR, NOW, "r5atest")
        except RuntimeError as exc:
            assert "PREDECESSOR_INVALID" in str(exc)
        else:
            raise AssertionError("forged R4 report was accepted")
    finally:
        report.write_bytes(report_raw)

    materialize(root, PREDECESSOR, NOW, "r5atest")
    for relative in (DIGEST, HANDOFF, MANIFEST, EVENTS, WI, REPORT):
        path = root / relative
        original = path.read_bytes()
        forged = (original.replace(b'"last_sequence": 1743', b'"last_sequence": 1742', 1)
                  if relative == EVENTS else original + b"\nforged\n")
        path.write_bytes(forged)
        try:
            assert validate_control(root, _bundle(root), NOW), relative
        finally:
            path.write_bytes(original)
