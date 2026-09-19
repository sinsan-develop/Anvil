# C-30R1 WorkInstruction — ASGI console route wiring rework

- parent: C-30 local acceptance / formal smoke finding `evt_c30_formal_smoke_agent_console_404`
- objective: mount the existing agent-console FastAPI sub-application in the unified ASGI app so same-origin `/api/agent-console/*` reaches the existing fail-closed contract.
- preserve: `503 OFFLINE`/`CONSOLE_REQUEST_DENIED` when runtime owner/auth dependencies are unavailable; never synthesize a successful `200`.
- exact allowed paths:
  - `apps/api/anvil_api/asgi.py`
  - `tests/integration/test_c30_console_e2e.py`
  - `tests/integration/test_c30_contract_matrix.py`
  - `docs/04_test_reports/C-30_COMPLETION_REPORT.md`
  - `docs/progress/BUILD_HANDOFF.md`
  - `docs/progress/build-progress.json`
  - `docs/progress/progress-events.json`
- forbidden: DB/WSL/container/provider/production changes, migrations, secrets, auth bypass, external calls.
- completion: targeted ASGI route test proves `/health/live=200` and `/api/agent-console/team` is routed and fail-closed (503), full C30 focused regression rerun, compile and diff-check PASS.
