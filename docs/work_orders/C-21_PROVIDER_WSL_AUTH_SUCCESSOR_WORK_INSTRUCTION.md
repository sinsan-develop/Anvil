# C-21 Provider WSL Auth Successor WorkInstruction

- Artifact ID: `WI-C-21-PROVIDER-WSL-AUTH-20260906-001`
- Executor: `developer-primary`
- Dispatch base: `b85d2b48e14f513e326054bc0be28009f269a827`
- Result state at dispatch: `IN_PROGRESS`
- Purpose: 개발·WSL test session에 `provider:read`를 fail-closed exact endpoint allowlist로 추가하고 PG15/PG18RC 검증 harness에 반영한다.

## 제품 계약

1. 허용 scope 집합에 정확히 `provider:read`를 추가하되 기본 session permission은 기존 `run:events:read`를 유지한다.
2. `provider:read` test session은 아래 GET 3개만 허용한다.
   - `GET /api/providers`
   - `GET /api/providers/{providerId}`
   - `GET /api/providers/{providerId}/models`
3. Provider mutation, 유사 경로, wildcard·중복·공백·unknown scope는 계속 fail-closed한다.
4. Provider GET은 project/run authority를 새로 추론하지 않고 환경 test session의 명시 scope와 exact endpoint allowlist를 함께 요구한다.
5. WSL `.env`의 canonical scope는 `tasks:write,tasks:read,run:events:read,provider:read`이다. 기존 파일은 다른 secret·설정 bytes를 보존하면서 이 한 줄만 원자적으로 갱신하고 mode 0600/0400 정책을 유지한다.
6. WSL verify는 인증 전 401, 인증 후 Provider exact3 200, lowercase 9종/UPSTAGE primary/credential 미주입 상태/models 빈 배열/비밀·내부 endpoint 미노출을 검증한다.
7. 실제 Provider 호출, DNS/socket egress, Telegram outbound, ysna 배포, main 병합은 하지 않는다.

## write lease

아래 exact7만 수정할 수 있다.

- `deploy/wsl/bootstrap.sh`
- `deploy/wsl/common.sh`
- `deploy/wsl/verify.sh`
- `packages/api/local_session.py`
- `packages/api/runtime.py`
- `tests/api/test_local_session.py`
- `tests/deploy/test_wsl_staging_harness.py`

Path-list SHA-256: `43388FD076A9F799DC8AE3FC7EDABA6E682CFD1618BBE3721EC347F6E62FB11A`.

## 검증·완료 계약

- TDD RED→GREEN을 기록한다.
- local session/API focused, WSL harness, 관련 전체 회귀를 수행한다.
- 네트워크 차단 또는 호출 추적을 통해 실제 Provider/Telegram outbound 0을 입증한다.
- WSL 실행 전에는 `LOCAL_IMPLEMENTED_PENDING_GIT_ONLY_CANDIDATE`로만 보고한다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다.

