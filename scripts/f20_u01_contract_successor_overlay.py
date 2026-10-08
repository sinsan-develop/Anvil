"""Fail-closed, document-only successor of the frozen R48 control projection."""

from __future__ import annotations

from datetime import datetime
import hashlib
import json
from pathlib import Path
import subprocess

try:
    from scripts.check_project_progress import raw_event_object_prefix_bytes
    from scripts import f20_u01_r48_start_overlay as prior
except ModuleNotFoundError:
    from check_project_progress import raw_event_object_prefix_bytes
    import f20_u01_r48_start_overlay as prior


MODE = "F20_U01_SCOPED_FILTER_CONTRACT_DOCUMENT_SUCCESSOR"
SUBJECT = "F-20/U01-CONTRACT-CONTROL"
WI = "docs/work_orders/F-20_U01_CONTRACT_CONTROL_SUCCESSOR_WORK_INSTRUCTION.md"
WI_HASH = "3823675EF63ECE4CE8CE97590441AA2124A47D768D532E5790D1EFB9C1F442A6"
DOCUMENT = "8d5e1bda081e1e9aa864259d522646d4ff3149df"
REMOTE_BASE = "d083a0e79f9bb1c80332d5d8510eeb42056a583e"
BRANCH = "codex/f18-wsl-ops"
UPSTREAM = "development/codex/f18-wsl-ops"
EVENTS = "docs/progress/progress-events.json"
PROGRESS = "docs/progress/build-progress.json"
HANDOFF = "docs/progress/BUILD_HANDOFF.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-contract-successor.json"
CHECKER = "scripts/check_project_progress.py"
R48_MANIFEST = "docs/evidence/manifests/F-20_U01_R48_CRITICAL_ACK_CLOSE_MANIFEST.json"
R48_DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r48-close.json"
DOCS = {
    "docs/04_test_reports/F-20_U01_SCOPED_FILTER_CONTRACT_DRAFT.md",
    "docs/WORK_STATUS.md",
    "docs/work_orders/F-20_U01_SCOPED_FILTER_CONTRACT_REVIEW_WORK_INSTRUCTION_DRAFT.md",
}
EXACT3 = {
    CHECKER,
    "scripts/f20_u01_contract_successor_overlay.py",
    "tests/tooling/test_f20_u01_contract_successor_projection.py",
}
CONTROL = {
    "docs/WORK_STATUS.md", EVENTS, PROGRESS, HANDOFF, DIGEST, WI,
} | EXACT3
KINDS_START = ("WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED")
KINDS_CLOSE = ("HANDOFF_RECORDED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED")
WORKER_TOKEN = "f20-u01-contract-control-execution-fence-epoch-65-4cf54cc2258248d9b1654dfd3f2c4c6d"
WRITE_TOKEN = "f20-u01-contract-control-write-fence-epoch-65-bac68713410a4b378b2b44aa800676e1"
EXPIRES = datetime.fromisoformat("2026-10-06T18:00:09+00:00")
ISSUED = datetime.fromisoformat("2026-10-05T18:00:09+00:00")
BASE66 = "4e72abeed704cf1890bfd64880739067133d9e03"
WI66 = "docs/work_orders/F-20_U01_CONTRACT_CLOSE_TEST_SUCCESSOR_WORK_INSTRUCTION.md"
WI66_HASH = "AFD27354386C0F33FAF24D51503B9187C407FB018A8A402F50D9FA488130A9E8"
SUBJECT66 = "F-20/U01-CONTRACT-CLOSE-TEST"
ACTOR66 = "developer-primary-f20-u01-contract-close-test"
WORKER_TOKEN66 = "f20-u01-contract-close-test-execution-fence-epoch-66-869c6ad745e44ebcaff342c35b5b8a65"
WRITE_TOKEN66 = "f20-u01-contract-close-test-write-fence-epoch-66-1526e14c65074d598022ad36102f8982"
WORKER_ID66 = "worker-lease-f20-u01-contract-close-test-869c6ad745e44ebcaff342c35b5b8a65"
WRITE_ID66 = "write-lease-f20-u01-contract-close-test-1526e14c65074d598022ad36102f8982"
ISSUED66 = datetime.fromisoformat("2026-10-05T23:47:44+00:00")
EXPIRES66 = datetime.fromisoformat("2026-10-06T23:47:44+00:00")
CONTROL66 = CONTROL | {WI66}
BASE67 = "7e6978b9af8b5b3205f9b4df0a6d96eea4ab8a42"
WI67 = "docs/work_orders/F-20_U01_CLOSED_FIXTURE_SUCCESSOR_WORK_INSTRUCTION.md"
WI67_HASH = "2E08AAB56E051B06F1F6D6EF624EEEBE2A7EA3F836A395F2121E6C78D06B3927"
SUBJECT67 = "F-20/U01-CLOSED-FIXTURE"
ACTOR67 = "developer-primary-f20-u01-closed-fixture"
WORKER_TOKEN67 = "f20-u01-closed-fixture-execution-fence-epoch-67-b526bd531e2a4fb389c00c88d58a77ce"
WRITE_TOKEN67 = "f20-u01-closed-fixture-write-fence-epoch-67-46a06cd77fb141ef834b3269b7090341"
WORKER_ID67 = "worker-lease-f20-u01-closed-fixture-b526bd531e2a4fb389c00c88d58a77ce"
WRITE_ID67 = "write-lease-f20-u01-closed-fixture-46a06cd77fb141ef834b3269b7090341"
ISSUED67 = datetime.fromisoformat("2026-10-06T00:24:47+00:00")
EXPIRES67 = datetime.fromisoformat("2026-10-07T00:24:47+00:00")
EXACT2 = EXACT3 - {CHECKER}
CONTROL67 = CONTROL66 | {WI67}
ANCHOR = b'def validate_bundle(bundle):\n    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_R48_CRITICAL_ACK_CLOSE":\n'
ROUTE = b'''def validate_bundle(bundle):
    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_SCOPED_FILTER_CONTRACT_DOCUMENT_SUCCESSOR":
        from datetime import datetime, timezone
        try:
            from scripts.f20_u01_contract_successor_overlay import collect_git, validate_control
        except ModuleNotFoundError:
            from f20_u01_contract_successor_overlay import collect_git, validate_control
        errors = validate_control(Path(bundle["_root"]), bundle, datetime.now(timezone.utc))
        if all(key in bundle for key in (
            "handoff", "failure_ledger", "nonsemantic", "dir_registry", "event_contract",
        )):
            errors.extend(_validate_f20_common_invariants(bundle))
        else:
            errors.append("F20_REWORK_BUNDLE_INCOMPLETE")
        errors.extend(collect_git(Path(bundle["_root"]), bundle["progress"]))
        return sorted(set(errors))
    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_R48_CRITICAL_ACK_CLOSE":
'''


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root, stderr=subprocess.DEVNULL)


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()


