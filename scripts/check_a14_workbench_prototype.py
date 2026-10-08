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

def canonical_lf_row_matches(root: Path, path: str, row: dict) -> bool:
    if row.get("canonical_eol") != "LF":
        return False
    raw = (root / path).read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    return len(raw) == row.get("bytes") and hashlib.sha256(raw).hexdigest().upper() == row.get("sha256")


def _a14_r7_registry_rows(root: Path, registry: dict) -> dict[str, dict]:
    """Bind only the three current successor bytes, without rewriting A-14 history."""
    exact = {"apps/web/server.mjs", "scripts/check_a14_workbench_prototype.py",
             "tests/tooling/test_a14_workbench_prototype.py"}
    parent = "docs/evidence/manifests/A-14_A14_SUCCESSOR_R6.json"
    manifest = "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST.json"
    if (type(registry) is not dict
            or set(registry) != {"artifact_id", "artifact_type", "package_id", "revision",
                                 "self_reference", "a14_successor_projection"}
            or registry["artifact_id"] != "A-14-A14-SUCCESSOR-R7-001"
            or registry["artifact_type"] != "a14_successor_registry"
            or registry["package_id"] != "A-14"
            or type(registry["revision"]) is not int or registry["revision"] != 7
            or registry["self_reference"] is not False):
        raise ValueError("A14_R7_REGISTRY_INVALID")
    projection = registry["a14_successor_projection"]
    if (type(projection) is not dict
            or set(projection) != {"predecessor_registry_path", "predecessor_registry_sha256",
                                   "predecessor_manifest_path", "predecessor_manifest_sha256",
                                   "live_raw_checksums", "binding_mode"}
            or projection["predecessor_registry_path"] != parent
            or projection["predecessor_registry_sha256"] != sha256(root / parent)
            or projection["predecessor_manifest_path"] != manifest
            or projection["predecessor_manifest_sha256"] != sha256(root / manifest)
            or projection["binding_mode"] != "GENERIC_COMMITTED_CLEAN_SUCCESSOR_REGISTRY"):
        raise ValueError("A14_R7_PARENT_INVALID")
    rows = projection["live_raw_checksums"]
    if type(rows) is not list or len(rows) != len(exact):
        raise ValueError("A14_R7_SCOPE_INVALID")
    indexed = {}
    for row in rows:
        if (type(row) is not dict or set(row) != {"path", "bytes", "sha256"}
                or row["path"] not in exact or row["path"] in indexed
                or type(row["bytes"]) is not int or row["bytes"] <= 0
                or type(row["sha256"]) is not str):
            raise ValueError("A14_R7_ROW_INVALID")
        path = root / row["path"]
        raw = path.read_bytes()
        if len(raw) != row["bytes"] or hashlib.sha256(raw).hexdigest().upper() != row["sha256"]:
            raise ValueError("A14_R7_HASH_INVALID")
        indexed[row["path"]] = row
    if set(indexed) != exact:
        raise ValueError("A14_R7_SCOPE_INVALID")
    return indexed


