# A-08 Human ReleaseDecision

`STATIC_ONLY` / `RUNTIME_DEFERRED / NOT_EXECUTED`. Assigned `AV-UI-008`, `AV-UI-009`, `AV-FLOW-025`; ProductValidation NOT_EXECUTED, Release NOT_EXECUTED. Package ACCEPTED is not RELEASE.

ReleaseDecision은 인증된 사람만 RELEASE/REWORK/DEFER/REJECT 중 하나로 기록한다. Developer와 Agent의 결정은 금지한다. RELEASE·Apply·Deploy는 모든 필수 PV 완료, BLOCKED/UNSUITABLE 없음, blocking defect 없음, target/delivered/evidence hash 일치, 인증된 사람 결정을 동일하게 요구한다.

REWORK는 후속 진행을 멈추고 WI revision과 fresh validation을 요구한다. DEFER는 reason, risk, review time, carryover를 요구하고 downstream을 비활성화한다. REJECT는 Apply·Deploy를 금지하며 새 사람 결정 전 재개하지 않는다. hash 변경은 evidence, PV, retest, acceptance, release와 downstream eligibility를 무효화한다. disabled 동작은 reason과 next_action을 제공한다.
