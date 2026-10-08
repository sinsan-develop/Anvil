"""C30 recovery preflight: genuine Git objects and adversarial read-only inputs."""

from __future__ import annotations

from pathlib import Path
from copy import deepcopy
import json
import subprocess

from scripts import f20_c30_recovery_v2 as recovery


ROOT = Path(__file__).resolve().parents[2]


def _git_blob(commit: str, path: str) -> bytes:
    return subprocess.check_output(
        ["git", "-c", "core.excludesFile=", "show", f"{commit}:{path}"], cwd=ROOT
    )


def _file(path: str) -> bytes:
    return (ROOT / path).read_bytes()


def test_genuine_git_objects_recalculate_preflight():
    result = recovery.verify_repository(ROOT)
    assert result.eligible, result.errors
    assert result.evidence["anchor_events"] == 1712
    assert result.evidence["cutover_events"] == 2040
    assert result.evidence["changed_sequences"] == list(range(1689, 1713))
    assert result.evidence["added_sequences"] == [1713, 1714]
    assert len(result.evidence["false_acceptance_sequences"]) == 11
    assert result.evidence["validated_followup_events"] == 326


def test_missing_anchor_git_blob_fails_closed():
    def missing(commit: str, path: str) -> bytes:
        if commit == recovery.ANCHOR_COMMIT:
            raise subprocess.CalledProcessError(128, ["git", "show"])
        return _git_blob(commit, path)

    result = recovery.verify_repository(ROOT, git_blob_reader=missing)
    assert not result.eligible
    assert "ANCHOR_GIT_OBJECT_UNAVAILABLE" in result.errors


def test_cutover_raw_event_tamper_fails_closed():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == recovery.EVENTS_PATH:
            return raw.replace(b'"event_id": "evt_f20_2038_package_resumed"',
                               b'"event_id": "evt_f20_2038_package_RESUMED"', 1)
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert "CUTOVER_RAW_PREFIX_MISMATCH" in result.errors


def test_work_instruction_hash_tamper_fails_closed():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == "docs/work_orders/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_WORK_INSTRUCTION.md":
            return raw + b"\nwrong revision\n"
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert any(error.startswith("WORK_INSTRUCTION_HASH_MISMATCH") for error in result.errors)


def test_invocation_hash_tamper_fails_closed():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == "docs/work_orders/F-20_REWORK_R1_INVOCATION.md":
            return raw + b"\nwrong invocation\n"
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert any(error.startswith("WORK_INSTRUCTION_HASH_MISMATCH") for error in result.errors)


def test_false_acceptance_change_in_incident_object_fails_closed():
    def altered(commit: str, path: str) -> bytes:
        raw = _git_blob(commit, path)
        if commit == recovery.INCIDENT_COMMIT:
            stream = json.loads(raw)
            stream["events"][1688]["details"]["accepted"] = False
            return json.dumps(stream, ensure_ascii=False).encode("utf-8")
        return raw

    result = recovery.verify_repository(ROOT, git_blob_reader=altered)
    assert not result.eligible
    assert "FALSE_ACCEPTANCE_SET_INVALID" in result.errors


def test_independent_lease_pairing_rejects_fencing_tamper():
    events = json.loads(_git_blob(recovery.CUTOVER_COMMIT, recovery.EVENTS_PATH))["events"]
    altered = deepcopy(events)
    altered[1717]["details"]["write_fencing_token"] = "forged"
    result = recovery.RecoveryResult()
    recovery._check_followups(result, altered, _file)
    assert "LEASE_PAIRING_INVALID:1" in result.errors


def test_revision_binding_mismatch_fails_closed():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == recovery.REVISION_BINDING_PATH:
            binding = json.loads(raw)
            binding["bindings"][0]["new_hash"] = "0" * 64
            return json.dumps(binding).encode("utf-8")
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert "APPROVAL_BINDING_INVALID" in result.errors


def test_approval_binding_tamper_fails_closed():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == "docs/approvals/APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001.md":
            return raw + b"\nwrong approval\n"
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert "APPROVAL_BINDING_INVALID" in result.errors


def test_current_control_cannot_reaccept_quarantined_history():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == recovery.EVENTS_PATH:
            before, marker, after = raw.rpartition(b'"accepted": false')
            assert marker and b'"event_id": "evt_f20_2044_package_resumed"' in before
            return before + b'"accepted": true' + after
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert "CURRENT_CONTROL_STATE_INVALID" in result.errors


def test_whitespace_between_cutover_events_is_part_of_raw_prefix():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == recovery.EVENTS_PATH:
            before, marker, after = raw.partition(b'},\n    {')
            assert marker
            return before + b'}, \n    {' + after
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert "CUTOVER_RAW_PREFIX_MISMATCH" in result.errors


def test_last_resume_status_cannot_claim_acceptance():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == recovery.EVENTS_PATH:
            before, marker, after = raw.rpartition(b'"package_status": "REWORK_IN_PROGRESS"')
            assert marker and b'"event_id": "evt_f20_2044_package_resumed"' in before
            return before + b'"package_status": "ACCEPTED"' + after
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert "CURRENT_CONTROL_STATE_INVALID" in result.errors


def test_completed_lease_projection_must_be_revoked():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == recovery.PROGRESS_PATH:
            progress = json.loads(raw)
            progress["completed_f20_r1_worker_lease"]["status"] = "ACTIVE"
            return json.dumps(progress, ensure_ascii=False).encode("utf-8")
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert any(error.startswith("COMPLETED_LEASE_PROJECTION_INVALID") for error in result.errors)


def test_scope_artifact_hash_must_match_actual_approved_document():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == recovery.PROGRESS_PATH:
            progress = json.loads(raw)
            progress["scope_revision_binding"]["artifact_sha256"]["Anvil_설계서_v2.md"] = "0" * 64
            return json.dumps(progress, ensure_ascii=False).encode("utf-8")
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert "APPROVAL_BINDING_INVALID" in result.errors


def test_failed_preflight_reports_inspected_not_validated_counts():
    def altered(path: str) -> bytes:
        raw = _file(path)
        if path == recovery.PROGRESS_PATH:
            progress = json.loads(raw)
            progress["completed_f20_r1_worker_lease"]["status"] = "ACTIVE"
            return json.dumps(progress, ensure_ascii=False).encode("utf-8")
        return raw

    result = recovery.verify_repository(ROOT, file_reader=altered)
    assert not result.eligible
    assert result.evidence["inspected_followup_events"] == 326
    assert not any(key.startswith("validated_") for key in result.evidence)
