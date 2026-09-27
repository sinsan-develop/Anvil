# F-18 R31 OIDC PendingAuthStore WorkInstruction

- 담당 `developer-primary`. 기준은 F-18 기본 WorkInstruction 단계3과 `F-18_WSL_OPS_R31_PENDING_STORE_PLAN.md`; 현재 branch `codex/f18-wsl-ops`, R30 종료 seq1583. Main은 canonical worker/write lease와 제품 exact5를 발행·검증한다.
- 분류 `MAIN_RECONFIRMED_NON_SEMANTIC`: 승인된 OIDC 실제 검증의 내부 영속 구현·파일 배치다. 기능 범위·공개 API·권한 의미·운영 대상은 바꾸지 않으며 부모 승인은 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`이다. 새 migration은 격리 WSL PG18에서만 적용하고 기존 DB·Production에는 적용하지 않는다.
- 제품 exact5: `migrations/versions/0017_oidc_pending_auth.py`, `packages/persistence/oidc_pending_auth.py`, `tests/persistence/test_oidc_pending_auth.py`, `tests/persistence/test_oidc_pending_auth_postgres.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.
- 목표: `PendingAuthStore`의 입력 검증·중복 방지·원자 일회성 consume·만료·오류 redaction과 additive migration/데이터 손실 방지 downgrade를 RED→GREEN으로 구현한다. 실제 PostgreSQL 증거는 Main의 WSL 격리 QA가 소유한다.
- 금지: `OidcCodeFlow`·기존 runtime/API/LocalTestSessionService/기존 migration 수정, 새 Secret·전역 설정·공유 DB·WSL/Production 자원, 다른 제품 파일 변경, 제품 writer의 branch push·merge, 실제 OIDC login/session PASS 주장.
- 보고: 기준 hash, 시작 HEAD/branch/status, exact5 diff, RED/GREEN·회귀·전체 pytest 시도 명령/exit와 실제 결과, 미검증 issuer/trusted mapping/session/API/browser/WSL/Production, rollback 및 정식 실패 횟수를 기존 F-18 보고서에 누적한다. Main 통제 progress/HANDOFF는 수정하지 않는다.
