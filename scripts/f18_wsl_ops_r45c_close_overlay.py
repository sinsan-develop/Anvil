"""Fail-closed R45C Main-only QA close and worker lease revocation."""

from copy import deepcopy
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path

try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha

MODE = "F18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_CLOSE"
BRANCH = "codex/f18-wsl-ops"
WORKER = "worker-lease-f18-wsl-ops-r45c-20260927-001"
ACTOR = "main-agent-eoul"
PREVIOUS_MODE = "F18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_START"
PLAN = "docs/work_orders/F-18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_PLAN.md"
WI = "docs/work_orders/F-18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_INVOCATION.md"
REPORT = "docs/04_test_reports/F-18_R45C_ROLLBACK_ARTIFACT_AUDIT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f18-wsl-ops-r45c.json"
START_MANIFEST = "docs/evidence/manifests/F-18_WSL_OPS_R45C_START_MANIFEST.json"
SELF = "scripts/f18_wsl_ops_r45c_close_overlay.py"
TEST = "tests/tooling/test_f18_wsl_ops_r45c_close_overlay.py"
CLOSE_MANIFEST = "docs/evidence/manifests/F-18_WSL_OPS_R45C_CLOSE_MANIFEST.json"


def control_paths():
    return sorted({PLAN, WI, INVOCATION, REPORT, DIGEST, START_MANIFEST, SELF, TEST,
                   "docs/evidence/manifests/F-18_WSL_OPS_R45C_CLOSE_MANIFEST.json",
                   "docs/WORK_STATUS.md", "docs/progress/build-progress.json",
                   "docs/progress/progress-events.json", "docs/progress/BUILD_HANDOFF.md",
                   "scripts/check_project_progress.py"} | {
        "docs/evidence/f18_r45c/old-qa-config-revision.json",
        "docs/evidence/f18_r45c/old-qa-evidence.json",
        "docs/evidence/f18_r45c/old-qa-release-manifest.json",
        "docs/evidence/f18_r45c/old-qa-sbom.json",
        "docs/evidence/f18_r45c/old-qa-verification.json",
        "docs/evidence/f18_r45c/new-qa-config-revision.json",
        "docs/evidence/f18_r45c/new-qa-evidence.json",
        "docs/evidence/f18_r45c/new-qa-release-manifest.json",
        "docs/evidence/f18_r45c/new-qa-sbom.json",
        "docs/evidence/f18_r45c/new-qa-verification.json",
        "docs/evidence/f18_r45c/qa-public-key.pem",
    })


def materialize(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    repo = progress.get("repository") or {}
    if (progress.get("event_sequence") != 1680 or repo.get("projection_mode") != PREVIOUS_MODE
            or (progress.get("worker_lease") or {}).get("lease_id") != WORKER
            or progress.get("write_lease") is not None
            or ledger.get("last_sequence") != 1680):
        raise RuntimeError("F18_R45C_CLOSE_PRECONDITION_INVALID")
    rows, old_id = ledger["events"], progress["last_event_id"]
    at = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")
    last = _event(rows, "WORKER_LEASE_REVOKED", {
        "lease_id": WORKER,
        "reason": "R45C_QA_RESIDUE_ZERO_ROLLBACK_PARTIAL_F18_PENDING",
        "tested_git_sha": _run(root, "rev-parse", "HEAD"),
        "resource_residue": 0,
        "rollback_code_container": "REWORK_REQUIRED",
        "restore_head": "0016_operations_recovery",
        "public_qa_head": repo.get("control_qa_head"),
    }, at=at, step="WSL_OPS_R45C_ROLLBACK_REHEARSAL_CLOSE")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(), old_id, 1680, rows[-1:])
    progress.update({"snapshot_id": "snapshot-f18-wsl-ops-r45c-close-seq1681", "event_sequence": 1681,
        "last_event_id": last["event_id"], "updated_at": at, "recorded_at": at,
        "status": "ACTIVE", "active_agent": ACTOR, "worker_lease": None, "write_lease": None,
        "next_safe_action": "REVIEW_F18_R45C_PARTIAL_REHEARSAL", "runtime_next_action": "REVIEW_F18_R45C_PARTIAL_REHEARSAL"})
    repo.update({"projection_mode": MODE, "worktree_status": "F18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_CLOSED",
                 "commit_status": "PENDING", "push_status": "PENDING", "product_write_scope": []})
    progress["repository"] = repo
    progress["registry_refs"]["progress_events"] = {"path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress); snapshot.pop("snapshot_hash", None); progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-18 WSL R45C rollback rehearsal QA closed\n\n```json anvil-recovery-summary\n" +
                   _pretty({k: deepcopy(progress.get(k)) for k in ("event_sequence", "last_event_id", "status", "current_work_package", "active_agent", "worker_lease", "write_lease", "next_safe_action", "runtime_next_action")}) +
                   b"```\n\n- QA residue zero; data restore PASS; code/container rollback REWORK_REQUIRED; F-18 accepted=false; Production NOT_EXECUTED.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 1681, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw), "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw), "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    excluded = {"docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, CLOSE_MANIFEST}
    for relative in sorted(set(control_paths()) - excluded):
        raw = (root / relative).read_bytes(); checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    manifest = {"schema_version": "1.0.0", "package_id": "F-18", "event_sequence": 1681,
                "accepted": False, "projection_mode": MODE, "product_write_scope": [],
                "raw_checksums": checksums, "self_reference": False, "production": "NOT_EXECUTED"}
    (root / CLOSE_MANIFEST).write_bytes(_pretty(manifest))


def collect_git(root):
    root = Path(root)
    import subprocess
    errors = []
    if subprocess.check_output(["git", "branch", "--show-current"], cwd=root, text=True).strip() != BRANCH:
        errors.append("F18_R45C_CLOSE_BRANCH_INVALID")
    if subprocess.check_output(["git", "status", "--porcelain=v1", "--untracked-files=all"], cwd=root, text=True).strip():
        errors.append("F18_R45C_CLOSE_DIRTY")
    return errors


def validate(root, bundle):
    progress = bundle.get("progress") or {}
    repo = progress.get("repository") or {}
    rows = (bundle.get("events") or {}).get("events") or []
    errors = []
    if progress.get("event_sequence") != 1681 or progress.get("worker_lease") is not None:
        errors.append("F18_R45C_CLOSE_STATE_INVALID")
    if repo.get("projection_mode") != MODE or len(rows) < 1681 or rows[-1].get("event_type") != "WORKER_LEASE_REVOKED":
        errors.append("F18_R45C_CLOSE_EVENT_INVALID")
    manifest_path = Path(root) / CLOSE_MANIFEST
    if not manifest_path.exists():
        errors.append("F18_R45C_CLOSE_MANIFEST_MISSING")
    else:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("event_sequence") != 1681 or manifest.get("projection_mode") != MODE:
            errors.append("F18_R45C_CLOSE_MANIFEST_INVALID")
        for item in manifest.get("raw_checksums", []):
            raw = (Path(root) / item["path"]).read_bytes()
            if (len(raw), _sha(raw)) != (item.get("bytes"), item.get("sha256")):
                errors.append("F18_R45C_CLOSE_RAW_CHECKSUM_INVALID")
                break
    return sorted(set(errors)) + collect_git(root)


def _run(root, *args):
    import subprocess
    return subprocess.check_output(["git", *args], cwd=root, text=True).strip()


if __name__ == "__main__":
    import sys
    materialize(sys.argv[1] if len(sys.argv) > 1 else ".")
