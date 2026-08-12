# A-12 Cross-Screen State Catalog

모든 A-03~A-11 surface는 `LOADING`, `EMPTY`, `ERROR`, `BLOCKED`, `QUOTA`, `CANCEL`, `RECONNECT` 및 별도 `PERMISSION_DENIED` guard를 가진다. 공통 envelope는 entity, source mode, sequence/version/correlation, freshness, reason/impact/blocker/evidence, action/deep-link, retry/reconnect/cancel, permission/masking, icon·text·color badge를 함께 전달한다.

`LOADING`은 이전 성공을 현재 결과로 표시하지 않고 bounded wait와 cancel을 표시한다. `EMPTY`는 중립 상태이며 검증 성공이 아니다. `ERROR`에는 안전한 메시지와 next action만 표시하고 raw stack, secret, local path는 표시하지 않는다. `BLOCKED`는 원인·해제 행동을 표시하며 ERROR나 SKIPPED로 합치지 않는다.

Quota는 `PAUSED_QUOTA`다. checkpoint, 미완료 step, reset hint, reconcile을 표시하며 FAILED/PASS 또는 비승인 fallback으로 바꾸지 않는다. Cancel은 `CANCEL_REQUESTED` receipt와 실제 `CANCELLED` 시간을 분리한다. terminal Run은 재사용하지 않고 새 Run만 만들 수 있다.

Reconnect는 `Last-Event-ID` 이후 gap/replay/order/dedupe를 적용하고 stale banner를 표시한다. 재접속 자체는 새 Run을 만들지 않는다. optimistic version과 idempotency key, server receipt, terminal immutability를 적용하며 client state mutation으로 대체하지 않는다.

PASS는 실제 실행된 qualifying evidence만 쓸 수 있다. FAIL, SKIPPED, BLOCKED, ERROR, NOT_EXECUTED, MOCK, FIXTURE, STATIC은 모두 text+icon+color로 구분하며 green check, 완료/정상/통과 문구 및 pass numerator에 들어가지 않는다. 이 artifact는 `STATIC_ONLY`; browser/API/DB/Event/SSE/network/DIR은 `RUNTIME_DEFERRED / NOT_EXECUTED`다.
