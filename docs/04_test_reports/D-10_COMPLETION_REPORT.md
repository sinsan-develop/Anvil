# D-10 완료보고 — fake Hook sandbox lifecycle

## 1. 판정

`COMPLETED` — developer-primary-d10-r1의 exact6 구현 및 R1 재작업 완료. 최종 focused 72 PASS, knowledge/API 전체 관련 회귀 1723 PASS, compileall/diff-check exit 0. 최종 R1 증거는 §6이며 §2~5의 초기 기록은 보존한다. Main 독립 검토/ACCEPTED와 D-Hook Gate 판정은 별도다. D-11은 시작하지 않았다.

## 2. 판단 이유

- D-09 정본 Hook id/version/hash, Program source/dependency/artifact/signature/hash, permission, scope, provenance를 다시 계산·대조하여 D-10 sidecar에 결박한다. D-09 파일은 수정하지 않는다.
- REGISTERED→SHADOW→PILOT→TRUST_REVIEW→ACTIVE→QUARANTINED/RETIRED는 immutable event hash, optimistic state_version, operation/request idempotency를 갖는다. 승인 body의 self-claim이나 lifecycle skip은 거부한다.
- shadow는 원 Action을 차단/수정하지 않는다. 고정 fake sandbox에서만 receipt를 수집한다. pilot은 positive/negative/timeout/schema/fault-policy/recursion 6개 distinct case/event/input fixture를 host가 결박한 뒤 실제 fake adapter로 재생한다.
- sandbox packet은 non-root, read-only rootfs, exact entrypoint read path, network/project-write/credential-read/child-process/deployment/Hook-mutation/Subagent-create deny다. **이는 fake adapter 계약이며 실제 OS 격리를 증명하지 않는다.**
- input의 credential/PII/instruction/malware 계열은 기존 D-01/D-03 scanner를 재사용하여 fake executor 호출 전에 차단한다. 구조화 mapping key/value credential 의미도 검사한다. stdout JSON/schema/size, stderr/exit/duration을 검사하고 raw 출력 대신 hash/result receipt를 남긴다. 오류 응답에 입력 원문을 반영하지 않는다.
- host-captured 사람 trust는 exact definition/program/permission/scope/principal/context, pilot evidence, allowed result 집합 및 expiry에 결박된다. 만료·source revoke·source/dependency/artifact/signature/definition drift는 실행 및 기존 cached allow 재사용 전에 검사한다.
- trusted_auto는 기존 ACTIVE trusted program의 log-only/fail-open 사전 승인에서만 가능하다. 같은 Event/scope/program/permission/timeout/failure-policy, 같은 matcher include, exclusion의 strict superset과 실제로 새로 제외되는 canonical Event witness를 요구한다. 신규 Hook/irrelevant exclusion/범위 확대/exclusion 제거/Event 변경은 거부한다. 알림/version/rollback reference를 기록한다.
- activation은 다음 Run에만 적용한다. D-02 exact snapshot 및 host-observed Run start 5초 window, one-shot capability, 실제 selection 시각을 결박한다. 현재/늦은/복제 DTO/replayed start는 거부한다. 이미 선택된 snapshot은 새 version으로 바뀌지 않는다.
- active 경로는 D-09 Event/result/merge/fault 규칙을 재사용한다. depth>=1은 executor IO0 deny이며 event-id 재전달은 동일 receipt, 다른 payload/depth는 conflict다.
- schema/timeout 위반은 즉시, 반복 error는 누적 2회, 과도 deny는 누적 3회를 기준으로 quarantine한다. fail-closed 안전 Hook은 managed built-in deny fallback을 먼저 기록한다. fallback은 기존 및 이후 Run snapshot에도 포함하며 원 프로그램을 실행하지 않는다. 알림/영향 Run/audit/automation hash를 보존한다.
- rollback은 직전 automation snapshot의 해당 Hook slot만 복구하며 다른 Hook slot을 덮어쓰지 않는다. 복구 대상의 source/trust/ACTIVE 상태를 검사한다.
- export/import는 별도 host authority가 보존한 exact sealed envelope와 context/principal/epoch를 검사한다. body 및 hash 재계산 변조, 누락, stale checkpoint, 다른 context를 거부한다. 복원 후 이전 owner의 추가 실행을 차단하고 trust/lifecycle/receipt/automation/fallback/notification/rollback/audit 및 실제 D-02 SKILL version 정보를 보존한다.
- 검증 ID `AV-LRN-020`, `AV-LRN-022`, `AV-SAFE-027`, `AV-STAT-040`의 D-10 fixture/in-memory 계약 범위에 대한 증거다. 실제 OS/영속 재시작 증거로 승격하지 않는다.

