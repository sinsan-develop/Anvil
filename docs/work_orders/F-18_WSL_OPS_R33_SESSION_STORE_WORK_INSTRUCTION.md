# F-18 R33 OIDC session store WorkInstruction

- 담당 `developer-primary`; 같은 branch `codex/f18-wsl-ops`, 기준 R32 종료 seq1593. Main이 새 canonical epoch17 worker/write lease와 exact5 path를 발행·검증한 뒤 착수한다.
- `MAIN_RECONFIRMED_NON_SEMANTIC`: 승인 F-18 OIDC 실제 검증을 위한 내부 영속 세션 저장 경계다. 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`; 공개 API·운영 권한 확대 없음. 설계·계획·검증 기준 hash는 기본 WorkInstruction과 동일하다.
- 제품 exact5: `migrations/versions/0019_oidc_sessions.py`, `packages/persistence/oidc_session_store.py`, `tests/persistence/test_oidc_session_store.py`, `tests/persistence/test_oidc_session_store_postgres.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.
- 목표·인터페이스·거부 사례·RED→GREEN·검증·rollback은 `F-18_WSL_OPS_R33_SESSION_STORE_PLAN.md`를 따른다. SQLite 테스트는 계약, PG18은 격리 실제 DB 증거다.
- 금지: API/runtime/Web·LocalTestSessionService·기존 migration/테이블·R30~R32 파일 수정, token 발급·권한 claim 저장·운영 user 데이터/Secret, WSL/Production 자원 작업, writer의 push/merge.
- 보고: 시작 HEAD/branch/status, 기준 hash·lease 두 token, exact5 diff, RED/GREEN/회귀/전체 pytest 명령·exit·결과, PG opt-in SKIP와 실제 WSL/issuer/API/browser 미검증, rollback·오류 횟수를 기존 F-18 보고서에 기록한다. Main control progress/HANDOFF는 수정하지 않는다.
