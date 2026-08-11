# A-05 Design Decision Validation

- 판정 범위: `STATIC_ONLY / STATIC_CONTRACT_PASS`
- assigned AV: `AV-FLOW-001`
- canonical L4/L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-EVT_NOT_EXECUTED`
- runtime owners: B-03, A-14, A Gate

검증기는 최소 2개 완전한 evidence-backed Proposal, recommendation과 사람 결정 분리, authenticated human+exact subject/spec hash, 미해결 결정·invalid evidence의 승인 차단, HOLD/FUTURE_EXTENSION CarryoverItem, acyclic superseded lineage, approved baseline immutability와 spec/hash 변경 invalidation을 stable reason code로 검사한다.

A-01~A-04 predecessor hash와 A-02 token, A-04 360px ON_DEMAND i-icon tooltip/popover, 분리 permission, secret/internal endpoint 비노출, static qualifier를 fail-closed로 결박한다. 실제 API, DB, Event, Browser, Network, Docker, deployment는 `NOT_EXECUTED`이며 PASS로 승격하지 않는다.
