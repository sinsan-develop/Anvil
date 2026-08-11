# A-10 Provider Routing Validation

## 정적 검증 범위

- `AV-OPS-010`: Provider/Model capability registry가 역할 라우팅 조건을 결정하는 정적 계약.
- `AV-LRN-028`: snapshot drift가 `BLOCKED_CAPABILITY_DRIFT`와 probe/benchmark 재검증으로 fail-closed 되는 정적 계약.
- canonical 9개 Provider 순서, unavailable reason, SecretRef-only disclosure, DataEgressProfile, restricted fallback, independent permission, predecessor hash 및 manifest self-reference 금지를 checker와 hostile mutation fixture로 검증한다.

## 제외 범위

이 결과는 `STATIC_ONLY / STATIC_CONTRACT_PASS`다. `D-11`, `F-02`의 실제 capability probe·benchmark·routing activation과 Provider/Secret/Egress/API/DB/Event/browser/network/runtime/DIR은 `RUNTIME_DEFERRED / NOT_EXECUTED`다.
