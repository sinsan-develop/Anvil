"""Read-only, fail-closed preflight for the quarantined C30 Event ledger.

This returns evidence for Main's generation decision. It never appends Events,
changes projections, or treats the tainted historical acceptance as authority.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from hashlib import sha256
import json
from pathlib import Path, PurePosixPath
import subprocess
from typing import Callable


EVENTS_PATH = "docs/progress/progress-events.json"
PROGRESS_PATH = "docs/progress/build-progress.json"
ANCHOR_COMMIT = "97adc5cf7070c71b61a5d6902d31cf195329b38f"
ANCHOR_BLOB = "b59ac57228f9b5684b939dc30fc7d7bce5dbbb54"
ANCHOR_SHA256 = "2755283A52C6AA384129E516A3EA52D23647DD5E7BF1D68EC63C248A0B0EE36F"
INCIDENT_COMMIT = "14c8c5743890c4a8a58686b9430144a55b1317e7"
CUTOVER_COMMIT = "9485465ddb046a48e61ee14c7cdd0e62df0a6e70"
CUTOVER_BLOB = "0f86d09446b40905e9d33e9e6cbe4c1380a63218"
CUTOVER_SHA256 = "5167A3AC73E8C914144340F0B1506CE144470657AE75CAAFEF0DAFBB4E5D1DBF"
FALSE_ACCEPTANCE = [1689, 1691, 1694, 1696, 1698, 1700, 1702, 1704, 1706, 1708, 1710]
APPROVAL_ID = "APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001"
APPROVAL_PATH = f"docs/approvals/{APPROVAL_ID}.md"
APPROVAL_SHA256 = "8DB4FFE8D7C195F3F272BD07F668B8A91BDEDD272194351E0F8867A5E7148893"
APPROVAL_SUBJECT_SHA256 = "5224C01841AF429E5AEAD0B10978889570548F3DFC438E7379B90A3F96E804CF"
REVISION_BINDING_PATH = "docs/progress/non-semantic-revision-binding-f20-u01-r38b.json"
RECOVERY_APPROVAL_PATH = "docs/approvals/APPROVAL-20261004-C30-NONDESTRUCTIVE-LEDGER-RECOVERY-001.md"
RECOVERY_APPROVAL_SHA256 = "44420B3E302ED50586BA41727E024144940F3A73F66D206550FF1CC61A1573B4"
RECOVERY_WI_PATH = "docs/work_orders/F-20_C30_EVENT_RECOVERY_V2_WORK_INSTRUCTION.md"
RECOVERY_WI_SHA256 = "80B4F6167097D73E61F9953AFAFD1FD488441A8895DC59B69E74B35295DC7FDA"
RECOVERY_SCOPE = ["scripts/f20_c30_recovery_v2.py",
                  "tests/tooling/test_f20_c30_recovery_v2.py",
                  "docs/04_test_reports/F-20_C30_EVENT_RECOVERY_V2_DEVELOPER_RESULT.md"]


@dataclass
class RecoveryResult:
    eligible: bool = False
    errors: list[str] = field(default_factory=list)
    evidence: dict = field(default_factory=dict)


def _digest(raw: bytes) -> str:
    return sha256(raw).hexdigest().upper()


def _json(raw: bytes, *, strict: bool = False):
    def no_duplicates(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError(f"duplicate JSON key: {key}")
            value[key] = item
        return value
    # The pinned historical blobs contain duplicate keys in early legacy Events.
    # Their exact Git SHA and raw bytes define that history. New control Events
    # are parsed strictly below so a later duplicate cannot change authority.
    kwargs = {"object_pairs_hook": no_duplicates} if strict else {}
    return json.loads(raw, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)),
                      **kwargs)


def _canonical(value: dict) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def _raw_event_objects(raw: bytes) -> list[bytes]:
    """Extract JSON object spans without reserializing or changing Unicode bytes."""
    marker = b'"events": ['
    if raw.count(marker) != 1:
        raise ValueError("events array marker missing or duplicated")
    index = raw.index(marker) + len(marker)
    objects: list[bytes] = []
    while True:
        while raw[index:index + 1] in (b" ", b"\n", b"\r", b"\t", b","):
            index += 1
        if raw[index:index + 1] == b"]":
            return objects
        if raw[index:index + 1] != b"{":
            raise ValueError("event object expected")
        start = index
        depth, quoted, escaped = 0, False, False
        while index < len(raw):
            byte = raw[index]
            if quoted:
                if escaped:
                    escaped = False
                elif byte == 92:
                    escaped = True
                elif byte == 34:
                    quoted = False
            elif byte == 34:
                quoted = True
            elif byte == 123:
                depth += 1
            elif byte == 125:
                depth -= 1
                if depth == 0:
                    index += 1
                    objects.append(raw[start:index])
                    break
            index += 1
        else:
            raise ValueError("unterminated event object")


def _safe_file(reader: Callable[[str], bytes], path: str, prefix: str) -> bytes:
    if (not isinstance(path, str) or "\\" in path or path.startswith("/")
            or not path.startswith(prefix + "/")
            or any(part in ("", ".", "..") for part in PurePosixPath(path).parts)):
        raise ValueError(f"unsafe artifact path: {path}")
    return reader(path)


def _file_hash_matches(reader: Callable[[str], bytes], path: str,
                       expected: str, prefix: str) -> bool:
    return (isinstance(expected, str) and len(expected) == 64
            and _digest(_safe_file(reader, path, prefix)) == expected.upper())


def _error(result: RecoveryResult, code: str) -> None:
    if code not in result.errors:
        result.errors.append(code)


def _check_sources(result: RecoveryResult, anchor_raw: bytes, incident_raw: bytes,
                   cutover_raw: bytes, current_raw: bytes) -> tuple[list[dict], list[dict]] | None:
    specs = (("ANCHOR", anchor_raw, ANCHOR_SHA256, 4349558, 1712),
             ("CUTOVER", cutover_raw, CUTOVER_SHA256, 4787039, 2040))
    try:
        for name, raw, expected_sha, expected_size, count in specs:
            if len(raw) != expected_size or _digest(raw) != expected_sha:
                _error(result, f"{name}_GIT_OBJECT_INVALID")
            stream = _json(raw)
            if len(stream["events"]) != count or stream["last_sequence"] != count:
                _error(result, f"{name}_EVENT_COUNT_INVALID")
        anchor = _json(anchor_raw)["events"]
        incident = _json(incident_raw)["events"]
        cutover = _json(cutover_raw)["events"]
        current_stream = _json(current_raw)
        current = current_stream["events"]
        if len(incident) != 1714 or len(cutover) != 2040 or len(current) < 2040:
            _error(result, "INCIDENT_OR_CURRENT_EVENT_COUNT_INVALID")
            return None
        if (current_stream["last_sequence"] != len(current)
                or current_stream["last_event_id"] != current[-1]["event_id"]):
            _error(result, "CURRENT_EVENT_ENVELOPE_INVALID")
        cutover_objects = _raw_event_objects(cutover_raw)
        current_objects = _raw_event_objects(current_raw)
        if (len(cutover_objects) != 2040 or len(current_objects) != len(current)
                or cutover_objects != current_objects[:2040]):
            _error(result, "CUTOVER_RAW_PREFIX_MISMATCH")
        for raw_object in current_objects[1714:]:
            _json(raw_object, strict=True)
        changed = [seq for seq in range(1, 1713) if anchor[seq - 1] != incident[seq - 1]]
        added = [row["sequence"] for row in incident[1712:]]
        post_cause_changed = [seq for seq in range(1, 1715)
                              if incident[seq - 1] != cutover[seq - 1]]
        false_accepts = [seq for seq in changed if incident[seq - 1].get("details", {}).get("accepted") is True
                         and anchor[seq - 1].get("details", {}).get("accepted") is not True]
        result.evidence.update(anchor_events=len(anchor), cutover_events=len(cutover),
                               changed_sequences=changed, added_sequences=added,
                               post_cause_changed_sequences=post_cause_changed,
                               false_acceptance_sequences=false_accepts,
                               anchor_blob=ANCHOR_BLOB, cutover_blob=CUTOVER_BLOB,
                               cutover_sha256=_digest(cutover_raw))
        if changed != list(range(1689, 1713)) or added != [1713, 1714]:
            _error(result, "INCIDENT_SEMANTIC_DELTA_INVALID")
        if false_accepts != FALSE_ACCEPTANCE:
            _error(result, "FALSE_ACCEPTANCE_SET_INVALID")
        if post_cause_changed != [1714]:
            _error(result, "POST_CAUSE_MUTATION_SET_INVALID")
        if (incident[1712]["event_type"] != "PACKAGE_COMPLETED"
                or incident[1712]["details"].get("accepted") is not True
                or incident[1713]["event_type"] != "MAIN_PACKAGE_ACCEPTED"
                or current[1712] != incident[1712]
                or current[1713]["event_type"] != "MAIN_PACKAGE_ACCEPTED"):
            _error(result, "TAINTED_ACCEPTANCE_HISTORY_INVALID")
        return cutover, current
    except (ValueError, KeyError, TypeError, IndexError, UnicodeDecodeError):
        _error(result, "EVENT_SOURCE_PARSE_INVALID")
        return None


def _check_chain(result: RecoveryResult, events: list[dict]) -> None:
    ids: set[str] = set()
    for index, row in enumerate(events):
        if (not isinstance(row, dict) or row.get("sequence") != index + 1
                or not isinstance(row.get("event_id"), str) or row["event_id"] in ids):
            _error(result, "EVENT_SEQUENCE_OR_ID_INVALID")
            return
        ids.add(row["event_id"])
        if index >= 1714 and row.get("previous_event_sha256") != _digest(_canonical(events[index - 1])):
            _error(result, f"EVENT_CHAIN_INVALID:{index + 1}")
            return
    result.evidence["validated_followup_events"] = 2040 - 1714


def _instruction(result: RecoveryResult, reader: Callable[[str], bytes],
                 path: str, digest: str) -> None:
    try:
        if not _file_hash_matches(reader, path, digest, "docs/work_orders"):
            _error(result, f"WORK_INSTRUCTION_HASH_MISMATCH:{path}")
    except (OSError, ValueError, TypeError):
        _error(result, f"WORK_INSTRUCTION_HASH_MISMATCH:{path}")


def _check_followups(result: RecoveryResult, events: list[dict],
                     reader: Callable[[str], bytes]) -> None:
    suffix = events[1714:2040]
    groups: list[list[dict]] = []
    noise: list[dict] = []
    index = 0
    group_types = ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
                   "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"]
    while index < len(suffix):
        row = suffix[index]
        if row["event_type"] in ("EVIDENCE_MANIFEST_INVALIDATED", "DEFECT_RECORDED"):
            noise.append(row)
            index += 1
            continue
        if row["event_type"] not in ("WORK_INSTRUCTION_ISSUED", "WORK_INSTRUCTION_REVISED"):
            _error(result, f"FOLLOWUP_EVENT_ORDER_INVALID:{row['sequence']}")
            return
        group = suffix[index:index + 6]
        if len(group) != 6 or [item["event_type"] for item in group[1:]] != group_types:
            _error(result, f"FOLLOWUP_EVENT_ORDER_INVALID:{row['sequence']}")
            return
        groups.append(group)
        index += 6
    if (len(groups) != 54 or len(noise) != 2
            or [row["event_type"] for row in noise] != ["EVIDENCE_MANIFEST_INVALIDATED", "DEFECT_RECORDED"]
            or noise[1]["sequence"] != 1764 or noise[1]["details"].get("status") != "OPEN_BLOCKING"):
        _error(result, "FOLLOWUP_EVENT_PROFILE_INVALID")
    if (len(noise) == 2 and
            (noise[0]["details"].get("invalidated_event_id") != "evt_f20_1714_main_package_accepted"
             or noise[1]["details"].get("cause_commit") != INCIDENT_COMMIT
             or noise[1]["details"].get("cause_parent_commit") != ANCHOR_COMMIT
             or noise[1]["details"].get("semantic_changed_sequences") != list(range(1689, 1713))
             or noise[1]["details"].get("blocking") is not True)):
        _error(result, "FOLLOWUP_INCIDENT_BINDING_INVALID")
    lease_ids: set[str] = set()
    tokens: set[str] = set()
    for ordinal, group in enumerate(groups, 1):
        wi, worker_row, write_row, resume_row, wr_row, wk_row = group
        detail = wi["details"]
        if wi["event_type"] == "WORK_INSTRUCTION_REVISED":
            parent = detail.get("parent_work_instruction", {})
            derived = detail.get("derived_work_instruction", {})
            invocation = detail.get("invocation", {})
            for item in (parent, derived, invocation):
                _instruction(result, reader, item.get("path"), item.get("sha256"))
            wi_path, wi_sha, inv_sha = derived.get("path"), derived.get("sha256"), invocation.get("sha256")
            _check_revision_binding(result, reader, detail)
        else:
            wi_path, wi_sha, inv_sha = detail.get("path"), detail.get("sha256"), detail.get("invocation_sha256")
            _instruction(result, reader, wi_path, wi_sha)
            _instruction(result, reader, detail.get("invocation_path"), inv_sha)
        worker, write, resume = worker_row["details"], write_row["details"], resume_row["details"]
        wr, wk = wr_row["details"], wk_row["details"]
        execution, write_token = worker.get("execution_fencing_token"), write.get("write_fencing_token")
        try:
            lease_time_valid = datetime.fromisoformat(worker["issued_at"]) < datetime.fromisoformat(worker["expires_at"])
        except (ValueError, KeyError, TypeError):
            lease_time_valid = False
        if (not isinstance(wi_sha, str) or resume.get("work_instruction_sha256") != wi_sha
                or not isinstance(inv_sha, str) or resume.get("invocation_sha256") != inv_sha
                or resume.get("accepted") is not False
                or resume.get("package_status") != "REWORK_IN_PROGRESS"):
            _error(result, f"WORK_INSTRUCTION_RESUME_INVALID:{ordinal}")
        if (worker.get("status") != "ACTIVE" or write.get("status") != "ACTIVE"
                or not lease_time_valid
                or worker.get("lease_epoch") != ordinal or write.get("lease_epoch") != ordinal
                or write.get("write_epoch") != ordinal
                or worker.get("actor_id") != write.get("actor_id")
                or worker.get("subject_ref") != write.get("subject_ref")
                or worker.get("path_scope") != write.get("path_scope")
                or worker.get("baseline_git_commit") != write.get("baseline_git_commit")
                or worker.get("dispatch_head") != write.get("dispatch_head")
                or worker.get("issued_at") != write.get("issued_at")
                or worker.get("expires_at") != write.get("expires_at")
                or not isinstance(execution, str) or not isinstance(write_token, str)
                or worker.get("fencing_token") != execution
                or write.get("execution_fencing_token") != execution
                or write.get("fencing_token") != write_token
                or execution == write_token or execution in tokens or write_token in tokens
                or worker.get("lease_id") in lease_ids or write.get("lease_id") in lease_ids
                or write.get("worker_lease_id") != worker.get("lease_id")
                or resume.get("worker_lease_id") != worker.get("lease_id")
                or resume.get("write_lease_id") != write.get("lease_id")
                or wr.get("lease_id") != write.get("lease_id")
                or wr.get("write_fencing_token") != write_token
                or wk.get("lease_id") != worker.get("lease_id")
                or wk.get("execution_fencing_token") != execution):
            _error(result, f"LEASE_PAIRING_INVALID:{ordinal}")
        lease_ids.update((worker.get("lease_id"), write.get("lease_id")))
        tokens.update((execution, write_token))
    result.evidence.update(validated_work_instructions=len(groups),
                           validated_lease_pairs=len(groups), revoked_lease_pairs=len(groups))


def _check_revision_binding(result: RecoveryResult, reader: Callable[[str], bytes], detail: dict) -> None:
    try:
        binding = detail["revision_binding"]
        saved = _json(reader(REVISION_BINDING_PATH))["bindings"]
        root = _json(reader(PROGRESS_PATH))["root_human_approval_binding"]
        approval = reader(APPROVAL_PATH)
        if (len(saved) != 1 or saved[0] != binding
                or detail["parent_approval_id"] != APPROVAL_ID
                or binding["root_human_approval_id"] != APPROVAL_ID
                or root["approval_id"] != APPROVAL_ID or root["path"] != APPROVAL_PATH
                or root["sha256"] != APPROVAL_SHA256
                or _digest(approval) != APPROVAL_SHA256
                or root["approval_subject_hash"] != APPROVAL_SUBJECT_SHA256
                or binding["root_approval_subject_hash"] != APPROVAL_SUBJECT_SHA256
                or APPROVAL_ID.encode() not in approval
                or b"APPROVED_BY_DIRECT_INSTRUCTION" not in approval
                or binding["old_hash"] != detail["parent_work_instruction"]["sha256"]
                or binding["new_hash"] != detail["derived_work_instruction"]["sha256"]
                or binding["artifact_path"] != detail["derived_work_instruction"]["path"]
                or binding["semantic_diff_classification"] != "NON_SEMANTIC"
                or detail.get("scope_expansion") is not False):
            _error(result, "APPROVAL_BINDING_INVALID")
    except (OSError, ValueError, KeyError, TypeError, IndexError):
        _error(result, "APPROVAL_BINDING_INVALID")


def _check_current_control(result: RecoveryResult, events: list[dict],
                           reader: Callable[[str], bytes]) -> None:
    try:
        progress = _json(reader(PROGRESS_PATH))
        if (progress["event_sequence"] != len(events)
                or progress["last_event_id"] != events[-1]["event_id"]
                or progress["f20_c30_event_integrity_incident"]["status"] != "OPEN_BLOCKING"
                or progress["scope_revision_binding"]["release_decision"] != "DEFER"
                or progress["f20_overall_status"] != "REWORK_IN_PROGRESS"
                or progress["active_work_instruction"]["sha256"] != RECOVERY_WI_SHA256
                or _digest(reader(RECOVERY_WI_PATH)) != RECOVERY_WI_SHA256):
            _error(result, "CURRENT_CONTROL_STATE_INVALID")
        approval = reader(RECOVERY_APPROVAL_PATH)
        binding = progress["c30_recovery_approval_binding"]
        if (binding["path"] != RECOVERY_APPROVAL_PATH
                or binding["sha256"] != RECOVERY_APPROVAL_SHA256
                or _digest(approval) != RECOVERY_APPROVAL_SHA256
                or binding["scope"] != "NONDESTRUCTIVE_LEDGER_RECOVERY_ONLY"):
            _error(result, "APPROVAL_BINDING_INVALID")
        if len(events) == 2044:
            issued, worker_row, write_row, resumed = events[2040:2044]
            worker, write = worker_row["details"], write_row["details"]
            if ([row["event_type"] for row in (issued, worker_row, write_row, resumed)]
                    != ["WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"]
                    or issued["details"].get("sha256") != RECOVERY_WI_SHA256
                    or issued["details"].get("approval_sha256") != RECOVERY_APPROVAL_SHA256
                    or progress["worker_lease"] != worker or progress["write_lease"] != write
                    or worker.get("lease_epoch") != 55 or write.get("lease_epoch") != 55
                    or worker.get("execution_fencing_token") != write.get("execution_fencing_token")
                    or write.get("worker_lease_id") != worker.get("lease_id")
                    or worker.get("path_scope") != RECOVERY_SCOPE
                    or write.get("path_scope") != RECOVERY_SCOPE
                    or write.get("write_fencing_token") != write.get("fencing_token")
                    or worker.get("execution_fencing_token") != worker.get("fencing_token")
                    or issued["details"].get("product_write_scope") != RECOVERY_SCOPE
                    or resumed["details"].get("accepted") is not False):
                _error(result, "CURRENT_CONTROL_STATE_INVALID")
        else:
            _error(result, "CURRENT_CONTROL_STATE_INVALID")
    except (OSError, ValueError, KeyError, TypeError, IndexError):
        _error(result, "CURRENT_CONTROL_STATE_INVALID")


def verify_repository(root: Path, *,
                      git_blob_reader: Callable[[str, str], bytes] | None = None,
                      file_reader: Callable[[str], bytes] | None = None) -> RecoveryResult:
    """Inspect pinned Git blobs and live files; never mutate the repository."""
    root = Path(root)
    result = RecoveryResult()
    if git_blob_reader is None:
        def git_blob_reader(commit: str, path: str) -> bytes:
            return subprocess.check_output(["git", "-c", "core.excludesFile=", "show",
                                            f"{commit}:{path}"], cwd=root)
    if file_reader is None:
        def file_reader(path: str) -> bytes:
            target = (root / path).resolve(strict=True)
            if not target.is_relative_to(root.resolve(strict=True)):
                raise ValueError("artifact outside repository")
            return target.read_bytes()
    for commit, blob, name in ((ANCHOR_COMMIT, ANCHOR_BLOB, "ANCHOR"),
                               (CUTOVER_COMMIT, CUTOVER_BLOB, "CUTOVER")):
        try:
            tree = subprocess.check_output(["git", "-c", "core.excludesFile=", "ls-tree",
                                            commit, EVENTS_PATH], cwd=root).decode("ascii")
            if tree.split()[2] != blob:
                _error(result, f"{name}_GIT_OBJECT_INVALID")
        except (OSError, subprocess.CalledProcessError, UnicodeDecodeError, IndexError):
            _error(result, f"{name}_GIT_OBJECT_UNAVAILABLE")
    try:
        incident_line = subprocess.check_output(
            ["git", "-c", "core.excludesFile=", "rev-list", "--parents", "-n", "1",
             INCIDENT_COMMIT], cwd=root).decode("ascii").split()
        if incident_line != [INCIDENT_COMMIT, ANCHOR_COMMIT]:
            _error(result, "INCIDENT_GIT_PARENT_INVALID")
        subprocess.check_call(["git", "-c", "core.excludesFile=", "merge-base",
                               "--is-ancestor", INCIDENT_COMMIT, CUTOVER_COMMIT], cwd=root)
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError):
        _error(result, "INCIDENT_GIT_ANCESTRY_INVALID")
    try:
        anchor_raw = git_blob_reader(ANCHOR_COMMIT, EVENTS_PATH)
    except (OSError, subprocess.CalledProcessError):
        _error(result, "ANCHOR_GIT_OBJECT_UNAVAILABLE")
        return result
    try:
        incident_raw = git_blob_reader(INCIDENT_COMMIT, EVENTS_PATH)
        cutover_raw = git_blob_reader(CUTOVER_COMMIT, EVENTS_PATH)
        current_raw = file_reader(EVENTS_PATH)
    except (OSError, subprocess.CalledProcessError, ValueError):
        _error(result, "INCIDENT_CUTOVER_OR_CURRENT_UNAVAILABLE")
        return result
    streams = _check_sources(result, anchor_raw, incident_raw, cutover_raw, current_raw)
    if streams is None:
        return result
    _, current = streams
    _check_chain(result, current)
    _check_followups(result, current, file_reader)
    _check_current_control(result, current, file_reader)
    result.eligible = not result.errors
    return result
