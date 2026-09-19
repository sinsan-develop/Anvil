# E-11 WorkInstruction — 대규모 fixture 제한 병렬·신뢰사슬 E2E

## 목표

승인된 E-11 범위에서 대규모 fixture migration과 bug hunt를 Single/제한 병렬로 재현하고, 독립 실패 격리·비용·속도·품질 비교와 §49 신뢰사슬 거부 시나리오를 하나의 결정론적 benchmark 계약으로 구현한다. 실제 Provider·원격 Git·DB·배포·네트워크는 실행하지 않는다.

## 기준선과 선행조건

- branch: `codex/c09-execution-backends-r1`
- dispatch/base HEAD: `98e218264bf54db04a1bd35a67273b713805a649`
- canonical progress: E-10 `ACCEPTED`, sequence 1165, E-11 `READY_FOR_WORK_INSTRUCTION`
- 권위: 설계서 §49.1~49.7, §49.17; 작업계획서 E-11·Phase E Gate; 테스트계획서 §6·§10.6; 통합검증매트릭스 `AV-AGT-034`, `AV-FLOW-023`, `AV-STAT-041`, `AV-STAT-042`

## 제품 write scope — exact5

1. `packages/verification/parallel_e2e.py`
2. `tests/verification/test_parallel_e2e_e11.py`
3. `tests/fixtures/e11/large_migration.json`
4. `tests/fixtures/e11/bug_hunt.json`
5. `docs/04_test_reports/E-11_COMPLETION_REPORT.md`

위 5개 이외 제품·schema·migration·API route·UI·배포 파일을 수정하지 않는다. Main 소유 progress/event/HANDOFF/checker/tooling/WI/prompt/evidence 파일은 수정하지 않는다.

## 구현 계약

### 입력·권위·결정성

- 공개 입력은 exact builtin, bounded, detached copy만 허용한다. hostile callback·alias·TOCTOU로 fixture·결과·결정을 바꾸지 않는다.
- fixture id/version/hash, target/delivered hash, execution/write fence, budget limit, task graph, expected findings와 golden result를 동일 benchmark subject에 결박한다.
- 입력 순서·thread 완료 순서와 무관하게 canonical task/result ordering·hash·decision이 결정적이어야 한다.
- 외부 subprocess·shell·filesystem mutation·network·Provider를 agent payload가 선택하지 못한다.

### 제한 병렬과 실패 격리

- dependency가 없는 read-only Step만 제한 병렬 후보가 된다. path/subject overlap, dependency, write lease 또는 non-independent marker가 있으면 Single로 자동 축소한다.
- 한 독립 Step 실패는 종속 Step만 `BLOCKED_DEPENDENCY`로 만들고 독립 Step은 계속한다. 필수 실패·미완료가 있으면 전체 `SUCCEEDED`를 금지한다.
- `FIX-CONFLICT` 동시 write lease 경합을 최소 100회 재현해 이중 획득 0을 증명한다.
- Worker A 만료 후 Worker B 인수 시 A의 늦은 queue·Step·Tool·commit publication은 모두 `STALE_FENCING_TOKEN`, side effects 0이어야 한다.

### 예산·품질·benchmark

- hard limit 직전 병렬 호출은 송신 전 원자 예약 성공분만 synthetic provider ledger에 기록한다. 예약 실패 요청은 send count 0이며 `BUDGET_RESERVATION_FAILED`다.
- cancellation 뒤 upstream 진행은 숨기지 않고 actual usage/abort receipt에 기록한다. provider 성공으로 위조하지 않는다.
- 동일 fixture·target·golden expectation으로 Single과 parallel의 wall-unit, reserved/actual cost, completed/failed/blocked, finding precision/recall, delivered hash를 비교한다.
- 품질 하락 또는 비용만 증가하면 `DO_NOT_ENABLE_PARALLEL`; 품질 동일 이상이며 승인된 비용·속도 기준을 충족할 때만 `ELIGIBLE_FOR_LIMITED_PARALLEL`을 권고한다. 이는 자동 활성화나 Owner 결정이 아니다.

### §49 신뢰사슬

- stale fencing, budget race, evidence target/delivered hash mismatch, Release subject mismatch, blocking defect, incomplete ProductValidation을 positive success로 승격하지 않는다.
- 실제 E-09 Release owner와 E-10 Git adapter public seam을 사용하되 self-minted approval/receipt/boolean으로 대체하지 않는다.
- fixture failure code와 실제 validation outcome을 report·evidence에 분리하고, expected failure가 발생했다는 사실만으로 전체 품질 PASS를 만들지 않는다.
- DIR-3 trigger는 제품 benchmark가 임의 발생시키지 않는다. E-11 독립 acceptance 직후 Main canonical progress가 `DIR_HOLD`로 기록하며 신산님 direction 전 Gate/F-01 진행을 금지한다.

## TDD·검증

- RED를 먼저 고정하고 최소 구현 후 GREEN.
- `AV-AGT-034`, `AV-FLOW-023`을 focused test에서 판정하고 §49.17-3/4/5/7 trust-chain 거부를 포함한다.
- E-04~E-10 관련 DAG·lease·budget·verification·Git adapter 회귀, builtin compile, `git diff --check`, canonical progress checker를 실행한다.
- hostile callbacks, Unicode/case/path alias, duplicate task/fixture/result, stale token, 100+ concurrency, shuffled completion, oversized input, replay/conflicting replay, mutable return alias를 적대적으로 검증한다.
- 실제 Provider/DB/remote Git/PR/merge/network/UI/배포는 실행하지 않고 `NOT_EXECUTED`; synthetic/in-memory 증거를 운영 PASS로 승격하지 않는다.

## 완료보고

- 기준 HEAD/branch/status와 exact5 diff/hash
- RED→GREEN, 정확한 명령/exit/result, benchmark Single/parallel 원시 측정값
- `AV-AGT-034`, `AV-FLOW-023` 판정과 §49.17 거부 시나리오 매핑
- fixture/golden hash, 실패 격리, 100회 conflict, stale fence, hard-limit send0 증거
- 실제/fixture 경계, 잔여 위험, rollback
- stage/commit/push는 Main만 수행
