# A-08 Defect Lifecycle·Retest

`STATIC_ONLY` / `RUNTIME_DEFERRED / NOT_EXECUTED`. Assigned `AV-UI-008`, `AV-UI-009`, `AV-FLOW-025`; ProductValidation NOT_EXECUTED, Release NOT_EXECUTED. Package ACCEPTED is not RELEASE.

결함은 OPEN→ACCEPTED→FIXING→READY_FOR_RETEST→CLOSED 순서를 따른다. Developer는 CLOSED 처리, severity 하향, DEFERRED/REJECTED 판정을 할 수 없다. CLOSED는 독립 Tester의 동일 target hash 재검증과 fresh evidence를 요구한다. 잘못된 전이, target hash 변경, evidence 재사용은 fail closed다.

blocking defect가 남으면 RELEASE·Apply·Deploy가 비활성화되며 reason과 next_action이 표시된다. 결함 보드에는 lineage, severity, owner, target hash, retest actor/evidence/time을 표시한다.
