# D-05 완료보고 — terminal LearningReview·Reflection

## 1. 판정

`COMPLETED` — developer-primary-d05-r1의 승인 exact6 구현 및 독립 리뷰 R1 재작업을 완료했다.
Main 독립 검토 전 `ACCEPTED` 또는 D Gate 통과를 의미하지 않는다. D-06은 시작하지 않았다.
최신 결과는 아래 4절 R1이며, 2~3절의 52/1184 결과는 재작업 이전 실행 이력이다.

- 작업 위치: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- 시작·완료 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`
- branch: `codex/c09-execution-backends-r1`
- canonical control: seq974. Main이 정정한 terminal 6종 및 human-closed Iteration을 적용했다.
- 시작 status: C-13~C-15, D-01~D-04 및 Main 통제 파일의 기존 dirty/untracked가 있는 보호 worktree.
  clean으로 주장하지 않는다. 해당 변경을 reset/stash/overwrite/delete/stage하지 않았다.
- 완료 확인 시각: `2026-09-16T10:48:09+09:00`. 아래 dual lease 만료 전이다.

## 2. 판단 이유

### 기준 문서와 실행 권위

| 문서 | SHA256 |
| --- | --- |
| Anvil_설계서_v2.md | DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3 |
| Anvil_작업계획서_v1.md | 00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18 |
| Anvil_통합검증매트릭스_v1.md | 289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5 |
| Anvil_테스트계획서_v1.md | 9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644 |
| D-05_WORK_INSTRUCTION.md | E531CB678FC3C365513327570EEE54FFBA53AF4CE12C806ADA9883D442E27DAE |
| D-05_INVOCATION_PROMPT.md | 6D97114D28DEA77ABBCEE9B1A6B78314CE423D258B379A39C90C018520A9219E |

- worker: `worker-lease-d05-r1-20260916-001`
- execution fencing: `d05-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`
- write: `write-lease-d05-r1-20260916-001`
- write fencing: `d05-r1-write-fence-epoch-1-234458b5283abafa`
- 유효 구간: `2026-09-16T10:16:29+09:00` 이상, `2026-09-16T22:16:29+09:00` 미만.
- 재개 전 seq974, 두 token, 수정 WI hash를 재확인했고 완료 시에도 값이 동일했다.
- 최초 WI의 terminal 열거 불일치 때 제품 변경 없이 Main에 보고했고, 정정 후 재개했다.
  이 통제 대기는 정식 구현 실패가 아니다.

### 구현·검증된 계약

- AV-LRN-010/011: SUCCEEDED, FINISHED_WITH_FAILURES, FAILED, CANCELLED, REJECTED, DISCARDED 및
  authenticated human closure가 결박된 Iteration의 review/no-change 경로를 구현했다.
- immutable canonical JSON 저장과 매 호출 detached frozen projection을 사용한다. 동일 terminal subject의
  concurrent create/replay는 한 canonical review에 수렴하며 payload 변경·version 재결박은 거부한다.
- 결정, 사용자 교정, 성공, 실패/복구, 선택 pattern, 제외 대안, 미해결 위험, candidate descriptor를 구분한다.
  candidate와 code/message/evidence_refs를 가진 no-change reason은 상호배타다.
- host attestation은 terminal subject/result/target/time/actor, verification 및 provenance를 결박한다.
  API payload의 terminality/actor/verification/evidence/approval 자가 부여는 거부한다.
- PASS/FAIL/SKIPPED/BLOCKED/ERROR를 개별 집계한다. positive 항목은 성공 terminal 및 실제 PASS evidence key에
  결박한다. CODE_PATTERN을 NEUTRAL로 표시해 non-PASS 제한을 우회하지 못한다.
- D-01 memory, D-02 session/task snapshot, D-03 source, D-04 pattern/reference/anti-pattern의 실제 in-memory
  repository를 통해 ID/version/hash와 scope를 확인한다. source의 license/confidentiality 등 실제 메타데이터를
  상속하며 revoked source와 forged scope/license/hash/version 참조는 신규 review에 사용할 수 없다.
- Reflection은 review hash와 scope, 구조화 개수·상태 요약만 반환하고 원본 evidence body를 복제하지 않는다.
- in-memory enqueue/claim/complete는 단일 job, 발효/만료, epoch, 등록된 exact claim/context와 token을 검증한다.
  오래된 claim, 재구성/강제 변조 claim, 발효 전 complete 및 duplicate complete를 거부한다.
- 기존 D-01~D-04 기능과 API를 포함한 관련 회귀 1,184개가 통과했다.

### 변경 파일과 diff 요약

| exact 경로 | 변경 전 → 후 |
| --- | --- |
| packages/knowledge/__init__.py | 기존 D-01~D-04 export 보존 → D-05 review/job/error export 추가 |
| packages/knowledge/reviews.py | D-05 없음 → immutable review/Reflection, trusted capture, provenance, in-memory job 계약 |
| packages/api/learning_reviews.py | D-05 없음 → host-context create/get/list 및 reason-only 오류 projection |
| tests/knowledge/test_reviews_d05.py | D-05 없음 → terminal/provenance/replay/alias/job/민감값 적대 검증 |
| tests/api/test_learning_reviews_d05.py | D-05 없음 → create/get/list와 authority 자가부여 거부 검증 |
| docs/04_test_reports/D-05_COMPLETION_REPORT.md | 없음 → 이번 실제 RED/GREEN 및 검증 기록 |

위 파일은 현재 Git 기준 untracked인 D 계열에 포함된다. tracked diff만으로 신규 파일 검증을 대체하지 않았다.
기존 memory/snapshots/sources의 SHA256은 각각 D730F3FC46BA374895B87C03580C346772D095C039BD3690094891D53483D1F7,
42B620BC1ADE951D9C9B22327A217BAA62C7C6806096D138DB02D0D86BDC848F,
124DE0727753C6E8785B5E0DDE58F657769FF2F50EC4F030DF0A6BEFBF191121로 보존되었다.

## 3. 조치

### 실행 명령·실제 결과

모든 명령의 cwd는 위 격리 worktree다. PATH의 Python 대신 기존 venv 실행 파일을 명시했다.

1. 최초 의도된 RED:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_reviews_d05.py -k all_terminal --tb=short`

   exit 1 — 6 failed, 23 deselected, 0.16s. fingerprint `D05_REVIEW_CONTRACT_NOT_IMPLEMENTED`.

