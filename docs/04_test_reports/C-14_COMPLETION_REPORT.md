# C-14 완료보고서 — current-baseline REWORK R1

## 판정

`COMPLETED` — 독립 리뷰 REWORK R1 3건 재현·보완 완료, Main 재검토 대기.
현재 C-14 130 PASS, 분리 관련 회귀 702 PASS, compileall·diff-check PASS.

**전체 관련 회귀는 PASS가 아니다.** R1 최종 결과는 **702 passed, 8 skipped, 1 failed**이며,
실패 1건은 변경하지 않은 C-01 OpenAPI snapshot과 기존 C-04 delegation 4경로의 충돌이다.
이를 baseline failure로 분리 보고하며 무시 승인·수정·Gate 통과로 승격하지 않았다.
실제 운영 증거, 사용자 ProductValidation/ReleaseDecision/Apply Approval 및 배포 완료를 의미하지 않는다.

과거 보고서의 `codex/c14-gates-approval`, `85d6ca1`, `62 passed`, clean/commit 완료 주장은
이번 증거가 아니므로 본 current-baseline 보고로 대체한다. 구현자는 commit하지 않았다.

## 판단 이유

### 1. 권위·시작 상태

- 작업 담당: `developer-primary-c14-r1`, 단일 writer. 새 agent 생성 없음.
- canonical worktree: `D:\tmp\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- 시작/종료 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`
- 시작 status: clean 아님. 기존 C-13 제품·통제 dirty/untracked를 보존하고 C-14 exact4만 수정.
- 최초 seq910 lease가 host 시각보다 미래여서 제품 mutation 전에 중단했다.
  Main의 append-only seq911~915 epoch-2 정정 후 재개했다. 과거 event/hash는 수정하지 않았다.
- 재개 canonical: seq915, C-14 IN_PROGRESS.
- worker lease: `worker-lease-c14-r1-20260916-002`
- execution fence: `c14-r1-execution-fence-epoch-2-a3fa3ed09cd6998b`
- write lease: `write-lease-c14-r1-20260916-002`
- write fence: `c14-r1-write-fence-epoch-2-234458b5283abafa`
- 유효시간: `2026-09-16T03:57:00+09:00` 이상, `2026-09-16T15:57:00+09:00` 미만.
- host 시각 재확인: 재개 04:05:51 KST, 최종 전 04:28:22 KST. 모두 lease 유효시간 안.
- 구 WI의 더 넓은 경로 문구보다 Main의 exact4 및 canonical product_write_scope를 적용했다.
- stage/commit/push/PR/merge, 통제 투영, C-15 이후 작업, 외부 실행은 수행하지 않았다.

| 기준 문서 | 확인 SHA-256 |
|---|---|
| Anvil_설계서_v2.md | DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3 |
| Anvil_작업계획서_v1.md | 00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18 |
| Anvil_통합검증매트릭스_v1.md | 289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5 |
| Anvil_테스트계획서_v1.md | 9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644 |
| C-14_WORK_INSTRUCTION.md | 7FD6CE82630866CDF92513FF1413B76516F74E0310C9DAC131F340EEAF38CCC1 |
| C-14_INVOCATION_PROMPT.md | F5F481A11FC866BB652E5835D694FE89126BC73CF2143AC7CEB2E910D4AE98BA |

### 2. 변경과 검증 계약

| 변경 파일 | 변경 전 → 변경 후 |
|---|---|
| packages/verification/gates.py | PASS DTO 집계 중심 → G0 six observations, G1 profile/command evidence, G2 deterministic/LLM 분리, G3 경계 assertion 및 증거 replay, 독립 Apply Approval와 현재 validation/defect/시간 검증 |
| packages/verification/__init__.py | 기존 export 유지 + StaticTool, CommandEvidence, TestEvidence, DiffFile, ReviewFinding, ApplyApprovalRecord 및 LLM_CHECKS |
| tests/verification/test_gates_c14.py | 기존 8 tests 보존·host-issued 계약 fixture 교정, R1 최종 130 tests |
| docs/04_test_reports/C-14_COMPLETION_REPORT.md | stale 과거 보고 → 이번 기준선과 RED/GREEN·미검증·잔여 위험 |

