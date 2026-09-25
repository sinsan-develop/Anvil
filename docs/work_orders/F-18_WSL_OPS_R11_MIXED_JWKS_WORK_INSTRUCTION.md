# F-18 R11 Mixed-Use JWKS WorkInstruction

- 담당: `developer-primary`; Main은 통제/evidence·원격 push·WSL-server QA·실제 issuer 재검증을 소유한다.
- 기준: 승인된 설계서·작업계획서 F-18, `F-18_WSL_OPS_R11_MIXED_JWKS_PLAN.md`, canonical seq1553. 시작 HEAD와 epoch9 worker/write lease는 Main invocation에서 확인한다.
- 허용 제품 exact3: `packages/api/oidc_identity.py`, `tests/api/test_oidc_identity.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.
- 목표: 혼합 용도 JWKS의 비서명 키를 신뢰 후보에서 제외하고 정상 RS256 토큰 검증을 허용한다. 후보 key의 구조·개인키·중복 kid·토큰 헤더/서명/claim 거부는 유지한다.
- 금지: 공개 API·session/role/permission·DB·Secret·브라우저·WSL runtime·Keycloak 설정·다른 파일, 새 branch·별도 subagent·원격 push/merge.
- 실행: 계획의 TDD RED→GREEN, 관련 회귀·잠긴 로컬 환경·전체 pytest 시도·diff-check, exact3 clean commit. 전체 pytest 기존 13 collection ERROR나 미실행 lint를 PASS로 표시하지 않는다.
- 보고: 기준 문서 hash·시작 HEAD/branch/status, 변경 exact3/diff, 명령/exit/PASS·FAIL·SKIP, 실제 issuer/WSL/API/browser/Production 미검증, rollback, progress/HANDOFF 변경 없음, 정식 실패 횟수.
