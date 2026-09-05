# C-21 Provider Status READ WorkInstruction

- Artifact ID: `WI-C-21-PROVIDER-STATUS-READ-20260906-001`
- Executor: `developer-primary`
- Dispatch base: `aa116e2044671628011b46d190de014ad7fd0af4`
- Result state at dispatch: `IN_PROGRESS`
- Purpose: C-21의 첫 내부 rework slice로 9개 Provider 상태 조회 계약을 실제 runtime API에 구현한다.

## 제품 계약

1. canonical ID는 `cerebras`, `groq`, `mistral`, `openrouter`, `upstage`, `gemini`, `anthropic`, `openai`, `ollama`의 lowercase 9개다.
2. 화면 표시명은 uppercase이며 `UPSTAGE`가 primary다.
3. credential은 환경변수의 존재 여부만 반환한다. 값, suffix, 길이, 내부 환경변수명, 내부 endpoint는 응답·로그·OpenAPI에 노출하지 않는다.
4. `GET /api/providers`, `GET /api/providers/{provider_id}`, `GET /api/providers/{provider_id}/models`를 인증·RBAC 아래 구현한다.
5. 미설정 Provider는 `NOT_CONFIGURED`, configured-but-unprobed는 `DEGRADED`; health는 `NOT_CHECKED`, latency/error는 `null`, models는 `[]`로 정직하게 표시한다.
6. unknown 또는 대소문자가 섞인 ID는 `404`다. canonical lowercase만 받는다.
7. eligible model이 없는 MoA 선택은 fail-closed한다.
8. `POST configure/test/refresh`는 이번 slice에서 구현하지 않으며 `501`을 유지한다. 후속 `F-01/F-02/D-11/F-12` 범위다.

## write lease

아래 exact18만 허용한다. 실제 완료 manifest는 `actual_changed_paths`를 이 집합의 subset으로 기록하되, 필수 semantics와 테스트를 모두 충족해야 한다. `packages/api/fastapi_app.py`는 `OPTIONAL_BUT_WITHIN_LEASE`이며 실제 wiring에 필요할 때만 수정한다.

- `packages/agent_team/provider_catalog.py`
- `packages/agent_team/runtime_config.py`
- `packages/agent_team/provider_status.py`
- `packages/agent_team/__init__.py`
- `packages/api/provider_status.py`
- `packages/api/registry.py`
- `packages/api/runtime.py`
- `packages/api/fastapi_app.py`
- `tests/agent_team/test_provider_status.py`
- `tests/api/test_provider_status.py`
- `tests/api/test_runtime_app.py`
- `tests/agent_team/test_c21_provider_nonbilling_qa.py`
- `tests/api/test_registry_openapi.py`
- `tests/api/test_web_security.py`
- `tests/api/test_local_session.py`
- `docs/04_test_reports/C-21_PROVIDER_STATUS_READ_REPORT.md`
- `docs/evidence/manifests/C-21_PROVIDER_STATUS_READ_MANIFEST.json`
- `docs/validation/C-21_PROVIDER_STATUS_READ_VALIDATION.md`

Path-list SHA-256: `300FEF86F8357958E74BEAAA9440CA4B7F56240CC1C9B51A115A58B48B4122E8`.

## 금지·경계

- 실제 Provider 호출·비용·egress, Telegram outbound, ysna 배포, main 병합, release/install은 실행하지 않는다.
- DB migration은 `0`이며 스키마·지속 데이터·Secret을 변경하지 않는다.
- C-21 `accepted=false`, C-01 차단, DIR-2 미발생을 유지한다.
- 이 slice 완료 후 다음 내부 작업은 Workbench UI rework다.
- 과거 seq1~506과 historical evidence는 수정하지 않는다.

## 검증·완료보고

- TDD RED→GREEN, provider/API/runtime/security/session/OpenAPI 회귀 테스트, 전체 관련 suite를 수행한다.
- actual changed paths가 lease subset인지, exact semantic contract가 모두 충족됐는지 독립 검증할 수 있는 report/manifest/validation을 남긴다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다.
