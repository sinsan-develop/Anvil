# WI-C-21-WSL-ROLLBACK-SCOPE-COMPAT-R1-20260907-001

- Parent: `dfd75904e3b6ba0f453965607a95d6020bdc4466`
- Scope: exact16 / cumulative exact137.
- Add an exact test-session permission scope map for every rollback-approved commit.
- Parse and checksum the pinned manifest once in `rollback.sh`; reject missing, extra, duplicate, reordered, blank, whitespace-bearing, or duplicate scopes.
- Require the unchanged server `.env` to match the candidate scope. Preflight both targets' marker, previous revision, mapped scope, image revision, and Compose render before the first runtime mutation.
- Inject the previous commit's mapped scope into only the rollback Compose/health process environment. Write marker and receipt only after health succeeds. Do not edit `.env`.
- Preserve seq1-548 raw event bytes and append seq549-554.
- Runtime facts: both verify receipts PASS; first PG15 rollback stopped unhealthy while marker stayed candidate; PG18 mutation was not started; `.env` stayed byte/mode-identical; standard redeploy restored both candidates healthy.
- Excluded: Provider, Telegram, ysna, main merge, commit, push and WSL/runtime execution in this local package.
