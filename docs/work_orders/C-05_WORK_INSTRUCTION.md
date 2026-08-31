# C-05 WorkInstruction — 구조화 Result Envelope·schema validator

## 목표

C-03/C-04 raw 결과를 Main Agent가 신뢰 가능한 구조화 결과로 판정할 수 있도록 Result Envelope와 schema validator를 구현한다.

## 범위

- 상태 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`와 공통 식별자·attempt·target hash·evidence·summary 필드를 정의한다.
- 필수 필드·상태별 조건·hash 형식·evidence reference를 deterministic하게 검증한다.
- 유효/무효 reason code와 canonical JSON serialization을 제공한다.
- 각 상태 및 누락·변조 hostile 테스트를 작성한다.

## 금지

- C-06 FAILURE_REPORT 집계·C-07 outcome resolver 구현 금지
- 실제 외부 호출·DB/API/browser/deployment 및 historical progress 수정 금지

## 완료조건·검증

1. 다섯 결과 상태가 명시적으로 구분된다.
2. 상태별 필수 필드 누락·잘못된 hash·evidence 오류를 fail-closed 검증한다.
3. round-trip과 canonical hash가 deterministic하다.
4. 테스트, compileall, `git diff --check` 통과.

## 결과보고

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED`와 변경·검증·미검증·rollback을 보고한다.
