# F-20/U-01 R16 scoped Run 상태 요약 구현 계획

## 목적·경계

승인된 U-01 Dashboard 2행 운영 카드의 실제 read-model 입력을 준비한다. 설계서 §27의 Run status 의미와 §29.2의 실행 중·승인 대기·BLOCKED 표시를 연결하되, 이번 단위는 R12 `ScopedRunSource`의 내부 순수 집계만 만든다. 기존 인증·인가를 통과한 Project/Environment 범위 밖의 Run을 보지 않으며 공개 API/BFF JSON·UI·DB schema/지속 데이터·권한·Secret을 변경하지 않는다. `ACTIVE`는 실제 프로세스가 실행 중이라는 보장이 아니라 현재 phase가 실행 가능한 Run 상태이므로 결과 필드도 `active_runs`로 명명한다.

## 인터페이스와 불변조건

- `packages/observability/run_status_summary.py`에 `summarize_scoped_runs(source: ScopedRunSource) -> ScopedRunStatusSummary`를 둔다. 결과는 `observed_at`, `observed_total`, `active_runs`, `waiting_approval_runs`, `blocked_runs`만 갖는다. `ACTIVE`, `WAITING_APPROVAL`, `BLOCKED`는 서로 배타적인 canonical `RunStatus`로 센다. 다른 상태는 총 관측 수에만 포함한다.
- 입력은 R12의 정확한 `ScopedRunSource`여야 하며 Run ID 중복, ID/row 불일치, 예상 밖 enum·시각·100행 초과 등 변조/불완전 자료는 안정 오류로 fail closed한다. 임의 `dict`, Queue/Worker 개수, ApprovalRecord 수를 Run 상태로 환산하지 않는다.
- 정상적인 범위 내 0행은 `observed_total=0`일 뿐 전 Project 무실행, DB 건강, 전체 운영 준비 완료를 뜻하지 않는다. R12 포트의 legacy NULL·101행·DB 실패는 그대로 `RUN_SOURCE_UNAVAILABLE`이며 요약 결과를 만들지 않는다. 이 집계는 source owner를 호출하거나 상태를 변경하지 않는다.

## 작업·검증 순서

- 단일 Developer의 제품 exact3: `packages/observability/run_status_summary.py`, `tests/observability/test_f20_u01_run_status_summary.py`, `docs/04_test_reports/F-20_U01_R16_SCOPED_RUN_STATUS_SUMMARY_RESULT.md`. 먼저 정상 상태 혼합·0행·타 상태 제외·중복/불일치·malformed/overflow·시각·비밀값 비노출 테스트 RED를 확인하고 최소 구현 후 GREEN을 확인한다.
- Main은 기존 R12 읽기 테스트와 새 요약 테스트를 독립 실행하고 diff·G-05를 검토한다. 같은 기존 branch에 안전한 commit/private push 후 WSL-server 격리 QA checkout에서 동일 SHA·Python 테스트를 실행한다. 격리 자원 필요 시 생성 전에 정확한 이름·환경·수명·정리를 WORK_STATUS와 commentary에 남기며 잔여0을 확인한다.
- 완료 증거는 명령·exit·실제 결과와 미검증 범위를 결과보고서 및 WORK_STATUS에 남긴다. 정확한 epoch/dual lease 발급·회수와 progress/HANDOFF Event는 Main이 통제한다. 제품 writer와 Main은 같은 파일을 동시에 수정하지 않는다.

## 제외·rollback

이번 결과는 내부 상태 집계일 뿐 Dashboard 표시, 승인 요청 개수, Gate·예산·baseline 카드, Next Actions 경과시간·이동, 실제 브라우저/Provider/DB 운영 유사 검증, U-01/F-20 acceptance를 증명하지 않는다. 공개 API·데이터 계약을 바꿔 화면으로 연결해야 한다면 별도 영향 판정을 먼저 한다. 회귀 시 R16 제품 exact3만 제거하고 R12 포트와 R15 UI를 보존한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, main 미병합·새 branch0·ysna/Production 제외를 유지한다.
