# G-02 결정 승인 기록

- approval_id: `APPROVAL-20260810-G02-DECISIONS-001`
- decided_by: `신산님`
- decided_at: `2026-08-10`
- decision: `APPROVED`
- subject_hash: `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`
- parent_approval: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- user_instruction: `승인해`

## 승인된 결정

1. Q-01: Anvil 자체 테스트 스택은 `pytest + Playwright + JSON Schema + OpenAPI diff`, 대상 저장소 검증 도구는 Project Profile 기반 가변 도구로 분리한다.
2. Q-02: 원문에 정의가 없으므로 새 요구사항을 발명하지 않고 `RESERVED_NOT_DEFINED`로 기록한다.
3. Q-03: Phase E 이전 독립 Tester는 개발 작업과 분리된 독립 Subagent 세션이 담당한다.
4. Q-04: `RS-CRITICAL` 목표 시간을 30분으로 유지한다.
5. Q-05: Golden set 기대값 변경 승인자는 Owner인 신산님으로 유지한다.
6. Q-06: 초기 결함 대장은 Markdown을 정본으로 사용하고 관련 기능 구현 후 DB·화면으로 이관한다. 이관 전후 provenance와 ID는 보존한다.
7. 과거 미할당 5건은 현재 통합검증매트릭스에 기록된 Package 배정을 확정한다.
8. D1~D8·D10은 통합 기준선 승인을 상속하고, D9는 benchmark 전 제품을 선택하지 않는 정책을 유지한다.

## Canonical subject

아래 UTF-8 텍스트를 LF로 연결하고 마지막 LF 없이 SHA-256을 계산한 값이 `subject_hash`다.

```text
G-02|Q-01|ANVIL_TEST_STACK=pytest+Playwright+JSON Schema+OpenAPI diff|TARGET_REPO_TOOLS=Project Profile variable
G-02|Q-02|RESERVED_NOT_DEFINED
G-02|Q-03|PRE_E_TESTER=independent subagent session
G-02|Q-04|RS_CRITICAL_TARGET=30 minutes
G-02|Q-05|GOLDEN_EXPECTED_VALUE_APPROVER=Owner
G-02|Q-06|DEFECT_LEDGER=Markdown canonical until DB+UI migration
G-02|VALIDATION_ALLOCATION|CONFIRM_CURRENT_MATRIX_ASSIGNMENTS_FOR_5_FORMER_GAPS
G-02|D1-D8,D10|INHERIT_HUMAN_CONFIRMED
G-02|D9|BENCHMARK_BEFORE_PRODUCT_SELECTION
```

## 변경 통제

위 결정의 의미, 기능 범위, 요구사항 또는 중요 위험을 바꾸는 경우 신산님의 새 승인이 필요하다. 문구 정리나 hash 등록 같은 비의미 변경은 운영규칙의 `MAIN_RECONFIRMED_NON_SEMANTIC` 경계를 따른다.
