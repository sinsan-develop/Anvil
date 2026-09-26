# F-18 R34 OIDC session coordinator 구현 계획

> 승인된 F-18 WorkInstruction의 인증 내부 Stage다. 기준은 `Anvil_설계서_v2.md` §49.8, `Anvil_작업계획서_v1.md` F-18, `F-18_WSL_OPS_WORK_INSTRUCTION.md`, R30~R33 계약과 seq1598 checkpoint다. 공개 API/화면/runtime·issuer 환경·DB schema 변경 없이 검증된 code flow, 서버 소유 권한과 영속 session을 순서대로 결합한다. 이것은 R33 계획의 후속 결합을 coordinator(R34)와 same-origin API(R35 이후)로 분할한 내부 순서 결정이며 새 기능 범위가 아니다.

**Goal:** 검증된 OIDC code flow에서만 단기 opaque 세션을 발급하고, 매 인증 요청에 최신 서버 권한을 다시 확인하며 만료·철회·step-up 실패를 거부한다.

**Architecture:** `OidcCodeFlow.complete`가 검증한 `OidcIdentity`를 R32 `bind_oidc_principal`로 결박한 뒤 R33 저장소에 SHA-256 digest와 issuer/subject·CSRF·TTL/step-up 시각만 저장한다. 반환 bearer와 CSRF는 독립 난수 32-byte의 base64url(각 43자)이며 DB에는 bearer 원문이나 권한 snapshot을 넣지 않는다. `authenticate`는 R33 저장소를 읽고 R32 resolver+policy를 매번 적용한다. 완료된 code flow는 재사용할 수 없으며 인증 실패는 비식별 코드로만 노출한다.

**Tech Stack:** Python, pytest, 기존 OIDC code flow·principal policy·SQLAlchemy session store. 로컬 구현 후 같은 SHA를 `ssh WSL-server`의 전용 clean checkout에서 scoped 검증한다.

**Spec:** `Anvil_설계서_v2.md`, `Anvil_작업계획서_v1.md`, `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md`, R30~R33 WorkInstruction.

## 전역 제약

