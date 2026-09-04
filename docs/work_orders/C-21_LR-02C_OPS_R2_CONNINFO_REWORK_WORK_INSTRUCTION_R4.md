# C-21/LR-02C OPS-R2 Conninfo 재작업 WorkInstruction R4

- WorkInstruction ID: `WI-C-21-LR-02C-OPS-R2-CONNINFO-R4-20260904-001`
- package: `C-21/LR-02C/OPS-R2`
- executor: `developer-primary-c21-ops-r2`
- dispatch base: `eef349682ff5598e3488c9e75163c5e0a99a0bdb`
- failure lineage: `C21_BACKUP_LIBPQ_DSN_SCHEME_INCOMPATIBLE`
- valid failure count: `2`
- worker/write lease: 기존 epoch 5 ACTIVE continuation
- external side effects: `FORBIDDEN`

## 실패 증거

- 운영 backup attempt 2는 Git blob `b4858ffb373066b24d7d9ee9bfde810160cacb75`에서 exit `20`으로 실패했다.
- scheme 정규화 이후에도 URI 전체가 literal dbname으로 처리됐다.
- self DNS, local socket, direct TCP authentication은 성공했다.
- `PGDATABASE` URL connect/dump는 실패했고 service fd3 connect/schema dump는 성공했다.
- backup receipt/success, deploy, Telegram, Provider는 실행 또는 생성되지 않았다.

## 구현 계약

- `ANVIL_DATABASE_URL`은 Python 3 stdlib가 stdin으로 parse하고 percent-decode 후 strict validate한다.
- 허용 scheme은 `postgresql+psycopg2`, `postgresql`, `postgres`다.
- user, host, dbname은 필수이며 port는 존재할 경우 1~65535여야 한다.
- decoded NUL/CR/LF와 fragment, malformed percent escape를 거부한다.
- query는 `sslmode`, `connect_timeout`, `application_name`, `options`만 단일값으로 허용하고 duplicate, unknown, core override를 거부한다.
- `[anvil_backup]` service stanza를 stdout으로 렌더하고 quote/backslash를 libpq service 형식에 맞게 escape한다.
- host/container 모두 pipe→fd3, `PGSERVICEFILE=/dev/fd/3`, `PGSERVICE=anvil_backup`만 사용한다.
- credential/URI는 argv, log, receipt, disk에 쓰지 않는다. container temp file을 만들지 않고 dump stdout은 host temp file에만 둔다.
- Python 3 부재와 pg_dump 실패는 fail-closed하며 fallback하지 않는다.

## exact write scope

1. `deploy/ysna/backup-c21-db.sh`
2. `tests/deploy/test_c21_lr02c_operational_contract.py`
3. `docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md`
4. `docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_WORK_INSTRUCTION_R4.md`
5. `docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_INVOCATION_PROMPT_R4.md`
6. `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json`
7. `docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-conninfo-rework-r4.json`
8. `docs/progress/build-progress.json`
9. `docs/progress/BUILD_HANDOFF.md`
10. `docs/progress/progress-events.json`
11. `docs/progress/failure-ledger.json`
12. `scripts/check_project_progress.py`
13. `tests/tooling/test_project_progress.py`

## 완료 경계

- focused backup contract, Bash syntax, checker, tooling, API, ysna scripts 및 diff 검사를 실행한다.
- 제품 checkpoint commit과 feature push까지만 허용한다.
- ReleaseManifest rebind, main merge, deploy, Telegram, Provider는 금지한다.
- C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`를 유지한다.
