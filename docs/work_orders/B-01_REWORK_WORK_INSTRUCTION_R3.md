# B-01 Rework WorkInstruction Revision 3

## Artifact envelope

- artifact_id: `WI-B-01-20260814-003`
- artifact_type: `rework_work_instruction`
- package_id / revision: `B-01 / 3`
- artifact_status / package_status: `approved / ACTIVE`
- executor: `developer-primary-b01`
- baseline_git_commit: `6226e7828e11c564b08de738ba46c5b028792a85`
- predecessor WI: `docs/work_orders/B-01_REWORK_WORK_INSTRUCTION_R2.md` / `0DB329051E34218DE1CBBD20E1221CA1E29DFA5B32C174FF91B508272B9FEFAF`
- predecessor evidence: `docs/evidence/manifests/B-01_EVIDENCE_MANIFEST_R2.json` / `DA32A7C2F2F3E38623BD691B876233A50E8267AC594E847E3108EE308A5E1AEF`
- source Tester report: `docs/test_reports/B-01_RETEST_REPORT_R2.md` / `AAFD3A01443162A99821B0D10967F432C9C5C9EF7309483CEC506E2B1BD02C09`
- failure fingerprint: `BLK-B01-002-NONCANONICAL-TARGET-PADDING-BYPASS`
- classification: `MAIN_RECONFIRMED_NON_SEMANTIC`; semantic diff: `NONE`

## 판정 → 판단 이유 → 조치

**판정: R3 재작업.** 동일 B-01 lineage의 두 번째 유효 실패다. R1의 `BLK-B01-001`은 R2에서 닫혔지만, R2 필수 수정 3의 canonical target 계약이 완전히 구현되지 않았다.

**판단 이유:** 현재 `_release_conditions`는 `bool(target.strip())`와 두 원문의 equality만 확인한다. 따라서 ASCII 또는 Unicode padding을 양쪽 target에 동일하게 넣으면 nonblank/equality 조건을 통과한다. 설계 범위나 중요 위험을 바꾸지 않고 원문이 strip 결과와 정확히 같은지 확인하는 최소 fail-closed 보완이 필요하다.

**조치:** 아래 exact 5 paths에서 padding 회귀를 RED로 고정하고 최소 수정·검증·R3 증거만 작성한다.

## 필수 수정과 검증

1. ASCII padded same-pair와 Unicode padded same-pair를 `tests/domain/test_reducer.py`에 먼저 추가하고 intended RED를 확인한다.
2. `target_hash`는 nonblank 문자열이며 `target_hash == target_hash.strip()`이어야 한다.
3. `validation_target_hash`도 동일한 canonical 조건을 충족하고 target과 정확히 같아야 한다.
4. R1 finding `False`, `0.0`, whitespace-only와 정상 strict integer zero/canonical target 회귀를 보존한다.
5. hostile 2종, domain 전체, dependency boundary, tooling 전체를 실행하고 R3 validation/evidence/completion에 정확한 명령·결과·미실행 경계를 기록한다.

## Developer exact file-level write allowlist

- `packages/domain/reducer.py`
- `tests/domain/test_reducer.py`
- `docs/validation/B-01_DOMAIN_CORE_VALIDATION_R3.md`
- `docs/evidence/manifests/B-01_EVIDENCE_MANIFEST_R3.json`
- `docs/completion_reports/B-01_COMPLETION_REPORT_R3.md`

R1/R2 제품 외 파일과 R1/R2 manifest·completion·validation, 모든 Tester report, authority, progress/HANDOFF, WorkInstruction, 다른 package/app, dependencies/config, Git refs/index는 수정 금지다.

## 완료조건과 금지

- epoch-3 worker/write fencing token과 exact 5 paths를 시작 전에 확인한다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다.
- 완료 성공 상태는 `COMPLETED_PENDING_INDEPENDENT_RETEST`이며 Main acceptance를 주장하지 않는다.
- B-01 acceptance, B-02 시작, commit/push, 실제 API·DB·UI·browser·provider·WSL·production·deploy를 수행하지 않는다.
