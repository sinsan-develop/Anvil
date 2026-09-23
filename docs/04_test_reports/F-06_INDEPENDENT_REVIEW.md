# F-06 OPENROUTER adapter 독립 검토

## 판정

`ACCEPT` — F-06 host-only 제품 exact5에 대한 수정 후 독립 검토에서 잔여 Critical·Important finding은 0건이다. 실제 OpenRouter 연동 인수 판정은 아니다.

## 근거

- 기준: `main` 19aee3360d90d3a046183ae66e6dd02150d9d747, F-06 WorkInstruction, OmniRoute `release/v3.8.51` 20f39008892b683a639063fb8aed8c07782fb0c3. OpenRouter 공개 자료는 wire 참고로만 사용했다.
- 검토 범위: `packages/providers/openrouter_adapter.py`, `openrouter_models.py`, `openrouter_errors.py`, `tests/providers/test_openrouter_adapter_f06.py`, `F-06_COMPLETION_REPORT.md`. control/Git 파일은 Developer가 수정하지 않았다.
- 확인한 계약: canonical `openrouter`, 요청 모델과 실제 served 모델·upstream 제공자 분리, 미확인 제공자 `UNVERIFIED`, 최종 usage·abort provenance, quoted rate와 billed cost 분리, request ID replay/conflict, 402 connection quota와 모델 요청 404 분리, 공개 catalog와 인증형 key health 분리, midstream 오류 및 credential fail-closed.
- 초기 Important 5건을 재현·수정했다: OmniRoute의 `/api/v1/auth/key` 유효 응답에서 quota 필드가 없어도 health 성공; host-binding 문서 경로 교정; generation과 selected endpoint의 routing 증거 충돌 거부; 비모델 health/discovery 404의 model-scope 오분류; 중첩 credential key 누출 차단. 수정 후 재검토에서 잔여 Critical·Important 0건, Minor 0건.
- Main 재검증: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests\providers tests\llm_gateway tests\provider_catalog tests\model_registry tests\budget` → exit 0, 477 passed, 4 skipped. 4건은 격리 PostgreSQL 18 DSN 미설정이다.
- Main 구문 검사: 4개 Python 제품·테스트 파일 AST parse → exit 0, `compile AST OK 4`.

## 판단 보류 범위와 조치

- 실제 OpenRouter API·key·network·DB·browser·WSL·배포는 이 host-only Package에서 실행하지 않았다. fake transport PASS를 실제 Provider PASS로 승격하지 않는다.
- host transport가 `health`를 OmniRoute 기준의 인증형 `/api/v1/auth/key`에 결박하는지와 receipt의 지속 저장은 이 exact5 밖이므로 판단 보류한다. 후속 통합 시 별도 확인한다.
- F-06 PR 병합 후 merged-main progress·관련 회귀 smoke를 실행하고 clean branch/worktree를 정리한다.
