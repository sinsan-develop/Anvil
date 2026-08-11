# A-07 Recovery · Fencing · Budget 계약

`STATIC_ONLY / STATIC_CONTRACT_PASS`. `AV-AGT-029` L4/AE/E-SHOT은 `RUNTIME_DEFERRED / NOT_EXECUTED`; actual DIR NOT_EXECUTED다.

Recovery Center는 checkpoint, artifact hash, Event sequence, workspace, worker/write lease, side effect를 대조한다. Side effect는 `CONFIRMED_SUCCESS`, `SAFE_RETRY`, `MANUAL_REVIEW` 중 하나로 확정하기 전 재실행하지 않는다. 안전 재개는 exact hash와 reconciliation을 요구하고 중복 실행을 금지한다. 불일치는 `reason`과 `next_action`으로 표시한다.

제품 mutation에는 현재 worker lease와 종속 write lease가 모두 필요하다. stale token, heartbeat expiry, repository/path/case alias 충돌은 fail closed다. Budget은 `RESERVE → PROVIDER_REQUEST → USAGE_RECORD → RECONCILE → RELEASE_REMAINDER` 순서이고 hard limit을 넘으면 요청을 보내지 않는다.