def _frozen(root: Path, path: str, commit: str = REMOTE_BASE) -> bytes:
    return _git(root, "show", f"{commit}:{path}")


def _dirty(root: Path) -> set[str]:
    raw = _git(root, "status", "--porcelain=v1", "-uall").decode("utf-8")
    paths = set()
    for row in raw.splitlines():
        path = row[3:]
        if " -> " in path:
            paths.update(path.split(" -> ", 1))
        else:
            paths.add(path)
    return paths


def _lease_valid(lease: dict, *, worker: bool) -> bool:
    token = WORKER_TOKEN if worker else WRITE_TOKEN
    expected_id = ("worker-lease-f20-u01-contract-control-4cf54cc2258248d9b1654dfd3f2c4c6d"
                   if worker else "write-lease-f20-u01-contract-control-bac68713410a4b378b2b44aa800676e1")
    return (
        isinstance(lease, dict)
        and lease.get("lease_id") == expected_id
        and lease.get("actor_id") == "developer-primary-f20-u01-contract-control"
        and lease.get("subject_ref") == SUBJECT
        and lease.get("status") == "ACTIVE"
        and lease.get("lease_epoch") == 65
        and lease.get("fencing_token") == token
        and lease.get("execution_fencing_token") == WORKER_TOKEN
        and lease.get("baseline_git_commit") == DOCUMENT
        and lease.get("dispatch_head") == DOCUMENT
        and set(lease.get("path_scope", [])) == EXACT3
        and len(lease.get("path_scope", [])) == 3
        and datetime.fromisoformat(lease["issued_at"]) == ISSUED
        and datetime.fromisoformat(lease["expires_at"]) == EXPIRES
        and (worker or (
            lease.get("worker_lease_id") == "worker-lease-f20-u01-contract-control-4cf54cc2258248d9b1654dfd3f2c4c6d"
            and lease.get("write_epoch") == 65
            and lease.get("write_fencing_token") == WRITE_TOKEN
            and lease.get("product_write_scope") == []
        ))
    )


def completed_lease_matches(issued: dict, completed: dict, revoked_at: str) -> bool:
    return isinstance(completed, dict) and completed == {
        **issued, "status": "REVOKED", "revoked_at": revoked_at,
    }


def _lease_valid66(lease: dict, *, worker: bool) -> bool:
    if not isinstance(lease, dict):
        return False
    try:
        return (
            lease.get("lease_id") == (WORKER_ID66 if worker else WRITE_ID66)
            and lease.get("actor_id") == ACTOR66
            and lease.get("subject_ref") == SUBJECT66
            and lease.get("status") == "ACTIVE"
            and lease.get("lease_epoch") == 66
            and lease.get("fencing_token") == (WORKER_TOKEN66 if worker else WRITE_TOKEN66)
            and lease.get("execution_fencing_token") == WORKER_TOKEN66
            and lease.get("baseline_git_commit") == BASE66
            and lease.get("dispatch_head") == BASE66
            and set(lease.get("path_scope", [])) == EXACT3
            and len(lease.get("path_scope", [])) == 3
            and datetime.fromisoformat(lease["issued_at"]) == ISSUED66
            and datetime.fromisoformat(lease["expires_at"]) == EXPIRES66
            and (worker or (
                lease.get("worker_lease_id") == WORKER_ID66
                and lease.get("write_epoch") == 66
                and lease.get("write_fencing_token") == WRITE_TOKEN66
                and lease.get("product_write_scope") == []
            ))
        )
    except (KeyError, ValueError, TypeError):
        return False


def _lease_valid67(lease: dict, *, worker: bool) -> bool:
    if not isinstance(lease, dict):
        return False
    try:
        return (
            lease.get("lease_id") == (WORKER_ID67 if worker else WRITE_ID67)
            and lease.get("actor_id") == ACTOR67
            and lease.get("subject_ref") == SUBJECT67
            and lease.get("status") == "ACTIVE"
            and lease.get("lease_epoch") == 67
            and lease.get("fencing_token") == (WORKER_TOKEN67 if worker else WRITE_TOKEN67)
            and lease.get("execution_fencing_token") == WORKER_TOKEN67
            and lease.get("baseline_git_commit") == BASE67
            and lease.get("dispatch_head") == BASE67
            and set(lease.get("path_scope", [])) == EXACT2
            and len(lease.get("path_scope", [])) == 2
            and datetime.fromisoformat(lease["issued_at"]) == ISSUED67
            and datetime.fromisoformat(lease["expires_at"]) == EXPIRES67
            and (worker or (
                lease.get("worker_lease_id") == WORKER_ID67
                and lease.get("write_epoch") == 67
                and lease.get("write_fencing_token") == WRITE_TOKEN67
                and lease.get("product_write_scope") == []
            ))
        )
    except (KeyError, ValueError, TypeError):
        return False


