# F-18 R36 OIDC runtime binding 계획

> 승인된 F-18 WorkInstruction의 운영 유사 인증 연결 중 로컬 런타임 결선 단계다. 기준 branch `codex/f18-wsl-ops`, 시작 checkpoint `8570ab4d0d723db9b3ec4349f20d245ffe9628a2`, canonical sequence 1608. 설계·계획·매트릭스·테스트계획의 승인 hash는 F-18 기본 WorkInstruction에 고정된 값과 동일하다. 새 인증 방식·권한 정책·DB schema·외부 배포를 추가하지 않는다.

## 목표와 경계

- `create_runtime_app`에서 `ANVIL_AUTH_MODE=OIDC`를 명시적으로 허용하되, 신뢰된 `OidcSessionCoordinator`와 업무 범위 `authorization_resolver`를 모두 주입받지 못하면 앱을 생성하지 않는다. 기본 `COOKIE`와 기존 `WSL_ACCEPTANCE` 동작은 유지한다.
- OIDC 모드와 `LocalTestSessionService`, `session_issuer`, 별도 `authenticate`, `trusted_read_principal`의 동시 활성화는 시작 시 fail-closed한다. 환경변수에 테스트 세션 설정 일부만 남아 있어도 혼합 구성을 거부한다. OIDC coordinator를 `COOKIE`/`WSL_ACCEPTANCE` 모드에 주입하는 구성도 거부한다.
- OIDC 모드의 `app.state.auth_mode`와 `/auth/session/status`는 `OIDC`를 보고한다. API와 `RuntimeConsoleOwner`의 인증은 동일 coordinator를 사용한다. 업무 권한 범위는 주입된 resolver를 거치고, 기존 task authority 일치 검사는 유지한다.
- 이 단계는 issuer/JWKS/secret을 환경변수에서 조립하거나 실제 IdP에 연결하지 않는다. ASGI 엔트리포인트, Web callback, DB migration, 배포 설정 및 WSL 서비스를 변경하지 않는다. 따라서 이 단계의 PASS는 실제 OIDC 로그인·WSL 통합 PASS가 아니다.

## 제품 exact3와 TDD

- 제품 writer exact3: `packages/api/runtime.py`, `tests/api/test_runtime_app.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. Main의 canonical worker/write lease와 G-05 확인 전 제품 파일 변경 금지.
- RED: OIDC 모드 필수 coordinator/resolver 누락, 테스트 세션 환경·local issuer·별도 인증자·trusted read 혼합, mode/coordinator 불일치가 앱 시작을 거부하는 테스트를 먼저 실행한다. GREEN: 정상 주입 시 `/auth/session/status`가 OIDC를 보고하고 coordinator 인증 및 기존 task authority guard가 유지되는 테스트를 실행한다.
- 기존 `COOKIE`/`WSL_ACCEPTANCE` runtime 및 R35 HTTP 회귀, 전체 pytest 수집 상태, `git diff --check`를 확인한다. 이미 알려진 전체 pytest collection 13 ERROR는 새 회귀와 구분하고 전체 PASS로 표시하지 않는다.
- Main 독립 diff/review에서 Critical·Important 0을 확인한 뒤 같은 제품 SHA를 지정 SSH 원격에 push한다. WSL-server는 clean detached exact SHA의 격리 checkout에서 scoped 테스트만 반복하고 임시 자원은 이름·수명·정리 방법을 WORK_STATUS에 먼저 기록한 뒤 exact 정리한다.

## 이후 단계와 판정

R36 종료 시 lease를 write→worker 순서로 회수하고 G-05와 원격 checkpoint를 확인한다. 후속 F-18 단계에서 issuer 구성·PG18 coordinator 실제 결합·Web callback·브라우저 Network·운영 유사 target의 동일 artifact 검증을 수행한다. 그 전까지 F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`다. Rollback은 R36 제품 commit의 정상 revert이며 DB나 외부 자원 복구는 필요하지 않다.
