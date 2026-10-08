"""R38B same-stage fixture-only lease rework control."""

from datetime import datetime, timezone
import json
from pathlib import Path
from unittest import mock

from scripts import f20_u01_r38b_fixture_rework_overlay as overlay
from scripts.check_project_progress import validate_event_stream


ROOT = Path(__file__).resolve().parents[2]


def _candidate():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    binding = overlay._binding(ROOT, progress, wi_sha)
    rows = overlay._make_rows(stream["events"], progress, wi_sha, invocation_sha,
                              at, "r38bfix1004", binding)
    return raw, stream, progress, rows, overlay._projection(
        ROOT, progress, raw, stream, rows, wi_sha, invocation_sha, binding)


def test_rework_revokes_old_then_issues_exact6_epoch54():
    raw, stream, old, rows, outputs = _candidate()
    final = json.loads(outputs[overlay.PROGRESS])
    events = json.loads(outputs[overlay.EVENTS])
    assert stream["last_sequence"] == 2032
    assert old["worker_lease"]["lease_epoch"] == 53
    assert old["write_lease"]["write_epoch"] == 53
    assert [row["sequence"] for row in rows] == list(range(2033, 2039))
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert events["events"][:2032] == stream["events"]
    assert overlay._append_raw(raw, stream, rows) == outputs[overlay.EVENTS]
    assert overlay.SCOPE == [
        "tests/observability/test_f20_u01_r17_run_host_binding.py",
        "tests/observability/test_f20_u01_r36_agent_host_binding.py",
        "tests/api/test_f20_u01_r9_oidc_queue_host.py",
        "tests/api/test_f20_u01_r37_provider_host_binding.py",
        "tests/integration/test_f20_u01_r37_provider_host_pg15.py",
        "docs/04_test_reports/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_RESULT.md",
    ]
    assert final["worker_lease"]["lease_epoch"] == 54
    assert final["write_lease"]["write_epoch"] == 54
    assert final["worker_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["path_scope"] == overlay.SCOPE
    assert final["completed_f20_u01_r38_worker_lease"]["status"] == "REVOKED"
    assert final["completed_f20_u01_r38_write_lease"]["status"] == "REVOKED"
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]


def test_revised_instruction_carries_generic_and_historical_payload_contract_fields():
    _, _, _, rows, outputs = _candidate()
    contract = json.loads((ROOT / "docs/progress/progress-event-contract.json").read_bytes())
    stream = json.loads(outputs[overlay.EVENTS])
    progress = json.loads(outputs[overlay.PROGRESS])
    generic = tuple(contract["payload_contracts"]["WORK_INSTRUCTION_REVISED"]["required_details"])
    historical_override = ("work_instruction_id", "previous_work_instruction_sha256",
                           "work_instruction_sha256", "reason", "product_write_scope",
                           "projection_mode", "exact_allowed_paths")
    details = rows[2]["details"]
    assert all(key in details and details[key] is not None
               for key in generic + historical_override)
    assert details["parent_work_instruction"]["sha256"] == details["previous_work_instruction_sha256"]
    assert details["derived_work_instruction"]["sha256"] == details["work_instruction_sha256"]
    assert details["product_write_scope"] == overlay.SCOPE == details["exact_allowed_paths"]
    assert details["revision_binding"]["binding_id"] == overlay.BINDING_ID
    assert progress["r38b_nonsemantic_revision_binding"] == details["revision_binding"]
    assert "EVENT_PAYLOAD_MISSING" not in validate_event_stream(stream, contract, progress)


def test_rework_freezes_parent_and_rejects_forgery():
    raw, stream, _, rows, _ = _candidate()
    assert overlay._frozen_prior_match(ROOT)
    assert set(overlay.SCOPE).isdisjoint(overlay.CONTROL_SCOPE)
    assert all(path not in overlay.CONTROL_SCOPE for path in overlay.FROZEN_PRIOR)
    forged = raw.replace(b'"last_sequence": 2032', b'"last_sequence": 2031')
    try:
        overlay._append_raw(forged, stream, rows)
    except ValueError as error:
        assert str(error) == "F20_U01_R38B_EVENT_BYTES_INVALID"
    else:
        raise AssertionError("forged raw prefix accepted")
    target = ROOT / overlay.PRIOR_WI
    original = Path.read_bytes
    with mock.patch.object(Path, "read_bytes", lambda path: original(path) + b"x"
                           if path == target else original(path)):
        assert not overlay._frozen_prior_match(ROOT)
    registry = ROOT / overlay.REGISTRY
    with mock.patch.object(Path, "read_bytes", lambda path: original(path) + b"x"
                           if path == registry else original(path)):
        assert not overlay._frozen_prior_match(ROOT)
