"""F-10 start/final progress projection and structural Git validation."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from copy import deepcopy
from pathlib import Path


BASE = "acbef2720228cc8d509afa3f36aca7e75731d38e"
BRANCH = "codex/f10-openai-adapter"
START_MODE = "F10_START_EXACT11_PRODUCT_EXACT5"
FINAL_MODE = "F10_FINAL_ACCEPTANCE_EXACT17"
AT = "2026-09-24T02:25:00+09:00"
FINAL_AT = "2026-09-24T02:44:00+09:00"
EXPIRES = "2026-09-24T14:25:00+09:00"
ACTOR = "developer-primary-f10-r1"
WORKER = "worker-lease-f10-r1-20260924-001"
WRITE = "write-lease-f10-r1-20260924-001"
EXECUTION_TOKEN = "f10-r1-execution-fence-epoch-1-acbef2720228cc8d"
WRITE_TOKEN = "f10-r1-write-fence-epoch-1-509afa3f36aca7e7"
WI = "docs/work_orders/F-10_WORK_INSTRUCTION.md"
PROMPT = "docs/work_orders/F-10_INVOCATION_PROMPT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f10.json"
MANIFEST = "docs/evidence/manifests/F-10_PROGRESS_MANIFEST.json"
REVIEW = "docs/04_test_reports/F-10_INDEPENDENT_REVIEW.md"


def product_paths():
    return sorted([
        "packages/providers/openai_adapter.py",
        "packages/providers/openai_errors.py",
        "packages/providers/openai_models.py",
        "tests/providers/test_openai_adapter_f10.py",
        "docs/04_test_reports/F-10_COMPLETION_REPORT.md",
    ])


def control_paths():
    return sorted([
        WI, PROMPT, "docs/WORK_STATUS.md", MANIFEST,
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json", DIGEST,
        "scripts/check_project_progress.py", "scripts/f10_progress_overlay.py",
        "tests/tooling/test_f10_progress_overlay.py",
    ])


def final_paths():
    return sorted(control_paths() + [REVIEW] + product_paths())


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def _pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def _sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def _event_sha(event):
    return _sha(_canonical(event))


def _append(events, event_type, details, *, step="START"):
    sequence = events[-1]["sequence"] + 1
    row = {
        "sequence": sequence,
        "event_id": f"evt_f10_{sequence}_{event_type.lower()}",
        "event_type": event_type,
        "actor": "main-agent-eoul",
        "actor_id": "main-agent-eoul",
        "actor_type": "AGENT",
        "project_id": "anvil",
        "work_package_id": "F-10",
        "run_id": None,
        "step_id": step,
        "subject_ref": f"F-10/{step}",
        "occurred_at": FINAL_AT if step == "FINAL" else AT,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": _event_sha(events[-1]),
        "details": details,
    }
    events.append(row)
    return row


def _lease(kind):
    common = {
        "lease_id": WORKER if kind == "worker" else WRITE,
        "actor_id": ACTOR,
        "subject_ref": "F-10",
        "status": "ACTIVE",
        "issued_at": AT,
        "expires_at": EXPIRES,
        "lease_epoch": 1,
        "fencing_token": EXECUTION_TOKEN if kind == "worker" else WRITE_TOKEN,
        "execution_fencing_token": EXECUTION_TOKEN,
        "baseline_git_commit": BASE,
        "dispatch_head": BASE,
        "path_scope": product_paths(),
    }
    if kind == "write":
        common.update({"worker_lease_id": WORKER, "write_epoch": 1,
                       "write_fencing_token": WRITE_TOKEN})
    return common


def _repository(mode):
    return {
        "branch": BRANCH,
        "local_head": BASE,
        "upstream": f"development/{BRANCH}",
        "remote_head": BASE,
        "projection_mode": mode,
        "validated_base_commit": BASE,
        "head_relation": "BASE_OR_FEATURE_DESCENDANT_OR_STRUCTURAL_MERGED_MAIN",
        "exact_allowed_paths": control_paths() if mode == START_MODE else final_paths(),
        "product_write_scope": product_paths(),
        "worktree_status": "F10_ACTIVE" if mode == START_MODE else "F10_ACCEPTED",
        "commit_status": "PENDING" if mode == START_MODE else "FINAL_PENDING_OR_COMPLETE",
        "push_status": "BRANCH_PUBLISHED",
    }


def _summary(progress):
    return {key: deepcopy(progress.get(key)) for key in (
        "event_sequence", "last_event_id", "status", "current_phase",
        "current_work_package", "active_agent", "worker_lease", "write_lease",
        "next_work_package", "next_safe_action", "runtime_next_action",
    )}


def _write_projection(root, progress, ledger, *, heading, status_lines, accepted):
    base_event_raw = subprocess.check_output(
        ["git", "show", f"{BASE}:docs/progress/progress-events.json"], cwd=root
    )
    base_ledger = json.loads(base_event_raw)
    old_id = base_ledger["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    appended = [row for row in ledger["events"] if row.get("sequence", 0) > 1417]
    if base_event_raw.count(marker) != 1 or not appended:
        raise RuntimeError("F10_EVENT_APPEND_BASE_INVALID")
    event_raw = base_event_raw.replace(
        marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in appended)
        + marker.replace(old_id, ledger["last_event_id"].encode()),
    ).replace(b'"last_sequence": 1417',
              f'"last_sequence": {ledger["last_sequence"]}'.encode(), 1)
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)
    }
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    summary = _summary(progress)
    handoff_raw = (f"# {heading}\n\n```json anvil-recovery-summary\n".encode("utf-8")
                   + _pretty(summary) + b"```\n")
    previous_status = subprocess.check_output(["git", "show", f"{BASE}:docs/WORK_STATUS.md"], cwd=root)
    status_raw = (f"# {heading}\n\n" + "\n".join(f"- {line}" for line in status_lines)
                  + "\n\n").encode("utf-8") + previous_status
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    digest = {
        "schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": progress["event_sequence"], "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": _sha(handoff_raw)},
    }
    (root / DIGEST).write_bytes(_pretty(digest))
    checksum_paths = [WI, PROMPT, "docs/WORK_STATUS.md", "docs/progress/progress-events.json",
                      "scripts/check_project_progress.py", "scripts/f10_progress_overlay.py",
                      "tests/tooling/test_f10_progress_overlay.py"]
    if accepted:
        checksum_paths += product_paths() + [REVIEW]
    rows = []
    for relative in sorted(set(checksum_paths)):
        raw = (root / relative).read_bytes()
        rows.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    manifest = {
        "schema_version": "1.0.0", "package_id": "F-10",
        "event_sequence": progress["event_sequence"], "accepted": accepted,
        "projection_mode": progress["repository"]["projection_mode"],
        "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths() if not accepted else final_paths(),
        "product_write_scope": product_paths(), "raw_checksums": rows,
        "runtime_boundary": {
            "live_openai": "NOT_EXECUTED", "network": "NOT_EXECUTED",
            "credentials": "NOT_EXECUTED", "database": "NOT_EXECUTED",
            "browser": "NOT_EXECUTED", "wsl": "NOT_EXECUTED", "deployment": "NOT_EXECUTED",
        },
        "independent_review": (None if not accepted else {"verdict": "ACCEPT", "critical": 0,
                                                      "important": 0, "minor": 0}),
        "self_reference": False,
    }
    (root / MANIFEST).write_bytes(_pretty(manifest))


def materialize(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence") == 1420 and progress.get("repository", {}).get("projection_mode") == START_MODE:
        progress = json.loads(subprocess.check_output(
            ["git", "show", f"{BASE}:docs/progress/build-progress.json"], cwd=root
        ))
        ledger = json.loads(subprocess.check_output(
            ["git", "show", f"{BASE}:docs/progress/progress-events.json"], cwd=root
        ))
    events = ledger["events"]
    if progress.get("event_sequence") != 1417 or events[-1].get("sequence") != 1417:
        raise RuntimeError("F10_BASE_PROGRESS_INVALID")
    worker, write = _lease("worker"), _lease("write")
    _append(events, "PACKAGE_STARTED", {"package_id": "F-10", "branch": BRANCH,
             "base_commit": BASE, "work_instruction": WI, "product_paths": product_paths()})
    _append(events, "WORKER_LEASE_ISSUED", {"lease_id": WORKER,
             "execution_fencing_token": EXECUTION_TOKEN, "actor_id": ACTOR})
    last = _append(events, "WRITE_LEASE_ISSUED", {"lease_id": WRITE,
             "worker_lease_id": WORKER, "write_fencing_token": WRITE_TOKEN,
             "path_scope": product_paths()})
    ledger.update({"last_sequence": last["sequence"], "last_event_id": last["event_id"]})
    progress.update({
        "snapshot_id": "snapshot-f10-start-seq1420", "event_sequence": 1420,
        "last_event_id": last["event_id"], "updated_at": AT, "recorded_at": AT,
        "current_phase": "F", "current_work_package": "F-10", "status": "ACTIVE",
        "active_agent": ACTOR, "worker_lease": worker, "write_lease": write,
        "active_work_instruction": {"artifact_id": "WI-F-10-20260924-001", "path": WI,
            "sha256": _sha((root / WI).read_bytes()), "invocation_path": PROMPT,
            "invocation_sha256": _sha((root / PROMPT).read_bytes()),
            "assigned_verification_ids": ["AV-OPS-010", "AV-OPS-011", "AV-FLOW-019(OPENAI)"]},
        "repository": _repository(START_MODE),
        "next_work_package": {"package_id": "F-11", "status": "BLOCKED_PENDING_F10_ACCEPTANCE"},
        "next_successor_work_package": {"package_id": "F-11", "status": "BLOCKED_PENDING_F10_ACCEPTANCE"},
        "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F10_EXACT5",
        "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F10_EXACT5",
        "reporting_decision": {"decision": "AUTO_CONTINUE", "reason_codes": ["F10_APPROVED_SCOPE"],
                               "stop_before_dialogue_report": False},
        "current_progress_evidence_ref": {"package_id": "F-10", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    _write_projection(root, progress, ledger, heading="F-10 OPENAI adapter 시작",
        status_lines=["판정: `ACTIVE`; 승인된 F-10 host-only exact5 구현을 시작한다.",
                      f"branch/base: `{BRANCH}` / `{BASE}`.",
                      "제어 테스트 임시 경로: `D:\\Project\\Anvil\\.codex-sandbox\\.f10-control-20260924a`; F-10 overlay 테스트 동안만 사용하고 실행 직후 경로 확인 후 삭제한다.",
                      "실제 OPENAI·network·credential·DB·browser·WSL·deploy는 실행하지 않는다."],
        accepted=False)


def finalize(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence") == 1425 and progress.get("repository", {}).get("projection_mode") == FINAL_MODE:
        current_head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
        head_progress = json.loads(subprocess.check_output(
            ["git", "show", f"{current_head}:docs/progress/build-progress.json"], cwd=root
        ))
        start_ref = current_head if head_progress.get("event_sequence") == 1420 else subprocess.check_output(
            ["git", "rev-parse", "HEAD^"], cwd=root, text=True
        ).strip()
        progress = json.loads(subprocess.check_output(
            ["git", "show", f"{start_ref}:docs/progress/build-progress.json"], cwd=root
        ))
        ledger = json.loads(subprocess.check_output(
            ["git", "show", f"{start_ref}:docs/progress/progress-events.json"], cwd=root
        ))
    events = ledger["events"]
    if progress.get("event_sequence") != 1420 or events[-1].get("sequence") != 1420:
        raise RuntimeError("F10_START_PROGRESS_INVALID")
    old_worker, old_write = deepcopy(progress["worker_lease"]), deepcopy(progress["write_lease"])
    _append(events, "PACKAGE_COMPLETED", {"package_id": "F-10", "product_paths": product_paths(),
             "focused": "36_PASSED", "related_provider_regression": "630_PASSED_4_SKIPPED_PG18_DSN",
             "compile": "AST_4_OK"}, step="FINAL")
    _append(events, "INDEPENDENT_TEST_JUDGMENT_RECORDED", {"verdict": "ACCEPT",
             "critical": 0, "important": 0, "minor": 0, "report": REVIEW}, step="FINAL")
    _append(events, "WRITE_LEASE_REVOKED", {"lease_id": WRITE, "reason": "F10_ACCEPTED"}, step="FINAL")
    _append(events, "WORKER_LEASE_REVOKED", {"lease_id": WORKER, "reason": "F10_ACCEPTED"}, step="FINAL")
    last = _append(events, "MAIN_PACKAGE_ACCEPTED", {"decision": "ACCEPTED",
        "package_id": "F-10", "next_work_package": "F-11", "blocking_findings": 0,
        "unverified": ["LIVE_OPENAI", "CREDENTIALS", "NETWORK", "DATABASE", "BROWSER", "WSL", "DEPLOYMENT"]}, step="FINAL")
    ledger.update({"last_sequence": last["sequence"], "last_event_id": last["event_id"]})
    old_worker.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    old_write.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    completed = list(progress.get("completed_packages", []))
    if "F-10" not in completed:
        completed.append("F-10")
    progress.update({
        "snapshot_id": "snapshot-f10-final-seq1425", "event_sequence": 1425,
        "last_event_id": last["event_id"], "updated_at": FINAL_AT, "recorded_at": FINAL_AT,
        "current_work_package": "F-10", "status": "ACCEPTED", "completed_packages": completed,
        "active_agent": None, "worker_lease": None, "write_lease": None,
        "completed_f10_worker_lease": old_worker, "completed_f10_write_lease": old_write,
        "last_accepted_work_instruction": deepcopy(progress.get("active_work_instruction")),
        "active_work_instruction": None, "repository": _repository(FINAL_MODE),
        "f10_acceptance": {
            "status": "ACCEPTED",
            "independent_review": "ACCEPT_C0_I0_M0",
            "focused": "36_PASSED",
            "related_regression": "630_PASSED_4_SKIPPED_PG18_DSN",
            "resolved_findings": ["QUOTA_CLASSIFICATION_PRECEDES_RETRY_AFTER",
                                  "RESPONSES_SEMANTIC_EVENT_FAIL_CLOSED"],
            "unverified": ["LIVE_OPENAI", "CREDENTIALS", "NETWORK", "DATABASE",
                           "BROWSER", "WSL", "DEPLOYMENT"],
        },
        "next_work_package": {"package_id": "F-11", "status": "READY_FOR_WORK_INSTRUCTION"},
        "next_successor_work_package": {"package_id": "F-11", "status": "READY_FOR_WORK_INSTRUCTION"},
        "next_safe_action": "MERGE_F10_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "runtime_next_action": "MERGE_F10_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "reporting_decision": {"decision": "AUTO_CONTINUE", "reason_codes": ["F10_ACCEPTED", "F10_APPROVED_SCOPE"],
                               "stop_before_dialogue_report": False},
    })
    _write_projection(root, progress, ledger, heading="F-10 OPENAI adapter 완료",
        status_lines=["판정: `ACCEPTED`; 독립 재검토 Critical 0/Important 0/Minor 0, 제품 exact5를 인수한다.",
                      "focused 36 PASS, 관련 회귀 630 PASS/4 SKIP(PG18 DSN), AST 4 OK.",
                      "Main 재검증: 관련 회귀와 control 합산 637 PASS/4 SKIP, exit 0; 임시 `.f10-main-final-20260924a` 정리 확인.",
                      "독립 검토 재작업 1회(Important 2건 해결), 정식 `FAILURE_REPORT` 0회; control 테스트 7 PASS, 임시 `.f10-control-20260924a` 정리 확인.",
                      "잔여 제약: 기존 Gateway 문자열 계약상 선행·후행 공백 출력은 `OUTPUT_TEXT_NON_CANONICAL`로 거부된다.",
                      "실제 OPENAI·network·credential·DB·browser·WSL·deploy는 `NOT_EXECUTED`.",
                      "다음 조치: 동일 브랜치를 PR 병합한 뒤 branch/worktree를 삭제한다."],
        accepted=True)


def validate_start_git_facts(*, head, branch, upstream, remote_head, staged, dirty, parents, changed):
    common = branch == BRANCH and upstream == f"development/{BRANCH}" and not staged
    pre = head == BASE and remote_head == BASE and set(dirty) == set(control_paths())
    post = (head != BASE and parents == [BASE] and remote_head in {BASE, head}
            and set(changed) == set(control_paths()) and set(dirty) <= set(product_paths()))
    return [] if common and (pre or post) else ["F10_START_GIT_INVALID"]


def validate_final_git_facts(*, head, branch, upstream, remote_head, staged, dirty, parents, changed,
                             base_is_ancestor, feature_paths, merge_tree_matches_feature,
                             remote_is_ancestor=False):
    expected = set(final_paths())
    feature = (branch == BRANCH and upstream == f"development/{BRANCH}"
               and (remote_head in {BASE, head} or remote_is_ancestor)
               and not staged and not dirty and base_is_ancestor and set(feature_paths) == expected)
    merged = (branch == "main" and upstream == "development/main" and remote_head == head
              and not staged and not dirty and len(parents) == 2 and parents[0] == BASE
              and base_is_ancestor and set(feature_paths) == expected and merge_tree_matches_feature)
    return [] if feature or merged else ["F10_FINAL_GIT_INVALID"]


def collect_git(root):
    root = Path(root)
    run = lambda *args: subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root, text=True).strip()
    head = run("rev-parse", "HEAD")
    branch = run("branch", "--show-current")
    try: upstream = run("rev-parse", "--abbrev-ref", "@{upstream}")
    except subprocess.CalledProcessError: upstream = ""
    remote_ref = "development/main" if branch == "main" else f"development/{BRANCH}"
    try: remote_head = run("rev-parse", remote_ref)
    except subprocess.CalledProcessError: remote_head = ""
    staged = set(filter(None, run("diff", "--cached", "--name-only").splitlines()))
    dirty = set()
    status_raw = subprocess.check_output(
        ["git", "-c", "core.excludesFile=", "status", "--porcelain=v1", "--untracked-files=all"],
        cwd=root, text=True,
    )
    for line in status_raw.splitlines():
        if line: dirty.add(line[3:].replace("\\", "/"))
    parents = run("show", "-s", "--format=%P", head).split()
    changed = set(filter(None, run("diff", "--name-only", f"{BASE}..{head}").splitlines()))
    base_is_ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head], cwd=root).returncode == 0
    remote_is_ancestor = bool(remote_head) and subprocess.run(
        ["git", "merge-base", "--is-ancestor", remote_head, head], cwd=root
    ).returncode == 0
    feature_paths = changed
    tree_match = False
    if branch == "main" and len(parents) == 2:
        feature = parents[1]
        feature_paths = set(filter(None, run("diff", "--name-only", f"{BASE}..{feature}").splitlines()))
        tree_match = run("rev-parse", f"{head}^{{tree}}") == run("rev-parse", f"{feature}^{{tree}}")
        base_is_ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", BASE, feature], cwd=root).returncode == 0
    mode = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))["repository"]["projection_mode"]
    args = dict(head=head, branch=branch, upstream=upstream, remote_head=remote_head,
                staged=staged, dirty=dirty, parents=parents, changed=changed)
    if mode == START_MODE:
        return validate_start_git_facts(**args)
    return validate_final_git_facts(**args, base_is_ancestor=base_is_ancestor,
        feature_paths=feature_paths, merge_tree_matches_feature=tree_match,
        remote_is_ancestor=remote_is_ancestor)


def validate(root, bundle):
    root = Path(root)
    progress = bundle["progress"]
    event_value = bundle["events"]
    events = event_value["events"] if isinstance(event_value, dict) else event_value
    mode = progress.get("repository", {}).get("projection_mode")
    accepted = mode == FINAL_MODE
    errors = []
    expected_sequence = 1425 if accepted else 1420
    expected_status = "ACCEPTED" if accepted else "ACTIVE"
    if progress.get("event_sequence") != expected_sequence or events[-1].get("sequence") != expected_sequence:
        errors.append("F10_EVENT_SEQUENCE_INVALID")
    if progress.get("current_work_package") != "F-10" or progress.get("status") != expected_status:
        errors.append("F10_STATE_INVALID")
    if accepted:
        if any((progress.get("active_agent") is not None, progress.get("worker_lease") is not None,
                progress.get("write_lease") is not None, "F-10" not in progress.get("completed_packages", []),
                progress.get("next_work_package", {}).get("package_id") != "F-11")):
            errors.append("F10_FINAL_STATE_INVALID")
    else:
        if any((progress.get("active_agent") != ACTOR, progress.get("worker_lease", {}).get("lease_id") != WORKER,
                progress.get("write_lease", {}).get("lease_id") != WRITE)):
            errors.append("F10_START_STATE_INVALID")
    for previous, current in zip(events[-(5 if accepted else 3):], events[-(5 if accepted else 3)+1:]):
        if current.get("previous_event_sha256") != _event_sha(previous):
            errors.append("F10_EVENT_CHAIN_INVALID")
            break
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (len(raw), _sha(raw)) != (digest[key]["bytes"], digest[key]["file_sha256"]):
            errors.append("F10_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if manifest.get("accepted") is not accepted or manifest.get("exact_allowed_paths") != (final_paths() if accepted else control_paths()):
        errors.append("F10_MANIFEST_STATE_INVALID")
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (len(raw), _sha(raw)) != (row["bytes"], row["sha256"]):
            errors.append("F10_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


if __name__ == "__main__":
    project = Path(__file__).resolve().parents[1]
    finalize(project) if "--finalize" in sys.argv else materialize(project)
