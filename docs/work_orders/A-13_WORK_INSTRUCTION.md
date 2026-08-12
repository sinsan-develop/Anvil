# A-13 WorkInstruction — Read-Only Repository Scan Adapter

- artifact_id: `WI-A-13-20260812-001`
- package/status: `A-13 / READY`
- executor: `developer-primary-a13`
- baseline_git_commit: `505f8607b2918cf4f561970b40eedea5234ef7eb`
- source_spec_sha256: `0AEFB471329EA9FFAF6EBBE25A995EBE584984DA9F7F9B6C1917C3F1BE5E3A61`
- source_plan_sha256: `82D156331F896480F265912893287A1116A39DB5788735210459B129122BCE1A`
- assigned: `AV-SAFE-010`, `AV-SAFE-012`
- verdict/runtime: `READ_ONLY_FIXTURE_INTEGRATION_PASS / USER_REPO_RUNTIME_NOT_EXECUTED`

Implement a reusable stdlib-only repository scan adapter with request/result schema, canonical path/allowed-root guard, read-only Git collector, full file inventory, inert project/tool manifest detection, pre/post no-write proof, and structured JSON errors.

Use `GIT_OPTIONAL_LOCKS=0`, allowlisted read-only Git commands, output/temp outside scanned repository, and identical pre/post algorithms for HEAD, branch, porcelain-v2, index/refs/config/lock, and every file path/type/size/mtime_ns/content hash/mode. Any delta rejects the scan. Do not execute project commands, hooks, Skills, AGENTS instructions, package install, or network.

Developer allowed only `packages/repository_intelligence/**`, `tests/tooling/test_a13_repository_scan.py`, `scripts/check_a13_repository_scan.py`, `tests/fixtures/a13/**`, `docs/architecture/a13/**`, `docs/validation/A-13_REPOSITORY_SCAN_VALIDATION.md`, `docs/evidence/manifests/A-13_EVIDENCE_MANIFEST*.json`, `docs/completion_reports/A-13_COMPLETION_REPORT.md`.

Observe TDD RED. Verify all 8 immutable G-06 fixtures, especially dirty/untracked content+mtime+status, plus non-Git, outside-root, symlink escape, malicious manifest/hook, network/tool/output-inside/limit/timeout and injected-write detection. G-06/A-03/A-12 accepted evidence, authority, progress/HANDOFF, unrelated packages/apps/dependencies/config, actual user repositories, Git refs/index, network, commit/push are forbidden. Browser/API/DB/WSL/production/DIR remain NOT_EXECUTED.
