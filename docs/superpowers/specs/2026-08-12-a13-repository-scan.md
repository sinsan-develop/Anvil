# A-13 Read-Only Repository Scan Adapter

## 목적과 경계

production module로 재사용 가능한 read-only repository scan adapter를 구현해 baseline, Git/status, file inventory, tool/project manifest를 구조화 JSON으로 생성하고 스캔 전후 저장소 무변경을 증명한다.

- assigned: `AV-SAFE-010`, `AV-SAFE-012`
- verdict: `READ_ONLY_FIXTURE_INTEGRATION_PASS`
- executed: L3/L5 fixture integration, E-GIT, E-DIFF
- not executed: actual user repository, browser/API/DB/WSL/production scan

## 핵심 계약

- request는 repository identity, requested path, allowed root, Observe permission, network deny, sections, include/exclude, limits, `follow_symlinks=false`, output outside repository를 명시한다.
- path는 canonical absolute identity로 검증하고 traversal, symlink/junction/reparse/case alias escape와 TOCTOU를 차단한다.
- output은 schema/scanner/acquisition/status, baseline Git, full file inventory, project/tool manifests, rules/protected/secret candidates, warnings/errors, evidence, `read_only=true`, `network_used=false`, commands, no-write proof를 포함한다.
- Git read는 optional locks를 끄고 allowlisted read-only commands만 사용한다. project build/test/format/tool hook/Skill/AGENTS/package install/network를 실행하지 않는다.
- pre/post proof는 HEAD, branch, porcelain-v2 dirty/staged/unstaged/untracked, `.git` index/refs/config/lock, 모든 repo file path/type/size/mtime_ns/content hash/mode를 동일 알고리즘으로 비교한다.
- 추가·삭제·content·mtime·mode·index·ref·HEAD·branch·dirty/untracked 변화 하나라도 있으면 `SCAN_WRITE_DETECTED` 계열로 결과를 거부한다. scanner output/temp/cache는 repo 밖에 둔다.
- G-06의 8개 accepted fixtures를 수정하지 않고 검사하며 특히 dirty/untracked fixture의 content·mtime·status를 정확히 보존한다.

## 검증

Reusable Python package API와 schema/checker/tests를 만들고 G-06 8 fixtures, non-Git, outside-root, symlink escape, malicious manifest/hook, network/project command, inside-output, limit/timeout, injected write detection을 hostile 검증한다. E-GIT/E-DIFF raw before/after evidence와 EvidenceManifest를 결박한다.

No dependency/lock change, actual user repository mutation, network, deploy. DIR is not reached at A-13.