R1 제품 diff numstat: gates.py +618/-81, __init__.py +3/-1, tests +512/-10.
보고서 변경량은 자기 참조를 피하기 위해 기재하지 않는다.
정확한 diff: `git diff -- packages/verification/gates.py packages/verification/__init__.py tests/verification/test_gates_c14.py docs/04_test_reports/C-14_COMPLETION_REPORT.md`.

- G0: repository readability, branch/HEAD, tracked/untracked dirty manifest, runtime versions,
  baseline test counts, backend health를 모두 요구한다. 누락 BLOCKED, malformed ERROR,
  기존 test 실패는 BASELINE_FAILURE이며 PASS relabel로 숨길 수 없다.
- G1: host가 수집한 ProjectProfile의 tool snapshot(StaticTool)만 입력받는다.
  declared+missing은 TOOL_NOT_INSTALLED, declared+not detected는 TOOL_NOT_DETECTED.
  모든 preflight가 끝나기 전 runner 호출 0. detected tool의 정확한 argv/version/exit/evidence를 검사한다.
- G2: path scope, file deletion, test deletion/skip weakening, dependency/lockfile,
  public surface, secret pattern, formatter drift를 독립 finding으로 기록한다.
  Python 함수·class public method·__all__, JS export, pnpm/poetry lock, quoted/unquoted secret 변형 포함.
  LLM 5종 결과는 별도 보관하고 누락은 BLOCKED, deterministic finding 제거/완화는 허용하지 않는다.
  secret 값은 finding/receipt에 넣지 않고 hash reference만 기록한다.
- G3: input/store/response/UI 각각 expected/observed/evidence_ref를 요구한다.
  assertion 불일치 FAIL, 실제 경계 누락 BLOCKED, requirement/reason 없는 SKIP ERROR.
  PASS/FAIL/SKIPPED/BLOCKED/ERROR counts와 mode를 보존한다.
- G0~G3 모두 정확히 1개 PASS만 완료. 필수 gate 제거, target mismatch,
  bare PASS 및 실패 증거를 PASS로 바꾼 manifest는 거부한다.
  Manifest 평가에서 원관측·profile command·review finding·test assertion을 **외부 IO 없이 재평가**한다.
- delivered = verified = target, immutable nested evidence, canonical hash와 mapping 순서 결정성 검증.
- Release와 Apply는 별도 human 승인이다. Release만으로 Apply approval을 생성하지 않는다.
  trusted in-memory host adapter에 등록한 결정/Apply 승인만 검사하며,
  authenticated는 정확한 True와 HUMAN role을 요구한다.
  결정 ID·target·manifest·시작/만료·현재 최신 결정·철회·현재 validation/defect를 Apply 직전에 재검사한다.
  동일 receipt 재조회도 현재 차단 상태를 먼저 확인한다. 다른 approval ID replay는 거부한다.
  반환한 frozen decision을 object.__setattr__로 변조해도 내부 별도 snapshot과 비교하여 차단한다.
- ProductValidation은 required criteria 전부 SUITABLE, target/delivered/environment 일치,
  real evidence refs·절차·예상·관측·검증시각을 요구한다. 기준 제거·미완료·blocking defect를 거부한다.

### 3. 요구사항 추적

| 직접 검증 | 이번 로컬 증거 |
|---|---|
| AV-GATE-001~003 | G0 6개 누락/invalid, baseline failure 분리; G1 detected/declared missing·preflight IO0·command evidence |
| AV-GATE-006~015 | G2 7종 및 우회 변형, LLM override 불가; G3 4경계·mock/fixture 분리·skip/count; exact G0~G3 5상태 행렬 |
| AV-GATE-020~022 | immutable manifest·검증/전달 target·증거 재평가·필수 gate 제거 및 drift 차단 |
| AV-SAFE-017 | authenticated human Release/Apply 분리, expiry/revoke/replay·변조 차단 |
| AV-STAT-022 | ProductValidation 미완료·대상/환경 불일치·blocking defect 시 Apply 거부 |
| AV-FLOW-013 | synthetic evidence→gate→manifest→ProductValidation→Release→독립 Apply receipt 흐름 및 재조회 차단 |

