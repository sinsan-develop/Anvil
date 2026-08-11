# A-10 Provider and Model Detail

- classification: `STATIC_ONLY`; package verdict: `STATIC_CONTRACT_PASS`
- verification: `AV-OPS-010`, `AV-LRN-028`; runtime owners: `D-11`, `F-02`
- runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`

Provider/Model Detail shows selected model reference, connection state, checked time, verified capability snapshot, probe revision, benchmark revision and TTL. Model names never infer capability; an absent or stale probe/benchmark blocks activation.

- reason: static fields are not a live capability result.
- next_action: D-11 refreshes the comparable snapshot and records benchmark evidence.
- actual Provider/Secret/Egress/API/DB/Event/browser/network/runtime/DIR: NOT_EXECUTED
