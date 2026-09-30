# F-20/U-01 R17 scoped Run host binding 계획

## 목적과 기준

U-01 Dashboard 2행에 필요한 실제 scoped Run 관측을 기존 R12 읽기와 R16 요약에서 OIDC host의 내부 Operations owner까지 연결한다. 기준은 `cc0b78f96d4d2abe5ae4ee0928efb42f21f0ceba`의 기존 `codex/f18-wsl-ops`이며, 로컬·사설 원격·WSL-server 격리 checkout 동일 SHA/clean/G-05 seq1890 PASS, worker/write lease null이다. R16 이후 감사 `F-20_U01_POST_R16_DASHBOARD_SOURCE_AUDIT.md`의 미연결 판정을 따른다.

## 제품 계약

- `OperationsService`에는 기존 Queue `source_loader`와 독립적인 **선택적 내부** `run_summary_loader(project_id, environment_id)`를 주입한다. `run_summary()`는 주입된 경우에만 정확한 `ScopedRunStatusSummary`를 반환한다. 누락·예외·타입 변조는 비밀값/SQL을 노출하지 않는 안정적인 `RUN_SUMMARY_UNAVAILABLE`로 fail closed한다. 기존 `snapshot()`, `detect()`, alerts/audit 및 공개 API/BFF 응답은 호출·형태·오류가 바뀌지 않는다.
- `create_oidc_process_app`는 이미 확정된 authorization scope와 기존 신뢰 Engine만 사용해 `load_scoped_run_source`→`summarize_scoped_runs` 순서의 내부 closure를 만든다. 요청 ID가 scope와 다르면 DB 조회 전에 거부한다. Run 읽기는 호출 시에만 실행한다. OIDC process 생성과 기존 Queue Dashboard 조회에서는 추가 Run SQL이 실행되지 않는다.
- R12의 100행 상한, legacy NULL 거부, 단일 read-only 거래, R16 상태 배타 집계가 그대로 적용된다. Queue job 수·Worker lease 수·approval row 수를 Run 상태로 대체하지 않는다. `ACTIVE`는 Run 실행 가능 상태이며 실프로세스 수나 승인 요청 건수가 아니다. 빈 scope 관측0은 전체 건강 판정이 아니다.
- 내부 서비스에 권한이 새로 생기는 것은 아니다. 공개 route/API JSON, BFF, UI, DB schema/migration/지속 데이터, Secret/인증 정책 및 운영 배포는 변경하지 않는다. 이후 공개 Dashboard 연결은 별도 API/화면 영향 판정과 실제 E-API/E-NET/E-SHOT 증거가 필요하다.

## 구현·검증 순서

1. Main이 별도 WorkInstruction/Invocation을 확정해 단일 Developer에게 제품 exact4(`packages/observability/service.py`, `apps/api/anvil_api/oidc_process.py`, `tests/observability/test_f20_u01_r17_run_host_binding.py`, `docs/04_test_reports/F-20_U01_R17_SCOPED_RUN_HOST_BINDING_RESULT.md`)와 유효 dual lease를 발급한다. Main은 해당 제품 경로를 동시에 쓰지 않는다.
2. Developer가 loader 누락·잘못된 타입·예외 비노출·정확한 scope/지연 실행·기존 Queue snapshot 무변경을 RED→GREEN으로 검증한다. 기존 R12/R16·Queue host·OIDC process·Dashboard API 인접 회귀를 실행한다. 초기 DB 연결은 호출하지 않는 합성/fixture 테스트로 확인한다.
3. Main이 diff·계약·테스트를 독립 확인하고 기존 branch에 commit/private push한다. WSL-server는 정확한 SHA의 격리 QA checkout에서 집중/인접 Python 테스트를 실행한다. 실제 PostgreSQL 검증이 필요하면 전용 DB/role/container/venv/포트의 정확한 이름·사전 부재·수명·정리를 실행 전에 별도 기록한다. 실제 DB 결과를 fixture PASS로 대체하지 않는다.
4. 동일 SHA 증거와 미검증 범위를 `WORK_STATUS`/결과에 기록하고 dual lease를 write→worker 순서로 회수한다. G-05·Git clean·임시 자원 잔여0을 확인한다.

## 완료 경계·rollback

R17 완료는 내부 host binding의 범위 한정 완료이며 U-01/F-20 수락, Dashboard 카드·Next Actions 표시, 실제 OIDC 브라우저 E2E, PG18RC/복구, C30 원장 사고 해결이나 ReleaseDecision 변경이 아니다. 회귀 시 R17 제품 commit만 정상 revert하고 R12/R16·Queue host/공개 Dashboard 기존 동작을 재검증한다. C30 `OPEN_BLOCKING`/DEFER, main 미병합·새 branch 금지, ysna/Production 제외를 유지한다.
