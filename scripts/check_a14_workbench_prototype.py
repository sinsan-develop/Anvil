"""Validate the exact A-14 clickable fixture Workbench evidence set."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

EXACT_PATHS = [
    "apps/web/index.html","apps/web/server.mjs","apps/web/src/app/workbench.js","apps/web/src/api/workbench-client.js","apps/web/src/features/workbench/workbench-state.js","apps/web/src/styles/workbench.css","apps/web/tests/workbench.test.mjs","tests/browser/a14/workbench-runtime.test.mjs","tests/fixtures/a14/workbench-fixtures.json","tests/fixtures/a14/hostile-inputs.json","scripts/check_a14_workbench_prototype.py","tests/tooling/test_a14_workbench_prototype.py","docs/architecture/a14/A-14_WORKBENCH_PROTOTYPE.md","docs/architecture/a14/A-14_WORKBENCH_CONTRACT.json","docs/validation/A-14_WORKBENCH_PROTOTYPE_VALIDATION.md","docs/evidence/manifests/A-14_EVIDENCE_MANIFEST.json","docs/completion_reports/A-14_COMPLETION_REPORT.md"
]

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()

def target_hash(root: Path, paths: list[str]) -> str:
    material = "".join(f"{path}\0{sha256(root/path)}\n" for path in paths)
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
            for path,value in raw.items():
                actual = sha256(root/path)
                row = successor_rows.get(path)
                successor_valid = row and row.get("bytes") == (root/path).stat().st_size and row.get("sha256") == actual
                if actual != value and not successor_valid: errors.append(f"checksum:{path}")
        target_paths=[path for path in EXACT_PATHS if path != manifest_path.relative_to(root).as_posix()]
        if not missing and not successor_rows and manifest.get("target_hash") != target_hash(root,target_paths): errors.append("target-hash")
    browser_paths=[root/"apps/web/index.html", *sorted((root/"apps/web/src").rglob("*"))]
    errors.extend(browser_source_findings([p for p in browser_paths if p.is_file()]))
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
