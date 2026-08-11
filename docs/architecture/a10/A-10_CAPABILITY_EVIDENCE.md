# A-10 Capability Drift and Evidence Audit Drawer

- classification: `STATIC_ONLY`; package verdict: `STATIC_CONTRACT_PASS`
- verification: `AV-OPS-010`, `AV-LRN-028`; runtime owners: `D-11`, `F-02`
- runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`

Capability Drift compares provider/upstream/model revision, privacy, cost, retention, training use, ZDR, context, tool capability, probe, benchmark and TTL. A material difference produces `BLOCKED_CAPABILITY_DRIFT`; the next run requires probe, benchmark and any required approval. Provider, Secret and Egress permissions remain independently auditable.

- reason: this artifact is a fail-closed design contract, not drift detection execution evidence.
- next_action: D-11 and F-02 obtain the actual comparison and audit record.
- actual Provider/Secret/Egress/API/DB/Event/browser/network/runtime/DIR: NOT_EXECUTED
