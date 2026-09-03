# C-21 LR-02A R3 / Main takeover R4

Result: `COMPLETED` (independent R4 review pending).

- R3 independent review accepted the third valid failure for fingerprint `LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`; the Main Agent revoked the developer lease and took over directly.
- Target-commit rollback assets use `git show`, blob/hash validation, atomic file replacement, executable verify mode and an atomic `rollback-assets.current` pointer.
- `verify.sh` no longer probes nonexistent `/api/`, `/integrations/`, or `/auth/` GET routes. It validates the canonical OpenAPI paths, obtains a session with `POST /auth/session`, calls authenticated `GET /api/providers`, and verifies SSE plus `Last-Event-ID` resume with case-insensitive Content-Type handling.
- Telegram webhook verification is deliberately non-mutating: the POST-only OpenAPI contract is checked, but no audit row or Telegram side effect is generated in this local stage.
- A success-path harness executes canonical `deploy.sh` → `verify.sh` → `rollback.sh` bodies using isolated fake Git/Docker/curl adapters. It asserts the rollback asset/pointer, actual method/path calls, lowercase SSE header, resume header and secret non-disclosure.
- Main verification: success harness `1 passed`; C-21 deploy regression `40 passed`; API regression `84 passed`; shell syntax and `git diff --check` exit `0`.
- Tooling currently reports expected projection-construction failures because seq414~419 takeover events are not yet rebound into a new completion manifest/digest. This is not recorded as PASS until the final projection is built and rechecked.
- Full `tests/deploy` collection is `BLOCKED` by the existing local `.venv` omission of PyYAML in the unrelated public-preview test; the three C-21 deploy test files were run directly instead.
- No external Docker/SSH/DB/NPM/deploy/Telegram/Provider action was executed.
