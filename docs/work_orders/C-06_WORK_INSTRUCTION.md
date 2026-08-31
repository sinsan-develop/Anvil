# C-06 WorkInstruction — 유효 FAILURE_REPORT 판별기

## 목표

C-05 Result Envelope의 `FAILURE_REPORT`가 동일 failure lineage/fingerprint 집계에 사용할 수 있는 유효 보고인지 fail-closed로 판별한다.

## 범위

- 원인·증거·변경 경로·잔여 작업·Main 판단 요청 필수 조건을 검증한다.
- lineage와 failure fingerprint 형식·결정성을 검증하고 누락·빈 값·변조를 거부한다.
- 유효 보고와 단순 도구중단·권한/환경 문제·근거 없는 선언을 구분하는 reason code를 제공한다.
- C-05 Envelope와 연동되는 deterministic validator 및 hostile 테스트를 작성한다.

## 금지

- C-07 outcome resolver·failure count 누적·takeover 구현 금지
- 외부 Provider/DB/API/browser/deployment 및 historical progress 수정 금지

## 완료조건·검증

1. 모든 필수 failure 필드와 증거가 없으면 유효 보고로 판정하지 않는다.
2. lineage/fingerprint가 동일 입력에서 deterministic하다.
3. 환경 오류·권한·quota·근거 없는 실패 선언을 정식 failure에서 제외한다.
4. 테스트, compileall, `git diff --check` 통과.

## 결과보고

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED`와 변경·검증·미검증·rollback을 보고한다.
