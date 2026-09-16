# D-06 완료보고 — candidate lifecycle·next-run selection·containment

## 1. 판정

`COMPLETED` — developer-primary-d06-r1의 승인 exact6 구현 및 독립 리뷰 R1 재작업을 완료했다.
Main 독립 검토 전 `ACCEPTED` 또는 D-Learning Gate PASS가 아니다. 후속 package를 시작하지 않았다.
최신 결과는 4절 R1이며, 2~3절의 59/1290은 최초 구현 검증 이력이다.

- cwd: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- 시작/검증 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`
- branch: `codex/c09-execution-backends-r1`
- canonical seq983, D-05 ACCEPTED, D-06 IN_PROGRESS.
- 시작 host 확인: `2026-09-16T11:23:19+09:00`. 최종 검증 확인: `2026-09-16T11:44:21+09:00`.
- Git status는 clean이 아니다. 기존 C-13~C-15/Main 통제 tracked dirty 26개 및 D-01~D-05 등의
  untracked 자료를 보존했다. 이번 D-06 새 파일은 untracked이며 stage/commit/push하지 않았다.

## 2. 판단 이유

### 기준 hash·lease

| 기준 | SHA256 |
| --- | --- |
| Anvil_설계서_v2.md | DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3 |
| Anvil_작업계획서_v1.md | 00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18 |
| Anvil_통합검증매트릭스_v1.md | 289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5 |
| Anvil_테스트계획서_v1.md | 9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644 |
| D-06_WORK_INSTRUCTION.md | 332A07C9DC5A3660A5CEF4736313D31F000BBBDEABC7E618E70AF9BC85CD2836 |
| D-06_INVOCATION_PROMPT.md | 06ED54057A3B41EFBA329F01C9508298E71506A927D5BDC130C8296BEC049BCC |

WI와 prompt는 시작 및 종료 시 SHA256을 직접 재확인했다. 설계서 36.11~36.12, 48.8~48.9, 49.9와
작업계획 D-06, 매트릭스의 직접 검증 AV-LRN-004/005/012/014/027 및 관련 적대 검증을 대조했다.

- worker lease: `worker-lease-d06-r1-20260916-001`
- execution token: `d06-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`
- write lease: `write-lease-d06-r1-20260916-001`
- write token: `d06-r1-write-fence-epoch-1-234458b5283abafa`
- 유효 구간: `2026-09-16T11:18:54+09:00` 이상, `2026-09-16T23:18:54+09:00` 미만.
  mutation 전 두 token과 canonical ACTIVE 상태를 확인했고 작업은 만료 전에 수행했다.

### Main 구현 판단과 호환성 경계

기존 D-05 descriptor에는 USER가 없고 D-02 source enum은 MEMORY/SKILL/HOOK/PROMPT/CODE_PATTERN만
지원한다는 사실을 먼저 보고했다. Main은 기존 D-02/D-05를 수정하지 않고 exact6 안에서 다음을 구현하도록 확정했다.

1. D-05의 지원 8종은 exact review candidate action index/hash에 결박한다. USER는 user_corrections exact
   index/hash, D-01 USER provenance 및 별도 authenticated host human confirmation에 결박하는 예외만 허용한다.
2. 모든 kind는 D-06 immutable next Task/Run activation selection에 원래 kind를 유지해 기록한다.
   D-02 snapshot을 수정하거나 지원하지 않는 kind를 다른 kind로 위장하지 않는다. 실제 runtime 연결은 후속 owner/D-13 미검증이다.

이 판단에 따라 기존 D-01~D-05 구현 파일은 수정하지 않았다. 마지막 확인 SHA256은 다음과 같다.

| 파일 | SHA256 |
| --- | --- |
| packages/knowledge/memory.py | D730F3FC46BA374895B87C03580C346772D095C039BD3690094891D53483D1F7 |
| packages/knowledge/snapshots.py | 42B620BC1ADE951D9C9B22327A217BAA62C7C6806096D138DB02D0D86BDC848F |
| packages/knowledge/sources.py | 124DE0727753C6E8785B5E0DDE58F657769FF2F50EC4F030DF0A6BEFBF191121 |
| packages/knowledge/patterns.py | 9AB92DC1FF5D565B6A58C67C7734B639CF737213D26A5EDA59D87F46AB8D290D |
| packages/knowledge/reviews.py | 67C0D58374300F25F14BAAC6257E71883C133AEDE80DEDC3A1442A33AA2EFE22 |

### 구현·검증 범위

- Candidate는 review ID/version/hash, action 또는 correction index/hash, terminal subject/result, target hash,
  review evidence digest, source roots, inherited provenance와 proposal hash를 immutable JSON으로 고정한다.
  USER는 별도 human confirmation hash도 고정한다.
- USER/MEMORY/CODE_PATTERN/ANTI_PATTERN/SKILL/HOOK/PROMPT/BENCHMARK/ROUTING을 구분하고
  CREATE/PATCH/SPLIT/MERGE/ARCHIVE intent, target scope, confidence, expiry 및 risk/capability delta를 기록한다.
  실제 item 편집·script 실행은 하지 않는다.
- PROPOSED → EVALUATED → AWAITING_APPROVAL → APPROVED → ACTIVE를 state version과 hash-chain event로 기록한다.
  REJECTED/ROLLED_BACK/QUARANTINED는 신규 activation/use를 차단한다. stale expected version과 identity rebind는 거부한다.
- static/security/license/permission/replay/sandbox_pilot/quality/cost/trigger 9종 evidence는 exact target hash를 요구한다.
  PASS/FAIL/SKIPPED/BLOCKED/ERROR를 분리하며 전량 PASS와 baseline 대비 품질·trigger 비하락, 비용 비증가가 필요하다.
  PASS label이 있어도 baseline 회귀는 합격이 아니다.
- Evaluation·human decision은 API에 없는 trusted capture seam에서만 발급한다. 승인에는 exact candidate/version/hash,
  evaluation hash, state hash, actor/context, scope, risk/capability delta, event ref, 발효/만료를 결박한다.
  모든 activation은 사람 승인을 요구하며 trusted_auto는 제공하지 않는다.
- 최초 D-05 issuing actor 및 exact context를 이어받아 candidate 소유권을 고정한다. 같은 actor의 새 context도
  암묵적 delegation으로 취급하지 않는다. 요청 payload의 actor/approval/permission/evidence/trusted_auto는 거부한다.
- Activation은 immutable ID/version/hash, previous activation, approval hash와 NEXT_TASK_OR_RUN을 기록한다.
  같은 승인으로 concurrent activation하면 한 canonical activation에 수렴한다. request ID를 다른 작업에서 재사용하거나
  rollback 후 activation version 번호를 재사용하지 못한다.
- Selection은 실제 D-02 저장 snapshot ID/hash와 session/task/run을 읽어 확인한다. activation 시각보다 이전 또는 같은 시각의
  snapshot과 origin Run은 거부한다. 선택 목록은 한 Run에서 확정 후 확대·재결박할 수 없다.
- Use는 registry의 current activation과 exact selection/hash, 실제 D-02 snapshot/hash를 다시 확인하고
  candidate→review→source 및 activation→selection→snapshot→Task/Run 계보를 남긴다. cached alias가 live 검사를 대체하지 않는다.
- Rollback은 이전 safe activation 또는 BASELINE을 기록하며 affected Run/snapshot과 원인/evidence를 보존한다.
  rollback된 version의 신규 use/replay는 차단한다.
- source revoke/license change/secret exposure는 live provenance 검사에서 파생 MEMORY/SKILL/HOOK 신규 사용을 차단한다.
  CodePattern을 경유한 간접 source도 검증했다. `sync_sources`는 해당 exact authority 소유 candidate 전체를 탐색해
  QUARANTINED와 impact를 기록하며 query에서도 수행한다. 동일 영향은 반복 query로 중복 기록하지 않는다.
- 영향 보고는 pause_required_runs와 REPORT_ONLY_SAFE_POINT_REQUIRED를 반환한다. 과거 review/snapshot/use/audit는
  삭제하거나 수정하지 않는다. 실제 Run 정지는 수행하지 않는다.
- Canonical 저장은 JSON, 출력은 detached deeply frozen snapshot이다. API 출력 dict 변경이 내부 canonical state에 영향을 주지 않는다.

### 변경 exact6와 diff

| 경로 | 변경 전 → 후 |
| --- | --- |
| packages/knowledge/__init__.py | 기존 exports 보존 → CandidateRepository/CandidateError 추가 |
| packages/knowledge/candidates.py | 없음 → candidate/evaluation/human approval/activation/selection/use/containment in-memory 계약 |
| packages/api/learning_candidates.py | 없음 → create/evaluate/request-approval/approve/activate/use/rollback/quarantine/query adapter |
| tests/knowledge/test_candidates_d06.py | 없음 → 실제 D-01~D-05 repository와 적대 lifecycle 검증 |
| tests/api/test_learning_candidates_d06.py | 없음 → API authority 비노출·고위험 Hook 승인/적용/rollback projection 검증 |
| docs/04_test_reports/D-06_COMPLETION_REPORT.md | 없음 → 이번 RED/GREEN·회귀·미검증·rollback 기록 |

## 3. 조치

### 정확한 실행 명령·exit·결과

모든 명령 cwd는 위 격리 worktree다. Python은 기존 venv 실행 파일을 명시했다.

1. 초기 테스트 import 단계:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_candidates_d06.py -k all_review_action --tb=short`

   exit 1 — 8 setup errors, 29 deselected, 0.36s. `D06_CANDIDATE_LIFECYCLE_MISSING`.
   import만 실패한 상태와 실제 계약 실패를 분리하기 위해 최소 stub을 추가하고 동일 명령을 다시 실행했다.

