# C-21 / LR-02C 운영 실행 도구 작업현황

- 상태: `REWORK_R3_COMPLETED_PENDING_INDEPENDENT_REREVIEW`
- 담당: `developer-primary` 구현 후 동일 오류 3회에 따라 `main-agent-eoul` 인수
- WorkInstruction: `WI-C-21-LR-02C-20260903-001`
- WorkInstruction SHA-256: `C0F78E48718059241C868AB3891FC30095C1D3627D1E133A33178C97BA48212D`
- 기준 branch/HEAD: `codex/c21-lifecycle-runtime` / `dd4cc43452d30511ecf1a152e48408b7122391c0`
- Worker lease: `worker-lease-c21-lr02c-main-takeover-20260903-002`
- Write lease: `write-lease-c21-lr02c-main-takeover-20260903-002`
- 외부 side effect: `NOT_EXECUTED`

## 구현 결과

- DB backup은 custom-format dump의 bytes, SHA-256, restore-listability, mode 0600 receipt를 남기며 DSN을 출력하지 않는다.
- C-21 provisioning은 release-bound deterministic authority lineage를 구성하고 approval receipt를 검증한 뒤 parameterized transaction으로 prepare/confirm/Telegram audit를 처리한다.
- Task confirm은 지정된 API-created Task 한 건의 `DRAFT/v1 -> CONFIRMED/v2` CAS로 제한한다.
- test-session rebind는 기존 runtime env를 mode 0600/hash backup하고 run/project/scope assignment를 정확히 한 번만 원자 교체한다. verify의 통합 finalizer는 성공·실패·signal 종료 모두에서 원본 env를 복원하고 `anvil-web`을 재생성한 뒤에만 최종 증거를 확정한다.
- Provider probe는 CEREBRAS, GROQ, MISTRAL, OPENROUTER, UPSTAGE, GEMINI, ANTHROPIC, OPENAI, OLLAMA 9개를 대상으로 안전한 read-only metadata endpoint만 사용하며 generation endpoint를 거부한다.
- verify는 backup 선행조건, release/manifest/image/migration, Task POST/GET, Run POST, authenticated SSE, 동일 Last-Event-ID 무재전송, Telegram signed POST 정확히 1회와 DB audit, Provider generation 0을 fail-close로 검증한다.

## 오류 및 인수 기록

- 초기 TDD RED: 신규 operational contract 8개 중 7개가 도구 부재 및 backup preflight 부재로 의도대로 실패했다.
- Subagent 내부 검증에서 `verified C-21 database backup receipt mismatch`가 Windows mode 표현 차이로 3회 반복됐다.
- 반복 횟수 3회 도달 즉시 Subagent를 중단하고 Main Agent가 write lease를 인수했다.
- Main 인수 후 실제 잔여 원인은 Git Bash isolated harness의 Windows path/Python shim과 새 `VERIFIED` status 기대값 불일치로 분리했다.
- 조치: Linux의 mode 0600 검사는 유지하고 Windows isolated harness에서만 mode syscall을 대체 검증했으며, BASH_ENV shim과 경로 독립 matcher로 외부 DB/Provider 호출을 차단했다.
- Main 인수 후 유효 제품 failure fingerprint: `0`; 테스트 harness 보정은 운영 제품 실패로 승격하지 않았다.
- 독립 검토 R1은 test-session 복원 finalizer 부재와 Main takeover fencing 미결박 2건으로 `REWORK`를 판정했다.
- seq440~445에 R1 failure 수락, Developer epoch1 lease 회수, Main epoch2 worker/write lease와 takeover 재개를 append했고 checker `sequence=445`를 통과시켰다.
- R2 조치: 첫 rebind 전 EXIT/signal finalizer를 등록하고 rebind를 격리 subshell로 실행한다. 정상 복원 후 runtime 재생성까지 성공하면 원래 종료 코드를 보존하며, restore/recreate 실패는 redacted `INCIDENT_HOLD` receipt와 종료 코드 90으로 우선한다. `VERIFIED`는 복원 완료 후에만 원자 생성한다.
- 독립 검토 R2는 R1 blocker 2건 해소를 확인했지만, 동일 release 재실행이 기존 incident receipt를 자동 삭제·덮어쓸 수 있는 `C21_LR02C_INCIDENT_HOLD_EVIDENCE_ERASED_OR_AUTO_CLEARED_ON_RERUN` 1건으로 `REWORK`를 판정했다.
- R3 조치: 기존 `c21-test-session-incident-hold.json`이 있으면 backup/Git/Docker/curl/DB/Telegram/Provider 호출 전에 종료 코드 91로 차단한다. 정상 종료 경로는 incident receipt를 삭제하지 않으며, 재개는 별도 승인된 운영자 해제 뒤에만 가능하다. 격리 테스트는 차단 재실행에서 호출 log와 incident bytes가 모두 불변임을 검증한다.

