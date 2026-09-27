# F-18 R31 OIDC PendingAuthStore 구현 계획

목표: R8 `OidcCodeFlow`의 `PendingAuthStore` Protocol을 PostgreSQL 18 격리 환경에서 원자·일회성으로 구현한다. 이 Stage는 실제 로그인/세션/API/issuer 검증을 주장하지 않는다.

기준: 승인된 F-18 WorkInstruction 단계3, R30 종료 seq1583, `docs/WORK_STATUS.md`의 R31 경계 조사. 기존 `codex/f18-wsl-ops` 한 브랜치와 `developer-primary` 단일 writer만 사용한다.

## 설계·위험 경계

- 새 `oidc_pending_auth` 전용 additive table과 저장소를 사용한다. 기존 `telegram_*`, `agent_owner_*`, `LocalTestSessionService` 테이블/동작은 변경하지 않는다.
- state는 SHA-256 digest만 primary key로 저장하고 raw state·authorization code·ID token·client secret은 저장하지 않는다. `nonce`와 PKCE `code_verifier`는 단기 민감자료이므로 암호/로그/오류 응답에 싣지 않으며 전용 DB role·접근 제한과 TTL 300초를 적용한다. 새 Secret을 만들거나 운영 DB를 만지지 않는다.
- `put`은 중복 state digest를 덮어쓰지 않고 거부한다. `consume`은 단일 DB transaction의 `DELETE ... RETURNING`으로 한 요청만 성공시키며 replay·경합 시 `None`이다. 만료 판단은 DB UTC 시각으로 수행하고 만료 row는 반환하지 않는다. `OidcCodeFlow.complete()`의 추가 만료 검사를 보존한다.
- schema migration은 F-18 OIDC 실측을 위한 내부 저장 수단이다. 기존 표와 데이터를 수정하지 않는다. `downgrade`는 row가 남으면 데이터 손실 가능성으로 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`를 반환하고 자동 삭제하지 않는다.
- 이 Stage의 WSL QA는 SSH `WSL-server`의 신규 전용 경로·격리 PG18 Compose와 합성자료에만 한정한다. 생성 전 정확한 이름·owner·수명·정리를 WORK_STATUS에 기록하고, 로컬 push의 동일 제품 SHA로 검증·잔류0 확인한다. `ysna-server`·Production 제외.

## Task 1 — migration과 원자 저장소

제품 exact5: `migrations/versions/0017_oidc_pending_auth.py`, `packages/persistence/oidc_pending_auth.py`, `tests/persistence/test_oidc_pending_auth.py`, `tests/persistence/test_oidc_pending_auth_postgres.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

1. RED: metadata/schema 존재, digest/nonce/verifier 입력 검증, put→consume 일회성, 같은 digest 중복 거부, 만료 거부, 동시 consume 한 건만 반환, DB 오류 redaction, migration downgrade 비어 있음/row 잔존 거부를 테스트한다. Postgres 실측은 WSL QA에서 별도 수행하고 로컬 테스트 double을 실측으로 승격하지 않는다.
2. GREEN: PostgreSQL `DELETE ... RETURNING` 기반 저장소를 구현한다. SQL 실행 실패 시 상태/nonce/verifier 등 원문 없는 `OIDC_PENDING_STORE_NOT_AVAILABLE`로 실패시키며, 실패한 put/consume transaction은 rollback된다. `PendingOidcRequest` 불변 타입·UTC aware expiry·최대 300초와 digest 32바이트를 검증한다.
3. 회귀: R8 code flow, R30 principal, 기존 migration contract 및 해당 persistence tests, py_compile/정적·`git diff --check`를 실행한다. 전체 pytest도 한 번 시도하고 기존 collection 오류와 신규 오류를 분리한다.
4. exact5 제품 commit 후 Main 독립 diff/테스트 review, 지정 Git branch push, G-05 확인. WSL은 clean detached 동일 SHA로 격리 PG18 migration + 실제 동시성/만료/rollback을 재실행하고 전용 자원만 정리한다.
5. Main은 제품 증거·WSL 잔류0·Critical/Important 0을 확인한 뒤 새 lease를 write→worker 순으로 회수한다. 후속 trusted mapping/session/API Stage까지 F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`.

Rollback: 새 table에 row가 없음을 확인할 때만 0017 downgrade; row가 있으면 결정 요구로 중단한다. 제품 commit은 별도 revert 가능하며 이전 migration/인증 경로는 불변이다.
