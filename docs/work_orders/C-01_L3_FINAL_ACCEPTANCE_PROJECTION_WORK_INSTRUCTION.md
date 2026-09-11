# WI-C-01-L3-FINAL-ACCEPTANCE-PROJECTION-20260911-001

## 판정과 기준선

- 신산님이 승인한 C-01 개발·테스트 범위 안에서 Main Agent가 실제 PostgreSQL15, API, 정식 WSL runtime, browser, authenticated SSE 증거를 검토했다.
- historical projection 기준선은 corrected seq721 commit `a34d12da5f504a5d2694fc04f0924082cb1fc1d9`이다. 해당 commit의 `progress-events.json` seq1~721 raw object bytes와 기존 evidence manifest/digest는 변경하지 않는다.
- 독립 테스트 baseline은 `fd3c89665629addd78e74c2fe946fb9dfc893c36`, 제품 후보는 그 단일 후속 exact13 `bb2ff4374c81865cab127eca14d3d4c9de575465`, formal control은 그 단일 후속 exact5 `2eba71ec37183ef6062157d7491ee48cb1fab6ba`다.
- 작업 branch는 `codex/c01-mainline-reconciliation-r5`; final record commit은 `2eba71e`의 단일 후속 commit이어야 한다.

## 허용된 실제 증거

- canonical locked uv + WSL PostgreSQL15 독립 L3: `17 passed in 35.72s`, skipped0, exit0.
- product/API/Event/C-21 adjacent regression: `93 passed in 37.43s`, exit0.
- product/test final review: `SPEC PASS / QUALITY APPROVED / C0·I0·M0`.
- formal control review: `SPEC PASS / QUALITY APPROVED / C0·I0·M0`; contract30 PASS, Bash/JSON/diff PASS.
- WSL formal receipt: `VERIFIED`, exact candidate `bb2ff43`, `anvil-web` count1/port3770, DB write0, Provider call0, Telegram call0, extra runtime resource0, Secret output0.
- runtime: clean detached `bb2ff43`, image/OCI exact, healthy, read-only, cap-drop ALL, no-new-privileges, only proxy-network, public IPv4 `0.0.0.0:3770`.
- same-origin HTTP: Dashboard, Provider Workbench, live, ready, OpenAPI, auth status 모두200; OpenAPI exact execute path 존재.
- browser: Dashboard Database READY/migration0013; Workbench `WSL_ACCEPTANCE · wsl_acceptance_reader`, READY, canonical9 Provider, UPSTAGE PRIMARY; console error/warn0.
- cookie-authenticated SSE: session issue201, authenticated true, actor_role tester, initial200/88bytes/text-event-stream, event `c21-wsl-event-1`/`RUN_CREATED`, Last-Event-ID resume200/0bytes, invalid cursor409, forbidden Run403, Secret omitted/temp residue0.

## 구현 범위

1. seq722~727을 다음 순서로 append한다.
   - `WRITE_LEASE_REVOKED`
   - `WORKER_LEASE_REVOKED`
   - `PACKAGE_COMPLETED`
   - `INDEPENDENT_TEST_JUDGMENT_RECORDED`
   - `DEPLOYMENT_VERIFIED`
   - `MAIN_PACKAGE_ACCEPTED`
2. seq721의 epoch5 lease와 fencing token을 그대로 참조해 write lease부터 순서대로 회수한다.
3. 새 final acceptance manifest/raw evidence/validation/report/detached digest를 만든다. 기존 invalidated seq715 acceptance manifest와 seq716~721 rework manifest는 수정하지 않는다.
4. `build-progress.json`과 `BUILD_HANDOFF.md`를 seq727, C-01 ACCEPTED, active lease 없음, C-02 READY_NOT_STARTED로 동기화한다. C-02 시작 Event·lease·WorkInstruction은 만들지 않는다.
5. checker가 historical seq1~721 raw bytes, exact commit lineage, exact path sets, direct-child, clean/staged state, checksum, deterministic rebuild, mutation rejection을 검증하도록 전용 predicate와 계약 테스트를 추가한다. 전용 predicate는 frozen seq721 검사보다 먼저 적용한다.
6. final record exact path는 아래 15개다.

```text
docs/04_test_reports/C-01_L3_FINAL_ACCEPTANCE_REPORT.md
docs/04_test_reports/C-01_WSL_FORMAL_SINGLE_RUNTIME_IMPLEMENTATION.md
docs/WORK_STATUS.md
docs/completion_reports/C-01_completion.md
docs/evidence/manifests/C-01_L3_FINAL_ACCEPTANCE_MANIFEST.json
docs/evidence/raw/C-01_L3_FINAL_OPERATIONAL_EVIDENCE.json
docs/progress/BUILD_HANDOFF.md
docs/progress/build-progress.json
docs/progress/progress-events.json
docs/progress/progress-handoff-detached-digest-c01-l3-final-acceptance.json
docs/validation/C-01_L3_FINAL_ACCEPTANCE_VALIDATION.md
docs/work_orders/C-01_L3_FINAL_ACCEPTANCE_PROJECTION_INVOCATION_PROMPT.md
docs/work_orders/C-01_L3_FINAL_ACCEPTANCE_PROJECTION_WORK_INSTRUCTION.md
scripts/check_project_progress.py
tests/tooling/test_project_progress.py
```

## 금지 범위

- seq1~721 raw object bytes 및 historical evidence 수정
- 제품·migration·runtime·container·network·volume·DB·Secret 수정
- Provider·Telegram 외부 호출 또는 이를 PASS로 기록
- C-02 시작, DIR 상태 변경, ysna/Production/main/PR/merge
- 기존 R1~R4 control history rewrite 또는 force push

## 완료 조건

- precommit staged exact15 또는 `2eba71e` direct-child exact15 postcommit만 허용
- focused projection/checker tests, live checker, raw history, checksum, deterministic rebuild, Git mutation tests, `git diff --check` PASS
- 독립 reviewer `SPEC PASS / QUALITY APPROVED`, Critical0/Important0
- 실제 미실행 범위를 `NOT_EXECUTED`로 유지
