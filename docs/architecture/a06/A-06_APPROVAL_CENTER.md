# A-06 Approval Center

## 판정 경계

`STATIC_ONLY / STATIC_CONTRACT_PASS`. `E-API NOT_EXECUTED`, `E-AUD NOT_EXECUTED`; runtime은 `RUNTIME_DEFERRED / NOT_EXECUTED`다.

## 독립 승인 lane

`PLAN`, `SCOPE_CHANGE`, `APPLY`, `DEPLOY`, `DESTRUCTIVE`는 각각 독립 record와 권한을 갖는다. 승인 종류 간 대체·재사용은 금지한다. record는 subject artifact/hash, scope, 요청·결정 actor/time, decision/reason, expiry/invalidation/supersession을 보존한다.

만료, artifact/baseline/WI hash 변경은 fail-closed로 승인 효력을 차단한다. 승인 자체는 실행을 시작하지 않으며 A-06에서 Apply/Deploy/Destructive control은 disabled다. `reason=정적 계약 단계`, `next_action=runtime owner B-04/C-14 검증 후 별도 승인`을 보여준다.