## 검증 기록

| 단계 | 명령 | 종료 코드 | 실제 결과 |
|---|---|---:|---|
| RED | `py -3 -m pytest -q tests/deploy/test_c21_lr02c_operational_contract.py` | 1 | 신규 계약 8개 중 7개 의도된 실패 |
| Focused GREEN | 동일 operational contract | 0 | `8 passed` |
| Main 인수 재현 | deploy 3-file suite | 1 | isolated success harness 1건 실패 |
| Main 인수 GREEN | `py -3 -m pytest -q tests/deploy/test_c21_lr02c_operational_contract.py tests/deploy/test_ysna_scripts_contract.py tests/deploy/test_ysna_deployment_contract.py` | 0 | `26 passed, 4 subtests passed` |
| 최종 deploy 회귀 | 동일 3-file suite | 0 | `26 passed` |
| R2 restore finalizer RED | `py -3 -m pytest tests/deploy/test_ysna_scripts_contract.py -q` | 1 | restore 완료 증거 부재로 1건 의도된 실패 |
| R2 restore finalizer GREEN | 동일 script contract | 0 | `6 passed, 4 subtests passed` |
| R2 deploy 회귀 | deploy 3-file suite | 0 | `26 passed, 4 subtests passed` |
| R3 incident hold RED | script success-path harness | 1 | 기존 incident가 있는데 재실행이 Telegram 단계까지 진행되어 의도된 실패 |
| R3 incident hold GREEN | `py -3 -m pytest tests/deploy/test_ysna_scripts_contract.py -q` | 0 | `6 passed, 4 subtests passed`; 재실행 exit 91, 외부 호출 log·incident bytes 불변 |
| 전체 API | `.venv/Scripts/python.exe -m pytest -q tests/api` | 0 | `99 passed` |
| Shell parse | Git Bash `-n` backup/rebind/verify | 0 | 출력 없음 |
| Python compile | `py -3 -m py_compile` provision/probe | 0 | 출력 없음 |
| Takeover progress checker | `py -3 scripts/check_project_progress.py` | 0 | `PASS sequence=447 reporting=AUTO_CONTINUE` |
| LR-02C progress contracts | `py -3 -m pytest -q tests/tooling/test_project_progress.py` | 0 | `88 passed, 26 subtests passed` |
| Broad historical tooling | `.venv/Scripts/python.exe -m pytest -q tests/tooling` | 1 | `436 passed, 16 failed`; A13/A14/G07/PhaseG의 기존 frozen-state/current-state 혼용으로 분류, LR-02C 제품 회귀 0건 |
| Diff check | `git diff --check` | 0 | 출력 없음 |

## 변경 경로

Developer exact12 중 다음 9개 코드·테스트 경로를 구현 또는 검증했다.

1. `deploy/ysna/backup-c21-db.sh`
2. `deploy/ysna/provision-c21-validation.py`
3. `deploy/ysna/rebind-c21-test-session.sh`
4. `deploy/ysna/probe-providers.py`
5. `deploy/ysna/verify.sh`
6. `deploy/ysna/ReleaseManifest.C21.DRAFT.json` (내용 변경 없음, 기존 경계 유지)
7. `tests/deploy/test_c21_lr02c_operational_contract.py`
8. `tests/deploy/test_ysna_scripts_contract.py`
9. `tests/deploy/test_ysna_deployment_contract.py` (내용 변경 없음, 회귀 검증)

본 보고서, evidence manifest, ignored task report를 포함해 exact12 계약을 완성한다.

## 미검증 범위

- 실제 ysna SSH/Docker/DB backup/migration/deploy: `NOT_EXECUTED`
- production Task/Run/Event 생성: `NOT_EXECUTED`
- public HTTPS/authenticated SSE/Last-Event-ID: `NOT_EXECUTED`
- Telegram signed POST: `NOT_EXECUTED`
- 9 Provider live non-billing probe: `NOT_EXECUTED`
- C-01: `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`

## Rollback

- 배포 전에는 이 WorkInstruction exact12 변경만 폐기하면 된다.
- 운영 실행 후에는 verify finalizer가 `rebind-c21-test-session.sh restore`와 `anvil-web --force-recreate`를 자동 수행한다.
- restore 또는 runtime recreate 실패 시 원래 실패 코드와 복원 실패 단계를 mode 0600 redacted receipt에 남기고 `INCIDENT_HOLD`로 전환한다.
- migration 이후 실패 시 자동 downgrade하지 않고 검증된 DB backup을 보존한 채 incident hold로 전환한다.

## 다음 조치

독립 Reviewer가 R1·R2 blocking 3건의 해소, incident hold append-only 경계, exact12 diff, secret redaction, parameterized SQL, idempotency/CAS, one-shot Telegram, Provider non-billing 경계를 재검토한다. PASS 이후에만 Main Agent가 completion projection과 release checkpoint를 생성한다.
