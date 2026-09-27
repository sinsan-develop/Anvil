# F-18 R33 OIDC 영속 세션 저장소 구현 계획

> 승인된 F-18 WorkInstruction 단계 3의 내부 하위 단계다. 기준은 설계서 v2 §17.1·18.1·49.8, 작업계획서 v1 F-18, 기본 `F-18_WSL_OPS_WORK_INSTRUCTION.md`, R30~R32 OIDC 계약, `codex/f18-wsl-ops`의 R32 종료 seq1593이다. 새 기능 범위·공개 API·운영 권한 변경 없이 다음 세션 결합 단계의 영속 원자 저장 경계만 만든다.

**Goal:** 검증된 OIDC 코드 흐름과 서버 권한 결박 뒤에만 사용할 수 있는, 짧은 수명의 PostgreSQL 세션 레코드를 보관·조회·철회한다.

**Architecture:** 제품 API는 아직 세션 발급을 노출하지 않는다. 저장소는 caller가 만든 32-byte 세션 토큰 SHA-256 digest와 issuer/subject·CSRF·만료·step-up 유효시각만 다루며 권한·role·project를 저장하거나 자체 발급하지 않는다. 후속 coordinator는 매 인증마다 R32 서버 소유 resolver와 R30 policy를 다시 적용하고, step-up 만료 시 일반 권한으로 조용히 강등하지 않고 정책대로 거부한다.

**Tech Stack:** Python, SQLAlchemy, Alembic, pytest, 로컬 SQLite 계약 테스트, WSL-server 격리 PostgreSQL 18 opt-in 실측.

**Spec:** `Anvil_설계서_v2.md`, `Anvil_작업계획서_v1.md`, `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md`, R30~R32 WorkInstruction.

## 전역 제약

- 로컬 개발→안전한 commit/push→`ssh WSL-server`의 clean detached 동일 SHA 검증만 수행한다. `ysna-server`/Production·공유 DB·기존 서비스는 대상이 아니다.
- 제품 exact5: `migrations/versions/0019_oidc_sessions.py`, `packages/persistence/oidc_session_store.py`, `tests/persistence/test_oidc_session_store.py`, `tests/persistence/test_oidc_session_store_postgres.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. Main이 canonical epoch17 worker/write lease로 결박하기 전 제품 write 금지.
- `LocalTestSessionService`, R30~R32 구현, runtime, FastAPI, Web, 공개 `/auth/*`, 기존 migration·데이터를 변경하지 않는다. API·브라우저·실제 issuer는 후속 검증으로 남긴다.
- DB에는 raw bearer session token·OIDC code·ID token·PKCE secret·권한 claim을 저장하지 않는다. CSRF 값은 bearer가 아니며 DB 내 접근 제한을 전제로 저장하되 오류·로그에는 노출하지 않는다. DB 입력·출력 오류는 비식별 안정 코드로 변환한다.
- 수명 상한 900초, 명시적 UTC-aware 시간만 허용, 만료 판단은 PostgreSQL DB 현재시각 기준이다. `get`은 만료·철회에 `None`, `revoke`는 해당 digest에만 작용하며 반복 호출은 안전하다. 새로운 성공 세션이 다른 세션을 임의 철회하지 않는다.
- issuer/subject는 R32의 길이·canonical 규칙(각 최대 2048/512)을 따른다. CSRF는 정확히 43자의 base64url 문자열, digest는 정확히 32-byte `bytes`만 허용한다. `expires_at`은 DB now보다 미래이며 now+900초 이내다. `step_up_valid_until`은 선택적이고 있으면 DB now보다 미래, `expires_at` 이하, DB now+300초 이하여야 한다. 읽을 때 이 시각을 연장하지 않는다.
- 저장소 실패 코드는 `OIDC_SESSION_STORE_INVALID_INPUT`, `OIDC_SESSION_STORE_DUPLICATE`, `OIDC_SESSION_STORE_NOT_AVAILABLE`만 사용한다. DB 예외 원문·입력·SQL parameter는 exception cause/context로도 전달하지 않는다.
- `0019`는 기존 테이블·행을 건드리지 않는 additive migration이다. 전용 세션 테이블에 행이 있으면 downgrade를 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 거부하고 PostgreSQL에서는 count→drop 동안 쓰기 잠금으로 경합을 차단한다.
- F-18 accepted=false, F-19 차단, Production NOT_EXECUTED를 유지한다. fixture/local PASS를 실제 세션/API/브라우저/정식 WSL 통합 PASS로 승격하지 않는다.

## 리뷰 초점

- 빈/길이 오류 digest를 허용하거나 raw token을 DB에 저장하는 실수: 무효 입력 RED, DB 행 digest 32-byte 실측.
- 만료 직전 경계와 DB clock 경합: 경계 시각 조회·철회, PG 실제 DB clock 테스트.
- 동일 digest 재사용: 중복 insert 거부, 기존 레코드 불변.
- SQL 오류가 식별자/CSRF를 노출하거나 성공처럼 처리되는 실수: 안정 코드와 context 부재 테스트.
- 데이터가 있는 downgrade 또는 동시 INSERT가 삭제를 통과하는 실수: SQLite 거부 및 PG lock 경합 실측.

## Task 1: 격리 PostgreSQL 세션 레코드

**Files:** 위 exact5만. Main control 문서·projection은 별도 Main 소유.

**Interfaces:** `OidcStoredSession(issuer: str, subject: str, csrf_token: str, expires_at: datetime, step_up_valid_until: datetime | None)`; `SqlAlchemyOidcSessionStore(session_factory).put(session_digest: bytes, record: OidcStoredSession) -> None`, `.get(session_digest: bytes) -> OidcStoredSession | None`, `.revoke(session_digest: bytes) -> None`. `OidcSessionStoreRejected`는 입력/중복/DB 불가를 raw 값 없이 구분한다. 후속 Stage가 이 저장소를 사용하며 이번 Stage는 인증·권한 객체를 반환하지 않는다.

- [ ] RED: valid put/get/revoke, duplicate·invalid digest/issuer/subject/CSRF/time/TTL, expired lookup, DB 오류 redaction, empty/data-bearing downgrade를 각각 테스트하고 미구현 실패를 관측한다.
- [ ] GREEN: `0019` migration과 위 저장소 인터페이스를 최소 구현한다. 세션 token 생성·로그인/API 부작용은 넣지 않는다.
- [ ] 회귀: 신규 로컬 테스트 + R30/R31/R32 및 migration contract focused, 전체 pytest 시도. exit code·PASS/SKIP/기존 수집 오류를 구분한다.
- [ ] Main 독립 diff/exact5·테스트·review Critical/Important 0 후 제품 SHA push/G-05를 확인한다. WSL-server에는 전용 clean Git checkout과 tmpfs PG18 합성 DB·비관리자 role만 생성해 동일 SHA migration/TTL/중복/철회/downgrade·동시 쓰기 잠금을 검증하고 즉시 정리한다.
- [ ] Main이 증거를 확인해 write→worker lease를 회수하고 WORK_STATUS/보고서·manifest/G-05를 기록한다. 다음은 OIDC code-flow→권한 resolver→session coordinator/API same-origin 결합이다.

Rollback: 코드 commit은 정상 revert 가능. `0019` 전용 테이블이 비었을 때만 downgrade 가능하며 행이 있으면 자동 손실 없이 결정 대기한다.
