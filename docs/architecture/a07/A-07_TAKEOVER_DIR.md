# A-07 Takeover · DIR Panel 계약

`STATIC_ONLY / STATIC_CONTRACT_PASS`. `AV-AGT-029` L4/AE/E-SHOT runtime은 `RUNTIME_DEFERRED / NOT_EXECUTED`; A-07에서 actual DIR NOT_EXECUTED다.

Takeover는 같은 lineage+fingerprint의 유효 실패 3회 또는 기록된 `HUMAN_OVERRIDE_TAKEOVER`에서만 열린다. actor 변경 전에 worker/write lease와 Tool을 회수한다. Packet은 fingerprint, count, diff, tests, checkpoint, evidence, remaining work, revoked lease, next actor를 포함한다. 불완전 packet은 `reason`과 `next_action`과 함께 차단한다.

DIR lifecycle `DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED`와 verdict `ALIGNED | DRIFT_MINOR | DRIFT_MAJOR | DIVERGED`는 서로 다른 필드다. ALIGNED도 자동 clear하지 않으며 Owner direction이 필수다. A-07은 Panel 계약만 만들고 canonical DIR trigger를 실행하지 않는다.

