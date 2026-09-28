# F-20/U-01 R3a 기존 Operations Alerts OIDC owner WorkInstruction

- 발행 준비자: Main Agent 어울. **DRAFT — canonical WI Event와 epoch14 exact5 dual lease/G-05 PASS 전 제품 파일 수정 불가.**
- 상위 권위: 승인된 `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_통합검증매트릭스_v1.md` U-01, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` Task 4와 `docs/04_test_reports/F-20_U01_R3A_OPERATIONS_ALERTS_BINDING_PLAN.md`.
- 환경: Windows 로컬 개발, 지정 원격의 정확한 SHA를 `ssh WSL-server`에서 실제 API/DB 및 통제 회귀로 검증. 새 branch·ysna-server·Production 금지.

## 정확한 제품 쓰기 범위

1. `apps/api/anvil_api/oidc_process.py`
2. `apps/api/anvil_api/asgi.py`
3. `tests/api/test_oidc_process.py`
4. `tests/api/test_oidc_asgi_binding.py`
5. `docs/04_test_reports/F-20_U01_R3A_OPERATIONS_ALERTS_RESULT.md`

Main은 R2b epoch13 write→worker lease를 순서대로 회수하고 새 epoch14 worker/write exact5를 발급한다. G-05 PASS 전에는 위 경로를 수정하지 않는다. Main은 단일 Developer의 제품 경로를 동시에 쓰지 않는다.

## 구현·검증

- 기존 OIDC process trust의 고정 project/environment, 검증된 `ANVIL_DATABASE_URL`, `PostgresOperationsRepository`와 `OperationsSources()`로 `OperationsService`를 구성해 기존 `create_runtime_app(operations_owner=...)`까지 명시 전달한다. 일반 OIDC factory의 owner 미주입은 기존 501을 유지한다. 새 public route·permission/role 계약·DB schema/migration·환경변수/Secret은 만들지 않는다.
- 현재 OIDC host `GET /api/operations/alerts` 501을 RED로 재현한다. 정상 scope와 기존 `operations:alerts:read` principal의 저장된 audit 경고 조회는 200, 미인증은 401, 권한 부재·타 project/environment는 403, DB 실패는 fail-closed이며 GET은 detector/audit append를 실행하지 않도록 GREEN으로 만든다. 기존 `GET /api/operations/audit`의 권한 분리와 provider/readiness 동작을 유지한다.
- PostgreSQL URI는 순수 `postgresql://` 그대로, SQLAlchemy `postgresql+psycopg://`/`postgresql+psycopg2://`이면 driver 접미사만 제거해 psycopg에 전달한다. 인증정보·host·DB 이름의 변경/출력, 임의 URI 허용, 별도 credential 저장은 금지한다. 두 정상 형태와 잘못된 형태의 음성 테스트를 둔다.
- 빈 `alerts: []`는 해당 scope에서 **저장된 경고 기록이 없음**만 뜻한다. detector 실행, 경고 완전성, Queue/Worker/Backend 건강, Dashboard Critical Alerts 0건이나 U-01 완료로 승격하지 않는다. 새 Next Actions route, acknowledge mutation, UI는 이 exact5 밖이다.
- 로컬 RED→GREEN, OIDC process/ASGI/F-13 API 인접 테스트·G-05, Main 독립 diff·commit/push 뒤 WSL-server exact SHA의 실제 PostgreSQL/OIDC API 200·401·403·오류 및 정식 회귀를 구분 검증한다. 임시 자원은 생성 전 이름·수명·정리 방법을 기록하고 완료 뒤 정확한 대상만 제거한다.
- 결과보고서에는 시작 HEAD/branch/status, 권위 문서 hash, 변경 diff, 명령·exit·실측, 미검증, 기존 동작 유지, 잔여 위험, rollback, progress/HANDOFF 상태를 기록한다. Developer는 Main 인수 전 commit/push/merge하지 않는다.

## 완료 경계

R3a GREEN도 경고 감지/완전성, Dashboard UI/Next Actions, U-01/F-20 acceptance, C30 사고 복구 또는 release가 아니다. C30 `OPEN_BLOCKING`, release `DEFER`, 기존 skip/warning 및 Production 미실행을 유지한다. rollback은 R3a 제품 commit만 후속 정상 Git commit으로 되돌려 OIDC owner 부재 501로 복귀한다.
