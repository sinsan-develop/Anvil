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
