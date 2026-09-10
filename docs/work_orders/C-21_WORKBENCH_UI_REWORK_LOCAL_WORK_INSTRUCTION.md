# WI-C-21-WORKBENCH-UI-REWORK-LOCAL-20260907-001

- Parent: `8d043e39f6066283821abe47b36fa83e5ecff8b5`; candidate: `a6dca0da5a37e64491e91813895268e78ecb78b2` (immutable).
- Scope: LOCAL-only Workbench UI rework. Lifecycle is seq573~578; product commit is the single child between start and result records.
- Production `/` reads authenticated same-origin Provider READ APIs in canonical order, with UPSTAGE primary, and authenticated SSE with Last-Event-ID resume.
- Production UI renders only API facts. It never displays secrets, credential key names, internal endpoints, or fixture claims.
- Configure, test, and refresh remain disabled/unavailable; no Provider POST is sent.
- Loading, ready, empty, error, blocked, permission-denied, and reconnect are accessible and honest.
- Preserve the A-14 fixture flow at `/fixture-workbench`; do not modify legacy UI Preview files.
- Excluded: actual Provider/Telegram calls, WSL execution/deployment, ysna/main, DB/schema/Secret changes, U-02 conversation/approval/history, U-11 persistence/routing.

## Product exact11 write lease

- `apps/web/index.html`
- `apps/web/fixture-workbench.html`
- `apps/web/server.mjs`
- `apps/web/src/api/workbench-client.js`
- `apps/web/src/app/workbench.js`
- `apps/web/src/features/workbench/workbench-state.js`
- `apps/web/src/styles/workbench.css`
- `apps/web/tests/workbench.test.mjs`
- `apps/web/tests/ui-preview-runtime.test.mjs`
- `tests/api/test_public_asgi_frontend.py`
- `tests/browser/c21-network-probe.mjs`

TDD RED must be observed before product mutation. Completion requires local Node/API/browser evidence, deterministic append-only projection, exact path/hash, direct-child, and clean checks. WSL/Provider/Telegram/ysna/main must remain unclaimed.
