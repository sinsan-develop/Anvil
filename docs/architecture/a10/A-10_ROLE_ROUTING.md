# A-10 Role Routing and Execution Mode

- classification: `STATIC_ONLY`; package verdict: `STATIC_CONTRACT_PASS`
- verification: `AV-OPS-010`, `AV-LRN-028`; runtime owners: `D-11`, `F-02`
- runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`

Execution Mode selects from the same nine providers for main, developer, reviewer, tester and reflection roles. A candidate route requires capability, privacy and egress match plus verified probe and benchmark revisions. Restricted fallback is permitted only for rate limit, timeout or transient 5xx; unsafe fallback stays blocked.

- reason: static routing intent cannot prove an actual request or fallback event.
- next_action: F-02 activates only a validated next routing snapshot.
- actual Provider/Secret/Egress/API/DB/Event/browser/network/runtime/DIR: NOT_EXECUTED