def validate_closed_fixture_events(root: Path, rows: list[dict], worker: dict, write: dict) -> list[str]:
    if len(rows) != 3:
        return ["SUCCESSOR_REVOCATION_EVENT_INVALID"]
    handoff = rows[0].get("details", {})
    reason = "CLOSED_FIXTURE_SUCCESSOR_VALIDATED_LOCAL_ONLY"
    errors = []
    if (rows[0].get("event_type") != "HANDOFF_RECORDED"
            or handoff.get("work_instruction_sha256") != WI67_HASH
            or handoff.get("worker_lease_id") != worker.get("lease_id")
            or handoff.get("write_lease_id") != write.get("lease_id")
            or handoff.get("accepted") is not False
            or handoff.get("product_write_scope") != []
            or handoff.get("handoff_ref") != HANDOFF
            or handoff.get("handoff_sha256") != _sha((Path(root) / HANDOFF).read_bytes())):
        errors.append("SUCCESSOR_HANDOFF_EVENT_INVALID")
    if (rows[1].get("event_type") != "WRITE_LEASE_REVOKED"
            or rows[1].get("details", {}).get("lease_id") != write.get("lease_id")
            or rows[1].get("details", {}).get("write_fencing_token") != WRITE_TOKEN67
            or rows[1].get("details", {}).get("reason") != reason
            or rows[2].get("event_type") != "WORKER_LEASE_REVOKED"
            or rows[2].get("details", {}).get("lease_id") != worker.get("lease_id")
            or rows[2].get("details", {}).get("execution_fencing_token") != WORKER_TOKEN67
            or rows[2].get("details", {}).get("reason") != reason):
        errors.append("SUCCESSOR_REVOCATION_EVENT_INVALID")
    return errors


def validate_close_test_events(root: Path, rows: list[dict], worker: dict, write: dict) -> list[str]:
    if len(rows) != 3:
        return ["SUCCESSOR_REVOCATION_EVENT_INVALID"]
    handoff = rows[0].get("details", {})
    reason = "CONTRACT_CLOSE_TEST_SUCCESSOR_VALIDATED_LOCAL_ONLY"
    errors = []
    if (rows[0].get("event_type") != "HANDOFF_RECORDED"
            or handoff.get("work_instruction_sha256") != WI66_HASH
            or handoff.get("worker_lease_id") != worker.get("lease_id")
            or handoff.get("write_lease_id") != write.get("lease_id")
            or handoff.get("accepted") is not False
            or handoff.get("product_write_scope") != []
            or handoff.get("handoff_ref") != HANDOFF
            or handoff.get("handoff_sha256") != _sha((Path(root) / HANDOFF).read_bytes())):
        errors.append("SUCCESSOR_HANDOFF_EVENT_INVALID")
    if (rows[1].get("event_type") != "WRITE_LEASE_REVOKED"
            or rows[1].get("details", {}).get("lease_id") != write.get("lease_id")
            or rows[1].get("details", {}).get("write_fencing_token") != WRITE_TOKEN66
            or rows[1].get("details", {}).get("reason") != reason
            or rows[2].get("event_type") != "WORKER_LEASE_REVOKED"
            or rows[2].get("details", {}).get("lease_id") != worker.get("lease_id")
            or rows[2].get("details", {}).get("execution_fencing_token") != WORKER_TOKEN66
            or rows[2].get("details", {}).get("reason") != reason):
        errors.append("SUCCESSOR_REVOCATION_EVENT_INVALID")
    return errors


def validate_close_events(root: Path, rows: list[dict], worker: dict, write: dict) -> list[str]:
    """Require a local-only handoff, then write and worker revocation."""
    if len(rows) != 3:
        return ["SUCCESSOR_REVOCATION_EVENT_INVALID"]
    handoff = rows[0].get("details", {})
    reason = "CONTRACT_DOCUMENT_SUCCESSOR_CONTROL_VALIDATED_LOCAL_ONLY"
    errors = []
    if (rows[0].get("event_type") != "HANDOFF_RECORDED"
            or handoff.get("work_instruction_sha256") != WI_HASH
            or handoff.get("worker_lease_id") != worker.get("lease_id")
            or handoff.get("write_lease_id") != write.get("lease_id")
            or handoff.get("accepted") is not False
            or handoff.get("product_write_scope") != []
            or handoff.get("handoff_ref") != HANDOFF
            or handoff.get("handoff_sha256") != _sha((Path(root) / HANDOFF).read_bytes())):
        errors.append("SUCCESSOR_HANDOFF_EVENT_INVALID")
    if (rows[1].get("event_type") != "WRITE_LEASE_REVOKED"
            or rows[1].get("details", {}).get("lease_id") != write.get("lease_id")
            or rows[1].get("details", {}).get("write_fencing_token") != WRITE_TOKEN
            or rows[1].get("details", {}).get("reason") != reason
            or rows[2].get("event_type") != "WORKER_LEASE_REVOKED"
            or rows[2].get("details", {}).get("lease_id") != worker.get("lease_id")
            or rows[2].get("details", {}).get("execution_fencing_token") != WORKER_TOKEN
            or rows[2].get("details", {}).get("reason") != reason):
        errors.append("SUCCESSOR_REVOCATION_EVENT_INVALID")
    return errors


