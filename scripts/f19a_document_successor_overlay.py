"""Fail-closed document-only F-19A successor over the frozen seq2120 stream."""

from __future__ import annotations

from datetime import datetime
import hashlib
import json
from pathlib import Path
import subprocess

try:
    from scripts.check_project_progress import raw_event_object_prefix_bytes
    from scripts import f20_u01_r48_start_overlay as r48
except ModuleNotFoundError:
    from check_project_progress import raw_event_object_prefix_bytes
    import f20_u01_r48_start_overlay as r48


MODE = "F19A_DOCUMENT_SUCCESSOR"
BASE = "afa49d2c31194c20df653273344116125bc11fda"
BRANCH = "codex/f18-wsl-ops"
UPSTREAM = "development/codex/f18-wsl-ops"
SUBJECT = "F-20/U01-F19A-DOCUMENT"
ACTOR = "developer-primary-f19a-doc-control"
WI = "docs/work_orders/F-19A_DOCUMENT_SUCCESSOR_WORK_INSTRUCTION.md"
WI_HASH = "2281621C33C4AD9D3030F4A871F87A18D137BDEE3301487426ECC49FB3D0FD91"
EVENTS = "docs/progress/progress-events.json"
PROGRESS = "docs/progress/build-progress.json"
HANDOFF = "docs/progress/BUILD_HANDOFF.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f19a-document-successor.json"
CHECKER = "scripts/check_project_progress.py"
EXACT3 = {CHECKER, "scripts/f19a_document_successor_overlay.py", "tests/tooling/test_f19a_document_successor_projection.py"}
DOCS = (
    "Anvil_설계서_v2.md",
    "Anvil_작업계획서_v1.md",
    "Anvil_통합검증매트릭스_v1.md",
    "Anvil_테스트계획서_v1.md",
)
NEW_HASHES = (
    "2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7",
    "19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4",
    "9EE200DCE480497C4DE068963B546129F73679745C27846D593688455B2D38E8",
    "C9C208709E71DB7F8769757AD77B5B51E854B0AB3AECAE89C39298C0C2615C8A",
)
WORKER_ID = "worker-lease-f19a-document-30a431fcc95f4cb18bf0d60cd108bd2f"
WRITE_ID = "write-lease-f19a-document-0399512a5ee84403b6ae7c4f35d2dd98"
WORKER_TOKEN = "f19a-document-execution-fence-epoch-68-30a431fcc95f4cb18bf0d60cd108bd2f"
WRITE_TOKEN = "f19a-document-write-fence-epoch-68-0399512a5ee84403b6ae7c4f35d2dd98"
ISSUED = datetime.fromisoformat("2026-10-06T01:24:31+00:00")
EXPIRES = datetime.fromisoformat("2026-10-07T01:24:31+00:00")
KINDS = ("WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED")
CLOSE_KINDS = ("HANDOFF_RECORDED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED")
CONTROL = set(DOCS) | EXACT3 | {"docs/WORK_STATUS.md", WI, EVENTS, PROGRESS, HANDOFF, DIGEST}
APPROVAL = "codex://threads/01a054f5-c2b4-7af0-b31a-c8148ef74642"
REASON = "F19A_DOCUMENT_CONTROL_VALIDATED_LOCAL_ONLY"


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", "-c", "core.quotePath=false", *args], cwd=root, stderr=subprocess.DEVNULL)


def _frozen(root: Path, path: str) -> bytes:
    return _git(root, "show", f"{BASE}:{path}")


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()


def _dirty(root: Path) -> set[str]:
    paths = set()
    for row in _git(root, "status", "--porcelain=v1", "-uall").decode("utf-8").splitlines():
        path = row[3:]
        paths.update(path.split(" -> ", 1) if " -> " in path else (path,))
    return paths


def _load_digest(root: Path) -> dict:
    return json.loads((root / DIGEST).read_bytes())


