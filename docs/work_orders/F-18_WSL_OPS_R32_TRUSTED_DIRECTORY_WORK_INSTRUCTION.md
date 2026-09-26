# F-18 R32 OIDC trusted directory WorkInstruction

- 담당 `developer-primary`. 기준은 승인된 F-18 기본 WorkInstruction 단계3과 `F-18_WSL_OPS_R32_TRUSTED_DIRECTORY_PLAN.md`; 동일 branch `codex/f18-wsl-ops`, R31 종료 seq1588. Main이 새 canonical worker/write lease와 제품 exact5를 발행·검증한다.
- 분류 `MAIN_RECONFIRMED_NON_SEMANTIC`: 설계서의 `users/roles/user_roles`와 승인된 OIDC 실제 검증을 위한 내부 구현·파일 배치다. 공개 API, 운영 권한 의미·대상은 변경하지 않는다. 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`. 새 migration은 Main의 WSL-server 격리 PG18 QA에서만 적용한다.
- 제품 exact5: `migrations/versions/0018_oidc_principal_directory.py`, `packages/persistence/oidc_principal_directory.py`, `tests/persistence/test_oidc_principal_directory.py`, `tests/persistence/test_oidc_principal_directory_postgres.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.
- 목표: 서버 소유 활성 user/role/membership/issuer-subject 계보를 read-only `OidcPrincipalResolver`로 조회한다. 단일 role·project·environment만 허용하고 토큰 claim 권한 승격, 비활성/손상/다중 범위, DB 오류 정보 노출을 RED→GREEN으로 거부한다. 전용 additive migration과 data-bearing downgrade 거부를 구현한다.
- 금지: runtime/API·기존 migration·R30 principal/R31 pending store·LocalTestSessionService 수정, provisioning API·운영 user/role 데이터·Secret·공유 DB·WSL/Production 자원, 제품 writer의 branch push/merge, 실제 OIDC login/session PASS 주장.
- 보고: 기준 문서 hash, 시작 HEAD/branch/status, exact5 diff, RED/GREEN/회귀/전체 pytest 명령·exit·결과, 미검증 issuer/session/API/browser/WSL/Production, rollback과 정식 실패 횟수를 기존 F-18 보고서에 기록한다. Main 통제 progress/HANDOFF는 수정하지 않는다.