def validate_control(root: Path, bundle: dict, now: datetime, *, event_raw: bytes | None = None) -> list[str]:
    """Validate live or later revoked successor without relaxing R48 history."""
    if bundle.get("progress", {}).get("event_sequence") in {2117, 2120}:
        return validate_control_epoch67(root, bundle, now, event_raw=event_raw)
    if bundle.get("progress", {}).get("event_sequence") in {2111, 2114}:
        return validate_control_epoch66(root, bundle, now, event_raw=event_raw)
    errors: list[str] = []
    try:
        root = Path(root)
        progress, stream = bundle["progress"], bundle["events"]
        raw = event_raw if event_raw is not None else (root / EVENTS).read_bytes()
        frozen = _frozen(root, EVENTS)
        frozen_stream = json.loads(frozen)
        if (raw_event_object_prefix_bytes(raw, 2102) != raw_event_object_prefix_bytes(frozen, 2102)
                or any(stream.get(key) != frozen_stream.get(key)
                       for key in ("schema_version", "stream_id", "first_sequence"))):
            errors.append("SUCCESSOR_R48_PREFIX_INVALID")
        if (stream != json.loads(raw) or stream.get("last_sequence") not in {2105, 2108}
                or len(stream.get("events", [])) != stream.get("last_sequence")
                or progress.get("event_sequence") != stream.get("last_sequence")
                or progress.get("last_event_id") != stream.get("last_event_id")):
            errors.append("SUCCESSOR_EVENT_PROJECTION_INVALID")
        rows = stream["events"]
        kinds = KINDS_START + (KINDS_CLOSE if len(rows) == 2108 else ())
        if [row.get("event_type") for row in rows[2102:]] != list(kinds):
            errors.append("SUCCESSOR_EVENT_ORDER_INVALID")
        for index in range(2102, len(rows)):
            row = rows[index]
            if (row.get("sequence") != index + 1 or row.get("subject_ref") != SUBJECT
                    or row.get("previous_event_sha256") != _sha(prior.r1._canonical(rows[index - 1]))):
                errors.append("SUCCESSOR_EVENT_CHAIN_INVALID")
            if (row.get("event_id") != f"evt_f20_{index + 1}_{kinds[index - 2102].lower()}"
                    or row.get("actor") != "main-agent-eoul"
                    or row.get("actor_id") != "main-agent-eoul"
                    or row.get("actor_type") != "AGENT"
                    or row.get("project_id") != "anvil"
                    or row.get("work_package_id") != "F-20"
                    or row.get("step_id") != ("F20_U01_CONTRACT_CONTROL_SUCCESSOR_START"
                                              if index < 2105 else "F20_U01_CONTRACT_CONTROL_SUCCESSOR_CLOSE")):
                errors.append("SUCCESSOR_EVENT_IDENTITY_INVALID")
            occurred = datetime.fromisoformat(row["occurred_at"])
            if (occurred.tzinfo is None or occurred > now or occurred >= EXPIRES
                    or (index < 2105 and occurred != ISSUED)
                    or (index >= 2105 and occurred < datetime.fromisoformat(rows[index - 1]["occurred_at"]))
                    or row.get("occurred_at_source") != "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME"):
                errors.append("SUCCESSOR_EVENT_TIME_INVALID")
        issued, worker_row, write_row = rows[2102:2105]
        wi_detail = issued.get("details", {})
        worker, write = worker_row.get("details", {}), write_row.get("details", {})
        if (wi_detail.get("path") != WI or wi_detail.get("sha256") != WI_HASH
                or wi_detail.get("classification") != "PMO_CONDITIONAL_CONTROL_BOOTSTRAP"
                or wi_detail.get("approval_ref") != "codex://threads/01a054f5-c2b4-7af0-b31a-c8148ef74642"
                or wi_detail.get("parent_work_instruction") != "docs/work_orders/F-20_U01_R48_CRITICAL_ACK_WORK_INSTRUCTION.md"
                or wi_detail.get("revision_reason") != "U01_CONTRACT_DOCUMENT_SUCCESSOR_G05_FROZEN_SCOPE_MISMATCH"
                or wi_detail.get("package_status") != "READY"
                or wi_detail.get("product_write_scope") != []
                or set(wi_detail.get("developer_exact_paths", [])) != EXACT3
                or len(wi_detail.get("developer_exact_paths", [])) != 3
                or wi_detail.get("baseline_git_commit") != DOCUMENT
                or wi_detail.get("accepted") is not False):
            errors.append("SUCCESSOR_WORK_INSTRUCTION_INVALID")
        if not _lease_valid(worker, worker=True) or not _lease_valid(write, worker=False):
            errors.append("SUCCESSOR_LEASE_INVALID")
        if WORKER_TOKEN == WRITE_TOKEN or now.tzinfo is None:
            errors.append("SUCCESSOR_FENCING_INVALID")
        closed = len(rows) == 2108
        if closed:
            close = rows[2105:2108]
            errors.extend(validate_close_events(root, close, worker, write))
            if (progress.get("worker_lease") is not None
                    or progress.get("write_lease") is not None
                    or not completed_lease_matches(
                        worker, progress.get("completed_f20_u01_contract_control_worker_lease"),
                        close[2]["occurred_at"])
                    or not completed_lease_matches(
                        write, progress.get("completed_f20_u01_contract_control_write_lease"),
                        close[1]["occurred_at"])):
                errors.append("SUCCESSOR_REVOCATION_INVALID")
        elif (now >= EXPIRES
              or now < datetime.fromisoformat(worker["issued_at"])
              or now < datetime.fromisoformat(write["issued_at"])
              or worker.get("status") != "ACTIVE"
              or write.get("status") != "ACTIVE"
              or progress.get("worker_lease") != worker
              or progress.get("write_lease") != write):
            errors.append("SUCCESSOR_ACTIVE_LEASE_INVALID")
        if (progress.get("repository", {}).get("projection_mode") != MODE
                or progress.get("repository", {}).get("product_write_scope") != []
                or progress.get("f20_overall_status") != "REWORK_IN_PROGRESS"
                or progress.get("c30_event_generation", {}).get("accepted") is not False
                or progress.get("scope_revision_binding", {}).get("release_decision") != "DEFER"
                or progress.get("scope_revision_binding", {}).get("production") != "NOT_EXECUTED"
                or "F-20" in progress.get("completed_packages", [])):
            errors.append("SUCCESSOR_SCOPE_INVALID")
        if (progress.get("active_work_instruction", {}).get("path") != WI
                or progress.get("active_work_instruction", {}).get("sha256") != WI_HASH
                or _sha((root / WI).read_bytes()) != WI_HASH):
            errors.append("SUCCESSOR_WI_HASH_INVALID")
        if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(raw):
            errors.append("SUCCESSOR_EVENT_HASH_INVALID")
        summary = bundle.get("handoff", {})
        if (summary.get("event_sequence") != len(rows)
                or summary.get("last_event_id") != stream.get("last_event_id")
                or summary.get("status") != "ACTIVE"
                or summary.get("current_work_package") != "F-20"
                or summary.get("worker_lease") != (None if closed else worker.get("lease_id"))
                or summary.get("write_lease") != (None if closed else write.get("lease_id"))
                or summary.get("repository_head") != DOCUMENT
                or summary.get("repository_upstream") != UPSTREAM):
            errors.append("SUCCESSOR_HANDOFF_INVALID")
        digest = bundle.get("detached_digest", {})
        if (bundle.get("_detached_digest_path") != DIGEST
                or digest.get("schema_version") != "1.0.0"
                or digest.get("algorithm") != "SHA-256"
                or digest.get("event_sequence") != len(rows)
                or digest.get("self_reference") is not False
                or digest.get("progress", {}).get("path") != PROGRESS
                or digest.get("progress", {}).get("file_sha256") != _sha((root / PROGRESS).read_bytes())
                or digest.get("progress", {}).get("bytes") != (root / PROGRESS).stat().st_size
                or digest.get("handoff", {}).get("path") != HANDOFF
                or digest.get("handoff", {}).get("file_sha256") != _sha((root / HANDOFF).read_bytes())
                or digest.get("handoff", {}).get("bytes") != (root / HANDOFF).stat().st_size):
            errors.append("SUCCESSOR_DETACHED_DIGEST_INVALID")
        for path in (R48_MANIFEST, R48_DIGEST, "scripts/f20_u01_r48_close_overlay.py"):
            if (root / path).read_bytes() != _frozen(root, path):
                errors.append("SUCCESSOR_R48_AUTHORITY_INVALID")
        checker = _frozen(root, CHECKER)
        if checker.count(ANCHOR) != 1 or (root / CHECKER).read_bytes() != checker.replace(ANCHOR, ROUTE, 1):
            errors.append("SUCCESSOR_CHECKER_INVALID")
        if {path for path in DOCS if (root / path).read_bytes() == _frozen(root, path, DOCUMENT)} != DOCS - {"docs/WORK_STATUS.md"}:
            errors.append("SUCCESSOR_DOCUMENT_HASH_INVALID")
    except (OSError, ValueError, KeyError, TypeError, IndexError, subprocess.CalledProcessError):
        errors.append("SUCCESSOR_CONTROL_MISSING")
    return sorted(set(errors))