def _javascript_code_mask(text: str) -> tuple[str, bool, list[tuple[int, int]]]:
    """Mask non-code lexemes while retaining code inside template interpolations."""
    masked=list(text)
    ambiguous=False
    regex_spans=[]
    expression_prefix_words={
        "await","case","delete","do","else","in","instanceof","new","of",
        "return","throw","typeof","void","yield",
    }

    def blank(index: int) -> None:
        if text[index] not in "\r\n":
            masked[index]=" "

    def scan_string(index: int, quote: str) -> int:
        nonlocal ambiguous
        blank(index); index += 1
        while index < len(text):
            char=text[index]; blank(index)
            if char == "\\":
                index += 1
                if index >= len(text):
                    ambiguous=True; return index
                blank(index); index += 1; continue
            index += 1
            if char == quote:
                return index
            if char in "\r\n":
                ambiguous=True; return index
        ambiguous=True
        return index

    def scan_regex(index: int) -> int:
        nonlocal ambiguous
        start=index
        blank(index); index += 1; in_class=False
        while index < len(text):
            char=text[index]; blank(index)
            if char == "\\":
                index += 1
                if index >= len(text):
                    ambiguous=True; return index
                blank(index); index += 1; continue
            if char in "\r\n":
                ambiguous=True; return index + 1
            if char == "[": in_class=True
            elif char == "]": in_class=False
            elif char == "/" and not in_class:
                index += 1
                while index < len(text) and (text[index].isalpha() or text[index] == "_"):
                    blank(index); index += 1
                regex_spans.append((start,index))
                return index
            index += 1
        ambiguous=True
        return index

    def scan_template(index: int) -> int:
        nonlocal ambiguous
        blank(index); index += 1
        while index < len(text):
            char=text[index]
            if char == "\\":
                blank(index); index += 1
                if index >= len(text):
                    ambiguous=True; return index
                blank(index); index += 1; continue
            if char == "`":
                blank(index); return index + 1
            if char == "$" and index + 1 < len(text) and text[index + 1] == "{":
                blank(index)
                index=scan_code(index + 2, True)
                continue
            blank(index); index += 1
        ambiguous=True
        return index

    def scan_code(index: int, template_expression: bool=False) -> int:
        nonlocal ambiguous
        can_end_expression=False
        nested_braces=0
        while index < len(text):
            char=text[index]
            following=text[index + 1] if index + 1 < len(text) else ""
            if char.isspace(): index += 1; continue
            if char == "}" and template_expression and nested_braces == 0:
                return index + 1
            if char == "/" and following == "/":
                blank(index); blank(index + 1); index += 2
                while index < len(text) and text[index] not in "\r\n": blank(index); index += 1
                continue
            if char == "/" and following == "*":
                blank(index); blank(index + 1); index += 2; closed=False
                while index < len(text):
                    if text[index] == "*" and index + 1 < len(text) and text[index + 1] == "/":
                        blank(index); blank(index + 1); index += 2; closed=True; break
                    blank(index); index += 1
                if not closed: ambiguous=True
                continue
            if char in ("'", '"'):
                index=scan_string(index,char); can_end_expression=True; continue
            if char == "`":
                index=scan_template(index); can_end_expression=True; continue
            if char == "/" and not can_end_expression:
                index=scan_regex(index); can_end_expression=True; continue
            if char == "/":
                can_end_expression=False; index += 2 if following == "=" else 1; continue
            if char.isalpha() or char in "_$":
                end=index + 1
                while end < len(text) and (text[end].isalnum() or text[end] in "_$"): end += 1
                word=text[index:end]
                can_end_expression=word not in expression_prefix_words
                index=end; continue
            if char.isdigit():
                index += 1
                while index < len(text) and (text[index].isalnum() or text[index] in "._"): index += 1
                can_end_expression=True; continue
            if char == "{":
                if template_expression: nested_braces += 1
                can_end_expression=False; index += 1; continue
            if char == "}":
                if template_expression: nested_braces -= 1
                can_end_expression=True; index += 1; continue
            if char in ")]": can_end_expression=True
            elif char in "([;,.:?=+-*%&|^!~<>": can_end_expression=False
            index += 1
        if template_expression:
            ambiguous=True
        return index

    scan_code(0)
    return "".join(masked),ambiguous,regex_spans

def _brace_depth_at(code_mask: str, position: int) -> int | None:
    depth=0
    for char in code_mask[:position]:
        if char == "{": depth += 1
        elif char == "}":
            if depth == 0: return None
            depth -= 1
    return depth

def _brace_structure_invalid(code_mask: str) -> bool:
    return _brace_depth_at(code_mask,len(code_mask)) != 0

def _safe_root_relative(value: str) -> bool:
    return value.startswith("/") and not value.startswith("//") and "://" not in value and "\\" not in value

