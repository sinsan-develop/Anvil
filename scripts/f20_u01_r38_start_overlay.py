"""Issue the Scoped budget source R38 writer from the verified R37 close prefix."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_u01_r37_close_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r37_close_overlay as prior


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF = prior.EVENTS, prior.PROGRESS, prior.HANDOFF
START, END = 2028, 2032
BASE = "fceffd660d3f99c27221d286b0f19c1787a13ccd"
MODE = "F20_U01_R38_SCOPED_BUDGET_SOURCE_START"
ACTOR = "developer-primary-f20-u01-r38"
SUBJECT = "F-20/U01-R38"
NEXT = "F20_U01_R38_SCOPED_BUDGET_SOURCE_IMPLEMENTATION"
PLAN = "docs/04_test_reports/F-20_U01_R38_SCOPED_BUDGET_SOURCE_PLAN.md"
WI = "docs/work_orders/F-20_U01_R38_SCOPED_BUDGET_SOURCE_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_U01_R38_SCOPED_BUDGET_SOURCE_INVOCATION.md"
REPORT = "docs/04_test_reports/F-20_U01_R38_SCOPED_BUDGET_SOURCE_RESULT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r38-start.json"
MANIFEST = "docs/evidence/manifests/F-20_U01_R38_SCOPED_BUDGET_SOURCE_START_MANIFEST.json"
SCOPE = [
    "packages/persistence/operations_budget_read.py",
    "apps/api/anvil_api/oidc_process.py",
    "tests/persistence/test_operations_budget_read.py",
    "tests/api/test_f20_u01_r38_budget_host_binding.py",
    "tests/integration/test_f20_u01_r38_budget_host_pg15.py",
    REPORT,
]
KINDS = ("WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED",
         "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED")
CONTROL_SCOPE = prior.CONTROL_SCOPE | {
    EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST,
    "docs/WORK_STATUS.md", "scripts/f20_u01_r38_start_overlay.py",
    "tests/tooling/test_f20_u01_r38_start_projection.py",
    "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    "docs/work_orders/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_WORK_INSTRUCTION.md",
    "docs/work_orders/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_INVOCATION.md",
    "scripts/f20_u01_r38b_fixture_rework_overlay.py",
    "tests/tooling/test_f20_u01_r38b_fixture_rework_projection.py",
    "docs/progress/progress-handoff-detached-digest-f20-u01-r38b-start.json",
    "docs/evidence/manifests/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_START_MANIFEST.json",
    "docs/progress/non-semantic-revision-binding-f20-u01-r38b.json",
}
FROZEN_PRIOR = (PLAN, WI, INVOCATION,
                "docs/04_test_reports/F-20_U01_POST_R37_ACCEPTANCE_GAP_REVIEW.md",
                prior.DIGEST, prior.MANIFEST,
                "scripts/f20_u01_r37_close_overlay.py",
                "tests/tooling/test_f20_u01_r37_close_projection.py")
CONTROL_SCOPE -= set(FROZEN_PRIOR)

def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _dirty(root: Path) -> set[str]:
    rows = _git(root, "status", "--porcelain", "-z").split(b"\0")
    if any(b"R" in row[:2] or b"C" in row[:2] for row in rows if row):
        raise ValueError("R38_RENAME_NOT_ALLOWED")
    return {row[3:].decode() for row in rows if row}


def _historical(root: Path) -> tuple[bytes, dict, dict]:
    raw = _git(root, "show", f"{BASE}:{EVENTS}")
    return raw, json.loads(raw), json.loads(_git(root, "show", f"{BASE}:{PROGRESS}"))


def _frozen_prior_match(root: Path) -> bool:
    try:
        return all((root / path).read_bytes() == _git(root, "show", f"{BASE}:{path}")
                   for path in FROZEN_PRIOR)
    except (OSError, subprocess.CalledProcessError):
        return False


def _append_raw(raw: bytes, old: dict, additions: list[dict]) -> bytes:
    marker = b'\n  ],\n  "last_event_id": "' + old["last_event_id"].encode() + b'"'
    sequence = f'"last_sequence": {START}'.encode()
    if (raw != r1._lf(raw) or len(additions) != len(KINDS)
            or raw.count(marker) != 1 or raw.count(sequence) != 1):
        raise ValueError("F20_U01_R38_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in additions)
    replacement = b'\n  ],\n  "last_event_id": "' + additions[-1]["event_id"].encode() + b'"'
    return raw.replace(marker, insertion + replacement).replace(
        sequence, f'"last_sequence": {END}'.encode(), 1)


def _make_rows(events: list[dict], wi_sha: str, invocation_sha: str,
               at: datetime, nonce: str) -> list[dict]:
    stamp = at.isoformat(timespec="seconds")
    expiry = (at + timedelta(hours=12)).isoformat(timespec="seconds")
    execution = f"f20-u01-r38-execution-fence-epoch-53-{nonce}"
    write_token = f"f20-u01-r38-write-fence-epoch-53-{nonce}"
    worker = {"lease_id": f"worker-lease-f20-u01-r38-{nonce}",
              "actor_id": ACTOR, "subject_ref": SUBJECT, "status": "ACTIVE",
              "issued_at": stamp, "expires_at": expiry, "lease_epoch": 53,
              "fencing_token": execution, "execution_fencing_token": execution,
              "baseline_git_commit": BASE, "dispatch_head": BASE, "path_scope": SCOPE}
    write = {**worker, "lease_id": f"write-lease-f20-u01-r38-{nonce}",
             "worker_lease_id": worker["lease_id"], "write_epoch": 53,
             "fencing_token": write_token, "write_fencing_token": write_token}
    details = (
        {"path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
         "invocation_sha256": invocation_sha,
         "classification": "MAIN_INTERNAL_APPROVED_SCOPE",
         "parent_work_instruction": prior.REPORT,
         "revision_reason": "U01_R38_SCOPED_BUDGET_SOURCE_BINDING"},
        worker, write,
        {"worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
         "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
         "package_status": "REWORK_IN_PROGRESS", "accepted": False},
    )
    rows = []
    for kind, detail in zip(KINDS, details):
        previous = rows[-1] if rows else events[-1]
        sequence = previous["sequence"] + 1
        rows.append({"sequence": sequence,
                     "event_id": f"evt_f20_{sequence}_{kind.lower()}",
                     "event_type": kind, "actor": "main-agent-eoul",
                     "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                     "project_id": "anvil", "work_package_id": "F-20",
                     "run_id": None, "step_id": MODE, "subject_ref": SUBJECT,
                     "occurred_at": stamp,
                     "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                     "previous_event_sha256": r1._sha(r1._canonical(previous)),
                     "details": detail})
    return rows


def _projection(root: Path, progress: dict, raw: bytes, stream: dict,
                rows: list[dict], wi_sha: str, invocation_sha: str) -> dict[str, bytes]:
    event_raw = _append_raw(raw, stream, rows)
    worker, write = rows[1]["details"], rows[2]["details"]
    stamp = rows[0]["occurred_at"]
    updated = deepcopy(progress)
    updated.update({
        "snapshot_id": "snapshot-f20-u01-r38-scoped-budget-source-start-seq2032",
        "event_sequence": END, "last_event_id": rows[-1]["event_id"],
        "updated_at": stamp, "status": "ACTIVE", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "f20_overall_status": "REWORK_IN_PROGRESS", "next_safe_action": NEXT,
        "runtime_next_action": NEXT,
        "active_work_instruction": {
            "artifact_id": "WI-F-20-U01-R38-20261004-001", "path": WI,
            "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha,
            "result_status": "REWORK_IN_PROGRESS",
            "package_status": "REWORK_IN_PROGRESS",
            "approval_classification": "MAIN_INTERNAL_APPROVED_SCOPE"},
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    updated["repository"].update({
        "local_head": BASE, "remote_head": BASE,
        "local_wsl_qa_head": prior.QA_HEAD,
        "validated_base_commit": BASE, "projection_mode": MODE,
        "worktree_status": "F20_U01_R38_SCOPED_BUDGET_SOURCE_ACTIVE",
        "product_write_scope": SCOPE, "commit_status": "PENDING",
        "push_status": "PENDING"})
    updated["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(updated)
    snapshot.pop("snapshot_hash", None)
    updated["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(updated)
    summary = {"event_sequence": END, "last_event_id": rows[-1]["event_id"],
               "status": "ACTIVE", "current_work_package": "F-20",
               "active_agent": ACTOR, "worker_lease": worker, "write_lease": write,
               "incident_event_id": progress["f20_c30_event_integrity_incident"]["event_id"],
               "incident_blocking": True, "next_safe_action": NEXT,
               "repository_head": BASE,
               "repository_upstream": "development/codex/f18-wsl-ops",
               "reporting_decision": updated["reporting_decision"]["decision"]}
    handoff_raw = (b"# F-20/U-01 R38 Scoped budget source start handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- Scoped budget ledger/reservation only, not forecast-overrun acceptance; C30 OPEN_BLOCKING; F-20 incomplete; "
                     b"Production NOT_EXECUTED.\n")
    digest_raw = r1._pretty({
        "schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": END,
        "self_reference": False,
        "progress": {"path": PROGRESS, "bytes": len(progress_raw),
                     "file_sha256": r1._sha(progress_raw)},
        "handoff": {"path": HANDOFF, "bytes": len(handoff_raw),
                    "file_sha256": r1._sha(handoff_raw)}})
    manifest_raw = r1._pretty({
        "schema_version": "1.0.0", "package_id": "F-20", "event_sequence": END,
        "accepted": False, "projection_mode": MODE, "previous_event_sequence": START,
        "product_write_scope": SCOPE, "predecessor_commit": BASE,
        "predecessor_events_sha256": r1._sha(raw), "plan_path": PLAN,
        "plan_sha256": r1._sha(r1._lf((root / PLAN).read_bytes())),
        "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
        "incident_event_id": progress["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": True, "release_decision": "DEFER",
        "production": "NOT_EXECUTED", "self_reference": False})
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw}


def materialize(root: Path, at: datetime, nonce: str) -> None:
    root = Path(root)
    raw, stream, progress = _historical(root)
    if (at.tzinfo is None or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
            or stream["last_sequence"] != START or len(stream["events"]) != START
            or progress["event_sequence"] != START
            or progress["repository"]["projection_mode"] != prior.MODE
            or progress["worker_lease"] is not None or progress["write_lease"] is not None
            or progress["f20_c30_event_integrity_incident"]["status"] != "OPEN_BLOCKING"
            or progress["scope_revision_binding"]["release_decision"] != "DEFER"
            or (root / EVENTS).read_bytes() != raw
            or (root / PROGRESS).read_bytes() != _git(root, "show", f"{BASE}:{PROGRESS}")
            or not _frozen_prior_match(root)
            or _git(root, "branch", "--show-current").decode().strip() != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
               != "development/codex/f18-wsl-ops"
            or _git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != BASE
            or not _dirty(root) <= CONTROL_SCOPE
            or prior.validate_control(root, {"_root": root, "progress": progress,
                                          "events": stream}, at)):
        raise RuntimeError("F20_U01_R38_PREDECESSOR_INVALID")
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    rows = _make_rows(stream["events"], wi_sha, invocation_sha, at, nonce)
    outputs = _projection(root, progress, raw, stream, rows, wi_sha, invocation_sha)
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    try:
        if not _frozen_prior_match(root):
            return ["F20_U01_R38_AUTHORITY_INVALID"]
        raw, old_stream, old_progress = _historical(root)
        rows = bundle["events"]["events"]
        worker, write = rows[START + 1]["details"], rows[START + 2]["details"]
        nonce = worker["lease_id"].removeprefix("worker-lease-f20-u01-r38-")
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
        invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
        if (now.tzinfo is None or at.tzinfo is None or not at <= now
                < datetime.fromisoformat(worker["expires_at"])
                or datetime.fromisoformat(worker["expires_at"]) - at != timedelta(hours=12)
                or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
                or len(rows) != END or rows[:START] != old_stream["events"]
                or bundle["events"]["last_sequence"] != END
                or [row["event_type"] for row in rows[START:]] != list(KINDS)
                or rows[START:] != _make_rows(old_stream["events"], wi_sha,
                                              invocation_sha, at, nonce)
                or worker["execution_fencing_token"] in r1._historical_fencing_tokens(
                    old_stream["events"])
                or write["write_fencing_token"] in r1._historical_fencing_tokens(
                    old_stream["events"])):
            return ["F20_U01_R38_TRANSITION_INVALID"]
        expected = _projection(root, old_progress, raw, old_stream, rows[START:],
                               wi_sha, invocation_sha)
        errors = [f"F20_U01_R38_{path.split('/')[-1].upper()}_INVALID"
                  for path, content in expected.items() if (root / path).read_bytes() != content]
        if (bundle["progress"] != json.loads(expected[PROGRESS])
                or bundle["events"] != json.loads(expected[EVENTS])
                or bundle.get("detached_digest", json.loads(expected[DIGEST]))
                   != json.loads(expected[DIGEST])
                or bundle.get("_detached_digest_path", DIGEST) != DIGEST):
            errors.append("F20_U01_R38_PROJECTION_INVALID")
        if (bundle["progress"].get("f20_c30_event_integrity_incident", {}).get("status")
                != "OPEN_BLOCKING" or bundle["progress"].get(
                    "scope_revision_binding", {}).get("release_decision") != "DEFER"
                or "F-20" in bundle["progress"].get("completed_packages", [])):
            errors.append("F20_U01_R38_BLOCKING_STATE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["F20_U01_R38_CONTROL_MISSING"]


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--no-renames", "--name-only",
                                        f"{BASE}..HEAD").decode().splitlines()))
        good = (_git(root, "branch", "--show-current").decode().strip() == "codex/f18-wsl-ops"
                and _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
                    == "development/codex/f18-wsl-ops"
                and all(re.fullmatch(r"[0-9a-f]{40}", value or "") for value in (head, remote))
                and all(subprocess.run(["git", "merge-base", "--is-ancestor", BASE, value],
                                       cwd=root, capture_output=True).returncode == 0
                        for value in (head, remote))
                and subprocess.run(["git", "merge-base", "--is-ancestor", remote, head],
                                   cwd=root, capture_output=True).returncode == 0
                and changed <= CONTROL_SCOPE | set(SCOPE)
                and _dirty(root) <= CONTROL_SCOPE | set(SCOPE)
                and progress["repository"]["projection_mode"] == MODE)
        return [] if good else ["F20_U01_R38_GIT_INVALID"]
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["F20_U01_R38_GIT_INVALID"]
