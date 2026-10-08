# WorkInstruction — F-20/U-01 R15 Database Health 카드

- 담당: `developer-primary-f20-u01-r15`; 분류: 승인된 U-01의 내부 UI 구현. 기능 범위·요구사항·중요 위험 변경 없음.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R15 계획 SHA-256 `CCED2D0C0116D960FC8BBDC21156C04EC50183F255D88BFAD5B8110C0ED7FF78`. Dispatch는 본 WI·Invocation을 commit/private push해 WSL-server 동일 SHA 확인하고 canonical epoch28 worker/write lease ACTIVE인 뒤에만 허용한다.

## 목표와 exact3 write scope

1. `apps/web/src/console/App.tsx`: 기존 `/api/dashboard/operations` 요청의 `health.database`를 별도로 검증해 Database 카드의 건강 상태·마지막 점검시각·오류 수를 표시한다. 기존 `/api/health/ready`의 migration head는 준비 근거로만 분리 표시한다. 기존 Worker/Backend/Artifact Store·Queue·Provider·Alerts 결과, 요청 수와 URL을 보존한다. 새 fetch/API/BFF route/공개 JSON field·권한·DB 변경 금지.
2. `apps/web/tests/f15-console.test.mjs`: 실제 loader와 카드 SSR render를 이용해 READY+HEALTHY, READY+LATE/EXPIRED, 준비 실패+HEALTHY 불승격, UNKNOWN/gap, malformed/future, 401/403/5xx/전송 오류와 민감값·내부주소 비노출을 먼저 RED로 보인 뒤 GREEN. Database 행 오류가 R14 세 카드·Queue 기존 결과를 변경하지 않는 회귀도 검증한다.
3. `docs/04_test_reports/F-20_U01_R15_DATABASE_HEALTH_CARD_RESULT.md`: 기준·HEAD/status·diff·RED/GREEN·실행한 정확한 명령/exit/결과·미검증·rollback·progress/HANDOFF 변경 주체를 기록한다.

## 세부 계약

- readiness가 `READY`가 아니면 카드 주 상태 `NOT CONNECTED`이고, HEALTHY 관측값이 있더라도 건강 PASS로 표시하지 않는다. readiness `READY`일 때만 검증된 Database 신호의 `HEALTHY/LATE/EXPIRED/UNKNOWN`을 주 상태로 표시한다. migration head는 `API 준비 READY · Migration <head>`처럼 건강 상태와 분리한다.
- Database 신호는 R14의 7-field·UTC offset datetime·미래 시각 거부·`last_check=observed_at`·양의 `stale_after_seconds`·비음수 정수 `error_count`·sha256 evidence·same-origin 상대 `detail_path` 계약을 재사용한다. 전부-null UNKNOWN 허용, source gap은 UNKNOWN. Database 행의 malformed 상태만 Database 카드 UNAVAILABLE로 fail closed하고 다른 세 Health 카드·Queue를 새로 악화시키지 않는다.
- Operations 401/403은 Database 건강 `BLOCKED`, 5xx/전송/malformed snapshot은 `UNAVAILABLE`. 실패 본문, evidence/hash, detail URL, credential, raw 응답을 DOM에 표시하지 않는다. 실제 작동하지 않는 상세 링크는 만들지 않는다.

## 필수 검증·금지

- 작업 전 canonical G-05, branch/HEAD/dirty, dual fencing token·actor·만료·exact3 scope 확인. Main 소유 `docs/WORK_STATUS.md`·control/progress/HANDOFF 파일은 수정·stage·reset하지 않는다.
- TDD RED→GREEN, `npm run web:test`, `npm run web:typecheck`, `npm run web:lint`, `npm run web:build`, G-05, `git diff --check`. 전체 suite 실행이 불가하면 정확한 미실행 범위를 기록하고 테스트 PASS로 승격하지 않는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`로 제출. Developer는 commit/push/PR/merge, WSL-server/Docker/DB, ysna/Production을 수행하지 않는다.
- C30 `OPEN_BLOCKING`/DEFER와 F-20/U-01 미수락을 유지한다. 실제 브라우저 Network/DB source/정식 acceptance는 Main·독립 Tester 후속 절차다.
