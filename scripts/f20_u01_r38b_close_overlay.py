"""Close the verified R38B writer leases; never accept F-20 or clear C30."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_u01_r38b_fixture_rework_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r38b_fixture_rework_overlay as prior


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF = prior.EVENTS, prior.PROGRESS, prior.HANDOFF
START, END = 2038, 2040
BASE = "PENDING_R38B_CLOSE_BASE"
QA_HEAD = "271cdc421b128e254b4b74b3fb755fab78d56194"
MODE = "F20_U01_R38B_BUDGET_FIXTURE_REWORK_CLOSE"
NEXT = "F20_U01_NEXT_INTERNAL_REWORK_C30_BLOCKED"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r38b-close.json"
MANIFEST = "docs/evidence/manifests/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_CLOSE_MANIFEST.json"
KINDS = ("WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED")
CONTROL_SCOPE = (prior.CONTROL_SCOPE | {
    EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST,
    "docs/WORK_STATUS.md", "scripts/check_project_progress.py",
    "scripts/f20_u01_r38b_close_overlay.py",
    "tests/tooling/test_f20_u01_r38b_close_projection.py",
}) - set(prior.FROZEN_PRIOR) - set(prior.SCOPE)
AUTHORITY_FILES = tuple(dict.fromkeys((*prior.FROZEN_PRIOR, *prior.SCOPE,
    prior.DIGEST, prior.MANIFEST,
    "packages/persistence/operations_budget_read.py",
    "apps/api/anvil_api/oidc_process.py",
    "scripts/f20_u01_r38b_fixture_rework_overlay.py",
    "tests/tooling/test_f20_u01_r38b_fixture_rework_projection.py")))


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _historical(root: Path) -> tuple[bytes, dict, dict]:
    raw = _git(root, "show", f"{BASE}:{EVENTS}")
    return raw, json.loads(raw), json.loads(_git(root, "show", f"{BASE}:{PROGRESS}"))


def _authority_bytes_match(root: Path) -> bool:
    try:
        return all((root / path).read_bytes() == _git(root, "show", f"{BASE}:{path}")
                   for path in AUTHORITY_FILES)
    except (OSError, subprocess.CalledProcessError):
        return False


def _append_raw(raw: bytes, old: dict, additions: list[dict]) -> bytes:
    marker = b'\n  ],\n  "last_event_id": "' + old["last_event_id"].encode() + b'"'
    sequence = f'"last_sequence": {START}'.encode()
    if (raw != r1._lf(raw) or len(additions) != len(KINDS)
            or raw.count(marker) != 1 or raw.count(sequence) != 1):
        raise ValueError("F20_U01_R38B_CLOSE_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in additions)
    replacement = b'\n  ],\n  "last_event_id": "' + additions[-1]["event_id"].encode() + b'"'
    return raw.replace(marker, insertion + replacement).replace(
        sequence, f'"last_sequence": {END}'.encode(), 1)


def _make_rows(events: list[dict], progress: dict, at: datetime) -> list[dict]:
    worker, write = progress["worker_lease"], progress["write_lease"]
    details = (
        {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
         "reason": "R38B_FIXTURE_WSL_PG15_GREEN_TEMP_RESIDUE_ZERO", "evidence_head": QA_HEAD},
        {"lease_id": worker["lease_id"],
         "execution_fencing_token": worker["execution_fencing_token"],
         "reason": "R38B_FIXTURE_WSL_PG15_GREEN_TEMP_RESIDUE_ZERO", "evidence_head": QA_HEAD},
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
                     "run_id": None, "step_id": MODE, "subject_ref": prior.SUBJECT,
                     "occurred_at": at.isoformat(timespec="seconds"),
                     "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                     "previous_event_sha256": r1._sha(r1._canonical(previous)),
                     "details": detail})
    return rows


def _projection(root: Path, old_progress: dict, raw: bytes,
                events: list[dict], additions: list[dict]) -> dict[str, bytes]:
    event_raw = _append_raw(raw, {"last_event_id": events[-1]["event_id"]}, additions)
    stamp = additions[0]["occurred_at"]
    worker, write = old_progress["worker_lease"], old_progress["write_lease"]
    progress = deepcopy(old_progress)
    progress.update({
        "snapshot_id": "snapshot-f20-u01-r38b-budget-fixture-rework-close-seq2040",
        "event_sequence": END, "last_event_id": additions[-1]["event_id"],
        "updated_at": stamp, "status": "ACTIVE", "active_agent": "main-agent-eoul",
        "worker_lease": None, "write_lease": None,
        "completed_f20_u01_r38b_worker_lease": {**worker, "status": "REVOKED", "revoked_at": stamp},
        "completed_f20_u01_r38b_write_lease": {**write, "status": "REVOKED", "revoked_at": stamp},
        "f20_overall_status": "REWORK_IN_PROGRESS", "next_safe_action": NEXT,
        "runtime_next_action": NEXT,
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["active_work_instruction"] = {
        **progress["active_work_instruction"],
        "result_status": "COMPLETED_R38B_FIXTURE_WSL_PG15_QA_ONLY",
        "package_status": "REWORK_IN_PROGRESS"}
    progress["repository"].update({
        "local_head": BASE, "remote_head": BASE, "local_wsl_qa_head": QA_HEAD,
        "validated_base_commit": BASE, "projection_mode": MODE,
        "worktree_status": "F20_U01_R38B_BUDGET_FIXTURE_COMPLETE_LEASE_CLOSED",
        "product_write_scope": [], "commit_status": "PENDING", "push_status": "PENDING",
    })
    progress["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(progress)
    summary = {"event_sequence": END, "last_event_id": additions[-1]["event_id"],
               "status": "ACTIVE", "current_work_package": "F-20",
               "active_agent": "main-agent-eoul", "worker_lease": None,
               "write_lease": None,
               "incident_event_id": old_progress["f20_c30_event_integrity_incident"]["event_id"],
               "incident_blocking": True, "next_safe_action": NEXT,
               "repository_head": BASE,
               "repository_upstream": "development/codex/f18-wsl-ops",
               "reporting_decision": progress["reporting_decision"]["decision"]}
    handoff_raw = (b"# F-20/U-01 R38B Budget fixture rework close handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- R38B WSL PG15 OIDC budget host and related suite PASS at QA commit "
                   + QA_HEAD.encode() + b"; close control base " + BASE.encode()
                   + b"; temp residue zero; C30 OPEN_BLOCKING; F-20 incomplete; "
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
        "product_write_scope": [], "predecessor_commit": BASE,
        "predecessor_events_sha256": r1._sha(raw), "plan_path": prior.PLAN,
        "plan_sha256": r1._sha(r1._lf((root / prior.PLAN).read_bytes())),
        "revision_binding_id": prior.BINDING_ID,
        "revision_binding_path": prior.REGISTRY,
        "incident_event_id": old_progress["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": True, "release_decision": "DEFER",
        "production": "NOT_EXECUTED", "self_reference": False})
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw}


def materialize(root: Path, dispatch_head: str, at: datetime) -> None:
    root = Path(root)
    raw, stream, progress = _historical(root)
    worker, write = progress.get("worker_lease"), progress.get("write_lease")
    if (dispatch_head != BASE or at.tzinfo is None
            or not isinstance(worker, dict) or not isinstance(write, dict)
            or worker.get("status") != "ACTIVE" or write.get("status") != "ACTIVE"
            or worker.get("lease_epoch") != 54 or write.get("write_epoch") != 54
            or write.get("worker_lease_id") != worker.get("lease_id")
            or write.get("execution_fencing_token") != worker.get("execution_fencing_token")
            or not datetime.fromisoformat(worker["issued_at"]) <= at
                   < datetime.fromisoformat(worker["expires_at"])
            or stream["last_sequence"] != START or len(stream["events"]) != START
            or progress["event_sequence"] != START
            or progress["repository"]["projection_mode"] != prior.MODE
            or progress["f20_c30_event_integrity_incident"]["status"] != "OPEN_BLOCKING"
            or progress["scope_revision_binding"]["release_decision"] != "DEFER"
            or (root / EVENTS).read_bytes() != raw
            or (root / PROGRESS).read_bytes() != _git(root, "show", f"{BASE}:{PROGRESS}")
            or not _authority_bytes_match(root)
            or _git(root, "branch", "--show-current").decode().strip() != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
               != "development/codex/f18-wsl-ops"
            or _git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != BASE
            or subprocess.run(["git", "merge-base", "--is-ancestor", QA_HEAD, BASE],
                              cwd=root, capture_output=True).returncode != 0
            or not prior._dirty(root) <= CONTROL_SCOPE
            or prior.validate_control(root, {"_root": root, "progress": progress,
                                             "events": stream}, at)):
        raise RuntimeError("F20_U01_R38B_CLOSE_PREDECESSOR_INVALID")
    additions = _make_rows(stream["events"], progress, at)
    outputs = _projection(root, progress, raw, stream["events"], additions)
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    try:
        if not _authority_bytes_match(root):
            return ["F20_U01_R38B_CLOSE_AUTHORITY_INVALID"]
        raw, old_stream, old_progress = _historical(root)
        rows = bundle["events"]["events"]
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        worker = old_progress["worker_lease"]
        if (now.tzinfo is None or at.tzinfo is None or now < at
                or at < datetime.fromisoformat(worker["issued_at"])
                or at >= datetime.fromisoformat(worker["expires_at"])
                or len(rows) != END or rows[:START] != old_stream["events"]
                or bundle["events"]["last_sequence"] != END
                or [row["event_type"] for row in rows[START:]] != list(KINDS)
                or rows[START:] != _make_rows(old_stream["events"], old_progress, at)
                or old_progress["repository"]["projection_mode"] != prior.MODE):
            return ["F20_U01_R38B_CLOSE_EVENT_INVALID"]
        expected = _projection(root, old_progress, raw, old_stream["events"], rows[START:])
        errors = [f"F20_U01_R38B_CLOSE_{path.split('/')[-1].upper()}_INVALID"
                  for path, content in expected.items() if (root / path).read_bytes() != content]
        if (bundle["progress"] != json.loads(expected[PROGRESS])
                or bundle["events"] != json.loads(expected[EVENTS])
                or bundle.get("detached_digest", json.loads(expected[DIGEST]))
                   != json.loads(expected[DIGEST])
                or bundle.get("_detached_digest_path", DIGEST) != DIGEST):
            errors.append("F20_U01_R38B_CLOSE_PROJECTION_INVALID")
        if (bundle["progress"].get("f20_c30_event_integrity_incident", {}).get("status")
                != "OPEN_BLOCKING" or bundle["progress"].get(
                    "scope_revision_binding", {}).get("release_decision") != "DEFER"
                or "F-20" in bundle["progress"].get("completed_packages", [])):
            errors.append("F20_U01_R38B_CLOSE_BLOCKING_STATE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["F20_U01_R38B_CLOSE_CONTROL_MISSING"]


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
                and changed <= CONTROL_SCOPE
                and prior._dirty(root) <= CONTROL_SCOPE
                and progress["repository"]["projection_mode"] == MODE)
        return [] if good else ["F20_U01_R38B_CLOSE_GIT_INVALID"]
    except (OSError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["F20_U01_R38B_CLOSE_GIT_INVALID"]
