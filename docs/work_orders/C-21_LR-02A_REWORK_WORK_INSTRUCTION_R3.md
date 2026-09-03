# C-21 / LR-02A Rework WorkInstruction R3

## 1. 권위와 분류

- ID: `WI-C-21-LR-02A-20260903-003`
- 기준 HEAD: `e57f008d0916953dab3c9425322a1e8942ed0379`
- 부모 승인: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- 분류: `MAIN_RECONFIRMED_NON_SEMANTIC`
- 실패 계보: `C-21/LR-02A | LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`
- 유효 실패: 2회. 이번 R3에서 동일 실패가 다시 유효하게 확인되면 Developer를 중지하고 Main이 인수한다.
- 기능 범위·요구사항·중요 위험은 변경하지 않는다. C-01은 계속 차단한다.

## 2. Lease

- Worker: `worker-lease-c21-lr02a-20260903-003`
- Execution token: `c21-lr02a-execution-fence-epoch-3-e57f008`
- Write: `write-lease-c21-lr02a-20260903-003`
- Write token: `c21-lr02a-write-fence-epoch-3-e57f008`
- Agent: `developer-primary`

## 3. Exact write paths

1. `deploy/ysna/deploy.sh`
2. `deploy/ysna/verify.sh`
3. `deploy/ysna/rollback.sh`
4. `tests/deploy/test_public_deploy_pipeline.py`
5. `tests/deploy/test_ysna_deployment_contract.py`
6. `tests/deploy/test_ysna_scripts_contract.py`
7. `docs/04_test_reports/C-21_LR02A_R3_RUNTIME_READINESS_PROGRESS.md`
8. `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_R3_EVIDENCE_MANIFEST.json`
9. `.superpowers/sdd/Anvil_작업계획서_v1/task-2-r3-report.md`

다른 파일은 수정하지 않는다. R1/R2 코드·보고·증거·WorkInstruction과 seq1~413은 동결한다.

## 4. 필수 수정

1. 최초 canonical 전환에서도 rollback 자산을 old checkout에서 읽지 않는다. target commit의 compose/verify를 `git show`로 추출하고 blob 존재·hash를 확인한 뒤 versioned 디렉터리에 atomic하게 보존한다.
2. 동일 SHA 재실행은 distinct previous SHA를 덮어쓰지 않는다. rollback은 migration을 downgrade하지 않으며 보존된 자산만 사용한다.
3. canonical `deploy.sh`, `verify.sh`, `rollback.sh` 각각을 실제로 실행하는 격리 fake-command harness를 작성한다. 문자열 존재 검사만으로 완료하지 않는다.
4. verify는 실제 method와 경로를 사용한다. 최소한 공개 UI, health/live, health/ready와 migration body, OpenAPI, canonical API를 확인한다.
5. `POST /auth/session`에 승인된 bootstrap credential과 `Host`/`Origin`을 전달해 cookie jar를 만든다. secret·Authorization·cookie 값은 stdout/stderr/evidence에 기록하지 않는다.
6. `ANVIL_TEST_SESSION_RUN_IDS`의 allowlisted run ID 하나로 `GET /api/runs/{id}/events`를 호출한다. `Content-Type: text/event-stream`, 최초 event ID, `Last-Event-ID` 재개를 bounded timeout으로 확인한다.
7. Telegram integrations probe는 실제 POST 계약을 사용하되 외부 Telegram 전송이나 운영 DB 기록은 하지 않는 검증 가능한 내부/비변경 경계로 제한한다. 현재 승인 없이 외부 side effect를 실행하지 않는다.

## 5. 검증과 완료 계약

- RED에서 위 결함 중 적어도 하나를 실행형 테스트로 재현하고 GREEN을 남긴다.
- deploy/verify/rollback 실행형 harness, deploy-focused 회귀, Task/Run/SSE/auth/API 회귀, shell syntax, JSON, Alembic head, checker, `git diff --check`를 실행한다.
- R3 evidence manifest는 자체 참조하지 않으며 3 scripts, 3 tests, R3 progress report의 raw 7개만 결박한다.
- Docker/SSH/실제 DB/NPM/DNS/secret 변경/browser/deploy/container removal/Telegram/Provider 호출은 `NOT_EXECUTED`다.
- commit/push/merge하지 않는다. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`로 보고한다.
