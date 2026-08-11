# A-10 Credential and Data Egress Drawer

- classification: `STATIC_ONLY`; package verdict: `STATIC_CONTRACT_PASS`
- verification: `AV-OPS-010`, `AV-LRN-028`; runtime owners: `D-11`, `F-02`
- runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`

Credential Status Drawer exposes only SecretRef status and version category. `REVOKED` and `EXPIRED` block routing. DataEgressProfile is one of `local_only`, `metadata_only`, `approved_paths`, or `masked_content`; expansion requires human approval and becomes effective only on the next immutable snapshot.

- reason: no secret literal or server endpoint belongs in a static browser-facing artifact.
- next_action: F-02 validates allowlist, excluded paths, approval binding and audit separation.
- actual Provider/Secret/Egress/API/DB/Event/browser/network/runtime/DIR: NOT_EXECUTED
