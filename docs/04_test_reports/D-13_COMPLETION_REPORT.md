# D-13 완료보고 — R4 재작업

## 판정 — 현재 R4

- 결과 계약: `COMPLETED`. 개발자 수정·기본 검증 완료이며 Main acceptance는 별도다.
- 재개 후 최신 실행: focused **104 PASS / 4.63s**, 전체 knowledge/API **1980 PASS / 18.60s**, compileall·diff-check **exit 0**, fail/skip 0.
- 2026-09-17 00:37 KST에서 seq1054, epoch-1 dual lease/token, WI/prompt hash, HEAD/branch를 다시 확인했다. lease 만료 11:30 KST 이전이며 exact6 유지.
- 최신 Main 지시에 따른 Git 경계 동기화 뒤 재개했다. Main이 local/tracking/remote `a3fa3ed09cd6998b234458b5283abafa0f222f88` 일치를 보고했다. 이 worker는 원격 호출·Git mutation을 실행하지 않았으며 local HEAD/branch만 read-only 재확인했다.

## 판단 이유 — R4 Blocking과 수정 전·후

- 변경 전: owner_revision을 먼저 저장하고 D06 register_use를 호출했다. 실패 후 partial revision이 남았으며 retry fast path와 query가 use 0인 상태도 APPLIED로 표시했다.
- 변경 후: 실제 owner receipt 검증 결과를 임시 value로 구성한다. `_register_use`는 D13 state를 바꾸지 않고 실제 D06 receipt를 반환한다. 원 D06 canonical use와 local use, candidate·activation ID/hash·selection ID/hash·snapshot ID/hash·task/run·scope·actor를 대조하고 owner revision에 `use_hash`를 결박한 후, owner_revision+uses를 한 번에 D13 state에 publish한다.
- register_use 전 또는 owner D06 use commit 후 fault가 발생해도 D13 mutable state는 호출 전과 완전히 동일하다. 임시 revision은 공개되지 않고 조회는 PENDING_OWNER_EVIDENCE / NOT_APPLIED, baseline context, local use 0이다.
- retry fast path는 canonical revision hash만으로 성공하지 않는다. 정확한 local+canonical use와 receipt `use_hash`가 모두 결박된 경우에만 멱등 성공한다. 누락 use는 NOT_APPLIED 및 완료 gate 차단 후 정상 retry로 복구하고, 유효 형식으로 hash를 다시 계산한 다른 run/snapshot/selection/activation use는 fail-closed한다.
- Hook owner가 첫 시도에 이미 one-shot selection을 만들었다면 그 실제 canonical receipt를 exact run/snapshot/context/principal/current ACTIVE trust와 대조하여 재사용한다. 새 run-start를 재발급하거나 외부 실행하지 않는다. Skill/Prompt의 기존 owner 멱등 API도 실제 receipt를 검증·재사용한다.
- **원자성 경계**: D13 publish 원자성을 보장한다. D07 L1/D10 selection/D11 run pin 또는 원 D06 use가 이미 생성된 뒤 fault가 나면 해당 owner의 정본 증거를 삭제·rollback하지 않는다. D13는 이를 미적용으로 유지하고 재시도에서 결박한다. cross-repository 분산 transaction이나 전체 owner rollback을 보장한다고 주장하지 않는다.

## 조치 — TDD·fresh 검증·변경·미검증

정확한 명령(cwd `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`):

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_learning_e2e_d13.py tests/api/test_learning_e2e_d13.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

| 단계 | exit | 실제 결과/fingerprint |
|---|---:|---|
| R4 적대 RED | 1 | 12 FAIL / 92 PASS / 4.61s: 네 owner × register-use 전후 partial state 8, local/canonical missing-use false APPLIED 2, rehashed wrong run/snapshot 2. selection/activation 변조 2건은 기존 D12에서도 이미 거부 |
| 첫 GREEN | 0 | 104 PASS / 4.57s |
| 중단 전 전체 회귀 | 0 | 1980 PASS / 19.53s |
| Git 경계 동기화 재개 후 fresh focused | 0 | **104 PASS / 4.63s** |
| 재개 후 fresh 전체 knowledge/API | 0 | **1980 PASS / 18.60s** |
| 재개 후 compileall | 0 | diagnostic 없음 |
| 재개 후 tracked diff-check | 0 | diagnostic 없음 |

