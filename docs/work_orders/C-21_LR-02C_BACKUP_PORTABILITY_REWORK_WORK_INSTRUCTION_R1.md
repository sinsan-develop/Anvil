# C-21 / LR-02C Backup Portability Rework WorkInstruction R1

## 1. Authority and objective

- ID: `WI-C-21-LR-02C-BACKUP-PORTABILITY-R1-20260903-001`
- Parent: `WI-C-21-LR-02C-OPS-20260903-001`
- Approval: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- Dispatch base: `517fb4c39a3a9841eb5a07322235eb71989f1ec4`
- Executor: `developer-primary-c21-backup`
- Failure fingerprint: `C21_BACKUP_HOST_PG_DUMP_UNAVAILABLE`
- Objective: preserve the verified host-tool backup path and add a fail-closed `shared-db` PostgreSQL 18 tool fallback when either host `pg_dump` or host `pg_restore` is unavailable.

This is an internal implementation correction. Feature scope, requirements, public routes, NPM, DNS, database schema, Provider behavior, Telegram behavior, and approved operational risk do not change.

## 2. Fencing

- Worker lease: `worker-lease-c21-backup-portability-20260903-004`
- Execution token: `c21-backup-portability-execution-fence-epoch-4-517fb4c`
- Write lease: `write-lease-c21-backup-portability-20260903-004`
- Write token: `c21-backup-portability-write-fence-epoch-4-517fb4c`
- Exact write paths:
  1. `deploy/ysna/backup-c21-db.sh`
  2. `tests/deploy/test_c21_lr02c_operational_contract.py`

## 3. Required behavior

1. If both host `pg_dump` and `pg_restore` exist, retain the existing host path.
2. If either host tool is absent, require `docker`, a running exact container named `shared-db`, and both PostgreSQL tools inside it.
3. Stream the custom-format dump from container stdout to the host-owned temporary file. Do not use a container temporary file or `docker cp`.
4. Stream the host dump to container stdin for `pg_restore --list` validation.
5. Pass the DSN through stdin to a container shell and assign it to `PGDATABASE`; do not place it in the inner process argv, logs, receipt, or output.
6. If the selected host path starts and fails, do not retry with the container path.
7. Preserve atomic receipt publication, mode `0600`, SHA-256, non-empty dump/list checks, and cleanup on every failure.
8. Do not change Compose, network attachment, server packages, `.env`, deployment scripts, Provider, Telegram, migration, or product runtime.

## 4. Verification

- RED: a test with no host PostgreSQL tools proves the current script fails before a backup.
- GREEN: host path success, shared-db fallback success, fallback prerequisite failure, dump failure without success receipt, restore-list failure without success receipt, DSN redaction.
- Run: `python -m pytest -q tests/deploy/test_c21_lr02c_operational_contract.py`.
- Run: `bash -n deploy/ysna/backup-c21-db.sh` using the repository's available Git Bash.
- Report exact commands, exit codes, changed paths, skipped checks, and rollback.

## 5. Completion and rollback

- Completion is `COMPLETED` only when the focused test and syntax check pass and only the exact two write paths changed.
- No external SSH, Docker, DB, HTTP, Telegram, Provider, commit, push, or deploy is permitted to the Developer.
- Rollback is reverting the two exact-path changes before a new release is deployed.
