# F-07 UPSTAGE adapter 독립 검토

## 판정

`ACCEPT` — 재검토 결과 Critical 0, Important 0, Minor 1. 초기 Important `F07-429-AMBIGUOUS-RETRY`는 동일 브랜치의 제품 exact5 재작업으로 해소했다. Host-only 계약 인수 판정이며 실제 Upstage 연동 합격 판정이 아니다.

## 판단 이유

- 검토 대상: `codex/f07-upstage-adapter`, 기준 main `f38880326e614b3e06a2b67ba7b1179957bdf3f1`, F-07 WorkInstruction의 제품 exact5. 독립 Reviewer는 제품·control·Git에 쓰지 않았다.
- OmniRoute `release/v3.8.51` commit `20f39008892b683a639063fb8aed8c07782fb0c3`의 Upstage registry와 canonical ID, OpenAI format/default executor, bearer, chat URL, 정적 모델 `solar-pro3`·`solar-mini`를 대조했다.
- 최초 `packages/providers/upstage_errors.py`는 code가 없거나 알 수 없는 HTTP 429도 무조건 `RATE_LIMIT(retryable=True)`로 분류했다. 이는 F-07의 증거 기반 오류 분류·fail-closed 계약에 어긋나 Important 재작업으로 판정했다.
- 재작업 후 explicit quota code는 `QUOTA_EXHAUSTED`(nonretryable), 인정된 rate code는 `RATE_LIMIT`(retryable), code 없음·미인식은 `PROVIDER_429_AMBIGUOUS`(nonretryable)로 분리됐다. `Retry-After`는 유효성·상한과 재시도 시점에만 쓰고 원인 판정에는 쓰지 않는다. 새 fixture가 no-code와 unknown-code, Retry-After 유무의 주요 분기를 확인한다.
- Minor 1건: `unknown code + Retry-After 없음`의 단독 fixture는 없다. 이미 확인된 동일 fallback 분기이므로 기능 결함이나 병합 차단 근거는 아니다.

## 실행 검증

- 독립 Reviewer focused: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests/providers/test_upstage_adapter_f07.py` → exit 0, `31 passed`.
- 독립 Reviewer 및 Main 관련 회귀: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers tests/llm_gateway tests/provider_catalog tests/model_registry tests/budget` → exit 0, `508 passed, 4 skipped`. Skip 4건은 격리 PostgreSQL 18 DSN 미설정이다.
- 독립 Reviewer AST 4개 파일 구문 검사 → exit 0. `git diff --check` → exit 0이나 당시 제품 exact5는 untracked라 그 명령만으로 신규 파일 내용을 검증한 것은 아니다.

## 미검증·영향·다음 조치

- 실제 Upstage key/API, host의 bearer 주입·인증형 health 결박, upstream response/error code, 스트림 final usage 지원, network·DB·browser·WSL·deploy는 `NOT_EXECUTED`/`UNVERIFIED`다. Fake host의 `AVAILABLE`은 live health 증거가 아니다.
- F-02 모델 snapshot/routing과 기존 Provider 코드는 변경하지 않았다. F-07 exact5와 이 검토 보고만 인수해 control/progress 최종화, PR 병합, merged-main 회귀, branch/worktree 정리한다.
- Rollback은 F-07 병합 commit을 정상 revert하고 관련 Provider·Gateway 회귀를 재실행하는 것이다. History rewrite는 하지 않는다.