def validate_control_epoch66(root: Path, bundle: dict, now: datetime, *, event_raw: bytes | None = None) -> list[str]:
    """Validate epoch66 while preserving the entire closed epoch65 stream."""
    errors: list[str] = []
    try:
        root = Path(root)
        progress, stream = bundle["progress"], bundle["events"]
        raw = event_raw if event_raw is not None else (root / EVENTS).read_bytes()
        frozen_r48 = _frozen(root, EVENTS)
        frozen_history = _frozen(root, EVENTS, BASE66)
        if (raw_event_object_prefix_bytes(raw, 2102) != raw_event_object_prefix_bytes(frozen_r48, 2102)
                or any(stream.get(key) != json.loads(frozen_r48).get(key)
                       for key in ("schema_version", "stream_id", "first_sequence"))):
            errors.append("SUCCESSOR_R48_PREFIX_INVALID")
        if raw_event_object_prefix_bytes(raw, 2108) != raw_event_object_prefix_bytes(frozen_history, 2108):
            errors.append("SUCCESSOR_HISTORICAL_PREFIX_INVALID")
        rows = stream["events"]
        closed = len(rows) == 2114
        if (stream != json.loads(raw) or stream.get("last_sequence") not in {2111, 2114}
                or len(rows) != stream.get("last_sequence")
                or progress.get("event_sequence") != len(rows)
                or progress.get("last_event_id") != stream.get("last_event_id")):
            errors.append("SUCCESSOR_EVENT_PROJECTION_INVALID")
        kinds = KINDS_START + (KINDS_CLOSE if closed else ())
        if [row.get("event_type") for row in rows[2108:]] != list(kinds):
            errors.append("SUCCESSOR_EVENT_ORDER_INVALID")
        for index in range(2108, len(rows)):
            row = rows[index]
            if (row.get("sequence") != index + 1 or row.get("subject_ref") != SUBJECT66
                    or row.get("previous_event_sha256") != _sha(prior.r1._canonical(rows[index - 1]))):
                errors.append("SUCCESSOR_EVENT_CHAIN_INVALID")
            if (row.get("event_id") != f"evt_f20_{index + 1}_{kinds[index - 2108].lower()}"
                    or row.get("actor") != "main-agent-eoul" or row.get("actor_id") != "main-agent-eoul"
                    or row.get("actor_type") != "AGENT" or row.get("project_id") != "anvil"
                    or row.get("work_package_id") != "F-20"
                    or row.get("step_id") != ("F20_U01_CONTRACT_CLOSE_TEST_SUCCESSOR_START"
                                              if index < 2111 else "F20_U01_CONTRACT_CLOSE_TEST_SUCCESSOR_CLOSE")):
                errors.append("SUCCESSOR_EVENT_IDENTITY_INVALID")
            occurred = datetime.fromisoformat(row["occurred_at"])
            if (occurred.tzinfo is None or occurred > now or occurred >= EXPIRES66
                    or (index < 2111 and occurred != ISSUED66)
                    or (index >= 2111 and occurred < datetime.fromisoformat(rows[index - 1]["occurred_at"]))
                    or row.get("occurred_at_source") != "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME"):
                errors.append("SUCCESSOR_EVENT_TIME_INVALID")
        wi_detail = rows[2108].get("details", {})
        worker, write = rows[2109].get("details", {}), rows[2110].get("details", {})
        if (wi_detail.get("path") != WI66 or wi_detail.get("sha256") != WI66_HASH
                or wi_detail.get("classification") != "PMO_CONDITIONAL_CLOSE_TEST_BOOTSTRAP"
                or wi_detail.get("approval_ref") != "codex://threads/01a054f5-c2b4-7af0-b31a-c8148ef74642"
                or wi_detail.get("parent_work_instruction") != WI
                or wi_detail.get("revision_reason") != "U01_CONTRACT_SUCCESSOR_CLOSED_STATE_TEST_FIX"
                or wi_detail.get("package_status") != "READY"
                or wi_detail.get("product_write_scope") != []
                or set(wi_detail.get("developer_exact_paths", [])) != EXACT3
                or len(wi_detail.get("developer_exact_paths", [])) != 3
                or wi_detail.get("baseline_git_commit") != BASE66
                or wi_detail.get("accepted") is not False):
            errors.append("SUCCESSOR_WORK_INSTRUCTION_INVALID")
        if not _lease_valid66(worker, worker=True) or not _lease_valid66(write, worker=False):
            errors.append("SUCCESSOR_LEASE_INVALID")
        if WORKER_TOKEN66 == WRITE_TOKEN66 or now.tzinfo is None:
            errors.append("SUCCESSOR_FENCING_INVALID")
        frozen_progress = json.loads(_frozen(root, PROGRESS, BASE66))
        for kind, row, revocation in (("worker", "worker_lease", 2107), ("write", "write_lease", 2106)):
            issued = json.loads(frozen_history)["events"][2103 if kind == "worker" else 2104]["details"]
            key = f"completed_f20_u01_contract_control_{kind}_lease"
            if not completed_lease_matches(issued, progress.get(key), rows[revocation]["occurred_at"]):
                errors.append("SUCCESSOR_HISTORICAL_LEASE_INVALID")
            if progress.get(key) != frozen_progress.get(key):
                errors.append("SUCCESSOR_HISTORICAL_LEASE_INVALID")
        if closed:
            close = rows[2111:2114]
            errors.extend(validate_close_test_events(root, close, worker, write))
            if (progress.get("worker_lease") is not None or progress.get("write_lease") is not None
                    or not completed_lease_matches(worker, progress.get("completed_f20_u01_contract_close_test_worker_lease"), close[2]["occurred_at"])
                    or not completed_lease_matches(write, progress.get("completed_f20_u01_contract_close_test_write_lease"), close[1]["occurred_at"])):
                errors.append("SUCCESSOR_REVOCATION_INVALID")
        elif (now >= EXPIRES66 or now < ISSUED66
              or progress.get("worker_lease") != worker or progress.get("write_lease") != write
              or worker.get("status") != "ACTIVE" or write.get("status") != "ACTIVE"):
            errors.append("SUCCESSOR_ACTIVE_LEASE_INVALID")
        if (progress.get("repository", {}).get("projection_mode") != MODE
                or progress.get("repository", {}).get("product_write_scope") != []
                or progress.get("f20_overall_status") != "REWORK_IN_PROGRESS"
                or progress.get("c30_event_generation", {}).get("accepted") is not False
                or progress.get("scope_revision_binding", {}).get("release_decision") != "DEFER"
                or progress.get("scope_revision_binding", {}).get("production") != "NOT_EXECUTED"
                or "F-20" in progress.get("completed_packages", [])):
            errors.append("SUCCESSOR_SCOPE_INVALID")
        if (progress.get("active_work_instruction", {}).get("path") != WI66
                or progress.get("active_work_instruction", {}).get("sha256") != WI66_HASH
                or _sha((root / WI66).read_bytes()) != WI66_HASH):
            errors.append("SUCCESSOR_WI_HASH_INVALID")
        if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(raw):
            errors.append("SUCCESSOR_EVENT_HASH_INVALID")
        summary = bundle.get("handoff", {})
        if (summary.get("event_sequence") != len(rows)
                or summary.get("last_event_id") != stream.get("last_event_id")
                or summary.get("status") != "ACTIVE"
                or summary.get("current_work_package") != "F-20"
                or summary.get("worker_lease") != (None if closed else worker.get("lease_id"))
                or summary.get("write_lease") != (None if closed else write.get("lease_id"))
                or summary.get("repository_head") != DOCUMENT
                or summary.get("repository_upstream") != UPSTREAM):
            errors.append("SUCCESSOR_HANDOFF_INVALID")
        digest = bundle.get("detached_digest", {})
        if (bundle.get("_detached_digest_path") != DIGEST
                or digest.get("schema_version") != "1.0.0" or digest.get("algorithm") != "SHA-256"
                or digest.get("event_sequence") != len(rows) or digest.get("self_reference") is not False
                or digest.get("progress", {}).get("path") != PROGRESS
                or digest.get("progress", {}).get("file_sha256") != _sha((root / PROGRESS).read_bytes())
                or digest.get("progress", {}).get("bytes") != (root / PROGRESS).stat().st_size
                or digest.get("handoff", {}).get("path") != HANDOFF
                or digest.get("handoff", {}).get("file_sha256") != _sha((root / HANDOFF).read_bytes())
                or digest.get("handoff", {}).get("bytes") != (root / HANDOFF).stat().st_size):
            errors.append("SUCCESSOR_DETACHED_DIGEST_INVALID")
        for path in (R48_MANIFEST, R48_DIGEST, "scripts/f20_u01_r48_close_overlay.py"):
            if (root / path).read_bytes() != _frozen(root, path):
                errors.append("SUCCESSOR_R48_AUTHORITY_INVALID")
        checker = _frozen(root, CHECKER)
        if checker.count(ANCHOR) != 1 or (root / CHECKER).read_bytes() != checker.replace(ANCHOR, ROUTE, 1):
            errors.append("SUCCESSOR_CHECKER_INVALID")
        if {path for path in DOCS if (root / path).read_bytes() == _frozen(root, path, DOCUMENT)} != DOCS - {"docs/WORK_STATUS.md"}:
            errors.append("SUCCESSOR_DOCUMENT_HASH_INVALID")
    except (OSError, ValueError, KeyError, TypeError, IndexError, subprocess.CalledProcessError):
        errors.append("SUCCESSOR_CONTROL_MISSING")
    return sorted(set(errors))


