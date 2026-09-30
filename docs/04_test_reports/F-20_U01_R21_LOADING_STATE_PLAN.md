# F-20/U-01 R21 Dashboard 조회 중 상태 구현 계획

## 판정·목적

승인된 U-01 Dashboard의 `loading` 상태를 기존 Operations snapshot 경로에서 실제 조회 불가와 구분한다. 현재 `Shell`은 요청 전에 `DASHBOARD_QUEUE_UNAVAILABLE`을 초기값으로 사용하므로 SSR 및 첫 화면에서 Queue·Worker·Execution Backends·Artifact Store·Next Actions가 `UNAVAILABLE`을 표시한다. 요청이 아직 끝나지 않았는데 실패를 표시하는 원인은 초기 상태 값이며 API·DB 응답이 아니다. 시작 기준은 기존 branch `codex/f18-wsl-ops`, clean checkpoint `a1b679fdb720222d658ad7729b68ff7269f7b4a5`, canonical seq1920·dual lease null·G-05 PASS다.

## 파일 경계·설계

- 단일 Developer의 제품/테스트/보고서 exact3: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R21_LOADING_STATE_RESULT.md`. Main 소유 control/progress/HANDOFF/WORK_STATUS/Git은 별도다.
- `DashboardQueueState`에 요청 대기 중인 `LOADING`만 추가한다. 초기 Dashboard snapshot 값은 `LOADING`; 요청이 실제로 완료되면 기존 `LOADED`·`BLOCKED`·`UNAVAILABLE` 분류를 유지한다. Queue·Worker·Execution Backends·Artifact Store·Next Actions는 이 한 상태를 각자 `aria-live` 영역에 `LOADING`과 짧은 ‘조회 중’ 설명으로 표시한다. 정상이 확인되기 전 `HEALTHY`/0건을 표시하지 않는다.
- 기존 Operations 응답·권한·same-origin 경로·Queue/Health/Next Actions 검증·오류 본문 비노출은 변경하지 않는다. Database readiness, Provider, Critical Alerts의 별도 초기 상태와 refresh/필터/실행·승인·비용 카드는 이 R21 범위에 넣지 않는다. 이들을 전량 검증한 것처럼 주장하지 않는다.

## RED→GREEN·검증

1. `apps/web/tests/f15-console.test.mjs`에서 Dashboard 첫 렌더의 위 다섯 카드가 `LOADING`이며 오류·차단·건강·0건을 표시하지 않는 테스트를 먼저 추가한다. 현재 `UNAVAILABLE` 초기값에서 기대한 assertion 실패를 확인한다. 별도 카드 컴포넌트에 `LOADING`을 전달했을 때 안전한 텍스트와 `aria-live`를 확인하고, 기존 `BLOCKED`/5xx/transport는 여전히 본문 비노출 상태인지 검증한다.
2. `App.tsx`의 상태 union·초기값·렌더 분기만 최소 수정해 GREEN으로 만든다. pending→실제 결과 완료 시 기존 응답 분류를 바꾸지 않는다. 공통 헬퍼 분리나 다른 메뉴 변경은 하지 않는다.
3. 로컬에서 집중 테스트, console 전체, typecheck, lint, build, G-05, diff check를 실행한다. Main은 exact3 diff와 회귀를 독립 확인한다. 기존 사설 branch에 commit/push하고 WSL-server 기존 격리 QA checkout 동일 SHA·clean에서 Node24 동일 명령을 재검증한다. 임시 Node/build 출력은 사용 전 이름·수명·정리 방법을 기록하고 해당 자원만 정리한다.
4. 결과보고·WORK_STATUS를 갱신하고 dual lease를 순차 회수한다. 이 범위의 PASS는 U-01 7상태 전체/키보드·실제 브라우저 E-SHOT/E-NET/사용자 인수 또는 F-20 정식 Gate가 아니다.

## 고정 경계

C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, F-20/U-01 미수락을 유지한다. 공개 API·데이터 계약·DB schema·인증/권한·Secret·운영 배포를 변경하지 않는다. `main` 병합·새 branch·ysna/Production은 하지 않는다. 회귀 시 R21 exact3만 정상 되돌리고 R20의 검증된 동작을 보존한다.
