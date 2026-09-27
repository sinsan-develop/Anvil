"""F-20 R4 must hand off the exact six test paths without rewriting history."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess

import pytest

from scripts import f20_rework_overlay as r1


ROOT = Path(__file__).resolve().parents[2]
PREDECESSOR = "b8e9e6803587f4b98adc9c56d23c24b6c4999570"
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def _fixture(tmp_path: Path) -> Path:
    root = tmp_path / "repository"
    subprocess.run(["git", "-c", "core.autocrlf=false", "clone", "--quiet", "--local",
                    "--no-hardlinks", str(ROOT), str(root)], check=True)
    subprocess.run(["git", "checkout", "--quiet", "--detach", PREDECESSOR], cwd=root, check=True)
    subprocess.run(["git", "checkout", "--quiet", "-B", "codex/f18-wsl-ops", PREDECESSOR], cwd=root, check=True)
    subprocess.run(["git", "remote", "add", "development", str(ROOT)], cwd=root, check=True)
    subprocess.run(["git", "fetch", "--quiet", "development", "codex/f18-wsl-ops"], cwd=root, check=True)
    subprocess.run(["git", "branch", "--set-upstream-to=development/codex/f18-wsl-ops"], cwd=root, check=True)
    for relative in ("docs/work_orders/F-20_REWORK_R4_WORK_INSTRUCTION.md",
                     "docs/work_orders/F-20_REWORK_R4_INVOCATION.md"):
        target = root / relative
        target.write_bytes((ROOT / relative).read_bytes())
    return root


def _bundle(root: Path) -> dict:
    from scripts.f20_rework_r4_overlay import EVENTS, PROGRESS
    return {"_root": root, "events": json.loads((root / EVENTS).read_bytes()),
            "progress": json.loads((root / PROGRESS).read_bytes())}


def test_r4_revokes_r3_before_exact6_grant_without_changing_prefix(tmp_path):
    from scripts.f20_rework_r4_overlay import SCOPE, materialize, validate_control

    root = _fixture(tmp_path)
    old_raw = (root / "docs/progress/progress-events.json").read_bytes()
    materialize(root, PREDECESSOR, NOW, "r4test")
    bundle = _bundle(root)
    rows = bundle["events"]["events"]
    assert rows[:1731] == json.loads(old_raw)["events"]
    assert [row["event_type"] for row in rows[1731:]] == [
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


def test_r4_rejects_scope_token_actor_and_expiry_tamper(tmp_path):
    from scripts.f20_rework_r4_overlay import INVOCATION, WI, materialize, validate_transition

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "r4test")
    rows = _bundle(root)["events"]["events"]
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))

    forged = deepcopy(rows)
    forged[-2]["details"]["path_scope"].append("packages/api/fastapi_app.py")
    forged[-1]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-2]))
    assert "F20_R4_TRANSITION_INVALID" in validate_transition(forged, wi_sha, invocation_sha, NOW)

    forged = deepcopy(rows)
    old_token = forged[1728]["details"]["execution_fencing_token"]
    forged[-3]["details"]["execution_fencing_token"] = old_token
    forged[-3]["details"]["fencing_token"] = old_token
    forged[-2]["details"]["execution_fencing_token"] = old_token
    forged[-2]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-3]))
    forged[-1]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-2]))
    assert "F20_R4_TRANSITION_INVALID" in validate_transition(forged, wi_sha, invocation_sha, NOW)

    forged = deepcopy(rows)
    forged[-6]["actor_type"] = "HUMAN"
    for index in range(-5, 0):
        forged[index]["previous_event_sha256"] = r1._sha(r1._canonical(forged[index - 1]))
    assert "F20_R4_TRANSITION_INVALID" in validate_transition(forged, wi_sha, invocation_sha, NOW)

    forged = deepcopy(rows)
    forged[-3]["details"]["expires_at"] = forged[-3]["details"]["issued_at"]
    assert "F20_R4_TRANSITION_INVALID" in validate_transition(forged, wi_sha, invocation_sha, NOW)

    forged = deepcopy(rows)
    forged[-3]["details"]["execution_fencing_token"] = "short"
    forged[-3]["details"]["fencing_token"] = "short"
    forged[-2]["details"]["execution_fencing_token"] = "short"
    forged[-2]["details"]["write_fencing_token"] = "another"
    forged[-2]["details"]["fencing_token"] = "another"
    forged[-2]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-3]))
    forged[-1]["previous_event_sha256"] = r1._sha(r1._canonical(forged[-2]))
    assert "F20_R4_TRANSITION_INVALID" in validate_transition(forged, wi_sha, invocation_sha, NOW)


def test_r4_rechecks_predecessor_report_digest_and_raw_bytes(tmp_path):
    from scripts.f20_rework_r4_overlay import DIGEST, EVENTS, REPORT, materialize, validate_control

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "r4test")
    report = root / REPORT
    report.write_bytes(report.read_bytes() + b"\nforged\n")
    assert "F20_R4_MANIFEST_INVALID" in validate_control(root, _bundle(root), NOW)
    report.write_bytes((ROOT / REPORT).read_bytes())

    digest = root / DIGEST
    data = json.loads(digest.read_bytes())
    data["progress"]["file_sha256"] = "0" * 64
    digest.write_bytes(r1._pretty(data))
    assert "F20_R4_DIGEST_INVALID" in validate_control(root, _bundle(root), NOW)

    raw = (root / EVENTS).read_bytes()
    (root / EVENTS).write_bytes(raw.replace(b'"last_sequence": 1737', b'"last_sequence": 1736', 1))
    assert "F20_R4_HISTORY_MUTATED" in validate_control(root, _bundle(root), NOW)


def test_r4_missing_report_fails_closed(tmp_path):
    from scripts.f20_rework_r4_overlay import REPORT, materialize, validate_control

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "r4test")
    (root / REPORT).unlink()
    assert "F20_R4_CONTROL_MISSING" in validate_control(root, _bundle(root), NOW)


def test_r4_rejects_semantically_equal_prior_event_byte_rewrite(tmp_path):
    from scripts.f20_rework_r4_overlay import EVENTS, materialize, validate_control

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "r4test")
    path = root / EVENTS
    raw = path.read_bytes()
    assert raw.count(b'  "events": [') == 1
    path.write_bytes(raw.replace(b'  "events": [', b'   "events": [', 1))
    assert "F20_R4_HISTORY_MUTATED" in validate_control(root, _bundle(root), NOW)


@pytest.mark.parametrize("kind", ["digest", "manifest", "handoff"])
def test_r4_refuses_forged_r3_control_before_new_lease(tmp_path, kind):
    from scripts import f20_rework_r3_overlay as r3
    from scripts.f20_rework_r4_overlay import materialize

    root = _fixture(tmp_path)
    if kind == "digest":
        path = root / r3.DIGEST
        data = json.loads(path.read_bytes())
        data["progress"]["file_sha256"] = "0" * 64
        path.write_bytes(r1._pretty(data))
    elif kind == "manifest":
        path = root / r3.MANIFEST
        data = json.loads(path.read_bytes())
        data["predecessor_events_sha256"] = "0" * 64
        path.write_bytes(r1._pretty(data))
    else:
        path = root / r3.HANDOFF
        path.write_bytes(path.read_bytes().replace(b'"event_sequence": 1731', b'"event_sequence": 1730', 1))
    with pytest.raises(RuntimeError, match="F20_R4_PREDECESSOR_INVALID"):
        materialize(root, PREDECESSOR, NOW, "r4test")


@pytest.mark.parametrize("kind", ["head", "remote"])
def test_r4_refuses_git_sha_drift_at_issuance(tmp_path, kind):
    from scripts.f20_rework_r4_overlay import materialize

    root = _fixture(tmp_path)
    if kind == "head":
        subprocess.run(["git", "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                        "commit", "--quiet", "--allow-empty", "-m", "synthetic drift"], cwd=root, check=True)
    else:
        parent = subprocess.check_output(["git", "rev-parse", f"{PREDECESSOR}^"], cwd=root).decode().strip()
        subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", parent], cwd=root, check=True)
    with pytest.raises(RuntimeError, match="F20_R4_PREDECESSOR_INVALID"):
        materialize(root, PREDECESSOR, NOW, "r4test")


def test_r4_g05_router_uses_current_append_only_control(tmp_path):
    from scripts import check_project_progress as checker
    from scripts import f20_rework_r4_overlay as r4

    root = _fixture(tmp_path)
    r4.materialize(root, PREDECESSOR, NOW, "r4test")
    bundle = checker.load_bundle(root)
    assert checker.validate_bundle(bundle) == []
