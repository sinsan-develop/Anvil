# WorkInstruction — F-20/U-01 R14 Dashboard Health 카드

- 담당: `developer-primary-f20-u01-r14`; 분류: 승인된 U-01의 내부 UI 구현, 기능 범위·요구사항·중요 위험 변경 없음.
- 기준: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R14 계획 SHA-256 `2F188D20491E332CBE86C0C95870293DBDAD2DF6E4EC000CE09F73B0C51C22AC`; dispatch는 본 WI·Invocation을 commit/private push해 WSL-server 동일 SHA 확인하고 canonical epoch27 worker/write lease가 ACTIVE인 뒤에만 허용한다.

## 목표와 exact3 write scope

1. `apps/web/src/console/App.tsx`: 기존 `/api/dashboard/operations` 요청 한 번의 정상 snapshot에서 Worker·Execution Backends·Artifact Store Health 카드 세 개만 안전하게 표시한다. Database readiness·Queue 관측 수·Provider credential·Critical Alerts 경로와 응답 처리를 유지한다. 새 fetch/route/공개 JSON 필드·권한·DB 변경 금지.
2. `apps/web/tests/f15-console.test.mjs`: 테스트를 먼저 RED로 만들고, 실제 `loadDashboardQueue`와 카드 render를 이용해 정상 신호, gap/UNKNOWN, 미래/비정상 값, 401/403/5xx/전송 실패의 fail closed 및 응답 본문·evidence·내부주소 비노출을 검증한다. 기존 Queue·Provider·Alert 테스트 유지.
3. `docs/04_test_reports/F-20_U01_R14_DASHBOARD_HEALTH_CARDS_RESULT.md`: 기준·HEAD/status·diff·RED/GREEN·정확한 명령/exit/결과·미검증·rollback·progress/HANDOFF 변경 주체를 기록한다.

## 세부 계약

- component 대응은 `worker`→Worker, `backend`→Execution Backends, `artifact_store`→Artifact Store 고정이다. 화면에는 실제 신호의 `HEALTHY`, `LATE`, `EXPIRED`, `UNKNOWN`만 사용한다. 빈/누락 신호, source gap, 미래 관측시각, malformed field는 정상으로 승격하지 않는다.
- 정상 신호는 Health row의 정확한 7필드, 유효한 UTC offset datetime, `stale_after_seconds>0`, 비음수 정수 `error_count`, `last_check=observed_at`, `sha256:` evidence, same-origin 상대 `detail_path`를 검증한다. UNKNOWN의 전부-null row는 허용한다. 실제 건강 signal이어도 `source_gaps`에 있으면 UNKNOWN으로 표시한다. 세 카드에는 state·마지막 점검시각·오류 수만 표시하고 evidence 원문·detail_path URL·credential·raw response는 표시하지 않는다. 링크는 이 단위에서 추가하지 않는다.
- 전체 API 실패·malformed snapshot은 세 카드 `UNAVAILABLE`, 401/403은 `BLOCKED`. Queue의 기존 오류값과 0건 관측의 의미는 보존한다. 별도 health request를 추가하지 않는다.

## 필수 검증·금지

- 작업 전 canonical G-05, 실제 branch/HEAD/dirty, 두 fencing token과 exact3 scope 확인. Main 소유 `docs/WORK_STATUS.md`와 control/progress 파일은 수정·stage·reset하지 않는다.
- TDD: 새 테스트가 의도된 사유로 RED인 것을 확인한 뒤 최소 구현, focused GREEN, `npm run web:test`, `npm run web:typecheck`, `npm run web:lint`, `npm run web:build`, G-05 및 diff check. 실행 환경과 SKIP/미실행을 구분한다.
- Main에게 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`로 결과를 전달한다. Developer는 commit/push/PR/merge, WSL-server/Docker/DB, ysna/Production을 수행하지 않는다.
- 기존 카드 회귀·민감값/내부주소 노출·새 API 계약·권한 변경은 허용하지 않는다. C30 `OPEN_BLOCKING`/DEFER·F-20/U-01 미수락을 유지한다.
