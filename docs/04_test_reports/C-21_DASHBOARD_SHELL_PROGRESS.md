# C-21 Dashboard Shell Progress

## 2026-09-09 — TDD RED started

- Package: C-21 Dashboard Shell (`codex/c21-wsl-acceptance-auth-r1`, `0f770e4`)
- Changed files: `apps/web/tests/app-shell.test.mjs`, `tests/api/test_public_asgi_frontend.py`, this progress file
- RED: `node --test apps/web/tests/app-shell.test.mjs` exit 1; missing `app-shell-model.js` was the expected pre-implementation failure. API RED could not run because this worktree has neither a Python executable nor a configured `py` default.
- Error count: 0
- Unverified: full web/API regression, browser rendering, WSL/remote/DB/container; excluded by work instruction.
- Next: execute focused RED, confirm missing Dashboard Shell contract, then minimally implement the approved files.

## 2026-09-09 — GREEN and local verification

- Changed files: `apps/web/index.html`, `apps/web/provider-workbench.html`, `apps/web/server.mjs`, `apps/web/src/app/app-shell.js`, `apps/web/src/features/app-shell/app-shell-model.js`, `apps/web/src/styles/app-shell.css`, `apps/web/tests/app-shell.test.mjs`, `apps/web/tests/ui-preview-runtime.test.mjs`, `tests/api/test_public_asgi_frontend.py`, this progress file.
- GREEN: `node --no-warnings --test apps/web/tests/app-shell.test.mjs` → 3 passed; `node --no-warnings --test apps/web/tests/*.test.mjs` → 24 passed.
- Static checks: `git diff --check` exit 0; browser source host scan (`localhost|127.0.0.1|anvil-api|shared-db|https?://`) exit 0.
- Error count: 0 formal implementation failures. The initial all-web regression exposed the obsolete root-workbench expectation once; its test was revised to the approved Dashboard/Provider split and then passed.
- Unverified: `py -m pytest tests/api/test_public_asgi_frontend.py -q` cannot run because no default Python is installed in this worktree; actual browser rendering and `/health/ready` response remain unverified. WSL/remote/DB/container work was not performed by scope.
- Next: review exact diff and stage only the listed Dashboard Shell files for the required local commit.

## 2026-09-09 — Reviewer rework round 1

- Scope: reviewer-required Dashboard Shell corrections only; no WSL, remote, DB, container, Provider, or migration action.
- Changed files: `apps/web/index.html`, `apps/web/src/app/app-shell.js`, `apps/web/src/features/app-shell/app-shell-model.js`, `apps/web/src/styles/app-shell.css`, `apps/web/tests/app-shell.test.mjs`, this progress file.
- RED: `node --no-warnings --test apps/web/tests/app-shell.test.mjs` first failed because `DASHBOARD_OPERATIONS` was absent; after browser observation exposed English property-name headings, the strengthened contract then failed on the missing `DASHBOARD_OPERATION_DEFINITIONS` export. Both failures were expected pre-implementation contract gaps.
- GREEN: focused app-shell test 3 passed; full Web test suite `node --no-warnings --test apps/web/tests/*.test.mjs` → 24 passed; `git diff --check` and browser-source host scan passed.
- Browser evidence: local static server at 430px yielded `clientWidth=415`, `scrollWidth=415`; sidebar collapse changed `aria-expanded` true→false and button name to `메뉴 펼치기`, then restored the menu. The expanded menu retained all names; PREPARING items had `aria-disabled=true`, `tabindex=-1`, and no `href`. With no local `/health/ready` route, Database changed to truthful `NOT_CONNECTED`/`FAILED` rather than a success state.
- Error count: 0 formal implementation failures; two expected RED contract gaps resolved. Operations exact set is now 실행 중/승인 대기/BLOCKED/필수 Gate 미통과/예상 비용 초과/baseline 충돌; `failedRuns` is removed. Health cards expose icon, status, short explanation, last checked, error count, and an explicitly unavailable detail-link field.
- Unverified: Python API pytest remains unavailable because no default Python is installed; a successful real `/health/ready` response, WSL/remote/DB/container remain unverified by scope.
- Next: stage only rework files, run staged verification, and commit the reviewer rework.

## 2026-09-09 — Main 검증 및 독립 재검토

- Main API 회귀: 검증된 Anvil venv로 `pytest -p no:cacheprovider` 관련 API 6파일 실행 → `71 passed in 5.09s`.
- Main Web 회귀: `node --no-warnings --test apps/web/tests/*.test.mjs` → `24 passed`, 실패 0.
- Main diff: `git diff --check` → PASS.
- 독립 Reviewer 재검토: `ACCEPTED`, Critical 0 / Important 0 / 비차단 Minor 1.
- 독립 Chromium 430×932: `clientWidth=scrollWidth=430`, menu 11, health 6, operations exact 6, collapse/restore와 ARIA 상태 PASS.
- 비차단 Minor: 430px 검증이 repository 자동 browser regression suite에는 아직 편입되지 않았으며 이번 scoped acceptance에서는 수동 독립 증거로 보존.
- 다음 조치: exact commit을 development candidate ref로 push하고 WSL-server의 정식 `anvil-web` 하나에 Git 배포하여 `/` Dashboard, `/provider-workbench.html`, health를 실제 브라우저/API로 검증한다.
