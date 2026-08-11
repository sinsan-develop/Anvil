# A-08 Technical Test·ProductValidation

`STATIC_ONLY` / `RUNTIME_DEFERRED / NOT_EXECUTED`. Assigned `AV-UI-008`, `AV-UI-009`, `AV-FLOW-025`; ProductValidation NOT_EXECUTED, Release NOT_EXECUTED. Package ACCEPTED is not RELEASE.

기술 테스트와 사용자 기능판정은 분리한다. ProductValidation은 필수 criterion마다 SUITABLE/NEEDS_IMPROVEMENT/UNSUITABLE/BLOCKED, required, target hash, delivered hash, evidence, validator actor, reason, next_action을 기록한다. 필수 criterion 누락, BLOCKED/UNSUITABLE, hash 불일치는 RELEASE·Apply·Deploy를 모두 막는다.

Evidence Drawer는 hash, 출처, 시간, actor, 실행 분류를 보여주되 secret·credential·내부 endpoint는 노출하지 않는다. 정적 E-SHOT은 실제 MI/AE/E-EVT/E-DEC 증거가 아니다.
