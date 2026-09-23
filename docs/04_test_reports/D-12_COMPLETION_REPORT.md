# D-12 완료보고 — R3 재작업 완료

## R3 판정 → 판단 이유 → 조치 (최신 결과)

### 판정

- `COMPLETED` — developer 기본 검증 완료, Main acceptance 별도.
- 시각 2026-09-16 23:20 KST. seq1045 corrected epoch-2 dual lease/exact6 유지. 아래 R1/R2 기록은 과거 수치다.
- **focused 59 PASS, knowledge/API 전체 1876 PASS, compileall exit 0, diff-check exit 0.**

### 판단 이유·수정

- Blocking fingerprint `D12-PACKETLESS-RECEIPT-NOT-EXPLAINABLE`: recursion-only/managed-fallback-only 저장 receipt는 graph에 hash만 있고 결정·이유·idempotency를 조회할 수 없었다.
- D10 owner 및 replay 정책은 변경하지 않았다. D12 HOOK_RECEIPT node의 `stored_receipt`를 통해 기존 query/list/detail에서 검증된 metadata만 반환한다.
- 반환 필드: receipt/event/selection/idempotency hash, selection ID, canonical decision/reason, fallback/result-evidence hash 목록, `RECORDED_NOT_REPLAYED`, `NOT_EXECUTED`, IO0. raw event/input/program/command/environment/messages는 반환하지 않는다.
- 매 조회에서 receipt/자식 receipt/selection/fallback canonical hash, selection principal/context, exact target 및 host current authority를 검증한다. signature/event hash는 64자리 canonical hash 형식을 강제하며 decision/reason은 D09/D10 canonical matrix의 정해진 조합만 허용한다.
- packetless replay 및 archive 시도는 여전히 `JOURNEY_MISSING_EVIDENCE`로 fail-closed다. 결정 조회가 replay 성공 또는 실제 실행 PASS로 승격되지 않는다.
- API detail의 반환 DTO를 수정해도 원 receipt는 변하지 않고 payload의 decision 자가 주입은 거부한다. 일반/fault sealed replay, cursor/checkpoint, 전체 timeline 회귀를 유지했다.

### RED/GREEN·정확한 명령

cwd는 `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_learning_journey_d12.py tests/api/test_learning_journey_d12.py --tb=short
```

- 최초 RED: exit 1, **2 failed / 51 passed in 2.05s**; recursion/fallback `stored_receipt` 없음.
- 최소 구현 GREEN: exit 0, **53 passed in 2.02s**.
- 적대 보강 RED: exit 1, **2 failed / 57 passed in 2.23s**; 재해시된 임의 reason 및 foreign selection principal 미거부.
- 최종 GREEN: exit 0, **59 passed in 2.27s**; 위 두 입력 및 receipt hash drift/signature secret/API 자가주입 차단.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

- 전체 exit 0, **1876 passed in 15.31s**, fail/skip 0.
- compileall exit 0, tracked diff-check exit 0. exact6 untracked도 각각 `git diff --no-index --check -- NUL <path>`로 확인 완료: 모두 exit 1(신규 파일 차이), whitespace diagnostic 0.
- 수정 경로: exact6 중 domain, domain tests, API tests, 본 보고서 4개. __init__/API 구현 및 D10 owner는 보존했다. control/progress/Git mutation 없음.
- 현재 잔여 테스트 실패 0. R3 독립 finding 1건 해소; 개발 중 RED를 별도 정식 실패 횟수로 승격하지 않는다.

### 미검증·rollback

- 실제 UI/DB/HTTP/Provider/network/Hook program/OS/WSL/deploy NOT_EXECUTED, runtime consumer NOT_INTEGRATED 유지.
- packetless receipt는 저장된 decision 조회만 가능하고 입력 재현은 불가하다. signature의 입력 사전상 복원/검증을 주장하지 않으며 현재 authenticated D10 store의 hash identity로 표시한다.
- rollback은 위 4개 파일의 R3 diff만 회수하고 R2 및 모든 predecessor/control dirty를 보존한다. rollback 실행 없음.
- TDD와 완료 전 검증 기준으로 RED→GREEN 및 전체 회귀를 실행했다.

R3 최신 SHA256:

