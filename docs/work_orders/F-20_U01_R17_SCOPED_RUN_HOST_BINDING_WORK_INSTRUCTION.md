# WorkInstruction — F-20/U-01 R17 scoped Run host binding

- 담당: `developer-primary-f20-u01-r17`; 분류: 승인된 U-01의 내부 read-model host 연결. 기능 범위·요구사항·중요 위험 변경 없음.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R17 계획 SHA-256 `BBD343B3CB467B3D316525D379BE7FC9B35121ABB9CD6A624D50546358FD37D9`. Dispatch는 본 WI·Invocation을 기존 branch commit/private push해 WSL-server 동일 SHA로 확인하고 canonical 신규 epoch worker/write lease가 ACTIVE인 뒤에만 허용한다.

## 목표와 exact4 write scope

1. `packages/observability/service.py`: 기존 Queue source loader와 독립된 선택적 내부 `run_summary_loader`를 주입받아 `run_summary()`에서만 호출한다. 결과는 정확한 `ScopedRunStatusSummary`여야 하고 누락/실패/타입 변조는 안전 코드 `RUN_SUMMARY_UNAVAILABLE`로 닫는다. 기존 `snapshot()`/`detect()`/alert/audit 출력·호출은 변경하지 않는다.
2. `apps/api/anvil_api/oidc_process.py`: 이미 인가된 정확한 scope와 기존 Engine으로 R12 `load_scoped_run_source`→R16 `summarize_scoped_runs`를 호출하는 지연 closure를 결박한다. 요청 scope가 다르면 DB 조회 전 안정 오류로 거부한다. OIDC app 생성과 Queue Dashboard 요청에는 새 Run 쿼리를 실행하지 않는다.
3. `tests/observability/test_f20_u01_r17_run_host_binding.py`: 주입 부재·타입/예외 fail-closed·scope 분리·지연 조회·정상 0/혼합 상태·기존 Queue snapshot/API 불변을 먼저 RED로 확인하고 GREEN으로 검증한다. R12/R16 및 Queue host/OIDC process/기존 Dashboard API 인접 회귀도 실행한다.
4. `docs/04_test_reports/F-20_U01_R17_SCOPED_RUN_HOST_BINDING_RESULT.md`: 착수 HEAD/branch/status·기준/hash/dual lease·변경 exact4·RED/GREEN/인접 명령/exit/결과·미검증·기존 기능 유지·rollback·progress/HANDOFF 담당을 기록한다.

## 경계·보고

- 기존 `OperationsSources`, `project_operations`, `OperationsPort`, 공개 Dashboard JSON/route, BFF/UI, 인증·권한·Secret, DB schema/migration/지속 데이터, WSL/Production 배포를 변경하지 않는다. 내부 `run_summary()`는 아직 공개 응답이나 화면 수치가 아니다. Queue job·Worker lease·ApprovalRecord 수를 Run 상태로 대체하지 않는다.
- 새 loader 예외에는 SQL/DSN/secret 원문을 노출하지 않는다. R12의 read-only scoped/100행/legacy 거부와 R16 상태 의미를 그대로 사용한다. 누락은 0건 성공이 아니다. 기존 snapshot 경로가 loader를 호출하지 않는지 확인한다.
- 작업 전 project authority hash, Git HEAD/dirty, canonical G-05, actor/양쪽 fencing token/만료/exact4 scope를 확인한다. Main 소유 `docs/WORK_STATUS.md`·Event/progress/HANDOFF·기존 dirty/untracked를 수정·stage·reset하지 않는다.
- Developer는 TDD RED→GREEN, exact4 diff, 집중·인접 회귀, G-05·diff check 후 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push/PR/merge와 WSL-server·DB/Docker/ysna/Production은 Main 후속이며 Developer 작업 밖이다.
- C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, U-01/F-20 미수락, main 미병합·새 branch 금지를 유지한다.
