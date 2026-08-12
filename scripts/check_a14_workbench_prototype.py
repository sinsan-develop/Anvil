"""Validate the exact A-14 clickable fixture Workbench evidence set."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

try:
    from scripts.evidence_portability import portable_hash, portable_row_matches
except ModuleNotFoundError:  # direct `python scripts/check_*.py`
    from evidence_portability import portable_hash, portable_row_matches

EXACT_PATHS = [
    "apps/web/index.html","apps/web/server.mjs","apps/web/src/app/workbench.js","apps/web/src/api/workbench-client.js","apps/web/src/features/workbench/workbench-state.js","apps/web/src/styles/workbench.css","apps/web/tests/workbench.test.mjs","tests/browser/a14/workbench-runtime.test.mjs","tests/fixtures/a14/workbench-fixtures.json","tests/fixtures/a14/hostile-inputs.json","scripts/check_a14_workbench_prototype.py","tests/tooling/test_a14_workbench_prototype.py","docs/architecture/a14/A-14_WORKBENCH_PROTOTYPE.md","docs/architecture/a14/A-14_WORKBENCH_CONTRACT.json","docs/validation/A-14_WORKBENCH_PROTOTYPE_VALIDATION.md","docs/evidence/manifests/A-14_EVIDENCE_MANIFEST.json","docs/completion_reports/A-14_COMPLETION_REPORT.md"
]

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()

def target_hash(root: Path, paths: list[str]) -> str:
    material = "".join(f"{path}\0{portable_hash(root, path)}\n" for path in paths)
    return hashlib.sha256(material.encode()).hexdigest().upper()

def browser_source_findings(paths: list[Path]) -> list[str]:
    findings=[]
    forbidden=re.compile(r"https?://|localhost|127\.0\.0\.1|NEXT_PUBLIC_|host\.docker|container",re.I)
    fetches=re.compile(r"(?:fetchImpl|fetch)\(([^,)]+)")
    for path in paths:
        text=path.read_text(encoding="utf-8")
        if forbidden.search(text): findings.append(f"internal-address:{path.as_posix()}")
        for match in fetches.finditer(text):
            literal=match.group(1).strip().strip("'\"")
            if literal.startswith(("/api/","apiPath(")) or match.group(1).strip().startswith("apiPath("): continue
            findings.append(f"non-relative-fetch:{path.as_posix()}")
    return findings


def _tracked_clean(root: Path, relative: str) -> bool:
    tracked = subprocess.run(
        ["git", "ls-files", "--error-unmatch", "--", relative],
        cwd=root,
        capture_output=True,
        check=False,
    )
    dirty = subprocess.run(
        ["git", "status", "--porcelain=v1", "--", relative],
        cwd=root,
        capture_output=True,
        check=False,
    )
    return tracked.returncode == 0 and dirty.returncode == 0 and not dirty.stdout.strip()

def check(root: Path) -> dict:
    errors=[]
    missing=[path for path in EXACT_PATHS if not (root/path).is_file()]
    if missing: errors.append(f"missing:{','.join(missing)}")
    manifest={"paths":[],"self_reference":None}
    manifest_path=root/"docs/evidence/manifests/A-14_EVIDENCE_MANIFEST.json"
    if manifest_path.is_file():
        manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("paths") != EXACT_PATHS: errors.append("manifest-exact-paths")
        if manifest.get("self_reference") is not False: errors.append("manifest-self-reference")
        raw=manifest.get("raw_checksums",{})
        if set(raw) != set(EXACT_PATHS)-{manifest_path.relative_to(root).as_posix()}: errors.append("manifest-raw-set")
        else:
            successor_rows = {}
            completion_r3_path = root / "docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R3.json"
            if completion_r3_path.is_file():
                completion_r3 = json.loads(completion_r3_path.read_text(encoding="utf-8"))
                successor = completion_r3.get("a14_successor_projection", {})
                if successor.get("predecessor_manifest_sha256") == "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8":
                    successor_rows = {row.get("path"): row for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
            takeover_completion_path = root / "docs/evidence/manifests/A-14_MAIN_TAKEOVER_COMPLETION_MANIFEST_R4.json"
            if takeover_completion_path.is_file():
                takeover_completion = json.loads(takeover_completion_path.read_text(encoding="utf-8"))
                successor = takeover_completion.get("a14_successor_projection", {})
                indexed = {row.get("path"): row for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
                if (
                    takeover_completion.get("takeover_status") == "MAIN_AGENT_TAKEOVER_COMPLETED"
                    and successor.get("predecessor_manifest_sha256") == "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8"
                    and indexed
                ):
                    successor_rows.update(indexed)
            r3_evidence_path = root / "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R3.json"
            if not successor_rows and r3_evidence_path.is_file():
                r3_evidence = json.loads(r3_evidence_path.read_text(encoding="utf-8"))
                successor = r3_evidence.get("a14_successor_projection", {})
                rows = successor.get("live_raw_checksums", [])
                indexed = {row.get("path"): row for row in rows if isinstance(row, dict)}
                allowed = set(EXACT_PATHS) - {manifest_path.relative_to(root).as_posix()}
                valid_binding = (
                    r3_evidence.get("self_reference") is False
                    and r3_evidence.get("work_instruction_sha256") == "EA5C9CBB8D9A8107D5EE4845B578D995C3F4EA77017CBDDE7952DC8212E5896C"
                    and successor.get("predecessor_manifest_sha256") == "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8"
                    and bool(indexed)
                    and set(indexed) <= allowed
                )
                if valid_binding:
                    successor_rows = indexed
                else:
                    errors.append("r3-successor-invalid")
            elif not successor_rows:
                r3_path = root / "docs/evidence/manifests/A-14_REWORK_START_MANIFEST_R3.json"
                if r3_path.is_file():
                    r3 = json.loads(r3_path.read_text(encoding="utf-8"))
                    successor = r3.get("a14_successor_projection", {})
                    if successor.get("predecessor_manifest_sha256") == "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8":
                        successor_rows = {row.get("path"): row for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
            completion_path = root / "docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R2.json"
            if not successor_rows and completion_path.is_file():
                completion = json.loads(completion_path.read_text(encoding="utf-8"))
                successor = completion.get("developer_revision2_evidence", {})
                if (successor.get("predecessor_manifest_sha256") == "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8" and successor.get("manifest_sha256") == sha256(root / "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R2.json")):
                    successor_rows = {row.get("path"): row for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
            for registry_path in sorted((root / "docs/evidence/manifests").glob("A-14_A14_SUCCESSOR_*.json")):
                relative_registry = registry_path.relative_to(root).as_posix()
                if not _tracked_clean(root, relative_registry):
                    continue
                registry = json.loads(registry_path.read_text(encoding="utf-8"))
                successor = registry.get("a14_successor_projection", {})
                if (
                    registry.get("artifact_type") == "a14_successor_registry"
                    and registry.get("self_reference") is False
                    and successor.get("predecessor_manifest_sha256")
                    == "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8"
                ):
                    successor_rows.update({
                        row.get("path"): row
                        for row in successor.get("live_raw_checksums", [])
                        if isinstance(row, dict)
                    })
            acceptance_path = root / "docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json"
            if acceptance_path.is_file():
                acceptance = json.loads(acceptance_path.read_text(encoding="utf-8"))
                successor = acceptance.get("a14_successor_projection", {})
                if (
                    acceptance.get("self_reference") is False
                    and successor.get("predecessor_manifest_sha256")
                    == "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8"
                ):
                    successor_rows.update({
                        row.get("path"): row
                        for row in successor.get("live_raw_checksums", [])
                        if isinstance(row, dict)
                    })
            a15_start_path = root / "docs/evidence/manifests/A-15_START_EVIDENCE_MANIFEST.json"
            a15_completion_path = root / "docs/evidence/manifests/A-15_COMPLETION_PROGRESS_MANIFEST.json"
            if a15_start_path.is_file():
                a15_start = json.loads(a15_start_path.read_text(encoding="utf-8"))
                successor = a15_start.get("a14_successor_projection", {})
                if (
                    a15_start.get("self_reference") is False
                    and successor.get("predecessor_manifest_sha256")
                    == "910900E99464B00E362F1895BA55389550EF740DBE6177FB0A4E75D272A62C09"
                ):
                    successor_rows.update({
                        row.get("path"): row
                        for row in successor.get("live_raw_checksums", [])
                        if isinstance(row, dict)
                    })
            if a15_completion_path.is_file():
                a15_completion = json.loads(a15_completion_path.read_text(encoding="utf-8"))
                successor = a15_completion.get("a14_successor_projection", {})
                if (
                    a15_completion.get("self_reference") is False
                    and successor.get("predecessor_manifest_sha256")
                    == "910900E99464B00E362F1895BA55389550EF740DBE6177FB0A4E75D272A62C09"
                ):
                    successor_rows.update({
                        row.get("path"): row
                        for row in successor.get("live_raw_checksums", [])
                        if isinstance(row, dict)
                    })
            for path,value in raw.items():
                actual = portable_hash(root, path)
                row = successor_rows.get(path)
                successor_valid = row and portable_row_matches(root, path, row.get("bytes"), row.get("sha256"))
                if actual != value and not successor_valid: errors.append(f"checksum:{path}")
        target_paths=[path for path in EXACT_PATHS if path != manifest_path.relative_to(root).as_posix()]
        if not missing and not successor_rows and manifest.get("target_hash") != target_hash(root,target_paths): errors.append("target-hash")
    browser_paths=[root/"apps/web/index.html", *sorted((root/"apps/web/src").rglob("*"))]
    errors.extend(browser_source_findings([p for p in browser_paths if p.is_file()]))
    progress_path = root / "docs/progress/build-progress.json"
    takeover_path = root / "docs/evidence/manifests/A-14_MAIN_TAKEOVER_COMPLETION_MANIFEST_R4.json"
    portability_path = root / "docs/evidence/manifests/A-14_PORTABILITY_COMPLETION_MANIFEST_R5.json"
    acceptance_path = root / "docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json"
    a15_start_path = root / "docs/evidence/manifests/A-15_START_EVIDENCE_MANIFEST.json"
    a15_completion_path = root / "docs/evidence/manifests/A-15_COMPLETION_PROGRESS_MANIFEST.json"
    if progress_path.is_file():
        progress = json.loads(progress_path.read_text(encoding="utf-8"))
        if progress.get("event_sequence") == 171:
            if not takeover_path.is_file():
                errors.append("takeover-completion-missing")
            else:
                takeover = json.loads(takeover_path.read_text(encoding="utf-8"))
                if (
                    takeover.get("takeover_status") != "MAIN_AGENT_TAKEOVER_COMPLETED"
                    or takeover.get("next_package_status") != "BLOCKED_PENDING_A14_ACCEPTANCE"
                    or takeover.get("actual_browser_status") != "R4_EXECUTED_UI_FINDINGS_CLOSED"
                    or takeover.get("actual_provider_status") != "NOT_EXECUTED"
                    or takeover.get("actual_production_status") != "NOT_EXECUTED"
                ):
                    errors.append("takeover-completion-boundary")
        if progress.get("event_sequence") == 174:
            if not portability_path.is_file():
                errors.append("portability-completion-missing")
            else:
                portability = json.loads(portability_path.read_text(encoding="utf-8"))
                if (
                    portability.get("actual_browser_status") != "R5_EXECUTED_UI_FINDINGS_CLOSED"
                    or portability.get("next_package_status") != "BLOCKED_PENDING_A14_ACCEPTANCE"
                    or progress.get("active_work_instruction", {}).get("independent_tester_status") != "R6_PENDING"
                ):
                    errors.append("portability-completion-boundary")
        if progress.get("event_sequence") == 175:
            if not acceptance_path.is_file():
                errors.append("acceptance-missing")
            else:
                acceptance = json.loads(acceptance_path.read_text(encoding="utf-8"))
                successor = acceptance.get("a14_successor_projection", {})
                successor_rows = {
                    row.get("path"): row
                    for row in successor.get("live_raw_checksums", [])
                    if isinstance(row, dict)
                }
                for path in ("scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a14_workbench_prototype.py"):
                    row = successor_rows.get(path, {})
                    if not portable_row_matches(root, path, row.get("bytes"), row.get("sha256")):
                        errors.append(f"acceptance-successor:{path}")
                if (
                    acceptance.get("artifact_status") != "accepted"
                    or acceptance.get("actual_browser_status") != "R5_EXECUTED_UI_FINDINGS_CLOSED"
                    or acceptance.get("r6_iab_status") != "ENVIRONMENT_BLOCKED / NOT_EXECUTED"
                    or acceptance.get("actual_provider_status") != "NOT_EXECUTED"
                    or acceptance.get("actual_production_status") != "NOT_EXECUTED"
                    or acceptance.get("next_package_status") != "READY"
                    or progress.get("current_work_package") != "A-15"
                    or progress.get("status") != "READY"
                    or progress.get("active_work_instruction") is not None
                    or progress.get("worker_lease") is not None
                    or progress.get("write_lease") is not None
                ):
                    errors.append("acceptance-boundary")
        if progress.get("event_sequence") == 178:
            if not a15_start_path.is_file():
                errors.append("a15-start-missing")
            else:
                a15_start = json.loads(a15_start_path.read_text(encoding="utf-8"))
                successor = a15_start.get("a14_successor_projection", {})
                successor_rows = {
                    row.get("path"): row
                    for row in successor.get("live_raw_checksums", [])
                    if isinstance(row, dict)
                }
                for path in ("scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a14_workbench_prototype.py"):
                    row = successor_rows.get(path, {})
                    if not portable_row_matches(root, path, row.get("bytes"), row.get("sha256")):
                        errors.append(f"a15-start-successor:{path}")
                if (
                    a15_start.get("artifact_status") != "active"
                    or a15_start.get("inherited_a14_browser_status") != "R5_EXECUTED_UI_FINDINGS_CLOSED"
                    or a15_start.get("r6_iab_status") != "ENVIRONMENT_BLOCKED / NOT_EXECUTED"
                    or a15_start.get("actual_provider_status") != "NOT_EXECUTED"
                    or a15_start.get("actual_production_status") != "NOT_EXECUTED"
                    or a15_start.get("actual_dir_status") != "NOT_REACHED"
                    or progress.get("current_work_package") != "A-15"
                    or progress.get("status") != "ACTIVE"
                    or progress.get("active_work_instruction", {}).get("artifact_id") != "WI-A-15-20260813-001"
                    or progress.get("worker_lease", {}).get("lease_epoch") != 1
                    or progress.get("write_lease", {}).get("write_epoch") != 1
                ):
                    errors.append("a15-start-boundary")
        if progress.get("event_sequence") == 181:
            if not a15_completion_path.is_file():
                errors.append("a15-completion-missing")
            else:
                a15_completion = json.loads(a15_completion_path.read_text(encoding="utf-8"))
                successor = a15_completion.get("a14_successor_projection", {})
                successor_rows = {
                    row.get("path"): row
                    for row in successor.get("live_raw_checksums", [])
                    if isinstance(row, dict)
                }
                for path in ("scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a14_workbench_prototype.py"):
                    row = successor_rows.get(path, {})
                    if not portable_row_matches(root, path, row.get("bytes"), row.get("sha256")):
                        errors.append(f"a15-completion-successor:{path}")
                if (
                    a15_completion.get("artifact_status") != "test_review_pending"
                    or a15_completion.get("user_ux_approval_status") != "PENDING_USER_DECISION"
                    or a15_completion.get("actual_dir_status") != "NOT_REACHED"
                    or progress.get("current_work_package") != "A-15"
                    or progress.get("status") != "TEST_REVIEW"
                    or progress.get("active_work_instruction", {}).get("independent_tester_status") != "PENDING"
                    or progress.get("worker_lease") is not None
                    or progress.get("write_lease") is not None
                ):
                    errors.append("a15-completion-boundary")
    return {"errors":errors,"manifest":manifest,"exact_paths":EXACT_PATHS}

def main(argv=None):
    root=Path(argv[0] if argv else Path.cwd()).resolve()
    result=check(root)
    if result["errors"]:
        print("A-14 WORKBENCH CHECK: FAIL")
        for error in result["errors"]: print(f"- {error}")
        return 1
    print(f"A-14 WORKBENCH CHECK: PASS paths={len(EXACT_PATHS)} self_reference=false")
    return 0

if __name__ == "__main__": raise SystemExit(main(sys.argv[1:]))
