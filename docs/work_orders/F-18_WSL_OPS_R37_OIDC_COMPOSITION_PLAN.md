# F-18 R37 OIDC trusted composition 계획

> 승인된 F-18 운영 유사 인증의 내부 결합 Stage. 기준 branch `codex/f18-wsl-ops`, 시작 checkpoint `77f2f4bd8e15cea808d5964c4394cd41a993a2b2`, canonical seq1613. 설계·계획·매트릭스·테스트계획의 hash는 F-18 기본 WorkInstruction의 승인 binding과 동일하다. 새 인증 방식, 공개 API, DB schema/migration, Secret 저장소 또는 Production 배포를 추가하지 않는다.

## 목적·설계

- R7~R9/R30~R36의 이미 검증한 `OidcIssuerTransport`→`OidcIdTokenVerifier`→`OidcCodeFlow`→`SqlAlchemyPendingAuthStore`/`SqlAlchemyOidcPrincipalResolver`/`SqlAlchemyOidcSessionStore`→`OidcSessionCoordinator`를 하나의 신뢰된 서버 구성 함수로 결합한다. 제품 함수는 Git·Docker·DB migration·네트워크 탐지·Secret 파일 읽기·환경변수 전역 변경을 수행하지 않는다.
- 새 `packages/api/oidc_runtime_factory.py`에 `OidcRuntimeConfig` frozen dataclass와 `build_oidc_session_coordinator(config, session_factory, *, transport=None) -> OidcSessionCoordinator`를 둔다. config 입력은 exact issuer, client ID, HTTPS redirect URI, pinned JWKS JSON, step-up ACR, `OidcPrincipalPolicy`, 선택적 CA bundle 경로 및 요청 시 호출할 `client_secret: Callable[[], str] | None`다. JWKS와 secret provider는 `repr`에서 제외한다. `session_factory`와 test-only `httpx.BaseTransport`는 신뢰된 호출자만 주입한다.
- authorization URL과 token URL은 각각 `issuer.rstrip('/') + '/protocol/openid-connect/auth'`, `issuer.rstrip('/') + '/protocol/openid-connect/token'`에서 내부 파생한다. 별도 임의 endpoint 입력은 받지 않는다. 정책 issuer가 verifier/transport issuer와 다르거나 역할·permission·project·environment 허용 집합이 비었거나 부적합하면 앱 구성 전에 고정 비식별 오류 `OIDC_RUNTIME_NOT_CONFIGURED`로 거부한다. 하위 예외·JWK/Secret·issuer 응답 본문을 반사하지 않는다.
- R36 `create_runtime_app`에는 구성된 coordinator를 기존 명시 주입 경계로 전달할 수 있다. 하지만 이번 Stage는 ASGI 엔트리포인트·host 환경/Secret 로더·Web callback·업무 scope resolver·deploy Compose를 수정하지 않는다. 그러므로 R37 완료도 실제 issuer/API/browser/WSL 운영 유사 통합 PASS가 아니다.

## 제품 exact3·TDD

- 단일 writer exact3: `packages/api/oidc_runtime_factory.py`, `tests/api/test_oidc_runtime_factory.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. Main의 새 canonical worker/write lease와 G-05 확인 전 제품 write 금지.
- RED 1: 잘못된 issuer/JWKS/redirect/policy, 빈 허용집합, 잘못된 session factory·transport를 구성 전에 거부하고 Secret/JWKS를 예외·repr에 노출하지 않는 테스트를 먼저 실패시킨다.
- RED 2: 합성 RSA/JWKS와 SQLite의 세 영속 store, `httpx.MockTransport`로 실제 기존 제품 구성요소를 통해 begin→signed ID-token exchange→complete→server-side role/scope bind→opaque cookie authenticate→revoke를 검증한다. 다른 issuer/audience/서명·subject, replay, 잘못된 role/scope는 거부하고 token endpoint는 파생한 한 주소만 호출한다. mock은 네트워크 경계에만 쓰고 coordinator·store는 실제 구현을 사용한다. client secret 제공자는 구성 시 호출하지 않고 교환 시에만 호출한다.
- 최소 구현 GREEN 뒤 관련 R7~R9/R30~R36 API·persistence 회귀, 전체 pytest 수집 상태, `git diff --check`를 실행한다. 전체 pytest 기존 13 collection ERROR는 새 결함과 구분하고 전체 PASS로 표시하지 않는다. 독립 리뷰 Critical·Important 0 후 Main이 제품 SHA를 지정 SSH 원격에 push하고 WSL-server의 전용 clean detached 동일 SHA에서 scoped 테스트만 반복한다. 임시 자원 생성 전 이름·수명·정리 방법을 WORK_STATUS에 기록한다.

## 종료·후속

R37 검증 뒤 write→worker lease를 회수하고 G-05·원격 checkpoint를 확인한다. 후속 F-18 단계에서 신뢰된 host 설정/Secret 참조·ASGI 결선·업무 resolver·실제 WSL-server QA issuer/PG18·Web callback/브라우저 Network를 검증한다. F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`를 유지한다. Rollback은 R37 제품 commit의 정상 revert이며 DB downgrade는 없다.
