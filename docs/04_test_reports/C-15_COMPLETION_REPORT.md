# C-15 완료보고 — current-baseline synthetic E2E REWORK R1

## 판정

`COMPLETED` — C-15 독립 리뷰 R1의 projection alias 1건 보완 및 재검증 완료.
Main 독립 검토·Tester 판정은 아직 이 보고의 주장이 아니다.

- R1 최종 C-15: **40 passed**.
- R1 확대 관련 회귀: **910 passed, 9 skipped, 1 failed, 1 warning**. 전체 PASS가 아니다.
- 실패는 기존 C-01 OpenAPI snapshot 1건, SKIP은 기존 C-01 DB 8건과 leases PostgreSQL 18 DSN 1건.
- compileall·diff-check PASS. Git stage/commit/push·외부 IO 없음.
- 독립 PASS 후 C-15가 ACCEPTED되면 **DIR-2 / DIR_HOLD** 인계 대상이다.
  C Gate·D Phase·다음 개발을 시작하지 않으며, 통제 갱신은 Main 소유다.

### Main 독립 재검증 및 최종 Reviewer 판정

- Main 재검증: C-15 **40 passed**; 확대 회귀 **910 passed, 9 skipped, 1 failed**;
  기존 C-01 snapshot 제외 **910 passed, 1 skipped**; compileall·diff-check PASS.
- 최종 독립 Reviewer: **ACCEPT**, Blocking **0**, Important **0**.
- R0의 blocking 1건은 projection이 내부 sealed manifest를 alias하던 문제였다.
  R1은 manifest·gate·중첩 details를 내부 canonical state와 분리한 snapshot으로 반환한다.
- Reviewer 적대 재현에서 반환 snapshot 강제 변조 뒤에도 내부 manifest hash·seal 검증이 유지되고,
  후속 Release → 별도 Apply Approval → Apply가 정상 완료됐다.
- 실제 Provider·DB·HTTP·browser/UI·WSL/Docker/network/deployment 및 영속 복구는 여전히 미검증이다.

## 판단 이유

### 1. 현재 권위와 시작 상태

- canonical worktree: `D:\tmp\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- 시작/종료 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`
- canonical sequence: 924. C-15 시작, C-14 seq920 acceptance 기록 확인.
- 시작 상태: dirty. 기존 C-13/C-14 제품·보고·통제와 untracked manifest/digest를 그대로 보존했다.
- writer: `developer-primary-c15-r1`
- worker lease: `worker-lease-c15-r1-20260916-001`
- execution fence: `c15-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`
- write lease: `write-lease-c15-r1-20260916-001`
- write fence: `c15-r1-write-fence-epoch-1-234458b5283abafa`
- lease: 2026-09-16 05:15~17:15 KST. 시작 host 05:23:10, 최종 검증 단계 05:42 이후로 유효시간 내.
- 쓰기는 parent/canonical의 아래 exact4만 사용했다. WI의 더 넓은 glob을 확대 적용하지 않았다.
- 과거 `codex/c15-e2e`, HEAD `75a121c...`, `8/73 passed` 보고는 이번 증거가 아니며 대체했다.

| 기준 문서 | SHA-256 |
|---|---|
| 설계서 v2 | DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3 |
| 작업계획서 v1 | 00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18 |
| 통합검증매트릭스 v1 | 289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5 |
| 테스트계획서 v1 | 9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644 |
| C-15_WORK_INSTRUCTION.md | 598D9056681B28A736E9BC9548E343CFE9EB84DF1234299802529DE57F75AFC4 |
| C-15_INVOCATION_PROMPT.md | 71342EC42F9700304DA6DB6EFE169CE497241FDCA183FB231783F13CD728D89F |

### 2. 변경 파일·이유·diff

| exact 경로 | 변경 전 → 변경 후 | numstat |
|---|---|---|
| packages/e2e/harness.py | 오래된 단순 시나리오 → 현재 C11 계획 승인, C13 sealed takeover, C14 sealed Gate/Release/별도 Apply, API fencing/auth, detached immutable projection | +282/-57 |
| packages/e2e/__init__.py | 기존 exports 유지 + SyntheticHumanContext | +2/-1 |
| tests/e2e/test_synthetic_e2e.py | 기존 8 시나리오를 현 host 승인 계약으로 교정 + API/적대·R1 alias 검증 | +205/-10 |
| docs/04_test_reports/C-15_COMPLETION_REPORT.md | 과거 보고 → 이번 기준선·검증·미검증·DIR 인계 | 자체 변경량 생략 |

