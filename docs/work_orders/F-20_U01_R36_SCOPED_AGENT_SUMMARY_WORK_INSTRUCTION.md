# WorkInstruction — F-20/U-01 R36 Scoped Agent owner 내부 요약·host 결선

- 담당: `developer-primary-f20-u01-r36` 단일 제품 writer. Main의 seq2016 no-lease에서 canonical worker/write dual lease와 G-05 PASS 뒤 착수한다.
- 기준: 설계 §29.2, 작업계획 U-01, R13 owner read와 `docs/04_test_reports/F-20_U01_R36_SCOPED_AGENT_SUMMARY_PLAN.md`. Dispatch에 실제 문서 hash, branch/HEAD/status, 두 fencing token·만료를 전달한다.
- 분류: 승인된 U-01의 **내부** read model 선행 절편. 새 공개 API/JSON/route·권한·auth/CSRF·DB schema·Secret·화면·운영 배포 변경0.

## write allowed_paths 정확히 7개

1. `packages/observability/agent_owner_summary.py`: R13의 정확한 scoped source만 입력받아 관측 0~100개 Agent owner의 ACTIVE/REVOKED/EXPIRED를 fail-closed 순수 집계한다.
2. `tests/observability/test_f20_u01_r36_agent_owner_summary.py`: 0/100/101, 혼합 상태, 중복/위조/시각/비밀 비노출, 입력 무변경 RED→GREEN.
3. `packages/observability/service.py`: `OperationsService`의 optional 내부 agent summary loader와 안정적 unavailable 메서드만 추가한다. 기존 Queue/Run/Alert 경로와 공개 snapshot을 바꾸지 않는다.
4. `apps/api/anvil_api/oidc_process.py`: 고정 인가 Project/Environment와 같은 Engine의 R13 read→R36 summary 지연 closure만 결선한다. 생성·일반 Dashboard GET은 Agent DB 조회를 하지 않는다.
5. `tests/observability/test_f20_u01_r36_agent_host_binding.py`: loader 부재/오류, 지연, 정확 scope, 외부 scope 차단·비밀 비노출 및 Queue/Run/Alert 회귀.
6. `tests/integration/test_f20_u01_r36_agent_host_pg15.py`: 명시 opt-in PG15에서 실제 저장 owner 0/3건·철회/만료·외부 scope 거부를 검증하고 기본 local suite에선 SKIPPED. 격리 리소스는 Main만 생성/정리한다.
7. `docs/04_test_reports/F-20_U01_R36_SCOPED_AGENT_SUMMARY_RESULT.md`: 기준·TDD RED/GREEN·명령/exit·미검증·rollback·임시물 기록.

## 완료조건과 금지

- `ScopedAgentOwnerSummary`는 frozen 관측시각, observed total과 세 상태 수만 노출한다. 0건은 정확 범위의 관측 0행일 뿐 Agent/Worker/Provider 건강 PASS가 아니다. 불완전·101·위조 source는 `AGENT_OWNER_SUMMARY_UNAVAILABLE`로 닫는다.
- host loader는 OIDC 고정 scope와 다르면 DB 접근 전 거부한다. 내부/DSN/permission/snapshot/fence 내용은 오류·응답에 노출하지 않는다. 현행 `OperationsPort`/Dashboard JSON와 OIDC 인증 동작을 그대로 유지한다.
- Developer는 시작 전 canonical G-05, branch/HEAD/status, actor·두 token·만료·exact7 scope를 확인한다. Main 소유 Event/progress/HANDOFF/WORK_STATUS/control과 사용자 dirty/untracked는 수정·stage·삭제하지 않는다.
- TDD RED→GREEN, 신규/기존 R13/R16/R17·OIDC/Operations 관련 회귀, Python compile, G-05, diff check를 실행한다. opt-in PG15는 Developer 미실행으로 보고하고 Main이 동일 SHA WSL-server에서 검증한다.
- Developer는 commit/push/PR/merge, 새 branch/main, WSL-server/Docker/DB, ysna/Production을 건드리지 않는다. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`로 보고한다. R36 PASS도 U-01/F-20 인수가 아니며 C30 `OPEN_BLOCKING`/DEFER를 유지한다.