- domain: `13C78BC8CB0F00A798FB54C3EEB9158A708D2A20D8024119237676E704ADBB27`
- domain tests: `296AC731712804EFD1FF3B1BB6C1474D9EBE3E5D8C52F608DD65E4FFA4748365`
- API tests: `D12AD74E6B7CCE2B0986B867014F9D90E8EC02701D0CC9DF81BB73C91CB563EE`

---

## R2 판정 → 판단 이유 → 조치 (현재 결과)

### 판정

- 결과 계약: `COMPLETED`; Main 독립 검토/acceptance 별도.
- 2026-09-16 23:08 KST. seq1045 corrected epoch-2 dual lease/token 및 WI/prompt hash는 R1과 동일하며 유효하다. control/progress/Git mutation 없음.
- **focused 51 PASS / 전체 knowledge+API 1868 PASS / compileall 0 / diff-check 0.** 아래 R1 수치는 과거 라운드 증거로만 보존한다.

### 판단 이유

독립 리뷰 Blocking 2건을 각각 재현했다.

1. `D12-REPLAY-EPHEMERAL-DEPENDENCY`: replay가 executor.calls에 직접 의존하여 실행 객체 정리 후 저장 receipt를 재현하지 못했다.
2. `D12-LIFECYCLE-TIMELINE-OMISSION`: timeline이 *_EVENT 종류만 골라 source/approval/activation/selection/use/impact 자체의 chronology를 누락했다.

해결:

- D12 `capture_replay_evidence(ctx, receipt_hash, now=...)`는 host-only archival seam이다. payload packet/상태/승인을 받지 않고, 이미 존재하는 D10 packet/result/selection을 signature·canonical hash·program/profile·matcher·fault·merge로 검증한 뒤 D12 authority에 canonical immutable bytes와 seal hash로 보존한다. 원 D10 owner 계약/파일은 수정하지 않았다.
- 일반 `hook_replay`는 **executor를 전혀 읽지 않고** sealed evidence만 소비한다. calls clear뿐 아니라 runtime executor 객체를 None으로 제거한 뒤에도 일반/fault replay 및 read-adapter export/import 복원이 동일 결과를 반환했다. 새로운 program/action/OS 실행은 0이다.
- seal hash는 소비 때마다 재계산하고 현재 receipt/selection/definition과 대조한다. packet·receipt·definition·selection 변조, foreign seal, missing seal은 fail-closed. archive 전에 packet이 없거나 검증 실패하면 checkpoint를 발급하지 않는다. archival capture 자체도 API route로 노출하지 않았다.
- checkpoint export에는 replay evidence **hash 목록만** 포함한다. raw packet/input/program/environment는 host 내부 immutable 보관소에만 있고 API/export projection에는 없다. 복원은 동일 trusted host authority가 보존된 in-memory 경계이며 durable DB 재시작 증거가 아니다.
- 전체 DAG node를 lifecycle timeline에 포함한다. canonical `created_at`/`issued_at`/`captured_at`, Skill capture issued_at 또는 exact 해당 hash를 참조한 canonical Event 시각을 사용한다. 시간은 UTC 정규화하고 timestamp 출처/증거 hash를 함께 표시한다.
- 날짜 없는 artifact에 임의 시각을 만들지 않는다. `time_basis=NOT_RECORDED`, `created_at=null`로 남기고 DAG의 인과순 위치만 결정한다. 시각이 있는 node는 날짜와 topological order로 정렬하며 동일 시각은 kind/node hash로 결정적으로 순서화한다. 부모 이후이어야 할 node가 과거 시각이면 `JOURNEY_TIME_DRIFT`로 차단한다.
- source/candidate의 최초 행은 현재 revoked/active 상태를 과거 생성 시각으로 소급하지 않고 REGISTERED/CREATED로 표시하며 이후 status는 실제 Event/impact 행에 유지한다.

### RED/GREEN 및 정확한 실행

