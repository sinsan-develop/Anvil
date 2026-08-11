# A-08 Completion·Plan-vs-Actual

`STATIC_ONLY` / `RUNTIME_DEFERRED / NOT_EXECUTED`. Assigned `AV-UI-008`, `AV-UI-009`, `AV-FLOW-025`; ProductValidation NOT_EXECUTED, Release NOT_EXECUTED. Package ACCEPTED is not RELEASE.

Completion Summary는 Developer 결과, Main 예비 수락, 독립 기술검증, criterion ProductValidation, 결함 판정, 사람 ReleaseDecision, Apply/Deploy 가능성을 별도 행으로 표시한다. 계획 대비 실제는 항목별 planned scope, actual scope, 상태, difference, reason, impact, evidence refs, next_action을 모두 보존하며 차이를 숨기지 않는다.

기술 결과는 PASS/FAIL/SKIPPED/BLOCKED/ERROR만 허용한다. 정적·mock·build·미실행은 실제 기능 PASS가 아니다. 권한이 없는 동작은 disabled 상태와 reason 및 next_action을 제공하며 설명은 i 아이콘 툴팁/팝오버로 표시한다.