- 제품 exact3: `packages/api/oidc_session_coordinator.py`, `tests/api/test_oidc_session_coordinator.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. Main이 canonical worker/write lease로 결박하기 전 제품 write 금지. Main control/progress/HANDOFF는 별도 Main 소유다.
- `LocalTestSessionService`, 기존 R30~R33 제품 파일, runtime/FastAPI/Web·공개 `/auth/*`·DB schema/기존 데이터는 수정하지 않는다. 실제 issuer·same-origin API/browser는 후속 Stage다.
- `OidcSessionCoordinator(code_flow: OidcCodeFlow, resolver: OidcPrincipalResolver, policy: OidcPrincipalPolicy, session_store: SqlAlchemyOidcSessionStore, clock: Callable[[], datetime], random_bytes: Callable[[int], bytes])`는 의존성 검사 후 fail-closed다. 기본 clock은 UTC 현재시각, 기본 random은 `secrets.token_bytes`다.
- `.begin(require_step_up: bool = False) -> OidcAuthorizationRequest`, `.complete(*, code: str, state: str, browser_state: str) -> OidcIssuedSession`, `.authenticate(session_token: str) -> SessionPrincipal | None`, `.revoke(session_token: str) -> None`를 제공한다. `OidcIssuedSession`은 `session_token`·`csrf_token`을 repr에 표시하지 않고 `expires_at`·`max_age_seconds=900`을 포함한다.
- `complete`는 code flow가 검증한 identity를 먼저 서버 resolver/policy로 결박한다. 결박 실패 시 session DB write 0이다. 32-byte 독립 난수 두 개의 base64url token/CSRF가 같거나 형식이 틀리면 발급을 거부한다. 성공 session 수명은 최대 900초이며 다른 session을 임의 철회하지 않는다.
- step-up은 verified identity와 유효한 `auth_time`만 사용한다. 그 expiry는 `min(auth_time+300초, 발급 now+300초, session expiry)`를 넘지 않으며 저장소 유효성에 맞지 않으면 발급 거부한다. `authenticate`에서 step-up expiry가 지났으면 일반 권한으로 조용히 낮추지 않고 세션 자체를 거부한다. 매번 R32 resolver/policy를 다시 조회하여 role·permission·project/environment 비활성화가 즉시 거부되게 한다.
- `authenticate`의 malformed bearer는 저장소 조회 없이 `None`, 만료·철회·미등록·권한 불일치도 `None`이다. 저장소·resolver의 내부 장애는 성공 또는 일반 사용자 권한으로 처리하지 않으며 비식별 `OIDC_SESSION_NOT_AVAILABLE`로 거부한다. 발급·입력 실패는 `OIDC_SESSION_NOT_AUTHORIZED`로 거부한다. Resolver는 호출당 한 번 조회하고 그 응답을 해당 호출 안에서만 R32 `bind_oidc_principal`에 전달한다. `OidcDirectoryRejected`의 `NOT_AVAILABLE`과 비인가 결과를 구분하되 내부 원문은 전달하지 않는다. 예외 cause/context, repr, 로그/보고서에는 code/state/bearer/CSRF/ID token/SQL 원문을 남기지 않는다.
- 로컬 개발→commit/push→WSL-server 전용 clean checkout의 동일 SHA 검증만 수행한다. WSL-server 기존 서비스·공유 DB 및 ysna-server/Production은 대상이 아니다. F-18 accepted=false/F-19 차단/Production NOT_EXECUTED를 유지한다.

## 리뷰 초점

- 미검증 identity 또는 token claim에서 role·permission을 만들지 않도록 실제 `OidcCodeFlow.complete`와 R32 binding을 순서대로 사용한다.
- 서버 권한이 철회된 기존 session의 다음 `authenticate`가 거부되어야 한다. 저장된 authority snapshot 사용은 결함이다.
- step-up 만료가 일반 세션으로 조용히 강등되지 않아야 하고, `auth_time` 경계·clock skew가 권한 유효기간을 늘리지 않아야 한다.
- bearer/CSRF 독립성, 정확한 digest 저장, 형식 오류·중복·저장소 장애의 fail-closed 및 비식별 오류를 테스트한다.
- 성공적인 새 로그인은 이전 session을 지우지 않는다. 명시적 revoke는 해당 digest에만 적용한다.

## Task 1: OIDC code-flow→server authority→session 경계

**Files:** 제품 exact3만. 기존 계약은 읽기 전용으로 사용한다.

**Interfaces:** 위 coordinator 네 메서드와 `OidcIssuedSession`; R31 `OidcCodeFlow`, R30 `OidcIdentity`·R32 `bind_oidc_principal`, R33 `SqlAlchemyOidcSessionStore`.

- [ ] RED: 실제 R31 signed-token flow와 R32 resolver/R33 SQLite store를 결합한 성공·재사용 거부 테스트를 먼저 만들고 미구현 실패를 관측한다. 다른 session 유지, revoke/expiry, 권한 철회, step-up 시각 경계, malformed bearer·난수, store/resolver 장애와 비식별 오류를 순차 RED로 확인한다.
- [ ] GREEN: exact API만 구현한다. API route·runtime·네트워크·migration·LocalTestSession 변경은 하지 않는다.
- [ ] 회귀: 신규 테스트와 R30~R33 focused, 전체 pytest 시도. 명령·exit·PASS/SKIP/기존 collection 오류를 별도로 기록한다.
- [ ] Main 독립 diff/exact3·테스트·review Critical/Important 0 후 제품 SHA push/G-05. WSL-server의 전용 clean checkout에서 같은 SHA로 scoped 테스트 후 즉시 정리한다. 이 결과는 실제 issuer/API/browser PASS가 아니다.
- [ ] Main이 증거를 확인해 write→worker lease 회수, WORK_STATUS/보고서·manifest/G-05 갱신. 다음은 same-origin API/runtime 결합이다.

Rollback: R34 제품 commit의 정상 revert. R33 DB schema나 기존 session 행에는 자동 변경이 없으므로 데이터 downgrade를 수행하지 않는다.
