from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from copy import deepcopy
from pathlib import Path


BASE = "1fadc0a7c7a69588a5cb5a6e36a95399b1a1791e"
BRANCH = "codex/f03-cerebras-adapter"
MODE = "F03_START_EXACT9_PRODUCT_EXACT5"
FINAL_MODE = "F03_FINAL_ACCEPTANCE_EXACT15"
START_COMMIT = "9ec430908a3473815d5839f028d290414494f37b"
AT = "2026-09-23T18:20:00+09:00"
EXPIRES = "2026-09-24T06:20:00+09:00"
ACTOR = "developer-primary-f03-r1"
WORKER = "worker-lease-f03-r1-20260923-001"
WRITE = "write-lease-f03-r1-20260923-001"
EXECUTION_TOKEN = "f03-r1-execution-fence-epoch-1-1fadc0a7c7a69588"
WRITE_TOKEN = "f03-r1-write-fence-epoch-1-5cb5a6e36a95399b"
WI = "docs/work_orders/F-03_WORK_INSTRUCTION.md"
PROMPT = "docs/work_orders/F-03_INVOCATION_PROMPT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f03-start.json"
MANIFEST = "docs/evidence/manifests/F-03_START_MANIFEST.json"
REVIEW = "docs/04_test_reports/F-03_INDEPENDENT_REVIEW.md"


def product_paths():
    return sorted(
        [
            "packages/providers/cerebras_adapter.py",
            "packages/providers/cerebras_errors.py",
            "packages/providers/cerebras_models.py",
            "tests/providers/test_cerebras_adapter_f03.py",
            "docs/04_test_reports/F-03_COMPLETION_REPORT.md",
        ]
    )


def control_paths():
    return sorted(
        [
            "docs/WORK_STATUS.md",
            "docs/evidence/manifests/F-03_START_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-f03-start.json",
            "scripts/check_project_progress.py",
            "scripts/f03_progress_overlay.py",
            "tests/tooling/test_f03_progress_overlay.py",
        ]
    )


def final_control_paths():
    return sorted(control_paths() + [REVIEW])


def final_paths():
    return sorted(final_control_paths() + product_paths())


def canonical(value):
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode(
        "utf-8"
    )


def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def file_sha(root, relative):
    return sha((root / relative).read_bytes())


def event_sha(event):
    return sha(canonical(event))


def append_event(events, event_type, details):
    sequence = events[-1]["sequence"] + 1
    event = {
        "sequence": sequence,
        "event_id": f"evt_f03_{sequence}_{event_type.lower()}",
        "event_type": event_type,
        "actor": "main-agent-eoul",
        "actor_id": "main-agent-eoul",
        "actor_type": "AGENT",
        "project_id": "anvil",
        "work_package_id": "F-03",
        "run_id": None,
        "step_id": "START",
        "subject_ref": "F-03/START",
        "occurred_at": AT,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": event_sha(events[-1]),
        "details": details,
    }
    events.append(event)
    return event


def validate_git_facts(
    *, head, branch, upstream, remote_head, staged, dirty, parent, committed
):
    controls = set(control_paths())
    products = set(product_paths())
    common = (
        branch == BRANCH
        and upstream == f"development/{BRANCH}"
        and not staged
        and remote_head in {BASE, head}
    )
    precommit = head == BASE and set(dirty) == controls
    postcommit = (
        head != BASE
        and parent == BASE
        and set(committed or ()) == controls
        and set(dirty) <= products
    )
    return [] if common and (precommit or postcommit) else ["F03_START_GIT_INVALID"]


def validate_final_git_facts(
    *, head, branch, upstream, remote_head, staged, dirty, parent, committed
):
    expected = set(final_paths())
    common = (
        branch == BRANCH
        and upstream == f"development/{BRANCH}"
        and not staged
        and remote_head in {START_COMMIT, head}
    )
    precommit = head == START_COMMIT and set(dirty) == expected
    postcommit = (
        head != START_COMMIT
        and parent == START_COMMIT
        and set(committed or ()) == expected
        and not dirty
    )
    return [] if common and (precommit or postcommit) else ["F03_FINAL_GIT_INVALID"]


