# F-18 R32 OIDC 서버 소유 권한 디렉터리 구현 계획

> 승인된 F-18 단계3 내부 구현 계획이다. `Anvil_설계서_v2.md` 17.1·18.1·49.8, `Anvil_작업계획서_v1.md` F-18, F-18 기본 WorkInstruction 단계3 및 R30/R31 계약을 따른다.

목표: 검증된 `(issuer, subject)`를 서버 소유 `users/roles/user_roles` 계보의 단일 활성 역할·프로젝트·환경에만 결박하는 `OidcPrincipalResolver`를 PostgreSQL 격리 QA에서 검증한다. 실제 OIDC 로그인/세션/API 연결은 다음 Stage다.

## 경계와 선택

- 현재 migration 0001~0017에 `users`, `roles`, `user_roles`가 없으므로 R32 전용 additive migration `0018`을 만든다. 기존 표·데이터·`LocalTestSessionService`·OIDC token verifier·pending store·runtime/API는 수정하지 않는다. 새 테이블은 서버 내부 권한 정본이며 token의 `role`, `scope`, `project` claim을 읽지 않는다.
- `users(actor_id PK, active)`, `roles(role_code PK, permissions JSON)`, `user_roles(actor_id PK/FK, role_code FK, project_id, environment_id, step_up_required, active)`, `oidc_subject_bindings(issuer+subject PK, actor_id FK, active)`를 둔다. 첫 OIDC 세션의 `SessionPrincipal`이 role 한 개와 project/environment 각각 독립 집합만 표현하므로, 권한 교차 곱 확대를 막기 위해 활성 사용자당 정확히 한 역할·한 프로젝트·한 환경만 허용한다. 다중 범위 지원은 명시적 paired-scope 계약을 따로 설계하기 전에는 거부한다.
- 제품에는 read-only resolver만 제공한다. 서버 관리자가 관리하는 영속 매핑의 provisioning/mutation API, 운영 user/role 데이터, 새 Secret, 공개 API·권한 확대는 이 Task에서 만들지 않는다. 합성 seed는 격리 테스트 fixture만 사용한다. 권한 상한은 기존 `bind_oidc_principal`의 서버측 `OidcPrincipalPolicy`가 다시 검사한다.
- raw issuer·subject는 이 내부 테이블의 복합 키로 저장하되 Secret/token/authorization code는 저장하지 않는다. DB role의 SELECT/접근 경계는 실제 WSL 격리 QA에서 확인한다. 오류 문자열·로그에는 식별자/SQL parameter가 새지 않는다. 비활성·누락·중복/손상·잘못된 role/permission은 fail-closed다.
- `downgrade`는 전용 네 테이블 중 하나라도 row가 남으면 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 거부한다. PostgreSQL에서는 count→drop 동안 네 표의 동시 쓰기를 막는 잠금을 획득한다. 기존 migration0017의 row·표는 보존한다.

## 제품 Task 1 — migration·read-only resolver

제품 exact5: `migrations/versions/0018_oidc_principal_directory.py`, `packages/persistence/oidc_principal_directory.py`, `tests/persistence/test_oidc_principal_directory.py`, `tests/persistence/test_oidc_principal_directory_postgres.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

1. RED: 테이블/FK·empty/data-bearing downgrade, 정상 서버 소유 mapping→`OidcPrincipalBinding`, 비활성/missing/잘못된 식별자·권한·중복 JSON/다중 범위 거부, DB 오류 redaction을 테스트한다. 정책 상한/step-up은 R30 테스트를 회귀로 재실행한다. PostgreSQL 동시 INSERT는 WSL 격리 opt-in으로 분리한다.
2. GREEN: `SqlAlchemyOidcPrincipalResolver(sessionmaker)`는 `(issuer, subject)`로 parameterized SELECT JOIN만 수행하고 활성 네 계보가 일치할 때 단일 `OidcPrincipalBinding`을 반환한다. 읽기 외 commit/insert/update를 하지 않는다. 조회 실패는 안정된 비식별 오류로 fail-closed한다. migration downgrade는 데이터 손실을 막는다.
3. 로컬 관련 회귀: 새 파일 두 개, `tests/api/test_oidc_principal.py`, R31 pending store, migration contract. 정적/compile·diff-check와 전체 pytest도 시도하고 기존 collection 오류와 신규 오류를 분리한다.
4. Main은 exact5 제품 commit·독립 review Critical/Important 0 후 지정 branch push, G-05를 확인한다. WSL-server에는 동일 공개 SHA의 전용 clean checkout과 별도 PG18 tmpfs/비관리자 role을 생성해 실제 migration/seed/lookup/denial/downgrade·경합을 검증하고 전용 자원만 정리한다. 정식 WSL 통합·실 issuer·browser·Production PASS로 승격하지 않는다.
5. Main이 증거를 검토하고 epoch16 write→worker lease를 회수한다. F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`를 유지한다. 다음은 세션 lifecycle과 제품 same-origin `/auth/*` 연결이다.

Rollback: R32 코드 commit은 정상 revert 가능하다. `0018`은 전용 네 표 모두 empty일 때만 downgrade; row가 있으면 사람의 데이터 손실 판단을 요구하고 자동 삭제하지 않는다.
