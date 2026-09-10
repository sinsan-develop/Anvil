# C-21 WSL acceptance strict successor report

## 판정

`COMPLETED / C21_WSL ACCEPTED_WITH_LIMITATION / C-21 BLOCKED_NOT_ACCEPTED`.

이 기록은 WSL 선행검증 범위만 인수한다. `accepted=false`, C-01은 `BLOCKED_PENDING_C21_ACCEPTANCE`, DIR-2는 `NOT_TRIGGERED`다. 다음 행동은 계획에 따른 사용자 소유의 실제 Provider/Telegram 검증과 실제 브라우저 인수이며, 이 package는 해당 실행이나 ysna/main/C-01 시작을 승인하지 않는다.

## Tester 근거

- source=`INDEPENDENT_TESTER_AGENT_REPORT`; repository artifact=`ABSENT`.
- verdict=`ACCEPTED_WITH_LIMITATION`; scope=`C21_WSL`; findings=`C0/I0/M2`.
- 직접 확인: parent `bcaeeacd…`는 private control `b2ba821…`의 single direct child이고 seq566 exact12/cumulative149, 제품/deploy/guard 변경0, deterministic projection, seq1~566 prefix, checker/focused negative/diff/clean을 통과했다.
- 기록 인수: PG15/PG18RC migration/API/auth SSE/Last-Event-ID/backup-restore/rollback, cleanup invocation1/internal exit0, exact targets 6/4/2 제거, unrelated pre-existing missing/changed0, application/control/environment/markers/evidence 보존.
- 비증명: same-origin은 HTTP ingress이지 browser Network가 아니며, full suites는 기록 인수다. Provider/Telegram/ysna/main/current service는 포함하지 않는다.

## 수정

- 공용 JSON parser와 canonical JSON은 변경하지 않았다.
- C-21 전용 recursive strict JSON equality는 dict exact keys, list exact type/length/order, scalar type identity+value, finite float를 요구한다.
- seq566 runtime/manifest와 seq572 manifest/projection/전체 bundle 공개 경로에서 bool/int/float 혼동을 거부한다.
- seq572 builder는 raw7 → E → P → H → D → M 순서로 동일 제한 상태를 투영한다.
- raw checksum `bytes`는 `type(value) is int and value > 0`만 허용한다.

## 열린 limitation

- `PRIMARY_MUTATION_WRAPPER_COMMAND_FULLTEXT_UNAVAILABLE_AFTER_SUBAGENT_COMPACTION`
- `EXACT_RUNTIME_OBSERVED_TIMESTAMP_UNAVAILABLE`
- `RECEIPT_ORIGINALS_AND_PATHS_NOT_INDEPENDENTLY_INSPECTED`
- `SAME_ORIGIN_HTTP_INGRESS_NOT_BROWSER_NETWORK_ACCEPTANCE`

## TDD 및 검증

- TDD RED 1: seq566 public runtime validator가 `True/False/1.0`을 `1/0/1`로 허용해 기대한 assertion에서 `1 failed`, exit1.
- TDD RED 2: seq572 builder/validator/collector/routing 부재로 `1 failure, 5 errors`, exit1.
- TDD RED 3: immutable bca 기반 seq566 generated artifacts를 synthetic file view로 제공한 direct projection test에서 `event_sequence=566.0`이 정수와 동일 비교되어 `1 failed`, exit1. seq566 projection supplied-object 비교를 strict helper에 직접 연결한 뒤 PASS했다.
- 최초 materialize 후 focused는 `11 passed, 1 failed`; generic Event 계약에서 completion `accepted`와 repository 효과의 `dispatch_upstream_head` 누락을 정확히 검출했다. 두 필드를 seq566 계약과 동일하게 보완했다.
- final focused GREEN: seq566+seq572 공개 경로 `12 tests in 18.705s`, `OK`, exit0.
- live checker: `G-05 project progress contract: PASS sequence=572 reporting=AUTO_CONTINUE`, exit0.
- `git diff --check`: exit0. 두 변경 Python 파일의 direct in-memory compile: PASS, exit0.
- direct seq566 projection 보강 전 전체 tooling `214 tests in 667.571s`, `OK`는 역사 증거로만 유지한다. 보강 후 final 전체 tooling은 `214 tests in 680.535s`, `OK`, exit0이다.
- `py_compile`은 managed sandbox가 `scripts/__pycache__` 쓰기를 거부해 exit1이었다. 이는 source syntax failure가 아니며 동일 두 파일을 파일 생성 없이 `compile()`한 결과 PASS, exit0이다.
- final 전체 tooling 결과를 raw7에 기록하고 P/E/H/D/M을 deterministic rematerialize한 뒤 focused `12 tests in 16.375s` OK, live checker sequence572 PASS, diff-check PASS, file-free compile PASS를 fresh 확인했다. 제품/deploy/guard bytes가 parent와 같아 deploy full은 실행하지 않았다.

## 변경·rollback

- exact12만 변경한다. 제품/deploy/guard bytes와 seq1~566 historical evidence는 변경하지 않는다.
- rollback은 parent `bcaeeacd1618461127c2387504e2535a0d54504f`로 되돌리는 것이다. push/external execution은 수행하지 않는다.
