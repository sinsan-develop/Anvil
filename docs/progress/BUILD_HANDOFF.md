# C-21 Lifecycle Runtime LR-02A R3 rework active (2026-09-03)

- **판정:** `ACTIVE_REWORK_R3` (seq408→413 epoch2 lease revoke → second `FAILURE_REPORT_ACCEPTED` → epoch3 lease issue → `PACKAGE_RESUMED`).
- **실패 계보:** `C-21/LR-02A | LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`, valid failure 2, takeover `NOT_REQUIRED`.
- **R3 blocker:** 최초 전환 rollback asset, canonical deploy/verify/rollback 실행형 harness, 실제 auth session/cookie/run-id/SSE/Last-Event-ID 검증.
- **R3 writer:** `developer-primary`, exact9, execution/write epoch 3. 동일 유효 실패가 세 번째로 확인되면 Main이 직접 인수한다.
- **보존:** seq1~407 및 R1/R2 산출물은 불변이다. C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.
- **미실행:** Docker/SSH/DB/NPM/DNS/Secret/browser/deploy/container removal/Telegram/Provider side effect.

# C-21 Lifecycle Runtime LR-02A R2 rework active (2026-09-03)

- **판정:** `ACTIVE_REWORK_R2` (seq402→407 old lease revoke → `FAILURE_REPORT_ACCEPTED` → epoch2 lease issue → `PACKAGE_RESUMED`).
- **실패 계보:** `C-21/LR-02A | LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`, valid failure 1, takeover `NOT_REQUIRED`.
- **독립 차단 7건:** bootstrap root, verify/rollback root와 guard 인자, fresh image와 same-0013, durable rollback baseline, observable verify, frozen LR-01 report, DRAFT approval consistency.
- **R2 writer:** `developer-primary`, exact11, execution/write epoch 2. LR-01 report는 baseline byte 복원만 허용하고 LR-02A 보고서는 고유 경로로 분리한다.
- **보존:** R1 ASGI/compose/README/API-test 변경과 seq1~401은 불변이다. C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.
- **미실행:** Docker/SSH/DB/NPM/DNS/Secret/browser/deploy/container removal/Telegram/Provider side effect.

# C-21 Lifecycle Runtime LR-02A started (2026-09-03)

- **판정:** `ACTIVE / LR-02A` (seq399→401 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`).
- **기준선:** `codex/c21-lifecycle-runtime@e57f008d0916953dab3c9425322a1e8942ed0379`; 원격 feature checkpoint 동일, upstream `origin/main@1573e0242aa718d0f81f6b6fc936c754b7c75e60`.
- **목표:** canonical `anvil.sinsan.kr → anvil-web:3770` runtime의 readiness/deploy 계약을 migration `0013_task_bootstrap_authority`에 맞춘다.
- **단일 writer:** `developer-primary`, exact14, execution/write epoch 1. Main은 lease 동안 제품 경로를 수정하지 않는다.
- **보존:** LR-01 frozen product/evidence와 seq1~398은 불변이다. C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.
- **미실행:** SSH, DB migration, Docker build/deploy, NPM/DNS/Secret 변경, 컨테이너 제거, Telegram/Provider 호출.

# C-21 Lifecycle Runtime LR-01 acceptance projection reconciled (2026-09-03)

- **판정:** `RECONCILED / LR-01_ACCEPTED` (seq398 `REPOSITORY_RECONCILED`). 기존 seq1~397은 변경하지 않고, LR-01 accepted exact21 저장소 projection과 event stream head를 append-only로 정합화했다.
- **원인:** seq394~397 append 후 stream `last_sequence`, accepted-state checker predicate, detached-manifest pointer, event/checker hashes가 일부 이전 값으로 남아 checker가 5개 오류를 보고했다.
- **조치:** 신산님 승인에 따라 seq398을 추가하고 LR-01 accepted exact21 predicate 및 progress/HANDOFF/digest/manifest binding을 재계산한다. 제품·DB·서버·배포·외부 호출은 변경하지 않는다.
- **다음 안전 행동:** checker와 projection tooling을 통과한 뒤 LR-01 체크포인트 커밋을 만들고 LR-02A WorkInstruction을 발행한다. C-01 차단은 유지한다.

# C-21 Lifecycle Runtime LR-01 accepted (2026-09-03)

- **판정:** `ACCEPTED / LR-02A_READY` (seq394→397 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED → MAIN_PACKAGE_ACCEPTED`). C-21 전체 완료나 C-01 시작을 의미하지 않는다.
- **독립 검토:** `/root/c21_lr01_r9_review`가 `PASS / READY_FOR_MAIN_ACCEPTANCE`, blocking 0으로 판정했다. direct Task port 권한 오류 403/입력 오류 400, same-origin TLS proxy 경계, project/environment scope, typed 응답, authority hash, replay, GET revoke를 재검증했다.
- **Main 검증:** 격리 PostgreSQL 16에서 migration `upgrade head → downgrade base → upgrade head`, focused persistence 최신 `5 passed`; 실제 PostgreSQL 포함 API+persistence `100 passed, 17 skipped`; progress checker PASS, projection tooling `82 passed`, diff-check PASS.
- **정리:** 전용 임시 컨테이너 `anvil-c21-lr01-pg-20260903` 제거 후 exact filter 0건, 별도 volume 0건이다. production DB와 서버는 이 검증에서 변경하지 않았다.
- **동결 증거:** `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR01_EVIDENCE_MANIFEST.json`; canonical report `docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md`.
- **미실행:** WSL 애플리케이션 배포, production DB, browser, test-session write scope, canonical project mapping, Telegram/Provider side effect는 아직 실행하지 않았다.
- **다음 안전 행동:** `C-21/LR-02A`에서 `anvil-web:3770` readiness 및 deploy migration target을 `0013_task_bootstrap_authority`로 정합화한다. LR-02B test-session 최소권한, LR-02C project/repository provisioning을 순차 처리하며 C-01은 계속 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.

# C-21 Lifecycle Runtime LR-00 binding (2026-09-03)

