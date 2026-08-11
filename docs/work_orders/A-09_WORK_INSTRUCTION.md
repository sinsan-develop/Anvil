# A-09 WorkInstruction — Learning·Skill·Hook·Agent Catalog 정적 계약

- artifact_id: `WI-A-09-20260812-001`
- package/status: `A-09 / READY`
- executor: `developer-primary-a09`
- baseline_git_commit: `837d593033511583d282b33ce2b0c5537c38e555`
- source_spec_sha256: `AC4C5E1102916D5E1F1BBEC17CC25E0AF2F516091BA97510C4988E65F1B26C1A`
- source_plan_sha256: `927DC7C55F4BBC4B6E87C823CBECF54C528E9112021354196FAB8A1BD42CF625`
- assigned: `AV-LRN-018`, `AV-LRN-024`
- verdict/runtime: `STATIC_CONTRACT_PASS / D-12_RUNTIME_DEFERRED_NOT_EXECUTED`

Create static contracts for Learning Source/Review/Candidate, Evaluation/Approval/Activation/Rollback, Skill Catalog+Selection Trace, Hook Catalog+Replay, AgentDefinition Catalog, and end-to-end lineage.

Enforce source provenance/hash/license/confidentiality/scans/revoke impact; candidate/evaluation/activation/applied separation; immutable current Run snapshot; Skill 3-task pilot+human approval and selection reason/rejected candidates/resources/preconditions; Hook definition/program hash+principal+permission, shadow no-side-effect, pilot replay, trust invalidation, precedence and modify conflict; AgentDefinition permission narrowing and no persistent memory/Hook subagent spawn.

Developer allowed only `docs/architecture/a09/**`, `scripts/check_a09_learning_automation.py`, `tests/tooling/test_a09_learning_automation.py`, `tests/fixtures/a09/**`, `docs/validation/A-09_*`, `docs/evidence/manifests/A-09_EVIDENCE_MANIFEST*.json`, `docs/completion_reports/A-09_COMPLETION_REPORT.md`.

Create catalog, focused Markdown, 1920×1080 static SVGs, checker/test/fixtures, validation, manifest, completion. TDD RED first; hostile stable codes for source/candidate/activation/rollback, Skill lifecycle/selection/progressive disclosure, Hook trust/shadow/pilot/precedence/timeout/permission/recursion, Agent permission, secrets/static promotion/manifest bypass. Authority/A01-A08/progress/apps/packages/dependencies/runtime/commit/push forbidden. Actual Skill/Hook activation/runtime/DIR NOT_EXECUTED.
