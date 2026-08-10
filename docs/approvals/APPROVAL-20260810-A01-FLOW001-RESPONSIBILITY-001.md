# A-01 AV-FLOW-001 책임 정합화 승인 기록

- approval_id: `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001`
- decided_by: `신산님`
- decided_at: `2026-08-10`
- decision: `APPROVED`
- decision_source: `A-01에서 AV-FLOW-001 제거, A Gate/A-05/B-03 유지`
- scope: `A-01 reverse-index 책임 정정과 그 정합성 validator·approval evidence`

## 승인된 책임 변경

| 대상 | 기존 책임 | 신규 책임 | 유지 책임 |
|---|---|---|---|
| `A-01` | `AV-UI-005`, `AV-FLOW-001` | `AV-UI-005` | `AV-FLOW-001`은 A-01에서만 제거 |
| `A-05` | `AV-FLOW-001` | 변경 없음 | 유지 |
| `B-03` | `AV-FLOW-001`, `AV-FLOW-002` | 변경 없음 | `AV-FLOW-001` 유지 |
| `A Gate` | `AV-FLOW-001` 포함 | 변경 없음 | 유지 |

## 범위 판정

- 기능 범위, 사용자 요구사항, 중요 위험, Package 수(97), AV 수(255), Gate 구성의 확장은 없다.
- 이 승인은 `AV-FLOW-001`의 실행 책임을 A-05·B-03과 A Gate에 유지한 채 A-01의 중복 배정만 제거한다.
- historical evidence와 accepted manifest는 변경하거나 재작성하지 않는다.

## superseded hash lineage

| 단계 | Artifact | SHA-256 | 상태 |
|---|---|---|---|
| root human approval | `APPROVAL-20260810-INTEGRATED-BASELINE-001`의 통합검증매트릭스 v1.1 | `E911650466ACAE87599CD8CBBFE29B301F47A9D37B225D2DAD090A6BF13A3904` | historical parent |
| active derived baseline | `Anvil_통합검증매트릭스_v1.md` v1.2 | `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3` | superseded responsibility projection |
| next derived baseline | Task 2가 생성할 활성 matrix revision/hash | `PENDING_FINAL_AUTHORITY_HASH` | 이 승인에 결박할 후속 hash |

이 approval은 현재 active matrix hash를 소급 변경하지 않는다. Task 2의 authority revision과 derived baseline이 최종 hash 및 이 approval과의 binding을 기록할 때까지 새 책임 배정은 active baseline이 아니다.
