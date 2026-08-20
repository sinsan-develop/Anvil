# B-11 R2 WorkInstruction — 서버 측 scope authorization 보완

- artifact_id: `WI-B-11-20260821-002`
- revision: `R2 / FAILURE_REPORT_1`
- package/status: `B-11 / ACTIVE_REWORK`
- executor: `developer-primary-b11`
- baseline_git_commit: `ce8179527a64128899df21542b24f1b7f85e35b1`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- source_tester_report_sha256: `EFBE6313A9BFF589702149E7042FDA127DF99CA323FD864C8EC16EA72D07441C`
- failure_fingerprint: `BLK-B11-001-SCOPE-AUTHORIZATION-NOT-ENFORCED`
- assigned: `AV-STAT-007, AV-UI-011, AV-UI-012, AV-UI-016, AV-SAFE-029`
- predecessors: `B-03~B-10 ACCEPTED`, `A Gate ACCEPTED`, `DIR-1 CLEARED`
- environment: `ENV-LOCAL production-like FastAPI/BFF/SSE; no shared DB or deployment`

## 판정 → 판단 이유 → 조치

- 판정: `REWORK_REQUIRED / CRITICAL / valid failure 1`
- 판단 이유: R1 `_authorize`가 permission label만 검사해 actor role과 project/environment scope가 없는 principal도 Approval·artifact·SSE application port 및 journal read에 도달했다. 이는 R1 WorkInstruction의 명시된 서버 측 authorization 요구를 구현하지 못한 중대 결함이다.
- 조치: 기능 범위·요구사항을 넓히지 않고 기존 exact17 안의 exact8만 다시 열어 authoritative scope resolver와 fail-closed authorization을 추가한다. B-11 acceptance와 B-12 시작은 금지한다.

## R2 구현 계약

1. 모든 canonical endpoint는 permission label만으로 승인하지 않는다. server-supplied authorization resolver가 대상 resource의 authoritative `project_id`, `environment_id`, `allowed_actor_roles`를 결정하고, API boundary가 이를 authenticated principal의 `actor_role`, `project_ids`, `environment_ids`와 모두 대조해야 한다.
2. resolver 부재, scope 미해결, 허용 role 불일치, project scope 누락·교차, environment scope 누락·교차는 안정된 HTTP 403으로 fail closed 한다. body, query, header 등 caller-controlled 값만으로 authorization을 승인하지 않는다.
3. authorization resolver 호출 외의 command/query port, Approval·artifact port, SSE journal read 및 side effect보다 authorization 판정을 먼저 완료한다. 거부 요청의 application command/query 호출과 SSE read는 모두 0이어야 한다.
4. wrong role, empty/cross project, empty/cross environment를 Approval POST, artifact GET, SSE GET 각각에 대해 검증한다. nominal permission string을 가진 hostile principal도 403이어야 한다.
5. 기존 Host 검증, authentication, authorization, mutation Origin/CSRF/idempotency/version/target-hash/permission-scope/reason 검증의 선행 순서를 보존한다. 정상 요청은 기존 request ID, HTTP 409, BFF, SSE resume/FI-08 계약을 유지한다.
6. registry 83개 endpoint와 OpenAPI equality를 변경하지 않는다. 공개 endpoint, permission 이름, cookie/CORS/CSP/proxy 정책, BFF 및 SSE wire format을 변경하지 않는다.
7. B-12 recovery, 실제 메뉴 UI, Provider/Secret/Egress, WSL/ysna/shared DB/production/deployment를 시작하지 않는다.

## Developer exact file-level write allowlist (8)

- `packages/api/fastapi_app.py`
- `tests/api/test_registry_openapi.py`
- `tests/api/test_error_concurrency.py`
- `tests/api/test_sse_resume.py`
- `tests/api/test_web_security.py`
- `docs/validation/B-11_COMMON_API_BFF_VALIDATION.md`
- `docs/evidence/manifests/B-11_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-11_COMPLETION_REPORT.md`

위 exact8은 모두 승인된 R1 exact17 안에 있다. 나머지 R1 제품 파일, authority, progress/HANDOFF, failure ledger, Tester report, checker, WorkInstruction/Invocation, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline/report hash, epoch-2 worker/write fencing token과 exact8을 먼저 확인한다.
2. Approval·artifact·SSE에 대해 wrong role, empty/cross project, empty/cross environment가 현재 200과 port/read 호출을 만드는 RED를 실제 FastAPI boundary에서 먼저 고정한다.
3. authoritative scope resolver와 API boundary 대조를 최소 구현하고 RED가 403 및 zero dispatch/read로 GREEN이 되는지 확인한다.
4. focused API, canonical core, full tooling, canonical combined full, registry/OpenAPI, compile/import/diff와 standalone checker를 실행한다.
5. 실제 local uvicorn에서 정상·hostile Approval/artifact/SSE를 검증하고 FI-08 3회 strict successor, request ID, 409와 Host/Origin/CSRF 선행 차단을 재검증한다. 브라우저가 차단되면 PASS로 승격하지 않는다.
6. EvidenceManifest는 exact8 중 manifest 자체를 제외한 raw7과 새 target hash, `self_reference=false`를 고정한다. CompletionReport·validation에는 명령, exit code, 실제 결과, 미실행 범위, rollback과 잔여 위험을 기록한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push/progress/HANDOFF는 수정하지 않는다.

B-11 acceptance와 B-12 시작은 independent retest 전까지 금지한다.
