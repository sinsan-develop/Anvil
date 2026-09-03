# C-21 / LR-02C WorkInstruction

## 1. 권위와 목표

- ID: `WI-C-21-LR-02C-20260903-001`
- 기준 HEAD: `dd4cc43452d30511ecf1a152e48408b7122391c0`
- 부모 승인: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- 목표: production canonical C-21 Task→Run→Event 체인과 배포·SSE·Telegram 1회·Provider 비과금 probe를 안전하게 실행할 로컬 도구와 계약 테스트를 구현한다.
- 이 WorkInstruction에서 외부 side effect는 실행하지 않는다. 실제 운영 실행은 검증·commit/push 후 Main Agent가 수행한다.
- C-01은 계속 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.

## 2. Lease

- Worker: `worker-lease-c21-lr02c-20260903-001`
- Execution token: `c21-lr02c-execution-fence-epoch-1-dd4cc43`
- Write: `write-lease-c21-lr02c-20260903-001`
- Write token: `c21-lr02c-write-fence-epoch-1-dd4cc43`
- Agent: `developer-primary`

## 3. Exact write paths

1. `deploy/ysna/backup-c21-db.sh`
2. `deploy/ysna/provision-c21-validation.py`
3. `deploy/ysna/rebind-c21-test-session.sh`
4. `deploy/ysna/probe-providers.py`
5. `deploy/ysna/verify.sh`
6. `deploy/ysna/ReleaseManifest.C21.DRAFT.json`
7. `tests/deploy/test_c21_lr02c_operational_contract.py`
8. `tests/deploy/test_ysna_scripts_contract.py`
9. `tests/deploy/test_ysna_deployment_contract.py`
10. `docs/04_test_reports/C-21_LR02C_OPERATIONAL_PROGRESS.md`
11. `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_EVIDENCE_MANIFEST.json`
12. `.superpowers/sdd/Anvil_작업계획서_v1/task-4-report.md`

다른 파일은 수정하지 않는다. seq1~435와 LR-02B acceptance 산출물은 동결한다.

## 4. 구현 계약

1. DB backup은 `pg_dump` 결과의 bytes/SHA-256/restore-listability와 mode 0600 receipt를 남기고 DSN·credential을 출력하지 않는다. backup 성공 전 production write를 허용하지 않는다.
2. provisioning은 release SHA에 결박된 전용 project/repository와 genuine authority lineage를 parameterized transaction으로 idempotent 생성한다. 기존 ID가 동일 payload면 replay, 다르면 fail-close한다. 다른 production row를 update/delete하지 않는다.
3. API가 만든 exact Task만 `DRAFT/v1 → CONFIRMED/v2` CAS 1행으로 전환한다. 이는 C-21 검증용 provisioning이며 일반 제품 confirm API PASS로 승격하지 않는다. 승인 artifact/hash/type/expiry 불일치 시 중단한다.
4. test-session run allowlist 변경은 기존 `.env`를 mode 0600 hash-backup 후 정확한 assignment 하나로 원자 교체하며 secret 값을 receipt/stdout에 노출하지 않는다. 검증 종료 시 이전 값을 원자 복원하거나 보존 결정을 evidence에 기록한다.
5. verify는 새 session으로 Task POST/GET, Run POST, authenticated initial SSE의 `TASK_CONFIRMED` seq1을 확인한다. 동일 `Last-Event-ID` 재개는 seq1 미재전송/빈 stream으로 cursor semantics를 판정하며 가짜 후속 event를 삽입하지 않는다.
6. Telegram `/status` native Update는 secret header와 allowlisted identity로 정확히 1회만 전송한다. timeout/응답 불확실 시 재POST하지 않고 DB update/audit로 판정한다.
7. Provider probe는 CEREBRAS, GROQ, MISTRAL, OPENROUTER, UPSTAGE, GEMINI, ANTHROPIC, OPENAI, OLLAMA를 다룬다. 공식 read-only health/model/metadata endpoint만 GET/HEAD 1회, 2~3초 timeout, redirect off, response cap과 redaction으로 호출한다. generation/chat/completions/embedding/fallback은 코드와 테스트에서 금지한다. 안전 endpoint가 없으면 `NOT_PROBED`, credential 없으면 `NOT_CONFIGURED`다.
8. receipt에는 commit/image/migration/config hash, resource IDs/counts/hash, 명령/exit/timestamp/acquisition mode만 기록하고 cookie/token/key/DSN/body를 넣지 않는다.
9. backup 불완전, commit/image/manifest mismatch, dirty checkout, migration head 이외 값, 기존 ID payload mismatch, approval 불일치/만료, CAS 1행 아님, API non-2xx, SSE cursor mismatch, Telegram 불확실, unsafe Provider endpoint 요구, secret 반사 시 즉시 후속 단계를 중단한다.

## 5. TDD·검증·제외

- 각 신규 스크립트의 실패 경계를 RED로 먼저 확인하고 GREEN을 남긴다.
- focused operational contract, 기존 ysna deploy 계약 전체, 전체 API 회귀, checker와 `git diff --check`를 실행한다.
- evidence manifest는 변경 제품·테스트·진행 보고서 raw checksum만 결박하고 자체 참조하지 않는다.
- 이 Developer 단계에서는 SSH/Docker/DB/NPM/NPM UI/Telegram/Provider/배포/commit/push를 실행하지 않는다.
- NPM/DNS/secret 정책 변경, schema downgrade, row delete, trigger disable, 가짜 approval/event, 일반 Task confirm API 추가, C-01 시작은 금지한다.
- 결과 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다.
