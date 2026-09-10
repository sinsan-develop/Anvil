# C-21 Provider Status READ 검증

- 상태: `LOCAL_IMPLEMENTED_PENDING_CANDIDATE_WSL`
- 결과: `COMPLETED_FOR_LOCAL_REVIEW`
- 기준 HEAD: `51ed9d852a1fb48d24d7112cc900485de2f8011e`

## 검증 기준

- lowercase canonical ID 9개, uppercase display, UPSTAGE primary
- credential presence only; secret 값·내부 환경변수명·endpoint 미노출
- list/detail/models 인증·`provider:read` RBAC 및 200 응답
- unknown/mixed ID 404
- unconfigured/configured-unprobed의 정직한 상태와 models empty, MoA fail-closed
- Provider socket/DNS 0
- configure/test/refresh-models 501 유지
- DB migration 0, exact18 subset

## 실행 증거

| 구분 | 명령 | 결과 |
|---|---|---|
| RED | `.venv\\Scripts\\python.exe -m pytest -p no:cacheprovider tests/agent_team/test_provider_status.py tests/api/test_provider_status.py -q` | exit 1, missing symbols/module 2 collection errors |
| focused GREEN | provider status + runtime + OpenAPI 4 files | 26 passed, exit 0 |
| 관련 회귀 | provider catalog/runtime/MoA + API status/runtime/OpenAPI/security/session | 85 passed, exit 0 |
| broad 회귀 | `.venv\\Scripts\\python.exe -m pytest -p no:cacheprovider tests/agent_team tests/api -q` | 192 passed, exit 0 |
| diff | `git diff --check` | exit 0 |
| syntax | repository Python `-B` + `ast.parse` on changed Python files | 10 files parsed, exit 0 |

최종 fresh verification은 문서 작성 후 같은 broad suite를 다시 실행해 `192 passed`, exit 0을 확인했다. actual changed path는 13개이며 정렬·LF 결합 SHA-256은 `B7DC7CA4195FE3FEA1AC3618A89FF3EF298C109750A8B0E554D686B2DD43F2B5`다.

`compileall`은 제품 오류가 아니라 읽기 제한된 기존 `__pycache__` write에서 1회 거부됐다. bytecode를 생성하지 않는 `ast.parse`로 최종 syntax 검증을 대체한다.

## 정직한 증거 한계

이 문서는 로컬 코드·fixture·FastAPI TestClient 검증만 증명한다. 실제 Provider credential/health/model discovery, 비용·egress, WSL 후보, Telegram outbound, ysna, release/install, main 통합 증거가 아니다.
