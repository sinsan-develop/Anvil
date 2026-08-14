# B-03 Design Lineage Validation R2

- finding: `AV-FLOW-001 L4+L7 E-SHOT/E-EVT NOT_EXECUTED`
- result: `FIXED_PENDING_INDEPENDENT_RETEST`
- baseline: `fcfa8059e060702afa6ea5fa801d40c4cb01cb63`

TDD RED는 Python actual-service bridge 3건이 module 부재로 exit 1, Node same-origin runtime 2건이 404로 exit 1이었다. 최소 bridge 후 Python `3/3 PASS`, Node `2/2 PASS`다. bridge는 subprocess를 통해 `packages.api.design_runtime`을 실행하고, 이 모듈은 R1 `DesignLineageService`를 직접 호출한다.

실제 브라우저에서 `/design-flow`를 열어 정상·오류·BLOCKED 버튼을 각각 클릭했다. 정상은 복수 proposal과 인증 actor 뒤 baseline 및 5개 ordered event를 표시했다. 오류는 단일 proposal을 거부했고, BLOCKED는 사람 decision 전 baseline 생성을 거부했다. 세 화면을 실제 viewport screenshot으로 저장했고 정상 browser event를 E-EVT JSON에 고정했다. 브라우저 코드는 same-origin `/api/design-flow/*`만 호출하며 Host/Origin/CSRF 검증을 통과해야 한다.

이 경로는 `LOCAL_VERIFICATION_ONLY`이며 B-11 canonical registry/SSE/auth middleware가 아니다. production/provider/shared/WSL DB/deploy는 `NOT_EXECUTED`다.

회귀: design `14/14`, domain `14/14`, persistence `7/7`, 기존 A14 browser `3/3` PASS. tooling은 `270/282 PASS`; A13 dirty evidence 4, project dirty 6, R2가 lease대로 `apps/web/server.mjs`를 수정해 frozen A14 checksum이 달라진 2건이다. 이는 독립 Tester가 successor evidence와 함께 판정해야 하며 숨기지 않는다.