정확한 diff:
`git diff -- packages/e2e/harness.py packages/e2e/__init__.py tests/e2e/test_synthetic_e2e.py docs/04_test_reports/C-15_COMPLETION_REPORT.md`.

### 3. 조합한 현재 계약과 시나리오

- C-02~04: DelegationPacket의 permission/context/egress binding과
  DeveloperLifecycleService의 Single Developer, request_checkpoint, pause/resume, 실제 pure runner 결과를 사용한다.
  조기 TechnicalValidation PASS 이벤트를 제거하고 완료 poll·Gate 뒤에만 기록한다.
- C-05~07/C-12: ResultEnvelope·failure fingerprint·FailureLedger를 사용한다.
  run별 attempt/lineage를 분리하여 실제 1·2·3회 유효 receipt를 만든다.
  기존 outcome resolver의 DB/outbox 통합 실행을 새로 수행한 것은 아니다.
- C-09/13 lease/tool 경계: start에서 현재 worker/write를 한 번 발급한다.
  API mutation은 양 token을 먼저 검사한다. C-13 takeover에서 현재 lease를 재사용하며
  동일 run/WI/diff/test/checkpoint/failure reports를 host의 sealed TakeoverEvidenceRegistry에 등록한다.
  세 번째 유효 실패 뒤 worker/write/tool이 회수되고 늦은 complete는 STALE_FENCING_TOKEN으로 차단된다.
- C-11: request analysis → canonical WorkPlan/IterationPlan/WorkInstruction → ExecutionPlan을 생성한다.
  Main authority record와 현재 execution fence, 별도 human Design/WorkPlan/WI/ExecutionPlan 승인 전에는
  WRITE Step schedule이 거부된다. Approval은 synthetic host가 등록한 human context로만 발급한다.
- C-14: G0 six observations, detected StaticTool/CommandEvidence, G2 DiffReview/LLM checks,
  G3 TestEvidence를 GateEvidenceAuthority로 발급하고 sealed manifest를 사용한다.
  현재 ProductValidation/DefectAssessment·ReleaseDecision·독립 ApplyApprovalRecord 서비스와 연결한다.
  private release._decisions에 접근하던 코드는 반환된 등록 decision handle 보관으로 바꿨다.
- 실제 fixture 기능: **메모리 문자열 hello → HELLO**. original과 candidate를 분리하며,
  Release만으로 original은 바뀌지 않는다. 별도 Apply 승인 후 딱 한 번 original을 바꾸고,
  discard는 candidate를 폐기하며 original을 보존한다. 실제 파일 patch는 하지 않는다.
- API-shaped endpoints: POST /runs, /runs/approve-plan, /runs/complete, /runs/pause,
  /runs/resume, /runs/release, /runs/reject, /runs/approve-apply, /runs/apply,
  /runs/discard, /runs/takeover; GET /runs/projection.
  HTTP server/실제 API 요청이 아닌 in-process request dispatcher다.
- POST mutation은 dual fencing→target→필요 시 manifest hash→phase/approval 순서로 검사한다.
  request ID replay는 409 DUPLICATE_REPLAY, 재적용은 INVALID_PHASE이며 apply_count는 1을 유지한다.
- human identity는 payload authenticated/actor_id가 아니라 **host transport context**다.
  다른 harness의 identity, self-auth payload, 등록 후 actor relabel도 거부한다.
- projection events/body/fixture state는 recursive immutable snapshot이며 to_dict는 분리된 JSON 자료다.

| 원 지시 시나리오 | 검증 |
|---|---|
| 정상 요청→검증→ProductValidation→Defect→Release→독립 Apply | 직접 helper와 API happy journey, original 보존·apply_count=1 |
| 중단·재개 | canonical checkpoint, paused complete 거부, 동일 target resume 후 완료 |
| 거부·폐기 | authenticated REJECT 후 discard, original 보존, 후속 complete 거부 |
| 3회 takeover | FailureLedger 3 + sealed bundle + lease/write/tool 0 + 늦은 token 거부 |
| stale target/manifest/evidence/fencing | exact reason, phase/original 보존, 2 token 각각 교차 run 거부 |
| incomplete validation/open defect | Release 부적격 거부, Apply 전 최신 incomplete state 거부 |
| duplicate/cross-run/foreign authority | request replay, apply replay, 타 run evidence relabel, 타 host evidence/human/token 차단 |