def validate_control_epoch67(root: Path, bundle: dict, now: datetime, *, event_raw: bytes | None = None) -> list[str]:
    """Validate the closed-fixture successor and immutable seq2114 history."""
    errors: list[str] = []
    try:
        root = Path(root)
        progress, stream = bundle["progress"], bundle["events"]
        raw = event_raw if event_raw is not None else (root / EVENTS).read_bytes()
        frozen_r48 = _frozen(root, EVENTS)
        frozen_history = _frozen(root, EVENTS, BASE67)
        historical = json.loads(frozen_history)
        if (raw_event_object_prefix_bytes(raw, 2102) != raw_event_object_prefix_bytes(frozen_r48, 2102)
                or any(stream.get(key) != json.loads(frozen_r48).get(key)
                       for key in ("schema_version", "stream_id", "first_sequence"))):
            errors.append("SUCCESSOR_R48_PREFIX_INVALID")
        if (_sha(frozen_history) != "11C11CFB8A2B27E15CDB298E7A9BC5D50C53A0CBD200E8C6003609D3B8BDBAF3"
                or raw_event_object_prefix_bytes(raw, 2114) != raw_event_object_prefix_bytes(frozen_history, 2114)):
            errors.append("SUCCESSOR_HISTORICAL_PREFIX_INVALID")
        rows = stream["events"]
        closed = len(rows) == 2120
        if (stream != json.loads(raw) or stream.get("last_sequence") not in {2117, 2120}
                or len(rows) != stream.get("last_sequence")
                or progress.get("event_sequence") != len(rows)
                or progress.get("last_event_id") != stream.get("last_event_id")
                or stream.get("last_event_id") != rows[-1].get("event_id")):
            errors.append("SUCCESSOR_EVENT_PROJECTION_INVALID")
        kinds = KINDS_START + (KINDS_CLOSE if closed else ())
        if [row.get("event_type") for row in rows[2114:]] != list(kinds):
            errors.append("SUCCESSOR_EVENT_ORDER_INVALID")
        for index in range(2114, len(rows)):
            row = rows[index]
            if (row.get("sequence") != index + 1 or row.get("subject_ref") != SUBJECT67
                    or row.get("previous_event_sha256") != _sha(prior.r1._canonical(rows[index - 1]))):
                errors.append("SUCCESSOR_EVENT_CHAIN_INVALID")
            if (row.get("event_id") != f"evt_f20_{index + 1}_{kinds[index - 2114].lower()}"
                    or row.get("actor") != "main-agent-eoul" or row.get("actor_id") != "main-agent-eoul"
                    or row.get("actor_type") != "AGENT" or row.get("project_id") != "anvil"
                    or row.get("work_package_id") != "F-20"
                    or row.get("step_id") != ("F20_U01_CLOSED_FIXTURE_SUCCESSOR_START"
                                              if index < 2117 else "F20_U01_CLOSED_FIXTURE_SUCCESSOR_CLOSE")):
                errors.append("SUCCESSOR_EVENT_IDENTITY_INVALID")
            occurred = datetime.fromisoformat(row["occurred_at"])
            if (occurred.tzinfo is None or occurred > now or occurred >= EXPIRES67
                    or (index < 2117 and occurred != ISSUED67)
                    or (index >= 2117 and occurred < datetime.fromisoformat(rows[index - 1]["occurred_at"]))
                    or row.get("occurred_at_source") != "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME"):
                errors.append("SUCCESSOR_EVENT_TIME_INVALID")
        wi_detail = rows[2114].get("details", {})
        worker, write = rows[2115].get("details", {}), rows[2116].get("details", {})
        if (wi_detail.get("path") != WI67 or wi_detail.get("sha256") != WI67_HASH
                or wi_detail.get("classification") != "PMO_CONDITIONAL_CLOSED_FIXTURE_BOOTSTRAP"
                or wi_detail.get("approval_ref") != "codex://threads/01a054f5-c2b4-7af0-b31a-c8148ef74642"
                or wi_detail.get("parent_work_instruction") != WI66
                or wi_detail.get("revision_reason") != "U01_POSTCLOSE_ACTIVE_PROGRESS_FIXTURE_REWORK"
                or wi_detail.get("package_status") != "READY"
                or wi_detail.get("product_write_scope") != []
                or set(wi_detail.get("developer_exact_paths", [])) != EXACT2
                or len(wi_detail.get("developer_exact_paths", [])) != 2
                or wi_detail.get("baseline_git_commit") != BASE67
                or wi_detail.get("accepted") is not False):
            errors.append("SUCCESSOR_WORK_INSTRUCTION_INVALID")
        if not _lease_valid67(worker, worker=True) or not _lease_valid67(write, worker=False):
            errors.append("SUCCESSOR_LEASE_INVALID")
        if WORKER_TOKEN67 == WRITE_TOKEN67 or now.tzinfo is None:
            errors.append("SUCCESSOR_FENCING_INVALID")
        frozen_progress = json.loads(_frozen(root, PROGRESS, BASE67))
        for kind, issued_index, revoked_index in (("worker", 2103, 2107), ("write", 2104, 2106)):
            key = f"completed_f20_u01_contract_control_{kind}_lease"
            if (progress.get(key) != frozen_progress.get(key)
                    or not completed_lease_matches(
                        historical["events"][issued_index]["details"], progress.get(key),
                        historical["events"][revoked_index]["occurred_at"])):
                errors.append("SUCCESSOR_HISTORICAL_LEASE_INVALID")
        for kind, issued_index, revoked_index in (("worker", 2109, 2113), ("write", 2110, 2112)):
            key = f"completed_f20_u01_contract_close_test_{kind}_lease"
            if (progress.get(key) != frozen_progress.get(key)
                    or not completed_lease_matches(
                        historical["events"][issued_index]["details"], progress.get(key),
                        historical["events"][revoked_index]["occurred_at"])):
                errors.append("SUCCESSOR_HISTORICAL_LEASE_INVALID")
        if closed:
            close = rows[2117:2120]
            errors.extend(validate_closed_fixture_events(root, close, worker, write))
            if (progress.get("worker_lease") is not None or progress.get("write_lease") is not None
                    or not completed_lease_matches(worker, progress.get("completed_f20_u01_closed_fixture_worker_lease"), close[2]["occurred_at"])
                    or not completed_lease_matches(write, progress.get("completed_f20_u01_closed_fixture_write_lease"), close[1]["occurred_at"])):
                errors.append("SUCCESSOR_REVOCATION_INVALID")
        elif (now >= EXPIRES67 or now < ISSUED67
              or progress.get("worker_lease") != worker or progress.get("write_lease") != write
              or worker.get("status") != "ACTIVE" or write.get("status") != "ACTIVE"):
            errors.append("SUCCESSOR_ACTIVE_LEASE_INVALID")
        if (progress.get("repository", {}).get("projection_mode") != MODE
                or progress.get("repository", {}).get("product_write_scope") != []
                or progress.get("f20_overall_status") != "REWORK_IN_PROGRESS"
                or progress.get("c30_event_generation", {}).get("accepted") is not False
                or progress.get("scope_revision_binding", {}).get("release_decision") != "DEFER"
                or progress.get("scope_revision_binding", {}).get("production") != "NOT_EXECUTED"
                or "F-20" in progress.get("completed_packages", [])):
            errors.append("SUCCESSOR_SCOPE_INVALID")
        if (progress.get("active_work_instruction", {}).get("path") != WI67
                or progress.get("active_work_instruction", {}).get("sha256") != WI67_HASH
                or _sha((root / WI67).read_bytes()) != WI67_HASH):
            errors.append("SUCCESSOR_WI_HASH_INVALID")
        if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(raw):
            errors.append("SUCCESSOR_EVENT_HASH_INVALID")
        summary = bundle.get("handoff", {})
        if (summary.get("event_sequence") != len(rows)
                or summary.get("last_event_id") != stream.get("last_event_id")
                or summary.get("status") != "ACTIVE"
                or summary.get("current_work_package") != "F-20"
                or summary.get("worker_lease") != (None if closed else worker.get("lease_id"))
                or summary.get("write_lease") != (None if closed else write.get("lease_id"))
                or summary.get("repository_head") != DOCUMENT
                or summary.get("repository_upstream") != UPSTREAM):
            errors.append("SUCCESSOR_HANDOFF_INVALID")
        digest = bundle.get("detached_digest", {})
        if (bundle.get("_detached_digest_path") != DIGEST
                or digest.get("schema_version") != "1.0.0" or digest.get("algorithm") != "SHA-256"
                or digest.get("event_sequence") != len(rows) or digest.get("self_reference") is not False
                or digest.get("progress", {}).get("path") != PROGRESS
                or digest.get("progress", {}).get("file_sha256") != _sha((root / PROGRESS).read_bytes())
                or digest.get("progress", {}).get("bytes") != (root / PROGRESS).stat().st_size
                or digest.get("handoff", {}).get("path") != HANDOFF
                or digest.get("handoff", {}).get("file_sha256") != _sha((root / HANDOFF).read_bytes())
                or digest.get("handoff", {}).get("bytes") != (root / HANDOFF).stat().st_size):
            errors.append("SUCCESSOR_DETACHED_DIGEST_INVALID")
        for path in (R48_MANIFEST, R48_DIGEST, "scripts/f20_u01_r48_close_overlay.py"):
            if (root / path).read_bytes() != _frozen(root, path):
                errors.append("SUCCESSOR_R48_AUTHORITY_INVALID")
        checker = _frozen(root, CHECKER)
        if checker.count(ANCHOR) != 1 or (root / CHECKER).read_bytes() != checker.replace(ANCHOR, ROUTE, 1):
            errors.append("SUCCESSOR_CHECKER_INVALID")
        if {path for path in DOCS if (root / path).read_bytes() == _frozen(root, path, DOCUMENT)} != DOCS - {"docs/WORK_STATUS.md"}:
            errors.append("SUCCESSOR_DOCUMENT_HASH_INVALID")
    except (OSError, ValueError, KeyError, TypeError, IndexError, subprocess.CalledProcessError):
        errors.append("SUCCESSOR_CONTROL_MISSING")
    return sorted(set(errors))


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", UPSTREAM).decode().strip()
        branch = _git(root, "branch", "--show-current").decode().strip()
        upstream = _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
        document_parent = _git(root, "rev-parse", f"{DOCUMENT}^").decode().strip()
        document_delta = set(_git(root, "diff", "--name-only", "--no-renames", f"{document_parent}..{DOCUMENT}").decode().splitlines())
        later_delta = set(_git(root, "diff", "--name-only", "--no-renames", f"{DOCUMENT}..HEAD").decode().splitlines())
        clean = not _dirty(root)
        epoch66 = progress.get("event_sequence") in {2111, 2114}
        epoch67 = progress.get("event_sequence") in {2117, 2120}
        closed = progress.get("event_sequence") in {2108, 2114, 2120}
        allowed = CONTROL67 if epoch67 else (CONTROL66 if epoch66 else CONTROL)
        writable = EXACT2 if epoch67 else EXACT3
        good = (
            document_parent == REMOTE_BASE and document_delta == DOCS
            and branch == BRANCH and upstream == UPSTREAM
            and remote in {REMOTE_BASE, head}
            and subprocess.run(["git", "merge-base", "--is-ancestor", DOCUMENT, head], cwd=root, capture_output=True).returncode == 0
            and (not epoch66 or subprocess.run(
                ["git", "merge-base", "--is-ancestor", BASE66, "HEAD"],
                cwd=root, capture_output=True).returncode == 0)
            and (not epoch67 or subprocess.run(
                ["git", "merge-base", "--is-ancestor", BASE67, "HEAD"],
                cwd=root, capture_output=True).returncode == 0)
            and subprocess.run(["git", "merge-base", "--is-ancestor", REMOTE_BASE, remote], cwd=root, capture_output=True).returncode == 0
            and later_delta <= allowed
            and (_dirty(root) <= writable if not closed else clean)
            and progress.get("repository", {}).get("projection_mode") == MODE
            and progress.get("repository", {}).get("branch") == BRANCH
            and progress.get("repository", {}).get("upstream") == UPSTREAM
            and progress.get("repository", {}).get("validated_base_commit") == DOCUMENT
            and progress.get("repository", {}).get("remote_head") in {REMOTE_BASE, head}
        )
        return [] if good else ["SUCCESSOR_GIT_INVALID"]
    except (OSError, ValueError, KeyError, UnicodeDecodeError, subprocess.CalledProcessError):
        return ["SUCCESSOR_GIT_INVALID"]