2. 의도된 lifecycle RED — 1번과 같은 정확한 명령:

   exit 1 — 8 failed, 29 deselected, 0.36s. fingerprint `D06_CANDIDATE_LIFECYCLE_NOT_IMPLEMENTED`.

3. 최소 구현 focused:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_candidates_d06.py tests/api/test_learning_candidates_d06.py --tb=short`

   exit 0 — 43 passed, 1.28s.

4. 추가 RED:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_candidates_d06.py -k 'foreign_request or version_reuse or persists_separate' --tb=short`

   exit 1 — 3 failed, 46 deselected, 0.28s. fingerprints: activation replay의 다른 operation request ID 소비,
   rollback 후 version 번호 재사용, USER 별도 confirmation hash 미보존. 각각 보완했다.

5. 전체 source 영향 동기화 RED:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_candidates_d06.py -k 'source_sync' --tb=short`

   exit 1 — 1 failed, 51 deselected, 0.25s. fingerprint `D06_SOURCE_SYNC_MISSING`. host notification/query 동기화 경계를 구현했다.

6. 최종 focused — 3번과 같은 정확한 명령:

   exit 0 — 59 passed, 1.55s. 중간 GREEN 55 passed/1.39s 및 58 passed/1.46s 뒤 API lifecycle까지 검증했다.

7. 관련 회귀:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api`

   exit 0 — 1290 passed, 10.03s. fail 0, skip 0. D-01~D-05 및 관련 API 유지 확인.

