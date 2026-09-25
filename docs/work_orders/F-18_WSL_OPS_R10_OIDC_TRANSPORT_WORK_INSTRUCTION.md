# F-18 R10 OIDC HTTPS Token Transport WorkInstruction

- 담당: `developer-primary`; Main은 control/evidence와 원격 push·WSL-server QA를 소유한다.
- 기준: 승인된 `Anvil_설계서_v2.md`, `Anvil_작업계획서_v1.md` F-18, `F-18_WSL_OPS_R10_OIDC_TRANSPORT_PLAN.md`, canonical seq1548. 제품 시작 HEAD와 유효한 epoch8 worker/write lease는 Main이 invocation에 고정한다.
- 허용 제품 경로 exact6: `packages/api/oidc_issuer_transport.py`, `tests/api/test_oidc_issuer_transport.py`, `pyproject.toml`, `uv.lock`, `deploy/wsl/requirements-runtime.txt`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.
- 목표: 고정 HTTPS issuer의 token endpoint에 R8 PKCE authorization code를 안전하게 교환하고 `id_token`만 R7 검증 경계에 전달한다. client Secret은 주입 port로만 읽고 로그·repr·오류·Git에 남기지 않는다.
- 금지: 공개 API/브라우저 코드/session/role/permission/DB schema·migration/Secret 파일/기존 서비스/WSL runtime 수정, 새 branch, 별도 subagent, 원격 push·merge. Keycloak·실제 issuer QA는 Main 소유다.
- 실행: 계획의 TDD RED→GREEN, 잠긴 로컬 관련 회귀, 전체 pytest 시도, runtime dependency diff·`git diff --check`, exact6 clean commit. 기존 13 collection ERROR는 별도 보고하고 전체 PASS로 승격하지 않는다.
- 보고: 기준 문서 hash, 시작 HEAD·branch·status, 변경 exact6/diff, 실행 명령·exit·실제 PASS/FAIL/SKIP, Secret redaction, 미검증, rollback, progress/HANDOFF 변경 없음, 정식 실패 횟수. 동일 문제의 유효 FAILURE_REPORT 3회 전에는 Main 제품 takeover 금지.