- 보고서 갱신 후 exact6 각각 `git diff --no-index --check -- NUL <path>` 실행: 각 exit 1(신규 파일 차이), whitespace diagnostic 0. 마지막 tracked diff-check exit 0.
- R3 테스트 90건을 유지하고 R4 14건을 추가했다. 현재 unresolved test failures 0. fault injection/RED는 실제 owner 외부 장애나 정식 실패보고로 확대하지 않았으며 공식 ledger는 Main 소유로 미변경이다.
- R4 수정 파일 3개: `packages/knowledge/learning_e2e.py`, `tests/knowledge/test_learning_e2e_d13.py`, 본 보고서. 기존 exact6의 __init__/API/API tests와 owner/control 파일은 보존했다.
- 시작/재개 HEAD `a3fa3ed09cd6998b234458b5283abafa0f222f88`, branch `codex/c09-execution-backends-r1`. WI/prompt와 baseline hash는 아래 R1 권위 기록과 동일하다. 기존 dirty/untracked를 reset/stash/overwrite하지 않았다.
- 미검증: 실제 DB/HTTP/Provider/UI/OS/배포/영속 process restart, cross-owner transaction. runtime consumer는 계속 NOT_INTEGRATED, 실제 program/network는 NOT_EXECUTED다.
- rollback: R4의 publish-last/bound-use 검증/retry 보완 및 테스트·보고서만 역패치로 회수 가능하다. 실제 owner에 생성된 역사 receipt는 rollback 대상이라고 주장하지 않는다. Git/제품 rollback 실행 없음.
- progress/HANDOFF/control 파일 미갱신. worker는 stage/commit/push 또는 실제 network 호출을 수행하지 않았다.

R4 최신 SHA256:

- domain: `59967CDD6C132AC24D5F84556652900B5B56DBEB1EECD3FFA083BF57E5829698`
- domain tests: `E88E3970DAE20A880A0E5159DE5BE33118CF8D93932A9A2DE632A667482CC368`
- 나머지 제품 파일 hash는 R3와 동일하다.

---

# R3 과거 기록 — 아래 판정·수치는 R4로 대체됨

## 판정 — 현재 R3

- 결과 계약: `COMPLETED` — developer 수정·검증 완료, Main 독립 acceptance는 별도.
- 작성 2026-09-17 00:23 KST. 동일 seq1054 / epoch-1 worker·write lease·fencing token 유효(만료 11:30 KST), exact6 유지.
- 최신 focused **90 PASS / 3.80s**, 전체 knowledge/API **1966 PASS / 18.24s**, compileall 및 diff-check **exit 0**, fail/skip 0.
- R2의 실제 owner 구현은 유지하되 optional completion 우회를 차단했다. 아래 R2/R1 수치와 해당 판정은 과거 기록이며 현재 판정은 이 R3 절이다.

## 판단 이유 — R3 Blocking 해소

