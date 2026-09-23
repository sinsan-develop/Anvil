# D-11 완료보고 — Prompt/Model Registry·snapshot drift·atomic routing

## 1. 판정

`COMPLETED` — developer-primary-d11-r1의 exact6 구현 및 R2 재작업 완료. 최종 focused 94 PASS, knowledge/API 관련 회귀 1817 PASS, compileall 및 diff-check exit 0. §2~5는 초기 구현 증거를 보존하며 최종 R2 근거는 §6이다. Main의 독립 검토/ACCEPTED 및 후속 D-12 시작 판단은 별도이며 D-12는 시작하지 않았다.

## 2. 판단 이유

- canonical Provider 순서는 `cerebras,groq,mistral,openrouter,upstage,gemini,anthropic,openai,ollama`다. 임의/대문자 alias ID를 거부하고 OpenRouter의 canonical ID와 upstream provider/model을 분리 보존한다.
- Prompt는 실제 D-06 ACTIVE PROMPT candidate의 exact id/version/hash, target identity, actor/context/scope, 원 source provenance를 재검증한다. 본문·input/output contract·role·host가 수신한 사람 approval evidence가 immutable canonical version/hash에 결박된다. source revoke/rollback/expiry 후 신규 사용을 차단한다.
- Model snapshot은 provider/upstream/model revision, opaque endpoint/account/organization reference, region, context/tool/capability, privacy/retention/training/ZDR, 가격/currency/unit, probe evidence/revision/time/TTL/status, benchmark revision을 포함한다. 실제 Ollama endpoint·credential/PII/instruction/malware-like 입력을 저장하지 않는다. error는 reason code만 반환한다.
- Model probe·Prompt approval·benchmark 관측 및 activation decision은 인증 host의 capture 메서드에서만 발급한다. API는 opaque capture ID를 소비하며 PASS/approval/principal/hash를 body에 추가하면 거부한다. capture는 exact context/principal/scope/time/expiry/content hash에 결박된다.
- Benchmark는 exact prompt/model references, 현재 active baseline, 이전 benchmark fixture hash, distinct fixture case/input 및 evidence identity, model의 benchmark revision을 검사한다. 표본 최소 3개, quality floor 및 baseline 비회귀, cost baseline/host limit, latency 비회귀를 모두 충족해야 PASS를 기록한다. fixture/target/baseline/hash/revision mismatch, evidence alias, 불충분 표본, 비용·품질·latency 회귀는 저장하지 않는다.
- Routing set은 host가 지정한 전체 role 집합과 exact prompt/model/benchmark/requirements/fallback을 결박한다. AVAILABLE/fresh/current model 및 capability/tools/context/privacy/가격 요구가 충족되지 않으면 candidate 저장·활성화를 거부한다. fallback trigger는 RATE_LIMIT/TIMEOUT/TEMPORARY_5XX만 허용하며 privacy/context/tool 의미 확대·약화는 거부한다. 실제 fallback Provider 호출은 없다.
- Activation은 expected-current-version CAS, candidate baseline version, exact approval hash를 검사한다. 모든 role 검사가 끝난 뒤 하나의 immutable activation receipt로 전체 set을 교체한다. 신규/semantic change는 HUMAN만 허용하고 probe/benchmark revision만 바뀐 동등 routing은 exact MAIN_POLICY capture로 가능하다. stale writer, partial role set, 승인 target 재결박·만료·중복 재생을 차단한다.
- 동일 model ID의 중요 field/version/availability 또는 TTL drift는 active routing을 quarantine한다. 신규 Run은 `BLOCKED_CAPABILITY_DRIFT`, IO0를 반환하고 재-probe/benchmark/approval 필요 및 영향 Run을 audit한다. 이전 Run의 frozen routing은 유지하며 hot substitution하지 않는다.
- D-02 실제 in-memory TaskLearningSnapshot의 exact identity/content hash를 재계산한다. host Run clock과 5초 시작 window, activation 이후 Run 생성, one-shot run identity를 결박하고 실제 선택 시각을 기록한다. 늦은/역시각/현재 Run 주입은 거부한다. **이는 next-Run selection sidecar이며 Provider runtime/D-02 consumer에 routing을 주입한 증거가 아니다.**
- Export/import는 host authority가 보존한 exact checkpoint와 principal/context/epoch/hash/policy를 검증한다. body/hash 재계산 변조, 누락·foreign authority·stale checkpoint는 거부하고 복원 후 이전 registry owner를 차단한다. versions/snapshots/benchmarks/activation/quarantine/receipts/audit/pinned runs를 보존한다.
- 위 증거는 `AV-LRN-026`, `AV-LRN-028`의 D-11 deterministic fixture/in-memory 계약 범위다. 실제 최신 모델 capability/가격이나 Provider 응답을 확인한 것으로 표시하지 않는다.

