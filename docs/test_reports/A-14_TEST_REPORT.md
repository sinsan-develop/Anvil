# A-14 Independent Tester Report

- package: `A-14`
- tester role: independent read-only Tester
- tested HEAD: `39a7bcce246db2f33d9ac7d02c81e0d4a11892d8`
- progress entry: sequence `154`, `TEST_REVIEW`, active lease `null`
- verdict: `FAILURE_REPORT / REWORK_REQUIRED`
- assigned verification: `AV-UI-004`, `AV-UI-010`, `AV-GATE-005`
- evidence boundary: `ENV-LOCAL / FIXTURE_BROWSER_RUNTIME_ONLY`

## 판정 -> 판단 이유 -> 조치

### 판정

`FAILURE_REPORT / REWORK_REQUIRED`다. A-14를 Main acceptance로 승격하면 안 된다.

### 판단 이유

1. `BLK-A14-001 / CRITICAL`: 명시적으로 요구된 in-app browser 연결이 Tester와 Main의 독립 시도에서 모두 `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`로 종료됐다. 실제 1920x1080 클릭 흐름, 화면 상태, console/storage/source leakage, 전체 Network URL/method/status를 캡처하지 못했다. 따라서 `AV-UI-004` L7와 `AV-UI-010` E-NET은 `BLOCKED / NOT_EXECUTED`이며 PASS가 아니다.
2. `BLK-A14-002 / CRITICAL`: 전체 tooling 회귀 268건에서 267 PASS, 1 FAIL이다. 실패는 `test_a13_repository_scan.A13RepositoryScanArtifactTests.test_evidence_manifest_has_raw_hashes_no_self_reference_and_exact_diff`이며 clean clone에서 `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`를 반환했다. 현재 worktree의 두 live successor 파일 hash는 completion manifest와 같지만 clean checkout의 line-ending/raw-byte 재현이 깨지는 상태다.
3. `AV-GATE-005`의 정적·Node HTTP 계약은 fixture badge `FIXTURE`, `countsAsPass=false`, 미실행 `NOT EXECUTED`로 유지됐다. 그러나 필수 E-SHOT은 브라우저 차단 때문에 `NOT_EXECUTED`라 최종 PASS로 승격하지 않는다.

### 조치

1. `BLK-A14-002`는 A-14 successor evidence가 clean checkout에서도 동일 raw bytes/hash로 재현되도록 line-ending/manifest 결박을 보정하고 전체 268건을 재실행한다.
2. in-app browser ACL 차단이 해소된 환경에서 1920x1080 실제 클릭과 전체 Network 캡처를 다시 수행한다. 페이지의 local origin은 허용하되 브라우저 코드 요청은 same-origin 상대 `/api/...`인지, 직접 내부 API/localhost/container port 호출이 0건인지 구분해 기록한다.
3. 위 두 차단이 모두 해소되기 전에는 A-14 acceptance와 A-15 시작을 금지한다.

## 독립 실행 증거

### PASS 범위

- 권위 hash: 설계 `246D0487...A5`, 계획 `A1032FB...96A`, 매트릭스 `982B4046...90A`, 테스트계획 `80386850...0F8`, WI `10421A71...F38` 일치.
- Node: `node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs` -> exit 0, 6/6 PASS.
- Python A-14: `python -m unittest tests.tooling.test_a14_workbench_prototype -v` -> exit 0, 4/4 PASS.
- standalone: A-14 checker PASS `paths=17 self_reference=false`; project progress PASS sequence 154; G-07 PASS packages 97/AV 255/uncovered 0/scenarios 20; Phase G PASS; G-06 fixtures 8/golden 8/scenarios 20/fault injections 8.
- completion projection changed paths: Git porcelain `-uall` exact 29/29, unexpected path 0.
- A-14 developer manifest: target `985E6B205B38637B7EC74594B3C376DFF11C79EDEFF65A8930690F2B1206130B`, exact 17, self-reference false.
- A-14 completion projection: target `sha256:A47306D1CAD4B4E1DBF3BFE56826734D807531957DBC54E73E65C5E30E47F39E`, exact 29.
- G-06 fixture source inventory는 pre/post SHA-256 목록이 동일했고 `git status/diff/diff --cached`에 `tests/fixtures/repositories` 및 `packages/repository_intelligence` 변경이 0건이었다.

### Hostile HTTP/runtime PASS 범위

- local server `127.0.0.1:4173`; config GET 200, CSP `default-src 'self'`와 `connect-src 'self'` 확인.
- missing CSRF 403, tampered CSRF 403, hostile Origin 403, hostile Host 403, viewer role direct POST 403, project mismatch 403, fixture mismatch 403.
- valid clean scan 200: `NORMAL`, `SCANNED_READ_ONLY`, `noWriteIdentical=true`, badge `FIXTURE`, `countsAsPass=false`.
- dirty scan 200: `BLOCKED`, tracked dirty path 1, `noWriteIdentical=true`, 실제 PASS badge 없음.
- hostile body는 generic `PERMISSION_DENIED`만 반환했고 secret/raw stack/server path/provider raw error를 반사하지 않았다.
- 브라우저 source 정적 검색에서 절대 API/localhost/127.0.0.1/내부 port/NEXT_PUBLIC/console/storage/cookie/innerHTML/eval/secret/stack/server path 노출 0건, 상대 `/api/...` 호출 2건만 확인했다.
- canonical Provider 순서 9개 및 A-12 상태 vocabulary 9개는 unit/contract에서 고정됐다.

### FAIL/BLOCKED/NOT_EXECUTED

- full tooling: exit 1, 268 tests, 267 PASS/1 FAIL (`BLK-A14-002`).
- actual in-app browser 1920x1080 click/screenshot/console/storage/full Network: `BLOCKED / NOT_EXECUTED` (`BLK-A14-001`).
- 실제 production API/DB/SSE, Provider/Secret/Egress, 사용자 repository, WSL/ysna, deployment, DIR: `NOT_EXECUTED`.

## 기존 기능과 쓰기 경계

Tester는 이 보고서 외 제품·progress·acceptance 파일을 수정하지 않았다. 서버는 검증 종료 후 중지했다. rollback 또는 제품 수정은 수행하지 않았다.
