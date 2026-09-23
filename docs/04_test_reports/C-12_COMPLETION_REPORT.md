# C-12 완료보고 — Failure lineage·fingerprint·유효 횟수 집계 R7

## 1. 판정

- 결과 상태: `COMPLETED`
- Work Package / WorkInstruction: `C-12` / `WI-C-12-20260915-001`
- 담당: `developer-primary-c12-r1`
- branch / 현재 control HEAD:
  `codex/c09-execution-backends-r1` /
  `4112a48bcd47619a582d480399d8015bf41df007`
- 승인 제품 기준선: `c4335de145631804b7b7eb6e7c0689f66e2964d7`
- 최초 C-12 시작 HEAD: `4041fb51984786883609288a2f408b005bc964b0`
- control 관계: `4112a48b`는 `4041fb51`의 자식이다.
- 최초 시작 상태: `git status --short` exit 0, tracked/untracked 출력 없음.
  기존 `.pytest_cache/` 내부는 ACL 경고로 읽지 못했다.
- R5 재작업 시작 상태: 이전 R6의 허용 5경로만 dirty였고 허용 경로 밖
  변경은 없었다.
- worker lease / execution fence:
  `worker-lease-c12-rework-r1-20260915-002` /
  `c12-rework-r1-execution-fence-epoch-2-4041fb5198478688`
- write lease / write fence:
  `write-lease-c12-rework-r1-20260915-002` /
  `c12-rework-r1-write-fence-epoch-2-3609288a2f408b00`
- epoch-2 만료: `2026-09-16T08:25:00+09:00`

## 2. 기준 문서 hash