2. 최소 구현 후 focused:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_reviews_d05.py tests/api/test_learning_reviews_d05.py --tb=short`

   exit 0 — 36 passed, 0.96s.

3. claim 발효 전 및 CODE_PATTERN label 우회 추가 RED:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_reviews_d05.py -k 'before_claim or neutral_label' --tb=short`

   exit 1 — 2 failed, 43 deselected, 0.14s. fingerprint: 발효 전 `STALE_REVIEW_FENCING_TOKEN` 누락,
   NEUTRAL CODE_PATTERN의 `POSITIVE_REVIEW_EVIDENCE_REQUIRED` 누락. 두 원인을 보완했다.

4. 최종 focused — 2번과 동일한 정확한 명령:

   exit 0 — 52 passed, 1.09s. 남은 실패 0.

5. 관련 회귀:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api`

   exit 0 — 1184 passed, 7.82s. skip 0, fail 0.

6. 정적 컴파일:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`

   exit 0, 출력 없음.

7. tracked whitespace 검사: `git diff --check` — exit 0, 출력 없음.
   신규 exact6은 추가로 각 경로에 `git diff --no-index --check -- NUL <path>`를 실행해 검사했다.
   content 차이에 따른 exit 1과 whitespace 오류를 구분하며, 검사 출력은 모두 비어 있다.

의도된 TDD RED는 총 8 test failure이며 3개 fingerprint를 GREEN으로 전환했다. 정식 FAILURE_REPORT 횟수는 0이다.
`git status --short`의 global ignore 경로 permission 경고는 status exit 0의 환경 경고이며 제품 실패로 세지 않는다.

