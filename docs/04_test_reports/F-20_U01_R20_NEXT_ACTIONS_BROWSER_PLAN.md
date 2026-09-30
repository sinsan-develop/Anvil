# F-20/U-01 R20 Next Actions Browser Verification Implementation Plan

> **For agentic workers:** Use the approved Anvil WorkInstruction and a single `developer-primary` writer. The checklist is the R20 implementation and QA boundary; no new user approval is required for this internal U-01 slice.

**Goal:** Verify the R19 Next Actions card against an actual scoped Dashboard API response, persisted alert, and Chromium DOM in an isolated WSL-server PostgreSQL 15/OIDC environment.

**Architecture:** Extend the existing R6 opt-in browser harness, not the product API/UI. Grant the synthetic operator the existing `dashboard:read` permission, compare the exact API `next_actions` row to the stored alert and visible card, then revoke that permission and verify `BLOCKED` with no stale action. Keep the existing all-request same-origin/secret audit and three state screenshots.

**Tech Stack:** Python pytest/FastAPI/SQLAlchemy, PostgreSQL 15 tmpfs, synthetic HTTPS OIDC, Node Playwright/Chromium, Vite frontend.

**Spec:** `Anvil_설계서_v2.md` §29.2; `Anvil_작업계획서_v1.md` §13 U-01; `Anvil_통합검증매트릭스_v1.md` §6.11; `Anvil_테스트계획서_v1.md` §10.8; R19 Next Actions UI result.

## Global Constraints

- One existing branch only: `codex/f18-wsl-ops`; no `main` merge, new branch, ysna-server, or Production work while C30 is `OPEN_BLOCKING` and ReleaseDecision is `DEFER`.
- Developer write lease exact files: `tests/integration/test_f20_u01_oidc_browser_pg15.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, and `docs/04_test_reports/F-20_U01_R20_NEXT_ACTIONS_BROWSER_RESULT.md`. Main alone owns control/status/Git/WSL resources.
- Do not change a product route, public API, schema, auth contract, browser UI, secret, or real account. Synthetic `dashboard:read` is test fixture permission only.
- The loopback QA browser evidence is a scoped integration check, **not** full formal `E-SHOT`/`E-NET`, U-01/F-20 acceptance, or C30 resolution.
- Develop locally; checkpoint/push the exact product SHA to the private branch; fast-forward the clean WSL-server QA checkout to that SHA before runtime QA. Ignore unrelated key failures as instructed, but do not call an unexecuted test PASS.

## Review Focus

- Missing `dashboard:read`: Dashboard action must be blocked rather than falsely displayed as empty.
- Valid stored alert: API `next_actions` priority/reason/target/action/deep link must match the persisted alert, and the card must display the same values as text.
- Revoked permission: card must show `BLOCKED` and remove the previously visible action; Alerts state must remain independently checked.
- A malformed or secret-bearing action must never be accepted as a browser evidence success; existing R19 unit and R6 secret audit cover this without adding a new fixture endpoint.
- Every page request URL, not only API calls, must remain in the scoped origin with no credential leak; loopback host disqualifies formal full E-NET acceptance.

---

### Task 1: Exact API and DOM assertions

**Files:** Modify `tests/integration/test_f20_u01_oidc_browser_pg15.py`; modify `tests/browser/f20-u01-oidc-browser-pg15.mjs`; create R20 result report.

**Interfaces:** Python passes the expected action values derived from `before[0]` to the existing Node process as sanitized environment values. Node consumes `GET /api/dashboard/operations` and the existing `section[aria-labelledby="next-actions-heading"]`; it extends the existing `R6_RESULT` evidence object with bounded boolean/count facts, never raw credential or URL values.

- [ ] Add a failing browser-harness self-test that rejects a mismatch between the API action row and the seeded alert/DOM, including an absent permission case. Run `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test`; expect a focused failure before implementation.
- [ ] Give only the synthetic OIDC operator's test role `dashboard:read`, leaving product permissions unchanged. On a stored alert, assert a 200 Dashboard response, exact one action and field correspondence with the alert; assert the visible Next Actions card contains priority, reason, target and action without exposing raw JSON.
- [ ] Revoke `dashboard:read` with the fixture's existing role revocation. Assert Dashboard 403, Next Actions `BLOCKED`, no prior action row, while the existing Critical Alerts revoke check remains intact. Preserve empty/pre-auth/error screenshot and network-collection behavior.
- [ ] Run Node syntax/self-test and focused Python non-opt-in tests locally. Run existing R19 console tests, typecheck, lint, build; report exact exits and remove only verified task-created build output.

### Task 2: Exact-SHA isolated WSL-server browser QA

**Files:** Update only the R20 result report and Main-owned status/control files after QA; preserve raw test outputs in scoped evidence only if the control allowlist permits them.

**Interfaces:** Existing R6 opt-in uses `ANVIL_F20_R6_PG_DSN`, `ANVIL_F20_R6_PG_ISOLATED=1`, `ANVIL_F20_R6_FRONTEND_DIST`, and `ANVIL_F20_R6_BROWSER_COMMAND_JSON`. Container guard requires `anvil-u01-r6-pg-<sha7>`, labels `F-20/U-01/R6` and `<sha7>`, `postgres:15`, AutoRemove, loopback `127.0.0.1:5545`, tmpfs data `rw,size=256m`, no bind/volume, and non-superuser DB/role `anvil_f20_r3a_<sha7>`.

- [ ] Main records exact temporary resource identities, owner, lifetime, and cleanup in `WORK_STATUS` before creation. Preflight the clean QA checkout at the pushed SHA; check names, port 5545, pytest/TLS/evidence paths, `node_modules` and `apps/web/dist` are absent before use.
- [ ] Build the frontend with a task-owned Node container; start only the isolated PG15 container; create only its role/DB/migration; run the synthetic OIDC/Chromium opt-in with its own `--rm` container and 1920×1080 viewport. Keep diagnostic drain OFF.
- [ ] Verify actual API/DOM facts, 3 screenshots and full page-request URL list, secret checks, exact SHA and command exits. Inspect screenshots visually. Treat first failure as failure, not PASS, and diagnose before any bounded retry.
- [ ] Verify exact container/image/labels/mount/port/path ownership before removing the task-created PG/browser/node, pytest/TLS/evidence and generated checkout outputs. Confirm residue zero, checkout clean and G-05 PASS. Never touch shared `/srv`, `anvil-web`, another DB/container, or Production.
- [ ] Commit/push the R20 result and Main status/control checkpoint on the existing branch; fast-forward WSL QA checkout to that final SHA, verify clean/G-05, then revoke write→worker lease. Keep formal U-01/F-20 and C30 statuses unchanged.

## Self-review

R20 checks only the R19 Next Actions slice. It does not cover the six operational cards, all seven UI states, user acceptance, formal E-SHOT/full E-NET, ReleaseManifest or rollback. These remain separate U-01/F-20 gates. The named file and resource boundaries leave one reasonable implementation and cleanup path without changing the public contract.
