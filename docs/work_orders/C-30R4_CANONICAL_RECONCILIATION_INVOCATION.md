# C-30R4 canonical reconciliation invocation

`C-30R4_CANONICAL_RECONCILIATION_WORK_INSTRUCTION.md`를 기준으로 Developer exact2만
TDD로 구현한다. seq1~1325 raw prefix와 per-event historical profile을 고정하고,
C30 전용 builder/validator/Git collector 및 deterministic historical fixture isolation을
추가한다. 기존 Event 재작성, 전역 event type 완화, 오류 필터 확대, 조기 C30 전체
acceptance는 금지한다. Main control8은 Developer가 생성하지 않고 Main이 검증 후
materialize한다. commit·push는 Main 소유다.
