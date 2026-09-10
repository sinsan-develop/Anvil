# C-21 WSL rollback scope compatibility R1 validation

- RED: seq554 focused contract `3 failed, 105 deselected`.
- GREEN: seq554 focused contract `3 passed, 105 deselected`.
- Shell syntax: rollback and candidate guard PASS.
- Scope map: exact allowlist key order; candidate exact4; observed/previous exact3.
- Mutation safety: both targets preflight before mutation; process-local override; marker/receipt after health.
- Historical event bytes: seq1-548 preserved by projection builder.
- Main takeover historical+allowlist focused: `10 passed in 22.27s`.
- Full deploy contract: `106 passed, 2 skipped in 888.04s`.
- Full tooling contract: `199 passed in 916.77s`.
- Live checker, rollback/guard shell syntax, diff-check: PASS.
- skip 2건은 Windows/NTFS POSIX mode와 WSL Compose parser 전용 항목으로 실제 WSL rollback PASS로 승격하지 않음.
- External actions in this implementation package: Provider/Telegram/WSL/push/ysna/main `NOT_EXECUTED`.
- Remaining: final projection rebinding and independent review before commit.