위 매핑은 in-memory/fixture 계약 증거이며 실제 사용자 입력→운영 저장→응답→화면 E2E가 아니다.

## 조치

### 4. 초기 제출의 정확한 실행 명령·exit·결과 (R1 이전 증거)

모든 명령 workdir은 `D:\tmp\anvil-main-integration`.
Python 실행은 Windows sandbox의 로컬 실행 권한으로 수행했으며 외부 서비스 호출 권한으로 확장하지 않았다.
TDD skill에 따라 먼저 부족 계약을 실패시키고 최소 구현 후 GREEN을 확인했다.

| 순서 | 정확한 명령 | exit / 실제 결과 |
|---|---|---|
| RED-1 | python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py -k c14_ --disable-warnings -ra | 1 / 13 failed, 8 deselected (0.69s) |
| GREEN-1 | python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py -k 'g0 or g1 or g2 or g3 or nested' --disable-warnings -ra | 0 / 12 passed, 9 deselected (0.44s) |
| RED-2 | python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py -k 'bare_pass or relabelled' --disable-warnings -ra | 1 / 2 failed, 21 deselected (0.53s) |
| GREEN-2 | python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py --disable-warnings -ra | 0 / 23 passed (0.44s) |
| RED-3 | python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py -k 'additional_detection or reason_code_removal or extend_expiry' --disable-warnings -ra | 1 / 6 failed, 2 passed, 23 deselected (0.56s) |
| GREEN-3 | python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py --disable-warnings -ra | 0 / 31 passed (0.52s), 확장 후 105 passed (0.66s) |
| 관련 전체 1 | python -B -m pytest -q -p no:cacheprovider tests/verification tests/orchestration --disable-warnings -ra | 1 / 677 passed, 8 skipped, 1 failed, 1 warning (2.92s) |
| 분리 회귀 1 | python -B -m pytest -q -p no:cacheprovider tests/verification tests/orchestration --ignore=tests/verification/test_c01_l3_independent_acceptance.py --disable-warnings -ra | 0 / 677 passed (1.96s) |
| RED-4 | python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py -k 'insertion_order or environment_must or never_claims' --disable-warnings -ra | 1 / 3 failed, 105 deselected (0.53s) |
| 최종 C-14 | python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py --disable-warnings -ra | 0 / 108 passed (0.55s) |
| 최종 분리 회귀 | python -B -m pytest -q -p no:cacheprovider tests/verification tests/orchestration --ignore=tests/verification/test_c01_l3_independent_acceptance.py --disable-warnings -ra | 0 / 680 passed (2.07s) |
| 최종 관련 전체 | python -B -m pytest -q -p no:cacheprovider tests/verification tests/orchestration --disable-warnings -ra | 1 / 680 passed, 8 skipped, 1 failed, 1 warning (3.16s) |
| compileall | python -B -m compileall -q packages/verification tests/verification | 0 / 출력 없음, 두 차례 PASS |
| whitespace | git diff --check | 0 / 출력 없음, 보고서 포함 재검증 |
| baseline 범위 확인 | git diff -- packages/api apps/api tests/verification/test_c01_l3_independent_acceptance.py | 0 / 출력 없음 |
| Git identity | git rev-parse HEAD; git branch --show-current | 0 / 위 HEAD·branch 유지 |

### 5. 실패·SKIP·오류 fingerprint/count

- TDD 의도된 RED: 4회 실행, 13+2+6+3 = 24 assertion 실패 관측.
  제품의 완료 후 정식 실패 재발 횟수로 계산하지 않는다.
  fingerprint: C14_MISSING_GATE_EVIDENCE, C14_BADGE_REPLAY,
  C14_DIFF_VARIANT_AND_APPROVAL_MUTATION, C14_DETERMINISM_ENVIRONMENT_LLM.
  각각 후속 GREEN 확인. 동일 원인 세 번 정식 실패 선언 없음.
