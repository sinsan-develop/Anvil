# F-08 GEMINI adapter 독립 검토

## 판정

`PASS_WITH_MINOR_LIMITATION` — Critical 0, Important 0, Minor 1. 최초 Important 3건(결합 출력 credential, host 예외 원문, 빈 종료 frame)과 재검토 Important 1건(ProtoJSON `parts` 생략)을 같은 F-08 제품 exact5에서 재작업해 해소했다. Host-only 계약 인수이며 실제 Gemini 연동 합격 판정은 아니다.

## 판단 이유

- 대상: `codex/f08-gemini-adapter`, 기준 main `150139c4bf73fcfa4e5464af995bc431f3d2a056`, F-08 WorkInstruction의 제품 exact5. 독립 Reviewer는 제품·control·Git에 쓰지 않았다.
- OmniRoute `release/v3.8.51` commit `20f39008892b683a639063fb8aed8c07782fb0c3`의 Gemini registry·URL builder와 Google generateContent/Models/error wire를 대조했다. 정적 모델 8개와 `x-goog-api-key`, native generate/stream endpoint 계약을 확인했다.
- 결합된 generate parts/stream frames의 합성 credential은 response·receipt 생성 전에 차단되며 receipt가 남지 않는다. Host의 일반·adapter형 예외는 고정 `TRANSPORT_FAILURE`로 변환되고 출력 traceback에 합성 secret이 없다.
- 스트림 마지막 `STOP`+완전한 final usage frame은 앞선 text와 동일 ID/modelVersion이 있을 때 빈 text, 빈 parts, 생략된 parts 또는 content를 허용한다. 전체 빈 응답, 중간 빈 frame, ID/version 상충, usage 누락·오류, SAFETY 종료는 차단한다. 독립 synthetic 20개 변형이 통과했다. [ProtoJSON의 빈 repeated 필드 생략 규칙](https://protobuf.dev/programming-guides/json/#presence-and-default-values)을 반영했다.
- Minor 1건: 기존 `GatewayResponse`의 정규형 문자열 계약으로 선행·후행 공백이 있는 정상 Gemini 출력은 전달할 수 없다. Raw `ValueError` 노출은 고정 `OUTPUT_TEXT_NON_CANONICAL`로 바뀌었지만 호환성 제한은 남는다. 자동 strip이나 공통 데이터 계약 변경은 F-08 범위에 포함하지 않았다.

## 실행 검증

- 독립 Reviewer focused: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers/test_gemini_adapter_f08.py` → exit 0, `49 passed`.
- 독립 Reviewer 및 Main 관련 회귀: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers tests/llm_gateway tests/provider_catalog tests/model_registry tests/budget` → exit 0, `557 passed, 4 skipped`. 4 SKIP은 isolated PostgreSQL 18 DSN 미설정이다.
- Reviewer의 합성 host 재현 20개 사례 → exit 0. Main의 제품 Python 4파일 AST 검사 → exit 0. 신규 untracked exact5는 `git diff --check`에 포함되지 않으므로 최종 stage 후 staged diff 검사를 별도 수행한다.

## 미검증·영향·다음 조치

- 실제 Gemini credential/API/network/SSE, model availability, 인증형 live health, DB·브라우저·WSL·배포는 `NOT_EXECUTED`/`UNVERIFIED`다. Fake host의 `AVAILABLE`은 live health 증거가 아니다.
- F-02 및 기존 Provider 계약은 수정하지 않았다. 제품 exact5와 이 검토 보고를 인수해 control/progress 최종화, PR 병합, merged-main 회귀, branch/worktree 정리를 수행한다.
- Rollback은 F-08 병합 commit을 정상 revert하고 관련 Provider·Gateway 회귀를 재실행하는 것이다. History rewrite는 하지 않는다.