## 3. 조치·기준선·변경 범위

- 작업 root: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- 시작/최종 branch: `codex/c09-execution-backends-r1`
- 시작/최종 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88` (불변)
- canonical sequence: `1031`, `snapshot-d11-start-seq1031`, D-11 IN_PROGRESS
- worker: `worker-lease-d11-r1-20260916-001`
- execution fence: `d11-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`
- write: `write-lease-d11-r1-20260916-001`
- write fence: `d11-r1-write-fence-epoch-1-234458b5283abafa`
- 양 lease ACTIVE: `2026-09-16T21:25:00+09:00` 이상 `2026-09-17T09:25:00+09:00` 미만. 작업 전 host 21:27 KST, 최종 검증 시 21:48:56 KST 및 token/expiry를 확인했다.
- WI SHA256: `784595E0D200541627E0918D1AA405F11EE80EB196C7C7123BF2346EB9382641`
- Invocation SHA256: `14872943A6918674EA2E495589E34DF365971975FD13A1F841E3635A189F3280`
- Design baseline: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- WorkPlan baseline: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- Matrix baseline: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- TestPlan baseline: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- 시작 시 기존 tracked dirty 26개 및 C/D control·D-01~D-10 untracked를 보존했다. D-11 exact6는 Git상 untracked이며 __init__.py만 기존 D-10 exports를 보존하여 2줄 추가했다. 관련 없는 경로, Git index, control/WI/progress/HANDOFF는 수정하지 않았다.
- 원본 `D:\tmp\anvil-main-integration` 제품 파일은 변경하지 않았다. 그 경로의 기존 venv Python 3.13.9 실행기만 사용했다. 권한 상승·승인 UI·Git stage/commit/push·network·실제 Provider/DB/HTTP를 실행하지 않았다.

| 초기 R1 변경 경로 | diff 요약 | R1 SHA256 (R2 최종 변경 hash는 §6) |
|---|---|---|
| packages/knowledge/__init__.py | ModelRegistry 3개 이름 import/export 2줄 추가 | `76AEE97DF73149CB44BEAE413C39408EEE89F83D91F2A405C48E131774B90C7F` |
| packages/knowledge/model_registry.py | 신규 immutable registry/capture/benchmark/drift/CAS/run guard/checkpoint | `C735C479D10E7B2FD5F50841C64F6DCEB573E5798CD35F31B952B772217A06DB` |
| packages/api/model_registry.py | 신규 authenticated host API adapter, HTTP/capture 발급 없음 | `AC93BB1FBADE13BE7821564334ACBEB0C734C057F97EA1EC82835CCD3F361159` |
| tests/knowledge/test_model_registry_d11.py | 신규 domain/적대/CAS/다중 role/restore 검증 | `001F2C602D9D0A508F04456CE74450B01C36D3B529AEC1EACB92EBFDD001E33F` |
| tests/api/test_model_registry_d11.py | 신규 API capture 소비/자가 권위/alias 비노출 검증 | `3BD225BC378928504FBDBBBDA29A3325B1022DE92F3CAB841F20257B8794B638` |
| docs/04_test_reports/D-11_COMPLETION_REPORT.md | 본 보고서 신규 | self hash 제외 |

## 4. 정확한 검증 명령·exit·실제 결과

아래 명령은 모두 위 작업 root에서 실행했다. domain/API 동일 test basename의 collection 충돌을 피하기 위해 `--import-mode=importlib`을 사용했으며 repository 설정은 변경하지 않았다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_model_registry_d11.py tests/api/test_model_registry_d11.py
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_model_registry_d11.py tests/api/test_model_registry_d11.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
git branch --show-current
git rev-parse HEAD
```

| 단계 | exit | 실제 결과·fingerprint |
|---|---:|---|
| 최초 RED (첫 명령) | 1 | 49 errors, 0.72s; `D11_REGISTRY_MISSING` / `D11_API_MISSING` |
| 최초 구현 (두 번째 명령) | 1 | 42 passed / 7 failed, 1.71s; immutable tuple 기대값 6건, API fixture의 model identity alias 1건 |
| 최초 GREEN | 0 | 49 passed, 1.49s; projection tuple 계약 및 서로 다른 실제 model fixture로 교정 |
| 추가 적대 RED | 1 | 60 passed / 3 failed, 1.97s; current-baseline benchmark 재사용, fixture baseline 변경, benchmark revision 미결박 |
| 최종 focused GREEN | 0 | 63 passed, 1.74s; 3개 적대 경로를 canonical binding으로 차단 |
| knowledge/API 전체 관련 회귀 | 0 | 1786 passed, 12.71s; 기존 D-01~D-10 포함, skip/fail 없음 |
| compileall | 0 | diagnostics 없음 |
| git diff --check | 0 | diagnostics 없음; untracked는 아래 별도 검사 |
| branch/HEAD read | 0 | 위 시작 branch/HEAD 불변 |

