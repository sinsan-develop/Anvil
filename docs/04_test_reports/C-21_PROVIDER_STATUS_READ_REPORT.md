# C-21 Provider Status READ 로컬 구현 보고

- Work Package: `C-21 / PROVIDER-STATUS-READ`
- Executor: `developer-primary`
- 기준 HEAD: `51ed9d852a1fb48d24d7112cc900485de2f8011e`
- WorkInstruction: `WI-C-21-PROVIDER-STATUS-READ-20260906-001`
- 상태: `LOCAL_IMPLEMENTED_PENDING_CANDIDATE_WSL`
- 결과 계약: `COMPLETED_FOR_LOCAL_REVIEW`

## 판정

로컬 구현과 관련 회귀 검증은 완료했다. C-21 전체 수락, WSL 후보 검증, 실제 Provider credential 유효성·과금 호출, Telegram outbound, ysna 배포, main 병합은 수행하거나 통과로 판정하지 않았다.

## 구현 결과

- 공개 canonical Provider ID는 lowercase 9개이며 표시명은 uppercase, primary는 `UPSTAGE`다.
- credential 값은 보관·반환하지 않고 환경 설정의 non-empty 존재 여부만 snapshot한다.
- 미설정은 `NOT_CONFIGURED/MISSING`, 설정됐으나 probe 전은 `DEGRADED/REGISTERED`, 공통 health는 `NOT_CHECKED`, latency/error는 `null`, models는 `[]`, MoA eligibility는 `false`다.
- `GET /api/providers`, detail, models를 실제 runtime query port에 연결했다.
- 세 GET endpoint 모두 정확히 `provider:read` 권한을 요구한다. 인증 부재·권한 불일치는 기존 fail-closed 경계를 유지한다.
- unknown/mixed-case ID는 `404 PROVIDER_NOT_FOUND`다.
- configure/test/refresh-models POST는 바인딩하지 않아 `501 CAPABILITY_NOT_AVAILABLE`을 유지한다.
- runtime fixture model을 응답에 섞지 않았고 eligible model 0개인 MoA route는 `LookupError`로 fail-closed한다.
- DB schema/migration 변경은 0이다.

## TDD·검증

1. RED: 신규 public catalog symbols와 Provider status API port가 없어 collection 단계에서 2 errors, exit 1. 기능 부재가 원인임을 확인했다.
2. GREEN focused: 26 passed, exit 0.
3. 관련 provider/MoA/API/security/session 회귀: 85 passed, exit 0.
4. broad `tests/agent_team tests/api`: 192 passed, exit 0.
5. 네트워크 방지 테스트에서 `socket.socket`, `socket.create_connection`, `socket.getaddrinfo`를 모두 거부한 상태로 status projection 9개를 생성했다.
6. `git diff --check`: exit 0.

검증 명령은 repository 전용 `.venv\Scripts\python.exe` 절대경로로 실행했다. 최종 fresh verification 수치는 validation 문서에 기록한다.

## 오류 ledger

- `LOCAL_PYTHON_COMMAND_NOT_FOUND`: 1회. bare `python`이 PATH에 없어 제품 RED 전에 종료됐다. repository 전용 Python 절대경로로 교정했다. 제품 failure count에는 포함하지 않는다.
- `LOCAL_COMPILEALL_PYCACHE_PERMISSION_DENIED`: 1회. 읽기 제한된 기존 `__pycache__`에 `compileall`이 bytecode를 쓰려다 거부됐다. 제품 코드 오류가 아니며 bytecode write가 없는 `ast.parse` syntax 검증으로 교정했다.
- `LOCAL_PATH_SET_ARRAY_NESTING`: 1회. 최종 read-only path 검증용 PowerShell에서 두 command 결과를 중첩 배열로 만들며 count/subset이 잘못 계산됐다. 변경 파일에는 영향이 없으며 flat array로 재실행했다.
- 동일 유효 제품 실패 3회: 0.

## 미검증·경계

- 실제 Provider DNS/socket/HTTP 호출과 비용 발생: `NOT_EXECUTED`.
- 실제 credential의 유효성 및 model discovery/health probe: `NOT_VERIFIED`.
- WSL PG15/PG18RC 후보 통합 검증: `PENDING_CANDIDATE_WSL`.
- Telegram outbound, ysna, release/install, main merge/push/commit: `NOT_EXECUTED`.
- local test bootstrap session의 permission allowlist 확장은 이번 exact18 제품 경로에 포함되지 않았다. API 인증/RBAC는 주입된 실제 `SessionPrincipal` 경계에서 검증했다.

## Rollback

Main Agent가 이 작업의 actual changed path subset만 되돌리면 된다. DB migration과 외부 side effect가 없어 별도 데이터 rollback은 없다.