- 미해결 관련 baseline failure: `C01_L3_UNAPPROVED_OPENAPI_PATH_DIFF`,
  `tests/verification/test_c01_l3_independent_acceptance.py:239`.
  서로 다른 최종 코드 시점에서 2회 실행·동일 1개 고유 실패.
  예상 목록에 없는 현재 경로:
  `GET /api/delegations/{id}`,
  `POST /api/delegations/{id}:steer`,
  `POST /api/delegations/{id}:cancel`,
  `POST /api/delegations/{id}:resume`.
  `packages/api/registry.py`는 이 경로 owner를 C-04로 기록한다.
  관련 API·테스트 파일 HEAD diff 0이고 GateEngine/ReleaseApprovalService 참조가 없는
  schema 비교이므로 C-14 product regression과 구분한다. Main에 보고했다.
  분리 회귀의 --ignore는 검증 범위를 명시한 것이며 이 실패의 면제/무시 승인이 아니다.
- SKIP 8: 같은 파일 line195, `ANVIL_TEST_DATABASE_URL is not set`.
  DB 실행 없이 local authoring only. 실제 DB 수용검증 미실행.
- 전체 회귀 warning 1은 --disable-warnings 요약에 관측됨. PASS/FAIL 판정과 분리하며
  상세 원인 미확정; 경고를 없애기 위한 외부/범위 밖 변경 없음.
- 도구/환경: rg WinGet shim ResourceUnavailable을 발견하여 PowerShell 검색으로 전환.
  Git ignore/.pytest_cache read 권한 warning 관측. 제품 실패 아님.
- 이전 capacity 오류는 제품 결과가 아니며 formal failure에 포함하지 않는다는 Main 지시 유지.
- 최초 future-dated lease는 제품 변경 전 중지·Main append-only 정정으로 해결. 제품 쓰기 우회 없음.

### 6. 보존 상태·미검증·잔여 위험

- C-13 보고/WI/prompt, progress/HANDOFF/events, checker/tooling,
  leases/orchestration/tool_gateway 기존 변경과 모든 C-13/C-14 control manifest·digest를 보존했다.
  이 agent가 해당 파일을 작성·stage·복구하지 않았다.
- `docs/progress/**`, HANDOFF, event, manifest, governance는 **Main 소유로 미갱신**.
  checker는 Main이 seq915에서 PASS로 확인한 통제 증거이며, 이번 제품 검증 PASS와 동일시하지 않는다.
- 기존 공개 Gate DTO·evaluate_gates API는 유지하되 Release/Apply가 bare PASS와 implicit Apply를
  거절하도록 의도적으로 강화했다. caller는 evidence 기반 GateEngine과 독립 host approval을 사용해야 한다.
- G0 관측/G1 profile 및 runner/G2 diff와 LLM 결과/G3 실제 evidence의 진실성은
  **trusted host capture adapter 경계**다. 임의 untrusted agent JSON을 host 승인·실제 evidence로
  수용하는 인증 어댑터를 구현한 것은 아니다. Auth·persisted audit·분산 재사용 방지는 미구현 범위.
  JSON mode='real'은 이 테스트의 합성 계약 fixture이며 실제 운영 증거가 아니다.
- G2는 표준 라이브러리의 보수적인 deterministic detector다. 모든 언어의 API 호환성이나
  모든 secret 형태를 완전 검출한다고 주장하지 않는다. Python/JS 및 명시 lockfile 변형을 검증했다.
- 실제 repository/backend 수집, tool process 실행, LLM review 호출, API request, DB,
  browser/UI, Provider/network, WSL/Docker/deploy/Secret manager는 실행하지 않았다.
  OpenAPI는 in-process schema 생성/비교만 실행했다.
- 이번 승인 서비스는 receipt만 반환한다. 실제 파일 apply, 운영 release나 외부 dispatch side effect 없음.
- 독립 Spec/Quality 검토·C-14 최종 수용·기존 baseline failure 처리 판단·통제 완료 투영은 Main 소유.

### 7. rollback 및 다음 안전 행동

C-14 exact4는 미커밋이다. 먼저 Main이 해당 네 파일의 diff를 복구 가능한 patch/checkpoint로 보존한 뒤,
이번 C-14 hunks만 검토하여 역적용한다. 전체 worktree reset/stash/delete는 금지한다.
기존 C-13·control dirty 및 historical event/hash를 되돌리지 않는다.
커밋 이후 rollback은 Main이 실제 생성한 C-14 product commit에 대한 정상 revert로 수행한다.
실제 외부 side effect가 없어 DB·서비스·배포 rollback은 해당 없음.