직접 matrix: AV-AGT-031, AV-FLOW-004/021은 이 synthetic 단일 worker/API 흐름으로 검증했다.
AV-STAT-041/042는 C-15 ACCEPTED 이후 DIR-2 운영 통제 책임이다. 이 harness가
DIR Owner direction·독립 Tester PASS를 생성하거나 대신 판정하지 않는다.

### 4. synthetic 경계와 호환성

**외부 운영 PASS 아님.** API/projection은 항상 synthetic=true,
acquisition_mode=synthetic-fixture, external_io_count=0, Provider/DB/browser/deployment 미검증을 표시한다.

C-14의 Release 서비스는 real-contract records만 허용한다. 이를 약화하거나 C-14 파일을 수정하지 않았다.
C-15 내부 host는 **합성 관측값으로 real-contract 모양을 모델링한 sealed records**를 만든다.
따라서 내부 manifest/TestEvidence의 mode=real은 운영 수집 사실이 아니라 계약 분기 테스트 데이터다.
environment는 ENV-SYNTHETIC, evidence refs는 synthetic:...이며,
G3 ui 키는 브라우저가 아닌 projection surrogate다. 이 내부 manifest를 외부 release 증거로
수출·승격하면 안 된다. 실제 독립 Tester/사람 identity도 이 실행에서는 fixture-host simulation이다.

C-01 Provider/Native adapter, C-08 실제 repository scan, C-09 worktree/Docker, C-10 실제 patch/execute,
DB resolver/outbox, 실제 UI·HTTP·배포를 호출하거나 검증했다고 주장하지 않는다.
이전 순수 계약을 조합한 C-15의 범위이며 C-01~14 모든 실제 runtime 재검증의 대체가 아니다.

기존 direct helper 이름을 보존하되 보안상 필요한 변경:
start는 mutable 내부 Run 대신 projection을 반환하며, complete는 계획 승인,
release/reject/approve_apply는 host-admitted human을 요구한다.
API 승인 context는 payload가 아닌 별도 human keyword로 전달한다.
고정 clock을 넣은 run_synthetic_e2e는 매번 동일 projection을 반환하며,
token은 harness별로 격리하고 공개 projection에 token 원문을 넣지 않는다.

## 조치

### 5. 초기 제출 TDD·검증 명령 및 실제 결과 (R1 이전)

모든 명령 workdir: `D:\tmp\anvil-main-integration`.
로컬 Python 테스트/compileall만 실행했으며 실제 외부 실행 권한으로 확대하지 않았다.
TDD skill에 따라 부족 계약 RED를 먼저 확인했고, 관련 회귀의 실패/SKIP을 숨기지 않았다.

| 순서 | 정확한 명령 | exit / 결과 |
|---|---|---|
| 기존 baseline | python -B -m pytest -q -p no:cacheprovider tests/e2e/test_synthetic_e2e.py --disable-warnings -ra | 1 / 8 failed (0.64s), C13 sealed registry 초기화 누락 |
| 초기화 분리 | 같은 focused 명령 | 1 / 5 failed, 3 passed (0.62s), old manifest mode 및 takeover 미연결 |
| 신규 RED | python -B -m pytest -q -p no:cacheprovider tests/e2e/test_synthetic_e2e.py -k c15_ --disable-warnings -ra | 1 / 11 failed, 8 deselected (0.67s), 조기 PASS·fencing·가변 projection |
| 조합 중간 | focused 전체 명령 | 1 / 7 failed, 12 passed (0.65s), 계획 승인/host human fixture 교정 및 checkpoint API 불일치 |
| 초기 GREEN | focused 전체 명령 | 0 / 19 passed (0.50s) |
| 적대 보강 중간 | focused 전체 명령 | 1 / 2 failed, 34 passed (0.86s), 두 run을 동시에 start한 테스트 fixture 오류 |
| fixture 교정 GREEN | focused 전체 명령 | 0 / 36 passed (0.61s), 선행 Developer 완료 뒤 cross-run 검증 |
| host identity RED | python -B -m pytest -q -p no:cacheprovider tests/e2e/test_synthetic_e2e.py -k relabelled_after_admission --disable-warnings -ra | 1 / 1 failed, 36 deselected (0.54s), 등록 actor 변조가 성공 응답 반환 |
| 최종 focused | python -B -m pytest -q -p no:cacheprovider tests/e2e/test_synthetic_e2e.py --disable-warnings -ra | 0 / 37 passed (0.61s) |
| 확대 회귀 1 | python -B -m pytest -q -p no:cacheprovider tests/e2e tests/verification tests/orchestration tests/planning tests/leases --disable-warnings -ra | 1 / 906 passed, 9 skipped, 1 failed, 1 warning (4.02s) |
| 분리 회귀 | python -B -m pytest -q -p no:cacheprovider tests/e2e tests/verification tests/orchestration tests/planning tests/leases --ignore=tests/verification/test_c01_l3_independent_acceptance.py --disable-warnings -ra | 0 / 906 passed, 1 skipped, 1 warning (3.47s), 최종 host identity 보완 직전 |
| 최종 확대 회귀 | python -B -m pytest -q -p no:cacheprovider tests/e2e tests/verification tests/orchestration tests/planning tests/leases --disable-warnings -ra | 1 / 907 passed, 9 skipped, 1 failed, 1 warning (3.61s) |
| compileall | python -B -m compileall -q packages/e2e tests/e2e | 0 / 출력 없음, 최종 보완 후 재실행 |
| diff-check | git diff --check | 0 / 출력 없음, 보고서 포함 최종 확인 |