def _lease_valid(lease: dict, *, worker: bool) -> bool:
    if not isinstance(lease, dict):
        return False
    try:
        return (
            lease.get("lease_id") == (WORKER_ID if worker else WRITE_ID)
            and lease.get("actor_id") == ACTOR
            and lease.get("subject_ref") == SUBJECT
            and lease.get("status") == "ACTIVE"
            and lease.get("lease_epoch") == 68
            and lease.get("fencing_token") == (WORKER_TOKEN if worker else WRITE_TOKEN)
            and lease.get("execution_fencing_token") == WORKER_TOKEN
            and lease.get("baseline_git_commit") == BASE
            and lease.get("dispatch_head") == BASE
            and set(lease.get("path_scope", [])) == EXACT3
            and len(lease.get("path_scope", [])) == 3
            and datetime.fromisoformat(lease["issued_at"]) == ISSUED
            and datetime.fromisoformat(lease["expires_at"]) == EXPIRES
            and (worker or (lease.get("worker_lease_id") == WORKER_ID
                            and lease.get("write_epoch") == 68
                            and lease.get("write_fencing_token") == WRITE_TOKEN
                            and lease.get("product_write_scope") == []))
        )
    except (KeyError, TypeError, ValueError):
        return False


def _completed(issued: dict, completed: dict, revoked_at: str) -> bool:
    return isinstance(completed, dict) and completed == {
        **issued, "status": "REVOKED", "revoked_at": revoked_at,
    }


def _close_valid(root: Path, rows: list[dict], worker: dict, write: dict) -> list[str]:
    if len(rows) != 3:
        return ["F19A_CLOSE_EVENT_INVALID"]
    handoff = rows[0].get("details", {})
    errors = []
    if (rows[0].get("event_type") != CLOSE_KINDS[0]
            or handoff.get("work_instruction_sha256") != WI_HASH
            or handoff.get("worker_lease_id") != worker.get("lease_id")
            or handoff.get("write_lease_id") != write.get("lease_id")
            or handoff.get("accepted") is not False
            or handoff.get("product_write_scope") != []
            or handoff.get("handoff_ref") != HANDOFF
            or handoff.get("handoff_sha256") != _sha((root / HANDOFF).read_bytes())):
        errors.append("F19A_HANDOFF_EVENT_INVALID")
    if (rows[1].get("event_type") != CLOSE_KINDS[1]
            or rows[1].get("details", {}).get("lease_id") != write.get("lease_id")
            or rows[1].get("details", {}).get("write_fencing_token") != WRITE_TOKEN
            or rows[1].get("details", {}).get("reason") != REASON
            or rows[2].get("event_type") != CLOSE_KINDS[2]
            or rows[2].get("details", {}).get("lease_id") != worker.get("lease_id")
            or rows[2].get("details", {}).get("execution_fencing_token") != WORKER_TOKEN
            or rows[2].get("details", {}).get("reason") != REASON):
        errors.append("F19A_REVOCATION_EVENT_INVALID")
    return errors


