"""F-20 R2 may change product writers only after an append-only lease handoff."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_rework_overlay as r1


ROOT = Path(__file__).resolve().parents[2]
NOW = datetime.now(timezone.utc).replace(microsecond=0)
COPIED = (
    "docs/progress/progress-events.json",
    "docs/progress/build-progress.json",
    "docs/progress/BUILD_HANDOFF.md",
    "docs/work_orders/F-20_REWORK_R1_WORK_INSTRUCTION.md",
    "docs/work_orders/F-20_REWORK_R1_INVOCATION.md",
    "docs/work_orders/F-20_REWORK_R2_WORK_INSTRUCTION.md",
    "docs/work_orders/F-20_REWORK_R2_INVOCATION.md",
    "docs/evidence/manifests/F-20_WSL_FINAL_VALIDATION_MANIFEST.json",
    "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md",
)


def _fixture(tmp_path):
    for relative in COPIED:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((ROOT / relative).read_bytes())
    return tmp_path


def _bundle(root):
    return {
        "_root": root,
        "events": json.loads((root / COPIED[0]).read_bytes()),
        "progress": json.loads((root / COPIED[1]).read_bytes()),
    }


def test_f20_r2_revokes_old_leases_before_exact_scope_grant(tmp_path):
    from scripts.f20_rework_r2_overlay import SCOPE, materialize, validate_control

    root = _fixture(tmp_path)
    old_rows = deepcopy(_bundle(root)["events"]["events"])
    materialize(root, "a" * 40, NOW, "r2test")
    bundle = _bundle(root)
    rows = bundle["events"]["events"]
    assert rows[:1719] == old_rows
    assert [row["event_type"] for row in rows[1719:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
        "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert bundle["progress"]["write_lease"]["path_scope"] == SCOPE
    assert "F-20" not in bundle["progress"]["completed_packages"]
    assert validate_control(root, bundle, NOW) == []
    from scripts.check_project_progress import _validate_events
    bundle["event_contract"] = json.loads(
        (ROOT / "docs/progress/progress-event-contract.json").read_bytes())
    assert _validate_events(bundle) == []


def test_f20_r2_rejects_scope_and_old_token_reuse(tmp_path):
    from scripts.f20_rework_r2_overlay import (
        INVOCATION, WI, materialize, validate_transition,
    )

    root = _fixture(tmp_path)
    materialize(root, "a" * 40, NOW, "r2test")
    rows = _bundle(root)["events"]["events"]
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))

    forged = deepcopy(rows)
    forged[-2]["details"]["path_scope"].append("packages/unrelated.py")
    forged[-1]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-2]))
    assert "F20_R2_TRANSITION_INVALID" in validate_transition(
        forged, wi_sha, invocation_sha, NOW)

    forged = deepcopy(rows)
    old_token = forged[1716]["details"]["execution_fencing_token"]
    forged[-3]["details"]["execution_fencing_token"] = old_token
    forged[-3]["details"]["fencing_token"] = old_token
    forged[-2]["details"]["execution_fencing_token"] = old_token
    forged[-2]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-3]))
    forged[-1]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-2]))
    assert "F20_R2_TRANSITION_INVALID" in validate_transition(
        forged, wi_sha, invocation_sha, NOW)

    forged = deepcopy(rows)
    forged[-3]["details"]["baseline_git_commit"] = "b" * 40
    forged[-2]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-3]))
    forged[-1]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-2]))
    assert "F20_R2_TRANSITION_INVALID" in validate_transition(
        forged, wi_sha, invocation_sha, NOW)

    forged = deepcopy(rows)
    forged[-6]["actor_type"] = "HUMAN"
    for index in range(-5, 0):
        forged[index]["previous_event_sha256"] = r1._sha(r1._canonical(forged[index - 1]))
    assert "F20_R2_TRANSITION_INVALID" in validate_transition(
        forged, wi_sha, invocation_sha, NOW)


def test_f20_r2_rechecks_predecessor_invalidation_evidence(tmp_path):
    from scripts.f20_rework_r2_overlay import materialize, validate_control

    root = _fixture(tmp_path)
    materialize(root, "a" * 40, NOW, "r2test")
    report = root / "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md"
    report.write_bytes(report.read_bytes() + b"\nforged\n")
    assert "F20_R2_HISTORY_MUTATED" in validate_control(root, _bundle(root), NOW)


def test_f20_r2_rejects_forged_revocation_time(tmp_path):
    from scripts.f20_rework_r2_overlay import materialize, validate_control

    root = _fixture(tmp_path)
    materialize(root, "a" * 40, NOW, "r2test")
    bundle = _bundle(root)
    bundle["progress"]["completed_f20_r1_write_lease"]["revoked_at"] = "2000-01-01T00:00:00+00:00"
    assert "F20_R2_PROGRESS_INVALID" in validate_control(root, bundle, NOW)