- 변경 전: D01/D07/D09·10/D11 owner를 주입하지 않아도 generic D06 selection/use로 reference load·revoke·terminal no-change 완료가 가능했다.
- 변경 후: MEMORY/SKILL/HOOK/PROMPT의 exact owner repository 누락은 `propose` 전 `E2E_OWNER_AUTHORITY_REQUIRED`로 거부하고 candidate를 생성하지 않는다. kind는 caller claim이 아니라 원 D06의 승인 review/action selector 검증 결과에서 도출한다.
- owner가 주입됐어도 실제 revision/receipt가 없으면 generic `next-task`는 `status=PENDING_OWNER_EVIDENCE`, `application_status=NOT_APPLIED`다. baseline context projection 유지, D13/D06 신규 use 0, affected runs 0이다.
- `capture_owner_selection`이 실제 owner immutable revision/receipt와 exact candidate/selection/snapshot을 결박한 뒤에만 D13 use를 등록하고 APPLIED로 전환한다. Skill의 실제 L1 load가 남기는 원 D07/D06 사용 계보도 보존한다.
- reference load, revoke/rollback 영향 완료, host terminal capture, no-change 최종 review 모두 owner evidence를 필수 검사한다. 누락 시 `E2E_OWNER_EVIDENCE_REQUIRED`이며 reference/terminal review/source transition 부작용이 없다. API도 동일 reason으로 거부한다.
- USER correction에는 위 네 repository 요건을 오적용하지 않는다. 기존 D01 USER source + D05 exact correction + D06 별도 human confirmation/selection/use provenance 경로로 APPLIED를 표현하며 허구 USER revision은 반환하지 않는다.
- 기존 잘못된 generic positive 완료 fixture는 네 kind별 실제 owner 준비/capture를 거치도록 교정했다. R2의 hash drift/foreign context/alias/rebind/source revoke/terminal boundary/DIR-X/search 회귀를 삭제하지 않았다.
- 네 실제 owner 각각에서 capture 후 context 변경 → 필요한 reference 1개 load → rollback 후 baseline 복귀/affected run 보존 → post-start no-change review까지 확인했다.

## 조치 — 검증·변경 파일·미검증·rollback

정확한 명령(cwd `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`):

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_learning_e2e_d13.py tests/api/test_learning_e2e_d13.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

| 단계 | exit | 실제 결과 |
|---|---:|---|
| R3 의도된 RED | 1 | 9 FAIL / 73 PASS / 3.25s: missing-owner 4, premature ACTIVE/use 4, USER application status 1 |
| 최소 gate GREEN | 0 | 82 PASS / 3.23s |
| 네 owner 정상 적용/rollback + API gate 보강 | 0 | **90 PASS / 3.80s** |
| 전체 knowledge/API | 0 | **1966 PASS / 18.24s** |
| compileall | 0 | diagnostic 없음 |
| tracked diff-check | 0 | diagnostic 없음 |

- R3 보고서 갱신 후 exact6 각각 `git diff --no-index --check -- NUL <path>` 실행: 각 exit 1(신규 파일 차이), whitespace diagnostic 0; 마지막 tracked diff-check exit 0.
- R3 변경 파일 4개: `packages/knowledge/learning_e2e.py`, `tests/knowledge/test_learning_e2e_d13.py`, `tests/api/test_learning_e2e_d13.py`, 본 보고서. __init__/API 구현 및 D01~D12 owner는 미수정.
- product errors 0; RED fingerprint는 위 optional-owner completion bypass 1개 lineage의 9 assertions이다. 정식 failure count/control ledger는 Main 소유로 미갱신.
- HEAD/branch 및 기존 dirty/untracked 상태는 아래 R2/R1 시작 기준 그대로 보존. stage/commit/push/reset/stash 및 외부 호출은 미실행.
- 미검증/잔여 경계: 실제 OS/Provider/HTTP/DB/UI/배포는 `NOT_EXECUTED`, runtime consumer는 `NOT_INTEGRATED`. 이번 적용은 실제 in-memory owner selection/load/receipt 및 context projection이지 모델·프로그램 동작 실행이 아니다.
- rollback: 이번 R3의 D13 gate/use 시점/projection 변경과 관련 테스트·보고서만 보존 가능한 역패치로 회수한다. R2와 이전 owner/control dirty는 보존한다. rollback 실행 없음.
- progress/HANDOFF/control 파일 미갱신. D Gate/Phase E 시작 권한을 발생시키지 않는다.

R3 최신 제품 SHA256:

- domain: `D70EC4E8619E64A582A50D0CD23B95855382E04A78C2FE331F269F7F1027AD5A`
- domain tests: `A22F05A4846843799A92A2D4F17DB71E9E0671383C4C813D894126A78AC2F480`
- API tests: `565F690C2A722256B5CA8A9CAA057C36E3BA410FA1A03B4F1EE786C74164B79F`
- __init__/API 구현 hash는 R2와 동일하다.

