# C-21 / LR-02C Operational Execution WorkInstruction

## 1. 권위와 목표

- ID: `WI-C-21-LR-02C-OPS-20260903-001`
- 기준 release commit: `f39471a103d35406c3744fd727119072994a0d6a`
- 부모 승인: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- 실행자: `main-agent-eoul`
- 목표: 승인된 release commit을 `ysna-server`의 `anvil-web:3770`에 표준 Git/manifest/deploy 경로로 배포하고 production canonical Task→Run→Event, authenticated SSE/Last-Event-ID, Telegram signed POST 정확히 1회, 9 Provider 비과금 metadata probe를 검증한다.
- C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`를 유지한다.

## 2. Lease

- Worker: `worker-lease-c21-lr02c-ops-20260903-003`
- Execution token: `c21-lr02c-ops-execution-fence-epoch-3-f39471a`
- Write: `write-lease-c21-lr02c-ops-20260903-003`
- Write token: `c21-lr02c-ops-write-fence-epoch-3-f39471a`
- repository write는 redacted 운영 증거 4개 경로로 제한한다.

## 3. 실행 순서

1. `origin/main`에서 release commit과 승인된 `deploy/ysna/ReleaseManifest.json` 결박을 검증한다.
2. 기존 `INCIDENT_HOLD` receipt가 있으면 backup·Git·Docker·HTTP·DB·Telegram·Provider 전에 exit 91로 중단한다.
3. `backup-c21-db.sh`로 production DB backup bytes/SHA-256/restore-listability/mode 0600을 확보한다.
4. 표준 `deploy.sh`로 release commit만 checkout/build/migration/deploy한다. 서버 직접 patch와 `scp`는 금지한다.
5. `verify.sh`로 UI·health·OpenAPI·Task→Run→Event·authenticated SSE·Last-Event-ID를 검증한다.
6. release-bound Telegram `/status` signed POST는 정확히 1회만 수행하고 DB update/audit exact-one으로 판정한다. 불확실하면 재시도하지 않는다.
7. CEREBRAS, GROQ, MISTRAL, OPENROUTER, UPSTAGE, GEMINI, ANTHROPIC, OPENAI, OLLAMA는 read-only metadata endpoint만 호출한다. generation/chat/completions/embedding/fallback은 금지한다.
8. 성공·실패·signal 모두 test-session 환경을 복원하고 `anvil-web`을 force-recreate한다. 복원/recreate 실패는 sticky `INCIDENT_HOLD`, exit 90으로 전환한다.

## 4. 고정 경계

- public 경로와 listener는 기존 `https://anvil.sinsan.kr` 및 `anvil-web:3770`만 사용한다.
- NPM·DNS·secret 정책을 변경하지 않는다.
- Provider redirect 금지, 3초 timeout, 64KiB cap, credential/endpoint/body 비기록을 유지한다.
- 기존 production row 삭제·임의 수정, migration downgrade, trigger disable, 가짜 event/approval을 금지한다.
- 이전 release/partial evidence를 덮어쓰거나 성공 증거로 재사용하지 않는다.
- 운영 receipt에는 secret, token, cookie, DSN, payload body를 기록하지 않는다.

## 5. Repository evidence write scope

1. `docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md`
2. `docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md`
3. `docs/evidence/receipts/C-21_LR02C_OPERATIONAL_EXECUTION_RECEIPT.json`
4. `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_EXECUTION_MANIFEST.json`

실행 종료 후 lease를 회수하고 Main Agent가 progress/HANDOFF/event projection을 별도로 갱신한다.