### 미검증·잔여 위험

- 실제 queue worker, DB/HTTP persistence, browser, Provider, network, WSL/Docker/deployment 및 Run orchestration은
  실행하지 않았다. API는 Python adapter 검증이며 실제 HTTP 인증·운영 API 검증이 아니다.
- attest는 D-03과 같은 trusted host control-plane 경계다. 실제 terminal/evidence/human closure를 수집하는 운영
  어댑터는 미연결이며, 메모리 객체를 임의로 조작할 수 있는 hostile host 자체를 격리하는 보안 경계가 아니다.
- memory/snapshot 원본 모델에 없는 license 필드는 임의 생성하지 않는다. source/pattern의 실제 필드는 상속한다.
- 기존 review의 역사 조회/replay는 source revoke 뒤에도 보존되며 신규 review 생성은 live provenance로 차단한다.
- 이력·job·attestation은 프로세스 내 보존만 지원한다. 재시작/다중 프로세스/실제 queue 중복 처리는 미검증이다.
- D-06 candidate 생성·평가·승인·activation/rollback/quarantine은 descriptor 이후의 별도 범위다.
- repository 전체 suite는 실행하지 않았다. 기존 C-01 baseline 실패/DB skip을 이번 관련 회귀의 성공으로 승격하지 않는다.

### Rollback·인계

- Main이 이번 exact6 diff를 보관한 후 새 D-05 파일 5개와 __init__.py의 D-05 export 부분만 역적용한다.
  다른 package, D-01~D-04 exports, 기존 dirty/control 자료는 복구 대상이 아니다. 자동 rollback은 실행하지 않았다.
- stage/commit/push/PR/merge, 원본 D:\tmp worktree 변경, 권한 상승·승인 UI 요청 및 외부 전송은 하지 않았다.
- progress/HANDOFF와 manifest/checker는 Main 소유로 미갱신이다. 다음 조치는 Main의 독립 검토 및 acceptance 판정이다.

## 4. 독립 리뷰 R1 재작업

### 판정

`COMPLETED` — actor/context 소유권 누락과 만료 후 재발급 고착을 RED로 재현하고 보완했다.
최종 focused 99 PASS, knowledge/API 관련 회귀 1231 PASS, compileall 및 diff-check exit 0이다.
Main의 재검토·acceptance는 별도다.

### 판단 이유

- 기존 `_key`의 scope+subject는 canonical 유일성만 보장하고 소유권을 보장하지 않았다. actor-B뿐 아니라 같은 actor의
  새 context도 actor-A의 attestation으로 create/replay/enqueue/claim할 수 있었으며, API가 다른 actor의 이름으로
  원래 Run/Iteration review를 생성했다. 이 재현을 신규 domain/API 테스트로 고정했다.
- canonical subject key는 scope-wide로 유지해 actor별 중복 review를 만들지 않는다. 대신 최초 host admission의
  exact context 객체와 immutable host record(actor/context ID/scope/유효 구간)를 별도 소유권으로 고정했다.
  이후 attestation, create의 두 replay fast path, enqueue/claim/complete는 이 소유권을 먼저 검사한다.
- 같은 actor 문자열만으로는 권한이 같지 않다. 신규 context나 다른 actor의 접근은 `REVIEW_AUTHORITY_MISMATCH`로
  차단한다. get도 같은 guard를 적용하고 list는 해당 exact authority 소유 결과만 투영한다. 명시적 delegation은 없다.
- human closure의 actor/decision/evidence ref/target hash를 canonical review의 immutable `human_closure` 필드에도
  보존하고 hash에 결박했다. capture를 소비할 때 closure actor와 현재 trusted actor를 다시 대조한다.
- attestation JSON에 actor와 context ID를 결박했다. 유효 기간 중에는 동일 capture의 정확한 replay만 허용한다.
  만료 이상 시각에는 동일 owner·payload·terminal·evidence만 새 capture/expiry로 재발급한다.
  payload/terminal/proof/actor/context 충돌은 만료 후에도 거부한다.
