# WorkInstruction R1 — F-20/U-01 R18 격리 PostgreSQL 15 Run host QA

- 담당: `developer-primary-f20-u01-r18`; 원 R18 WI의 **합성 row 삭제 teardown**만 정정한다. 원 WI의 목표·제품 exact2·DSN guard·검증·금지 범위는 그대로 적용한다. 원 epoch31은 `INCOMPLETE`로 종료되고 dual lease는 회수됐다. R1의 새 commit/private push→WSL-server 동일 SHA 및 별도 epoch32 dual lease ACTIVE 이전에는 제품 write를 재개하지 않는다.
- 기준 문서: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R18 계획 `94B93303DB6A2832BE7393AECCE452B2BD54E861B96D1CBE82D4791A072A6D87`.
- 분류: `MAIN_RECONFIRMED_NON_SEMANTIC`. 기존 승인 범위의 내부 QA 정리 방법만 수정한다. 기능·요구사항·공개 API·DB schema·권한·Secret·비용 한도·중요 위험 변경은 없다. append-only Event 삭제 금지와 독립 연결 조회 계약을 보존하는 보완이다.

## 제품 exact2 및 구현

1. `tests/api/test_f20_u01_r18_run_host_pg15.py`: 이미 검증된 DSN/opt-in guard를 유지하고, 빈 전용 PostgreSQL 15 DB에 migration head `0019_oidc_sessions`와 비-superuser를 확인한 뒤 정식 repository로 합성 Project/Task/Run/Event를 **커밋**한다. `create_oidc_process_app`의 trusted scope → `operations_owner.run_summary()`로 빈 상태, 범위 내 ACTIVE·WAITING_APPROVAL·BLOCKED, 교차 scope 배제의 두 시점 관측과 Run/Queue/audit 저장 수 불변을 검증한다. 잘못된 scope·legacy NULL·101행·DB 오류는 안정 비가용을 검증한다. 현재 로컬 guard 9 PASS/1 opt-in SKIP은 보존한다. 실제 PG 연결 없이는 실제 경로를 SKIP으로 명시한다.
2. `docs/04_test_reports/F-20_U01_R18_RUN_HOST_PG15_QA_RESULT.md`: 기존 INCOMPLETE/guard 근거를 삭제하지 않고 R1의 RED→GREEN/인접 테스트·명령·exit·결과·미검증·rollback을 누적한다. WSL 실제 DB 실행 결과는 Main이 별도 WORK_STATUS에 기록한다.

## 정정된 teardown·안전 경계

- 테스트는 커밋한 합성 `run_events` 또는 다른 합성 row를 SQL로 삭제하지 않는다. 별도 tmpfs data의 R18 전용 PostgreSQL container 전체를 **Main이** 실제 QA 종료·실패·중단 뒤 ID/label/image/port/mount를 확인하여 제거한다. 같은 수명 안에 전용 venv/pytest base도 절대경로·link·활성 프로세스 확인 뒤 정확히 제거하고 잔여0을 증명한다. 공유 PostgreSQL·컨테이너·볼륨·사용자 DB는 건드리지 않는다.
- 직접 SQL INSERT로 Run repository를 우회하거나 append-only trigger를 변경·비활성화하지 않는다. 실제 PG에서 결함이 드러나면 제품 코드 수정 없이 증거와 잔여 검증을 보고한다.
- Developer는 로컬 exact2만 수정한다. Main 소유 progress/HANDOFF/WORK_STATUS와 Git, WSL-server/DB/Docker, main/새 branch, ysna/Production은 건드리지 않는다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, F-20/U-01 미수락을 유지한다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`로 구분한다. 실측 SKIP은 PASS가 아니다.