## 3. 조치·기준선·변경 범위

- root: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- 시작/최종 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88` (불변)
- canonical sequence: `1021`; D-09 ACCEPTED 후 Main 발행 D-10 start control을 사용했다.
- worker: `worker-lease-d10-r1-20260916-001`
- execution fence: `d10-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`
- write: `write-lease-d10-r1-20260916-001`
- write fence: `d10-r1-write-fence-epoch-1-234458b5283abafa`
- 두 lease ACTIVE: `2026-09-16T20:18:00+09:00` 이상 `2026-09-17T08:18:00+09:00` 미만. 작업 전 실제 host 20:19 KST 및 검증 시 20:44 KST 확인.
- WI SHA256: `B9F8F545F5D55FCF646AFD1BD564D9C16C5BA9834ABC520B6D6E59BF72214CD7`
- prompt SHA256: `46452317AFAE3EA0CFD6C9696C4053E7E068880F6A845CE7C9299D35BAEBA3AF`
- Design baseline: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- WorkPlan baseline: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- Matrix baseline: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- TestPlan baseline: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- 기존 tracked dirty 26개 및 D-01~D-09/control untracked를 보존했다. D-10 파일은 신규이고 __init__.py만 기존 D-09 export에 이어 2줄을 추가했다. Git상 exact6는 모두 untracked다. 관련 없는 파일/Git index/control/progress는 수정하지 않았다.
- 원본 `D:\tmp\anvil-main-integration` 제품 파일은 변경하지 않았다. 해당 경로의 기존 venv Python 3.13.9 실행기만 사용했다. 권한 상승·승인 UI·Git stage/commit/push·외부 IO는 수행하지 않았다.

| 초기 R0 변경 경로 | diff | R0 SHA256 (R1 최종 hash는 §6) |
|---|---|---|
| packages/knowledge/__init__.py | HookRuntime 관련 import/export 2줄 추가, 기존 export 보존 | `E4A401951497A11E686781DB35D79040B40F56E5EF8E53A2BC1D7EA855106F31` |
| packages/knowledge/hook_runtime.py | 신규 632줄, fake executor/lifecycle/trust/snapshot/quarantine/restart 계약 | `27FD55461BFF4C086698C283503DFDC14A549CE76DB5D006E9F4D2C37DD68C82` |
| packages/api/hook_runtime.py | 신규 39줄, authenticated host-context adapter | `6DCC95B62171B830BB17D596748F0DA1D7EB21106E7D1932726CB638DE628A34` |
| tests/knowledge/test_hook_runtime_d10.py | 신규 384줄, 실제 D-02/D-05/D-06/D-09 in-memory 연결과 적대 검증 | `A469E5DB64881749778F2DD391E79CED4A0FCA6342EB5A7900E9646B9B696045` |
| tests/api/test_hook_runtime_d10.py | 신규 34줄, API 경계/자가 권위/실행 projection 검증 | `8E7FB49C886A0574083F1F61DAF5AA80DF1C79935A7C655F4FB3AE036CFA9E25` |
| docs/04_test_reports/D-10_COMPLETION_REPORT.md | 본 보고서 신규 | self hash 제외 |

## 4. 정확한 검증 명령·exit·결과

모든 명령은 위 root에서 실행했다. domain/API 동일 test basename의 collection 충돌을 막기 위해 `--import-mode=importlib`을 명시했으며 repository 설정은 변경하지 않았다.

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_hook_runtime_d10.py tests/api/test_hook_runtime_d10.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
git branch --show-current
git rev-parse HEAD
```