---

# R2 과거 기록 — 아래 판정·수치는 R3로 대체됨

## 판정 — 현재 R2

- 결과 계약: `COMPLETED`. 개발자 수정·기본 검증 완료이며 Main 독립 acceptance/D Gate는 별도다.
- 2026-09-17 00:10 KST 확인. 동일 seq1054 epoch-1 dual lease/token과 exact6 유지, 만료 11:30 KST 이전이다.
- 최신 focused **73 PASS / 2.76s**, 전체 knowledge/API **1949 PASS / 16.96s**, compileall 및 tracked diff-check **exit 0**. fail/skip 0.
- 실제 owner 저장소의 revision/selection/receipt만 증거로 사용한다. 모델·프로그램·UI 실행 또는 실제 runtime consumer 통합은 여전히 `NOT_EXECUTED` / `NOT_INTEGRATED`다.

## 판단 이유 — R2 finding과 변경 전·후

1. **generic revision 제거**: 이전 D06 kind/candidate hash projection을 Memory/Skill/Hook/Prompt revision으로 표현하던 것을 제거했다. owner capture 전 `selected_revision=null`, `owner_evidence_status=NOT_CAPTURED`이다. Host가 exact D01 MemoryRepository, D07 SkillRepository, D09 HookRegistry/D10 HookRuntime, D11 ModelRegistry를 주입하며 shared candidate/context/authority를 검사한다. payload/API의 owner 또는 trust 생성은 금지한다.
   - MEMORY: 실제 D01 entry ID/version/content hash + candidate/source/activation evidence를 검증하고 `resolve_context` receipt를 사용한다. revoke/rollback에서는 D01 public version API로 QUARANTINED/INACTIVE 후속 버전을 남겨 직접 신규 context resolve에서도 배제한다.
   - SKILL: 실제 host-materialized skill ID/version/hash/activation과 exact D06 selection으로 D07 explicit select 및 전체 L1 load를 수행한다. 실제 invocation/L1 receipt와 D07이 기록한 사용 계보를 보존하되 본문은 projection에 노출하지 않는다. Skill script/L2 프로그램은 실행하지 않는다.
   - HOOK: 실제 D09 definition/program 계보와 D10 host-trusted ACTIVE record를 검증하고 D10 run-start/next-run selection receipt를 생성한다. 테스트 trust 준비는 기존 D10 FakeSandbox shadow/pilot만 사용한다. 실제 OS program/Hook 동작은 0이다.
   - PROMPT/MODEL: 실제 D11 prompt revision의 exact candidate, model/benchmark/routing/human activation을 검증하고 `run_guard` PINNED selection과 실제 model refs를 보존한다. Provider 호출은 0이다.
   - USER: actual D01 USER correction source와 candidate provenance를 별도 `user_correction_provenance`로 반환한다. 새 USER revision을 만들었다고 주장하지 않는다.
   - D12는 주입된 실제 owner를 포함한 DAG의 hash/authority를 재검증한다. Skill body/Hook definition/Prompt body 변조 후 옛 hash 유지 시 조회부터 fail-closed한다.
2. **Task 경계**: 다른 run뿐 아니라 다른 task_id, 동일 session_id, 동일 host scope가 필수다. 같은 task의 새 run과 가짜 run-start는 거부한다. 현재 D02 snapshot은 수정하지 않는다.
3. **사후 terminal evidence**: 정상 fixture의 미래 no-change 사전 attestation을 제거했다. Host-only `capture_terminal_evidence`는 실제 선택된 run의 RunStart 이후 ended_at/attested_at, exact run/target을 검증한 뒤 D05 attest를 사용한다. D13 capture는 exact selection 및 현재 D05 attestation bytes hash/actor/context에 결박된다. 사전 capture, 다른 run/target, 미래/시작 전 종료, capture 후 attestation 교체는 no-change 생성 전에 거부한다. API mint 경로는 없다.
4. **AV-LRN-025 검색 증거**: host fixture에 intent/language 유사 조건을 추가하고 실제 D04 metadata search에 전달한다. 결과를 exact source record로 제한하고 승인 final_diff/target/source/유사조건과 matched pattern hashes, 실제 필요한 loaded refs를 immutable search receipt에 남긴다. 이미 아는 ID만 존재하는 것으로 성공하지 않으며 같은 pattern ID라도 language 불일치면 실패한다. 미선택 `unused` ExampleReference는 계속 로드하지 않는다.

