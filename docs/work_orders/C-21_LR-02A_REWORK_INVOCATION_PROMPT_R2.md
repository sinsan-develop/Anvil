# C-21/LR-02A R2 invocation

Read `AGENTS.md`, all authority documents, `docs/work_orders/C-21_LR-02A_REWORK_WORK_INSTRUCTION_R2.md`, the R1 developer report, and `docs/04_test_reports/C-21_LR02A_INDEPENDENT_TEST_REPORT.md` before editing.

Use execution fence `c21-lr02a-execution-fence-epoch-2-e57f008` and write fence `c21-lr02a-write-fence-epoch-2-e57f008`. Work only in the R2 exact11 set. First restore the frozen LR-01 report and create the unique LR-02A report. Then reproduce the seven accepted blockers with executable tests, implement the minimum correction, and run every verification in the WI.

Do not touch Main projection files, frozen R1 ASGI/compose/README/API-test changes, external infrastructure, secrets, DB state, NPM, Telegram, Provider, containers, Git history, commit, push or merge. Report evidence honestly; static/fake-command checks do not prove production deployment.