| 단계 | exit | 실제 결과 |
|---|---:|---|
| 최초 RED | 1 | 34 failed, 0.63s, `D10_HOOK_RUNTIME_MISSING` |
| 최초 lifecycle 구현 GREEN | 0 | 34 passed, 1.41s |
| 보강 RED | 1 | 39 passed / 9 failed, 1.89s |
| 보강 GREEN | 0 | 48 passed, 1.78s |
| fallback 재전달 RED | 1 | 54 passed / 1 failed, 1.89s |
| fallback 보완 GREEN | 0 | 55 passed, 1.84s |
| 실제 exclusion 제거 fixture 정밀화 후 최종 focused | 0 | **55 passed, 2.04s** |
| 최초 knowledge/API 회귀 | 0 | 1706 passed, 11.86s |
| 최종 knowledge/API 회귀 | 0 | **1706 passed, 11.33s**, failed/skipped 없음 |
| 최종 compileall | 0 | 진단 없음 |
| git diff --check | 0 | 진단 없음 |
| branch/HEAD | 0 | 시작 기준선과 동일 |

Untracked 파일을 별도로 검사했다.

```powershell
$d10Paths=@('packages/knowledge/__init__.py','packages/knowledge/hook_runtime.py','packages/api/hook_runtime.py','tests/knowledge/test_hook_runtime_d10.py','tests/api/test_hook_runtime_d10.py')
foreach ($d10Path in $d10Paths) {
  $d10Output=git diff --no-index --check -- NUL $d10Path 2>&1
  $d10Exit=$LASTEXITCODE
  [pscustomobject]@{Path=$d10Path;Exit=$d10Exit;Output=($d10Output -join [Environment]::NewLine)} | ConvertTo-Json -Compress
}
```

5개 모두 exit 1(추가 내용 존재), Output 빈 문자열로 whitespace diagnostic 0. 최종 domain test 수정 후에도 NUL check exit 1/진단 없음이다. 20:47 KST 보고서에 대한 `git diff --no-index --check -- NUL docs/04_test_reports/D-10_COMPLETION_REPORT.md`도 exit 1/진단 없음, 최종 `git diff --check` exit 0을 확인했다.

### 오류 fingerprint/count

- test-first 미구현 RED 34건: 해결.
- 보강 RED 9건: 미래 Run managed fallback 1, cached allow stale authority/hash/source 3, 실제 축소 없는 exclusion 1, Skill kind 분리 1을 수정했다. 나머지 3건은 확장/Event 변경 테스트의 pilot fixture가 해당 Event를 지원하지 않던 문제로 negative Event 및 허용 log 결과를 교정한 뒤, 실제 auto authorization 거부까지 확인했다.
- fallback denial 재전달의 `HOOK_RUNTIME_NOT_ACTIVE` 1건: 안전 deny replay 보존과 fallback automation hash 결박으로 해결.
- 현재 테스트 오류 0. 내부 RED·fixture 수렴을 정식 failure count로 자의 승격하지 않는다. 정식 실패/인수 count는 Main 소유다.
- 시작 git status의 사용자 전역 ignore 파일 접근 warning 2건은 기존 환경 이슈로 status는 exit 0. ACL/escalation/설정 변경을 수행하지 않았다.

## 5. 미검증·잔여 위험·rollback