cwd: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_learning_journey_d12.py tests/api/test_learning_journey_d12.py --tb=short
```

- R2 의도된 RED: exit 1, **3 failed / 37 passed in 2.12s**. 일반/fault capture seam 부재 2건과 전체 timeline 누락 1건.
- 첫 구현 검증: exit 1, **21 failed / 19 passed in 2.24s**. 공통 `INVALID_MEMORY_TIME`: 기존 `_time`은 ISO string이 아니라 datetime을 요구했다. canonical ISO를 datetime으로 파싱 후 UTC 정규화하여 교정했다. 별도 설계 실패가 아닌 한 원인 내부 구현 오류다.
- 교정 GREEN: exit 0, **40 passed in 1.72s**.
- seal/missing/foreign/chronology/tie/hash/API 적대 회귀 보강 최종: exit 0, **51 passed in 2.09s**.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

- 관련 전체: exit 0, **1868 passed in 15.97s**, fail/skip 0.
- compileall exit 0; diff-check exit 0. 원본 D:\tmp 제품에는 쓰지 않고 기존 venv interpreter만 사용했다.
- 보고서 갱신 뒤 untracked exact6를 각각 `git diff --no-index --check -- NUL <path>`로 추가 확인 완료했다. 6개 모두 exit 1(신규 파일 차이), whitespace diagnostic 0이다. tracked diff-check도 exit 0이다.

R2 변경 경로는 exact6 중 domain, domain tests, API tests, 본 보고서 4개다. __init__/API 구현은 R1 상태를 보존했다. 현재 잔여 테스트 실패 0. 독립 review finding과 개발 중 RED는 분리하며 정식 실패 ledger 판정은 Main 소유다.

### 미검증·rollback

- 실제 UI/DB/HTTP/Provider/network/program/OS/WSL/deployment NOT_EXECUTED, consumer NOT_INTEGRATED 유지.
- D10 packet을 폐기하기 **전에** trusted host가 D12 archival capture를 해야 한다. 수집 전 이미 사라진 증거는 복구/추측하지 않고 missing evidence로 차단한다. recursion-only/managed-fallback-only receipt의 저장 입력이 없는 경우도 같은 경계다.
- R2 rollback은 위 4개 파일의 이번 R2 diff만 회수한다. D10 owner/이전 package/통제 파일은 회수하지 않는다. 실행한 rollback 없음.
- TDD·review 수신·원인 추적·완료 전 검증 스킬로 재현→원인 교정→최종 회귀를 수행했다.

R2 최신 SHA256:

- domain: `D903477ACB923256C388B50C8E1036171D0ABCED723D1DCCC3C6714888B54D03`
- domain tests: `DAA995F9163B45AF3977343EFE128E5FC6AE6B533F34E30253F06B3F5585D455`
- API tests: `5694F04062ADF7ABA7C27EA17C53F5E80A8BAA76C92383766864EC26587853C6`

---

## R1 보존 기록

## 판정

- 결과 계약: `COMPLETED` — developer 기본 구현·검증 완료. Main 독립 검토/acceptance는 별도다.
- 작성 시각: 2026-09-16 22:53 KST. 담당: `developer-primary-d12-r1`.
- AV-LRN-018/024의 in-memory read-model/API 범위. 실제 화면/운영 실행/consumer 통합 PASS를 의미하지 않는다.
- focused 37 PASS, knowledge/API 1854 PASS, compileall exit 0, diff-check exit 0.

## 판단 이유

### 기준·통제 확인

- 작업 위치: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.
- 시작/종료 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`.
- branch: `codex/c09-execution-backends-r1`. Git stage/commit/push 미실행.
- 시작부터 C-13 이후 기존 tracked dirty 및 D-01~D-11/control untracked가 존재했다. clean checkout으로 주장하지 않는다. 기존 제품/통제 파일을 reset/stash/overwrite/delete하지 않았다.
- seq1040 epoch-1은 host보다 미래 발효여서 제품 mutation 전에 Main에 보고했다. Main append-only 정정 후 seq1045의 아래 epoch-2를 확인하여 진행했다. 환경/시각 정정은 정식 실패가 아니다.
- worker: `worker-lease-d12-r1-20260916-002`; execution fence: `d12-r1-execution-fence-epoch-2-a3fa3ed09cd6998b`.
- write: `write-lease-d12-r1-20260916-002`; write fence: `d12-r1-write-fence-epoch-2-234458b5283abafa`.
- 발효 `2026-09-16T22:20:00+09:00`, 만료 `2026-09-17T10:20:00+09:00`; 최종 host `2026-09-16T22:53:24+09:00`에서 유효. canonical progress seq1045 및 두 token 재확인.
- WI SHA256: `23AF92F687E0C89833E8A3E9D228C6E3684B172FD88A1F434CEF8DE995744B56`.
- invocation SHA256: `660EE18068A0F4B75331B6F1575CCCBF0D7C7DE4E670C1C817EDEB7372D1AADC`.
- 설계 SHA256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`.
- 작업계획 SHA256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`.
- 통합검증매트릭스 SHA256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`.
- 테스트계획 SHA256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`.

