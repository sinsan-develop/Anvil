"""F-20 R3 needs a real append-only handoff before browser client writes."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess

from scripts import f20_rework_overlay as r1


ROOT = Path(__file__).resolve().parents[2]
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def _fixture(tmp_path: Path) -> Path:
    root = tmp_path / "repository"
    subprocess.run(["git", "-c", "core.autocrlf=false", "clone", "--quiet", "--local",
                    "--no-hardlinks", str(ROOT), str(root)], check=True)
    for relative in ("docs/work_orders/F-20_REWORK_R3_WORK_INSTRUCTION.md",
                     "docs/work_orders/F-20_REWORK_R3_INVOCATION.md"):
        target = root / relative
        target.write_bytes((ROOT / relative).read_bytes())
    return root


def _bundle(root: Path) -> dict:
    from scripts.f20_rework_r3_overlay import EVENTS, PROGRESS
    return {"_root": root, "events": json.loads((root / EVENTS).read_bytes()),
            "progress": json.loads((root / PROGRESS).read_bytes())}


def test_f20_r3_revokes_r2_before_exact5_grant_and_preserves_prefix(tmp_path):
    from scripts.f20_rework_r3_overlay import SCOPE, materialize, validate_control

    root = _fixture(tmp_path)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    old_raw = (root / "docs/progress/progress-events.json").read_bytes()
    materialize(root, head, NOW, "r3test")
    bundle = _bundle(root)
    rows = bundle["events"]["events"]
    assert rows[:1725] == json.loads(old_raw)["events"]
    assert [row["event_type"] for row in rows[1725:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
        "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert bundle["progress"]["write_lease"]["path_scope"] == SCOPE
    assert "F-20" not in bundle["progress"]["completed_packages"]
    assert validate_control(root, bundle, NOW) == []
    from scripts.check_project_progress import _validate_events
    bundle["event_contract"] = json.loads(
        (root / "docs/progress/progress-event-contract.json").read_bytes())
    assert _validate_events(bundle) == []


def test_f20_r3_rejects_scope_token_and_event_actor_tamper(tmp_path):
    from scripts.f20_rework_r3_overlay import INVOCATION, WI, materialize, validate_transition

    root = _fixture(tmp_path)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    materialize(root, head, NOW, "r3test")
    rows = _bundle(root)["events"]["events"]
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))

    forged = deepcopy(rows)
    forged[-2]["details"]["path_scope"].append("apps/web/src/unrelated.js")
    forged[-1]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-2]))
    assert "F20_R3_TRANSITION_INVALID" in validate_transition(forged, wi_sha, invocation_sha, NOW)

    forged = deepcopy(rows)
    old_token = forged[1722]["details"]["execution_fencing_token"]
    forged[-3]["details"]["execution_fencing_token"] = old_token
    forged[-3]["details"]["fencing_token"] = old_token
    forged[-2]["details"]["execution_fencing_token"] = old_token
    forged[-2]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-3]))
    forged[-1]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-2]))
    assert "F20_R3_TRANSITION_INVALID" in validate_transition(forged, wi_sha, invocation_sha, NOW)

    forged = deepcopy(rows)
    forged[-6]["actor_type"] = "HUMAN"
    for index in range(-5, 0):
        forged[index]["previous_event_sha256"] = r1._sha(r1._canonical(forged[index - 1]))
    assert "F20_R3_TRANSITION_INVALID" in validate_transition(forged, wi_sha, invocation_sha, NOW)


def test_f20_r3_rechecks_predecessor_report_and_digest(tmp_path):
    from scripts.f20_rework_r3_overlay import DIGEST, REPORT, materialize, validate_control

    root = _fixture(tmp_path)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    materialize(root, head, NOW, "r3test")
    report = root / REPORT
    report.write_bytes(report.read_bytes() + b"\nforged\n")
    assert "F20_R3_MANIFEST_INVALID" in validate_control(root, _bundle(root), NOW)
    report.write_bytes((ROOT / REPORT).read_bytes())
    digest = root / DIGEST
    data = json.loads(digest.read_bytes())
    data["progress"]["file_sha256"] = "0" * 64
    digest.write_bytes(r1._pretty(data))
    assert "F20_R3_DIGEST_INVALID" in validate_control(root, _bundle(root), NOW)


def test_f20_r3_malformed_event_bytes_fail_closed_without_exception(tmp_path):
    from scripts.f20_rework_r3_overlay import EVENTS, materialize, validate_control

    root = _fixture(tmp_path)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    materialize(root, head, NOW, "r3test")
    event_path = root / EVENTS
    event_path.write_bytes(event_path.read_bytes().replace(
        b'"last_sequence": 1731', b'"last_sequence": 1730', 1))
    assert "F20_R3_HISTORY_MUTATED" in validate_control(root, _bundle(root), NOW)


def test_f20_r3_missing_report_and_malformed_tail_fail_closed(tmp_path):
    from scripts.f20_rework_r3_overlay import REPORT, materialize, validate_control

    root = _fixture(tmp_path)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    materialize(root, head, NOW, "r3test")
    report = root / REPORT
    report.unlink()
    assert "F20_R3_CONTROL_MISSING" in validate_control(root, _bundle(root), NOW)
    report.write_bytes((ROOT / REPORT).read_bytes())
    bundle = _bundle(root)
    bundle["events"]["events"][-3]["details"] = None
    assert "F20_R3_TRANSITION_INVALID" in validate_control(root, bundle, NOW)