- 갱신된 capture의 시작 시각은 canonical replay보다 먼저 검사한다. 갱신 이전 capture 시각이나 이전 expiry 시각으로
  backdate한 create는 `STALE_REVIEW_ATTESTATION`이다. 정확한 만료 시각 재발급과 만료 후 시간 간격이 있는 재발급을
  각각 검증했다. 이미 완성된 역사 review의 정당한 owner replay는 기존 정책대로 만료 후에도 보존한다.
- job의 미발급/만료 capture는 enqueue/claim에서도 거부하며, complete는 original job subject의 issuing authority와
  registered exact claim/token을 각각 검사한다. 거부된 다른 actor의 호출은 owner의 후속 정상 create/complete를 막지 않는다.

### 조치와 검증 증거

재작업 시작 `2026-09-16T11:00:44+09:00`, 종료 확인 `2026-09-16T11:05:33+09:00`.
seq974, WI SHA256 E531CB678FC3C365513327570EEE54FFBA53AF4CE12C806ADA9883D442E27DAE 및 위 dual lease/token을
재확인했다. HEAD/branch는 첫 보고와 동일하다. exact6 중 이번 재작업은 reviews.py, learning_reviews.py,
두 D-05 테스트 및 본 보고서 5개만 수정했으며 __init__.py와 D-01~D-04는 보존했다.

1. R1 RED:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_reviews_d05.py tests/api/test_learning_reviews_d05.py -k r1 --tb=short`

   exit 1 — 38 failed, 6 passed, 52 deselected, 1.81s.
   failure 구분: 28건 cross-authority 소비/조회 허용, 2건 동일 증거 재발급 고착,
   8건 complete/attest의 authority mismatch 전용 reason 미분리. 기존 conflicting proof 거부 6건은 처음부터 PASS였다.
   fingerprints: `D05_R1_SUBJECT_AUTHORITY_NOT_BOUND`, `D05_R1_EXPIRED_CAPTURE_REISSUE_BLOCKED`.

2. 구현 직후 focused:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_reviews_d05.py tests/api/test_learning_reviews_d05.py --tb=short`

   exit 0 — 96 passed, 1.15s. 재발급 시간 간격과 유효 기간 중 동일 proof 갱신 거부 경계 3개를 추가 확인한 뒤,
   같은 정확한 명령으로 최종 exit 0 — 99 passed, 1.26s.

3. 관련 회귀:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api`

   exit 0 — 1231 passed, 9.75s. fail/skip 0.

4. 컴파일:

   `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`

   exit 0, 출력 없음.

5. `git diff --check` — exit 0, 출력 없음.
   보고 갱신 후에도 exact6 각각 `git diff --no-index --check -- NUL <path>`로 untracked whitespace를 확인했다.
   각 exit 1은 NUL 대비 content 차이이며 whitespace 진단 출력은 없다.

review/TDD/verification 스킬에 따라 독립 finding을 실제 호출 재현으로 먼저 고정했고, 단순 actor 문자열 대조가 아닌
exact host authority를 검사하도록 보완했다. 이번 의도된 RED는 정식 실패 재시도 횟수로 세지 않는다.
독립 REWORK R1 기록 및 canonical failure ledger의 최종 분류는 Main 소유다.

실제 queue/DB/HTTP/운영 인증 및 hostile host 격리는 여전히 미검증이다. context가 만료되면 새 context로 암묵적
delegation하지 않으므로, 이후 운영 재인증·소유권 이전은 별도 명시적 계약이 필요하다. D-05에서 이를 우회하지 않는다.
실제 IO/Git/control mutation은 없으며 progress/HANDOFF는 Main 소유로 그대로다.
rollback은 R1의 위 5개 diff만 역적용하거나 최초 보고의 D-05 exact6 rollback을 적용하되,
기존 D-01~D-04 및 타 writer 자료를 보존한다. 자동 rollback은 하지 않았다.