## 조치 — R2 검증·변경 범위

정확한 명령(cwd는 기존 sandbox integration):

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_learning_e2e_d13.py tests/api/test_learning_e2e_d13.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

| 단계 | exit | 실제 결과/fingerprint |
|---|---:|---|
| R2 첫 적대 RED | 1 | 4 FAIL / 40 PASS: generic selected_revision, same-task bypass, early no-change, search_receipt 누락 |
| 첫 최소 GREEN | 0 | 44 PASS / 1.60s |
| 실제 owner 주입/selection RED | 1 | 4 FAIL / 44 PASS / 1.68s: owner injection 계약 부재 |
| helper 승인 재호출 교정 | 1 | 4 FAIL / 44 PASS / 1.89s: 테스트가 ACTIVE candidate evaluation capture를 반복한 INVALID_CANDIDATE_TRANSITION |
| 네 owner GREEN | 0 | 48 PASS / 1.80s |
| 실제 owner hash drift/USER provenance 보강 RED | 1 | 5 FAIL / 58 PASS / 2.43s: 3 owner drift 미거부, USER provenance 누락, Hook 직접 revoke guard의 예상값 보정(CANDIDATE_QUARANTINED 정상 거부) |
| 보강 GREEN | 0 | 63 PASS / 2.51s |
| 최신 focused | 0 | **73 PASS / 2.76s** |
| 전체 knowledge/API | 0 | **1949 PASS / 16.96s** |
| compileall | 0 | diagnostic 없음 |
| tracked diff-check | 0 | diagnostic 없음 |

- 현재 제품 실패 0. 개발 중 의도된 RED와 fixture 오류는 정식 FAILURE_REPORT로 집계하지 않는다. 공식 review/failure ledger는 Main 소유로 수정하지 않았다.
- R2에서 실제 수정한 파일은 domain, domain tests, API tests, 본 보고서 4개다. __init__/API 구현은 R1 내용 그대로 보존한다. D13 전체 범위는 아래 기록의 exact6이며 D01~D12 owner/control 파일은 수정하지 않았다.
- HEAD/branch 재확인: `a3fa3ed09cd6998b234458b5283abafa0f222f88`, `codex/c09-execution-backends-r1`; exact6 모두 기존 untracked 상태. `git status`에서 Git global ignore read permission warning이 있었으나 명령 exit 0이며 제품 테스트 실패가 아니다.
- source revoke 후 실제 D01 resolve 제외, D07 select 거부, D10 run-start 거부, D11 신규 run guard BLOCKED를 직접 검증했다. 진행 run snapshot/과거 receipt는 보존한다. 실제 Run 중단 명령은 하지 않았다.
- rollback은 정상 ACTIVE의 D06 baseline 복귀 및 Memory 후속 INACTIVE version, source revoke는 quarantine/baseline 복귀로 구분한다. 런타임 실행 결과를 비교했다는 주장은 없다.
- 보고서 갱신 후 exact6 untracked 파일별 `git diff --no-index --check -- NUL <path>` 수행 완료: 각 exit 1(신규 파일 차이), whitespace diagnostic 0. 마지막 `git diff --check` exit 0.
- 미검증: 실제 HTTP/DB/Provider/UI/OS/WSL/deploy, durable authority transport 및 runtime consumer. D07 L1은 실제 in-memory load했지만 body procedure 실행은 하지 않았다. D10 FakeSandbox 준비는 실제 program 실행 증거가 아니다.
- rollback 방법과 기존 dirty 보호는 R1 기록과 동일하다. 제품 rollback/Git stage·commit·push를 실행하지 않았다. progress/HANDOFF/control은 Main 소유로 미갱신이다.

