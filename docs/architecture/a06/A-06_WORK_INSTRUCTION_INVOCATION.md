# A-06 WorkInstruction Review · Invocation Preview

## 판정 경계

`STATIC_ONLY / STATIC_CONTRACT_PASS`. Runtime은 `RUNTIME_DEFERRED / NOT_EXECUTED`, `E-API NOT_EXECUTED`, `E-AUD NOT_EXECUTED`다.

## WorkInstruction Review

G-04 WorkInstruction template의 exact top-level fields를 표시한다. allowed/forbidden paths와 actions는 교집합이 없어야 하며 rollback, completion, result/report, reconstruction, verification 계약이 모두 존재해야 한다. 승인 후 artifact 변경은 새 revision과 승인을 요구한다.

## Invocation Preview

Invocation은 WI id/hash, approval subject hash, execution mode, agent role, completion report path와 짧은 참조 지시만 가진다. goal/scope/verification/prohibition을 복제하거나 재해석하지 않는다. WI hash 또는 approval subject hash가 달라지면 `STALE`로 전환하고 실행을 차단한다.

권한이 없으면 `reason=WI_APPROVE 권한 부족`, `next_action=승인자에게 검토 요청`을 표시한다. 실제 호출은 A-06에서 열지 않는다.