| 문서 | SHA-256 |
|---|---|
| `Anvil_설계서_v2.md` | `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3` |
| `Anvil_작업계획서_v1.md` | `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18` |
| `Anvil_통합검증매트릭스_v1.md` | `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5` |
| `Anvil_테스트계획서_v1.md` | `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| `docs/work_orders/C-12_WORK_INSTRUCTION.md` | `73F0B259091FFB697CBD9209F77098CF16D9351C92795738261C57D038EDEFA8` |
| `docs/work_orders/C-12_INVOCATION_PROMPT.md` | `489947C8C80FB32C90BAD2C8B2D5162EB1A700F0E1A6F4452C0EFEECC879C333` |

## 3. R5 판단 이유와 RED 증거

모든 pytest 명령은 repository `.venv\Scripts`를 PATH 선두에 두고
`-p no:cacheprovider` 및 격리된
`D:\Project\Anvil\.tmp_subagent_review\c12-r5-*` `--basetemp`를
사용했다.

1. Resolver state를 실제 교체한 뒤 발생한 publish 예외
   - 명령:
     `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r5-red-resolver-swap tests/orchestration/test_outcome_resolver_c07.py::test_resolver_state_swap_failure_preserves_transaction_and_prepared_retry -q`
   - exit 1, `1 failed, 1 passed in 0.47s`. resolver assignment
     before-swap 예외는 안전했지만 after-swap 예외는 resolver state/event 1건을
     남겼다. ledger와 registry는 base 상태였고 `verify_prepared`는 true였으나
     resolver만 rollback되지 않았다.
   - 원인: `published=True`가 publish callback 정상 반환 뒤에만 설정되어,
     callback 내부 assignment가 완료된 뒤 예외를 던지면 보상 의무가 false였다.

### 이전 R4 RED 증거

모든 pytest 명령은 repository `.venv\Scripts`를 PATH 선두에 두고
`-p no:cacheprovider` 및 격리된
`D:\Project\Anvil\.tmp_subagent_review\c12-r4-*` `--basetemp`를
사용했다.

1. Ledger state를 실제 교체한 뒤 발생한 예외
   - 명령:
     `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r4-red-ledger-swap tests/orchestration/test_outcome_resolver_c07.py::test_ledger_state_swap_failure_rolls_back_already_published_resolver_state tests/orchestration/test_outcome_resolver_c07.py::test_ledger_state_swap_then_failure_restores_both_states_and_prepared_retry -q`
   - exit 1, `1 failed, 1 passed in 0.47s`. before-swap 예외는 기존
     rollback으로 통과했지만, `__setattr__`이 `_state`를 next-state로 교체한
     직후 예외를 던지는 경우 ledger entry/count가 1로 남았다. base-state identity가
     깨져 `verify_prepared(prepared)`도 false가 되고 같은 receipt retry가
     불가능했다.

### 이전 R3 RED 증거

모든 pytest 명령은 repository `.venv\Scripts`를 PATH 선두에 두고
`-p no:cacheprovider` 및 격리된
`D:\Project\Anvil\.tmp_subagent_review\c12-r3-*` `--basetemp`를
사용했다.

1. Ledger publish 실패 뒤 resolver-only partial state
   - 명령:
     `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r3-red-rollback tests/orchestration/test_outcome_resolver_c07.py::test_ledger_state_swap_failure_rolls_back_already_published_resolver_state -q`
   - exit 1. `ExplodingLedger`가 resolver callback publish 뒤 `_state`
     assignment에서 `RuntimeError`를 냈을 때 ledger count는 0이지만 resolver의
     run/step/accepted-result/event가 남았다.
2. Canonical takeover receipt 조회 부재
   - 명령:
     `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r3-red-candidate tests/orchestration/test_failure_ledger_c12.py::test_canonical_takeover_candidate_receipt_is_available_only_at_count_three tests/orchestration/test_failure_ledger_c12.py::test_canonical_candidate_receipt_is_accepted_by_existing_c13_for_all_permutations -q`
   - exit 1, 2 failed. `FailureLedger.takeover_candidate_receipt`가 없어
     `2,3,1` 순서에서 canonical latest result `r3`와 결박된 receipt를 C13에
     전달할 수 없었다.
3. C-07 signal에 canonical lookup key 부재
   - 명령:
     `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r3-red-signal tests/orchestration/test_outcome_resolver_c07.py::test_three_report_permutations_emit_exactly_one_takeover_candidate_event -q`
   - exit 1. `MainAgentTakeoverRequired` payload에 `failure_key`가 없어
     canonical receipt 조회 경계를 연결할 수 없었다.

위 RED는 4개 test function이며 모두 리뷰가 지적한 실제 원인으로 실패했다.
R2까지의 mutable capability, cross-component pre-publish failure, count-3
permutation/concurrency, forged/stale receipt 및 ledger 내부 partial publish RED도
그대로 회귀 범위에 포함했다.

## 4. 구현 조치

1. `FailureLedger._commit_prepared`는 publish 중 어떤 예외가 발생해도
   registry가 보유한 exact `prepared.base_state`를
   `object.__setattr__`로 먼저 복구한다. 따라서 custom `__setattr__` 주입을
   다시 통과하지 않으며, state swap 이전·이후 예외 모두 ledger state와 prepared
   registry가 commit 전 상태를 유지한다. 그 뒤 resolver rollback callback을
   실행하고 원래 예외를 전파한다. R5에서는 publish 호출 전에 compensation
   obligation을 활성화해 callback 자체가 예외를 던져도 rollback을 호출한다.
   resolver rollback은 현재 state가 이미 previous면 no-op, expected published면
   `object.__setattr__` exact restore, 그 외 identity drift면 오류로 fail-closed한다.
2. 정상 경로 lock 순서는 resolver lock 다음 ledger lock으로 고정했다. 양쪽 reader는
   각자 하나의 lock만 사용한다. concurrent commit/read 회귀에서 timeout 없이
   종료됨을 확인했다.
3. `FailureLedger.takeover_candidate_receipt(failure_key)`를 추가했다. projection
   count가 정확히 3이고 takeover가 true일 때만 현재 canonical
   `latest_result_id` entry와 일치하는 committed immutable receipt를 반환하며,
   그 외에는 `None`으로 fail-closed한다.
4. 세 보고 `1,2,3`의 6개 permutation 모두에서 조회 receipt는 canonical
   latest result, count 3, takeover true다. 변경하지 않은 기존 C13
   `MainAgentTakeoverService`에 그대로 전달하는 in-memory integration test에서
   6개 순서 모두 수락됨을 확인했다.
5. C-07 `MainAgentTakeoverRequired` event payload에 canonical
   `failure_key`를 추가했다. C13 소비자는 event의 key로
   `takeover_candidate_receipt()`를 조회한다. 세 번째 도착 receipt 자체는
   canonical latest result를 가리킨다는 보장이 없으므로 C13 capability로 사용하지
   않는다는 경계를 resolver docstring과 테스트에 명시했다.
6. R2의 기존 transaction 설계는 유지했다. prepared next-state는 ledger 내부
   registry에만 있고 receipt는 불투명 token만 가진다. resolver와 ledger는 모든
   잠재 실패 allocation을 local COW state에서 완료한 뒤 publish한다.
7. 같은 key의 세 번째 유효 commit 뒤 신규 보고는
   `TAKEOVER_ALREADY_REQUIRED`로 거부하는 online freeze invariant를 유지한다.
   세 보고 집합의 projection/receipt는 순서와 무관하며 retroactive replacement는
   하지 않는다.
8. `record()`는 standalone ledger commit API다. C-07 transactional flow는
   같은 authority의 `prepare()` receipt만 소비하며 이미 standalone commit된
   receipt는 `FAILURE_CONTEXT_MISMATCH`로 거부한다.
9. count 3에서는 `MAIN_AGENT_TAKEOVER_REQUIRED` 후보 event만 만든다. 실제
   Developer 중지, lease/tool 회수, TakeoverPacket 생성/실행은 하지 않았다.

## 5. 변경 경로와 SHA-256

| 경로 | SHA-256 | 요약 |
|---|---|---|
| `packages/orchestration/failure_ledger.py` | `528DD9AF18AAEF0BDCB02997538E9944C3AD78A16C42DD1C9C7CDCC98689DEF9` | pre-publish compensation obligation, exact base-state restore, canonical takeover receipt API |
| `packages/orchestration/outcome_resolver.py` | `ADCE05679EC92D1FD1D45805F9FDB786DE25F9C7ECCDF6155C2C0A8916461BB6` | identity-guarded exact resolver rollback, event failure_key와 C13 소비 경계 |
| `tests/orchestration/test_failure_ledger_c12.py` | `51213D0F48E9D852A2A1C569B5B1E0ED5F0084F1B8E0FCF5586CC15E86C1CF37` | candidate API와 6-permutation C13 integration |
| `tests/orchestration/test_outcome_resolver_c07.py` | `0042FE92DC14B6BAD751D7AD2A725013251B69C93F8CA2C82E7FCAE442B17AA0` | resolver/ledger before/after-swap rollback과 retry, lock/deadlock, event key |
| `docs/04_test_reports/C-12_COMPLETION_REPORT.md` | post-write hash는 최종 handoff에 기록 | 본 R7 보고서 |

`packages/orchestration/__init__.py`는 export 변경이 필요하지 않아 수정하지 않았다.
최종 변경은 허용 목록 안의 위 5경로뿐이다.

## 6. GREEN·회귀·정적 검증

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r5-green-resolver-swap tests/orchestration/test_outcome_resolver_c07.py::test_resolver_state_swap_failure_preserves_transaction_and_prepared_retry -q` | 0 | `2 passed in 0.37s` |
| `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r5-green-all-swaps tests/orchestration/test_outcome_resolver_c07.py::test_ledger_state_swap_failure_rolls_back_already_published_resolver_state tests/orchestration/test_outcome_resolver_c07.py::test_ledger_state_swap_then_failure_restores_both_states_and_prepared_retry tests/orchestration/test_outcome_resolver_c07.py::test_resolver_state_swap_failure_preserves_transaction_and_prepared_retry -q` | 0 | `4 passed in 0.39s` |
| `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r5-focused tests/orchestration/test_failure_ledger_c12.py tests/orchestration/test_failure_report_c06.py tests/orchestration/test_outcome_resolver_c07.py -q` | 0 | `147 passed in 0.54s` |
| `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r5-final-orchestration tests/orchestration -q` | 0 | `519 passed in 0.95s` |
| `python -B -m pytest -p no:cacheprovider --basetemp D:\Project\Anvil\.tmp_subagent_review\c12-r5-final-c11 tests/planning/test_c11_admission.py tests/planning/test_c11_planner.py -q` | 0 | `155 passed in 0.56s` |
| `$env:PYTHONPYCACHEPREFIX='D:\Project\Anvil\.tmp_subagent_review\c12-r5-pycache'; python -B -m compileall -q packages/orchestration tests/orchestration` | 0 | 출력 없음 |
| `git diff --check` | 0 | 출력 없음 |
| `.venv\Scripts\python.exe scripts/check_project_progress.py` | 0 | `PASS sequence=891 reporting=AUTO_CONTINUE` |

