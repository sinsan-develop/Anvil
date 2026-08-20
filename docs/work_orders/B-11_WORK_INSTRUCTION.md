# B-11 WorkInstruction — Canonical API, Same-Origin BFF, SSE, and Web Security

- artifact_id: `WI-B-11-20260821-001`
- revision: `R1 / INITIAL`
- package/status: `B-11 / ACTIVE`
- executor: `developer-primary-b11`
- baseline_git_commit: `1134619b2ecdbe521bb0cce2288af7fac6d1e9dc`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b10_acceptance_manifest_sha256: `28CCFBBEED4A6BDC04145BE715C16B97AA76E6BEF1A70CEAF5FE0A54E98099E2`
- assigned: `AV-STAT-007, AV-UI-011, AV-UI-012, AV-UI-016, AV-SAFE-029`
- predecessors: `B-03~B-10 ACCEPTED`, `A Gate ACCEPTED`, `DIR-1 CLEARED`
- environment: `ENV-LOCAL production-like FastAPI/BFF/SSE; actual local HTTP and browser Network validation required; no shared DB or deployment`

## 목적과 완료 조건

Anvil v1 canonical API registry를 단일 정본으로 구현하고, framework-neutral port 위의 FastAPI route, 서버 전용 same-origin BFF client, 표준 오류·request ID·stable cursor·409 계약, `Last-Event-ID` SSE 재개, 공통 Web 보안·endpoint 권한 경계를 Foundation 2 Gate 구성으로 완성한다.

## 구현 계약

- 설계서 47.13의 endpoint registry를 method/path/command/subresource 의미와 함께 단일 정본으로 둔다. 명령은 `POST /resource/{id}:verb`, 하위 resource는 `/resource/{id}/children`만 허용하고 slash-command alias를 만들지 않는다.
- Run 생성은 `POST /api/tasks/{taskId}/runs` 하나이며 WorkInstruction·ExecutionPlan ID는 body로 받는다. SSE resume cursor는 `Last-Event-ID` header만 사용하고 `?after=` 별칭은 거부한다.
- FastAPI 계층은 기존 B-03~B-10 domain/application service를 framework-neutral port로 호출한다. API handler에 domain 판단·저장소 직접 접근·임시 mock·향후 capability의 가짜 성공 응답을 넣지 않는다.
- mutation은 인증 actor/role, `Idempotency-Key`, `If-Match` 또는 expected version, target hash, permission scope, reason/comment를 검증하고 append-only audit 연결을 보존한다. optimistic version 충돌은 HTTP 409와 표준 오류 envelope로 반환한다.
- 오류 envelope는 안정된 code, 사용자용 message, request ID/correlation ID를 분리하며 내부 stack, secret, 서버 경로, provider raw error를 노출하지 않는다. 모든 응답은 유효한 request ID를 반환한다.
- 목록 API는 결정론적 정렬과 opaque stable cursor를 사용한다. 변조·타 resource cursor는 안정된 오류로 거부하고 offset 기반 불안정 pagination을 기본 계약으로 사용하지 않는다.
- SSE는 저장된 Event ID 다음부터 순서대로 재전송한다. 강제 절단 후 같은 `Last-Event-ID`로 최소 3회 재연결해 유실·중복·새 Run 생성이 모두 0건임을 검증한다.
- 브라우저 실행 코드는 same-origin `/api/...` 상대 경로만 호출한다. 내부 API base URL은 서버 전용 BFF client에서만 읽고 브라우저 bundle/응답/OpenAPI에 내부 host·localhost·컨테이너 포트를 노출하지 않는다.
- session cookie는 `Secure`, `HttpOnly`, 적절한 `SameSite`, 짧은 수명을 사용한다. mutation은 CSRF token과 승인 `Origin`/`Host` 검증 전에는 side effect·lease·provider 요청을 만들지 않는다.
- CORS는 default deny다. 승인 origin만 명시 허용하고 wildcard credential을 금지한다. `Forwarded`/`X-Forwarded-*`는 승인된 proxy hop에서만 신뢰하며 비신뢰 client가 주입한 값은 권한·scheme·host 판단에 사용하지 않는다.
- Approval·artifact·SSE를 포함한 endpoint는 매 요청마다 project/environment/role 권한을 서버 측에서 검사한다. same-origin은 인증·인가의 대체가 아니다.
- CSP는 `unsafe-inline`·`unsafe-eval` 없이 시작하고 HSTS, `frame-ancestors 'none'`, `object-src 'none'`을 포함한다.
- B-12 process/PC recovery, C 이후 Agent/Learning/Provider capability, 실제 메뉴 UI, WSL/ysna/shared-db/production/deployment는 구현하지 않는다.

## Developer exact file-level write allowlist

- `packages/api/__init__.py`
- `packages/api/registry.py`
- `packages/api/common.py`
- `packages/api/security.py`
- `packages/api/sse.py`
- `packages/api/fastapi_app.py`
- `packages/bff/__init__.py`
- `packages/bff/client.py`
- `pyproject.toml`
- `uv.lock`
- `tests/api/test_registry_openapi.py`
- `tests/api/test_error_concurrency.py`
- `tests/api/test_sse_resume.py`
- `tests/api/test_web_security.py`
- `docs/validation/B-11_COMMON_API_BFF_VALIDATION.md`
- `docs/evidence/manifests/B-11_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-11_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01~B-10 산출물, 기존 API contract/source/test, apps/web 제품 코드, DB migration, provider/deployment, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline/authority/B-10 acceptance와 epoch-1 worker→write token 및 exact17을 먼저 검증한다.
2. canonical registry alias·누락, 409 envelope, request ID, cursor 변조, `Last-Event-ID` gap/duplicate, browser absolute URL, CSRF/Origin/Host, cookie/CORS/proxy/endpoint authorization을 RED로 고정한다.
3. 최소 구현과 dependency lock 갱신 후 API focused tests, 기존 core와 tooling 회귀를 실행한다.
4. 실제 local production-like FastAPI/BFF를 띄우고 HTTP 보안 header·cookie·CORS·proxy·SSE를 검증한다. 실제 브라우저 Network에서는 same-origin `/api` 이외 내부주소 직접 호출 0건을 확인한다.
5. FI-08은 동일 조건에서 최소 3회 실행한다. 실행하지 못한 브라우저/환경은 PASS로 승격하지 않고 `BLOCKED` 또는 `NOT_EXECUTED`로 보고한다.
6. EvidenceManifest는 exact17, raw checksum, target hash, self-reference false를 고정한다. CompletionReport에는 변경 파일·diff·명령/exit code·실제/미실행 범위·잔여 위험·rollback을 기록한다.
7. 같은 `(step_lineage_id, failure_fingerprint)`의 증거 완비 `FAILURE_REPORT`만 유효 실패다. 1회 보완, 2회 revision, 3회 lease/tool 회수와 Main 순차 인수를 적용하며 `BLOCKED`, quota, 권한·환경, internal retry는 횟수에서 제외한다.

B-11 acceptance, B-12 recovery, 실제 메뉴 UI, Provider/Secret/Egress capability, WSL/ysna/shared-db/production/deploy는 이 WorkInstruction 범위가 아니다.