### 구현·diff 범위

정확히 다음 6개만 제품 변경했다. D-01~D-11 owner package는 변경하지 않았다.

| 경로 | 변경 |
|---|---|
| `packages/knowledge/__init__.py` | 기존 export 보존, D12 3개 class export 추가 |
| `packages/knowledge/learning_journey.py` | 신규 immutable DAG/read snapshot, lineage, Skill 설명, Hook 저장 증거 replay, menu, cursor/checkpoint |
| `packages/api/learning_journey.py` | 신규 7개 read operation 전용 authenticated in-process adapter |
| `tests/knowledge/test_learning_journey_d12.py` | 실제 in-memory predecessor fixture와 적대 입력 검증 |
| `tests/api/test_learning_journey_d12.py` | read route, mutation/자가승인 거부, 반환 alias/원문 비노출 |
| `docs/04_test_reports/D-12_COMPLETION_REPORT.md` | 본 보고 신규 |

변경 전 D12 domain/API/test/report는 없었고 __init__은 D11까지의 export였다. 변경 후 기존 repository 상태를 직접 복제·검증하는 read-only adapter를 제공한다. 일반 query/refresh/run을 호출해 선행 상태를 암묵 변경하지 않는다. 공통 candidate/source host lock 안에서 exact 객체·context·actor·scope를 확인하며 D10/D11 current owner도 검증한다.

- SOURCE/파생 항목/사용/취소 영향, Memory, Pattern/ExampleReference, Review, Candidate 평가/승인/활성/선택/사용, Skill material/invocation/L1/L2/use, Evolution 평가/승인/정책/활성/선택/rollback, Hook registry/runtime, Prompt/Model/benchmark/routing을 canonical hash와 edge로 결박한다.
- hash drift, dangling, cycle, foreign context/owner, pagination head drift, checkpoint tamper/stale/foreign authority를 거부한다.
- Pattern은 content hash가 아니라 기존 `record_hash` 계약을 사용한다. D10 selection은 기존 계약상 hash 계산 후 추가된 derived selection ID를 별도로 검증한다. 선행 persistence hash 계약을 바꾸지 않았다.
- Skill 선택 설명은 선택 receipt와 material capture를 결박하고 explicit/implicit, trigger/exclusion 사실 hash, snapshot/activation/source/use/rollback을 반환한다. 호출/본문 원문은 반환하지 않는다.
- Hook replay는 이미 저장된 fake sandbox packet/receipt signature 및 exact registry program/profile와 matcher/fault/merge를 대조한다. 새 program/원 action 실행은 0이다. quarantine/fallback/trust/영향 Run/rollback 및 runtime snapshot hash를 별도 표시한다.
- opaque cursor는 exact read snapshot에 결박된다. menu는 loading/empty/ready/error/blocked/not_executed를 구분한다. checkpoint는 host authority의 동일 envelope 기록에만 복원된다.

### RED → GREEN 증거

동일 focused 명령:

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_learning_journey_d12.py tests/api/test_learning_journey_d12.py --tb=short
```

| 단계 | exit | 실제 결과 / fingerprint |
|---|---:|---|
| 의도된 최초 RED | 1 | 29 errors, 0.45s; D12_JOURNEY_MISSING / D12_API_MISSING |
| 최초 구현 | 1 | 25 PASS / 4 FAIL, 1.69s; tuple-key fixture serialization, immutable tuple 비교, D10 selection derived ID hash adapter |
| adapter 교정 | 0 | 29 PASS, 1.38s |
| 추가 계보 RED | 1 | 30 PASS / 2 FAIL, 1.68s; Pattern JOURNEY_HASH_DRIFT, evolution 평가/승인/활성 node 누락 |
| 계보 GREEN | 0 | 32 PASS, 1.53s |
| Hook 상태 RED | 1 | 33 PASS / 2 FAIL, 1.90s; hook_states 미구현 1, fixture setup 인자 누락 1 |
| Hook 상태 GREEN | 0 | 35 PASS, 1.73s |
| source 파생/사용/impact RED | 1 | 36 PASS / 1 FAIL, 1.76s; SOURCE_USAGE/DERIVED_SOURCE/SOURCE_IMPACT 누락 |
| 최종 GREEN | 0 | 37 PASS, 1.96s |

위 RED/fixture 교정은 test-first 내부 개발 이력이며 정식 FAILURE_REPORT 횟수로 올리지 않는다. 현재 잔여 focused failure 0, 유효 정식 실패 보고 0. 동일 실패 3회 인수 조건에 해당하지 않는다.

### 최종 관련 회귀·정적 검사

cwd는 위 작업 위치다. 원본 D:\tmp는 기존 venv executable만 이용했고 원본 제품 파일은 쓰지 않았다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api --tb=short
```

