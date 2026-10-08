# WorkInstruction — F-20/U-01 R16 scoped Run 상태 요약

- 담당: `developer-primary-f20-u01-r16`; 분류: 승인된 U-01의 내부 read-model 구현. 기능 범위·요구사항·중요 위험 변경 없음.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R16 계획 SHA-256 `6181D8E511329D5FEF87150933B546878FA9DF40792FAC6B1C6EAA5CB2EE5A73`. Dispatch는 본 WI·Invocation을 commit/private push해 WSL-server 동일 SHA 확인하고 canonical epoch29 worker/write lease ACTIVE인 뒤에만 허용한다.

## 목표와 exact3 write scope

1. `packages/observability/run_status_summary.py`: R12의 정확한 `ScopedRunSource`를 순수 함수로 요약한다. frozen 결과는 `observed_at`, `observed_total`, `active_runs`, `waiting_approval_runs`, `blocked_runs`만 갖는다. `RunStatus.ACTIVE`, `WAITING_APPROVAL`, `BLOCKED`만 각 버킷에 세고 다른 상태는 total에만 포함한다. `ACTIVE`를 실제 프로세스 실측으로 표현하지 않는다.
2. `tests/observability/test_f20_u01_run_status_summary.py`: 정상 혼합·0행·다른 상태 제외·중복/ID-행 불일치·100행 경계/101행 거부·잘못된 타입/enum/시각·secret 필드 비노출·source 비변경을 먼저 RED로 보인 뒤 GREEN으로 검증한다. R12 source의 DB 오류·legacy/overflow는 요약 성공으로 우회하지 않는다.
3. `docs/04_test_reports/F-20_U01_R16_SCOPED_RUN_STATUS_SUMMARY_RESULT.md`: 기준·착수 HEAD/status·diff·RED/GREEN·실행한 정확한 명령/exit/결과·미검증·rollback·progress/HANDOFF 변경 주체를 기록한다.

## 세부 계약·금지

- `observed_at`은 timezone-aware `datetime` 그대로 보존한다. `run_ids`는 tuple, `_runs`는 정확한 ID 집합의 dict, 각 값은 `RunObservation`, `run_id`는 key와 일치하고 `status`/`phase`는 canonical enum, version은 양의 정수여야 한다. 중복·잘못된 관측은 안정적인 `RUN_STATUS_SUMMARY_UNAVAILABLE` 오류만 낸다. 반환값에 task/run ID·permission hash·payload를 포함하지 않는다.
- source 상한은 R12와 같은 100행이다. 범위 내 정상 0행만 total0이며 Project 전체 0건·건강 PASS를 뜻하지 않는다. input source를 변경하거나 DB/Queue/Worker/Approval owner를 조회하지 않는다.
- 새 공개 API/BFF 필드·route, UI, DB schema·지속 데이터, 인증·권한·Secret·배포 변경을 하지 않는다. 아직 없는 승인 요청·Gate·예산·baseline 소유자의 수치를 추측하지 않는다.
- 작업 전 canonical G-05, branch/HEAD/dirty, dual fencing token·actor·만료·exact3 scope 확인. Main 소유 `docs/WORK_STATUS.md`·control/progress/HANDOFF 파일은 수정·stage·reset하지 않는다.
- TDD RED→GREEN, 새 테스트와 R12 기존 집중 테스트, G-05, `git diff --check`. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`로 제출. Developer는 commit/push/PR/merge, WSL-server/Docker/DB, ysna/Production을 수행하지 않는다.
- C30 `OPEN_BLOCKING`/DEFER와 F-20/U-01 미수락을 유지한다. 실제 DB·API/UI/브라우저·정식 acceptance는 Main·독립 Tester 후속 절차다.