Untracked exact6는 아래 명령으로 추가 검사했다. 6개 각각 exit 1 / diagnostics 0이었다. `--no-index`의 exit 1은 신규 파일 차이이며 whitespace 오류가 아니다. 보고서 작성 후 `git diff --check`도 다시 exit 0이었다.

```powershell
git diff --no-index --check -- NUL packages/knowledge/__init__.py
git diff --no-index --check -- NUL packages/knowledge/model_registry.py
git diff --no-index --check -- NUL packages/api/model_registry.py
git diff --no-index --check -- NUL tests/knowledge/test_model_registry_d11.py
git diff --no-index --check -- NUL tests/api/test_model_registry_d11.py
git diff --no-index --check -- NUL docs/04_test_reports/D-11_COMPLETION_REPORT.md
```

최초 missing 및 보강 RED는 의도된 TDD이고 중간 fixture assertion은 동일 turn 안에 수렴했다. 남은 오류 0. 정식 실패 누적/ACCEPTED 판정은 Main 소유이며 개발자가 임의로 변경하지 않았다. Git read에서 사용자 전역 ignore ACL warning이 관찰됐지만 diff-check 및 테스트 exit에 영향을 주지 않았다.

## 5. 미검증·잔여 위험·rollback

- `NOT_EXECUTED`: 실제 9개 Provider 호출/probe, 현재 모델 목록·가격 최신성, 실제 Ollama endpoint, network/DB/HTTP/browser/WSL/Docker/deployment. OS process 및 Git mutation 없음.
- `NOT_INTEGRATED`: 실제 Provider runtime/fallback 실행, 현재 운영 D-02/Run consumer에 routing 주입, 프로세스 간 durable storage/signature/재시작. export/import는 같은 host authority가 보존한 in-memory sealed checkpoint 검증이며 운영 영속 복원 증거가 아니다.
- Host capture는 B/D 단계 기존 in-memory adapter와 같은 신뢰 경계다. 관측 값·사람 decision이 실제 외부 권위에서 왔는지는 이 패키지가 입증하지 않는다. payload/API를 통한 권위 발급은 제공하지 않는다.
- 역할 목록·최소 표본·sample cost limit은 host policy다. provider availability, privacy, price, capability의 의미를 LLM으로 낮추지 않는다. model 변경을 보수적으로 quarantine하며 active head를 새 benchmark·정확한 승인/CAS로 교체할 때만 새 Run이 재개된다.
- 전체 제품/DB/UI/Gate 검증은 이번 결과에 포함하지 않는다. 이전 C-01 snapshot fail 1/DB skip 8 baseline의 해결을 주장하지 않는다.
- rollback: Main이 D-11 신규 5개 파일(보고서 포함)을 복구 가능한 보존 수단으로 확보한 후 이번 변경만 되돌리고 __init__.py의 ModelRegistry import/export 2줄만 제거한다. 기존 D-01~D-10와 control/dirty는 보존한다. 개발자는 reset/clean/stash/삭제를 수행하지 않았다.
- `docs/progress/**`, HANDOFF, manifest, checker, WI/prompt는 Main 소유로 미갱신. Main의 독립 검토와 acceptance evidence가 다음 안전 단계다.

## 6. R2 독립 리뷰 REWORK — 판정 → 판단 이유 → 조치

### 판정

`COMPLETED`. 동일 seq1031/epoch1 양 ACTIVE lease·token·exact6를 유지했다. 재작업 시작 실제 host `2026-09-16T22:01:57+09:00`, 최종 검증 `2026-09-16T22:06:31+09:00`로 만료 전이다. 작업 root/branch/HEAD/WI/prompt 변경 없음. 추가 write는 domain, domain/API 테스트, 본 보고서의 4개이며 나머지 exact6와 보호 dirty는 보존했다.

### 판단 이유