- 실제 OS sandbox/command/process/filesystem program 실행, 네트워크, DB/HTTP/browser/deployment: **NOT_EXECUTED**. FakeSandboxExecutor만 허용하며 외부 callable/OS adapter는 제공하지 않는다.
- 실제 파일 source/dependency/artifact 읽기 및 cryptographic signature verification: **NOT_EXECUTED**. 검증은 fake inspector의 exact hash receipt와 registry hash 비교다.
- 실제 프로세스 재시작·DB 영속성·암호학적 서명 키 관리: **NOT_EXECUTED / NOT_INTEGRATED**. HookRuntimeAuthority가 살아 있는 host adapter에 sealed checkpoint와 epoch를 보존하는 in-memory restart seam이다. 이를 durable restart PASS로 표시하지 않는다.
- D-02 snapshot의 exact SKILL version은 보존하지만 D-07 Skill loader를 실행하거나 Skill activation을 변경하지 않는다. 실제 Skill/Hook consumer와 runtime orchestration 연결: **NOT_INTEGRATED**.
- ACTIVE/trust/shadow/pilot은 `FAKE_SANDBOX_ONLY` sidecar의 상태이며 실제 도구 Action 경로의 실행 허가가 아니다. actual_os_executed=False를 명시한다. 사용자에게 보여줄 실제 HTTP/UI 인증·승인 화면은 미검증이다.
- 현재 automatic quarantine threshold는 schema/timeout 즉시, 누적 error 2회, deny 3회인 deterministic fixture 정책이다. 실제 환경의 분포·latency·비용 임계치 조정은 검증하지 않았다.
- API는 host context를 주입받는 adapter다. capture_human_trust/capture_pilot/capture_run_start 및 authority 발급은 API body에서 호출할 수 없다. 실제 외부 host control-plane integration은 별도 소유 경계다.
- rollback 방법: Main이 exact6 diff를 확인한 뒤 신규 D-10 5개 파일을 복구 가능한 위치에 보존하고 __init__.py의 D-10 import/export 2줄만 되돌린다. 기존 D-01~D-09/C/control dirty는 유지한다. 본 작업은 삭제/rollback/Git mutation을 실행하지 않았다.
- progress/HANDOFF/control은 **미갱신, Main 소유**. Main 독립 리뷰 및 D-Hook Gate 이전 D-11을 수행하지 않는다.
- TDD·완료검증 스킬에 따라 의도된 RED 확인, 실제 GREEN/회귀/정적검사 순서를 적용했다.

## 6. 독립 리뷰 R1 재작업

### 판정

`COMPLETED` — pilot fault-policy 증거 및 안전 Hook quarantine/fallback 게시의 두 Blocking을 재현·수정했다. 기존 55개 테스트를 유지하고 신규 17개 적대/회귀 테스트를 추가하여 최종 72개가 통과했다.

### 판단 이유

1. 기존 pilot은 fault_policy case가 error를 반환하는지만 확인하여 현재 policy의 deny/allow·warning/log 적용 증거가 빠져 있었다. 이제 pilot과 active가 같은 `_fault_policy_receipt`를 사용한다. D-09 정본 fault projection과 canonical normal-result merge를 실제 호출하고 exact definition policy, target, fault kind, warning/log, decision, projection hash 및 merge hash를 결박한다. fail_closed는 deny, fail_open은 allow+warning/log여야 하며 조작된 policy/decision/warning/log/hash/merge 결과에서는 PILOT로 전이하지 않는다. timeout/schema fixture의 fault receipt에도 같은 계약을 적용한다.
2. 기존 안전 Hook 판별은 fail_closed만 보아 fail_open의 정상 deny/block을 놓쳤다. 이제 fail_closed뿐 아니라 trust의 allowed_results와 shadow/pilot normal result를 Event 허용 matrix 및 D-09 canonical merge의 deny 의미로 판별한다. PreToolUse deny, Stop/SubagentStop block, normal fixture가 allow지만 사람 grant가 deny를 허용한 경우에도 managed fallback이 필요하다.
3. fallback을 먼저 생성하고 fallback head와 hash-bound automation snapshot을 게시한 뒤에만 원 ACTIVE head를 제거하고 QUARANTINED로 전이한다. 이전/이후 두 snapshot을 보존한다. snapshot version/hash/head/fallback 및 실제 ledger 게시 여부를 검사하여 silent missing publication도 성공으로 인정하지 않는다.
4. fallback 생성·첫 게시·최종 게시에서 실패하면 in-memory transaction을 복원한다. 원 ACTIVE head, state/event/audit/notification/automation 및 authority epoch를 보존하고 `HOOK_RUNTIME_FALLBACK_PUBLICATION_FAILED`를 반환한다. 부분 quarantine이나 head 유실을 남기지 않는다. 이후 Run에는 fallback이 frozen selection으로 남고 원 program은 실행하지 않는다.

