"""Revoke R38 and issue a fixture-only R38B writer without accepting F-20."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_u01_r38_start_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r38_start_overlay as prior


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF = prior.EVENTS, prior.PROGRESS, prior.HANDOFF
START, END = 2032, 2038
BASE = "b6474bb55168fbb96fea594439ab865af2f9f2d4"
MODE = "F20_U01_R38B_BUDGET_FIXTURE_REWORK_START"
ACTOR = "developer-primary-f20-u01-r38b"
SUBJECT = "F-20/U01-R38B"
NEXT = "F20_U01_R38B_BUDGET_FIXTURE_REWORK"
PLAN = prior.PLAN
PRIOR_WI, PRIOR_INVOCATION, PRIOR_REPORT = prior.WI, prior.INVOCATION, prior.REPORT
WI = "docs/work_orders/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_INVOCATION.md"
REPORT = "docs/04_test_reports/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_RESULT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r38b-start.json"
MANIFEST = "docs/evidence/manifests/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_START_MANIFEST.json"
REGISTRY = "docs/progress/non-semantic-revision-binding-f20-u01-r38b.json"
BINDING_ID = "MAIN_RECONFIRMED_NON_SEMANTIC:F20-U01-R38B-FIXTURE-20261004-001"
SCOPE = [
    "tests/observability/test_f20_u01_r17_run_host_binding.py",
    "tests/observability/test_f20_u01_r36_agent_host_binding.py",
    "tests/api/test_f20_u01_r9_oidc_queue_host.py",
    "tests/api/test_f20_u01_r37_provider_host_binding.py",
    "tests/integration/test_f20_u01_r37_provider_host_pg15.py",
    REPORT,
]
KINDS = ("WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED",
         "WORK_INSTRUCTION_REVISED", "WORKER_LEASE_ISSUED",
         "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED")
CONTROL_SCOPE = prior.CONTROL_SCOPE | {
    EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST,
    "docs/WORK_STATUS.md", WI, INVOCATION,
    "scripts/f20_u01_r38b_fixture_rework_overlay.py",
    "tests/tooling/test_f20_u01_r38b_fixture_rework_projection.py",
    "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
}
FROZEN_PRIOR = (PLAN, PRIOR_WI, PRIOR_INVOCATION, PRIOR_REPORT, WI, INVOCATION,
                prior.DIGEST, prior.MANIFEST,
                REGISTRY,
                "scripts/f20_u01_r38_start_overlay.py",
                "tests/tooling/test_f20_u01_r38_start_projection.py")
CONTROL_SCOPE -= set(FROZEN_PRIOR)


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _dirty(root: Path) -> set[str]:
    rows = _git(root, "status", "--porcelain", "-z").split(b"\0")
    if any(b"R" in row[:2] or b"C" in row[:2] for row in rows if row):
        raise ValueError("R38B_RENAME_NOT_ALLOWED")
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


def _binding(root: Path, progress: dict, wi_sha: str) -> dict:
    registry = json.loads((root / REGISTRY).read_bytes())
    parent_registry = registry["parent_registry_path"]
    if (parent_registry != "docs/progress/non-semantic-revision-bindings.json"
            or registry["parent_registry_sha256"] != r1._sha((root / parent_registry).read_bytes())):
        raise ValueError("R38B_PARENT_REGISTRY_INVALID")
    rows = [row for row in registry["bindings"] if row.get("binding_id") == BINDING_ID]
    if len(rows) != 1:
        raise ValueError("R38B_BINDING_MISSING_OR_DUPLICATE")
    binding = rows[0]
    approval = progress["root_human_approval_binding"]
    if (binding.get("parent_baseline_id") != progress["snapshot_id"]
            or binding.get("derived_baseline_id")
               != "snapshot-f20-u01-r38b-budget-fixture-rework-start-seq2038"
            or binding.get("root_human_approval_id") != approval["approval_id"]
            or binding.get("root_approval_subject_hash") != approval["approval_subject_hash"]
            or binding.get("artifact_id") != "WI-F-20-U01-R38B-20261004-001"
            or binding.get("artifact_path") != WI
            or binding.get("old_hash") != progress["active_work_instruction"]["sha256"]
            or binding.get("new_hash") != wi_sha
            or binding.get("semantic_diff_classification") != "NON_SEMANTIC"
            or binding.get("derived_scope") != SCOPE
            or binding.get("reconfirmed_actor")
               != {"actor_type": "agent", "actor_id": "main-agent-eoul"}
            or not binding.get("changed_clauses") or not binding.get("impact")
            or not binding.get("rationale") or not binding.get("root_approval_scope")
            or datetime.fromisoformat(binding["reconfirmed_at"]).tzinfo is None):
        raise ValueError("R38B_BINDING_INVALID")
    return binding


def _append_raw(raw: bytes, old: dict, additions: list[dict]) -> bytes:
    marker = b'\n  ],\n  "last_event_id": "' + old["last_event_id"].encode() + b'"'
    sequence = f'"last_sequence": {START}'.encode()
    if (raw != r1._lf(raw) or len(additions) != len(KINDS)
            or raw.count(marker) != 1 or raw.count(sequence) != 1):
        raise ValueError("F20_U01_R38B_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in additions)
    replacement = b'\n  ],\n  "last_event_id": "' + additions[-1]["event_id"].encode() + b'"'
    return raw.replace(marker, insertion + replacement).replace(
        sequence, f'"last_sequence": {END}'.encode(), 1)


def _make_rows(events: list[dict], progress: dict, wi_sha: str, invocation_sha: str,
               at: datetime, nonce: str, binding: dict) -> list[dict]:
    stamp = at.isoformat(timespec="seconds")
    expiry = (at + timedelta(hours=12)).isoformat(timespec="seconds")
    old_worker, old_write = progress["worker_lease"], progress["write_lease"]
    execution = f"f20-u01-r38b-execution-fence-epoch-54-{nonce}"
    write_token = f"f20-u01-r38b-write-fence-epoch-54-{nonce}"
    worker = {"lease_id": f"worker-lease-f20-u01-r38b-{nonce}",
              "actor_id": ACTOR, "subject_ref": SUBJECT, "status": "ACTIVE",
              "issued_at": stamp, "expires_at": expiry, "lease_epoch": 54,
              "fencing_token": execution, "execution_fencing_token": execution,
              "baseline_git_commit": BASE, "dispatch_head": BASE, "path_scope": SCOPE}
    write = {**worker, "lease_id": f"write-lease-f20-u01-r38b-{nonce}",
             "worker_lease_id": worker["lease_id"], "write_epoch": 54,
             "fencing_token": write_token, "write_fencing_token": write_token}
    details = (
        {"lease_id": old_write["lease_id"],
         "write_fencing_token": old_write["write_fencing_token"],
         "reason": "R38_INCOMPLETE_FIXTURE_REWORK"},
        {"lease_id": old_worker["lease_id"],
         "execution_fencing_token": old_worker["execution_fencing_token"],
         "reason": "R38_INCOMPLETE_FIXTURE_REWORK"},
        {"classification": "MAIN_RECONFIRMED_NON_SEMANTIC",
         "parent_approval_id": progress["scope_revision_binding"]["approval_id"],
         "scope_expansion": False,
         "parent_work_instruction": {
             "path": PRIOR_WI,
             "sha256": progress["active_work_instruction"]["sha256"]},
         "derived_work_instruction": {"path": WI, "sha256": wi_sha},
         "semantic_diff": "LOCAL_TEST_FIXTURE_ONLY_NO_PRODUCT_CONTRACT_CHANGE",
         "invocation": {"path": INVOCATION, "sha256": invocation_sha},
         "work_instruction_id": "WI-F-20-U01-R38B-20261004-001",
         "previous_work_instruction_sha256": progress["active_work_instruction"]["sha256"],
         "work_instruction_sha256": wi_sha,
         "reason": "EXISTING_SQLITE_HOST_FIXTURE_BUDGET_SOURCE",
         "product_write_scope": SCOPE, "projection_mode": MODE,
         "exact_allowed_paths": SCOPE,
         "revision_binding": binding},
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
                rows: list[dict], wi_sha: str, invocation_sha: str,
                binding: dict) -> dict[str, bytes]:
    event_raw = _append_raw(raw, stream, rows)
    old_worker, old_write = progress["worker_lease"], progress["write_lease"]
    worker, write = rows[3]["details"], rows[4]["details"]
    stamp = rows[0]["occurred_at"]
    updated = deepcopy(progress)
    updated.update({
        "snapshot_id": "snapshot-f20-u01-r38b-budget-fixture-rework-start-seq2038",
        "event_sequence": END, "last_event_id": rows[-1]["event_id"],
        "updated_at": stamp, "status": "ACTIVE", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "completed_f20_u01_r38_worker_lease": {**old_worker, "status": "REVOKED",
                                                 "revoked_at": stamp},
        "completed_f20_u01_r38_write_lease": {**old_write, "status": "REVOKED",
                                                "revoked_at": stamp},
        "r38b_nonsemantic_revision_binding": binding,
        "f20_overall_status": "REWORK_IN_PROGRESS", "next_safe_action": NEXT,
        "runtime_next_action": NEXT,
        "active_work_instruction": {
            "artifact_id": "WI-F-20-U01-R38B-20261004-001", "path": WI,
            "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha,
            "result_status": "REWORK_IN_PROGRESS",
            "package_status": "REWORK_IN_PROGRESS",
            "approval_classification": "MAIN_RECONFIRMED_NON_SEMANTIC",
            "revision_binding_id": BINDING_ID,
            "parent_approval_id": progress["scope_revision_binding"]["approval_id"],
            "parent_work_instruction_sha256": progress["active_work_instruction"]["sha256"]},
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    updated["repository"].update({
        "local_head": BASE, "remote_head": BASE,
        "validated_base_commit": BASE, "projection_mode": MODE,
        "worktree_status": "F20_U01_R38B_BUDGET_FIXTURE_REWORK_ACTIVE",
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
    summary["revision_binding_id"] = BINDING_ID
    handoff_raw = (b"# F-20/U-01 R38B Budget fixture rework start handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- Fixture-only local rework; R38 remains INCOMPLETE, C30 OPEN_BLOCKING; "
                     b"F-20 unaccepted; Production NOT_EXECUTED.\n")
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
        "parent_work_instruction_sha256": progress["active_work_instruction"]["sha256"],
        "revision_classification": "MAIN_RECONFIRMED_NON_SEMANTIC",
        "revision_binding_id": BINDING_ID,
        "revision_binding_path": REGISTRY,
        "revision_binding_file_sha256": r1._sha((root / REGISTRY).read_bytes()),
        "parent_approval_id": progress["scope_revision_binding"]["approval_id"],
        "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
        "incident_event_id": progress["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": True, "release_decision": "DEFER",
        "production": "NOT_EXECUTED", "self_reference": False})
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw}


def materialize(root: Path, at: datetime, nonce: str) -> None:
    root = Path(root)
    raw, stream, progress = _historical(root)
    old_worker, old_write = progress.get("worker_lease"), progress.get("write_lease")
    if (at.tzinfo is None or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
            or stream["last_sequence"] != START or len(stream["events"]) != START
            or progress["event_sequence"] != START
            or progress["repository"]["projection_mode"] != prior.MODE
            or not isinstance(old_worker, dict) or not isinstance(old_write, dict)
            or old_worker.get("lease_epoch") != 53 or old_write.get("write_epoch") != 53
            or old_worker.get("status") != "ACTIVE" or old_write.get("status") != "ACTIVE"
            or old_write.get("worker_lease_id") != old_worker.get("lease_id")
            or old_write.get("execution_fencing_token") != old_worker.get("execution_fencing_token")
            or not at < datetime.fromisoformat(old_worker["expires_at"])
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
        raise RuntimeError("F20_U01_R38B_PREDECESSOR_INVALID")
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    binding = _binding(root, progress, wi_sha)
    if datetime.fromisoformat(binding["reconfirmed_at"]) > at:
        raise RuntimeError("F20_U01_R38B_BINDING_FROM_FUTURE")
    rows = _make_rows(stream["events"], progress, wi_sha, invocation_sha, at, nonce, binding)
    outputs = _projection(root, progress, raw, stream, rows, wi_sha, invocation_sha, binding)
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    try:
        if not _frozen_prior_match(root):
            return ["F20_U01_R38B_AUTHORITY_INVALID"]
        raw, old_stream, old_progress = _historical(root)
        rows = bundle["events"]["events"]
        worker, write = rows[START + 3]["details"], rows[START + 4]["details"]
        nonce = worker["lease_id"].removeprefix("worker-lease-f20-u01-r38b-")
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
        invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
        binding = _binding(root, old_progress, wi_sha)
        if (now.tzinfo is None or at.tzinfo is None or not at <= now
                or datetime.fromisoformat(binding["reconfirmed_at"]) > at
                < datetime.fromisoformat(worker["expires_at"])
                or datetime.fromisoformat(worker["expires_at"]) - at != timedelta(hours=12)
                or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
                or len(rows) != END or rows[:START] != old_stream["events"]
                or bundle["events"]["last_sequence"] != END
                or [row["event_type"] for row in rows[START:]] != list(KINDS)
                or rows[START:] != _make_rows(old_stream["events"], old_progress,
                                              wi_sha, invocation_sha, at, nonce, binding)
                or worker["execution_fencing_token"] in r1._historical_fencing_tokens(
                    old_stream["events"])
                or write["write_fencing_token"] in r1._historical_fencing_tokens(
                    old_stream["events"])):
            return ["F20_U01_R38B_TRANSITION_INVALID"]
        expected = _projection(root, old_progress, raw, old_stream, rows[START:],
                               wi_sha, invocation_sha, binding)
        errors = [f"F20_U01_R38B_{path.split('/')[-1].upper()}_INVALID"
                  for path, content in expected.items() if (root / path).read_bytes() != content]
        if (bundle["progress"] != json.loads(expected[PROGRESS])
                or bundle["events"] != json.loads(expected[EVENTS])
                or bundle.get("detached_digest", json.loads(expected[DIGEST]))
                   != json.loads(expected[DIGEST])
                or bundle.get("_detached_digest_path", DIGEST) != DIGEST):
            errors.append("F20_U01_R38B_PROJECTION_INVALID")
        if (bundle["progress"].get("f20_c30_event_integrity_incident", {}).get("status")
                != "OPEN_BLOCKING" or bundle["progress"].get(
                    "scope_revision_binding", {}).get("release_decision") != "DEFER"
                or "F-20" in bundle["progress"].get("completed_packages", [])):
            errors.append("F20_U01_R38B_BLOCKING_STATE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["F20_U01_R38B_CONTROL_MISSING"]


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
        return [] if good else ["F20_U01_R38B_GIT_INVALID"]
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["F20_U01_R38B_GIT_INVALID"]