다음 행동: Main 독립 리뷰 및 기존 C-01 snapshot 실패 분리 판단.
신규 승인·Git mutation·통제 갱신·후속 Package는 구현자가 수행하지 않는다.

## Main 독립 재검토 및 최종 판정

- 독립 reviewer R0: `REWORK` — cross-target evidence relabel, blocking defect omission,
  Python dependency manifest 누락의 blocking 3건.
- Developer R1: 위 3건을 exact4 안에서 TDD로 보완.
- 독립 reviewer R1: `ACCEPT`, blocking 0, important 0.
- Main fresh 재실행: C-14 전용 `130 passed`, C-01 stale snapshot 제외 관련 회귀
  `702 passed`, compileall·diff-check exit 0.
- 관련 전체 결과는 `702 passed, 8 skipped, 1 failed`로 유지한다. 1 fail은 C-04
  delegation 4경로를 반영하지 않은 기존 C-01 OpenAPI snapshot이며 C-14 회귀가 아니다.
- DB skip 8과 실제 DB/API/browser/provider/WSL/Docker/deployment는 미검증이다.
- 최종 C-14 판정: `ACCEPTED`. 위 baseline failure와 미검증 범위를 PASS로 승격하지 않는다.

### 8. 독립 리뷰 REWORK R1 — 재현 → 조치 → 재검증

판정: `COMPLETED`(재작업 구현 완료), 최종 수용은 Main 소유.
독립 리뷰 formal REWORK 1회가 발생했으며, 초기 제출의 완료 표시는 최종 수용을 뜻하지 않는다.
R1에서 code-review reception/TDD skill에 따라 3개 지적을 먼저 실제 RED로 고정했다.
시작 2026-09-16 04:44:33 KST, 최종 검증 04:55:13 KST에 seq915 epoch-2
worker/write lease, fencing token, exact4가 유효함을 재확인했다. HEAD/branch 변경 없음.

#### R1 판단 이유와 조치

1. **C14-R1-TARGET-RELABEL**: A의 G0~G3 details를 복사한 뒤 GateResult/Manifest의
   target만 B로 바꾸면 통과했던 결함을 replace/reconstruct 두 변형으로 재현했다.
   `GateEvidenceAuthority`를 host-only in-memory capture registry로 추가했다.
   GateEngine이 host capture 결과의 target·전체 payload를 immutable canonical identity로 발급·보관하며,
   Manifest는 네 gate의 발급 identity 및 원증거 재평가 후에만 host가 별도 발급한다.
   evaluate_manifest와 Release/Apply는 **동일한 host authority 인스턴스**의 등록 기록을 요구한다.
   기존 ID를 붙인 payload 변조, raw DTO, 다른 authority, 등록 없는 manifest,
   단순 hash 재계산과 target relabel을 거부한다. 검증 시 외부 IO·새 증거 등록 없음.
2. **C14-R1-DEFECT-OMISSION**: open blocking defect 뒤 빈/관련 없는 defects 목록을
   재등록하면 duplicate Apply가 부활했던 두 변형을 재현했다.
   target+defect ID별 append-only snapshot 이력을 도입하여 누락은 삭제가 아닌 유지로 처리했다.
   전체 전이를 먼저 검증한 다음 상태를 갱신한다. blocking 하향 변경과 reporter 변경은 거부한다.
   OPEN→ACCEPTED→FIXING→READY_FOR_RETEST→CLOSED를 검증하며 CLOSED에는
   해당 READY 이후 host가 새로 발급한 **동일 target, 해당 defect requirement의 PASS G3**와
   독립 검증자(reporter와 다른 actor, independent=True)가 필요하다.
   오래된/타 대상/타 결함/실패/raw/다른 host evidence는 거부한다.
   재오픈 후 과거 retest 재사용은 거부하고 반환된 history를 변조해도 내부 이력은 보존한다.
   현재 이력은 새 Release와 duplicate Apply에서도 다시 검사한다.