8. 컴파일:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`

   exit 0, 출력 없음.

9. `git diff --check` — exit 0, 출력 없음.
   신규 파일을 포함한 exact6은 추가로 각 경로에 `git diff --no-index --check -- NUL <path>`를 실행했다.
   NUL 대비 content 차이 exit 1과 whitespace 오류를 구분하며 진단 출력은 모두 없다.

의도된 RED 12 test failures와 초기 import setup 8 errors를 구분한다. 모두 현재 GREEN으로 전환했다.
정식 FAILURE_REPORT는 제출하지 않았으며 내부 TDD/도구 문제는 정식 동일 실패 횟수가 아니다.
rg.exe Windows 연결 오류는 Select-String으로 대체했다. Git global ignore permission 경고는 read-only status의
환경 경고이며 제품 테스트 실패가 아니다. 위 구현은 승인 계획 실행·TDD·완료 전 검증 스킬의 증거 순서를 따랐다.

### 실제 미검증·잔여 위험

- 모든 증거는 in-memory domain/API projection 및 fixture 계약이다. 실제 Skill/Hook runtime, prompt/model routing,
  DB/HTTP/queue/browser/Provider/network/WSL/Docker/deployment, 외부 replay·sandbox pilot/benchmark는 실행하지 않았다.
- capture_*는 host가 인증과 evidence 수집을 이미 수행했다고 보는 trusted in-memory adapter다. 운영 인증 제공자,
  human event 수집, evaluator 실행·봉인 및 hostile host 격리는 후속 연결·검증 대상이다.
- D-06 selection은 Main이 지정한 sidecar 기록이며 기존 D-02 snapshot에 activation을 삽입하지 않는다.
  runtime_connected=False다. 다음 실제 context/Skill/Hook/Prompt 소비를 증명하는 AV-LRN-013/D-13 증거가 아니다.
- source 변경 notification은 host가 sync_sources를 호출하거나 query/사용 경계에서 동기화한다. 신규 use는 live check로
  즉시 fail-closed하나 실제 event bus subscriber/queue worker는 없다. 진행 Run 중단은 영향 보고까지만 제공한다.
- state와 idempotency/ownership은 프로세스 메모리 경계다. 재시작 복원, 다중 프로세스 동시성 및 실제 분산 transaction은 미검증이다.
- exact context가 만료되면 다른 context로 암묵적 delegation하지 않는다. 운영 재인증·권위 이전은 후속 명시적 계약이 필요하다.
- scope 확대를 현재 host/review scope 밖으로 실행하지 않는다. intent와 capability delta는 검토 대상 metadata이며,
  실제 CREATE/PATCH/SPLIT/MERGE/ARCHIVE 프로그램과 trusted_auto는 후속 D-07~D-11 범위다.
- repository 전체 suite 및 D-Learning Gate는 실행/판정하지 않았다. 기존 C-01 baseline failure/DB skip을 이번 결과로 승격하지 않는다.

### Rollback·Main 인계

- Main이 이번 diff를 보존한 후 새 D-06 파일 5개와 __init__.py의 Candidate export 2개만 역적용한다.
  D-01~D-05, Main 통제, 기존 dirty 자료는 rollback 대상이 아니다. 자동 rollback은 하지 않았다.
- Git stage/commit/push/PR/merge, control/WI/progress/HANDOFF 수정, 권한 상승과 승인 UI 요청, 원본 D:\tmp
  worktree mutation 및 외부 전송은 하지 않았다.
- progress/HANDOFF/manifest 갱신은 Main 소유로 남겼다. 다음 조치는 Main 독립 검토 및 acceptance 판정이다.

## 4. 독립 리뷰 R1 재작업

### 판정

`COMPLETED` — 실행 중 Run에 뒤늦게 selection을 넣는 경로와 격리된 slot head의 replacement 고착을 보완했다.
최종 focused 75 PASS, knowledge/API 관련 회귀 1306 PASS, compileall/diff-check exit 0이다. Main 재검토는 별도다.

### 판단 이유

- 기존 selection은 snapshot이 activation 뒤에 생성됐는지만 검사했다. 실제 selection 호출이 30분 뒤여도 통과하고
  created_at을 snapshot 시각으로 기록하는 문제가 재현됐다.
- 새 `RunStartBoundary`는 host만 발급하는 exact capability다. registry의 동일 객체·canonical hash·issuing context와
  actor를 요구한다. 재구성 DTO, 강제 변조 객체, 다른 actor 및 같은 actor의 다른 context로는 소비할 수 없다.
- `capture_run_start`는 실제 저장된 D-02 snapshot/run/task/hash, 선택할 exact activation ID/version/hash 목록,
  host actor/context/scope, Run 시작 시각과 host 관측 시각을 결박한다. API에 capture 경로를 열지 않았다.
- Run 시작 시각은 실제 D-02 snapshot의 created_at이고, 발급·소비는 `[start, start+5초)` startup window에 제한한다.
  만료 뒤 재발급하거나 Run당 두 번째 boundary를 만들 수 없다. 선택은 one-shot으로 소비하며 동일 요청 재선택도
  `RUN_START_CONSUMED`로 거부한다. canonical selection을 사용하는 register-use의 중복 수렴 계약은 유지한다.
- host clock의 기본값은 UTC 현재 시각이다. 테스트만 trusted constructor에서 제어 clock을 주입한다.
  payload의 now는 window를 늘리거나 host clock보다 미래가 될 수 없고, clock 역행도 거부한다.
  30분 뒤에 과거 now를 공급해도 실제 관측 시각이 만료를 판정한다. selection.created_at은 실제 host 관측 시각이며
  run_started_at을 별도로 보존한다. boundary 발급 전·미래·late·정확한 expiry·cross-run·snapshot hash 재결박을 검증했다.
- register-use는 소비 완료된 정본 boundary→selection registry 연결을 요구한다. selection 이전 시각의 use와
  다른 selection/hash를 통한 적용을 거부한다. 원래 D-02 snapshot은 수정하지 않는다.
- source 격리 및 explicit rollback/quarantine은 먼저 해당 version의 containment state를 기록한 뒤, 같은 lock 안에서
  slot의 가장 높은 version부터 live safe activation을 탐색한다. 기존 사람 승인을 받은 ACTIVE activation만 복원하며
  없으면 BASELINE으로 head를 해제한다. 아직 activation이 발급되지 않은 APPROVED 후보를 자동 활성화하지 않는다.
- 격리된 head를 먼저 query하지 않아도 replacement create가 live head를 검사·복구한다. 별도 정상 source/review를 가진
  같은 kind+target replacement의 생성·평가·승인·활성을 허용하고 오염된 cached activation의 재사용은 차단한다.
- pending proposal의 격리가 같은 scope의 다른 authority가 소유한 current head를 제거하지 못하도록 추가 guard를 넣었다.
  이 경우 `UNCHANGED_FOREIGN_AUTHORITY`를 기록하고 타 authority의 slot은 보존한다.
- 기존 affected Run/snapshot/use/provenance/event와 activation version counter는 삭제·역기록하지 않는다.

### 조치·검증 증거

재작업 시작 `2026-09-16T11:56:58+09:00`, 최종 검증 확인 `2026-09-16T12:05:40+09:00`.
seq983, 기존 WI hash 332A07C9DC5A3660A5CEF4736313D31F000BBBDEABC7E618E70AF9BC85CD2836,
동일 dual lease/token 및 23:18:54 KST 만료를 확인했다. HEAD/branch는 최초 보고와 동일하다.
exact6 중 R1은 candidates.py, knowledge __init__.py, D-06 두 테스트, 본 보고서만 수정했다.
API 구현과 D-01~D-05/control 파일은 변경하지 않았다.

1. 독립 finding RED:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_candidates_d06.py -k r1 --tb=short`

   exit 1 — 3 failed, 52 deselected, 0.42s.
   fingerprints: `D06_R1_LATE_RUN_SELECTION_ALLOWED` 1건, `D06_R1_QUARANTINED_HEAD_BLOCKS_REPLACEMENT` 2건
   (safe previous 유/무).