위 표의 전체 회귀·compileall·diff·checker는 R7 보고서 작성 뒤 최종 source/test
상태에서 fresh 실행했다.

## 7. 유지 계약·미검증·잔여 위험

- C-06 validator를 통과한 정식 `FAILURE_REPORT`만 집계한다.
  transient/command/tool/quota/permission/environment 및 무효 보고는 집계하지 않는다.
- 동일 result replay 멱등, 충돌 payload와 rotated attempt identity fail-closed,
  다른 lineage/fingerprint 별도 counter 계약을 회귀 검증했다.
- forged/foreign/stale/수정된 receipt와 authority 누락, standalone-committed
  receipt는 `FAILURE_CONTEXT_MISMATCH`로 거부한다.
- ledger와 resolver 각각의 swap 이전 예외 및 실제 next-state swap 이후 예외 모두
  양쪽 canonical state와 prepared registry를 보존하며, 같은 receipt retry가
  성공한다. 정상 동시 read/commit은 테스트 timeout 안에 종료됐다.
- C13 제품 파일은 수정하지 않았다. 기존 C13 service와의 검증은 fake in-memory
  lifecycle/lease/tool 객체를 사용한 단위 integration이다. 실제 takeover,
  TakeoverPacket 외부 실행, 실제 lease/tool 회수는 `NOT_EXECUTED`다.