3. **C14-R1-DEPENDENCY-MANIFEST**: requirements-dev.txt/setup.py/setup.cfg 세 RED를 고정했다.
   setup.py/setup.cfg와 requirements[-_.]*.(txt|in)을 보수적 dependency finding 대상으로 확장했다.
   기존 lockfile·manifest 탐지를 유지한다.
4. 추가 집중 검증에서 동일 target이지만 다른 defect requirement의 G3를 사용한 RED 1건을 발견했다.
   retest requirement→defect ID 결박을 추가한 뒤 GREEN을 확인했다.

#### R1 정확한 명령과 결과

| 명령 (동일 canonical workdir) | exit / 실제 결과 |
|---|---|
| python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py -k c14_r1 --disable-warnings -ra | 1 / 8 failed, 108 deselected (0.59s), 의도된 신규 RED |
| python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py -k 'target_relabel or python_dependency or exact_gates or release_and_apply' --disable-warnings -ra | 0 / 30 passed, 86 deselected (0.56s) |
| python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py --disable-warnings -ra | 중간 0 / 116 passed (0.70s) |
| python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py -k 'r1_same_target_unrelated or r1_independent_retest or r1_retest_admission or r1_host_seal or r1_gate_identity or r1_omission_cannot_create' --disable-warnings -ra | 1 / 1 failed, 13 passed, 116 deselected (0.63s), defect requirement 추가 RED |
| python -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_c14.py --disable-warnings -ra | 최종 0 / 130 passed (0.76s) |
| python -B -m pytest -q -p no:cacheprovider tests/verification tests/orchestration --disable-warnings -ra | 1 / 702 passed, 8 skipped, 1 failed, 1 warning (3.32s) |
| python -B -m pytest -q -p no:cacheprovider tests/verification tests/orchestration --ignore=tests/verification/test_c01_l3_independent_acceptance.py --disable-warnings -ra | 0 / 702 passed (2.14s) |
| python -B -m compileall -q packages/verification tests/verification | 0 / 출력 없음 |
| git diff --check | 0 / R1 보고 포함 출력 없음 |

R1 의도된 RED 2회 실행·9 assertion 실패 후 GREEN. 동일 formal 실패 3회는 아니다.
기존 C01_L3_UNAPPROVED_OPENAPI_PATH_DIFF 고유 실패 1건은 R1에서도 한 번 관측되어
본 writer의 관련 전체 실행 누적 3회이며, 새 product failure로 합산하거나 면제하지 않는다.
DB SKIP 8, warning 1, 외부 미검증 범위는 초기 보고와 동일하다.

#### 호환성과 잔여 경계

- 기존 GateResult/EvidenceManifest의 positional 인수 및 pure G0~G3 평가 API를 보존하고
  optional evidence_id/seal_id, GateEngine/ReleaseApprovalService의 keyword evidence_authority를 추가했다.
  보안상 의도된 변경: authority 없이 raw DTO만으로 manifest 완료/Release를 승인하지 않는다.
  기존 raw DTO caller는 host capture→issue_manifest 및 동일 authority 주입으로 이전해야 한다.
  구조적 evaluate_gates는 이전처럼 상태 집계만 하며 승인 경로는 sealed evaluate_manifest를 사용한다.
- 이 identity는 **host registry에 대한 in-memory seal**이지 cryptographic signature, 원격 인증,
  persisted audit 또는 실제 외부 수집 증명이 아니다. host authority 자체를 agent에게 제공하거나
  caller가 선택한 authority를 운영 release service에 주입하는 것은 신뢰 경계 위반이다.
  테스트의 host·human·independent 및 real evidence는 모두 synthetic 계약 fixture다.
- defect 이력/retest 발급 순서는 process-local이다. 실제 분산 저장·재시작 복구 및 외부 독립 Tester
  신원 확인·G3 재실행은 미검증/후속 host adapter 책임이다. 자동 외부 재검증은 수행하지 않는다.
- exact4 외 제품/control mutation, Git stage/commit/push, 외부 IO 없음.
  progress/HANDOFF/events/manifest는 Main 소유로 이번 R1에서도 미갱신이다.
  rollback은 앞 절대로 이번 exact4 hunks만 복구 가능한 patch를 보존한 후 역적용한다.
