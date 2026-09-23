# C-10 Main TakeoverPacket

- package: `C-10`
- trigger: `SAME_ROOT_CAUSE_REVIEW_FAILURE_3`
- predecessor: `e416898d231e0f6ef72d01c85378c0f3e48a0d11`
- predecessor sequence: `849`
- developer status: `STOPPED`
- developer worker/write lease: `REVOKED`
- user direction: `Main takeover 승인`
- user direction SHA-256: `935088D3CD683FE8A10965538301343FA251C9AD61AAFAC7679F534A5831DE78`
- interpretation: `ALLOW_C10_MAIN_DIRECT_TAKEOVER`
- functional scope, requirements, material risk: `UNCHANGED`

## Preserved product snapshot

- `docs/04_test_reports/C-10_COMPLETION_REPORT.md`
- `packages/action_policy/__init__.py`
- `packages/action_policy/admission.py`
- `packages/action_policy/policy.py`
- `tests/action_policy/test_c10_policy.py`
- `tests/action_policy/test_policy.py`

## Remaining blockers

1. Read-like commands may still produce output, invoke external helpers, install dependencies, delete temp paths, or escape repository scope through argv/environment effects.
2. Raw-secret key detection misses suffix variants such as `apiKeyValue` and `privateKeyPem`.
3. Hostile Mapping `OSError` can escape structured denial, and safe verification parsing must preserve `python -B -m pytest` compatibility.

Main Agent modifies only the preserved product scope, uses TDD, and performs no actual filesystem/subprocess/network/Secret Broker/DB/API/browser/WSL/Docker/deployment action.