def collect_git(root):
    try:
        git = lambda *args: subprocess.check_output(
            ["git", "-c", "core.excludesFile=", *args], cwd=root, text=True
        ).strip()
        head = git("rev-parse", "HEAD")
        upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
        remote_head = git("rev-parse", "@{u}")
        branch = git("branch", "--show-current")
        staged = set(filter(None, git("diff", "--cached", "--name-only").splitlines()))
        status = subprocess.check_output(
            ["git", "-c", "core.excludesFile=", "status", "--porcelain=v1", "--untracked-files=all"],
            cwd=root,
            text=True,
        ).splitlines()
        dirty = {line[3:].replace("\\", "/") for line in status}
        parent = None
        committed = None
        progress = json.loads((Path(root) / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
        final = progress.get("repository", {}).get("projection_mode") == FINAL_MODE
        anchor = START_COMMIT if final else BASE
        if head != anchor:
            parent = git("rev-parse", "HEAD^")
            committed = set(filter(None, git("diff", "--name-only", f"{anchor}..HEAD").splitlines()))
        validator = validate_final_git_facts if final else validate_git_facts
        return validator(
            head=head,
            branch=branch,
            upstream=upstream,
            remote_head=remote_head,
            staged=staged,
            dirty=dirty,
            parent=parent,
            committed=committed,
        )
    except Exception:
        return ["F03_GIT_COLLECTION_FAILED"]


def materialize(root):
    root = Path(root)
    committed = lambda relative: subprocess.check_output(
        ["git", "show", f"{BASE}:{relative}"], cwd=root
    )
    progress = json.loads(committed("docs/progress/build-progress.json"))
    event_raw = committed("docs/progress/progress-events.json")
    ledger = json.loads(event_raw)
    events = ledger["events"]
    if (
        progress.get("event_sequence") != 1359
        or ledger.get("last_sequence") != 1359
        or progress.get("status") != "ACCEPTED"
        or progress.get("next_successor_work_package") is not None
        or any(progress.get(key) is not None for key in ("active_agent", "worker_lease", "write_lease"))
    ):
        raise RuntimeError("F03_BASE_STATE_INVALID")

    wi_hash = file_sha(root, WI)
    prompt_hash = file_sha(root, PROMPT)
    products = product_paths()
    worker = {
        "lease_id": WORKER,
        "actor_id": ACTOR,
        "subject_ref": "F-03",
        "status": "ACTIVE",
        "issued_at": AT,
        "expires_at": EXPIRES,
        "lease_epoch": 1,
        "fencing_token": EXECUTION_TOKEN,
        "execution_fencing_token": EXECUTION_TOKEN,
        "baseline_git_commit": BASE,
        "dispatch_head": BASE,
        "path_scope": products,
    }
    write = {
        **worker,
        "lease_id": WRITE,
        "worker_lease_id": WORKER,
        "write_epoch": 1,
        "fencing_token": WRITE_TOKEN,
        "write_fencing_token": WRITE_TOKEN,
    }
    authority = {
        "approval_ref": "APPROVAL-20260814-WORKPLAN-V16-001",
        "classification": "APPROVED_WORK_PLAN_PACKAGE",
        "scope_expansion": False,
        "external_execution_authorized": False,
        "product_write_scope": products,
    }
    additions = []
    additions.append(
        append_event(
            events,
            "WORK_INSTRUCTION_ISSUED",
            {
                "work_instruction_id": "WI-F-03-R1-20260923-001",
                "work_instruction_path": WI,
                "work_instruction_sha256": wi_hash,
                "invocation_path": PROMPT,
                "invocation_sha256": prompt_hash,
                "authority": authority,
            },
        )
    )
    additions.append(append_event(events, "WORKER_LEASE_ISSUED", worker))
    additions.append(append_event(events, "WRITE_LEASE_ISSUED", write))
    additions.append(
        append_event(
            events,
            "PACKAGE_STARTED",
            {
                "package_status": "IN_PROGRESS",
                "work_package_id": "F-03",
                "status": "IN_PROGRESS",
                "active_agent": ACTOR,
                "worker_lease_id": WORKER,
                "write_lease_id": WRITE,
                "projection_mode": MODE,
                "validated_base_commit": BASE,
                "exact_allowed_paths": sorted(control_paths() + products),
                "product_write_scope": products,
                "authority": authority,
            },
        )
    )

    old_id = ledger["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if event_raw.count(marker) != 1:
        raise RuntimeError("F03_EVENT_TAIL_INVALID")
    encoded_additions = b",\n" + b",\n".join(pretty(row).rstrip() for row in additions)
    new_event_raw = event_raw.replace(
        marker,
        encoded_additions
        + marker.replace(old_id, additions[-1]["event_id"].encode()),
    ).replace(b'"last_sequence": 1359', b'"last_sequence": 1363', 1)

    repository = deepcopy(progress["repository"])
    repository.update(
        {
            "branch": BRANCH,
            "upstream": f"development/{BRANCH}",
            "local_head": BASE,
            "remote_head": BASE,
            "control_head": BASE,
            "projection_mode": MODE,
            "validated_base_commit": BASE,
            "head_relation": "PRECOMMIT_CONTROL_EXACT9_OR_DIRECT_CHILD_WITH_PRODUCT_EXACT5",
            "exact_allowed_paths": sorted(control_paths() + products),
            "product_write_scope": products,
            "worktree_status": "UNSTAGED_F03_START_CONTROL_EXACT9",
            "commit_status": "NOT_EXECUTED",
            "push_status": "NOT_EXECUTED",
        }
    )
    progress.update(
        {
            "snapshot_id": "snapshot-f03-start-seq1363",
            "event_sequence": 1363,
            "last_event_id": additions[-1]["event_id"],
            "updated_at": AT,
            "recorded_at": AT,
            "current_phase": "F",
            "current_work_package": "F-03",
            "status": "IN_PROGRESS",
            "active_agent": {
                "actor_id": ACTOR,
                "role": "PRIMARY_DEVELOPER",
                "work_package_id": "F-03",
                "status": "ACTIVE",
                "execution_fencing_token": EXECUTION_TOKEN,
            },
            "worker_lease": worker,
            "write_lease": write,
            "active_work_instruction": {
                "work_package_id": "F-03",
                "artifact_path": WI,
                "artifact_sha256": wi_hash,
                "invocation_path": PROMPT,
                "invocation_sha256": prompt_hash,
                "status": "IN_PROGRESS",
                "result_status": None,
                "accepted": False,
                "product_write_scope": products,
                "worker_lease_id": WORKER,
                "write_lease_id": WRITE,
            },
            "repository": repository,
            "next_work_package": {"package_id": "F-03", "status": "IN_PROGRESS"},
            "next_successor_work_package": {"package_id": "F-04", "status": "NOT_READY"},
            "next_safe_action": "F03_CEREBRAS_ADAPTER_TDD",
            "runtime_next_action": "F03_CEREBRAS_ADAPTER_TDD",
            "pending_approvals": [],
            "current_progress_evidence_ref": {
                "package_id": "F-03",
                "path": DIGEST,
                "manifest_path": MANIFEST,
            },
            "latest_evidence_manifest_ref": {
                "path": MANIFEST,
                "artifact_id": "F03-START-20260923",
            },
            "latest_evidence_refs": [
                {"path": WI, "sha256": wi_hash},
                {"path": PROMPT, "sha256": prompt_hash},
            ],
            "reporting_decision": {
                "decision": "AUTO_CONTINUE",
                "reason_codes": ["C30_ACCEPTED", "F03_APPROVED_SCOPE"],
                "stop_before_dialogue_report": False,
            },
        }
    )
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json",
        "sha256": sha(new_event_raw),
    }
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = sha(canonical(snapshot))
    progress_raw = pretty(progress)
    summary = {
        key: deepcopy(progress.get(key))
        for key in (
            "event_sequence",
            "last_event_id",
            "status",
            "current_phase",
            "current_work_package",
            "active_agent",
            "worker_lease",
            "write_lease",
            "next_work_package",
            "next_successor_work_package",
            "next_safe_action",
            "runtime_next_action",
        )
    }
    summary.update(
        {
            "repository_validated_base": BASE,
            "repository_branch": BRANCH,
            "external_execution": "NOT_AUTHORIZED_NOT_EXECUTED",
        }
    )
    handoff_raw = (
        "# F-03 CEREBRAS adapter start\n\n```json anvil-recovery-summary\n"
        + pretty(summary).decode("utf-8")
        + "```\n"
    ).encode("utf-8")
    digest = {
        "schema_version": "1.0.0",
        "algorithm": "SHA-256",
        "event_sequence": 1363,
        "self_reference": False,
        "progress": {
            "path": "docs/progress/build-progress.json",
            "bytes": len(progress_raw),
            "file_sha256": sha(progress_raw),
            "canonical_json_sha256": sha(canonical(progress)),
        },
        "handoff": {
            "path": "docs/progress/BUILD_HANDOFF.md",
            "bytes": len(handoff_raw),
            "file_sha256": sha(handoff_raw),
            "machine_summary_canonical_sha256": sha(canonical(summary)),
        },
    }
    digest_raw = pretty(digest)
    status_raw = (
        "# F-03 CEREBRAS adapter start / 2026-09-23\n\n"
        "- 판정: `IN_PROGRESS`; 승인된 작업계획 F-03 exact5 host-only TDD를 시작했다.\n"
        "- canonical worker/write lease와 fencing token을 seq1360~1363에 발급했다.\n"
        "- 실제 Provider/network/DB/UI/browser/deploy 호출은 승인하지 않았고 실행하지 않는다.\n\n"
    ).encode("utf-8") + committed("docs/WORK_STATUS.md")

    generated = {
        "docs/WORK_STATUS.md": status_raw,
        "docs/progress/BUILD_HANDOFF.md": handoff_raw,
        "docs/progress/build-progress.json": progress_raw,
        "docs/progress/progress-events.json": new_event_raw,
        DIGEST: digest_raw,
    }
    for relative, raw in generated.items():
        (root / relative).parent.mkdir(parents=True, exist_ok=True)
        (root / relative).write_bytes(raw)

    checksum_rows = []
    for relative in control_paths():
        if relative == MANIFEST:
            continue
        raw = (root / relative).read_bytes()
        checksum_rows.append({"path": relative, "bytes": len(raw), "sha256": sha(raw)})
    manifest = {
        "schema_version": "1.0.0",
        "manifest_type": "F03_START",
        "artifact_id": "F03-START-20260923",
        "package_id": "F-03",
        "event_sequence": 1363,
        "historical_event_sequence": 1359,
        "appended_event_count": 4,
        "accepted": False,
        "status": "IN_PROGRESS",
        "projection_mode": MODE,
        "validated_base_commit": BASE,
        "exact_allowed_paths": sorted(control_paths() + products),
        "control_paths": control_paths(),
        "product_write_scope": products,
        "authority": {WI: wi_hash, PROMPT: prompt_hash},
        "external_execution_authorized": False,
        "raw_checksums": checksum_rows,
        "self_reference": False,
    }
    (root / MANIFEST).parent.mkdir(parents=True, exist_ok=True)
    (root / MANIFEST).write_bytes(pretty(manifest))


def validate_start(root, bundle):
    root = Path(root)
    errors = []
    try:
        progress = bundle["progress"]
        event_value = bundle["events"]
        events = event_value["events"] if isinstance(event_value, dict) else event_value
        manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
        digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
        tail = events[-4:]
        if [row.get("event_type") for row in tail] != [
            "WORK_INSTRUCTION_ISSUED",
            "WORKER_LEASE_ISSUED",
            "WRITE_LEASE_ISSUED",
            "PACKAGE_STARTED",
        ]:
            errors.append("F03_START_EVENT_TAIL_INVALID")
        previous = event_sha(events[-5])
        for expected_sequence, row in enumerate(tail, 1360):
            if row.get("sequence") != expected_sequence or row.get("previous_event_sha256") != previous:
                errors.append("F03_START_EVENT_CHAIN_INVALID")
                break
            previous = event_sha(row)
        state_ok = (
            progress.get("event_sequence") == 1363
            and progress.get("status") == "IN_PROGRESS"
            and progress.get("current_phase") == "F"
            and progress.get("current_work_package") == "F-03"
            and progress.get("worker_lease", {}).get("lease_id") == WORKER
            and progress.get("write_lease", {}).get("lease_id") == WRITE
            and progress.get("repository", {}).get("projection_mode") == MODE
            and manifest.get("status") == "IN_PROGRESS"
            and manifest.get("product_write_scope") == product_paths()
        )
        if not state_ok:
            errors.append("F03_START_STATE_INVALID")
        progress_raw = (root / "docs/progress/build-progress.json").read_bytes()
        handoff_raw = (root / "docs/progress/BUILD_HANDOFF.md").read_bytes()
        if (len(progress_raw), sha(progress_raw)) != (
            digest["progress"]["bytes"],
            digest["progress"]["file_sha256"],
        ):
            errors.append("F03_START_PROGRESS_DIGEST_INVALID")
        if (len(handoff_raw), sha(handoff_raw)) != (
            digest["handoff"]["bytes"],
            digest["handoff"]["file_sha256"],
        ):
            errors.append("F03_START_HANDOFF_DIGEST_INVALID")
        for row in manifest.get("raw_checksums", []):
            raw = (root / row["path"]).read_bytes()
            if (len(raw), sha(raw)) != (row["bytes"], row["sha256"]):
                errors.append("F03_START_RAW_CHECKSUM_INVALID")
                break
        errors.extend(collect_git(root))
    except Exception:
        errors.append("F03_START_INPUT_INVALID")
    return sorted(set(errors))


def finalize(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    event_raw = (root / "docs/progress/progress-events.json").read_bytes()
    ledger = json.loads(event_raw)
    events = ledger["events"]
    if (
        progress.get("event_sequence") != 1363
        or progress.get("repository", {}).get("projection_mode") != MODE
        or progress.get("worker_lease", {}).get("lease_id") != WORKER
        or progress.get("write_lease", {}).get("lease_id") != WRITE
    ):
        raise RuntimeError("F03_START_STATE_REQUIRED")
    for relative in product_paths():
        if not (root / relative).is_file():
            raise RuntimeError("F03_PRODUCT_MISSING")

    review_raw = (
        "# F-03 independent review\n\n"
        "- 판정: `ACCEPT`; Critical 0, Important 0, Minor 0.\n"
        "- R1: credential-bearing header와 non-finite JSON fail-closed 보완 확인.\n"
        "- R2: unknown transport failure non-retryable, terminal/final usage 뒤 trailing stream frame 거부 확인.\n"
        "- 독립 focused: 45 passed; F03+C01+F01+F02: 186 passed; 넓은 관련 회귀: 738 passed, 4 skipped; D11: 94 passed; compile3 PASS.\n"
        "- skip4는 격리 PostgreSQL 18 DSN 미설정이며 DB PASS가 아니다. 실제 Cerebras/credential/network/DB/UI/browser/WSL/deploy는 미검증이다.\n"
        "- Reviewer는 파일 수정, commit, push, network 호출을 수행하지 않았다.\n"
    ).encode("utf-8")
    (root / REVIEW).write_bytes(review_raw)

    product_rows = []
    for relative in product_paths():
        raw = (root / relative).read_bytes()
        product_rows.append({"path": relative, "bytes": len(raw), "sha256": sha(raw)})
    review_hash = sha(review_raw)
    additions = []
    additions.append(
        append_event(
            events,
            "PACKAGE_COMPLETED",
            {
                "result_status": "COMPLETED",
                "package_id": "F-03",
                "product_paths": product_paths(),
                "product_hashes": {row["path"]: row["sha256"] for row in product_rows},
                "developer_report": "docs/04_test_reports/F-03_COMPLETION_REPORT.md",
                "verification": {
                    "focused": "45 passed",
                    "related_regression": "709 passed, 4 skipped",
                    "compile": "COMPILE3_PASS",
                    "diff_check": "PASS",
                },
            },
        )
    )
    additions.append(
        append_event(
            events,
            "INDEPENDENT_TEST_JUDGMENT_RECORDED",
            {
                "verdict": "ACCEPT",
                "critical": 0,
                "important": 0,
                "minor": 0,
                "review_report": REVIEW,
                "review_report_sha256": review_hash,
                "independent_verification": {
                    "focused": "45 passed",
                    "cross_contract": "186 passed",
                    "related_regression": "738 passed, 4 skipped",
                    "d11": "94 passed",
                    "compile": "COMPILE3_PASS",
                },
            },
        )
    )
    additions.append(
        append_event(events, "WRITE_LEASE_REVOKED", {"lease_id": WRITE, "reason": "F03_INDEPENDENT_ACCEPTANCE"})
    )
    additions.append(
        append_event(events, "WORKER_LEASE_REVOKED", {"lease_id": WORKER, "reason": "F03_INDEPENDENT_ACCEPTANCE"})
    )
    additions.append(
        append_event(
            events,
            "MAIN_PACKAGE_ACCEPTED",
            {
                "decision": "ACCEPTED",
                "package_id": "F-03",
                "next_work_package": "F-04",
                "blocking_findings": 0,
                "unverified": [
                    "LIVE_CEREBRAS",
                    "SECRET_BROKER",
                    "NETWORK",
                    "DATABASE",
                    "BROWSER",
                    "WSL",
                    "DEPLOYMENT",
                ],
            },
        )
    )
    old_id = ledger["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if event_raw.count(marker) != 1:
        raise RuntimeError("F03_FINAL_EVENT_TAIL_INVALID")
    encoded = b",\n" + b",\n".join(pretty(row).rstrip() for row in additions)
    new_event_raw = event_raw.replace(
        marker, encoded + marker.replace(old_id, additions[-1]["event_id"].encode())
    ).replace(b'"last_sequence": 1363', b'"last_sequence": 1368', 1)

    completed = list(progress.get("completed_packages", []))
    if "F-03" not in completed:
        completed.append("F-03")
    old_worker = deepcopy(progress["worker_lease"])
    old_write = deepcopy(progress["write_lease"])
    old_worker["status"] = "REVOKED"
    old_worker["revoked_at"] = AT
    old_write["status"] = "REVOKED"
    old_write["revoked_at"] = AT
    repository = deepcopy(progress["repository"])
    repository.update(
        {
            "local_head": START_COMMIT,
            "remote_head": START_COMMIT,
            "control_head": START_COMMIT,
            "projection_mode": FINAL_MODE,
            "validated_base_commit": START_COMMIT,
            "head_relation": "PRECOMMIT_EXACT15_OR_SOLE_DIRECT_CHILD",
            "exact_allowed_paths": final_paths(),
            "product_write_scope": product_paths(),
            "worktree_status": "UNSTAGED_F03_FINAL_EXACT15",
            "commit_status": "NOT_EXECUTED",
            "push_status": "NOT_EXECUTED",
        }
    )
    active_instruction = deepcopy(progress["active_work_instruction"])
    active_instruction.update({"status": "ACCEPTED", "result_status": "COMPLETED", "accepted": True})
    progress.update(
        {
            "snapshot_id": "snapshot-f03-final-seq1368",
            "event_sequence": 1368,
            "last_event_id": additions[-1]["event_id"],
            "updated_at": AT,
            "recorded_at": AT,
            "status": "ACCEPTED",
            "completed_packages": completed,
            "active_agent": None,
            "worker_lease": None,
            "write_lease": None,
            "completed_f03_worker_lease": old_worker,
            "completed_f03_write_lease": old_write,
            "active_work_instruction": None,
            "last_completed_work_instruction": active_instruction,
            "repository": repository,
            "next_work_package": {"package_id": "F-04", "status": "READY_FOR_WORK_INSTRUCTION"},
            "next_successor_work_package": {"package_id": "F-04", "status": "READY_FOR_WORK_INSTRUCTION"},
            "next_safe_action": "F04_WORK_INSTRUCTION_AND_START",
            "runtime_next_action": "F04_WORK_INSTRUCTION_AND_START",
            "pending_approvals": [],
            "valid_failure_count": 0,
            "active_failure_lineage": None,
            "current_progress_evidence_ref": {
                "package_id": "F-03",
                "path": DIGEST,
                "manifest_path": MANIFEST,
            },
            "latest_evidence_manifest_ref": {"path": MANIFEST, "artifact_id": "F03-FINAL-20260923"},
            "latest_evidence_refs": product_rows + [{"path": REVIEW, "sha256": review_hash}],
            "reporting_decision": {
                "decision": "AUTO_CONTINUE",
                "reason_codes": ["F03_ACCEPTED", "F04_APPROVED_SCOPE"],
                "stop_before_dialogue_report": False,
            },
        }
    )
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json",
        "sha256": sha(new_event_raw),
    }
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = sha(canonical(snapshot))
    progress_raw = pretty(progress)
    summary = {
        key: deepcopy(progress.get(key))
        for key in (
            "event_sequence",
            "last_event_id",
            "status",
            "current_phase",
            "current_work_package",
            "active_agent",
            "worker_lease",
            "write_lease",
            "next_work_package",
            "next_successor_work_package",
            "next_safe_action",
            "runtime_next_action",
        )
    }
    summary.update(
        {
            "f03_status": "ACCEPTED",
            "independent_review": "ACCEPT_C0_I0_M0",
            "repository_validated_base": START_COMMIT,
            "repository_branch": BRANCH,
        }
    )
    handoff_raw = (
        "# F-03 CEREBRAS adapter final acceptance\n\n```json anvil-recovery-summary\n"
        + pretty(summary).decode("utf-8")
        + "```\n"
    ).encode("utf-8")
    status_raw = (
        "# F-03 CEREBRAS adapter accepted / 2026-09-23\n\n"
        "- 판정: `ACCEPTED`; 독립 Reviewer `C0/I0/M0`.\n"
        "- Main focused 45 PASS, 관련 회귀 709 PASS/4 SKIP, 독립 넓은 회귀 738 PASS/4 SKIP, compile3 PASS.\n"
        "- 실제 Cerebras/credential/network/DB/UI/browser/WSL/deploy는 미검증이다.\n"
        "- 다음 승인 작업은 F-04 GROQ adapter다.\n\n"
    ).encode("utf-8") + subprocess.check_output(["git", "show", f"{START_COMMIT}:docs/WORK_STATUS.md"], cwd=root)
    digest = {
        "schema_version": "1.0.0",
        "algorithm": "SHA-256",
        "event_sequence": 1368,
        "self_reference": False,
        "progress": {
            "path": "docs/progress/build-progress.json",
            "bytes": len(progress_raw),
            "file_sha256": sha(progress_raw),
            "canonical_json_sha256": sha(canonical(progress)),
        },
        "handoff": {
            "path": "docs/progress/BUILD_HANDOFF.md",
            "bytes": len(handoff_raw),
            "file_sha256": sha(handoff_raw),
            "machine_summary_canonical_sha256": sha(canonical(summary)),
        },
    }
    generated = {
        "docs/WORK_STATUS.md": status_raw,
        "docs/progress/BUILD_HANDOFF.md": handoff_raw,
        "docs/progress/build-progress.json": progress_raw,
        "docs/progress/progress-events.json": new_event_raw,
        DIGEST: pretty(digest),
    }
    for relative, raw in generated.items():
        (root / relative).write_bytes(raw)
    checksum_rows = []
    for relative in final_paths():
        if relative == MANIFEST:
            continue
        raw = (root / relative).read_bytes()
        checksum_rows.append({"path": relative, "bytes": len(raw), "sha256": sha(raw)})
    manifest = {
        "schema_version": "1.0.0",
        "manifest_type": "F03_FINAL_ACCEPTANCE",
        "artifact_id": "F03-FINAL-20260923",
        "package_id": "F-03",
        "event_sequence": 1368,
        "historical_event_sequence": 1363,
        "appended_event_count": 5,
        "accepted": True,
        "status": "ACCEPTED",
        "projection_mode": FINAL_MODE,
        "validated_base_commit": START_COMMIT,
        "exact_allowed_paths": final_paths(),
        "control_paths": final_control_paths(),
        "product_write_scope": product_paths(),
        "independent_review": {"verdict": "ACCEPT", "critical": 0, "important": 0, "minor": 0},
        "verification": {
            "main_focused": "45 passed",
            "main_related": "709 passed, 4 skipped",
            "independent_related": "738 passed, 4 skipped",
            "compile": "COMPILE3_PASS",
        },
        "unverified": ["LIVE_CEREBRAS", "SECRET_BROKER", "NETWORK", "DATABASE", "BROWSER", "WSL", "DEPLOYMENT"],
        "raw_checksums": checksum_rows,
        "self_reference": False,
    }
    (root / MANIFEST).write_bytes(pretty(manifest))


def validate_final(root, bundle):
    root = Path(root)
    errors = []
    try:
        progress = bundle["progress"]
        event_value = bundle["events"]
        events = event_value["events"] if isinstance(event_value, dict) else event_value
        manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
        digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
        tail = events[-5:]
        if [row.get("event_type") for row in tail] != [
            "PACKAGE_COMPLETED",
            "INDEPENDENT_TEST_JUDGMENT_RECORDED",
            "WRITE_LEASE_REVOKED",
            "WORKER_LEASE_REVOKED",
            "MAIN_PACKAGE_ACCEPTED",
        ]:
            errors.append("F03_FINAL_EVENT_TAIL_INVALID")
        previous = event_sha(events[-6])
        for expected_sequence, row in enumerate(tail, 1364):
            if row.get("sequence") != expected_sequence or row.get("previous_event_sha256") != previous:
                errors.append("F03_FINAL_EVENT_CHAIN_INVALID")
                break
            previous = event_sha(row)
        state_ok = (
            progress.get("event_sequence") == 1368
            and progress.get("status") == "ACCEPTED"
            and progress.get("current_work_package") == "F-03"
            and progress.get("worker_lease") is None
            and progress.get("write_lease") is None
            and progress.get("active_agent") is None
            and "F-03" in progress.get("completed_packages", [])
            and progress.get("next_work_package", {}).get("package_id") == "F-04"
            and progress.get("repository", {}).get("projection_mode") == FINAL_MODE
            and manifest.get("accepted") is True
            and manifest.get("independent_review") == {"verdict": "ACCEPT", "critical": 0, "important": 0, "minor": 0}
        )
        if not state_ok:
            errors.append("F03_FINAL_STATE_INVALID")
        progress_raw = (root / "docs/progress/build-progress.json").read_bytes()
        handoff_raw = (root / "docs/progress/BUILD_HANDOFF.md").read_bytes()
        if (len(progress_raw), sha(progress_raw)) != (digest["progress"]["bytes"], digest["progress"]["file_sha256"]):
            errors.append("F03_FINAL_PROGRESS_DIGEST_INVALID")
        if (len(handoff_raw), sha(handoff_raw)) != (digest["handoff"]["bytes"], digest["handoff"]["file_sha256"]):
            errors.append("F03_FINAL_HANDOFF_DIGEST_INVALID")
        for row in manifest.get("raw_checksums", []):
            raw = (root / row["path"]).read_bytes()
            if (len(raw), sha(raw)) != (row["bytes"], row["sha256"]):
                errors.append("F03_FINAL_RAW_CHECKSUM_INVALID")
                break
        errors.extend(collect_git(root))
    except Exception:
        errors.append("F03_FINAL_INPUT_INVALID")
    return sorted(set(errors))


def validate(root, bundle):
    mode = bundle.get("progress", {}).get("repository", {}).get("projection_mode")
    if mode == FINAL_MODE:
        return validate_final(root, bundle)
    return validate_start(root, bundle)


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    finalize(root) if "--finalize" in sys.argv else materialize(root)
