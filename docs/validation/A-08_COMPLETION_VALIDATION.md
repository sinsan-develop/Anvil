# A-08 Completion·Validation 정적 검증

- 판정: `STATIC_CONTRACT_PASS`
- 할당: `AV-UI-008`, `AV-UI-009`, `AV-FLOW-025 static slice`
- canonical runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`
- 실제 ProductValidation/Release/Apply/Deploy/DIR: `NOT_EXECUTED`

검증 범위는 Plan-vs-Actual, 기술 결과, criterion별 PV, 결함 lifecycle와 독립 same-target retest, 인증된 사람 ReleaseDecision, fail-closed RELEASE·Apply·Deploy guard, hash invalidation, 권한·비밀 비노출 정적 계약이다. 1920×1080 SVG는 화면 표준과 설명 인터페이스를 표현한다.

정적·mock·build·checker PASS는 실제 사용자 기능판정이나 릴리스가 아니다. `Package ACCEPTED is not RELEASE`. AV-FLOW-025 실제 L5+L7/E-EVT/E-DEC owner는 E-09이며 A-08에서는 실행하지 않았다.
