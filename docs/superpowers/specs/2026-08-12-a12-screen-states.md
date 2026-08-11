# A-12 Cross-Screen State Catalog 정적 계약

## 목적과 경계

A-03~A-11의 모든 화면 surface에 `LOADING`, `EMPTY`, `ERROR`, `BLOCKED`, `QUOTA`, `CANCEL`, `RECONNECT`와 cross-cutting `PERMISSION_DENIED`를 명시하고, 미실행·SKIPPED·BLOCKED·mock·fixture·static 결과가 PASS로 보이지 않게 한다.

- assigned: `AV-UI-006`, `AV-UI-007`, `AV-GATE-005`
- verdict: `STATIC_CONTRACT_PASS`
- actual L4/AE/AN/MI/E-SHOT and browser/API/SSE runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`

## 핵심 계약

- catalog는 A-03~A-11의 모든 surface×7 state를 명시하거나 권위 근거가 있는 `NOT_APPLICABLE`을 기록한다. permission denied는 모든 surface의 별도 guard다.
- 모든 state envelope는 surface/entity, source mode(real|fixture|mock|static), sequence/version/correlation, freshness, title/message, reason/impact/blocker/evidence, action/next-action/deep-link, retry/reconnect/cancel, permission, masking, icon+text+color semantics를 가진다.
- `LOADING`은 stale previous success를 current로 표시하지 않고 무한 spinner가 되지 않는다. `EMPTY`는 neutral/not verified이며 query·reason·action을 표시한다.
- `ERROR`, `BLOCKED`, `FAIL`, `SKIPPED`, `NOT_EXECUTED`는 서로 다르다. raw stack/secret/path를 숨기고 reason+next action을 제공한다.
- `QUOTA`는 `PAUSED_QUOTA`이며 FAILED/PASS가 아니다. checkpoint, incomplete steps, reset, budget/privacy fallback guard, reconcile을 표시한다.
- cancel은 `CANCEL_REQUESTED→CANCELLED` receipt/timing을 분리하고 terminal Run을 재사용하지 않는다. reconnect는 `Last-Event-ID`, gap/replay/order/dedupe/stale banner를 사용하며 새 Run을 만들지 않는다.
- Verification status는 `PASS|FAIL|SKIPPED|BLOCKED|ERROR`; 실제 실행·기대 충족만 PASS다. 비-PASS는 green check, 완료/정상/통과 문구, pass numerator에 들어가지 않는다.

## 화면과 검증

Machine-readable surface×state matrix, semantic badge catalog, transition/permission contract, focused Markdown과 1920×1080 SVG를 만든다. Checker와 hostile fixtures는 missing surface/state, stale loading, empty success, error leakage, blocked/mock/static PASS promotion, quota/cancel/reconnect guard, permission leakage, optimistic version/idempotency, predecessor/manifest integrity를 fail-closed 검증한다.

No actual UI click, SSE reconnect, cancel, API/DB/Event/browser/network/runtime. DIR is not reached at A-12.
