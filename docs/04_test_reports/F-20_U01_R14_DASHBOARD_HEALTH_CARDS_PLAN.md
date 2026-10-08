# F-20/U-01 R14 Dashboard Health 카드 계획

## 목적·기준

승인된 U-01 Dashboard §29.2의 Health 1행에서 아직 placeholder인 Worker·Execution Backends·Artifact Store 세 카드를 기존 `GET /api/dashboard/operations`의 `health` 관측값에 연결한다. R13 종료 `b08f5825e5dac7d8c1a28776067b07ee4593842a`는 clean/G-05 seq1872, worker/write lease null이고 WSL-server 격리 checkout과 동일 SHA다. 기존 Database readiness·Queue 관측 수·Provider credential 카드 및 Critical Alerts를 보존한다.

## 내부 계약

- 브라우저의 기존 same-origin `/api/dashboard/operations` 요청 **한 번**에서만 세 카드 값을 파생한다. 새로운 API·BFF route, 권한, DB schema, Provider 외부 호출, 공개 JSON 필드·데이터 계약 변경은 없다.
- 세 카드에는 기존 `health.worker`·`health.backend`·`health.artifact_store`만 대응한다. 응답의 exact snapshot envelope/health 키·row 타입·관측시각·오류 수·상대 상세경로/증거 형식을 검사한다. 비정상·미래 시각·누락 시 건강을 추정하지 않고 비가용으로 닫는다. 기존 Queue의 관측 수와 실패 처리는 보존한다.
- `source_gaps`에 해당 component가 있거나 signal state가 `UNKNOWN`이면 `UNKNOWN`; 실제 관측에 근거한 `HEALTHY/LATE/EXPIRED`만 그대로 표시한다. 항목별 마지막 점검시각·오류 수는 안전한 scalar만 표시하고 raw evidence·내부 endpoint·비밀은 DOM에 출력하지 않는다. 연결되지 않은 상세 이동은 작동한다고 주장하지 않는다.
- `401/403`은 `BLOCKED`, 서버/전송/invalid response는 `UNAVAILABLE`. 실패 본문을 읽어 폐기하되 표시하지 않는다. Dashboard 다른 카드의 기존 반응·상태를 암묵 변경하지 않는다.

## 구현·검증

단일 Developer 제품 경로 exact3: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R14_DASHBOARD_HEALTH_CARDS_RESULT.md`. 새 회귀를 먼저 RED로 실행하고 GREEN 뒤 `npm run web:test`, `npm run web:typecheck`, `npm run web:lint`, `npm run web:build`와 G-05를 실행한다. Main은 독립 diff/test 및 기존 branch private push 후 WSL-server 동일 SHA에서 동일 frontend 검증을 수행한다. 실제 브라우저 Network/E-SHOT은 별도 정식 U-01 검증이며 이 카드 계약만으로 PASS로 승격하지 않는다.

## 제외·rollback

Project/Run/Agent/Provider/환경 전체 상태, Next Actions, 실제 Worker lease 연결, 공용 운영 서버·ysna/Production, C30 incident 해소, F-20/U-01 acceptance, `main` 병합·새 branch는 제외한다. 회귀 시 제품 exact2만 되돌리고 R14 결과·실패 근거는 보존한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`를 유지한다.
