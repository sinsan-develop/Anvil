# C-07 WorkInstruction — DelegationOutcomeResolver·원자 전이

## 목표

C-05 Result Envelope와 C-06 유효 FAILURE_REPORT를 canonical Step·Delegation 상태와 Event로 원자 반영하는 resolver를 구현한다.

## 범위

- 현재 execution/write fencing token과 일치하는 결과만 적용한다.
- Step·Delegation 상태 전이와 outbox event를 한 번만 반영하는 idempotent in-memory resolver를 제공한다.
- stale token, duplicate result, invalid transition을 fail-closed reason code로 거부한다.
- 정상 완료·유효 실패·stale·중복·잘못된 상태 테스트를 작성한다.

## 금지

- C-08 Repository Intelligence, C-12 failure count, 외부 DB/API/browser/deployment 구현 금지
- historical progress/event/hash 수정 금지

## 완료조건·검증

1. 현재 fencing token 결과만 canonical 상태에 반영된다.
2. 동일 결과 재적용은 상태·event를 중복 생성하지 않는다.
3. stale/invalid 결과는 명시적 reason code로 거부된다.
4. 테스트, compileall, `git diff --check` 통과.

## 결과보고

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED`와 변경·검증·미검증·rollback을 보고한다.