### 6. 오류 fingerprint·횟수·기존 회귀

- C15_CURRENT_CONTRACT_DRIFT: 최초 8건은 같은 C13 초기화 누락 root.
  분리 뒤 old acquisition_mode 및 takeover 연결 부족 확인. 이번 코드/테스트로 보완했다.
- C15_API_ADMISSION_SNAPSHOT: 신규 RED 11건. 양 fence·target·immutable snapshot 및 조기 PASS 제거로 GREEN.
- C15_CHECKPOINT_API: LifecycleProjection.delivered_commands 오인 2건 관측.
  current request_checkpoint API로 교체했다.
- C15_TEST_SINGLE_DEVELOPER_ORDER: 적대 fixture가 두 nonterminal session을 동시에 시작하여 2건 실패.
  이는 production의 Single Developer 차단이 정상 동작한 것이며, production 제한을 완화하지 않고
  선행 세션을 complete한 뒤 교차 run token을 검사하도록 테스트를 수정했다.
- C15_HUMAN_CONTEXT_RELABEL: 신규 RED 1건, actor_id immutable 등록 snapshot과 object identity를 함께 비교하여 해결.
- Main의 mid-edit read-only 관측은 진행 중 RED이며 formal failure가 아니라는 지시를 유지한다.
  초기/중간 결과를 동일 formal 실패 3회로 계산하지 않았다. 이번 제출 후 독립 판정은 대기다.
- 기존 `C01_L3_UNAPPROVED_OPENAPI_PATH_DIFF`: 최종 관련 회귀에서 1건.
  C01 snapshot 목록에 없는 현재 C04 delegation GET/steer/cancel/resume 경로 4개.
  C-15 작업 중 전체 실행 2회에서 같은 1개 실패 관측. 해당 API/테스트 파일은 수정하지 않았다.
- SKIP 8: tests/verification/test_c01_l3_independent_acceptance.py:195,
  ANVIL_TEST_DATABASE_URL 미설정.
- 추가 SKIP 1: tests/leases/test_worker_write_fencing.py:62,
  isolated PostgreSQL 18 DSN 미설정. 실제 DB 검증 아님.
- warning 1은 회귀 요약에서 관측; 상세 원인 미확정. 숨기기 위한 코드/환경 변경 없음.
- read-only 탐색 1회에 존재하지 않는 옛 test 파일명 조회가 있었으며,
  현재 test_c11_planner/test_c11_admission 파일로 확인했다. 제품 실패 아님.
- Git ignore/.pytest_cache 권한 warning은 별도 환경 경계. 실제 저장소 동작 장애로 단정하지 않았다.

### 7. 보존·미검증·rollback·인계

- 기존 C-13/C-14 dirty/untracked, progress/HANDOFF/events/checker/tooling/WI/manifests/digests를 보존했다.
  구현자는 exact4 외 어떤 파일도 쓰거나 stage/restore하지 않았다.
- progress/HANDOFF 갱신 없음: **Main 소유**.
  seq924, dual lease, C14 acceptance는 읽기만 했다. historical event/hash 수정 없음.
- 실제 Provider·DB·HTTP server/API·browser/UI·WSL/Docker·network·deployment·Secret manager 미실행.
  실제 원본 repository patch, 실제 외부 사용자 승인, 분산 persistence/recovery도 미검증이다.
- 신규 패키지·설치·agent·병렬 writer·Git stage/commit/push/PR/merge 없음.
- rollback: 먼저 Main이 exact4의 현재 diff를 복구 가능한 patch/checkpoint로 보존한 뒤 이번 hunks만 역적용한다.
  전체 worktree reset/stash/삭제 금지. 기존 C-13/C-14/control 변경은 되돌리지 않는다.
  외부 side effect가 없어 DB/배포 rollback은 해당 없음.