- exit 0, **1854 passed in 15.34s**, skip 0. 직전 보강 전 1852 PASS/15.22s와 구분한다.
- D01~D11 기존 knowledge/API 회귀가 포함된다. 전체 repository/실제 DB 검증으로 확대 해석하지 않는다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
git status --short
git rev-parse HEAD
git branch --show-current
```

- compileall exit 0; tracked diff-check exit 0.
- Git read-only status/HEAD/branch exit 0. 사용자 Git ignore 파일 접근 경고가 있었지만 검사 종료 코드는 0이며 권한 변경/상승은 하지 않았다.
- 신규 untracked exact6도 각각 `git diff --no-index --check -- NUL <path>`로 검사 완료: 6개 모두 exit 1, whitespace diagnostic 출력 0. 반환 1은 신규 파일 존재의 차이 결과이며 오류 출력과 구분했다. 보고서 작성 뒤 tracked diff-check도 exit 0.

## 조치·미검증·잔여 위험

- `NOT_EXECUTED`: 실제 UI/browser/screenshot, DB, HTTP server, Provider/network, OS Hook program/process, WSL/Docker/deployment. fixture/mock 테스트를 운영 PASS로 승격하지 않았다.
- `NOT_INTEGRATED`: D01~D11 runtime consumer 연결, U07~U08 실제 화면. D12 API는 in-process read adapter이며 실제 인증 HTTP transport는 이번 범위 밖이다.
- 재시작은 동일 trusted in-memory host authority를 보유한 read adapter 재생성만 검증했다. durable DB/process restart 복원은 미검증이다.
- D10 receipt 중 저장 packet이 없는 recursion-only/managed-fallback-only 결과는 input/event 원문을 발명하지 않고 `JOURNEY_MISSING_EVIDENCE`로 replay를 거부한다. 해당 상태/receipt hash/결정/후속 fallback은 read graph/state metadata로 보존한다. 독립 검토에서 추가적인 saved evidence seam이 필요하면 owner 범위 판단이 필요하다.
- 원 repository의 schema-private state를 read adapter로 조합하므로 owner schema 변경 시 회귀 테스트가 필요하다. 별도 실제 sidecar transport는 구현하지 않았다.
- 취소된 source의 과거 계보를 읽어도 lazy quarantine/refresh mutation을 수행하지 않는다. source 상태를 blocked로 표시하며 실제 취소/복구는 원 owner action으로 남긴다.
- rollback: Main이 D12 exact6의 이번 diff만 회수한다. __init__에서 D12 import/export만 제거하고 신규 D12 5개 파일을 별도 보존 후 회수하면 된다. D01~D11/control dirty는 건드리지 않는다. 실행한 rollback은 없다.
- progress/HANDOFF/checker/control은 Main 소유로 미갱신. 제품 완료가 canonical ACCEPTED 또는 다음 package 시작을 의미하지 않는다.
- TDD 및 verification-before-completion 스킬을 적용해 실패 재현을 먼저 확인하고 최종 명령 결과만 완료 근거로 사용했다.

### 최종 제품 SHA256 (보고서 자체 제외)

- __init__: `781D9381429EAD39EA9A597446F6C121C3AB4B254D6E904501A4778C0EAC2285`
- domain: `6CA345F240BF16C24A3766F907EEAC4D9A79F37A2D6BE7E3E7FC1674D67FCE58`
- API: `523AB02433887266A60B898789C042EE163CF4C5272686B6E115E4AC4D4BDBCF`
- domain tests: `5E0D810FC69B391762180764BE40369894F192FCD0B040ABA9DAD41ADE177D09`
- API tests: `51D497E8E479E012577FEDE8A1CD720EFE6ECFEBE968DCDA91F92E2E81014272`