def browser_source_findings(paths: list[Path]) -> list[str]:
    findings=[]
    forbidden=re.compile(r"https?://|localhost|127\.0\.0\.1|NEXT_PUBLIC_|host\.docker",re.I)
    fetches=re.compile(r"(?:fetchImpl|fetch)\(([^,)]+)")
    ready_declarations=[]
    ready_pattern=re.compile(
        r"^[ \t]*(?:export[ \t]+)?const[ \t]+READY_PATH[ \t]*=[ \t]*(['\"])([^'\"\r\n]+)\1[ \t]*;[ \t]*$",
        re.MULTILINE,
    )
    sources=[]
    for path in paths:
        text=path.read_text(encoding="utf-8")
        code_mask,lexical_ambiguous,regex_spans=_javascript_code_mask(text)
        # READY_PATH is a narrow security binding, not a general JavaScript parser.
        # If a slash survives masking, it may be division or a regex literal whose
        # grammar depends on statement context.  Either form makes brace/scope
        # inference unsafe, so fail closed instead of guessing.
        lexical_ambiguous = lexical_ambiguous or ("READY_PATH" in text and "/" in code_mask)
        declarations=[]
        for match in ready_pattern.finditer(text):
            declaration_code=code_mask[match.start():match.end()]
            if _brace_depth_at(code_mask,match.start()) == 0 and re.search(r"\bconst\s+READY_PATH\b",declaration_code):
                declarations.append((match.span(),match.group(2)))
                ready_declarations.append(match.group(2))
        imports=[]
        for match in re.finditer(r"(?m)^[ \t]*import\b[\s\S]*?;",code_mask):
            named=re.search(r"\bimport\s*\{([^}]*)\}\s*from\b",match.group())
            names=[] if named is None else [part.strip() for part in named.group(1).split(",")]
            if _brace_depth_at(code_mask,match.start()) == 0 and "READY_PATH" in names:
                imports.append(match.span())
        sources.append((path,text,code_mask,declarations,imports,lexical_ambiguous,regex_spans))
    safe_ready_path = (
        ready_declarations[0]
        if len(ready_declarations) == 1
        and _safe_root_relative(ready_declarations[0])
        else None
    )
    for path,text,code_mask,declarations,imports,lexical_ambiguous,regex_spans in sources:
        # A complete regex literal may *reject* an address; it is not an API endpoint.
        if any(not any(start <= match.start() and match.end() <= end for start,end in regex_spans)
               for match in forbidden.finditer(text)):
            findings.append(f"internal-address:{path.as_posix()}")
        fetch_matches=list(fetches.finditer(code_mask))
        allowed_ready_spans=[span for span,_ in declarations]
        allowed_ready_spans.extend(imports)
        ready_path_bound=bool(declarations or imports)
        for match in fetch_matches:
            expression=text[match.start(1):match.end(1)].strip()
            literal_match=re.fullmatch(r"(['\"])([^'\"\r\n]*)\1",expression)
            root_relative=bool(literal_match and _safe_root_relative(literal_match.group(2)))
            if expression == "READY_PATH": allowed_ready_spans.append(match.span(1))
            if root_relative or expression.startswith("apiPath(") or (expression == "READY_PATH" and safe_ready_path and ready_path_bound): continue
            findings.append(f"non-relative-fetch:{path.as_posix()}")
        ambiguous=any(
            not any(start <= token.start() and token.end() <= end for start,end in allowed_ready_spans)
            for token in re.finditer(r"\bREADY_PATH\b",code_mask)
        )
        if ambiguous:
            findings.append(f"ambiguous-ready-path:{path.as_posix()}")
        if "READY_PATH" in text and (lexical_ambiguous or _brace_structure_invalid(code_mask)):
            findings.append(f"ambiguous-javascript-structure:{path.as_posix()}")
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
            b03_completion_path = root / "docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json"
            if b03_completion_path.is_file():
                b03_completion = json.loads(b03_completion_path.read_text(encoding="utf-8"))
                successor = b03_completion.get("a14_server_successor_projection", {})
                indexed = {row.get("path"): row for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
                if successor.get("authorization") == "B03_R2_LOCAL_SAME_ORIGIN_SHARED_SERVER" and set(indexed) == {"apps/web/server.mjs", "scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a14_workbench_prototype.py"}:
                    successor_rows.update(indexed)
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
                r6_registry_valid = (
                    registry_path.name != "A-14_A14_SUCCESSOR_R6.json"
                    or (
                        registry.get("revision") == 6
                        and successor.get("predecessor_registry_path")
                        == "docs/evidence/manifests/A-14_A14_SUCCESSOR_R5.json"
                        and successor.get("predecessor_registry_sha256")
                        == sha256(root / "docs/evidence/manifests/A-14_A14_SUCCESSOR_R5.json")
                        and successor.get("binding_mode")
                        == "GENERIC_COMMITTED_CLEAN_SUCCESSOR_REGISTRY"
                        and {row.get("path") for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
                        == {
                            "apps/web/index.html", "apps/web/server.mjs",
                            "apps/web/src/app/workbench.js", "apps/web/src/api/workbench-client.js",
                            "apps/web/src/features/workbench/workbench-state.js",
                            "apps/web/src/styles/workbench.css", "apps/web/tests/workbench.test.mjs",
                            "tests/browser/a14/workbench-runtime.test.mjs",
                            "scripts/check_a14_workbench_prototype.py",
                            "tests/tooling/test_a14_workbench_prototype.py",
                        }
                    )
                )
                if (
                    registry.get("artifact_type") == "a14_successor_registry"
                    and registry.get("self_reference") is False
                    and r6_registry_valid
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
            # B-03 R2 is the latest authorized successor for the shared local
            # same-origin server.  Apply it last so older A-14/A-15 successor
            # records cannot overwrite the live server row.
            if b03_completion_path.is_file():
                b03_completion = json.loads(b03_completion_path.read_text(encoding="utf-8"))
                successor = b03_completion.get("a14_server_successor_projection", {})
                indexed = {row.get("path"): row for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
                if successor.get("authorization") == "B03_R2_LOCAL_SAME_ORIGIN_SHARED_SERVER" and set(indexed) == {"apps/web/server.mjs", "scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a14_workbench_prototype.py"}:
                    successor_rows.update(indexed)
            # R6 is an additive, committed-clean final selection.  Apply it
            # after older A-15/B-03 projections so stale rows cannot override
            # the exact live A-14 scanner boundary.
            r6_registry_path = root / "docs/evidence/manifests/A-14_A14_SUCCESSOR_R6.json"
            if r6_registry_path.is_file() and _tracked_clean(root, r6_registry_path.relative_to(root).as_posix()):
                r6_registry = json.loads(r6_registry_path.read_text(encoding="utf-8"))
                r6_successor = r6_registry.get("a14_successor_projection", {})
                r6_rows = {
                    row.get("path"): row
                    for row in r6_successor.get("live_raw_checksums", [])
                    if isinstance(row, dict)
                }
                if (
                    r6_registry.get("artifact_type") == "a14_successor_registry"
                    and r6_registry.get("revision") == 6
                    and r6_registry.get("self_reference") is False
                    and r6_successor.get("predecessor_registry_path")
                    == "docs/evidence/manifests/A-14_A14_SUCCESSOR_R5.json"
                    and r6_successor.get("predecessor_registry_sha256")
                    == sha256(root / "docs/evidence/manifests/A-14_A14_SUCCESSOR_R5.json")
                    and r6_successor.get("predecessor_manifest_sha256")
                    == "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8"
                    and r6_successor.get("binding_mode")
                    == "GENERIC_COMMITTED_CLEAN_SUCCESSOR_REGISTRY"
                    and set(r6_rows) == {
                        "apps/web/index.html", "apps/web/server.mjs",
                        "apps/web/src/app/workbench.js", "apps/web/src/api/workbench-client.js",
                        "apps/web/src/features/workbench/workbench-state.js",
                        "apps/web/src/styles/workbench.css", "apps/web/tests/workbench.test.mjs",
                        "tests/browser/a14/workbench-runtime.test.mjs",
                        "scripts/check_a14_workbench_prototype.py",
                        "tests/tooling/test_a14_workbench_prototype.py",
                    }
                ):
                    successor_rows.update(r6_rows)
            r7_registry_path = root / "docs/evidence/manifests/A-14_A14_SUCCESSOR_R7.json"
            if r7_registry_path.is_file():
                relative_r7 = r7_registry_path.relative_to(root).as_posix()
                if not _tracked_clean(root, relative_r7):
                    errors.append("r7-successor-uncommitted")
                else:
                    try:
                        r7_registry = json.loads(r7_registry_path.read_text(encoding="utf-8"))
                        successor_rows.update(_a14_r7_registry_rows(root, r7_registry))
                    except (OSError, ValueError, KeyError, TypeError):
                        errors.append("r7-successor-invalid")
            for path,value in raw.items():
                actual = portable_hash(root, path)
                row = successor_rows.get(path)
                successor_valid = row and (
                    portable_row_matches(root, path, row.get("bytes"), row.get("sha256"))
                    or canonical_lf_row_matches(root, path, row)
                )
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
