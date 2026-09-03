# C-21 / LR-02B WorkInstruction

## 1. 권위와 범위

- ID: `WI-C-21-LR-02B-20260903-001`
- 기준 HEAD: `4178eee2ffeb0d5701e1fac058d89891331c74c2`
- 부모 승인: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- 목표: 운영 검증용 test-session의 write permission과 endpoint allowlist를 최소권한으로 정합화한다.
- C-01은 계속 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.

## 2. Lease

- Worker: `worker-lease-c21-lr02b-20260903-001`
- Execution token: `c21-lr02b-execution-fence-epoch-1-4178eee`
- Write: `write-lease-c21-lr02b-20260903-001`
- Write token: `c21-lr02b-write-fence-epoch-1-4178eee`
- Agent: `developer-primary`

## 3. Exact write paths

1. `packages/api/local_session.py`
2. `packages/api/runtime.py`
3. `tests/api/test_local_session.py`
4. `tests/api/test_runtime_app.py`
5. `deploy/ysna/deploy.sh`
6. `deploy/ysna/verify.sh`
7. `deploy/ysna/ReleaseManifest.C21.DRAFT.json`
8. `tests/deploy/test_ysna_deployment_contract.py`
9. `tests/deploy/test_ysna_scripts_contract.py`
10. `docs/04_test_reports/C-21_LR02B_TEST_SESSION_SCOPE_PROGRESS.md`
11. `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_EVIDENCE_MANIFEST.json`
12. `.superpowers/sdd/Anvil_작업계획서_v1/task-3-report.md`

다른 파일은 수정하지 않는다. seq1~428과 LR-02A 산출물은 동결한다.

## 4. 구현 계약

1. `ANVIL_TEST_SESSION_PERMISSION_SCOPES`를 명시적으로 파싱한다. 허용값은 `tasks:write`, `tasks:read`, `run:events:read`뿐이며 wildcard, unknown, duplicate, 공백 비정규값은 startup에서 거부한다.
2. 환경변수가 없을 때 기존 read-only `run:events:read` 동작을 유지한다. ysna deploy 계약은 운영 검증에 세 permission을 명시적으로 요구한다.
3. 허용 endpoint는 다음 네 개뿐이다: Task create/read, Run create, Run events SSE. 같은 permission 문자열을 공유하더라도 다른 endpoint에는 scope를 반환하지 않는다.
4. Task create는 path project와 body target environment가 설정된 단일 project/environment와 정확히 일치해야 한다.
5. Task read와 Run create는 DB Task authority의 project/environment를 조회해 설정 범위와 정확히 일치해야 한다. blanket project grant를 금지한다.
6. SSE는 기존 `ANVIL_TEST_SESSION_RUN_IDS`의 explicit allowlist를 유지한다.
7. Provider, approval, run pause/resume/cancel 및 그 밖의 registry endpoint는 403이어야 한다.
8. Host/Origin, CSRF, permission-scope, idempotency, version, target-hash, reason, TTL, one-live-session, rate-limit, credential non-reflection 기존 경계를 유지한다.

## 5. 검증과 제외

- TDD로 최소 한 개 RED를 먼저 확인하고 GREEN을 남긴다.
- focused local-session/runtime/API/deploy contract, 전체 API 회귀, checker와 `git diff --check`를 실행한다.
- evidence manifest는 변경 제품·테스트·진행 보고서만 raw checksum으로 결박하며 자체 참조하지 않는다.
- migration, project_repositories, Production Task/Run 생성, NPM/DNS/Telegram/Provider, UI/OIDC/RBAC 관리, 배포는 실행하지 않는다. 이는 LR-02C 이후 단계다.
- commit/push/merge하지 않는다. 결과 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다.
