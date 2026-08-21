# Phase B Gate R3 WorkInstruction

- Scope: existing owner-approved `EXACT44_DEPENDENCY_SAFE` only; no scope expansion.
- Findings to close: preserve B-12 historical acceptance validation even at active seq368; reject validation/completion boundary tamper; add raw checksum tamper regression assertion.
- Developer write scope remains exactly the seven Phase B Gate paths in R2. Main-owned progress/HANDOFF/events/digest remain excluded.
- Required status: `IN_PROGRESS_NOT_ACCEPTED`; C-01 remains blocked; no commit/push/Gate acceptance.
- Required verification: focused tests, full progress suite with actual counts, checker, py_compile, diff check.