1. `D11-CAPTURE-CANONICAL-INTEGRITY`: 최초 구현의 `_capture_get`은 저장 capture의 선언 hash를 재계산하지 않았다. route1 승인 capture의 data.target만 route2로 바꾸어도 소비할 수 있었으며 proof/expiry/principal/context/scope/hash 변조도 탐지하지 못했다. 모든 소비 시 전체 canonical payload를 다시 hash하고 exact field set, capture ID, 현재 principal/context/scope를 대조한다. 불일치는 `HOST_CAPTURE_INTEGRITY_MISMATCH`이며 모델/Prompt/benchmark 발행과 activation 전에 거부한다. hash만 재계산해 원래 capture ID에 덮어쓰는 변형 및 rehashed foreign principal도 차단한다.
2. `D11-OPENROUTER-UPSTREAM-LINEAGE`: OpenRouter가 자신을 실제 upstream으로 선언하는 경우와 upstream_model=null을 허용했다. upstream은 canonical 비-openrouter provider 및 nonempty 문자열 model을 요구한다. 기존 OpenRouter→Anthropic 정상 계보는 유지한다.
3. `D11-PUBLICATION-GHOST-COMMIT`: publish/activate가 state를 변경한 뒤 `_changed`, `_refresh`, response projection 또는 ledger/head publication이 실패하면 일부 commit이 남았다. 두 메서드에 기존 candidate/session lock 안의 in-memory transaction을 적용했다. 호출 전 전체 registry state와 해당 context owner/epoch를 보존하고, 예외·중단 시 모두 복구한 뒤 원 예외를 다시 전달한다. 다른 context의 authority 항목은 덮지 않는다. 모델/Prompt/benchmark/head/active/version/activation/quarantine/audit/last_at/capture 및 run pin까지 이전 값으로 복구하며 같은 승인으로 정상 재시도가 가능하다.
4. Fault injection은 실제 메서드의 변경을 실행한 직후 예외를 발생시켰다. `_refresh`가 quarantine/audit까지 생성한 뒤 실패하는 경우, 기존 활성 version과 pinned Run이 존재하는 replacement activation 실패, head 저장 직후와 activation append 직후 실패도 검증했다. 테스트용 fault hook을 제품 API에 추가하지 않았다.

### 조치 및 검증

코드 리뷰 수용·체계적 디버깅·TDD·완료 전 검증 절차를 적용하여 원인을 직접 재현한 후 수정했다. 실제 외부 Provider/network/DB/HTTP/process 호출 없이 기존 in-memory fixture와 예외 주입만 사용했다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_model_registry_d11.py tests/api/test_model_registry_d11.py -k r2 --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_model_registry_d11.py tests/api/test_model_registry_d11.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

| 단계 | exit | 실제 결과 |
|---|---:|---|
| R2 적대 RED, 첫 명령 | 1 | 27 failed / 1 passed / 63 deselected, 1.11s. 기존 empty-string 거부 1건만 이미 PASS |
| R2 적대 GREEN, 같은 첫 명령 | 0 | 28 passed / 63 deselected, 0.64s |
| 추가 recovery/API/foreign authority 검증 포함 focused | 0 | 94 passed, 2.35s |
| knowledge/API 전체 관련 회귀 | 0 | 1817 passed, 13.26s; skip/fail 없음 |
| compileall | 0 | diagnostics 없음 |
| diff-check | 0 | diagnostics 없음 |

R2 보고서 작성 후 §4의 `git diff --no-index --check -- NUL <exact6 경로>` 6개도 각각 exit 1 / diagnostics 0으로 다시 확인했다. 마지막 `git diff --check` exit 0. no-index의 exit 1은 신규 untracked 파일 차이이며 whitespace 오류가 아니다.

| R2 변경 경로 | 최종 SHA256 |
|---|---|
| packages/knowledge/model_registry.py | `D1F8CEF3EE77696DB7962650E3C1926A79444378192BD6FA7AFADD02B92A2AF6` |
| tests/knowledge/test_model_registry_d11.py | `803F20AE1BF51A75457892B546566FD969DA93F3BD2F47E7C51F2995D3045E25` |
| tests/api/test_model_registry_d11.py | `4720BF325506946AA454B5FAC79AE5B3E2D4B81E67E46094D3EF38099F9BAA73` |
| docs/04_test_reports/D-11_COMPLETION_REPORT.md | 본 R2 근거 추가, self hash 제외 |

초기 R1 대비 domain에 publication transaction과 capture/upstream 검증을 추가하고 domain 30건/API 1건 회귀를 추가했다. R2 RED의 세 fingerprint는 동일한 결과 계약에 따라 Main이 검토하며 개발자가 failure count/progress를 변경하지 않았다. 최종 미해결 테스트 실패 0.

미검증/잔여 위험: §5의 실제 Provider 최신성, durable checkpoint/signature, consumer runtime 연결은 그대로 NOT_EXECUTED/NOT_INTEGRATED다. transaction은 이 registry의 in-memory 상태 경계이며 실제 DB transaction·외부 side effect rollback을 증명하지 않는다. 예상치 못한 publication exception은 복구 후 호출자에게 다시 전달한다. Source revoke 등 다른 owner package의 이미 발생한 정본 lifecycle 이력은 되돌리지 않는다.

Rollback: Main이 R2 산출물을 보존한 뒤 이번 domain transaction/검증 diff 및 추가 테스트/보고 절만 선택적으로 역적용한다. 초기 R1에는 이번 Blocking 3건이 있으므로 검토 없이 운영 기준으로 복귀하지 않는다. 기존 D-01~D-10·control·dirty를 reset/clean하지 않는다. 이번에도 Git/control/progress/HANDOFF 수정은 하지 않았다.