R2 최신 제품 SHA256(보고서 제외):

- __init__: `DA403780A8F7EA0B011A936F5EE461A30637170689F11990F4BF942D39E79E2A`
- domain: `C912BD2A1E01DC58C9CF70E1645DC6B46CD880EFCC77AD6E0CC5CDB4B6FE0C48`
- API: `7B2C161D38E90A9510113BAAF213C00FEFCCCD4DE6848FEC7837432266F0F43E`
- domain tests: `91DC58F5A7A885722E108392BAE42998C235A4BC5DF18D081FA785074E965DEE`
- API tests: `661448AC5D89D0527909D311282C3F2760E19FE68A502CDED7B73D125C6A701A`

---

# R1 과거 기록 — 아래 판정·수치는 R2로 대체됨

## 판정

- 결과 계약: `COMPLETED` — developer 기본 구현·검증 완료. Main 독립 검토/acceptance 및 D Gate는 별도다.
- 담당 `developer-primary-d13-r1`, 작성 2026-09-16 23:45 KST.
- focused **40 PASS**, knowledge/API **1916 PASS**, compileall/diff-check **exit 0**.
- AV-LRN-013/025, AV-FLOW-018/022, AV-STAT-042 조건부 DIR-X의 **in-memory owner-contract/selection projection** 범위다. 실제 런타임 행동·화면·운영 검증을 PASS로 표시하지 않는다.

## 판단 이유

### 시작 기준·권위

