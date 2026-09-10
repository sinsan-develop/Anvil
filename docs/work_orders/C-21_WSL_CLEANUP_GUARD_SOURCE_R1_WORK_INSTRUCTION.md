# WI-C-21-WSL-CLEANUP-GUARD-SOURCE-R1-20260907-001

- Parent: `797b4d831e384423fdd9a706f9512ffa9dc79bb5`
- Scope: exact15 / cumulative exact143.
- Remove only the duplicate guard source inside `cleanup_wsl_test_volumes`; `cleanup.sh` remains the sole guard source and keeps its validation before loading the environment.
- Preserve all exact resource, label, endpoint and deletion allowlist preflight checks. Validate twice: the entrypoint validation and the cleanup function validation.
- Prior runtime result is recorded evidence only: guard readonly redeclaration stopped before Docker inventory; cleanup resource mutation was `0`.
- Excluded: Provider, Telegram, WSL/Docker/DB runtime, ysna, main merge, push, and cleanup retry.
