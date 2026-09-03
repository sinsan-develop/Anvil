# C-21 / LR-02C Operational Execution Rework R2 WorkInstruction

## 1. 권위와 목표

- ID: `WI-C-21-LR-02C-OPS-R2-20260903-001`
- dispatch base: `ca945dfe4fed9befedc46620aff24729c3898952`
- 실패한 release target: `095e1488ed85ec11986447539d04cf2b494dbd34`
- 부모 승인: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- 실행자: `developer-primary-c21-ops-r2`
- 목표: 운영 backup attempt 1의 libpq DSN scheme 호환 실패를 계약 테스트로 재현하고, SQLAlchemy DSN을 secret 노출 없이 PostgreSQL client가 수용하는 DSN으로 정규화한다.
- C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`를 유지한다.

## 2. 실패 기준선

- `ysna-server` preflight는 `INCIDENT_HOLD` 부재, `.env` mode `600`, `shared-db` 실행, `anvil-web` healthy를 확인했다.
- backup attempt 1은 exit `20`으로 dump/receipt 생성 전에 종료됐다.
- 원인은 `postgresql+psycopg2://...` SQLAlchemy DSN이 libpq에 전달되어 database name으로 해석된 것이다.
- Telegram signed POST와 Provider probe는 실행하지 않았고 신산님 직접 검증 대기인 `USER_VERIFICATION_PENDING`을 유지한다.

## 3. Lease

- Worker: `worker-lease-c21-lr02c-ops-r2-20260903-005`
- Execution token: `c21-lr02c-ops-r2-execution-fence-epoch-5-ca945df`
- Write: `write-lease-c21-lr02c-ops-r2-20260903-005`
- Write token: `c21-lr02c-ops-r2-write-fence-epoch-5-ca945df`

## 4. 정확한 write scope

1. `deploy/ysna/backup-c21-db.sh`
2. `tests/deploy/test_c21_lr02c_operational_contract.py`
3. `docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md`
4. `docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION_R2.md`
5. `docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT_R2.md`
6. `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_REWORK_START_R2_MANIFEST.json`
7. `docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-rework-start-r2.json`
8. `docs/progress/build-progress.json`
9. `docs/progress/BUILD_HANDOFF.md`
10. `docs/progress/progress-events.json`
11. `docs/progress/failure-ledger.json`
12. `scripts/check_project_progress.py`
13. `tests/tooling/test_project_progress.py`

seq1~469와 backup-portability acceptance 파일은 immutable predecessor다. 위 경로 외 mutation, 기존 `C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md` 변경, compose/NPM/DNS/secret 변경은 금지한다.

## 5. 구현·검증 순서

1. DSN scheme 회귀 테스트를 먼저 추가하고 기존 코드에서 의도한 실패를 확인한다.
2. username/password/host/port/database/query를 보존하면서 `postgresql+psycopg2` scheme만 libpq 호환 `postgresql`로 정규화한다.
3. DSN, credential, payload body를 stdout/stderr/receipt에 기록하지 않는다.
4. focused 계약 테스트, Bash syntax, project progress checker와 tooling 계약을 실행한다.
5. 새 implementation commit과 ReleaseManifest가 결박되기 전에는 운영 backup을 재시도하지 않는다.

## 6. 고정 경계

- `anvil-web:3770`, `envil.sinsan.kr`, `shared-db` 외 runtime topology를 만들지 않는다.
- Telegram/Provider 실호출은 이 WorkInstruction 범위가 아니다.
- server direct patch, `scp`, dirty checkout 배포, migration downgrade를 금지한다.
- 실패한 attempt 1을 성공 증거로 승격하거나 재시도 횟수에서 지우지 않는다.