- 작업 위치: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.
- HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`; branch `codex/c09-execution-backends-r1`.
- 기존 C/D 제품 및 Main 통제 dirty/untracked 보존. 새 clean branch라고 주장하지 않으며 Git stage/commit/push/reset/stash/cleanup 미실행.
- Main read-only 감사에서 C21 ancestor 포함 및 코드 기준선 유실 없음이 확인되어 동일 seq1054에서 재개했다. 원격 publication/branch 명명은 Main governance 범위다.
- canonical progress: `snapshot-d13-start-seq1054`, event_sequence **1054**, D13 IN_PROGRESS.
- worker `worker-lease-d13-r1-20260916-001`, execution fence `d13-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`.
- write `write-lease-d13-r1-20260916-001`, write fence `d13-r1-write-fence-epoch-1-234458b5283abafa`.
- issued `2026-09-16T23:30:00+09:00`, expires `2026-09-17T11:30:00+09:00`. 확인 host 23:33 및 최종 23:45 KST에서 유효.
- WI SHA256 `42FE577495653D3972965954DF6FFB2FE69EC4449AAFDBC7B9F20304012D2D33`.
- prompt SHA256 `2C92752D3D8719A7202A52DD027959D4B42654335302298643958684AFAE8FDD`.
- Design SHA256 `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`.
- WorkPlan SHA256 `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`.
- Matrix SHA256 `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`.
- TestPlan SHA256 `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`.
- WI/prompt 및 설계 48.9/49.9/49.17-13, 작업계획 D13, matrix 직접 ID/conditional DIR-X 조건을 대조했다.

### exact6 변경·diff

| 경로 | 변경 |
|---|---|
| `packages/knowledge/__init__.py` | D13 harness/authority/error export 3개 추가, 기존 export 보존 |
| `packages/knowledge/learning_e2e.py` | host-sealed scenario, owner public lifecycle 조합, immutable 결과/단계 Event, conditional DIR-X |
| `packages/api/learning_e2e.py` | authenticated in-process execute/query/dir-x adapter, host capture endpoint 없음 |
| `tests/knowledge/test_learning_e2e_d13.py` | 실제 D02~06/12 fixture를 조합한 전체 학습/격리/rollback/DIR-X 적대 검증 |
| `tests/api/test_learning_e2e_d13.py` | 실행/조회 alias 및 authority 자가주입 거부 |
| `docs/04_test_reports/D-13_COMPLETION_REPORT.md` | 본 완료보고 |

변경 전 D13 module/API/test/report는 없었다. 기존 D01~D12 owner 구현·persistence·현재 snapshot 계약은 수정하지 않았다.

### 구현 계약·실제 검증 범위

- host가 고정 fixture를 주입하고 context/actor/기간/canonical hash를 결박한다. API는 scenario ID와 단계만 받으며 caller source/candidate/human decision/verification severity를 직접 제출할 수 없다.
- taught code source의 record hash와 최종 diff content hash, 완료 Run review target hash, CodePattern exact hash 및 선택된 ExampleReference를 결박한다. unrelated valid review target으로 바꾸는 우회는 거부한다.
- 후보 생성 전·후 current Task/Run snapshot hash와 context selection projection이 동일하다. USER correction은 D01 USER provenance와 D06 별도 host confirmation을 그대로 요구한다.
- 실제 D06 evaluate/request-approval/approve/activate를 호출하되 evaluation·human approval은 host가 원 D06에 먼저 기록해야 한다. harness/API는 해당 authority를 mint하지 않는다. non-PASS/missing authority는 거부한다.
- D06 exact run-start capability와 새 D02 next-task snapshot으로만 selection/use를 기록한다. 현재 snapshot/가짜 capability/미승인 활성화를 거부한다. Memory/Skill/Hook/Prompt/USER의 exact candidate revision 및 activation hash를 구분한다.
- 승인된 pattern을 metadata search 후 exact record hash로 찾고 host가 필요한 것으로 선택한 `ref1`만 load_reference한다. 별도로 등록된 `unused`는 로드하지 않는다. 원문 대신 reference ID/version/hash만 결과에 남긴다. FAILED/REJECTED 또는 승인 diff hash 불일치 exemplar의 원 D04 생성 거부를 재검증했다.
- source revoke는 원 D03 transition 및 D06 sync_sources를 사용한다. 파생 version은 QUARANTINED, 신규 선택/참조 load는 차단되고 진행 중 snapshot은 유지한다. 사용한 next-run 계보와 owner safe-point review 조치를 반환한다. 실제 Run pause는 실행하지 않는다.
- 정상 ACTIVE version의 명시 rollback은 원 D06 rollback을 호출하고 next-run 영향 계보를 보존하며 같은 current input의 **context selection projection hash**를 baseline으로 복귀시킨다.
- predecessor 제약: D06 rollback은 ACTIVE만 허용한다. source revoke 후 QUARANTINED에서는 이미 slot baseline 복원을 수행하므로 추가 ROLLED_BACK 전이를 강제하지 않았다. revoke→자동 격리/baseline 복원과 정상-source ACTIVE→명시 rollback은 별도 시나리오다. 이 판단은 구현 중 Main에 보고했다.
- no-change review는 실제 선택된 next-run subject와 host terminal attestation을 원 D05에 확인하고 이유/evidence를 남긴다. 새 candidate/activation은 만들지 않는다.
- D12 Journey query가 각 단계 전체 graph/immutable timeline을 재검증한다. projection에는 Journey hash와 canonical stage previous-hash chain을 남긴다.
- DIR-X host verification은 고정 review target에 결박된다. AV-LRN-003/004/005 중 같은 target의 확정 CRITICAL FAIL만 `DIRX-LRN-CRITICAL` 1회 산출하고 중복 finding/재호출은 새 trigger를 만들지 않는다. 다른 ID/hash·MAJOR·미확정·PASS는 no-trigger다. 실제 hold/Event는 생성하지 않으며 `control_owner=MAIN`, `control_event_emitted=false`다.
- concurrency duplicate propose는 1개 candidate 및 동일 결과로 수렴하며 반환 DTO 변경은 원 상태에 영향을 주지 않는다.

### RED → GREEN 증거

정확한 focused 명령:

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_learning_e2e_d13.py tests/api/test_learning_e2e_d13.py --tb=short
```

