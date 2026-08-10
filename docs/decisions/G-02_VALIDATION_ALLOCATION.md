# G-02 Validation Allocation — 과거 미할당 5건 확정

- package_id: `G-02`
- work_instruction_revision: `2`
- rework_finding: `G02-DEF-001`
- approval_ref: `APPROVAL-20260810-G02-DECISIONS-001`
- validation_ids: `AV-SAFE-033`, `AV-GATE-026`
- source_of_truth: `Anvil_통합검증매트릭스_v1.md` v1.2 §6, §8, §9.3
- allocation_status: `REWORK_CORRECTED_AWAITING_INDEPENDENT_TESTER`

## 1. 판정

`HUMAN_CONFIRMED` — 과거 미할당으로 분류됐던 5건은 현재 통합검증매트릭스의 책임 Package와 AV ID에 모두 배정되어 있다. 현재 미할당 항목으로 취급하지 않는다.

## 2. 확정 배정

| 과거 미할당 항목 | 현재 AV ID | 현재 책임 Package | 원문 대조 |
|---|---|---|---|
| 승인 만료 | `AV-SAFE-004` | `B-04` | §6.2 직접 행과 §8 `B-04` 역색인에 모두 존재 |
| 취소 Workspace 보존 | `AV-STAT-030` | `B-10` | §6.3 직접 행의 workspace 24시간 보존과 §8 `B-10`의 `AV-STAT-030~033`에 존재 |
| formatter drift | `AV-GATE-011` | `C-14` | §6.4 직접 행과 §8 `C-14`의 `AV-GATE-006~015`에 존재 |
| baseline failure | `AV-GATE-007`, `AV-GATE-008` | `C-14` | §6.4 직접 행과 §8 `C-14`의 `AV-GATE-006~015`에 존재 |
| build-progress 필드 | `AV-STAT-015` | `G-05` | §6.3 직접 행과 §8 `G-05` 역색인에 존재 |

5개 주제 중 baseline failure는 기존 매트릭스가 구분한 두 검증 ID를 함께 사용한다. ID를 새로 만들거나 테스트 범위·심각도를 변경하지 않았다.

## 3. G-02 자체 검증 할당

| 검증 ID | 방법 | G-02 증거 | 사전 판정 |
|---|---|---|---|
| `AV-SAFE-033` | `AN` | 직전·현재 authority hash, 기존 binding 무효화, G-02 human approval과 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 binding | `REWORK_CORRECTED_AWAITING_TESTER` |
| `AV-GATE-026` | `AU + RV` | 작업계획 v1.4 97 Package, 매트릭스 v1.2 255 ID, 테스트계획 v1.3, DIR-1/2/3·DIR-X, §8 Package 역색인, 활성 구 기준선·현재 미할당 표현 점검 | `REWORK_CORRECTED_AWAITING_TESTER` |

통합검증매트릭스 §8에서 G-02는 `AV-SAFE-033`, `AV-GATE-026`에 할당되어 있고, `AV-GATE-026`의 최종 정규화 책임 Package는 G-07에도 유지된다.

## 4. 변경 영향

- 통합검증매트릭스는 v1.2로 올리고 활성 상태·연계 revision·정규화 판정만 수정했으며 본문 검증 항목과 역색인은 수정하지 않았다.
- 기존 AV ID, 책임 Package, 테스트 방법, 레벨, 필수 증거, 심각도를 변경하지 않았다.
- 테스트계획의 R-09는 현재 미할당 상태가 아니라 확정 배정의 회귀 누락 위험으로 정합화했다.

## 5. 조치

독립 Tester가 각 직접 행과 §8 축약 범위를 원문에서 재확인한다. 하나라도 불일치하면 G-02를 `REWORK` 또는 `BLOCKED`로 판정하며, PASS 전에는 `ACCEPTED`를 기록하지 않는다.
