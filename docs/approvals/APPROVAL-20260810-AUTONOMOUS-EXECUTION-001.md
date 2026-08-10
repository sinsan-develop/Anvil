# Anvil 자동 진행·보고 경계 승인 기록

- approval_id: `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`
- approved_by: `신산님`
- approved_at: `2026-08-10`
- approval_type: `operating_rule`
- status: `APPROVED`
- source_instruction: `Git 원격 저장소를 https://github.com/cyhuh7950/anvil 로 정하고, 작업계획서 안의 내용은 Main Agent 주관으로 자동 진행하며 일반 진행 내용을 보고하지 않는다.`

## 승인된 운영 경계

1. 승인된 설계서·작업계획서 안의 Package는 Main Agent가 중간 확인 없이 자동 진행한다.
2. 작업계획서 내용, 일반 Package 진행, 테스트·재작업, 내부 구현 판단은 신산님에게 진행 보고하지 않는다.
3. 신산님에게 중단 보고하는 조건은 다음으로 한정한다.
   - 기능 범위·요구사항·중요 위험 변경으로 승인 또는 선택이 필요한 경우
   - DIR-1·DIR-2·DIR-3 또는 canonical DIR-X 도달
4. 동일 실패 3회는 Main Agent 직접 인수 규칙으로 처리하며 그 자체는 신산님 보고 조건이 아니다.
5. Git 원격 `origin`은 `https://github.com/cyhuh7950/anvil`로 고정한다.

## 영향

- 제품 기능·요구사항·중요 위험의 내용은 변경하지 않는다.
- 사람의 언제든 개입 권한과 DIR 강제 중단은 유지한다.
- 변경되는 것은 Main Agent의 일상 진행 보고 빈도와 원격 저장소 binding이다.
