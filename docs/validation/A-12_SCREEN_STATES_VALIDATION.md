# A-12 Static Validation

- Scope: `AV-UI-006`, `AV-UI-007`, `AV-GATE-005` static contract only.
- Checker validates 48 A-03~A-11 surfaces × 7 states, cross-cutting PERMISSION_DENIED, common envelope, badge semantics, transition guards, predecessor hashes and manifest target projection.
- Hostile mutations cover missing state, stale loading, neutral empty promotion, safe-error disclosure, BLOCKED collapse, quota, cancel, reconnect replay, mock/static PASS promotion, permission masking, client mutation/version bypass and runtime promotion.
- Result classification is `STATIC_CONTRACT_PASS`; it is not browser/API/DB/Event/SSE/network/DIR evidence.
- Actual runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`.