def validate_control(root: Path, bundle: dict, now: datetime, *, event_raw: bytes | None = None) -> list[str]:
    """Validate new document binding while preserving the predecessor snapshot."""
    errors: list[str] = []
    try:
        root = Path(root)
        progress, stream = bundle["progress"], bundle["events"]
        raw = event_raw if event_raw is not None else (root / EVENTS).read_bytes()
        frozen_raw = _frozen(root, EVENTS)
        frozen_progress = json.loads(_frozen(root, PROGRESS))
        if (raw_event_object_prefix_bytes(raw, 2120) != raw_event_object_prefix_bytes(frozen_raw, 2120)
                or any(stream.get(key) != json.loads(frozen_raw).get(key)
                       for key in ("schema_version", "stream_id", "first_sequence"))):
            errors.append("F19A_FROZEN_PREFIX_INVALID")
        for key in ("scope_revision_binding", "current_progress_evidence_ref", "active_work_instruction",
                    "completed_f20_u01_contract_control_worker_lease",
                    "completed_f20_u01_contract_control_write_lease",
                    "completed_f20_u01_contract_close_test_worker_lease",
                    "completed_f20_u01_contract_close_test_write_lease",
                    "completed_f20_u01_closed_fixture_worker_lease",
                    "completed_f20_u01_closed_fixture_write_lease"):
            if progress.get(key) != frozen_progress.get(key):
                errors.append("F19A_OLD_BINDING_INVALID")
        if progress.get("c30_event_generation", {}).get("accepted") is not False:
            errors.append("F19A_OLD_BINDING_INVALID")
        rows = stream["events"]
        closed = len(rows) == 2126
        kinds = KINDS + (CLOSE_KINDS if closed else ())
        if (stream != json.loads(raw) or stream.get("last_sequence") not in {2123, 2126}
                or len(rows) != stream.get("last_sequence")
                or progress.get("event_sequence") != len(rows)
                or progress.get("last_event_id") != stream.get("last_event_id")
                or stream.get("last_event_id") != rows[-1].get("event_id")):
            errors.append("F19A_EVENT_PROJECTION_INVALID")
        if [row.get("event_type") for row in rows[2120:]] != list(kinds):
            errors.append("F19A_EVENT_ORDER_INVALID")
        for index in range(2120, len(rows)):
            row = rows[index]
            if (row.get("sequence") != index + 1 or row.get("subject_ref") != SUBJECT
                    or row.get("previous_event_sha256") != _sha(r48.r1._canonical(rows[index - 1]))):
                errors.append("F19A_EVENT_CHAIN_INVALID")
            if (row.get("event_id") != f"evt_f20_{index + 1}_{kinds[index - 2120].lower()}"
                    or row.get("actor") != "main-agent-eoul" or row.get("actor_id") != "main-agent-eoul"
                    or row.get("actor_type") != "AGENT" or row.get("project_id") != "anvil"
                    or row.get("work_package_id") != "F-20"
                    or row.get("step_id") != ("F20_U01_F19A_DOCUMENT_SUCCESSOR_START"
                                              if index < 2123 else "F20_U01_F19A_DOCUMENT_SUCCESSOR_CLOSE")):
                errors.append("F19A_EVENT_IDENTITY_INVALID")
            occurred = datetime.fromisoformat(row["occurred_at"])
            if (occurred.tzinfo is None or occurred > now or occurred >= EXPIRES
                    or (index < 2123 and occurred != ISSUED)
                    or (index >= 2123 and occurred < datetime.fromisoformat(rows[index - 1]["occurred_at"]))
                    or row.get("occurred_at_source") != "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME"):
                errors.append("F19A_EVENT_TIME_INVALID")
        instruction = rows[2120].get("details", {})
        worker, write = rows[2121].get("details", {}), rows[2122].get("details", {})
        if (instruction.get("path") != WI or instruction.get("sha256") != WI_HASH
                or instruction.get("classification") != "PMO_CONDITIONAL_F19A_DOCUMENT_CONTROL_BOOTSTRAP"
                or instruction.get("approval_ref") != APPROVAL
                or instruction.get("parent_work_instruction") != "docs/work_orders/F-20_U01_CLOSED_FIXTURE_SUCCESSOR_WORK_INSTRUCTION.md"
                or instruction.get("revision_reason") != "F19A_CANONICAL_DOCUMENT_HASH_SUCCESSOR"
                or instruction.get("product_write_scope") != []
                or set(instruction.get("developer_exact_paths", [])) != EXACT3
                or len(instruction.get("developer_exact_paths", [])) != 3
                or instruction.get("baseline_git_commit") != BASE
                or instruction.get("package_status") != "READY"
                or instruction.get("accepted") is not False):
            errors.append("F19A_WORK_INSTRUCTION_INVALID")
        if not _lease_valid(worker, worker=True) or not _lease_valid(write, worker=False):
            errors.append("F19A_LEASE_INVALID")
        if WORKER_TOKEN == WRITE_TOKEN or now.tzinfo is None:
            errors.append("F19A_FENCING_INVALID")
        if closed:
            close = rows[2123:2126]
            errors.extend(_close_valid(root, close, worker, write))
            if (progress.get("worker_lease") is not None or progress.get("write_lease") is not None
                    or not _completed(worker, progress.get("completed_f19a_document_worker_lease"), close[2]["occurred_at"])
                    or not _completed(write, progress.get("completed_f19a_document_write_lease"), close[1]["occurred_at"])):
                errors.append("F19A_REVOCATION_INVALID")
        elif (now >= EXPIRES or now < ISSUED
              or progress.get("worker_lease") != worker or progress.get("write_lease") != write):
            errors.append("F19A_ACTIVE_LEASE_INVALID")
        binding = progress.get("f19a_document_successor_binding", {})
        old_hashes = frozen_progress.get("scope_revision_binding", {}).get("artifact_sha256", {})
        expected_new = dict(zip(DOCS, NEW_HASHES))
        if (binding.get("status") != ("DOCUMENT_CONTROL_CLOSED_NOT_PRODUCT_ACCEPTED" if closed else "CONTROL_BOOTSTRAP_ACTIVE_NOT_ACCEPTED")
                or binding.get("predecessor_sequence") != 2120
                or binding.get("predecessor_head") != BASE
                or binding.get("work_instruction_id") != "WI-F19A-DOC-SUCCESSOR-20261006-001"
                or binding.get("work_instruction_path") != WI
                or binding.get("work_instruction_sha256") != WI_HASH
                or binding.get("approval_ref") != APPROVAL
                or binding.get("old_artifact_sha256") != old_hashes
                or binding.get("new_artifact_sha256") != expected_new
                or binding.get("package_count") != 124
                or binding.get("historical_av_count") != 255
                or binding.get("new_av_count") != 4
                or binding.get("product_write_scope") != []
                or binding.get("f20_overall_status") != "REWORK_IN_PROGRESS"
                or binding.get("release_decision") != "DEFER"
                or binding.get("production") != "NOT_EXECUTED"
                or any(_sha((root / path).read_bytes()) != sha for path, sha in expected_new.items())):
            errors.append("F19A_DOCUMENT_BINDING_INVALID")
        if (_sha((root / WI).read_bytes()) != WI_HASH
                or progress.get("f20_overall_status") != "REWORK_IN_PROGRESS"
                or progress.get("scope_revision_binding", {}).get("release_decision") != "DEFER"
                or progress.get("repository", {}).get("projection_mode") != MODE
                or progress.get("repository", {}).get("product_write_scope") != []):
            errors.append("F19A_SCOPE_INVALID")
        if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(raw):
            errors.append("F19A_EVENT_HASH_INVALID")
        summary = bundle.get("handoff", {})
        if (summary.get("event_sequence") != len(rows)
                or summary.get("last_event_id") != stream.get("last_event_id")
                or summary.get("status") != "ACTIVE"
                or summary.get("current_work_package") != "F-20"
                or summary.get("worker_lease") != (None if closed else WORKER_ID)
                or summary.get("write_lease") != (None if closed else WRITE_ID)
                or summary.get("repository_head") != BASE
                or summary.get("repository_upstream") != UPSTREAM):
            errors.append("F19A_HANDOFF_INVALID")
        digest = _load_digest(root)
        if (digest.get("schema_version") != "1.0.0" or digest.get("algorithm") != "SHA-256"
                or digest.get("event_sequence") != len(rows) or digest.get("self_reference") is not False
                or digest.get("progress", {}).get("path") != PROGRESS
                or digest.get("progress", {}).get("file_sha256") != _sha((root / PROGRESS).read_bytes())
                or digest.get("progress", {}).get("bytes") != (root / PROGRESS).stat().st_size
                or digest.get("handoff", {}).get("path") != HANDOFF
                or digest.get("handoff", {}).get("file_sha256") != _sha((root / HANDOFF).read_bytes())
                or digest.get("handoff", {}).get("bytes") != (root / HANDOFF).stat().st_size):
            errors.append("F19A_DIGEST_INVALID")
        for path in ("scripts/f20_u01_contract_successor_overlay.py", "scripts/f20_u01_r48_close_overlay.py"):
            if (root / path).read_bytes() != _frozen(root, path):
                errors.append("F19A_PREDECESSOR_CODE_INVALID")
    except (OSError, ValueError, TypeError, KeyError, IndexError, subprocess.CalledProcessError):
        errors.append("F19A_CONTROL_MISSING")
    return sorted(set(errors))


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", UPSTREAM).decode().strip()
        branch = _git(root, "branch", "--show-current").decode().strip()
        upstream = _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
        delta = set(_git(root, "diff", "--name-only", "--no-renames", f"{BASE}..HEAD").decode().splitlines())
        dirty = _dirty(root)
        closed = progress.get("event_sequence") == 2126
        good = (
            branch == BRANCH and upstream == UPSTREAM and remote in {BASE, head}
            and subprocess.run(["git", "merge-base", "--is-ancestor", BASE, "HEAD"], cwd=root, capture_output=True).returncode == 0
            and subprocess.run(["git", "merge-base", "--is-ancestor", BASE, remote], cwd=root, capture_output=True).returncode == 0
            and delta <= CONTROL and (not dirty if closed else dirty <= CONTROL)
            and progress.get("repository", {}).get("branch") == BRANCH
            and progress.get("repository", {}).get("upstream") == UPSTREAM
            and progress.get("repository", {}).get("validated_base_commit") == BASE
            and progress.get("repository", {}).get("remote_head") in {BASE, head}
            and progress.get("repository", {}).get("projection_mode") == MODE
        )
        return [] if good else ["F19A_GIT_INVALID"]
    except (OSError, ValueError, TypeError, UnicodeDecodeError, subprocess.CalledProcessError):
        return ["F19A_GIT_INVALID"]