- 다음 안전 행동: Main 독립 Spec/Quality·Tester 검토 및 기존 baseline 실패 분리 판정.
  C-15 ACCEPTED 뒤 DIR-2 / DIR_HOLD. 신산님 direction 없이 C Gate·D-01을 시작하지 않는다.

### 8. 독립 리뷰 REWORK R1 — projection alias

판정: `COMPLETED`(재작업 완료, Main 재검토 대기).
독립 리뷰 Blocking 1 / Important 0에 대해 R1 formal REWORK 1회를 수행했다.
2026-09-16 05:51:59 KST에 seq924 및 기존 epoch-1 dual lease/token/exact4가 유효함을 확인했고,
05:54:03 KST에 최종 검증을 마쳤다. branch·HEAD·통제 상태 변경 없음.

판단 이유: E2EProjection은 events/body는 복제했지만 evidence_manifest에는 run.manifest와 동일한
객체를 담았다. frozen dataclass라도 object.__setattr__로 반환 manifest/environment나 GateResult의
target/details를 바꾸면 내부 canonical hash가 달라지는 alias였다.
fingerprint: **C15-R1-PROJECTION-MANIFEST-ALIAS**.

조치:

- E2EProjection.__post_init__에서 EvidenceManifest를 replace로 재생성한다.
  현재 EvidenceManifest 생성자의 GateResult 복제 및 details recursive deep-freeze 계약을 재사용한다.
  C-14 코드는 수정하지 않았고 hash/seal 값은 원래 canonical 값 그대로 유지한다.
- manifest, gate, 중첩 details 3변형을 먼저 RED로 고정했다.
  snapshot과 내부 manifest/gate/details/assertions의 identity가 서로 다르고 nested checks가 immutable임을 검사한다.
- 반환 snapshot 강제 변조 후 내부 manifest hash/seal, GateEngine 검증, 후속 Release→별도 Apply 승인→Apply가
  모두 유지됨을 각 변형에서 확인했다. 원래 승인·fencing·synthetic 경계 변경 없음.
- R1은 harness.py 4줄과 alias 회귀 테스트, 본 보고만 보완했다.
  __init__.py의 이전 변경은 보존했으며 exact4 외 경로 mutation 없음.

| 정확한 명령 (동일 canonical workdir) | exit / 실제 결과 |
|---|---|
| python -B -m pytest -q -p no:cacheprovider tests/e2e/test_synthetic_e2e.py -k r1_projection_manifest --disable-warnings -ra | 1 / 3 failed, 37 deselected (0.55s), 의도된 RED |
| python -B -m pytest -q -p no:cacheprovider tests/e2e/test_synthetic_e2e.py --disable-warnings -ra | 0 / 40 passed (0.68s) |
| python -B -m pytest -q -p no:cacheprovider tests/e2e tests/verification tests/orchestration tests/planning tests/leases --disable-warnings -ra | 1 / 910 passed, 9 skipped, 1 failed, 1 warning (3.68s) |
| python -B -m pytest -q -p no:cacheprovider tests/e2e tests/verification tests/orchestration tests/planning tests/leases --ignore=tests/verification/test_c01_l3_independent_acceptance.py --disable-warnings -ra | 0 / 910 passed, 1 skipped, 1 warning (3.49s) |
| python -B -m compileall -q packages/e2e tests/e2e | 0 / 출력 없음 |
| git diff --check | 0 / R1 보고 포함 출력 없음 |

의도된 RED 1회 실행/3변형 assertion 실패 → GREEN. 같은 formal 오류 3회가 아니다.
기존 C01_L3_UNAPPROVED_OPENAPI_PATH_DIFF 1건, C01 DB SKIP 8건, lease PG18 SKIP 1건 및 warning은
별도 baseline으로 유지하며 통과로 승격하지 않는다. C-15 작업의 관련 전체 실행 누적 3회에서 같은 고유 실패 1건이다.

rollback: R1의 snapshot 생성 4줄과 추가 회귀/report hunks만 복구 가능한 patch 보존 후 역적용한다.
기존 C-13/C-14/C-15 초기 구현·control dirty를 reset/stash/삭제하지 않는다.
실제 Provider/DB/browser/network/deployment는 미실행, Git mutation 및 progress/HANDOFF 갱신 없음.
Main 독립 재검토 이후 C-15 ACCEPTED→DIR-2 인계 경계는 유지한다.