2. Run-start capability·window·one-shot과 head 복원 구현 후 focused:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_candidates_d06.py tests/api/test_learning_candidates_d06.py --tb=short`

   exit 0 — 74 passed, 2.95s.

3. cross-authority slot 복원 추가 RED:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_candidates_d06.py -k other_authoritys --tb=short`

   exit 1 — 1 failed, 67 deselected, 0.36s. fingerprint `D06_R1_FOREIGN_SLOT_HEAD_WITHDRAWN`.
   타 authority의 current head 보존 guard를 보완했다.

4. 최종 focused — 2번과 동일한 정확한 명령:

   exit 0 — 75 passed, 1.90s. fail/skip 0.

5. 관련 회귀:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api`

   exit 0 — 1306 passed, 11.05s. fail/skip 0.

6. 정적 컴파일:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`

   exit 0, 출력 없음.

7. `git diff --check` — exit 0, 출력 없음. 보고 갱신 뒤에도 exact6 각각
   `git diff --no-index --check -- NUL <path>`를 실행했다. 각 exit 1은 content 차이이며 whitespace 진단은 없다.

리뷰 재현을 먼저 확인한 TDD와 완료 전 실제 검증 원칙을 적용했다. 의도된 R1 RED 4건은 내부 테스트 과정이며
정식 동일 실패 횟수로 추가하지 않는다. 독립 REWORK의 canonical ledger 판정은 Main 소유다.

실제 Run-start event 전달·scheduler 연결, 운영 clock/인증 adapter 및 안전 지점 정지는 여전히 후속 통합 미검증이다.
기본 clock과 exact boundary의 in-memory fail-closed 동작을 실제 orchestration 실행 증거로 승격하지 않는다.
기존 sidecar/runtime_connected=False·DB/HTTP/queue 미검증 경계도 유지한다.

Rollback은 R1의 위 5개 경로 diff만 역적용하거나 최초 D-06 exact6 역적용 범위를 사용하되 타 package/control을 보존한다.
자동 rollback, Git mutation, 외부 IO, progress/HANDOFF 갱신은 하지 않았다. 다음 조치는 Main 재검토다.
