# F-09 ANTHROPIC adapter 독립 검토

## 판정

`ACCEPT` — Critical 0, Important 0, Minor 1. 최초 Important 4건과 재검토 잔여 429 오류 분류를 F-09 제품 exact5에서 재작업해 해소했다. Host-only 계약 인수이며 실제 Anthropic 연동 합격 판정은 아니다.

## 판단 이유

- 대상: `codex/f09-anthropic-adapter`, 기준 main `bad806b8ca0d4bbf18f22f138034c4a79257a045`, F-09 WorkInstruction의 제품 exact5. 독립 Reviewer는 제품·control·Git에 쓰지 않았다.
- OmniRoute `release/v3.8.51` commit `20f39008892b683a639063fb8aed8c07782fb0c3` Anthropic registry의 canonical ID, `claude` format, Messages endpoint·suffix, `x-api-key`, 정적 11개 모델을 대조했다. 공식 [Messages](https://platform.claude.com/docs/en/api/messages/create), [Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [Models Get](https://platform.claude.com/docs/en/api/models/retrieve), [Rate Limits](https://platform.claude.com/docs/en/api/rate-limits)를 wire·오류·사용량의 보조 근거로 확인했다.
- 스트림 최종 `message_delta`의 출력 사용량 누락·누적값 감소·종료 증거 누락은 `RESPONSE_MALFORMED`로 차단한다. `message_start` 또는 중간 delta의 사용량을 최종 사용량으로 승격하지 않는다.
- 인증형 모델 GET은 `claude-sonnet-4.6` 요청에 대해 해당 alias 또는 같은 sonnet-4-6 concrete ID만 `AVAILABLE`로 인정한다. 다른 Claude 계열 모델 응답을 성공으로 오인하지 않는다.
- Anthropic 공식 정의에 따라 캐시 읽기·생성·일반 입력 토큰을 Gateway 총 입력에 합산하고 원본 세부값은 receipt에 보존한다. 합성 `3+2+4`는 입력 9, 출력 5, 총 14로 검증됐다.
- 지정 지출 한도 400/429와 월 한도 세부 코드는 `SPEND_LIMIT_REACHED` 비재시도로 분류한다. 기타 429는 `Retry-After`가 있어도 속도 제한으로 단정하지 않고 `PROVIDER_429_AMBIGUOUS` 비재시도로 유지한다. 인증 401·과부하 529 경로는 그대로 검증됐다.
- Minor 1건: 기존 `GatewayResponse`는 선행·후행 공백이 있는 정상 Provider 출력을 허용하지 않는다. F-09는 자동 strip 없이 안정적 `OUTPUT_TEXT_NON_CANONICAL`로 fail-closed하고 완료보고에 제약을 명시했다. 공통 데이터 계약 변경은 이 Package 범위 밖이다.

## 실행 검증

- 독립 Reviewer focused: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers/test_anthropic_adapter_f09.py` → exit 0, `37 passed`.
- 독립 Reviewer 및 Main 관련 회귀: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers tests/llm_gateway tests/provider_catalog tests/model_registry tests/budget` → exit 0, `594 passed, 4 skipped`. 네 SKIP은 isolated PostgreSQL 18 DSN 미설정이다.
- 독립 합성 host 재현·Python 제품 4파일 AST 검사 → 각각 exit 0. 신규 untracked exact5는 `git diff --check` 범위 밖이므로 최종 stage 후 staged diff 검사를 별도 수행한다.

## 미검증·영향·다음 조치

- 실제 Anthropic credential/API/network/SSE, 모델별 가용성, 인증형 live health, DB·브라우저·WSL·배포는 `NOT_EXECUTED`/`UNVERIFIED`다. Fake host의 `AVAILABLE`은 live health 증거가 아니다.
- F-02 및 기존 Provider 계약은 수정하지 않았다. 제품 exact5와 이 검토 보고를 인수해 control/progress 최종화, PR 병합, merged-main 회귀, branch/worktree 정리를 수행한다.
- Rollback은 F-09 병합 commit을 정상 revert하고 관련 Provider·Gateway 회귀를 재실행하는 것이다. History rewrite는 하지 않는다.
