# C-21 Workbench UI WSL Runtime Result WorkInstruction

- ID: `WI-C-21-WORKBENCH-UI-WSL-RUNTIME-RESULT-20260908-001`
- Executor: `developer-primary`
- Parent control commit: `8fe7b975f39990b3d721d27b1a3e9353f891c5c1`
- Candidate commit: `f0d4bc7badbdae69c2d2b21089667fdcc636518d`
- Historical boundary: sequence 1~590 and historical evidence are immutable.
- Result: append sequence 591~596 and bind only the exact 12 paths declared by the checker.

## Required binding

Record the observed SINSAN PG15/PG18RC deploy, migration, API, authenticated SSE, Last-Event-ID, same-origin, backup/restore, rollback, final redeploy/verify and exact cleanup results. Bind the three repeated PG15 one-off connection timeout observations, Main takeover, exact PG15 bridge recovery, unchanged `.env`, receipt hashes, and unauthenticated browser limitation.

## Boundaries

- Final package status: `READY_FOR_INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE`.
- `accepted=false`; C-21 and C-01 remain blocked; DIR-2 is not triggered.
- Provider, Telegram, ysna, main merge, and C-01 execution remain `NOT_EXECUTED`.
- Do not execute WSL, Docker, Provider, Telegram, ysna, push, or merge in this record-only package.
