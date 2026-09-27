from __future__ import annotations
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()

def sha_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()

def sha_file(path: Path) -> str:
    return sha_bytes(path.read_bytes())

def event_sha(event: dict) -> str:
    return sha_bytes(canonical(event))

def dump(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")

events_path = ROOT / "docs/progress/progress-events.json"
progress_path = ROOT / "docs/progress/build-progress.json"
handoff_path = ROOT / "docs/progress/BUILD_HANDOFF.md"
manifest_path = ROOT / "docs/evidence/manifests/F-20_WSL_FINAL_VALIDATION_MANIFEST.json"
report_path = ROOT / "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md"
current_head = "97adc5cf7070c71b61a5d6902d31cf195329b38f"
existing_progress = json.loads(progress_path.read_text(encoding="utf-8"))
allowed_paths = existing_progress.get("repository", {}).get("exact_allowed_paths", [])

stream = json.loads(events_path.read_text(encoding="utf-8"))
events = stream["events"]
if events[-1]["sequence"] not in (1712, 1714):
    raise SystemExit(f"expected F-20 start at 1712, got {events[-1]['sequence']}")
at = "2026-09-27T17:05:00+09:00"
if events[-1]["sequence"] == 1714:
    for prior in events:
        if prior["sequence"] >= 1689 and prior["event_type"] == "PACKAGE_STARTED":
            prior["details"].setdefault("work_instruction_id", prior["details"].get("work_instruction", prior["subject_ref"]))
            prior["details"].setdefault("package_status", "ACTIVE")
        if prior["sequence"] >= 1689 and prior["event_type"] == "PACKAGE_COMPLETED":
            prior["details"].setdefault("package_status", "ACCEPTED")
            prior["details"].setdefault("accepted", True)
    for index in range(1688, len(events)):
        events[index]["previous_event_sha256"] = event_sha(events[index - 1])

def append(event_type: str, event_id: str, step_id: str, subject_ref: str, details: dict) -> None:
    event = {
        "sequence": events[-1]["sequence"] + 1,
        "event_id": event_id,
        "event_type": event_type,
        "actor": "main-agent-eoul",
        "actor_id": "main-agent-eoul",
        "actor_type": "AGENT",
        "project_id": "anvil",
        "work_package_id": "F-20",
        "run_id": None,
        "step_id": step_id,
        "subject_ref": subject_ref,
        "occurred_at": at,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": event_sha(events[-1]),
        "details": details,
    }
    events.append(event)

if events[-1]["sequence"] == 1712:
    append("PACKAGE_COMPLETED", "evt_f20_1713_package_completed", "F-20_ACCEPTANCE", "F-20", {
        "result_status": "COMPLETED", "package_status": "ACCEPTED", "accepted": True,
        "report": "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md",
        "manifest": "docs/evidence/manifests/F-20_WSL_FINAL_VALIDATION_MANIFEST.json",
        "scope": "WSL-server isolated runtime; Production/ysna-server excluded", "release_decision": "DEFER",
    })
    append("MAIN_PACKAGE_ACCEPTED", "evt_f20_1714_main_package_accepted", "FINAL", "F-20/FINAL", {
        "decision": "ACCEPTED_WSL_SCOPED_DEFERRED_RELEASE", "package_id": "F-20",
        "test_report_ref": "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md",
        "test_report_sha256": sha_file(report_path),
        "manifest_ref": "docs/evidence/manifests/F-20_WSL_FINAL_VALIDATION_MANIFEST.json",
        "manifest_sha256": sha_file(manifest_path), "next_work_package": "HUMAN_RELEASE_DECISION",
        "blocking_findings": 0,
        "unverified": ["PRODUCTION", "YSNA_SERVER", "USER_RELEASE_ACCEPTANCE", "REAL_PROVIDER_CREDENTIAL_CALLS", "LONG_TERM_MONITORING"],
        "validated_base_commit": current_head, "remote_head": current_head,
        "projection_mode": "F20_FINAL_WSL_SCOPED", "head_relation": "BASE_OR_FEATURE_DESCENDANT",
        "exact_allowed_paths": allowed_paths,
    })
stream["last_sequence"] = events[-1]["sequence"]
stream["last_event_id"] = events[-1]["event_id"]
dump(events_path, stream)

progress = json.loads(progress_path.read_text(encoding="utf-8"))
progress["event_sequence"] = 1714
progress["updated_at"] = at
progress["last_event_id"] = events[-1]["event_id"]
progress["status"] = "ACTIVE"
progress["current_work_package"] = "F-20"
if "F-20" not in progress["completed_packages"]:
    progress["completed_packages"].append("F-20")
progress["next_work_package"] = {"package_id": "HUMAN_RELEASE_DECISION", "status": "DEFERRED_BY_PLAN"}
progress["next_successor_work_package"] = {"package_id": "HUMAN_RELEASE_DECISION", "status": "DEFERRED_BY_PLAN"}
progress["next_safe_action"] = "HUMAN_RELEASE_DECISION_DEFERRED"
wi = {
    "artifact_id": "WI-F-20-WSL-FINAL-20260927-001",
    "path": "docs/work_orders/F-20_WSL_FINAL_VALIDATION_WORK_INSTRUCTION.md",
    "sha256": sha_file(ROOT / "docs/work_orders/F-20_WSL_FINAL_VALIDATION_WORK_INSTRUCTION.md"),
    "revision_classification": "MAIN_INTERNAL_DEVELOPMENT_WSL_VALIDATION",
    "result_status": "COMPLETED", "package_status": "ACCEPTED",
    "accepted_event_id": "evt_f20_1714_main_package_accepted", "release_decision": "DEFER",
}
progress["active_work_instruction"] = wi
progress["last_accepted_work_instruction"] = wi
progress["current_progress_evidence_ref"] = {
    "package_id": "F-20",
    "path": "docs/progress/progress-handoff-detached-digest-f20-wsl-final.json",
    "manifest_path": "docs/evidence/manifests/F-20_WSL_FINAL_VALIDATION_MANIFEST.json",
}
progress["repository"]["projection_mode"] = "F20_FINAL_WSL_SCOPED"
progress["repository"]["local_head"] = current_head
progress["repository"]["remote_head"] = current_head
progress["repository"]["validated_base_commit"] = current_head
progress["repository"]["head_relation"] = "BASE_OR_FEATURE_DESCENDANT"
progress["repository"]["worktree_status"] = "F20_COMPLETED_WSL_SCOPED"
progress["repository"]["commit_status"] = "PENDING"
progress["repository"]["push_status"] = "PENDING"
progress["registry_refs"]["progress_events"]["sha256"] = sha_file(events_path)
progress["registry_refs"]["progress_event_contract"]["sha256"] = sha_file(ROOT / "docs/progress/progress-event-contract.json")
material = dict(progress)
material.pop("snapshot_hash", None)
progress["snapshot_hash"] = sha_bytes(canonical(material))
dump(progress_path, progress)
handoff = {"event_sequence": 1714, "last_event_id": "evt_f20_1714_main_package_accepted", "status": "ACTIVE", "current_work_package": "F-20", "worker_lease": None, "write_lease": None, "next_safe_action": "HUMAN_RELEASE_DECISION_DEFERRED"}
handoff.update({
    "design_baseline_hash": progress["design_baseline_hash"],
    "valid_failure_count": progress["valid_failure_count"],
    "dir_status": progress["dir_review"]["status"],
    "repository_head": progress["repository"]["local_head"],
    "repository_upstream": progress["repository"]["upstream"],
    "reporting_decision": progress["reporting_decision"]["decision"],
})
handoff_path.write_text("# F-20 WSL final validation accepted (WSL scoped; ReleaseDecision DEFER)\n\n```json anvil-recovery-summary\n" + json.dumps(handoff, ensure_ascii=False, indent=2) + "\n```\n", encoding="utf-8")

digest = {
    "schema_version": "1.0.0", "digest_id": "G-05-PROGRESS-HANDOFF-DIGEST-F20-WSL-FINAL", "event_sequence": 1714, "algorithm": "SHA-256",
    "progress": {"path": "docs/progress/build-progress.json", "bytes": progress_path.stat().st_size, "file_sha256": sha_file(progress_path), "canonical_json_sha256": sha_bytes(canonical(progress))},
    "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": handoff_path.stat().st_size, "file_sha256": sha_file(handoff_path), "machine_summary_canonical_sha256": sha_bytes(canonical(handoff))},
    "created_at": at,
}
dump(ROOT / "docs/progress/progress-handoff-detached-digest-f20-wsl-final.json", digest)

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
rows = [row for row in manifest.get("raw_checksums", []) if row.get("path") != "docs/progress/progress-handoff-detached-digest-f20-wsl-final.json"]
digest_path = ROOT / "docs/progress/progress-handoff-detached-digest-f20-wsl-final.json"
rows.append({"path": "docs/progress/progress-handoff-detached-digest-f20-wsl-final.json", "bytes": digest_path.stat().st_size, "sha256": sha_file(digest_path)})
manifest["raw_checksums"] = rows
dump(manifest_path, manifest)
events[-1]["details"]["manifest_sha256"] = sha_file(manifest_path)
stream["last_event_id"] = events[-1]["event_id"]
dump(events_path, stream)
progress["registry_refs"]["progress_events"]["sha256"] = sha_file(events_path)
material = dict(progress)
material.pop("snapshot_hash", None)
progress["snapshot_hash"] = sha_bytes(canonical(material))
dump(progress_path, progress)
digest = json.loads(digest_path.read_text(encoding="utf-8"))
digest["progress"] = {"path": "docs/progress/build-progress.json", "bytes": progress_path.stat().st_size, "file_sha256": sha_file(progress_path), "canonical_json_sha256": sha_bytes(canonical(progress))}
dump(digest_path, digest)
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["raw_checksums"] = [row if row.get("path") != "docs/progress/progress-handoff-detached-digest-f20-wsl-final.json" else {"path": row["path"], "bytes": digest_path.stat().st_size, "sha256": sha_file(digest_path)} for row in manifest.get("raw_checksums", [])]
dump(manifest_path, manifest)