| 단계 | exit | 결과/fingerprint |
|---|---:|---|
| 최초 의도된 RED | 1 | 20 errors / 0.33s; `D13_LEARNING_E2E_MISSING`, `D13_API_MISSING` |
| 첫 구현 | 1 | 13 PASS / 7 FAIL / 1.15s; 공통 `INVALID_MEMORY_TIME` — fixture JSON expires_at을 datetime owner API에 전달 |
| datetime 복원 GREEN | 0 | 20 PASS / 1.17s |
| exact source/diff/review 적대 RED | 1 | 30 PASS / 1 FAIL / 1.56s; unrelated review target hash 재사용 미거부 |
| exact target GREEN | 0 | 31 PASS / 1.40s |
| 최종 adversarial 보강 | 0 | **40 PASS / 1.43s** |

개발 중 RED/fixture serialization 교정은 정식 FAILURE_REPORT 횟수와 분리한다. 현재 failure 0, 정식 실패 보고 0이다. 스킬은 TDD 및 완료 전 검증 기준을 적용해 실패를 먼저 관찰하고 마지막 실행 수치로만 완료 판정했다.

### 전체 관련 회귀·정적 검사

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

- cwd는 위 sandbox integration. Python은 원본 D:\tmp의 기존 venv executable만 사용했고 원본 제품 파일은 수정하지 않았다.
- 전체 exit 0, **1916 passed in 16.04s**, fail/skip 0. D01~D12 knowledge/API 회귀 포함.
- compileall exit 0; tracked diff-check exit 0. untracked exact6도 `git diff --no-index --check -- NUL <path>`로 확인 완료: 모두 exit 1(신규 파일 차이), whitespace diagnostic 0.
- repository 전체/DB/browser/Provider 테스트를 실행한 것으로 확대 해석하지 않는다.

## 조치·미검증·잔여 위험·rollback

- `NOT_EXECUTED`: 실제 UI/browser/HTTP transport/DB/Provider/network/OS program/Hook 실행/WSL/Docker/deployment 및 durable process restart.
- `NOT_INTEGRATED`: 실제 Skill/Hook/Prompt/Memory consumer 행동 연결. 이번 행동 불변/복귀 증거는 실제 owner snapshot과 **selection/context projection** 비교이지 모델/프로그램 실행 결과 비교가 아니다.
- source·pattern·terminal review 및 human/evaluation/run-start proof의 host 준비는 trusted in-memory control-plane fixture 경계다. caller가 authority를 self-attest하는 API는 없다. durable 외부 attestation transport는 미구현이다.
- Skill L1/L2·Hook sandbox/shadow/pilot·Prompt provider runtime을 D13에서 재구현하거나 실행하지 않았다. 각 predecessor의 기존 관련 회귀가 보존됨을 확인했으며 실제 consumer 통합 PASS를 주장하지 않는다.
- DIR-X 결정 결과는 synthetic verification fixture 결과다. 실제 D Gate 검사 실패나 실제 hold 발동을 뜻하지 않으며 Main이 Gate 증거로 별도 판단한다.
- rollback: D13의 이번 exact6 변경만 회수한다. __init__의 D13 import/export 2곳만 제거하고 나머지 신규 D13 5개 파일은 보존 후 회수한다. 기존 D01~D12 및 control dirty는 손대지 않는다. 실행한 rollback/Git 변경은 없다.
- progress/HANDOFF/control checker는 Main 소유로 미갱신. D13 완료보고가 D Gate 판정이나 Phase E 시작을 뜻하지 않는다.

### 최종 제품 SHA256 (보고서 제외)

- __init__: `DA403780A8F7EA0B011A936F5EE461A30637170689F11990F4BF942D39E79E2A`
- domain: `91B3CCB4952D1F8FED18BE356F581E3AC904EA303F8465BDD158FE4363F5B972`
- API: `7B2C161D38E90A9510113BAAF213C00FEFCCCD4DE6848FEC7837432266F0F43E`
- domain tests: `5518A3F065178F456855FF1F2D449E8A8E1226D5996B13D02F5F2BD98C8C731B`
- API tests: `D09AC26A8D48FD6BA2D8CC60C7C94C9EEF599E4DD85EC9F7FCC2B9B6596BCF4B`