- **판정:** `ACTIVE / LR-01_DISPATCHED` (seq390 `APPLY_APPROVAL_RECORDED`, seq391→393 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED`; `updated_at=2026-09-03T02:45:03+09:00`).
- **승인 결박:** 신산님의 정확한 승인 문구를 `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`에 기록했다. lifecycle API runtime 활성화, production DB canonical C-21 test chain 생성, test-session write scope·allowlist 변경, 해당 변경 배포 및 검증용 외부 side effect만 포함한다.
- **LR-01 범위:** `WI-C-21-LR-01-20260903-001`은 일반 Task bootstrap API 구현만 다룬다. production DB test chain, test-session write scope·allowlist, 배포, 외부 side effect는 이 단계에서 실행하지 않는다.
- **단일 writer:** `developer-primary`만 worker/write epoch-1 fencing token과 exact 10-path set으로 쓴다. Main-owned approval/progress/handoff/manifest는 worker protected scope다.
- **보존:** Phase B Gate의 sequence 375 `ACCEPTED` 결정과 B-01~B-12 historical 기록을 재개방하거나 덮어쓰지 않는다.
- **확인된 운영 사실:** migration `0012_run_authority` 적용·유지, `anvil-web:3770` healthy, NPM custom Telegram override backup 후 제거 및 `nginx -t`/graceful reload 성공, internal runtime 보존.
- **Provider:** 5 healthy; UPSTAGE `401`, GEMINI `400`, OPENAI `401`, OLLAMA timeout. credential rotation이 필요하며 이 정합화 범위에서 Provider 재호출은 금지한다.
- **Telegram:** 승인된 signed POST 1회가 HTTP `200 ACCEPTED`였고 NPM/application/DB correlation이 있다. pre-count capture 누락으로 strict dynamic delta는 `UNKNOWN`; 재전송하지 않는다.
- **SSE:** authenticated SSE HTTP `200`이나 event는 0건이다. event capture가 없으므로 `Last-Event-ID` 재개 검증은 실행하지 않았다.
- **C-01 경계:** historical Gate `ACCEPTED`와 별개로, C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`이며 C-21 독립 판정 전 WorkInstruction 발행·시작을 금지한다.
- **근거:** `docs/04_test_reports/C-21_PRODUCTION_DEPLOY_INCIDENT_20260902.md` (`35C6F1EB5C9A7AFF68AE60443F37A86478B15F5FAF9446B4DE435DEC120E81F1`), `docs/04_test_reports/C-21_R3_OPS_EXECUTION_REPORT.md` (`069ABCFF073460479B7E782C2FD3C1DC19F0BD7F21EB16E3DC77B1C6CD5D55B1`), `docs/04_test_reports/C-21_RECONCILIATION_2026-09-01.md` (`0102959496AE41D3F24636AED90CF65543124ED28D3A35405308E21CD2B4217C`).
- **다음 안전 행동:** developer-primary가 LR-01 RED/GREEN을 수집한다. C-01은 여전히 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`이며 WorkInstruction 발행·시작을 금지한다.

# Historical record — Phase B Gate MAIN_GATE_ACCEPTED (sequence 375)

- 독립 Tester report SHA `7F98EBD937EC8CF027A307C1D931A5E3CE1E73474E916168CA284AB15CDE8FDE`의 `READY_FOR_MAIN_GATE_DECISION / spec PASS / quality PASS_WITH_EXPECTED_IN_PROGRESS_DIRTY`를 검토해 seq375 `MAIN_GATE_ACCEPTED`로 Phase B Gate를 최종 `ACCEPTED`했다.
- EXACT44 selector: 51 slots / 50 defined / 44 direct / 6 deferred / 1 undefined. deferred 6건은 각 후속 Package 책임, undefined `AV-STAT-029`는 승격하지 않는다.
- B-01~B-12 모두 ACCEPTED, 유효 failure 0 (B-12 historical 1건 lineage 보존). Phase B Gate valid failure count: 0.
- worker/write lease와 active WorkInstruction은 null이다. Gate 수락 event는 Phase B Gate 개발 산출물 회수 후 발행한다.
- 실제 persistence/API/DB/browser/provider/Telegram webhook/WSL/production/deployment와 public exposure, C-01 시작은 이 수락 기록만으로는 수행하지 않는다. C-01은 Gate ACCEPT 확인 후 별도 WorkInstruction 발행 시점부터 시작한다.

# Historical record — Successor binding projection — Agent Teams·Capability MoA·원격 운영 검증

The following successor binding projection is historical only. It does not define the current C-21 approval scope or authorize C-01.

- `APPROVAL-20260822-AGENT-TEAMS-MOA-REMOTE-SUCCESSOR-001`은 신산님의 2026-08-22 (Asia/Seoul) 승인으로 `HUMAN_APPROVED_SEMANTIC_SUCCESSOR_SCOPE`가 되었다.
- 승인 subject hash와 historical Phase B Gate 기록은 변경하지 않는다. 이 projection은 v2.7/v1.6 successor 및 C-16~C-20 scoped prototype evidence(`33 passed`, compileall PASS, diff-check PASS, scoped review PASS)를 연결한다.
- successor 승인 범위는 문서·evidence 정합성과 다음 운영 검증 Work Package 준비에 한정된다. 실제 persistence/API/DB/browser/provider/Telegram webhook/WSL/production/deployment와 public exposure는 아직 `NOT_EXECUTED`다.
- historical operational state는 그대로 유지한다: Phase B Gate는 `ACCEPTED`, active agent/worker lease/write lease는 `null`, C-01은 `BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE / NOT_STARTED`다.
- 다음 successor 운영 검증은 `C-21`로 투영한다. C-21 시작은 별도 WorkInstruction·lease·검증 범위가 확정된 뒤 진행하며, 이 binding만으로 C-01을 시작하거나 배포하지 않는다.

# B-12 R2 Main acceptance → Phase B Gate 대기 — sequence 361

- 독립 Tester report SHA `4BC563551B64B885A3361957E5DA7EAE7458121FE83803D9844E178916D3CD06`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검토해 seq361 `MAIN_PACKAGE_ACCEPTED`로 B-12를 최종 `ACCEPTED`했다.
- 두 CRITICAL finding은 `CLOSED`; 유효 실패 1건은 historical lineage로 보존하고 active count는 0으로 닫았다. Developer exact10 target `D11F17409DDE8C51B036EE9AE659D5295B7D7B840A0BB472CCFEA483135E6A5D`는 byte-frozen이며 제품 mutation은 0이다.
- worker/write lease와 active WorkInstruction은 null이다. C-01은 정상 자동 Phase B Gate 판정 전 `BLOCKED_PENDING_B_GATE / NOT_STARTED`다.
- 다음 안전 행동은 누적 B-01~B-12 evidence와 assigned AV의 Phase B Gate 판정이다. C-01은 Gate PASS 전 시작하지 않는다.

# B-12 R2 Developer 완료 → 독립 재테스트 대기 — sequence 360

- Developer R2 exact10을 evidence manifest file SHA `2A4A944B08A3837D8774D4917A0C4E91F9DA3F5F7C16F55A2B893AC3FFEADDAA`, raw9 target `D11F17409DDE8C51B036EE9AE659D5295B7D7B840A0BB472CCFEA483135E6A5D`로 byte-frozen했다. Main 완료 projection의 제품 mutation은 0이다.
- seq358→360은 epoch-2 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-12는 `TEST_REVIEW / COMPLETED`, 독립 Tester는 `PENDING_RETEST`, active agent와 두 lease는 null이다.
- Developer 증거는 no-DSN focused `15 PASS + 13 honest SKIP`, 격리 PostgreSQL 18 `28 PASS`, durable FI-05/06/07 각 3회 실제 process termination, core `156 PASS + 19 SKIP`, loopback uvicorn `200/409/200/401`과 cleanup을 포함한다. Main 독립 재실행 범위만 Main evidence이며 Tester 판정 전 acceptance로 승격하지 않는다.
- R1 CRITICAL 2건의 active failure count 1은 재테스트 판정 전 유지한다. C-01은 `BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE`; B-12 acceptance, B Gate, C-01은 금지한다.

# B-12 독립 FAILURE_REPORT 수용 → R2 재작업 — sequence 357

- 독립 Tester report SHA `224CC87D40496A09765551A317413832039C4BDBA2B67C22AC37C6E05681AF91`의 `FAILURE_REPORT / REWORK_REQUIRED`, CRITICAL 2건을 B-12 첫 유효 실패로 수용했다.
- fingerprint는 `B-12/DURABLE_PROCESS_RECOVERY_AND_ACTUAL_SEND_BOUNDARY_GAP`; seq354→357은 `FAILURE_REPORT_ACCEPTED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED`다.
- `developer-primary-b12` epoch-2 token은 `b12-execution-fence-epoch-2-e29ffcf` / `b12-write-fence-epoch-2-e29ffcf`; R1 exact15 안의 최소 exact10만 수정할 수 있다.
- R2는 실제 PostgreSQL adapter/load/reconcile/audit persistence, process-linked FI-07과 actual send-boundary FI-05/06 및 persisted counter/receipt evidence를 요구한다. 기능 범위·요구사항·중요 위험 변경은 없다.
- B-12는 `ACTIVE / REWORK_IN_PROGRESS / R2_PENDING`; C-01은 `BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE`다. B-12 acceptance, B Gate, C-01은 금지한다.

# B-12 Developer 완료 → 독립 Tester 대기 — sequence 353

- Developer exact15를 evidence manifest file SHA `47543B6D41C57CEBAB7003478F76177B1B1F05B2C46868D156612908AA7E6D7E`, raw14 target `7EE778EBA5A85C107C90BA94D7186297192BDB6358CFA4571363183FB2AF316C`로 byte-frozen했다. Main 완료 projection의 제품 mutation은 0이다.
- seq351→353은 epoch-1 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-12는 `TEST_REVIEW / COMPLETED`, 독립 Tester는 `PENDING`, active agent와 두 lease는 null이다.
- Developer 증거는 focused local `20 PASS + 1 PostgreSQL SKIP`, 격리 PostgreSQL 18 `21 PASS`, core `159 PASS + 7 SKIP`, 실제 loopback uvicorn HTTP와 FI-05/06/07 각 3회를 포함한다. Main 검증 범위만 Main evidence이며 독립 Tester 전에는 acceptance로 승격하지 않는다.
- C-01은 `BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE`다. B-12 acceptance, B Gate, C-01 시작은 금지하며 다음 안전 행동은 frozen exact15의 대화 분리 독립 Tester 검증이다.

# B-12 Start — sequence 350

- canonical clean/equal baseline `370a39436c4b15a84483017583a9fe3878652504`에서 seq348→350 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`를 기록했다.
- `developer-primary-b12` epoch-1 worker/write lease와 Developer exact15만 활성이다. C-01은 `BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE`다.
- 목표는 process/PC 종료 reconcile·resume, 완료 Action skip, 미확정 부작용 3분류, FI-05/06/07, stale fencing, revoked Secret·capability snapshot drift 차단과 recovery 공통 API다. assigned verification은 `AV-STAT-014/034/035/036/038/039`, `AV-OPS-005`, `AV-SAFE-031`, `AV-FLOW-010/011`이다.
- 시작 시 제품 산출물은 0개다. 실제 API/DB/fault injection/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 모두 `NOT_EXECUTED`다. B-08~B-11은 read-only predecessor이며 `packages/api/fastapi_app.py`는 기존 계약을 보존하는 recovery route 연결만 허용한다.
- 기능 범위·요구사항·중요 위험 변경과 DIR은 없다. B-12 acceptance, Phase B Gate 판정, C-01 Agent/provider kernel, 실제 메뉴 UI와 provider/deployment는 시작하지 않는다.

# B-11 R2 Main acceptance → B-12 준비, 미시작 — sequence 347

- 독립 Tester report SHA `F925ECC0C70E4DC4EE2E0F5BF883E94FD9D5AA666A801448B2044CBF8B6819E5`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검토해 seq347 `MAIN_PACKAGE_ACCEPTED`로 B-11을 최종 `ACCEPTED`했다.
- `BLK-B11-001`은 `CLOSED`다. B-11 유효 실패 1건은 historical lineage로 보존하고 active failure count는 0으로 닫았다.
- Developer R2 exact8은 target `25167A1D9C951C9A3E032862F72A4F1D8F5EBCF310585812EE7DC7095F4B3ABA`로 byte-frozen이며 acceptance projection의 제품 mutation은 0이다.
- B-12는 `READY / NOT_STARTED`다. active WorkInstruction, agent, worker lease, write lease는 모두 null이고 B-12 시작 event는 없다.
- 실제 local uvicorn hostile·nominal HTTP와 FI-08 SSE는 독립 Tester PASS를 결박했다. Browser Network는 `ENVIRONMENT_BLOCKED`; DB는 B-11에 불필요했고 UI/provider/WSL/shared DB/ysna/production/deployment는 `NOT_EXECUTED`다.

# B-11 R2 authorization 재작업 시작 — sequence 343

- 독립 Tester report SHA `EFBE6313A9BFF589702149E7042FDA127DF99CA323FD864C8EC16EA72D07441C`의 `FAILURE_REPORT / REWORK_REQUIRED / CRITICAL`을 유효 실패 1회로 수용했다. fingerprint는 `BLK-B11-001-SCOPE-AUTHORIZATION-NOT-ENFORCED`다.
- seq340→343은 `FAILURE_REPORT_ACCEPTED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED`; `developer-primary-b11` epoch-2 worker/write lease와 기존 R1 exact17 안의 R2 exact8만 활성이다.
- R2는 permission-only authorization을 authoritative project/environment/allowed-role resolver와 서버 측 대조로 보완한다. Approval·artifact·SSE의 wrong/missing/cross scope는 403 및 application port/SSE read 0이어야 한다.
- 이 Main 시작 투영의 제품 mutation은 0이다. R1 exact17과 manifest target `FCA6FB92BD092C68BA9F0C500B107E95198FE2B693C6F7F14E7C09680D2E29F5`는 predecessor evidence로 동결한다.
- B-11은 `ACTIVE / REWORK_IN_PROGRESS / R2_PENDING`; B-12는 `BLOCKED_PENDING_B11_ACCEPTANCE`다. 실제 R2 HTTP/SSE/browser는 Developer pending이며 shared DB/WSL/ysna/production/deployment는 시작하지 않는다.

# B-11 Developer 완료 → 독립 Tester 대기 — sequence 339

- Developer exact17을 manifest file SHA `BE11EA4C21FC34484CDF5B4CC924CAC03E9E64940A69EE014D9CE18D5D6A0C29`, raw16 target `FCA6FB92BD092C68BA9F0C500B107E95198FE2B693C6F7F14E7C09680D2E29F5`로 byte-frozen했다. Main completion projection의 제품 mutation은 0이다.
- seq337→339는 epoch-1 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-11은 `TEST_REVIEW / COMPLETED`, 독립 Tester는 `PENDING`, B-12는 `BLOCKED_PENDING_B11_ACCEPTANCE`다.
- Main 독립 실행에서 focused `16 passed`, canonical core `117 passed, 6 skipped`, 실제 loopback uvicorn HTTP 501 fail-closed·CSRF pre-side-effect·정상 mutation과 FI-08 3회 strict successor SSE를 확인했다. SSE payload SHA는 `456E740594DDB04772451363C715EC1846105307F3564C26ECD967C5D7FF7C0C`, read 3회, Run 생성 0회다.
- Browser Network는 Developer 시도에서 `ERR_BLOCKED_BY_CLIENT`로 `ENVIRONMENT_BLOCKED`이며 Main이 PASS로 승격하지 않았다. 실제 DB는 불필요했고 UI/provider/WSL/shared DB/ysna/production/deployment는 실행하지 않았다.
- 다음 안전 행동은 frozen exact17의 대화 분리 독립 Tester 검증이다. B-11 acceptance와 B-12 시작은 금지한다.

# B-11 Start — sequence 336

- canonical clean/equal baseline `1134619b2ecdbe521bb0cce2288af7fac6d1e9dc`에서 seq334→336 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`를 기록했다.
- `developer-primary-b11` epoch-1 worker/write lease와 Developer exact17만 활성이다. B-12는 `BLOCKED_PENDING_B11_ACCEPTANCE`다.
- 목표는 canonical API registry, FastAPI framework-neutral port, same-origin server BFF, `Last-Event-ID` SSE, 409/error/request-ID/pagination과 공통 Web security다. assigned verification은 `AV-STAT-007`, `AV-UI-011/012/016`, `AV-SAFE-029`다.
- 시작 시 제품 산출물은 0개다. 실제 API/BFF/SSE/UI/browser/WSL/ysna/shared-db/production/deployment는 모두 `NOT_EXECUTED`다. B-03~B-10은 read-only predecessor다.
- 기능 범위·요구사항·중요 위험 변경과 새 DIR은 없다. B-11 acceptance, B-12 recovery, 실제 메뉴 UI와 provider/deployment는 시작하지 않는다.

# B-10 R3 Main acceptance → B-11 준비, 미시작 — sequence 333

- 독립 Tester report SHA-256 `D884388D180FB746632DBE3B77C34533D875566619F05CFCF6FB093F43D35FFA`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검토해 seq333 `MAIN_PACKAGE_ACCEPTED`로 B-10을 최종 ACCEPTED했다.
- B-10 유효 실패 2건은 historical lineage로 보존하고 active failure count는 0으로 닫았다. B-11은 `READY / NOT_STARTED`이며 제품 write·lease·WorkInstruction은 시작하지 않았다.
- 제품 exact7은 target `5DEF1A06A2DC87BB074BA18F1BC346B098400B61741208BF1CF419B94BD21CD4`로 동결되며 acceptance projection의 제품 mutation은 0이다.

# B-10 R3 두 번째 유효 실패 수락 및 epoch-3 재작업 — sequence 329

- 독립 R2 retest report `23865D1722B231F04C7087328874A41D19431E5EE28C90AC71A3FACDA9D4F854`의 `REWORK_REQUIRED / BLK-B10-IT-001-R2 / CRITICAL`을 동일 B-10 계보의 두 번째 유효 실패로 수락했다. takeover는 아직 필요하지 않다.
- seq326→329는 `FAILURE_REPORT_ACCEPTED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED`이며 기능 범위·요구사항·중요 위험 변경은 없다.
- `developer-primary-b10` epoch-3 token은 `b10-execution-fence-epoch-3-5f644f4` / `b10-write-fence-epoch-3-5f644f4`; 기존 exact15 안의 최소 exact7만 수정할 수 있다.
- reservation-level authoritative final identity를 한 번만 원자 확정한다. exact canonical replay만 상태 변경 없이 허용하고 다른 receipt ID/payload/hash/actual/release는 거부하며 PostgreSQL도 concurrent distinct receipt ID를 강제한다.
- B-10은 `ACTIVE / REWORK_IN_PROGRESS / R3_PENDING`, B-11은 `BLOCKED_PENDING_B10_ACCEPTANCE`이다. 제품 mutation, API/UI/browser/provider/shared DB/ysna/production/deployment는 `NOT_EXECUTED`다.

# B-10 R2 Main completion — sequence 325

- Developer R2 exact7/raw6는 manifest SHA `6CBB859DA5598F4586380A124477C0D0C084B64AB43ACAE8C2FE4182B6A37934`, target `6CEB2CB8CCFB2168141C0B995EB4E1868EFBF4D0EC1DC94B9176D860CD785317`로 동결했다.
- seq323→325는 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-10은 `TEST_REVIEW`, Tester는 `PENDING_RETEST`, B-11은 acceptance 전 차단이다.
- R2 start manifest와 CRITICAL report history를 결박했다. 실제 API/UI/browser/provider/shared DB/ysna/production/deployment는 `NOT_EXECUTED`다.

## B-10 독립 FAILURE_REPORT 수락 → R2 재작업 재개 — sequence 322

- 독립 Tester report `B1FDDE5244129A0E086E9F666A635955751A6D3A5A83DB582E23CC1EB90AEBBB`의 `REWORK_REQUIRED / BLK-B10-IT-001 / CRITICAL`을 B-10 첫 유효 실패로 수락했다.
- 결함 fingerprint는 `BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE`이며 기능 범위·요구사항·중요 위험 변경은 없다.
- sequence 319→322는 `FAILURE_REPORT_ACCEPTED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED` 순서다.
- `developer-primary-b10` epoch-2 lease는 R1 exact15 안의 최소 exact7만 쓸 수 있다. execution token은 `b10-execution-fence-epoch-2-e9dd009`, write token은 `b10-write-fence-epoch-2-e9dd009`이다.
- unresolved `RECONCILIATION_REQUIRED` exposure를 hard cost/token/concurrency에서 계속 계산하고 double release를 막는 local/PG18 회귀가 필수다.
- B-10은 `ACTIVE / REWORK_IN_PROGRESS / R2_PENDING`; B-11은 `BLOCKED_PENDING_B10_ACCEPTANCE`이며 시작하지 않았다. API/UI/browser/provider/shared DB/ysna/production/deployment는 `NOT_EXECUTED`다.

# Anvil Build Handoff

## B-10 Developer 완료 → 독립 Tester 대기 — sequence 318

- Developer exact15는 manifest file SHA `750AB971D95D860324656AE81CF8501C434AF78210386B277C26ACC5F791086F`, raw14 target `0DDE236523F95C995A583C580108744A656717F4D285CFE30B1ED4FC5E46C43F`로 byte-frozen했다. completion projection에서 제품 mutation은 0이다.
- seq316→318로 epoch-1 write lease와 worker lease를 순서대로 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW / independent Tester PENDING`으로 투영했다. active agent와 두 lease는 null이다.
- Developer 증거의 local focused, 격리 WSL PostgreSQL 18 migration·hostile·concurrency 결과는 독립 재검증 전 acceptance로 승격하지 않는다. API/UI/browser/provider/ysna/shared DB/production/deployment는 `NOT_EXECUTED`다.
- B-11은 `BLOCKED_PENDING_B10_ACCEPTANCE`다. 다음 안전 행동은 frozen exact15에 대한 독립 Tester 검증이며 B-10 acceptance와 B-11 시작은 금지한다.

## B-10 Start — sequence 315

- canonical clean/equal baseline `ac371f5743dce0fa87b3ee3b767d63c9c6102cd8`에서 seq313→315 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`를 기록했다.
- `developer-primary-b10` epoch-1 worker/write lease와 Developer exact15만 활성이다. B-11은 `BLOCKED_PENDING_B10_ACCEPTANCE`다.
- 목표는 HumanInterventionReceipt, pause/resume, 원자 budget reservation, quota, 7단계 cancel과 immutable CANCELLED/새 Run 계약이다. assigned verification은 `AV-SAFE-003/025`, `AV-STAT-030~033/037`, `AV-AGT-006`이다.
- 제품 산출물은 0개이고 API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 모두 `NOT_EXECUTED`다. B-09는 read-only predecessor다.
- 기능 범위·요구사항·중요 위험 변경과 새 DIR은 없다. B-10 acceptance와 B-11 API/BFF/SSE/UI는 시작하지 않는다.

## B-09 R5 Main acceptance → B-10 준비, 미시작 — sequence 312

- 독립 Tester report SHA-256 `A84E6FE92F11F987D987E7787344D8A81125ECF977168DBDA0641BD6DB4D732D`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검토해 seq312 `MAIN_PACKAGE_ACCEPTED`로 B-09를 최종 ACCEPTED했다.
- `BLK-B09-IT-001/002`는 CLOSED이며, B-09 유효 실패 4건은 historical lineage로 보존했다. current failure count는 0이고 B-10은 `READY / NOT_STARTED`다.
- active WorkInstruction, active agent, worker lease, write lease는 모두 null이다. 제품 exact15는 manifest SHA `5DBBEB29C5788E1D91B092B2239E615E8505C4B2F41F61E061D7A136ACA85F26`, raw14 target `0EE80F9B636595125F94E5B5C5E50BC4B703D6DA1E2BDC9D88061DB42A354578`로 동결했다.
- 실제 dirty set은 frozen product exact15 + Main/Tester acceptance projection exact26 = exact41이다. API·UI·browser·provider·ysna·shared DB·production·deployment·commit·push·B-10 start는 수행하지 않았다.

## B-09 Main R5 재작업 완료 → 독립 재검증 대기 — sequence 311

- seq309→311은 epoch-5 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED` 순서다. B-09는 `TEST_REVIEW / COMPLETED`, 독립 Tester는 `PENDING_RETEST`, active agent와 두 lease는 null이다.
- `BLK-B09-IT-001/002` 수정 결과를 제품 manifest SHA-256 `5DBBEB29C5788E1D91B092B2239E615E8505C4B2F41F61E061D7A136ACA85F26`, raw14 target `0EE80F9B636595125F94E5B5C5E50BC4B703D6DA1E2BDC9D88061DB42A354578`로 byte-frozen했다. 완료 projection 이후 제품 mutation은 0이다.
- local focused `9 PASS + 2 DSN SKIP`, 격리 WSL PostgreSQL 18 focused `11/11`, core `102 PASS + 2 DSN SKIP`, max-attempt orphan quarantine·queue forward progress·실제 Windows junction 수렴·외부 absolute path fail-closed 증거는 Main 결과이며 독립 재검증 전 acceptance로 승격하지 않는다.
- 실제 dirty set은 frozen product exact15 + Main/Tester R5 completion projection exact24 = exact39다. B-10은 `BLOCKED_PENDING_B09_ACCEPTANCE`다.
- API·UI·browser·provider·ysna·shared DB·production·deployment·commit·push는 수행하지 않았다.

## B-09 독립 Tester 실패 수용 → Main R5 재작업 — sequence 308

- 독립 Tester report SHA-256 `8DE9794641BB22716A2A6392B9AC2F96B22387DFC12BFF17C91F467777C62B5D`의 `FAILURE_REPORT / REWORK_REQUIRED`, CRITICAL `BLK-B09-IT-001/002`를 같은 `B-09/DB_FENCING_RECOVERY_CONTRACT_GAP` lineage의 네 번째 유효 실패로 수용했다.
- seq305→308은 `FAILURE_REPORT_ACCEPTED → Main epoch-5 WORKER_LEASE_ISSUED → Main epoch-5 WRITE_LEASE_ISSUED → PACKAGE_RESUMED` 순서다. token은 `b09-main-rework-execution-fence-epoch-5-7c3382a` / `b09-main-rework-write-fence-epoch-5-7c3382a`다.
- `WI-B-09-20260820-005`는 max-attempt expired orphan의 원자 quarantine와 queue forward progress, 실제 junction/symlink/8.3 alias 수렴, repository 밖 absolute path fail-closed를 기존 B-09 요구 안에서 재작업하도록 고정한다. 기능 범위·요구사항·중요 위험·제품 exact15는 변경하지 않았다.
- 현재 dirty set은 frozen product exact15 + Main/Tester R5 projection exact22 = exact37이다. B-10은 `BLOCKED_PENDING_B09_ACCEPTANCE`다.
- 이 projection에서 제품 mutation, API/UI/browser/provider/WSL/ysna/shared-db/production/deployment, commit/push는 수행하지 않았다.

## B-09 Main 구현 완료 → 독립 Tester 대기 — sequence 304

- Main 직접 인수 구현을 완료하고 seq302→304로 epoch-4 write lease와 worker lease를 순서대로 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW / independent Tester PENDING`으로 투영했다.
- R5 제품 exact15는 manifest file SHA-256 `5DBBEB29C5788E1D91B092B2239E615E8505C4B2F41F61E061D7A136ACA85F26`, raw14 target `0EE80F9B636595125F94E5B5C5E50BC4B703D6DA1E2BDC9D88061DB42A354578`로 byte-frozen이다. 재작업 projection 밖 제품 mutation은 0이다.
- local focused `7/7`과 DSN 미제공 `2 SKIP`, 격리 WSL PostgreSQL 18 focused `9/9`, FI-04 `3/3`, migration `0007→0008→0007`, stale execution/write fencing·`SKIP LOCKED`·quarantine·cleanup을 확인했다. core는 `100 PASS + 2 DSN SKIP`, tooling은 `355/355`, standalone 4종과 project checker는 PASS했다.
- 현재 전체 dirty set은 frozen product exact15 + Main completion projection exact19 = exact34다. B-09는 아직 ACCEPTED가 아니며 B-10은 `BLOCKED_PENDING_B09_ACCEPTANCE`다.
- API·UI·browser·provider·ysna·shared DB·production·deployment는 `NOT_EXECUTED`다. 다음 안전 행동은 독립 Tester 검증이다.

## B-09 R4 third valid failure → Main direct takeover — sequence 301

- 동일 lineage `B-09` / fingerprint `DB_FENCING_RECOVERY_CONTRACT_GAP`의 세 번째 유효 실패를 수락했다. `B-09_MAIN_TAKEOVER_PACKET_R4.md`에 따라 Developer를 중지하고 기능 범위·요구사항·중요 위험 변경 없이 Main이 직접 인수한다.
- seq296→301은 `FAILURE_REPORT_ACCEPTED → epoch-3 WRITE_LEASE_REVOKED → epoch-3 WORKER_LEASE_REVOKED → Main epoch-4 WORKER_LEASE_ISSUED → Main epoch-4 WRITE_LEASE_ISSUED → PACKAGE_RESUMED/DIRECT_IMPLEMENTATION` 순서다.
- 새 token은 `b09-main-takeover-execution-fence-epoch-4-7c3382a` / `b09-main-takeover-write-fence-epoch-4-7c3382a`다. epoch-3 및 이전 token은 폐기됐고 stale commit은 허용하지 않는다.
- Developer exact15 path와 bytes는 동결했다. Main R4 projection은 packet 1개를 추가해 Main exact17, 전체 dirty exact32이며 제품 mutation은 0이다.
- 남은 구현은 exact15 안의 DB-backed `reclaim_orphan`과 product-mutation current execution+write fencing guard다. B-10은 `BLOCKED_PENDING_B09_ACCEPTANCE`다.
- 이 projection에서 API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 실행하지 않았다.

## B-09 R3 second valid failure revision — sequence 295

- 동일 lineage `B-09` / fingerprint `DB_FENCING_RECOVERY_CONTRACT_GAP`의 두 번째 유효 실패를 수용하고 AGENTS §6에 따라 `WI-B-09-20260820-003`으로 revision했다. 기능 범위·요구사항·중요 위험·Developer exact15는 변경하지 않았다.
- seq291→295는 epoch-2 write lease 회수 → epoch-2 worker lease 회수 → epoch-3 worker/write lease 발급 → `PACKAGE_RESUMED` 순서다. 새 token은 `b09-execution-fence-epoch-3-7c3382a` / `b09-write-fence-epoch-3-7c3382a`이며 이전 epoch token은 폐기됐다.
- Developer exact15는 현재 bytes 그대로 frozen이고 Main은 제품 파일을 수정하지 않았다. 정식 실패 2건을 canonical `failure-ledger.json`에 추가해 실제 dirty set은 frozen Developer 15 + Main R3 projection 16 = exact31로 투영한다.
- Main R3 projection에서 API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 실행하지 않았다. Developer DB 경계는 계속 Anvil 전용 격리 WSL PostgreSQL 18뿐이다.
- B-10은 `BLOCKED_PENDING_B09_ACCEPTANCE`다. 다음 안전 행동은 R3 epoch-3 token과 동결 exact15로 Developer 재작업을 재개하는 것이다.

## B-09 Authority Rebind R2 — sequence 290

- canonical clean/equal baseline `e33f231c2a7fbc7f020391939ff067f8d6177cb6`에서 authority binding 오류를 scope-change 없이 수리했다. seq286→290 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED`로 R1 epoch-1을 회수하고 R2 epoch-2를 발급했다.
- `APPROVAL-20260814-WORKPLAN-V16-001` successor binding과 실제 `developer-primary.md` SHA를 R2 WI에 결박했다. Operating Rules §2의 A1032/982B/8038 표는 승인 successor 전 역사 기준선이며, 기능·요구사항·위험·Developer exact15는 변경하지 않았다.
- `developer-primary-b09` epoch-2 worker/write lease와 Developer exact15만 활성이다. B-10은 `BLOCKED_PENDING_B09_ACCEPTANCE`다.
- 목표는 at-least-once durable queue, DB UTC claim, worker/write epoch fencing, poison quarantine와 Windows/WSL/Docker path identity다. assigned verification은 `AV-STAT-026/027/043`, `AV-SAFE-028`이며 FI-04는 동일 fingerprint별 최소 3회다.
- stale Worker Step·Tool·Event·filesystem commit은 `STALE_FENCING_TOKEN`으로 거부하고, alias는 같은 conflict scope key로 정규화해 이중 write lease 0건을 강제한다.
- start 시점 제품 산출물 0개, API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 모두 `NOT_EXECUTED`다. 실제 DB 검증은 이후 Developer 구현 중 Anvil 전용 격리 WSL PostgreSQL 18에서만 허용한다.
- B-09 acceptance, B-10 intervention/budget, B-11 API/BFF/SSE/UI, B-12 recovery는 시작하지 않는다.

## B-08 Main Acceptance — sequence 282

- 독립 Tester report SHA `EF8976924169E5267F9DD028C5ACAFAF836EDA0834069C0134E49C3618934DE9`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검증해 seq282 `MAIN_PACKAGE_ACCEPTED`로 B-08을 최종 ACCEPTED했다.
- B-09는 `READY / NOT_STARTED`다. active WorkInstruction, agent, worker lease, write lease는 모두 null이고 valid failure count는 0이다.
- 독립 Tester가 격리 WSL PostgreSQL 18에서 `0006 → 0007 → 0006`, PROJECT/RUN outbox→snapshot→ACK, hostile 13건, Event+outbox atomic rollback, downgrade cleanup을 실제 확인했다.
- API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`다. 이 projection은 B-09 queue·Worker/write lease를 시작하지 않고 안정적으로 종료한다.

## B-08 Developer Completion — sequence 281

- Developer exact15는 manifest file SHA `91B20ACE8DCBAC4C64F57F5F0158333F6E13665F6E615E81BEB74BE7D1CB47CC`, target `45B736CE7845E9E5E757DF45916B025479D7CD51EAC281A4CEBD8306BAAF695B`로 byte-frozen이다.
- seq279→281로 epoch-1 write lease와 worker lease를 순서대로 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW / PENDING_DATABASE_VERIFICATION`으로 투영했다. `B-08 ACCEPTED`가 아니며 B-09는 `BLOCKED_PENDING_B08_ACCEPTANCE`다.
- local framework-neutral 검증은 focused `10/10`, combined core `93/93`, FI-01/FI-02/FI-03 각 3회와 compile/import/diff를 통과했다. 이 결과는 실제 PostgreSQL 검증을 대체하지 않는다.
- 격리 WSL PostgreSQL 18은 WSL `E_ACCESSDENIED`와 플랫폼 escalation 거부로 `BLOCKED_NOT_EXECUTED`다. `0006 → 0007 → 0006`, 실제 constraint/hostile/transaction/crash/cleanup은 승인된 격리 PG18 환경에서 독립 검증해야 한다.
- API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`다. 다음 안전 행동은 격리 PostgreSQL 18 가용 후 B-08 독립 검증이며, 그 전 acceptance와 B-09 시작은 금지한다.

## B-08 Start — sequence 278

- canonical clean/equal baseline `9913636f030aa248216f58e3251cfa181f491d9c`에서 seq276→278 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`를 기록했다.
- `developer-primary-b08` epoch-1 worker/write lease와 Developer exact15만 활성이다. B-09는 `BLOCKED_PENDING_B08_ACCEPTANCE`다.
- 목표는 transactional outbox와 Project/Run progress·HANDOFF atomic exporter다. assigned verification은 `AV-STAT-009/011/012/013`이고 FI-01/02/03을 각각 최소 3회 검증한다.
- Event/outbox DB commit, JSON·Markdown sibling temp 작성·checksum, atomic replace, ProgressSnapshot, ack 순서를 강제하고 ack 전 scheduling을 차단한다. B-06/B-07은 read-only predecessor다.
- start 시점 제품 산출물 0개, API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 모두 `NOT_EXECUTED`다. Developer 구현 검증에서 WSL Anvil 전용 격리 PostgreSQL만 허용한다.
- 기능 범위·요구사항·중요 위험 변경과 새 DIR은 없다. B-08 acceptance, B-09 queue/scheduler/fencing, B-10 intervention/budget, B-11 API/BFF/SSE/UI, B-12 process/PC recovery는 시작하지 않는다.

## B-07 Main Acceptance — sequence 275

- 독립 Tester report SHA `B278C498DB599FE7FF67940996705758C9AECEF70466035B40F9FB7F36E1903C`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검증해 seq275 `MAIN_PACKAGE_ACCEPTED`로 B-07을 최종 ACCEPTED했다.
- B-08은 `READY / NOT_STARTED`다. active WorkInstruction, agent, worker lease, write lease는 모두 null이고 valid failure count는 0이다.
- 독립 Tester의 격리 WSL PostgreSQL 18 migration·metadata-only·hostile guard·rollback·cleanup 증거를 보존했다. API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`다.
- 신산님의 현재 지시에 따라 여기서 안정적으로 중단한다. B-08은 별도 시작 지시 전까지 시작하지 않는다.

## B-07 Developer Completion — sequence 274

- Developer exact15는 manifest file SHA `3DBF08310FF92E715A862F9AC79D73F634840D62C33D47E40373357B862E5DF1`, target `ECE15CC1FD547E381512A817F71308F897DC5469EBEF70E44039C14B118B65D5`로 byte-frozen이다.
- seq272→274로 epoch-1 write lease와 worker lease를 순서대로 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW / independent Tester PENDING`으로 투영했다. B-08은 `BLOCKED_PENDING_B07_ACCEPTANCE`다.
- Developer 검증은 focused `14/14`, core `69/69`, compile/import/diff를 통과했고 실제 WSL 격리 PostgreSQL 18에서 `0005 → 0006 → 0005`, metadata-only, hostile 9종 거부, cleanup을 확인했다.
- API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`다. B-07 acceptance와 B-08 시작은 금지하며 다음 안전 행동은 독립 Tester 검증이다.

## B-07 Start — sequence 271

- canonical clean/equal baseline `1a9c25b7ce2c257d40aaa10fcf3a0478f654db93`에서 seq269→271 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`를 기록했다.
- `developer-primary-b07` epoch-1 worker/write lease와 Developer exact15만 활성이다. B-08은 `BLOCKED_PENDING_B07_ACCEPTANCE`다.
- 목표는 Checkpoint·filesystem Artifact Store·EvidenceManifest다. 대형 log 본문은 artifact에 저장하고 DB에는 hash/ref metadata만 두며 assigned verification은 `AV-STAT-010`이다.
- manifest는 target hash와 Git·image·migration·config·policy·routing·environment·actor·raw checksum을 결박한다. B-08 progress/HANDOFF outbox/export, B-11 API/BFF/UI, replay/fork orchestration은 후속 범위다.
- start 시점 제품 산출물 0개, API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 모두 `NOT_EXECUTED`다. Developer 구현 검증에서 WSL Anvil 전용 격리 PostgreSQL만 허용한다.

## B-06 Main Acceptance — sequence 268

- 독립 Tester report SHA `8D19FC784223B24BBF082C815C2BB196321658F0896427D84E1F4A9DBB4AC1A5`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검증해 seq268 `MAIN_PACKAGE_ACCEPTED`로 B-06을 최종 ACCEPTED했다.
- B-07은 `READY / NOT_STARTED`다. active WorkInstruction, agent, worker lease, write lease는 모두 null이고 valid failure count는 0이다.
- 독립 Tester의 실제 격리 WSL PostgreSQL 18 migration·append·멱등·hostile guard·rollback·cleanup 증거를 보존했다. API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`이며 acceptance에서 추가 실행하지 않았다.
- 이 acceptance projection에서는 B-07을 시작하지 않는다. 다음 안전 행동은 별도 B-07 authority/WI/start projection이다.

## B-06 Developer Completion — sequence 267

- Developer exact15는 manifest file SHA `CB14005DAE3D4E89C1BCD1320969477C47BFF2C4172BFC8329B884FF52548F07`, target `B97BD64F82B4ACF675735B6D45B7C6AAE8A61965B8D528BC715BBB85574EC8EA`로 byte-frozen이다.
- seq265→267로 epoch-1 write lease와 worker lease를 순서대로 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW / independent Tester PENDING`으로 투영했다. B-07은 `BLOCKED_PENDING_B06_ACCEPTANCE`다.
- 구현 중 TDD로 발견해 해소한 내부 결함은 최종 `COMPLETED` 결과의 수정이며 accepted `FAILURE_REPORT`가 아니므로 canonical B-06 valid failure count는 0이다.
- Developer 검증은 events `14/14`, core `55/55`, compile/import/diff를 통과했고 실제 WSL 격리 PostgreSQL 18에서 `0004 → 0005 → 0004`, append·동일 재전송 멱등·hostile guard·resource cleanup을 확인했다.
- API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`다. B-06 acceptance와 B-07 시작은 금지하며 다음 안전 행동은 독립 Tester 검증이다.

## B-06 Start — sequence 264

- canonical clean/equal baseline `ebe9ce9c28c3e58f8d8200e5747e33ceb2d8174b`에서 seq262→264 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`를 기록했다.
- `developer-primary-b06` epoch-1 worker/write lease와 Developer exact15만 활성이다. B-07은 `BLOCKED_PENDING_B06_ACCEPTANCE`다.
- 목표는 append-only Event Store, reducer service, transition guard, optimistic version과 중복 Event 멱등 계약이다. assigned verification은 `AV-STAT-004/005/006/020`이며 B-01~B-05는 ACCEPTED다.
- framework-neutral version conflict까지만 B-06에서 구현하고 HTTP 409 route mapping은 B-11에 남긴다. navigation은 Event·projection·version을 바꾸지 않으며 blocked_code는 canonical 9종만 허용한다.
- start 시점 제품 산출물 0개, API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 모두 `NOT_EXECUTED`다. Developer 구현 검증에서 WSL Anvil 전용 격리 PostgreSQL만 허용한다.

## B-05 Main Acceptance — sequence 261

- 독립 Tester report SHA `122D901CEC44AFF20EC238F03B33BC1E98806C28C1FD5D2984224448E49184AE`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검증해 seq261 `MAIN_PACKAGE_ACCEPTED`로 B-05를 최종 ACCEPTED했다.
- B-06은 `READY / NOT_STARTED`다. active WorkInstruction, agent, worker lease, write lease는 모두 null이고 valid failure count는 0이다.
- actual isolated WSL PostgreSQL 18 migration·guard·cleanup 증거는 보존했다. API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`이며 acceptance에서 추가 실행하지 않았다.
- 이 acceptance projection에서는 B-06을 시작하지 않는다. 다음 안전 행동은 별도 B-06 authority/WI/start projection이다.

## B-05 Developer Completion — sequence 260

- Developer exact15는 manifest file SHA `262B9AB8AEBB5A940594A92000B9AA66E1F1C5908D5700C8AE5D0DEA55BE8E16`, target `8BFFC8B2F2D55DD951E59E849A5A2740723C0DC14CA1586E06C77FBD8E142BBB`로 byte-frozen이다.
- seq258→260으로 epoch-2 write lease와 worker lease를 순서대로 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW / independent Tester PENDING`으로 투영했다. B-06은 `BLOCKED_PENDING_B05_ACCEPTANCE`다.
- 구현 중 발견해 한 번에 해소한 trigger row-shape 문제는 최종 `COMPLETED` 결과 내부 수정이며 accepted `FAILURE_REPORT`가 아니므로 canonical B-05 valid failure count는 0이다.
- 실제 WSL 격리 PostgreSQL 18에서 `0003 → 0004 → 0003`, B-05 table `0 → 10 → 0`, function 0, hostile/valid guard와 exact container/network cleanup을 확인한 Developer evidence를 보존한다.
- API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`다. B-05 acceptance와 B-06 시작은 금지하며 다음 안전 행동은 독립 Tester 검증이다.

## B-05 WorkInstruction authority correction and epoch-2 rebind — sequence 257

- 상위 권위 `Anvil_설계서_v2.md` §49.3/§49.14와 작업계획 v1.6에 따라 `design_intent_reviews.status`를 정확히 `DIR_HOLD | REPORTING | WAITING_OWNER_DIRECTION | CLEARED`로 교정했다. 기능 목적, 요구사항, 중요 위험과 Developer exact15는 불변이다.
- `NOT_REACHED`는 review row와 progress projection이 모두 없는 상태이며 DB enum 값이 아니다. `CLEARED` 후 drift 재발 시 기존 row를 `REOPENED`로 바꾸지 않고 새 DIR review와 새 canonical Event를 생성한다.
- seq253→257은 epoch1 write/worker revoke 뒤 epoch2 worker/write 발행과 `PACKAGE_RESUMED`다. epoch1 token은 폐기됐고 제품 write는 0이다.
- Developer는 교정된 `WI-B-05-20260815-002`와 Invocation R2, epoch2 token, 동일 exact15만 사용한다. B-06은 `BLOCKED_PENDING_B05_ACCEPTANCE`다.
- API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 이 rebind에서 모두 `NOT_EXECUTED`다.

## B-05 Start — sequence 252

- canonical clean baseline `e59c4a105dab0faae31f43fd75e3ac53f1992ffe`에서 seq250→252 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`를 기록했다.
- `developer-primary-b05` epoch-1 worker/write lease와 Developer exact15만 활성이다. B-06은 `BLOCKED_PENDING_B05_ACCEPTANCE`다.
- 목표는 Task·Run·PlanStep·StepAttempt·Delegation·Result와 ProductValidation·Defect·ReleaseDecision·DIR schema, attempt 무결성, 사람 ReleaseDecision, blocking defect, DIR owner direction guard 구현이다.
- assigned verification은 `AV-STAT-008`; 선행 B-02, A-15, B-04와 workplan v1.6 successor는 ACCEPTED 상태다.
- start 시점 제품 산출물 0개, API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 모두 `NOT_EXECUTED`다. Developer 구현 검증에서 WSL Anvil 전용 격리 PostgreSQL만 허용한다.

## Workplan v1.6 Governance Successor — sequence 249

- 신산님의 공통 모듈·공통 API/BFF 우선 및 U-01~U-11 메뉴 순차 개발 승인 지시를 `APPROVAL-20260814-WORKPLAN-V16-001`로 결박하고 `HUMAN_APPROVED_SEMANTIC_PLAN_REVISION`으로 분류했다.
- base `56d409c4583bcf4090423995e79c63ae63598c1d`의 작업계획 v1.6, 매트릭스 v1.4, 테스트계획 v1.5와 짝 plan/spec를 raw hash로 고정했다.
- 재계산 결과 Package 108/unique 108, matrix reverse 108, missing 0, extra 0, AV 255, U Package 11개 직렬 의존이 일치한다.
- seq249 `EVIDENCE_MANIFEST_CREATED` 뒤에도 B-04는 ACCEPTED, B-05는 `READY / NOT_STARTED`다. active WorkInstruction/agent/worker lease/write lease는 모두 null이다.
- 제품/API/UI/DB/WSL/ysna/shared-db/production/deploy는 `NOT_EXECUTED`다. 이 successor clean commit/push 전에는 B-05를 시작하지 않는다.

## B-04 Main Acceptance — sequence 248

- 독립 Tester report SHA `343CAF908D2360D47220408F2127E56F355E3431A9FE0165E2CA84DC88C93A38`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검증해 seq248 `MAIN_PACKAGE_ACCEPTED`로 B-04를 최종 ACCEPTED했다.
- B-05는 `READY`지만 시작하지 않았다. active WorkInstruction, agent, worker lease, write lease는 모두 null이고 valid failure count는 0이다.
- actual isolated WSL PostgreSQL 18 evidence는 보존했다. API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`이며 이 acceptance에서 추가 실행하지 않았다.
- 이 clean acceptance commit에서 종료한다. B-05 start와 plan v1.6 통합은 별도 후속 projection 전까지 금지한다.

## B-04 Developer Completion — sequence 247

- seq245→247로 epoch-1 write lease와 worker lease를 순서대로 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW / independent Tester PENDING`으로 투영했다.
- Developer exact15는 manifest file SHA `D1E9A6A4C8526EC20E118051711B5E9F674B4CAA64FBFB325DAD86134122DB2D`, target `B33FB1C7BF55B8AB3EF88AC8433DB3232A49601DC8348FDAF4A210A4404B4834`로 byte-frozen이다.
- Main fresh 검토는 planning `9/9`, design/domain/persistence/planning `44/44`를 통과했다. 실제 WSL 격리 PostgreSQL 18에서 revision 0003 apply, 5개 table, 두 hostile constraint rejection, downgrade 0002 후 0개 table, exact container/network cleanup을 확인했다.
- 실제 API/UI/browser/provider/ysna/shared-db/production/deployment는 `NOT_EXECUTED`다. B-04는 아직 acceptance되지 않았고 B-05는 `BLOCKED_PENDING_B04_ACCEPTANCE`다.

## B-04 Start — sequence 244

- 최신 승인 문서 commit `1519d8cce5e205bd9e20652cc380e65e9ca01e49`을 clean/equal baseline으로 B-04 start를 재결박했다. B-04 기능 목적과 Developer exact15 제품 allowlist는 불변이다.
- seq242→244는 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`; `developer-primary-b04` epoch-1 exact15 제품 lease만 활성이고 Main projection exact16에는 human approval record가 추가됐다.
- 목표는 WorkPlan·IterationPlan·WorkInstruction과 독립 승인 종류의 canonical hash, invalidation, expiry, semantic/nonsemantic guard를 schema/service/framework-neutral API로 구현하는 것이다.
- 신산님의 승인 `APPROVAL-20260814-YSNA-INTERNAL-DEPLOY-001`에 따라 WSL-first same-commit 검증 후 `ssh ysna-server:~/deploy/anvil` localhost-only 지속 배포와 `shared-db` 내부 Anvil 전용 DB·role 경계를 결박했다. WSL read-only probe(`/home/daon`, git 2.43.0, Docker server 29.1.3)는 `PASS_AVAILABLE`이지만 start 시점 제품/API/DB/UI/provider/WSL runtime/production/deploy는 모두 `NOT_EXECUTED`다.
- B-04 Developer는 local isolated 또는 WSL Anvil 전용 격리 DB 검증만 수행할 수 있다. ysna/shared-db mutation, 기존 운영 자원 변경, 공개 `envil.sinsan.kr` 연결은 별도 계획 단계 전까지 금지한다.
- B-04 acceptance와 B-05 시작, B-11 공개 API/auth/BFF는 금지한다.

## B-03 R3 Main Acceptance — sequence 241

- Tester R3 report `E90448B45A...`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 검증해 seq241 `MAIN_PACKAGE_ACCEPTED`로 B-03을 최종 ACCEPTED했다.
- BLK-B03-R2-001은 CLOSED, historical B-03 valid failure 1이며 B-04는 READY다. active WI/agent/worker/write lease는 모두 null이다.
- R2 actual browser/service/security evidence는 보존하고 R3 browser rerun은 clone-helper 한정 범위상 `NOT_EXECUTED_NOT_REQUIRED_FOR_R3_SCOPE`다.

## B-03 R3 Developer Completion — sequence 240

- Developer exact5는 manifest SHA `C0E2EBAC...`, target `90155907...`로 byte-frozen이다.
- seq 238→240은 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-03은 `TEST_REVIEW / R3_PENDING`, 모든 lease와 active agent는 null이고 B-04는 차단이다.
- clone-local LF determinism 보완과 hostile inner-clone 검증은 Developer 범위에서 PASS다. R2 actual browser/service/security evidence는 그대로 보존하며 R3 browser runtime은 재실행하지 않았다.
- B-03 acceptance와 B-04 시작, provider/WSL/production/deploy는 수행하지 않는다.

## B-03 R3 Rework Start — sequence 237

- Tester R2 report SHA `D41F9D21...`의 `BLK-B03-R2-001-CURRENT-CHECKOUT-A13-INNER-CLONE-PORTABILITY`를 B-03 valid failure 1로 수용했다.
- 실제 B-03 browser/service/security evidence는 PASS·byte-frozen이다. 결함은 system `core.autocrlf=true`를 상속하는 A13 내부 clone의 successor raw/diff mismatch로 한정되며 explicit LF clone tooling `282/282`는 PASS다.
- seq 234→237은 `FAILURE_REPORT_ACCEPTED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED`; epoch-3 Developer exact5만 활성이고 B-04는 차단이다.
- 허용 수정은 clone-local LF determinism과 R3 validation/evidence/completion뿐이다. 제품·runtime 재구현, system/global Git 설정, acceptance, provider/WSL/production/deploy는 금지한다.

## B-03 R2 Developer Completion — sequence 233

- Developer exact15는 manifest SHA `ADC773EF...`, target `A08847E8...`로 byte-frozen이며 actual local E-SHOT 정상/오류/BLOCKED 3종과 E-EVT 5-event sequence를 포함한다.
- seq 231→233은 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-03은 `TEST_REVIEW / R2_PENDING`, 모든 lease와 active agent는 null이고 B-04는 차단이다.
- `apps/web/server.mjs` 변경은 B-03 R2 local same-origin bridge 승인 범위이며 A-14 frozen predecessor를 수정하지 않고 phase-aware successor로 결박한다.
- actual local UI/API/browser는 Developer evidence 범위 PASS지만 독립 Tester 재판정 전 acceptance가 아니다. provider/shared DB/WSL/production/deploy/B-11 canonical API는 `NOT_EXECUTED`다.

## B-03 R2 Rework Start — sequence 230

- Tester report SHA `F55282DD...`의 `BLOCKED`는 제품 결함이나 정식 `FAILURE_REPORT`가 아니라, B-03에 이미 배정된 CRITICAL `AV-FLOW-001` actual L4+L7 E-SHOT/E-EVT 검증환경 공백이다. valid failure count는 `0`을 유지한다.
- 권위와 코드 현실 검토 결과, 기존 B-03 목표/API 및 WorkInstruction 안에서 실제 local-only same-origin design-flow bridge를 제공하는 것이 가장 좁은 보완이다. B-11 canonical registry·SSE·production auth·공개 API·운영 배포는 금지한다.
- seq 228→230은 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED`; epoch-2 Developer exact15만 활성이다. B-03은 `ACTIVE / REWORK_IN_PROGRESS`, B-04는 acceptance 전 차단이다.
- R1 exact15와 Tester report는 byte-frozen이다. 실제 shared/WSL/production DB, provider, 외부 API, production, deployment는 계속 금지한다.

## B-03 Developer Completion — sequence 227

- Developer exact15는 manifest SHA `F6E41000...`, target `FC033DF8...`로 바이트 동결했다.
- seq 225→227은 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-03은 `TEST_REVIEW`, 독립 Tester는 `PENDING`, 모든 lease와 active agent는 null이다.
- AV-FLOW-002 artifact/audit의 static·unit 증거는 Developer 범위에서 PASS다. AV-FLOW-001 actual L4+L7는 `NOT_EXECUTED`이며, 이 미실행 경계가 PASS·REWORK·BLOCKED 중 어떤 독립 판정으로 이어지는지는 Main이 선결하지 않는다.
- 전체 cached diff-check의 EOF blank-line 경고 5건은 Developer frozen source에만 존재한다. exact15 raw/hash 보존을 우선해 수정하지 않았고 projection13 diff-check는 PASS다.
- B-03 acceptance와 B-04 시작은 수행하지 않았다. 실제 API·DB·UI·browser·provider·WSL·production·deploy도 `NOT_EXECUTED`다.

## B-03 Start — sequence 224

- B-02 acceptance commit `a589b17f26991432de5cf48cfe95c441cdd6da39`를 clean baseline으로 B-03을 시작했다.
- seq 222→224는 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`; Developer exact 15-path lease만 활성이다.
- 목표는 Artifact·§49 상태·API 필드와 root approval/비의미 파생 lineage 영속화다. AV-FLOW-001은 실제 L4+L7, AV-FLOW-002는 E-ART+E-AUD가 완료 조건이며 start 시점 제품 산출물과 runtime 증거는 0/`NOT_EXECUTED`다.
- B-04는 B-03 Main acceptance 전까지 차단한다. shared/production DB, provider, WSL, 직접 patch와 deploy는 금지한다.

## B-02 R2 Main Acceptance — sequence 221

- Tester R2 report SHA `D9C46F74...`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 수용하고 BLK-B02-001을 CLOSED 처리했다.
- B-02는 `ACCEPTED`, B-03은 `READY`; active failure 0, B-02 historical valid failure 1이며 모든 lease는 null이다.
- 의미 범위는 `server_version_num` 150017/180004이며 port key는 없다. R2 DB runtime은 재실행하지 않았고 기존 actual·독립 증거를 보존한다.

## B-02 R2 Developer Completion — sequence 220

- Developer exact4는 manifest SHA `9C0DC1AA...`, target `361EC1B0...`로 동결했다.
- seq 218→220은 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-02는 `TEST_REVIEW / R2_PENDING`, B-03은 acceptance 전 차단이다.
- `server_version_num` 의미 필드가 교정되었고 port key는 제거됐다. 실제 격리 PG15/PG18 런타임은 재실행하지 않았으며 R1 actual 및 독립 Tester runtime 증거를 보존한다.

## B-02 R2 Rework Start — sequence 217

- Tester report SHA `1B2F3A70...`의 `BLK-B02-001-COMPLETION-RUNTIME-FIELD-SEMANTICS`를 valid failure 1로 수용했다.
- 실제 격리 PG15/PG18 migration cycle PASS는 유효하다. 결함은 `server_version_num`을 port로 표기한 completion evidence 의미 오류에만 한정한다.
- seq 214→217은 failure acceptance → epoch-2 worker/write lease → `PACKAGE_RESUMED`; exact4만 Developer가 수정하며 B-03은 차단한다.

## B-02 Developer Completion — sequence 213

- Developer exact15는 manifest SHA `7D2C102C...`, target `B5AB5767...`로 동결했다.
- seq 211→213은 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-02는 `TEST_REVIEW`, 독립 Tester는 `PENDING`, B-03은 acceptance 전 차단이다.
- 격리 PG15 `150017`과 PG18 `180004`에서 UTC/plpgsql/schema/version_id 및 Alembic upgrade→downgrade absent→re-upgrade를 각각 exit 0으로 검증했다. API/UI/provider/production/deploy는 `NOT_EXECUTED`다.

## B-02 Start — sequence 210

- B-01 R3 acceptance commit `85730a48cdc71c06a67728bbd4640b1aeb7e5cb5`를 clean baseline으로 B-02를 시작했다.
- seq 208→210은 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`; Developer exact 15-path lease만 활성이다.
- 제품 산출물은 0개다. 실제 DB·WSL 검증은 Developer가 승인된 격리 PG15/PG18 환경에서 시도해야 하며 start 시점에는 `NOT_EXECUTED`다. shared/production DB, 직접 patch와 deploy는 금지다.

## B-01 R3 Main Acceptance — sequence 207

- Tester R3 report SHA-256 `C0E25D90FEC533AEBF34B81D6698C702D88D898949ECA74B58B96627F5A18CE0`의 `READY_FOR_MAIN_ACCEPTANCE / blockers 0`을 수용했다.
- seq 207 `MAIN_PACKAGE_ACCEPTED`로 B-01은 `ACCEPTED`, BLK-B01-001/002는 CLOSED, B-02는 `READY`다. active failure count는 0이고 B-01 historical count는 2다.
- NUL/ZWSP/BOM은 current Python `strip()` 계약 범위일 뿐 hash grammar PASS가 아니다. API·DB·UI·browser·provider·WSL·production·deploy는 `NOT_EXECUTED`다.

## Historical record — Phase B Gate successor projection

The former Phase B Gate successor projection remains historical only. The immutable Phase B Gate acceptance did not start C-01, and it is not a C-21 operational result.

## Current C-21 operational reconciliation projection

## 2026-09-03 C-21/LR-02A Main takeover R4 accepted

- 세 번째 동일 fingerprint 실패 후 Main Agent가 epoch4 lease로 직접 인수했다. rollback image/pointer durability, 실제 canonical script success harness, authenticated SSE 및 Last-Event-ID false-positive 차단을 완료했다.
- 독립 R4 검토는 `COMPLETED / PASS / READY_FOR_MAIN_ACCEPTANCE`, blocking 0이다. Reviewer 증거는 핵심 66 PASS, 적용 가능한 deploy/API 132 PASS, shell/diff PASS다.
- seq420~424는 Main lease 회수, package completion, Main acceptance, repository reconciliation을 append한다. LR-02A만 수락하며 C-21은 ACTIVE, LR-02B는 READY_FOR_WORK_INSTRUCTION다.
- 실제 Docker/SSH/DB/NPM/DNS/browser/deploy/정상 Telegram/Provider side effect는 실행하지 않았다. C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`로 유지한다.

## 2026-09-03 C-21/LR-02B 최소권한 test-session 시작

- LR-02A checkpoint `4178eee2ffeb0d5701e1fac058d89891331c74c2`를 feature remote에 push한 뒤 이를 새 validated base로 삼았다.
- seq425~428은 repository reconciliation, epoch1 worker/write lease, LR-02B PACKAGE_STARTED 순서다.
- Developer exact12는 test-session permission parser, 네 endpoint allowlist, Task authority scope와 ysna env 계약/테스트/증거만 소유한다.
- migration, Production Task/Run 생성, NPM/DNS/Telegram/Provider, UI/OIDC/RBAC, 배포 및 C-01은 범위 밖이며 외부 side effect는 아직 0이다.

## 2026-09-03 C-21/LR-02B Main acceptance

- Developer는 test-session permission parser, 네 endpoint allowlist, Task/Run authority, SSE run allowlist와 ysna exact scope 계약을 구현했다.
- 독립 R1 검토에서 중복 scope assignment preflight 우회 1건을 유효 실패로 수락했다. 같은 WI/epoch1 lease의 focused rework 후 canonical→reduced와 reduced→canonical 양방향을 deploy/verify 모두 거부해 fingerprint를 닫았다.
- 독립 R2와 Main fresh 검증은 전체 API `99 passed`, deploy 계약 `18 passed`, checker PASS, diff-check PASS이며 blocking 0이다.
- seq429~435는 failure 수락, focused resume, 두 lease 회수, package completion, Main acceptance, repository reconciliation을 append한다. historical failure 1은 보존하고 active failure는 0이다.
- 실제 ysna/DB/public HTTPS/SSE/Telegram/Provider side effect는 아직 실행하지 않았다. LR-02C를 READY_FOR_WORK_INSTRUCTION으로 전환하고 C-01은 계속 차단한다.

## 2026-09-03 C-21/LR-02C 운영 실행 도구 시작

- LR-02B checkpoint `dd4cc43452d30511ecf1a152e48408b7122391c0`를 feature remote와 동기화하고 이를 새 validated base로 삼았다.
- seq436~439는 repository reconciliation, epoch1 worker/write lease, LR-02C PACKAGE_STARTED 순서다.
- Developer exact12는 DB backup, idempotent validation provisioning, test-session run allowlist 원자 rebind, Provider read-only probe, 운영 verify와 계약 테스트/증거만 소유한다.
- DRAFT Task confirm은 C-21 검증용 CAS transaction으로 제한하고 일반 제품 API PASS로 승격하지 않는다. Last-Event-ID는 단일 event 미재전송으로 검증하며 가짜 successor event를 금지한다.
- Developer 단계의 외부 SSH/Docker/DB/Telegram/Provider/deploy/commit/push는 금지한다. 검증된 checkpoint 이후 Main Agent만 외부 실행하며 C-01은 계속 차단한다.

## 2026-09-03 C-21/LR-02C R3 독립 PASS 및 tooling acceptance

- 독립 Reviewer R3는 sticky `INCIDENT_HOLD`, restore/recreate finalizer, Telegram exact-one, 9 Provider non-billing, authenticated SSE/Last-Event-ID 계약을 재검증해 차단 결함 0건 `PASS`를 판정했다.
- seq448~449에서 Main epoch2 write/worker lease를 순서대로 회수하고, seq450~451에서 LR-02C tooling completion과 Main acceptance를 기록했다.
- seq452는 exact33 acceptance checkpoint를 결박했고, seq453은 ignored 작업보고서를 clean clone에도 보존하도록 exact34로 append-only 보정했다. 이 acceptance는 운영 도구 구현 수락이며 실제 ysna 운영 검증이나 C-21 전체 완료가 아니다.
- acceptance checkpoint commit·feature push 전까지 외부 side effect와 C-01은 계속 차단한다.

## 2026-09-03 C-21/LR-02C R2 failure 수락 및 Main takeover R3

- 독립 Reviewer가 `INCIDENT_HOLD` receipt가 정상 재실행에서 삭제되어 별도 해제 승인 없이 hold가 자동 해제될 수 있는 신규 blocker를 판정했다.
- seq446은 두 번째 유효 실패를 수락했고, seq447은 기존 Main epoch2 worker/write lease와 exact12 범위를 재발급 없이 유지한 채 R3를 재개했다.
- Main R3는 외부 호출 전에 기존 incident receipt를 검사하여 exit 91로 fail-close하고 receipt bytes와 호출 로그를 보존한다. incident receipt 자동 삭제는 제거했다.
- Windows harness에서 incident 후 재실행 거부, 외부 호출 0회, receipt/log bytes 불변을 검증했다. 외부 side effect와 C-01은 계속 차단한다.

## 2026-09-03 C-21/LR-02C R1 failure 및 Main takeover R2

- 독립 Reviewer는 test-session restore finalizer 누락과 canonical lease 없이 발생한 Main mutation을 blocking 2건으로 판정했다.
- 동일 Windows backup receipt mode harness 오류가 3회 반복된 시점에 Developer를 중단했으나 lease 회수 Event를 먼저 기록하지 않은 Main 관리 오류를 인정하고 seq440~445로 보정했다.
- seq440은 유효 실패 1회 수락, seq441~442는 Developer epoch1 lease 회수, seq443~444는 Main epoch2 worker/write lease 발급, seq445는 TakeoverPacket에 따른 `ACTIVE_REWORK_R2` 재개다.
- Main rework는 기존 exact12만 수정하며 성공·실패 모든 경로의 env restore, runtime recreate, restore 실패 시 INCIDENT_HOLD를 구현한다. 외부 side effect와 C-01은 계속 차단한다.

## 2026-09-03 C-21/LR-02C 운영 실행 시작

- tooling checkpoint `f39471a103d35406c3744fd727119072994a0d6a`를 main에 fast-forward 병합·push하고 완료 feature branch를 정리했다.
- 기존 C-21 승인 범위의 operational child WorkInstruction과 epoch3 Main worker/evidence write lease를 발행했다.
- `deploy/ysna/ReleaseManifest.json`은 release commit `f39471a`와 `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`에 결박한다.
- start projection commit·main 통합·push 전에는 외부 실행을 하지 않으며 C-01은 계속 차단한다.

## 2026-09-03 C-21/LR-02C backup portability rework 시작

- operational start projection `517fb4c39a3a9841eb5a07322235eb71989f1ec4`는 main에 통합·push됐다.
- ysna preflight에서 `INCIDENT_HOLD` 부재와 `shared-db` PostgreSQL 18.4 도구 가용성을 확인했으나, versioned backup script가 host `pg_dump`를 전제하여 dump 전 `command not found`로 종료됐다.
- DB dump·migration·runtime·public HTTP·Telegram·Provider side effect는 발생하지 않았고 임시 versioned script는 제거했다.
- seq458~464에서 epoch3 운영 lease 회수, failure 수락, Developer epoch4 exact2 lease, portability rework 재개와 exact21 repository reconciliation을 append했다.
- Compose·network·server package를 바꾸지 않고 `backup-c21-db.sh`와 계약 테스트만 수정한다. 완료·독립 검토·새 release binding 전 외부 실행과 C-01은 차단한다.

## 2026-09-03 C-21/LR-02C backup portability rework 수락

- developer exact2 구현을 checkpoint `095e1488ed85ec11986447539d04cf2b494dbd34`로 commit하고 feature 원격에 push했다.
- focused suite 211 PASS, Bash 문법과 diff 검사 PASS, 독립 reviewer blocking finding 0이다.
- seq465~469로 epoch4 lease 회수, package 완료·Main 수락, exact24 repository reconciliation을 append했다.
- ReleaseManifest는 checkpoint `095e148`에 결박하며 다음 단계는 main 통합 후 표준 Git 기반 backup/deploy/verify다.
- Telegram signed POST와 Provider probe는 신산님 검증 범위로 `USER_VERIFICATION_PENDING`을 유지하고, C-01은 계속 차단한다.

## 2026-09-03 C-21/LR-02C OPS-R2 운영 실패 수락 및 재작업 시작

- main/origin `ca945dfe4fed9befedc46620aff24729c3898952`, 승인 배포 대상 `095e1488ed85ec11986447539d04cf2b494dbd34`, ysna 관찰 HEAD `8ba679e`를 구분해 보존했다.
- preflight에서 `INCIDENT_HOLD` 부재, `.env` mode `600`, `shared-db` 존재, `anvil-web` healthy를 확인했으나 permission scope가 누락됐다.
- backup attempt 1은 exit `20`으로 종료됐다. SQLAlchemy DSN scheme `postgresql+psycopg2://`가 libpq에 그대로 전달되어 database name으로 해석된 것이 근본 원인이다.
- DB dump와 backup receipt는 생성되지 않았고 deploy/migration은 실행하지 않았다. Telegram/Provider 실호출은 신산님 검증 대기이므로 실행하지 않았다.
- seq470~474에서 유효 실패 수락, epoch5 worker/write lease 발급, OPS-R2 재개, exact13 repository reconciliation을 append했다. seq1~469와 동결 acceptance 파일은 변경하지 않았다.
- seq475에서 WI와 invocation의 EOF 여분 빈 줄 제거를 `MAIN_RECONFIRMED_NON_SEMANTIC`으로 재확정했다. 원 human approval 범위와 exact13, 기능 범위·요구사항·중요 위험은 변경하지 않았다.
- 제품 script와 deploy 계약 테스트의 수정은 다음 Developer TDD 단계로 남아 있다. 새 release binding과 검증 전 외부 재시도 및 C-01은 차단한다.

## 2026-09-04 C-21/LR-02C OPS-R2 release checkpoint 결박

- OPS-R2 구현 checkpoint `b4858ffb373066b24d7d9ee9bfde810160cacb75`를 ReleaseManifest의 source와 runtime target에 결박했다.
- 실제 검증은 tooling 93, backup contract 18, ysna scripts 6, API 99로 합계 216 PASS다.
- seq476은 release manifest binding, seq477은 governance exact10 repository reconciliation이다. seq1~475는 불변이다.
- 기존 OPS-R2 active WorkInstruction과 epoch5 worker/write lease는 ACTIVE로 유지한다. 제품 코드 변경은 없고 operational backup attempt2와 deploy는 `NOT_EXECUTED`다.
- Telegram signed POST와 Provider probe는 `USER_VERIFICATION_PENDING`, C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`를 유지한다.

## 2026-09-04 C-21/LR-02C OPS-R2 canonical main reconciliation

- fast-forward 통합 후 canonical `main`과 `origin/main`이 `970680a95a7e2471effc903239548948b3aa6263`에서 일치한 clean 기준선을 확인했다.
- seq478은 기능·요구사항·중요 위험을 바꾸지 않는 `MAIN_RECONFIRMED_NON_SEMANTIC` repository reconciliation이며 governance exact7만 허용한다.
- ReleaseManifest target `b4858ffb373066b24d7d9ee9bfde810160cacb75`, focused 216 PASS, epoch5 ACTIVE, operational backup attempt2/deploy `NOT_EXECUTED`를 그대로 보존한다.
- Telegram/Provider는 `USER_VERIFICATION_PENDING`, C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다. 이 reconciliation에서 외부 서버 실행은 하지 않았다.

## 2026-09-04 C-21/LR-02C OPS-R2 backup attempt 2 실패 수락 및 conninfo R4 재개

- 승인 release `b4858ffb373066b24d7d9ee9bfde810160cacb75`의 Git blob으로 수행한 backup attempt 2는 exit `20`이었다. normalize 후에도 URI 전체가 literal database name으로 해석됐고 dump·receipt는 생성되지 않았다.
- self DNS, local socket, direct TCP 인증은 PASS였고 `PGDATABASE` URL connect/dump는 FAIL, 같은 credential을 fd3 `pg_service.conf`로 전달한 connect/schema dump는 PASS였다.
- 동일 `C21_BACKUP_LIBPQ_DSN_SCHEME_INCOMPATIBLE` lineage의 두 번째 유효 실패로 seq479에 수락했다. seq480은 기존 epoch5 lease를 R4 exact13으로 계속하고 seq481은 feature worktree reconciliation을 기록한다. seq1~478은 불변이다.
- 제품 TDD는 `ANVIL_DATABASE_URL`을 Python stdlib로 strict parse·percent decode한 뒤 `[anvil_backup]` service bytes를 stdin→fd3로 전달하는 계약을 `31 passed`로 확정했다. credential/URI는 argv·log·receipt·disk에 남기지 않는다.
- 새 제품 checkpoint 이전 ReleaseManifest rebind와 backup attempt 3·deploy는 `NOT_EXECUTED`; Telegram/Provider는 `USER_VERIFICATION_PENDING`, C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`다.

```json anvil-recovery-summary
{
  "event_sequence": 481,
  "status": "ACTIVE",
  "current_work_package": "C-21",
  "last_event_id": "evt_c21_lr02c_ops_r2_conninfo_r4_exact13_repository_reconciled",
  "updated_at": "2026-09-04T12:05:02+09:00",
  "design_baseline_hash": "DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3",
  "valid_failure_count": 2,
  "active_work_instruction_sha256": "CCE5C3D315D101CEAABF30FF0B51D447602E7927B5193CF531D72B3034AACEC5",
  "active_invocation_sha256": "3BB6F14863D00548A5BA22653B1501628F34DCE9E26B2873E9414C202632A27D",
  "active_revision_binding_id": "MAIN_RECONFIRMED_NON_SEMANTIC:C21-LR02C-OPS-R2-EOF-NORMALIZATION-20260904-001",
  "next_safe_action": "OPS-R2 conninfo R4 exact13 구현을 검증·checkpoint commit·feature push한다. 새 ReleaseManifest 재결박 전 backup attempt 3·deploy는 금지하며 Telegram과 Provider는 신산님 검증 대기, C-01은 차단한다.",
  "dir_status": "CLEARED",
  "repository_head": "eef349682ff5598e3488c9e75163c5e0a99a0bdb",
  "repository_upstream": "origin/codex/c21-operational-execution",
  "repository_projection_mode": "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
  "repository_validated_base_commit": "eef349682ff5598e3488c9e75163c5e0a99a0bdb",
  "repository_head_relation": "FEATURE_WORKTREE_ACTIVE_OPS_R2_CONNINFO_R4_EXACT13",
  "repository_exact_allowed_paths": [
    "deploy/ysna/backup-c21-db.sh",
    "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md",
    "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json",
    "docs/progress/BUILD_HANDOFF.md",
    "docs/progress/build-progress.json",
    "docs/progress/failure-ledger.json",
    "docs/progress/progress-events.json",
    "docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-conninfo-rework-r4.json",
    "docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_INVOCATION_PROMPT_R4.md",
    "docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_WORK_INSTRUCTION_R4.md",
    "scripts/check_project_progress.py",
    "tests/deploy/test_c21_lr02c_operational_contract.py",
    "tests/tooling/test_project_progress.py"
  ],
  "current_release_binding_id": "MAIN_RECONFIRMED_NON_SEMANTIC:C21-LR02C-OPS-R2-RELEASE-B4858FF-20260904-001",
  "release_target": "b4858ffb373066b24d7d9ee9bfde810160cacb75",
  "focused_test_count": 230,
  "focused_operational_contract_count": 31,
  "operational_backup_attempt": 2,
  "operational_backup_status": "FAILED_EXIT_20_NO_DUMP_NO_RECEIPT",
  "backup_attempt3": "NOT_EXECUTED",
  "release_manifest_rebind": "NOT_EXECUTED",
  "deployment_status": "NOT_EXECUTED",
  "telegram_and_provider": "USER_VERIFICATION_PENDING",
  "c01_status": "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
  "reporting_decision": "AUTO_CONTINUE",
  "phase_b_gate_direct_set": "EXACT44_DEPENDENCY_SAFE",
  "phase_b_gate_deferred_ids": ["AV-STAT-021", "AV-STAT-022", "AV-STAT-023", "AV-STAT-024", "AV-STAT-025", "AV-STAT-028"],
  "phase_b_gate_undefined_ids": ["AV-STAT-029"],
  "phase_b_gate_approval_ref": "docs/approvals/APPROVAL-20260821-PHASE-B-GATE-EXACT44-001.md",
  "phase_b_gate_work_instruction": "docs/work_orders/PHASE_B_GATE_REWORK_WORK_INSTRUCTION_R3.md",
  "phase_b_gate_status": "TEST_REVIEW_EXACT44"
}
```

## 2026-08-21 Phase B Gate exact44 fenced start

- 신산님 승인 `APPROVAL-20260821-PHASE-B-GATE-EXACT44-001`에 따라 selector 충돌을 dependency-safe exact 44로 결박했다. 후속 책임 6개와 undefined `AV-STAT-029`는 Gate direct set에서 제외하고 후속 검증/미정의 상태로 보존한다.
- sequence 362~365는 `PACKAGE_WAITING_APPROVAL → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`다.
- `developer-primary-phase-b-gate`는 checker/test/validation/evidence/completion의 exact 7 paths만 쓴다. 권위 문서, B-01~B-12 accepted 산출물, 제품 코드, C-01, API/UI/provider/DB/WSL/ysna/deploy는 금지다.
- 현재 Gate는 `ACTIVE_EXACT44`; 독립 Tester와 Main Gate 판정 전 C-01은 `BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE`다.

## 2026-08-21 Phase B Gate exact44 R2 rework resumed

- 독립 Reviewer가 `SPEC: FAIL / QUALITY: FAIL`로 판정한 6개 보완사항을 유효 재작업으로 수용했다. 승인된 exact44 범위와 C-01 차단은 유지한다.
- seq 366~368은 이전 epoch-1 lease를 대체하는 R2 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_RESUMED`다.
- R2는 validation/completion 계약 내용 검증, B-12 historical manifest 검증 보존, 부정 경로 테스트, manifest 경로 containment, 실제 테스트 수치 정정을 수행한다.
- 현재 Gate는 `ACTIVE_EXACT44_REWORK_R2`; 독립 재검토와 Main Gate 판정 전 C-01은 계속 `BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE`다.

## 2026-08-14 B-01 R3 Main acceptance

- BLK-B01-001/002는 independent R3 retest로 CLOSED 되었고 B-01은 ACCEPTED다.
- B-02는 READY이나 이 acceptance commit과 clean clone 검증 전에는 시작하지 않는다.
- NUL/ZWSP/BOM 허용은 strip-semantics 계약이며 SHA-256 grammar 검증으로 과대 주장하지 않는다.

## 2026-08-14 B-01 R3 Developer completion → TEST_REVIEW

- Developer exact 5를 manifest SHA `3BB34296...`, target `49FB06F9...`로 동결했다.
- padding hostile regression과 domain `14/14 PASS`는 Developer evidence 범위이며 독립 재검증은 `R3_PENDING`이다.
- 실제 API·DB·UI·browser·provider·WSL·production·deploy는 `NOT_EXECUTED`; B-02는 acceptance 전 차단이다.

## 2026-08-14 B-01 R3 rework start

- R2 report의 ASCII/Unicode padding bypass를 두 번째 유효 실패로 수용했다.
- 제품 구현은 아직 시작하지 않았다. 현재 suite GREEN은 새 R3 hostile regression이 Developer exact 5에 아직 추가되지 않았기 때문이다.
- 실제 API·DB·UI·browser·provider·WSL·production·deploy는 `NOT_EXECUTED`; B-02는 acceptance 전 차단이다.

## 2026-08-13 B-01 R2 Developer completion → TEST_REVIEW

- Developer exact 5 paths는 R2 manifest SHA `DA32A7C2...`, target `E63009EE...`로 동결했다.
- hostile 3종은 Developer evidence에서 RED→GREEN, domain suite는 `13/13 PASS`로 기록됐다.
- 실제 API·DB·UI·browser·provider·WSL·production·deploy는 수행하지 않았다.

## 2026-08-13 B-01 Developer completion → TEST_REVIEW

- Developer exact 11 paths는 manifest SHA `BC89F69E...`와 target `DF891CED...`로 byte-frozen 상태다.
- seq 190→192는 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED` 순서다.
- B-01은 `TEST_REVIEW / COMPLETED`, 독립 Tester는 `PENDING`, 모든 lease와 active agent는 null이다.
- B-02는 `BLOCKED_PENDING_B01_ACCEPTANCE`; B-01 acceptance와 B-02 시작은 수행하지 않았다.

## 2026-08-13 B-01 fenced start

- A Gate acceptance와 DIR-1 `CLEARED`를 predecessor로 확인하고 `WI-B-01-20260813-001`을 발행했다.
- seq 187→189는 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED` 순서다.
- Developer write lease는 WorkInstruction의 exact 11 paths에만 유효하며 execution/write epoch는 각각 1이다.
- 현재 B-01은 `ACTIVE / IN_PROGRESS`, product artifact count는 0이다. B-02와 실제 API·DB·provider·WSL·production·deploy는 시작하지 않았다.

> 갱신일: 2026-08-11
> 현재 상태: `DIR-1 CLEARED / A Gate ACCEPTED / B-01 READY_NOT_STARTED`
> 현재 Phase / Package: `B / B-01 (not started)`

## 1. 현재 기준선

- 설계서: `Anvil_설계서_v2.md` v2.6 — 신산님 승인, P1 계약 정합성 4건 비의미 재확정
- 설계서 SHA-256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- 작업계획서: `Anvil_작업계획서_v1.md` v1.5 / SHA-256 `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- 통합검증매트릭스: `Anvil_통합검증매트릭스_v1.md` v1.3 / SHA-256 `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- 테스트계획서: `Anvil_테스트계획서_v1.md` v1.4 / SHA-256 `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- 검증 문서 상태: v2.6·v1.5·v1.3·v1.4, Package 97·AV 255·고유 실행 234·역색인 97·미할당 0 유지. A-01은 `AV-UI-005`만 `STATIC_ONLY`, `AV-FLOW-001`은 A-05·B-03·A Gate의 `RUNTIME_DEFERRED`
- 운영규칙: `docs/governance/ANVIL_OPERATING_RULES.md` v1.6 / SHA-256 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- A-01 사람 승인: `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001` / SHA-256 `9D440C46B0CD8F0F44C46B3143FCB1B4DF7322BF9A7E0BD0A52BCE8D873FA18F`
- A-01 파생 기준선: `BASELINE-A-01-PRECONDITION-DERIVED-20260810-001` / SHA-256 `E5A6E3B64CAAF48F6CDE51A1E8431A553C2CA2E4EF66DC7E5EE085D6F017E008`
- 비의미 binding: `MAIN_RECONFIRMED_NON_SEMANTIC:G-02-R2-G02-DEF-001` revision 3 / SHA-256 `8332635C9CE92B085AFFDF1B235F48945605DC87FA7294DA5FF88A589C95D03D`
- canonical parent baseline: `BASELINE-G-01-20260810-001` / `docs/baselines/G-01_BASELINE_RECORD.md` / SHA-256 `8EA9C6DA6E45955D7F7397C208FCFB0EFCC8C01B84851021F239350AC542847B`
- G-02 derived baseline: `BASELINE-G-02-DERIVED-20260810-001` / `docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md` / SHA-256 `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B`
- Git: `main` 초기 기준선 commit `6fab9aa95811ad09aa2f27a0e9c7f5b73bf12cfd`, remote 0개
- 제품 코드: 아직 없음; G-03은 directory scaffold와 tooling checker만 생성

## 2. 역할

- 최종 승인자: 신산님
- Main Agent·설계 책임자: 어울
- Primary Developer Subagent·작업 담당자: `developer-primary`
- Reviewer/Tester: G-01 PASS, G-02 revision 3 PASS, G-04 revision 2 PASS, G-05 revision 2 PASS, G-06 revision 2 PASS

## 3. 이번 설정에서 완료한 내용

- Developer Subagent를 `developer-primary`로 지정
- 루트 `AGENTS.md` 운영 진입점 생성
- Developer AgentDefinition 생성
- `[historical]` 프로젝트 운영규칙 v1.1 최초 작성
- 진행 상태와 세션 복구 파일 생성
- Developer의 설계서·작업계획서·MoaWorks 권고안 온보딩 완료
- Developer의 운영규칙 독립 대조 검토와 보완 후 재검토 `ACCEPT`
- 신산님 지시에 따라 개발 결과 자동 수집·3상태 구분과 승인 요청 범위를 기능 범위·요구사항·중요 위험 변경으로 제한
- 신산님 지시에 따라 9개 LLM Provider 선택 요구사항을 설계서와 작업계획서에 반영
- Provider별 adapter를 독립 Work Package로 분리하고 전체 계획을 96개로 재산정
- 통합검증매트릭스와 테스트계획서의 검증 ID·L1~L7·evidence·회귀·독립 Tester 계약을 작업계획서에 반영
- 검증 문서 정규화 G-07을 추가해 전체 계획을 97개 Package로 재산정
- DIR-1(A-15)·DIR-2(C-15)·DIR-3(E-11)를 신산님 보고 전 자동 재개가 불가능한 `DIR_HOLD`로 고정
- D Gate의 조용한 학습 CRITICAL 실패에는 긴급 DIR-X를 추가하되 E-11 뒤 DIR-3을 유지
- 신산님이 설계서 v2.6 핵심 완성안을 명시 승인
- 승인 후 독립 검토 P1 4건을 `MAIN_RECONFIRMED_NON_SEMANTIC`으로 재확정
- v2.6의 ProductValidation·Defect·Release, queue fencing, 비용 예약, egress/secret/web 보안, EvidenceManifest, Git-only 배포·monitoring 계약을 97개 Package에 반영
- `[historical]` 검증 매트릭스·테스트계획 v1.1에서 255개 ID·고유 실행 234개로 최초 정규화
- Local 개발 DB=WSL-server PostgreSQL 15, RC=WSL-server 격리 PostgreSQL 18, Production=ysna-server/`envil.sinsan.kr`로 확정
- `[historical]` 신산님이 작업계획 v1.3·검증문서 v1.1·D1~D10 통합 기준선을 승인하고 작업 시작을 지시
- 승인 기록 `APPROVAL-20260810-INTEGRATED-BASELINE-001`과 G-01 WorkInstruction 발행
- G-01 BaselineRecord·Source Inventory·EvidenceManifest·CompletionReport 작성 및 Main `PRELIMINARY_ACCEPT`
- G-01 독립 Tester가 artifact 5/5·canonical target·`AV-CON-016`을 검증해 `PASS`
- Main Agent가 독립 증거를 재계산하고 G-01을 최종 `ACCEPTED`
- 신산님이 G-02 Q-01~Q-06·과거 미할당 5건·D1~D10 계보 결정을 승인
- `[historical revision 1]` G-02 DecisionRecord·validation allocation·테스트계획 v1.2와 target `E70E5BEB4F132AA97DA4F717712EF9B5BFA68C602C71331B3225922E02212577`을 제출
- G-02 독립 Tester가 `G02-DEF-001`로 `AV-GATE-026 FAIL / REWORK` 판정, 실패 TestReport SHA-256 `4B853057C4C370470C075B14384EB9FA2B881E2684AAB00E5D83CF2AEE274BF2` 보존
- WorkInstruction revision 2에 따라 4개 authority 상태·revision·hash 참조를 비의미 정규화하고 Developer read-only 재온보딩 완료
- G-02 revision 2 target `6C440ED0FC95DDF5F65642649995F1554917E908AC44DF11AE76BDC3006473D9`, EvidenceManifest SHA-256 `275200DDACD9A59AC3CF65F3CD37E5142573705102A3C6CA50A99D5DFA29EEAA` 고정
- G-02 revision 2 독립 Tester가 `G02-DEF-002`로 `AV-SAFE-033 FAIL / REWORK` 판정, 실패 TestReport SHA-256 `680232DEB4F232D858C3EB70EAEA875A9895BCCF5A0B9D867A66C76B633A565B` 보존
- WorkInstruction revision 3에 따라 canonical `parent_baseline_id`·`root_human_approval_id`를 binding에 추가하고 `BASELINE-G-02-DERIVED-20260810-001`을 생성
- G-02 revision 3 canonical target `B01C9BF94B00588DFCEFE35096C0D64A39FACE4D4123D34E314C1A54B07F5F17`, EvidenceManifest SHA-256 `E39688335A0B1877116E34691977F8060E6B698A4D4F8E8A7B42BDBE5A3CD00A` 고정
- G-02 revision 3 독립 Tester가 `AV-SAFE-033`·`AV-GATE-026`을 모두 `PASS`로 판정하고 Main Agent가 최종 `ACCEPTED`
- 비차단 `G02-OBS-001`은 다음 비의미 문서 정비 시 표제 명확화로 이관하며 합격 작업을 다시 열지 않음
- G-04의 8개 canonical JSON artifact template, Draft 2020-12 schema/catalog, 표준 라이브러리 checker를 test-first로 구현
- G-04 RED 11/11 예상 실패를 관찰한 뒤 GREEN 11/11, G-03 경계검사 포함 전체 회귀 20/20 PASS
- WorkInstruction fixture 단독 semantic projection과 expected fixture의 Developer diff 0, negative mutation 11종 거부 확인
- `[historical revision 1]` G-04 target/delivered `857179EF2FF83D491C00A4DFF409808B6DF3446FF238F39EC9BF0BE289F11372`, EvidenceManifest file SHA-256 `009745BBB04BDAA2F2CE5806236FB773A3D2A704BB07033103D7A7878CBCCA2B`

## 4. 온보딩 판정

- v2.6/v1.4/v1.2/v1.3/운영규칙 v1.4 기준 Developer 재온보딩 `PASS / READ_ONLY_READY`
- 프로젝트 목적·Phase·역할·승인·복구·실패 3회·Skill/Hook/Plugin 규칙 이해도 10문항 합격
- 97 Package·255 ID(CON 21·실행 234)·DIR 4종과 G-02→G-03 차단사항을 정확히 설명함
- 현재 상태: `G-05_ACCEPTED / G-06_READY_WORK_INSTRUCTION_NOT_ISSUED`
- 온보딩 증거: `docs/onboarding/developer-primary-ack.md` / SHA-256 `3110F6B21EFC3C7BE61B6CEB71A4586A75A80DC129D79DDC4B0A74AFE0039A69`

## 5. 승인·결정 상태

- 통합 기준선 승인: `APPROVED`
- 승인 subject: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- D1~D8·D10: 현재 구현 기준 승인
- D9: benchmark 후 선택 정책 승인
- G-02 결정: Q-01·Q-03~Q-06 `HUMAN_CONFIRMED`, Q-02 `RESERVED_NOT_DEFINED`, 과거 미할당 5건의 현재 매트릭스 배정 확정
- G-02 작업 상태: `ACCEPTED`
- G-02 독립 Test Report R3: `docs/test_reports/G-02_TEST_REPORT_R3.md` / SHA-256 `F191B95AF36181715E71815081DE45673FE4D2A91AE1DB643597DB3917451D35`
- G-02 approval subject: `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`
- G-02 테스트계획 계보: `[historical]` v1.1 `FE6AEFE4A352A29D61CCD8AC3DD2EB6D6C9B1CDF8E3C095DFDC593C06586D1B8` → `[historical revision 1]` v1.2 `EB1AB1FACABFC9775FDE6F89D598673C40748DE8E01C444282958EBD9F26B80A` → 현재 v1.3 `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5`
- G-02 revision 3 binding: `MAIN_RECONFIRMED_NON_SEMANTIC:G-02-R2-G02-DEF-001`, `parent_baseline_id=BASELINE-G-01-20260810-001`, `root_human_approval_id=APPROVAL-20260810-INTEGRATED-BASELINE-001`, `derived_baseline_id=BASELINE-G-02-DERIVED-20260810-001`, `semantic_diff=NONE`
- G-01 최종 판정: `ACCEPTED`
- G-01 canonical target: `6E16BB405D58296CECDC1EE057A2DDE0A6FA601F6D289257CBBAE78E3C30A38C`
- G-01 독립 Test Report: `docs/test_reports/G-01_TEST_REPORT.md` / SHA-256 `E6471B535EB6A749F96E8C08A155F53E4BC2F90FFEFD00BD057C98351161C71A`
- G-03 revision 4 Developer 결과: `COMPLETED / TEST_REVIEW`
- G-03 독립 TestReport: `FAIL / REWORK_REQUIRED`, SHA-256 `91BCFC383C8D4970355F7A3366924181096F0AB92691AB94E36EB26C3FF1107E`
- 차단 finding: `G03-DEF-001` checker 우회, `G03-DEF-002` §25.3 경로 누락, `G03-DEF-003` pycache 범위 위반, `G03-DEF-004` inventory 총계 오류
- 현재 WorkInstruction: `WI-G-03-20260810-004`, SHA-256 `F7AB695C6B6D91D47287E12218A39A870E8AC3CADBBE09ED91E46B8E30CC0A3A`
- 동일 단계 유효 실패: G03-DEF-001~006은 scoped rework로 보완됐으며 독립 Tester PASS 전 `ACCEPTED` 금지
- G-03 revision 2 독립 TestReport R2: `FAIL / REWORK_REQUIRED`, SHA-256 `AE84877A644C9FDF2420318B52B716475235C97ED036DD0833A47AC7362016D1`
- 기존 `G03-DEF-001`~`004`의 원래 증상은 독립 closure 확인됨
- 새 차단 `G03-DEF-005`: 유효한 `from ..domain import events`를 checker가 domain 이탈로 오탐; 최초 1회
- 현재 WorkInstruction revision 3: `WI-G-03-20260810-003`, SHA-256 `5CB06696378B7F3BC313FA28F849C5534E11835D6EDA5402B4E0296680D84820`
- G-03 revision 3 독립 TestReport R3: `FAIL / REWORK_REQUIRED`, SHA-256 `F3EE86CD7636CF49A5F8BE510E60D310A558F1528F03CD5D0E60A75486CC20AD`
- `G03-DEF-005`와 기존 `001`~`004`의 지정 증상은 독립 closure 확인됨
- 새 차단 `G03-DEF-006`: beyond-top-level 상대 import가 음수 slice로 허용됨; revision 4에서 test-first 최소 guard로 closure 제출
- G-03 revision 4 target/delivered: `F03EC454E960BCF6A8271D7BE547129CB4220574254DCE9B927F2E12AFBFD6AB`
- G-03 revision 4 EvidenceManifest: `docs/evidence/manifests/G-03_EVIDENCE_MANIFEST.json` / SHA-256 `A089B389B21DBDADD7CBC6D18EC9C2374F858D4E92DD7BC75EF1580DA5D1388F`
- G-03 revision 4 독립 TestReport R4: `PASS / READY_FOR_MAIN_ACCEPTANCE`, SHA-256 `D9F25579559865C9369C8913C78AA20A496D06CE3D887F7F87BE3DEA12FA452F`
- Main Agent fresh 검증: unittest 9/9, checker, manifest target, pycache 0, Git 0 상태 PASS
- G-03 최종 판정: `ACCEPTED`; `G03-DEF-001`~`006` 실패 계보는 R1~R3에 보존
- G-04 revision 1 Developer 결과: `COMPLETED / TEST_REVIEW`, 이후 독립 Tester `REWORK`
- G-04 revision 1 target/delivered: `857179EF2FF83D491C00A4DFF409808B6DF3446FF238F39EC9BF0BE289F11372`
- G-04 revision 1 EvidenceManifest file SHA-256: `009745BBB04BDAA2F2CE5806236FB773A3D2A704BB07033103D7A7878CBCCA2B`
- Main fresh 검증: G-04 11 + G-03 회귀 9 = 20/20 PASS, checker 2종·JSON·hash·pycache 0 확인
- Main 판정: `PRELIMINARY_ACCEPT`; expected 비열람 독립 semantic reconstruction 대기
- G-04 독립 TestReport: `REWORK / AV-FLOW-003 FAIL`, SHA-256 `E31E3B27BCCB6F34F13EE8C3438F60CCBE618B5CC1E3CA53F3FCECF73DF170B5`
- `G04-DEF-001`: source WorkInstruction 단독 field/shape 선택 규칙 부재로 독립 projection diff 0 실패
- `G04-DEF-002`: manifest 선언 target canonicalization 재계산과 등록 target 불일치
- 현재 WorkInstruction revision 2: `WI-G-04-20260810-002`, SHA-256 `4330D9ED93731B70579D7BD7A590F65238738EFE425D829465DBE5BD75FB6558`
- revision 2 Developer closure: source `reconstruction_contract`가 projection field 순서·flat output·canonicalization·hash를 자체 기술하고 checker hard-code를 제거
- revision 2 Developer closure: 구조화 `target_algorithm`과 raw checksum 기반 target 함수로 실제 18개 artifact를 재계산
- revision 2 target/delivered: `5B5FA32568A7AD293C611BB5E85FCD4C0C0076EA787327CCC4AF1D936042827D`, canonical bytes `2109`, content bytes `85676`
- revision 2 EvidenceManifest file SHA-256: `F2674994201407532D6E18A9F9A0A94B606BA94385DCD126C03AF7F8264B09C1`
- revision 2 Developer verification: G-04 14/14, G-03 회귀 포함 23/23 PASS; finding closure는 독립 Tester 확인 전 공식 종료 아님
- G-04 revision 2 독립 TestReport R2: `PASS / READY_FOR_MAIN_ACCEPTANCE`, SHA-256 `0C5123F32FBD268EA6E91B9592F833F2A8D899119A47528FC5761C895B8D34AF`
- `G04-DEF-001~002` 독립 `CLOSED`, `AV-FLOW-003 PASS`, open blocking defect 0
- Main 최종 fresh 검증: 전체 23/23, checker 2종, report hash, JSON, diff-check PASS
- G-04 최종 판정: `ACCEPTED`
- G-05 revision 1 독립 TestReport: `FAILURE_REPORT`, SHA-256 `CB03A995BF654964623737C5A347DCBD21ED62BF1268E5A53F5867516C32C26E`; valid failure count 1
- G-05 revision 2 독립 TestReport: `PASS / READY_FOR_MAIN_ACCEPTANCE`, SHA-256 `ED0F03496060C84D67DE84C0758611610CD753CF8D854216F9933089F07C758C`
- `G05-DEF-001~006` 독립 `CLOSED`, 신규 차단 finding 0
- Main Agent 최종 판정: G-05 `ACCEPTED`; 검증된 revision 2 EvidenceManifest는 `docs/evidence/manifests/G-05_EVIDENCE_MANIFEST_R2.json` / SHA-256 `F9A5E7168B9B68B70D74B68DD495211BDC7961223E5E48CFC6F565638B9E69E6`로 불변 보존
- 신산님 승인 `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`: 확정 계획 안의 Package는 자동 진행하며 일반 진행 보고·계속 확인을 하지 않음
- 신산님 중단 보고 조건: 기능 범위·요구사항·중요 위험 변경 또는 DIR-1·2·3/canonical DIR-X 도달
- Git origin: `https://github.com/cyhuh7950/anvil.git`
- G-06 WorkInstruction revision 2: `WI-G-06-20260810-002` / SHA-256 `F8A966191412E3CC4CC29DC752169BC21B9E98CFD702134303F212454924352E`
- G-06 Developer 결과: `COMPLETED / TEST_REVIEW`; 8 fixture·8 golden·20 scenario·FI-01~08 계약과 Package별 immutable progress detached를 제출
- G-06 runtime scenario 상태: 전량 `DESIGN_LOCKED / NOT_EXECUTED`; 제품·브라우저·DB·배포 PASS 주장 없음
- G-06 revision 1 독립 TestReport: `FAILURE_REPORT / REWORK_REQUIRED`, SHA-256 `9B80C65D3DAC88CF0547C83F2F0E1D258974F678F057FB68943EB8E17A0DB42F`; 유효 실패 1회
- `G06-DEF-001`: REDFAIL fingerprint를 stable test ID·exception type·message만으로 canonicalize하고 32회 단일 hash로 재현
- `G06-DEF-002`: §49.17의 exact AV·responsible Package set·evidence set을 고정하고 wrong-nonempty trace를 거부
- `G06-DEF-003`: 8개 golden exact case hash·aggregate·subject candidate를 기존 사람 승인 계보의 Main-authored immutable anchor에 결박하고 coordinated rewrite를 거부
- G-06 golden anchor: `docs/baselines/G-06_GOLDEN_BASELINE_ANCHOR.md` / SHA-256 `4A3B9FBCC8460D793CA68DB3D88147413F5CE7EC653BA32CF8CFFA3A98AD8351`; 새 승인이 아닌 기존 사람 승인 범위 내 불변 evidence
- G-06 revision 3 Developer 결과: `COMPLETED / TEST_REVIEW`; 독립 Tester revision 2 재검증 대기
- G-06 revision 2 독립 TestReport: `PASS / READY_FOR_MAIN_ACCEPTANCE`, SHA-256 `436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546`
- `G06-DEF-001~003` 독립 `CLOSED`, 신규 차단 finding 0, `AV-GATE-005(fixture 기준)`·`AV-SAFE-010(fixture 준비)` PASS
- Main Agent 최종 판정: G-06 revision 3 `ACCEPTED`; 검증된 manifest는 `docs/evidence/manifests/G-06_EVIDENCE_MANIFEST_R3.json` / SHA-256 `1A61DA524064A0422E23F2C98B0179CD144E83470773FFFE1E4EAD58EA5D82F0`로 불변 보존
- G-07 WorkInstruction revision 2 `WI-G-07-20260810-002` / SHA-256 `1D51FBBB450BB677BDAD3BFB30DF04BBAB44C9F6472404735B08858A27C3B0FA`를 비의미 재결박하고, projection-aware 회귀 3건을 허용 범위 안에서 최소 수정함
- observed Git `main` HEAD와 `origin/main`은 `23bc0019aeba0d6ae2b04c52fad6c778d8b7b6e8`로 일치하며, stale `a70daa4` progress/HANDOFF 투영을 sequence 14 `REPOSITORY_RECONCILED` Event로 현재 관측값에 정합화함. 과거 push 시점으로 소급하지 않음
- G-07 active lineage의 valid failure count는 `0`; historical accepted failure는 G-05 1회·G-06 1회로 합계 `2`를 별도 보존함
- G-07 독립 TestReport: `PASS / AV-GATE-026 PASS / blocking finding 0`, SHA-256 `8F3C8CF31FA31DA7908F308953BFDDC9141327AB46D70AD4909CEFD540270DAF`
- Main Agent 최종 판정: G-07 revision 2 `ACCEPTED`; verified manifest는 `docs/evidence/manifests/G-07_EVIDENCE_MANIFEST_R2.json` / SHA-256 `7967674B6CBDA114ADF530C98B94BFB062888278F05AF7A9A775EA64EBE46320`로 불변 보존
- 별도 Phase G regression·독립 Gate TestReport·`PHASE_GATE_DECIDED` record 전에는 G Gate 완료 또는 A-01 READY로 승격하지 않음
- Phase G Gate Developer dry-run은 8단계 worker/write fencing 시나리오를 실행하고 `COMPLETED / TEST_REVIEW`로 제출함. standing approval은 Gate TestReport 이후 actor·approval_ref와 함께 적용하며 현재 적용하지 않음
- Phase G Gate 독립 TestReport revision 1은 `FAIL / REWORK`, `PGATE-DEF-001` 1건, SHA-256 `CEC22DA268505597042FD3C2113484FB805C6A0A4EAFFE2B9DADDB9FA63FD253`; Main이 정식 failure 1회로 수락함
- revision 2는 reconstruction `accepted_packages`를 canonical `G-01..G-07`과 exact 비교해 `G-07→G-99` wrong-but-nonempty 위조를 `GATE_RECONSTRUCTION_CONTRACT_MISMATCH`로 거부함
- Phase G Gate 독립 TestReport revision 2는 `PASS`, blocking 0, SHA-256 `1A0A852EAC34450BA1CB815C756096673CF2917B6915118F2BA2B46B9941B6DD`
- Main Agent는 standing approval `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`의 범위 일치를 확인하고 `owner_report_review_status=NOT_REPORT_SPECIFIC`으로 G Gate를 `ACCEPTED` 판정함
- 검증된 proposal manifest revision 2는 `docs/evidence/manifests/PHASE_G_GATE_EVIDENCE_MANIFEST_R2.json` / SHA-256 `C6A7CBC5FCD8B37DC9CE5DE48268DC45FEC13DE5401B4B44F08DB9016C1E9A3A`로 byte 불변 보존함
- 현재 상태는 Phase G Gate checkpoint commit/push 대기이며 A-01 WorkInstruction·구현은 아직 시작할 수 없음
- Phase G Gate checkpoint commit/push는 `5ca9c1f65a5909e75283b878764509d747d6d2cf`로 local/origin `main` 일치 확인됨
- sequence 26 `GIT_PUSH` event가 G Gate checkpoint `CLEARED`와 A-01 `READY` 전이를 기록함
- A-01은 시작 가능 상태지만 active WorkInstruction과 worker/write lease는 아직 `null`이며 구현은 시작하지 않음
- 신산님 승인 `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001`에 따라 A-01 역색인은 `AV-UI-005` 단독으로 정합화했고 `AV-FLOW-001` runtime 책임은 A-05·B-03·A Gate에 유지함
- `developer-primary` successor 재온보딩 ACK는 active authority 전량의 exact bytes/hash를 기록했으며 A-01 제품 구현 권한을 주장하지 않음
- sequence 27 `REPOSITORY_RECONCILED`는 local `a843ca71c5c3cb3bb5cc9ca85901a9bd320f6cfd`, upstream `57703ffc3521287cdd7d54b07bfd7c9001928388`을 실제 관측 그대로 비소급 기록함
- 현재 repository 상태는 `PUSH_PENDING_MAIN`; local/upstream 일치를 꾸미지 않았고 Task 3에서 commit·push를 수행하지 않음
- active WorkInstruction, worker lease, write lease는 모두 `null`; A-01 상태는 `READY`
- Main push 후 local `main`, tracking `origin/main`, remote `refs/heads/main`이 `355efcbbccf63ae89771923ba09db9b22acc03cb`로 일치함을 직접 재확인함
- sequence 28 `GIT_PUSH`는 A-01 responsibility successor의 실제 push 완료를 현재 projection으로 기록하고 sequence 27 pre-push 관측을 수정하지 않음
- post-push 상태도 A-01 `READY`, active WorkInstruction·worker lease·write lease `null`, derived baseline active를 유지함
- Main push 후 local `main`, tracking `origin/main`, actual remote `refs/heads/main`이 `84c47406a8d7e75e63f26cb8fed52b058237df5d`로 일치함을 직접 재확인함
- sequence 29 `REPOSITORY_RECONCILED`는 seq27/28을 수정하지 않고 독립 Task 4 검증 진입용 historical projection으로 보존됨
- sequence 30 `REPOSITORY_RECONCILED`는 Task 4 보고서 `9555428AF1FA22C05A74010849564F3DA6160DAD9C1C736DBE5E0B3EBD998369`를 수락하고 A-01 사전조건을 `ACCEPTED / READY_FOR_A01_WI`로 투영함
- active 상태는 A-01 `READY`, active WorkInstruction·worker lease·write lease `null`이며 `AV-FLOW-001`은 계속 `RUNTIME_DEFERRED`임
- repository projection은 base `853da76458929e007d8a02ab32f7f918ab26d590`와 정확한 9개 tracked path allowlist를 결박하며 final commit SHA 자기참조를 요구하지 않음
- sequence 31~33은 Main Agent가 `developer-primary-a01`에 worker/write lease를 발급하고 WI-A-01-20260811-001을 `ACTIVE`로 시작한 비소급 착수 기록임
- historical baseline `7422b07b85bcdcec52031e1b10098ab6ca089170`은 dispatch HEAD `e97c35540c51d812c221469e272f0f87cd667839`의 ancestor이며, dispatch-time local/upstream 일치는 start Event와 current repository projection에 별도 결박함
- `AV-FLOW-001`은 계속 `RUNTIME_DEFERRED / NOT_EXECUTED`; 기능 범위·요구사항·중요 위험 변경 및 DIR 도달 없음, 보고 결정은 `AUTO_CONTINUE`
- Developer는 A-01 정적 산출물 13개를 `COMPLETED_PENDING_MAIN_PROJECTION`으로 동결했고 Developer EvidenceManifest SHA-256 `11C7321DF2657879E8B46FE95A2E8B86ADA573BF91C0CD76C115B55ADEF2301B`를 제출함
- sequence 34·35는 write/worker lease를 순서대로 회수했고 stale fencing token의 후속 write·execution은 허용하지 않음
- sequence 36은 Developer 결과를 `COMPLETED / TEST_REVIEW / accepted=false`로 투영하며 독립 Tester L7 전 `ACCEPTED`와 A-02 착수를 금지함
- current repository projection은 base `16af3f4284245aea4df130c5efa30700743fc6f6`과 Developer 13개 및 Main completion projection/tooling을 합친 exact 24-path allowlist를 결박함
- 독립 Tester는 `A01-TST-BLK-001`을 첫 유효 `FAILURE_REPORT`로 확정했고, Main은 기능 범위·요구사항·중요 위험 변경 없이 WorkInstruction revision 2를 발행함
- sequence 37~39는 `developer-primary-a01`에 epoch 2 worker/write lease를 발급하고 TestReport finding에서 A-01을 `ACTIVE / REWORK_IN_PROGRESS`로 재개한 비소급 기록임
- rework 기준 local/upstream HEAD는 `d13b94a11b5f4151cccdd37a03c7ce61bf6409eb`; 기존 Developer manifest와 TestReport는 immutable predecessor로 유지함
- Developer는 revision 2 exact 8-path 산출물을 `COMPLETED_PENDING_MAIN_PROJECTION`으로 동결했고 `A-01_EVIDENCE_MANIFEST_R2.json` SHA-256 `BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4`를 제출함
- sequence 40·41은 epoch 2 write/worker lease를 순서대로 회수했고, sequence 42는 `COMPLETED / TEST_REVIEW / accepted=false / rework_revision=2`와 `A01-TST-BLK-001 FIXED_AWAITING_INDEPENDENT_RETEST`를 비소급 투영함
- revision 2 completion 기준 local/upstream HEAD는 `0162169cdbbf65c5f6b27c4625a82f5f16383bb6`; 독립 Tester R2 PASS 전 A-01 `ACCEPTED` 및 A-02 착수를 금지함
- 독립 Tester R2는 `PASS / READY_FOR_MAIN_ACCEPTANCE`, blocking finding 0, `A01-TST-BLK-001 RESOLVED`로 판정했고 TestReport SHA-256은 `9DD0EE2626800E28420DB5AC3597BE3D3717586632E7441938904E946EBCF620`임
- Main Agent는 revision 2 evidence를 재검토해 sequence 43 `MAIN_PACKAGE_ACCEPTED`로 A-01을 최종 `ACCEPTED`하고 A-02를 `READY`로 투영함
- 비차단 `A01-TST-R2-MIN-001`은 합격 Package를 다시 열지 않고 CompletionReport의 revision 2 sequence `40~42` 및 `17-path repository allowlist / 19-row predecessor evidence manifest` 구분으로 흡수함
- sequence 44~46은 Main Agent가 `developer-primary-a02`에 worker/write lease를 발급하고 `WI-A-02-20260811-001`을 `ACTIVE`로 시작한 비소급 기록임
- A-02 dispatch 기준 local/upstream HEAD는 `1ace56384d55cbe11d34f2532e9f602d389a9512`로 일치하며, start projection은 Main 전용 exact 10-path allowlist에만 쓰기를 허용함
- `AV-UI-001/002` canonical L4 runtime은 `RUNTIME_DEFERRED / NOT_EXECUTED`; A-02는 정적 계약만 구현하고 DIR은 미도달임
- Developer는 A-02 정적 산출물 11개를 `COMPLETED_PENDING_MAIN_PROJECTION`으로 동결했고 EvidenceManifest SHA-256 `FC2D3BD61BA7014CB74635D96AF68C3CCEE970E9FEAC52327A020570A52E5269`, target `D4CFB774263C4BEC16294155C8603B18CA6A677B389D9390B1644173B59029F0`을 제출함
- sequence 47·48은 write/worker lease를 순서대로 회수했고 sequence 49는 `COMPLETED / TEST_REVIEW / accepted=false`와 독립 Tester `PENDING`을 비소급 투영함
- completion 기준 local HEAD `2bd88123e93550db5874b479c82d78d4733fd53f`, origin/main `1ace56384d55cbe11d34f2532e9f602d389a9512`의 push lag를 `PUSH_PENDING_MAIN`으로 보존하며 A-03은 차단함
- 독립 Tester는 `DEF-A02-001`·`DEF-A02-002` MAJOR 2건으로 첫 유효 `FAILURE_REPORT`를 제출했고 TestReport SHA-256 `1732C036F79FBE05DF9EBF1BB59B67E621DAE8CC40259D30585714C01F73FAF8`을 불변 rework source로 결박함
- sequence 50은 A-02 valid failure count 1을 수락하고, sequence 51~53은 epoch 2 worker/write lease 발급과 `PACKAGE_RESUMED / ACTIVE / REWORK_IN_PROGRESS`를 비소급 투영함
- WorkInstruction SHA-256 `E98C59E23CA907993B250C663E69F9DCF93BA79DAD17BDADDD0EFF76429381F0`은 유지하며 rework 범위는 manifest validator/CLI와 Markdown semantic binding fail-open 보완으로 제한함
- 기존 Developer manifest, completion progress manifest, Tester report와 sequence 1~49는 immutable predecessor이며 A-03은 계속 차단함
- Developer revision 2 manifest SHA-256 `779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168`, target `5600CF11BED593D1187C454B54CA5CD218E149724EC0A7955C512E0520839CFD`를 frozen predecessor로 수락함
- sequence 54·55는 epoch 2 write/worker lease를 순서대로 회수하고, sequence 56은 `COMPLETED / TEST_REVIEW / accepted=false / rework_revision=2 / FIXED_AWAITING_INDEPENDENT_RETEST`를 비소급 투영함
- 독립 Tester R2는 `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking 0, `DEF-A02-001/002 CLOSED`로 판정했고 TestReport SHA-256은 `C2E545EE3B60921030EFB5F1267F86EAB7AF4EB63220B99154FBC960D762354D`임
- Main Agent는 sequence 57 `MAIN_PACKAGE_ACCEPTED`로 A-02 revision 2를 최종 `ACCEPTED`하고 A-03을 `READY`로 투영함. canonical L4는 `RUNTIME_DEFERRED / NOT_EXECUTED`를 유지함
- A-02 수락 checkpoint와 A-03 WI/Invocation commit·push 뒤 실제 Git은 local `main` = `origin/main` = `39af6aa58670f8ed1eb72fb4b5e4b13e9abb6599`, worktree clean으로 관측됨
- sequence 58~60은 Main Agent가 `developer-primary-a03`에 비소급 worker/write lease를 발급하고 `WI-A-03-20260811-001`을 `ACTIVE`로 시작한 기록임
- A-03 start projection은 Main 전용 10개 경로만 변경하며 Developer 제품 산출물은 아직 생성하지 않음. `AV-UI-003/004` canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`이고 DIR은 미도달임
- Developer는 A-03 정적 산출물 14개를 `COMPLETED_PENDING_INDEPENDENT_TEST`로 동결했고 EvidenceManifest SHA-256 `9C3E9C70B61C7D477736B15502F5F3061493A5C8718F26D0B091FE23CB66F1CC`, target `18DED6D1F1034044F7A8B55864AF35F507789BF08FE9B60C70806A6C190093CA`를 제출함
- sequence 61·62는 write/worker lease를 순서대로 회수하고, sequence 63은 `COMPLETED / TEST_REVIEW / accepted=false / independent Tester PENDING`으로 비소급 투영함
- completion 기준 local `main` = `origin/main` = `dc2ba63e1d923663724d1291cbcec007e4e7e7fe`; exact 25-path Developer completion/TEST_REVIEW projection이며 A-04는 `BLOCKED_PENDING_A03_ACCEPTANCE`임
- A-03 static 계약만 제출됐으며 canonical L7, Browser/API/DB/Network/Docker/배포는 계속 `RUNTIME_DEFERRED / NOT_EXECUTED`; DIR 미도달임
- 독립 Tester는 `A03-TST-BLK-001`(Project Register의 environment/backend-policy/operational connection state 누락)과 `A03-TST-BLK-002`(completion-era upstream hardcoding) MAJOR 2건으로 첫 유효 `FAILURE_REPORT`를 제출했고 TestReport SHA-256은 `DD89EB18AB4F16FB46C752734870DBC125D11AC38512EC1F79B25D47EEDC00D6`임
- Main은 sequence 64로 valid failure count 1을 수락하고 successor `WI-A-03-20260811-002`를 `MAIN_RECONFIRMED_NON_SEMANTIC`으로 발행함. original WI와 revision 1 evidence는 불변 predecessor임
- sequence 65~67은 epoch-2 worker/write lease를 발급하고 A-03을 `ACTIVE / REWORK_IN_PROGRESS / RETEST_REQUIRED`로 재개함. A-04는 계속 `BLOCKED_PENDING_A03_ACCEPTANCE`임
- rework dispatch 기준 local `main` = `origin/main` = `f8b52a5a3b3acfa2776b06bd178e0911c1ead582`; exact 15-path Main rework-start projection이며 Developer write scope는 finding closure 10개 경로로 제한함
- Developer는 revision 2 exact 10-path 산출물을 동결했고 EvidenceManifest SHA-256 `772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE`, target `7D089D2EAC2ADF5899F041B6234B0A1393EA1256F2AC8395789CBE1EBF2CEA2A`를 제출함
- sequence 68·69는 epoch-2 write/worker lease를 순서대로 회수하고, sequence 70은 `COMPLETED / TEST_REVIEW / accepted=false / rework_revision=2 / FIXED_AWAITING_INDEPENDENT_RETEST / R2_PENDING`을 비소급 투영함
- revision 2 completion 기준 local `main` = `origin/main` = `ed9225206edd1f075898a49f68c4db344e74cc1a`; exact 20-path completion projection이며 A-04는 계속 `BLOCKED_PENDING_A03_ACCEPTANCE`임
- 독립 Tester R2는 `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking 0, `A03-TST-BLK-001/002 CLOSED`로 판정했고 TestReport SHA-256은 `0D16D409B87B161F96811E9297A2F3877398B5124FA5D9D20D648C0235C07C2F`임
- Main Agent는 sequence 71 `MAIN_PACKAGE_ACCEPTED`로 A-03 revision 2를 최종 `ACCEPTED`하고 A-04를 `READY`로 투영함. canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`를 유지함
- acceptance 기준 local `main` = `origin/main` = `82b40d8e99c49d03741542dda7cceea0262b8270`; exact 11-path Main acceptance projection이며 A-04 WorkInstruction·lease·구현은 시작하지 않음
- A-04 WorkInstruction SHA-256 `1B8CE8809EC6546ED483D0E48294CC547F0767A5D0D31D120B08787290ED753E`, Invocation SHA-256 `DE5A605C7CDB3F84725C4792F612B0455AC00E5C669E8509C1FFF6F0A3F62CDB`를 clean dispatch 기준으로 결박함
- sequence 72~74는 `developer-primary-a04`에 epoch-1 worker/write lease를 발급하고 `WI-A-04-20260811-001`을 `ACTIVE / IN_PROGRESS`로 시작한 비소급 기록임
- dispatch 기준 local `main` = `origin/main` = `dd52c6abe1932d31db725e8f85bef2d3dd23143f`; exact 10-path Main start projection이며 Developer 제품 산출물은 아직 생성하지 않음. canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`, DIR 미도달임
- Developer는 A-04 exact 13-path 산출물을 동결했고 EvidenceManifest SHA-256 `C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB`, target `D2ED622DD179611026D8B396392C84EB5A373986C7733D0ADA78C897D049464E`를 제출함
- sequence 75·76은 epoch-1 write/worker lease를 순서대로 회수하고 sequence 77은 `COMPLETED / TEST_REVIEW / accepted=false / independent_tester_status=PENDING`을 비소급 투영함. A-05는 `BLOCKED_PENDING_A04_ACCEPTANCE`임
- completion 기준 local `main` = `origin/main` = `49678f55b4b814415b6ed7b140d4fce173ab09ab`; exact 24-path Developer+Main completion projection이며 canonical L7는 계속 `RUNTIME_DEFERRED / NOT_EXECUTED`, DIR 미도달임
- 독립 Tester는 `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking 0으로 판정했고 TestReport SHA-256은 `3C809FF5F8C31ABB349A19CAFE5151F403437A9757D0C6FC4BA5BC4A1BC4C1B3`임
- Main Agent는 sequence 78 `MAIN_PACKAGE_ACCEPTED`로 A-04를 최종 `ACCEPTED`하고 A-05를 `READY`로 투영함. A-04 historical valid failure count와 A-05 active valid failure count는 모두 0이며 canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`를 유지함
- acceptance 기준 local `main` = `origin/main` = `a5c60edff8ddfa4e8d06b315d728698ce7a06ef9`; exact 11-path Main acceptance projection이며 A-05 WorkInstruction·lease·구현은 시작하지 않음
- A-05 WorkInstruction SHA-256 `F80E1641704BD0FD436F220A13228463FFEC6E2585F083A0405075B2C5E8375C`, Invocation SHA-256 `68FC8350B726DE793A8F5DC8B6A988730A09E7B8C214579D49176D342B3C9F29`를 clean dispatch 기준으로 결박함
- sequence 79~81은 `developer-primary-a05`에 epoch-1 worker/write lease를 발급하고 `WI-A-05-20260811-001`을 `ACTIVE / IN_PROGRESS`로 시작한 비소급 기록임
- dispatch 기준 local `main` = `origin/main` = `c8629bea60d60a5dd158c3026e384a85af8178da`; exact 10-path Main start projection이며 Developer 제품 산출물은 아직 생성하지 않음. canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`, DIR 미도달임
- Developer는 A-05 exact 13-path 산출물을 동결했고 EvidenceManifest SHA-256 `90C6AA195FC1DB6AB48D02B4A6403BBE242488177045F393C05E17EAF76085F1`, target `974045F91F01FFDD342099BAA6CC2788C525FE8D74C7C8F5D0BDD31679E22266`를 제출함
- sequence 82·83은 epoch-1 write/worker lease를 순서대로 회수하고 sequence 84는 `COMPLETED / TEST_REVIEW / accepted=false / PENDING`을 투영함. A-06은 `BLOCKED_PENDING_A05_ACCEPTANCE`임
- 독립 Tester `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking 0을 결박하고 sequence 85로 A-05를 `ACCEPTED`, A-06을 `READY`로 투영함. A-06 구현은 시작하지 않음
- A-06 WorkInstruction SHA-256 `83B1F04472D28631CF73645486D8EC138BBB75B7F8EE8679BDA4F8B0C37AECC6`, Invocation SHA-256 `B4DBBD9937DEFD6F569585D0C3BDDCACD36262C199563E8A651E46B8E84765A1`를 clean dispatch 기준으로 결박함
- sequence 86~88은 `developer-primary-a06`에 epoch-1 worker/write lease를 발급하고 `WI-A-06-20260812-001`을 `ACTIVE / IN_PROGRESS`로 시작한 비소급 기록임
- dispatch 기준 local `main` = `origin/main` = `3bd97e693735df6a912ebb75e19eb45154997031`; exact 10-path Main start projection이며 Developer 제품 산출물은 아직 생성하지 않음. canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`, DIR 미도달임
- Developer는 A-06 exact 15-path 산출물을 동결했고 EvidenceManifest SHA-256 `A6F2B8B2E866A4F4AF6E2BAD8BAA2D005217071E263BA52FE63F35C935844449`, target `0CCF57584738B6CF38949D959297AF0877DC084070C352F7944C85AA0AF91258`을 제출함
- sequence 89·90은 epoch-1 write/worker lease를 순서대로 회수하고 sequence 91은 `COMPLETED / TEST_REVIEW / accepted=false / independent_tester_status=PENDING`을 비소급 투영함. A-07은 `BLOCKED_PENDING_A06_ACCEPTANCE`임
- completion 기준 local `main` = `origin/main` = `9cfe99e22ea71593575964a63e07ca4ee559d39f`; exact 26-path Developer+Main completion projection이며 canonical L7는 계속 `RUNTIME_DEFERRED / NOT_EXECUTED`, DIR 미도달임
- 독립 Tester는 `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking 0으로 판정했고 TestReport SHA-256은 `F27D15DA8068117710CE3551FAF839F3A4BA28AE9F3EF186DD39641F5E1CC560`임
- Main Agent는 sequence 92 `MAIN_PACKAGE_ACCEPTED`로 A-06을 최종 `ACCEPTED`하고 A-07을 `READY`로 투영함. canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`를 유지함
- acceptance 기준 local `main` = `origin/main` = `d358e04c795a4c02018c44b8d7a8fb32a23814cc`; exact 11-path Main acceptance projection이며 A-07 WorkInstruction·lease·구현은 시작하지 않음
- A-07 WorkInstruction SHA-256 `240371EB038AECE4F2613E83613871A737D4831B5FE9A832CB6534A558730799`, Invocation SHA-256 `1F6476D9F0B0D6EC571FA7456744160BC5CE04A4DBDB7A089A8E092289ABCD8F`를 clean dispatch 기준으로 결박함
- sequence 93~95는 `developer-primary-a07`에 epoch-1 worker/write lease를 발급하고 `WI-A-07-20260812-001`을 `ACTIVE / IN_PROGRESS`로 시작한 비소급 기록임
- dispatch 기준 local `main` = `origin/main` = `e46e098cb3439b91e71f14c1eedd20145de2e93a`; exact 10-path Main start projection이며 Developer 제품 산출물은 아직 생성하지 않음. canonical L4는 `RUNTIME_DEFERRED / NOT_EXECUTED`, DIR 미도달임
- Developer는 A-07 exact 15-path 산출물을 동결했고 EvidenceManifest SHA-256 `796B40512FBB0D6EAA596409B3464190455E772246FF361F6EC056D701DEA3E7`, target `45633F09FF8690D56499B75C813D6F5000FF4EB0323742CB6C1AF820396ECB9B`를 제출함
- sequence 96·97은 epoch-1 write/worker lease를 순서대로 회수하고 sequence 98은 `COMPLETED / TEST_REVIEW / accepted=false / independent_tester_status=PENDING`을 비소급 투영함. A-08은 `BLOCKED_PENDING_A07_ACCEPTANCE`임
- 독립 Tester 보고서 SHA-256 `A5352696B24E95FE8BD86E845AD8B4A0171C805B7521F21F3543461A8C628506`은 `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking finding 0이며 actual DIR과 runtime은 `NOT_EXECUTED`로 유지함
- Main Agent는 sequence 99 `MAIN_PACKAGE_ACCEPTED`로 A-07을 최종 `ACCEPTED`하고 A-08을 `READY`로 투영함. WorkInstruction·agent·worker/write lease는 모두 `null`이며 A-08 구현은 시작하지 않음
- acceptance 기준 local `main` = `origin/main` = `2818f9dd3957195d280de40565ef90c80c37c7b3`; exact 11-path Main acceptance projection임
- A-08 WorkInstruction SHA-256 `E418BE54E9AC98BEF61F782B127A83332C75ADD1A60CCCFE8DA8766634CC489E`, Invocation SHA-256 `5BB5F8C23B7CD90CCB478E023F8ECE3A1867768FDE9D56941292E9D0FD0C11CF`를 clean/equal dispatch 기준으로 결박함
- sequence 100~102는 `developer-primary-a08`에 epoch-1 worker/write lease를 발급하고 `WI-A-08-20260812-001`을 `ACTIVE / IN_PROGRESS`로 시작한 비소급 기록임
- dispatch 기준 local `main` = `origin/main` = `79495e6d0d7da3530f99bb81d5b713ad0b3aebbf`; exact 10-path Main start projection이며 Developer 제품 산출물은 아직 없음
- actual ProductValidation·Release·DIR 및 canonical runtime은 모두 `NOT_EXECUTED`를 유지함
- Developer는 A-08 exact 15-path 산출물을 동결했고 EvidenceManifest SHA-256 `73CC3936D3AF55674412C746B1CB95D53F08B3C8BDA927765286F3E60BE6C9A5`, target `0C10A4F557B2AAF6D90B5BA8C9320CFD694B4DCBF42C9FF3495E3B5D431DE52C`를 제출함
- sequence 103·104는 epoch-1 write/worker lease를 순서대로 회수하고 sequence 105는 `COMPLETED / TEST_REVIEW / accepted=false / independent_tester_status=PENDING`을 비소급 투영함. A-09는 `BLOCKED_PENDING_A08_ACCEPTANCE`임
- completion 기준 local `main` = `origin/main` = `3f6c7f26d5b5a4aaec435fbe7daefaa423230d42`; exact 26-path Developer completion/TEST_REVIEW projection임
- 실제 ProductValidation·ReleaseDecision·DIR과 canonical runtime은 수행하지 않았으며 `NOT_EXECUTED`를 유지함
- 독립 Tester 보고서 SHA-256 `74D97BB4CBA10151918EDBB49C859936FF2AB3835CAA60986BAFF5B21FFF155A`는 `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking finding 0임
- Main Agent는 sequence 106 `MAIN_PACKAGE_ACCEPTED`로 A-08을 최종 `ACCEPTED`하고 A-09를 `READY`로 투영함. WorkInstruction·agent·worker/write lease는 모두 `null`이며 A-09 구현은 시작하지 않음
- acceptance 기준 local `main` = `origin/main` = `757da39d234f6300148638c931b6c62aa241236d`; exact 11-path Main acceptance projection임
- actual ProductValidation·ReleaseDecision·DIR 및 canonical runtime은 acceptance 후에도 `NOT_EXECUTED`를 유지함
- A-09 WorkInstruction SHA-256 `5BB6F711EB22B8AF776CD04F5E51004B3DACB58D47B8E822BF55854650D152AC`, Invocation SHA-256 `539CD665C1194D8735AB118E84710C4F86F42CA0D4FE7E45DC93BC39BA479C7F`를 clean/equal dispatch 기준으로 결박함
- sequence 107~109는 `developer-primary-a09`에 epoch-1 worker/write lease를 발급하고 `WI-A-09-20260812-001`을 `ACTIVE / IN_PROGRESS`로 시작한 비소급 기록임
- sequence 110~112는 write lease 회수 → worker lease 회수 → `PACKAGE_COMPLETED / TEST_REVIEW` 순서이며 A-10은 A-09 Main acceptance 전까지 차단됨
- Developer manifest SHA-256은 `A917008E376E34F51BFADE8E74FE1B6E065D7FDBAC79C748D3DC0424A4E23EA3`, target은 `915B377C6390405664E8A2685DC502A65FE6305D8F327C80A46EFF457C4D4AA3`로 동결함
- completion 기준 local `main` = `origin/main` = `f7969b49784945807521f430ada1cf96adc2ae4f`; exact 27-path Developer+Main completion projection임
- Tester report SHA-256 `99F0B25764286668F709D221BE294D1A1F21BA2638EDAF5F0A4D5D7909DCF98F`, verdict `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking finding 0을 seq113 승인에 결박함
- seq113 `MAIN_PACKAGE_ACCEPTED`로 A-09를 최종 `ACCEPTED` 처리하고 A-10을 `READY`로 전환했으며 active WI/agent/leases는 모두 null임
- acceptance 기준 local `main` = `origin/main` = `e03f65f0c18e21847c99b2572e6bd5762d33c8f9`; exact 11-path Main acceptance projection임
- A-10 WorkInstruction SHA-256 `A7D527B3AA9B50F30589526EDC1D790B75A778D96C47A959B7C966418BFECCF5`, Invocation SHA-256 `5E7A236BF98C80B881F6B9C4FEFDAD2C047EE0A4FF758FEE0289B42D2343AD9E`를 clean/equal dispatch 기준으로 결박함
- sequence 114~116은 `developer-primary-a10`에 epoch-1 worker/write lease를 발급하고 `WI-A-10-20260812-001`을 `ACTIVE / IN_PROGRESS`로 시작한 비소급 기록임
- dispatch 기준 local `main` = `origin/main` = `0278141b9af2f94833f21997dddec52a5102fb3e`; exact 10-path Main start projection이고 Developer 제품 산출물은 없음
- 실제 Provider·Secret·Egress·runtime·DIR은 모두 `NOT_EXECUTED`임
- sequence 117~119는 write lease 회수 → worker lease 회수 → `PACKAGE_COMPLETED / TEST_REVIEW` 순서이며 A-11은 A-10 Main acceptance 전까지 차단됨
- Developer manifest SHA-256 `C9667081B8BEA555C32F8833D7F28BCF3528882324814CCE08CAAEAA27DE6A84`, target `C179BA2371401BB57CAA02B5148D96A58B094092BE52088E85C6BA9882CFA64A`를 동결함
- completion 기준 local `main` = `origin/main` = `1e26f461c78dbf10eb13a607f70ad7c4b7e78df5`; exact 27-path Developer+Main completion projection임
- Tester report SHA-256 `B1B51F68561805B3C12355D6A7A939063EA1AB77EF45553C22E036F4D1682045`, verdict `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking finding 0을 seq120 승인에 결박함
- seq120 `MAIN_PACKAGE_ACCEPTED`로 A-10을 최종 `ACCEPTED` 처리하고 A-11을 `READY`로 전환했으며 active WI/agent/leases는 모두 null임
- acceptance 기준 local `main` = `origin/main` = `ff433bcae92948bdecfe9a51fcb13a9c5c5050c2`; exact 11-path Main acceptance projection임
- 실제 Provider·Secret·Egress·API·DB·Event·browser·network·runtime·DIR은 모두 `NOT_EXECUTED`이며 A-11 구현은 시작하지 않음
- A-11 WorkInstruction SHA-256 `CDDBF40709CCE174F79EBDF64408783AEFAC4F0F471238782A2A5637BF9C65F0`, Invocation SHA-256 `2A3CEF1D7FB9A3E045067E32276861FCBD324E59DE7AB5A6AB4A25F3D639D36B`를 clean/equal dispatch 기준으로 결박함
- sequence 121~123은 `developer-primary-a11`에 epoch-1 worker/write lease를 발급하고 `WI-A-11-20260812-001`을 `ACTIVE / IN_PROGRESS`로 시작한 비소급 기록임
- dispatch 기준 local `main` = `origin/main` = `7983e21b1bb59b28af814ed457e56d82e392e496`; exact 10-path Main start projection이고 Developer 제품 산출물은 없음
- 실제 operations·API·DB·Event·SSE·browser·network·deploy·runtime·DIR은 모두 `NOT_EXECUTED`임
- sequence 124~126은 write lease 회수 → worker lease 회수 → `PACKAGE_COMPLETED / TEST_REVIEW` 순서이며 A-12는 A-11 Main acceptance 전까지 차단됨
- Developer manifest SHA-256 `23280C4FD8EA6C3FCEF814D8D429A4BA45FA0BE940E88E8237008B60FDBADFC0`, target `911C537607FD64112782A6E6506EAAFF4877EBE3C37B46CE8085D0C4C9C40654`를 동결함
- completion 기준 local `main` = `origin/main` = `b665a4f32451511adf5a466827b76fee54113c7c`; exact 26-path Developer+Main completion projection임
- 실제 operations·API·DB·Event·SSE·browser·network·deploy·runtime·DIR은 계속 `NOT_EXECUTED`임
- Tester report SHA-256 `1A4F7B02016E03A14F185CC8B847D496848EFADA3F4B6950C80640D99CA00275`, verdict `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking finding 0을 seq127 승인에 결박함
- CompletionReport의 `18 untracked`와 manifest 기준 product 16의 차이는 Tester가 `MINOR / non-blocking evidence-accounting inconsistency`로 판정했으며 acceptance 차단 사유가 아님
- seq127 `MAIN_PACKAGE_ACCEPTED`로 A-11을 최종 `ACCEPTED`하고 A-12를 `READY`로 전환했으며 active WI/agent/leases는 모두 null임
- acceptance 기준 local `main` = `origin/main` = `3d4ba6e22fb414406dd4987ff742624a1c00edaf`; exact 11-path Main acceptance projection이며 runtime/DIR은 `NOT_EXECUTED`임
- A-12 WI `9D2061A6F62C3101A4138A32642DB4C4AC9178B38B421B2C77B3E3A2FF37840F`, Invocation `C36FD20AC9D39A756C90B61887640C0F05AC91140E604241D738826C9056070A`를 결박하고 sequence 128~130으로 epoch-1 worker/write/start를 투영함
- dispatch 기준 local `main` = `origin/main` = `4d738afe62aa11cfaea5c005c7d98c0bb03e76ab`; exact 10-path Main start projection, 제품 산출물 0이며 browser/API/SSE/runtime/DIR은 `NOT_EXECUTED`임
- Developer는 A-12 exact 9-path 산출물을 동결했고 EvidenceManifest SHA-256 `269F925328145C86F99B5B9622419DDCCAE1A37D50DEF78E5965FF0CCF282015`, target `DB3457D0B73882183CCD1163ED16E86B64C8749D6BBAFBF4CB59942AA475E2CF`를 제출함
- sequence 131·132는 epoch-1 write/worker lease를 순서대로 회수하고 sequence 133은 `COMPLETED / TEST_REVIEW / accepted=false / independent_tester_status=PENDING`을 비소급 투영함. A-13은 `BLOCKED_PENDING_A12_ACCEPTANCE`임
- completion 기준 local `main` = `origin/main` = `0ce5c59552a5e7547e292903e484395395709ffd`; exact 19-path Developer+Main completion projection이며 browser/API/SSE/runtime/DIR은 계속 `NOT_EXECUTED`임
- 독립 Tester 보고서 SHA-256 `42BDCD1C71E6B0239E1A5313FE247D1491CF78692D5B6B6C4D815A5DEFD00583`는 `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`, blocking finding 0임
- sequence 134 `MAIN_PACKAGE_ACCEPTED`로 A-12를 최종 `ACCEPTED`하고 A-13을 `READY`로 전환했으며 active WI/agent/worker/write lease는 모두 null임
- acceptance 기준 local `main` = `origin/main` = `2d6c7e8d907def680797a08a7b9109194932221a`; exact 11-path Main acceptance projection이며 A-13 구현은 시작하지 않음
- A-13 WI `88B142690358661F456C715378B9AFACE5340FC4EBED90D567E07C8B58384835`, Invocation `8894A6AD20D829908AFAE6FB3C641544E1DCC0A9710C921ABC3681906C1BE4D0`를 결박하고 sequence 135~137로 epoch-1 worker/write/start를 투영함
- dispatch 기준 local `main` = `origin/main` = `23580ce603e8e78b4637bcb87f91546b8d08db8a`; exact 10-path Main start projection, 제품 산출물 0이며 user repository/browser/API/DB/WSL/production/DIR은 `NOT_EXECUTED`임
- dispatch 기준 local `main` = `origin/main` = `1bed9e88d962bebe9e4f6ad806b67d92c027fdcf`; exact 10-path Main start projection이며 Developer 제품 산출물은 아직 없음
- 실제 Skill·Hook activation, runtime, DIR은 모두 `NOT_EXECUTED`를 유지함
- completion 기준 local `main` = `origin/main` = `7627d74dba65b08ad53494f232af836b46f7f120`; exact 26-path Developer+Main completion projection이며 canonical L4는 계속 `RUNTIME_DEFERRED / NOT_EXECUTED`, 실제 DIR은 `NOT_EXECUTED`임

## 6. 다음 안전 행동

G-05, G-06, G-07, Phase G Gate와 A-01~A-13은 최종 `ACCEPTED`다. current Package는 `A-14 / READY`다.

DIR-1·DIR-2·DIR-3에 도달하면 결과가 `ALIGNED`여도 즉시 작업을 중단하고 신산님께 보고한다. 신산님의 계속 지시가 있을 때까지 후속 Gate·Package·Subagent·write·commit·push·배포를 시작하지 않는다.

## 7. 재개 절차

새 세션은 다음을 순서대로 확인한다.

1. 루트 `AGENTS.md`
2. 설계서·작업계획서 실제 hash
3. 운영규칙
4. `build-progress.json`
5. 이 HANDOFF
6. Developer 온보딩 증거
7. 승인 기록과 다음 WorkInstruction

불일치가 있으면 구현하지 않고 `RECONCILE_REQUIRED`로 신산님에게 보고한다.


## A-13 Developer 완료 → 독립 Tester 대기

- seq 138→140 순서로 write lease, worker lease를 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW`로 투영했다.
- Developer exact 17 paths는 frozen: manifest `BA2522405B707D0D17673BB029DCAF456D7891F76F09B60B03214DF8043FD2DE`, target `1AEC2DC560F1AF41B234FEDA3603C25F88B62740E8FB19A83FA85B770D3BA733`.
- A-14는 `BLOCKED_PENDING_A13_ACCEPTANCE`; actual user repository/browser/API/DB/WSL/production/DIR는 모두 `NOT_EXECUTED`.


## A-13 FAILURE_REPORT 수락 및 revision 2 재개

- Tester report `90765FDA6C240AE04A7548B265BC4E2506E9E1878F93DE353ECFEE1AD736A986`의 blocking 2건을 유효 실패 1회로 수락했다.
- seq 141→144로 failure 수락, epoch-2 worker/write lease, `PACKAGE_RESUMED`를 비소급 append했다.
- scanner core와 G-06 fixture는 동결하며 Developer는 5개 rework path만 수정할 수 있다. A-14는 acceptance 전 차단이다.


## A-13 revision 2 Developer 완료 → 독립 재검증 대기

- seq 145→147로 epoch-2 write/worker lease를 회수하고 `PACKAGE_COMPLETED / TEST_REVIEW`로 투영했다.
- 두 finding은 `FIXED_AWAITING_INDEPENDENT_RETEST`; Developer exact 5 manifest `4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771`, target `7629BE41F2174CEA6538B35C410A1E3DE7488A8BFD0BA166229F5C36DEB8A085`를 동결했다.
- A-14는 A-13 Main acceptance 전 차단이다.


## A-13 revision 2 Main acceptance

- 독립 R2 report `277B7F55EED69C3FDA112C6D8033674B5FC9AD63D39CDD89C2133865CBF66B86`의 blocking 0, BLK-001/002 CLOSED를 검증해 seq 148 `MAIN_PACKAGE_ACCEPTED`를 append했다.
- A-13은 ACCEPTED/completed, A-14는 READY이며 active WI/agent/lease는 없다.
- actual user repository/browser/API/DB/WSL/production/DIR는 NOT_EXECUTED다.

## A-14 fenced start

- clean/equal dispatch baseline: `main = origin/main = 38832955f475746c842c40433566309f989b4b64`
- WorkInstruction `WI-A-14-20260812-001`과 epoch-1 worker/write lease를 발급하고 sequence 149→151로 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`를 append했다.
- Developer는 exact 17 product/evidence paths만 쓸 수 있고 A-13 accepted adapter는 read-only predecessor다. Main은 Developer lease 동안 해당 경로를 수정하지 않는다.
- start 시점 product artifact는 0개다. 실제 browser/API/DB/provider/secret/egress/network/runtime/WSL/production/DIR은 모두 `NOT_EXECUTED`다.
- A-15는 A-14 independent verification과 Main acceptance 전까지 `BLOCKED_PENDING_A14_ACCEPTANCE`다.

## A-14 Developer 완료 → 독립 Tester 대기

- seq 152→154로 write lease, worker lease를 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW`로 투영했다.
- Developer exact 17 paths는 frozen: manifest `B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8`, target `985E6B205B38637B7EC74594B3C376DFF11C79EDEFF65A8930690F2B1206130B`.
- 실제 GUI browser/Network, production API/DB/SSE, Provider/Secret/Egress, user repository, WSL/production/DIR은 `NOT_EXECUTED`; fixture Node HTTP만 실행했다. A-15는 acceptance 전 차단이다.

## A-14 FAILURE_REPORT 수락 및 revision 2 재개

- 독립 Tester report `6A53A135F7362563846252D223376692938317F3A0C4E3EF07B5C767A201C768`는 `FAILURE_REPORT / REWORK_REQUIRED`, blocking 2건이다.
- Main은 `BLK-A14-002` clean-checkout successor raw-byte/hash mismatch만 첫 유효 제품 실패로 수락했다. `BLK-A14-001` Windows sandbox ACL은 `ENVIRONMENT_BLOCKED`이며 유효 실패 횟수에서는 제외했지만 acceptance 차단은 유지한다.
- seq 155~158은 FAILURE_REPORT 수락, epoch-2 worker/write lease 발급, revision 2 재개 순서다. A-14는 `ACTIVE / REWORK_IN_PROGRESS / RETEST_REQUIRED`, A-15는 `BLOCKED_PENDING_A14_ACCEPTANCE`다.
- 제품 Workbench 17개 경로는 동결한다. Developer는 A-13 successor checker/test와 A-14 successor evidence 경로만 수정하고, in-app browser를 다시 시도한다.
- 현재 전체 tooling 기준은 finding을 정직하게 보존한 `267/268`; 실제 in-app browser·production API/DB/SSE·provider/secret/egress·WSL/ysna·deploy·DIR은 PASS로 승격하지 않는다.

## A-14 revision 2 Developer 완료 - 독립 재검증 대기

- sequence 159-161로 epoch-2 lease 회수와 PACKAGE_COMPLETED TEST_REVIEW R2_PENDING을 투영했다.
- Developer R2 exact 5 manifest 67AD9BD4AC3203900B97074B233DA751DC4FD75F7C772F955CA00BB2665EE58D를 동결했고 기존 제품 17 paths는 불변이다.
- GUI browser는 ENVIRONMENT_BLOCKED; A-15는 A-14 Main acceptance 전 차단이다.

## A-14 R3 FAILURE_REPORT 수락 및 revision 3 재개

- 독립 Tester R3 report `D40A0FA0A64CF7FDA8DFBEF5605A3434941464614FD0BB3D3838385B00A30C69`의 `FAILURE_REPORT / REWORK_REQUIRED`를 유효 실패 2회째로 수락했다.
- `BLK-A14-001`은 `CLOSED`; `BLK-A14-002`는 committed seq161 successor raw bytes/hash mismatch로 `REOPENED CRITICAL`; stale scan/evidence/provider selection과 실제 `EMPTY/QUOTA/CANCEL/RECONNECT` route 부재는 `MAJOR`다.
- 사용자 승인으로 생성된 `WSL_ENVIRONMENT_MIGRATION_HANDOFF_2026-08-12.md` SHA-256 `7FDDD3FE2FBE2D31AD81BC21E8731D62C1823CC6B30DCF2491090B0857277942`는 변경하지 않고 Main evidence-only exact projection에 포함했다. Developer write는 금지한다.
- seq 162~165로 R3 failure 수락, epoch-3 worker/write lease 발급, revision 3 재개를 비소급 append했다. A-14는 `ACTIVE / REWORK_IN_PROGRESS / RETEST_REQUIRED`, A-15는 계속 `BLOCKED_PENDING_A14_ACCEPTANCE`다.
- Developer exact write scope는 R3 Tester finding을 닫는 최소 Workbench state/runtime fixture, A-13/A-14 checker와 tests, R3 evidence/validation/completion 경로뿐이다. 기존 제품 17개 경로 중 lease 밖 경로, Tester R3 report, WSL handoff, accepted authority/A-01~A-13은 불변이다.
- R3 출발 baseline은 targeted A-13+A-14 `23/26`, full tooling `260/268`이며 BLK-A14-002 및 UI runtime gap 관련 RED를 정직하게 유지한다. projection/project/G-07/Phase G rework-start invariants만 Main materialization에서 GREEN이어야 한다.
- 실제 browser retest와 same-origin/fixture non-PASS/security 검증이 필수다. production API/DB/SSE, real Provider/Secret/Egress, user repository, WSL/ysna, deploy, DIR은 실행하지 않았고 PASS로 승격하지 않는다.

## A-14 revision 3 Developer 완료 - 독립 R4 재검증 대기

- sequence 166~168로 epoch-3 write lease와 worker lease를 순서대로 회수한 뒤 PACKAGE_COMPLETED / TEST_REVIEW / R4_PENDING으로 투영했다.
- Developer R3 exact 12 paths와 manifest 830A16580403C0A29AFC23DDD29F921AFF0BDF116538E5675F2011185213AE25, target D9E78B29398209551E4AAE2A5AFE81FBAF6105BBDDD1517B9EC79DA5B5E01E64는 독립 재검증 전 byte-frozen이다.
- TDD RED와 Developer 기본 검증은 보존하지만 실제 Codex in-app browser/Network/console은 Main completion materialization에서 NOT_EXECUTED다. fixture·Node HTTP를 production 또는 실제 Provider PASS로 승격하지 않는다.
- A-15는 A-14 독립 R4 PASS와 Main acceptance 전까지 BLOCKED_PENDING_A14_ACCEPTANCE다.

## A-14 R4 세 번째 유효 실패 및 Main 직접 인수 완료

- 독립 Tester R4 report `10D591A1D87AD760BFACD7FCA70FD7A020DA87589DB12F035A8A59C6F207A2D9`의 `BLK-A14-R4-001 / CRITICAL`을 동일 A-13 clean successor false-rejection 계보의 세 번째 유효 실패로 수락했다.
- seq 169는 `FAILURE_REPORT_ACCEPTED / valid_failure_count=3 / MAIN_AGENT_TAKEOVER_REQUIRED`, seq 170은 leaseless Main takeover resume, seq 171은 `PACKAGE_COMPLETED / TEST_REVIEW / R5_PENDING / MAIN_AGENT_TAKEOVER_COMPLETED`다.
- TakeoverPacket `42B3F92672203CCD90E0F00B3AC257036E05794FB9CCABE66DB98C0C86B33263`과 Main evidence `77CA2CDC385E089DCCA5414C1CF7152DFE77B70B79A78C5C0C6F9E270D237381`를 결박했다.
- R4에서 실제 browser UI finding은 닫혔지만 후속 Main completion 단계에서 실제 browser/provider/production을 새로 실행하지 않았다. real Provider와 production은 계속 `NOT_EXECUTED`다.
- A-14는 독립 R5 PASS와 Main acceptance 전까지 미수락이며 A-15는 `BLOCKED_PENDING_A14_ACCEPTANCE`다.


## A-14 R5 실패 수용 및 줄바꿈 이식성 보완 완료

- 독립 Tester R5 report `3E0C98FDB01772F8446FAE7763C6D4EC786655AA32DD22BF73A37F338743667B`의 두 CRITICAL finding을 동일 계보의 네 번째 유효 실패로 수용했다.
- seq 172~174는 `FAILURE_REPORT_ACCEPTED → PACKAGE_RESUMED → PACKAGE_COMPLETED`이며 Main takeover를 계속해 `TEST_REVIEW / R6_PENDING`으로 전환했다.
- 과거 EvidenceManifest는 재작성하지 않고, 추적·clean successor registry와 `GIT_EOL_PORTABILITY_R1`의 exact LF canonical mapping으로 Windows mixed-EOL 및 새 LF clone을 동일 의미 증거로 검증한다.
- R5 실제 browser UI/same-origin/hostile finding은 CLOSED 상태를 보존한다. 실제 Provider·production API/DB/SSE·deploy·DIR은 `NOT_EXECUTED`다.
- A-15는 A-14 독립 R6 PASS와 Main acceptance 전까지 `BLOCKED_PENDING_A14_ACCEPTANCE`다.

## B-10 R3 Developer 완료 → 독립 재검증 대기

- sequence 330~332로 epoch-3 write lease와 worker lease를 순서대로 회수하고 `PACKAGE_COMPLETED / TEST_REVIEW / PENDING_RETEST`로 투영했다.
- Developer exact7은 manifest SHA-256 `5F0922A70F63E19D51306CCF43B67902BF9B82354E1F229616404DB5C2DB02A8`, target `5DEF1A06A2DC87BB074BA18F1BC346B098400B61741208BF1CF419B94BD21CD4`로 byte-frozen이며 Main projection의 제품 mutation은 0이다.
- R3 Developer evidence는 reservation-level authoritative final 불변성, exact canonical replay idempotency, distinct receipt/payload/actual/release 거부, PostgreSQL concurrency identity를 local·격리 PG18 범위에서 PASS로 기록한다. 독립 Tester의 R3 재검증 전 acceptance로 승격하지 않는다.
- 실제 API·UI·browser·Provider·shared DB·ysna·production·deployment는 `NOT_EXECUTED`이며 B-11은 `BLOCKED_PENDING_B10_ACCEPTANCE`를 유지한다.

## A-14 R6 Main acceptance

- 독립 Tester R6 report `04EF9AE33F5823829A30E0E9C41EA35F594A00DB09610BD890E23414DB500792`의 `READY_FOR_MAIN_ACCEPTANCE`, blocking 0을 Main이 검토해 seq 175 `MAIN_PACKAGE_ACCEPTED`로 A-14를 최종 `ACCEPTED`했다.
- R5 실제 IAB evidence `3E0C98FDB01772F8446FAE7763C6D4EC786655AA32DD22BF73A37F338743667B`는 UI target byte 불변 범위에서만 승계한다. R6 fresh IAB는 backend 부재로 `ENVIRONMENT_BLOCKED / NOT_EXECUTED`이며 PASS로 승격하지 않는다.
- 실제 Provider/Secret/Egress와 production API/DB/SSE, user repository, WSL/ysna, deployment, DIR은 모두 `NOT_EXECUTED`다.
- A-15는 `READY`로만 전환했다. active WorkInstruction/agent/worker lease/write lease는 모두 `null`이며 A-15 시작 event는 없다.

## A-15 fenced start

- clean/equal dispatch baseline은 `main = origin/main = 4bb8155e2d4a6bae7db57d2832716bd08eb0e4f9`다.
- WorkInstruction `WI-A-15-20260813-001`과 epoch-1 worker/write lease를 발급하고 seq 176→178로 `WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED → PACKAGE_STARTED`를 append했다.
- Developer write는 Artifact schema, API draft, field trace matrix, UX approval request, fixture/checker/test/validation/evidence/completion의 exact 12 paths로만 제한한다. A-14 제품과 accepted evidence, authority, progress/HANDOFF, 실제 승인 기록과 DIR artifact는 불변이다.
- 시작 시점 A-15 product/trace artifact는 0개이며 사용자 UX 승인은 `PENDING_USER_DECISION`이다. R5 실제 fixture browser 증거는 A-14 accepted predecessor로만 보존하고 R6 IAB는 `ENVIRONMENT_BLOCKED / NOT_EXECUTED`다.
- 실제 API/DB/Provider/Secret/Egress/WSL/production/deploy는 `NOT_EXECUTED`이며 A-15 acceptance 전 DIR-1은 `NOT_REACHED`다. A Gate는 `BLOCKED_PENDING_A15_ACCEPTANCE_AND_DIR1`이다.

## A-15 Developer 완료 → 독립 Tester 대기

- seq 179→181로 epoch-1 write lease와 worker lease를 순서대로 회수한 뒤 `PACKAGE_COMPLETED / TEST_REVIEW / accepted=false / independent_tester_status=PENDING`으로 비소급 투영했다.
- Developer exact 12 paths는 byte-frozen이다. EvidenceManifest SHA-256은 `2AEEACFCF8DB666EA89B85EE7C07A071F7B56DF52B3373F222801065A7918B60`, target은 `34FCA32938AB9DE68EFFE1C9F0E3FB57E994C5D74E172717D027F871DB3309AE`다.
- 사용자 UX 승인은 `PENDING_USER_DECISION`이며 실제 API/DB/browser/network/Provider/Secret/Egress/WSL/production/deployment는 `NOT_EXECUTED`다.
- A-15는 아직 `ACCEPTED`가 아니다. DIR-1은 `NOT_REACHED`, A Gate는 `BLOCKED_PENDING_A15_ACCEPTANCE_AND_DIR1`이며 독립 Tester 결과 전 승인·DIR 진입을 금지한다.

## A-15 Main acceptance → DIR-1 강제 중단

- 신산님의 현재 대화 명시 결정 `승인해`를 `APPROVAL-20260813-A15-UX-001`로 인증 기록하고, 승인 subject hash `25BA91B86F06B6343F8E6388B6B18AAA5DB40BDE3BEA427ED89C2DD4763DBAEC`에 결박했다.
- 독립 Tester 보고서 `F12CFEE0D7AE7A766C740CB89177F3DF13B345B8BF0DA372CDF99ACEA97B65EA`의 `READY_FOR_MAIN_ACCEPTANCE`, blocking 0을 검토해 seq182 `MAIN_PACKAGE_ACCEPTED`로 A-15를 최종 `ACCEPTED`했다.
- canonical 순서대로 seq183 `DIR_REACHED`, seq184 `DIR_REPORTED`를 append했다. DIR-1 보고 판정은 `ALIGNED`이지만 상태는 `WAITING_OWNER_DIRECTION`이며, A Gate는 `NOT_STARTED / BLOCKED_PENDING_DIR1_OWNER_DIRECTION`이다.
- active WorkInstruction, agent, worker lease, write lease는 모두 null이다. 신산님의 별도 DIR-1 계속 지시 전에는 A Gate 판정, 후속 Package, Subagent, 제품 write, 배포를 시작하지 않는다.
- A-15 실제 API·DB·browser·network·Provider·Secret·Egress·WSL·production·deployment는 `NOT_EXECUTED`를 유지한다. A-14 R5 실제 browser 증거와 R6 IAB `ENVIRONMENT_BLOCKED / NOT_EXECUTED` 경계도 변경하지 않는다.

## DIR-1 owner direction → A Gate 판정

- 신산님의 현재 대화 지시 `계속 진행해`를 `APPROVAL-20260813-DIR1-CONTINUE-001`로 인증 기록하고 seq185 `DIR_OWNER_DIRECTION_RECORDED / CONTINUE`에 결박했다.
- DIR-1을 `CLEARED`로 전환한 뒤 누적 A-01~A-15 accepted evidence를 5개 권위 축과 Phase A Gate 기준으로 읽기 전용 검토했다.
- A Gate는 seq186 `PHASE_GATE_DECIDED / ACCEPTED`, blocking finding 0이다. B-01은 `READY_NOT_STARTED`로만 허용하며 B Phase start Event, WorkInstruction, agent, worker/write lease는 생성하지 않았다.
- 실제 API·DB·Provider·Secret·Egress·WSL·Production·deployment는 계속 `NOT_EXECUTED`다. A-14 R5 실제 browser evidence와 R6 fresh IAB `ENVIRONMENT_BLOCKED / NOT_EXECUTED` 경계를 보존한다.

## C-32 운영 successor projection — historical 보존 (sequence 375)

- C-32 운영 검증 결과는 `docs/evidence/manifests/C-32_YSNA_OPERATIONAL_PROJECTION_MANIFEST.json` 및 `docs/validation/C-32_YSNA_OPERATIONAL_PROJECTION_VALIDATION.md`에 별도 투영했다.
- 기존 progress event sequence 1~374, Phase B Gate `TEST_REVIEW`, 관련 historical hash와 C-01 차단 상태는 수정하지 않았다.
- 운영 증거는 전용 `shared-db/anvil`·`anvil_app`, migration head `0011_telegram_webhook_state`, live/ready 200, NPM webhook 외부 경로 및 Telegram `setWebhook` 성공이다.
- successor digest는 `docs/progress/progress-handoff-detached-digest-c32-operational-projection.json`에 기록했으며 Phase B Gate acceptance와 C-01 시작은 수행하지 않았다.
    "docs/progress/failure-ledger.json",
# B-11 R2 Developer 완료 → 독립 재검증 대기 — sequence 346

- Developer exact8은 manifest SHA `3F60EAE9A978EA8ED0ABB83CEB77EB0B1828251895AB0B323C5CC4C8481B8C23`, raw7 target `25167A1D9C951C9A3E032862F72A4F1D8F5EBCF310585812EE7DC7095F4B3ABA`로 byte-frozen했다. Main completion projection의 제품 mutation은 0이다.
- seq344→346은 epoch-2 `WRITE_LEASE_REVOKED → WORKER_LEASE_REVOKED → PACKAGE_COMPLETED`; B-11은 `TEST_REVIEW / COMPLETED / PENDING_RETEST`, B-12는 `BLOCKED_PENDING_B11_ACCEPTANCE`다.
- Main 독립 검증에서 focused `22 passed`, core `117 passed, 6 skipped`, hostile scope 403/zero dispatch와 nominal HTTP 및 FI-08 SSE strict successor를 확인했다. Browser는 기존 `ENVIRONMENT_BLOCKED`를 유지하며 PASS로 승격하지 않는다.
- 다음 안전 행동은 frozen exact8의 대화 분리 독립 Tester 재검증이다. B-11 acceptance와 B-12 시작은 금지한다.

## C-32 Operational Successor Projection — historical 보존

- C-32 운영 증거를 append-only successor로 투영했다. 전용 `shared-db/anvil` 데이터베이스와 `anvil_app` role, migration `0011_telegram_webhook_state`를 확인했다.
- `/health/live`와 `/health/ready`는 HTTP 200이며, `/integrations/telegram/webhook` same-origin 경로와 Telegram `setWebhook`/`getWebhookInfo`가 성공했다. pending update는 0이고 잘못된 secret은 HTTP 400으로 거부됐다.
- 기존 `progress-events.json`, `build-progress.json`의 historical event sequence/hash는 변경하지 않았다. 상세 증거는 `docs/evidence/manifests/C-32_OPERATIONAL_SUCCESSOR_PROJECTION.json`, `docs/completion_reports/C-32_OPERATIONAL_SUCCESSOR_PROJECTION.md`, `docs/progress/progress-handoff-detached-digest-c32-successor.json`에 둔다.
- 이 successor projection은 Phase B Gate 판정이나 C-01 시작 승인을 대체하지 않는다. 다음 안전 행동은 Main Agent의 historical baseline과 successor evidence 정합성 검토다.