### 조치 및 exact 범위

- WI/prompt 및 canonical seq1021, 동일 worker/write lease/token을 20:58 KST에 다시 읽었다. 검증 종료 21:05 KST는 기존 만료 `2026-09-17T08:18:00+09:00` 이전이다.
- branch/HEAD는 §3과 동일하다. R1은 exact6 중 runtime 구현, domain test, 본 보고서 3개만 수정했다. API 구현/API test/__init__.py는 R0 그대로 보존했다. Git/control/외부 IO는 변경·실행하지 않았다.
- receiving-code-review/TDD 원칙에 따라 reviewer 재현을 먼저 RED로 확인했고, 실제 검사 출력으로만 GREEN/회귀를 판정했다.

| R1 변경 경로 | 최종 줄 수 | SHA256 |
|---|---:|---|
| packages/knowledge/hook_runtime.py | 701 | `D99A26FAE223EF512746CD09315F1886AA642DC374CA7F0DEF93FC47E51018F9` |
| tests/knowledge/test_hook_runtime_d10.py | 497 | `DE3C8B4F1A42B0469261F50CB7A06204755C27ED40085F57306EE7F95BB4B4C3` |
| docs/04_test_reports/D-10_COMPLETION_REPORT.md | 본 R1 기록 추가 | self hash 제외 |

### 정확한 명령·exit·결과

```powershell
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_hook_runtime_d10.py tests/api/test_hook_runtime_d10.py -k r1 --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_hook_runtime_d10.py tests/api/test_hook_runtime_d10.py --tb=short
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge tests/api
& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api
git diff --check
```

| 단계 | exit | 실제 결과 |
|---|---:|---|
| 최초 R1 재현 | 1 | 14 failed / 55 deselected, 0.69s |
| 1차 GREEN | 0 | 69 passed, 2.78s |
| silent snapshot 누락 추가 RED | 1 | 1 failed / 16 passed / 55 deselected, 0.63s |
| 최종 focused | 0 | **72 passed, 2.59s** |
| 최종 knowledge/API 전체 관련 회귀 | 0 | **1723 passed, 13.52s**, fail/skip 없음 |
| compileall | 0 | 진단 없음 |
| diff-check | 0 | 진단 없음 |

수정 runtime/test 각각 `git diff --no-index --check -- NUL <정확한 상대경로>`는 exit 1(추가 내용 존재)/Output 빈 문자열이었다. 21:06 KST R1 보고서의 `git diff --no-index --check -- NUL docs/04_test_reports/D-10_COMPLETION_REPORT.md`도 exit 1/진단 없음, 최종 `git diff --check` exit 0을 확인했다.

오류 fingerprint: fault-policy/merge 미결박 8개, fail-open normal safety fallback 누락 3개, snapshot 게시 순서 1개, 게시 실패 원자성 2개를 최초 RED로 재현했다. silent missing publication 1개를 추가 RED로 재현했다. 모두 해결하여 현재 테스트 오류 0이다. 의도된 RED를 정식 failure count로 자의 승격하지 않는다.

### 미검증·rollback·후속

§5의 실제 OS/process/서명검증/DB/HTTP/영속 재시작 **NOT_EXECUTED**, 실제 consumer/host persistence **NOT_INTEGRATED** 경계를 그대로 유지한다. 이번 원자성은 단일 host in-memory lock과 state/epoch 복원의 fixture 증거이며 실제 DB transaction 증거가 아니다. rollback은 Main이 R1 수정 3개 diff와 R0 hash를 기준으로 좁게 복구하며 관련 없는 dirty를 보존한다. 여기서는 rollback/Git mutation을 수행하지 않았다. progress/HANDOFF/control은 미갱신이며 Main 소유다. D-Hook Gate/D-11을 시작하지 않았다.
