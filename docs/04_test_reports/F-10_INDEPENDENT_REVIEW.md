# F-10 OPENAI adapter 독립 검토

## 판정

`ACCEPT` — Critical 0 / Important 0 / Minor 0. 승인된 host-only 제품 exact5 범위에서 F-10 계약을 충족한다. 실제 OpenAI 연결이나 운영 인수 판정은 아니다.

## 근거·재작업

- 1차 `REWORK`: `openai_errors.py`가 429의 확정 spend/usage/credit `error.code`보다 `Retry-After`를 먼저 검사해 원인을 가릴 수 있었다(Important 1). 수정 후 비재시도 원인부터 분류하고 재시도 가능 분기에서만 delay를 해석한다. 재현·회귀 테스트 포함.
- 1차 `REWORK`: Responses stream이 생성 후 알 수 없는 semantic event를 묵인했다(Important 1). 수정 후 text lifecycle 허용 목록만 수락하며 refusal/tool/non-text/unknown event는 fail-closed한다. 재현·회귀 테스트 포함.
- 재검토: 위 두 건 해결, 신규 Critical/Important/Minor 없음. OmniRoute pinned 모델 순서·중복 제거, Responses 전용 pro 모델 분기, Chat 최종 `choices:[]` usage chunk → `[DONE]`, provider final usage와 serving ID, request-ID replay, credential guard를 확인했다.
- 독립 재검증: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider --basetemp=D:\Project\Anvil\.codex-sandbox\f10-review-61b6b797895845f3af55c8737ee090e6 tests\providers tests\llm_gateway tests\provider_catalog tests\model_registry tests\budget` → exit 0, `630 passed, 4 skipped`(격리 PostgreSQL 18 DSN 없음). 해당 임시 경로는 절대경로 확인 후 삭제, 잔여 `False`.
- 제품 변경 exact5 외 없음. 검토 당시 HEAD `c89a77a2f0da1dfda911b270d50fa355b74ed2bb`, 제품 파일 5개 untracked. Main이 검증·commit·병합을 소유한다.

## 미검증·잔여 위험

- 실제 OpenAI API/key/network, DB, browser, WSL-server, deploy는 실행·판정하지 않았다. 허용 목록 밖 미래 Responses event는 안전하게 실패할 수 있어 실제 wire 연동 시 재검증이 필요하다.
- 기존 GatewayResponse의 선행·후행 공백 제한은 공유 계약 그대로이며 adapter는 자동 strip 없이 오류를 반환한다.
- 보조 wire 근거: OpenAI 공식 [Streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [Errors](https://developers.openai.com/api/docs/guides/error-codes). Provider 목록의 1차 기준은 WorkInstruction에 pin한 OmniRoute다.