- 외부 DB/API/browser/Provider/network/Secret/WSL/Docker/deployment는 승인 범위
  밖이라 `NOT_EXECUTED`다.
- 독립 Tester 판정, commit/push/merge, progress/HANDOFF 갱신은 Main Agent 책임이다.
- 기존 `.pytest_cache/` ACL 내부는 검증하지 못했다. 격리 basetemp는 자동 정리하고
  compileall temp pycache는 종료 시 정확한 경로만 정리한다.

## 8. rollback·오류 횟수·다음 조치

- rollback: Main Agent가 위 5개 미커밋 변경만 역패치한다. Developer는
  reset/checkout/stash를 수행하지 않았다.
- R5 예상 RED: parameterized resolver test 2 cases 중 before-swap 1 passed,
  after-swap 1 failed로 의도한 경계를 분리 재현했다(exit 1).
- R4 예상 RED: 2 test functions 중 before-swap 1 passed, after-swap 1 failed로
  의도한 경계를 분리 재현했다(exit 1).
- R3 예상 RED: 4 test functions, 모두 의도한 원인으로 exit 1.
- 누적 정식 동일 근본 원인 `FAILURE_REPORT`: 0회.
- 다음 조치: Main Agent가 최종 hash·허용 경로·검증 결과를 독립 확인하고 C-12
  acceptance를 판단한다.
