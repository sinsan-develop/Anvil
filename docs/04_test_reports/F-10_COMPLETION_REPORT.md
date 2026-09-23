# F-10 OPENAI adapter 개발 완료보고

## 판정

`COMPLETED` — 지정된 제품 exact5 안에서 host-only OpenAI Chat/Responses adapter 및 계약 테스트를 구현했다. 독립 검토 Important 2건의 개발자 재작업을 반영했으며 재검토 전 개발자 결과다. 이는 실제 OpenAI 연결·운영 인수 PASS가 아니다.

## 기준·시작 상태

- Work Package: `F-10`; 담당 `developer-primary-f10-r1`; branch `codex/f10-openai-adapter`; 시작 HEAD `c89a77a2f0da1dfda911b270d50fa355b74ed2bb`; 시작 `git status --short --branch` clean.
- Worker lease `worker-lease-f10-r1-20260924-001` / `execution_fencing_token=f10-r1-execution-fence-epoch-1-acbef2720228cc8d`, write lease `write-lease-f10-r1-20260924-001` / `write_fencing_token=f10-r1-write-fence-epoch-1-509afa3f36aca7e7`; 둘 다 ACTIVE, scope exact5.
- SHA-256: 설계서 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`, 작업계획서 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`, 통합검증매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`, 테스트계획서 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`, 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`, F-10 WI `D57AAE8EA27107595F995303CF638FF04D9A76F4F22CA4E874F5D1C9EF93BF6D`.
- OmniRoute `release/v3.8.51` commit `20f39008892b683a639063fb8aed8c07782fb0c3`의 `open-sse/config/providers/registry/openai/index.ts`를 Provider 1차 기준으로 대조했다. Wire는 공식 [Chat API](https://developers.openai.com/api/reference/cli/resources/chat), [Responses create](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), [Streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [Models API](https://developers.openai.com/api/reference/resources/models), [Errors](https://developers.openai.com/api/docs/guides/error-codes)를 보조 기준으로 사용했다.

## 변경·증거

- `packages/providers/openai_models.py`: canonical provider ID, OmniRoute 순서의 고정 모델 목록(중복 `gpt-4o` 제거), Responses-only pro 모델, endpoint/transport response/receipt 값 객체.
- `packages/providers/openai_errors.py`: Secret 비노출 guard, `error.code`와 HTTP 상태에 근거한 재시도·spend/usage/credit·Retry-After 분류. 모호한 429는 재시도 가능으로 단정하지 않는다. Important 재작업: 확정 비재시도 quota 원인을 malformed Retry-After보다 먼저 분류하고, delay 검증은 재시도 가능 분기에서만 한다.
- `packages/providers/openai_adapter.py`: host-injected transport, Chat 및 pro Responses의 별도 payload/endpoint, generate/stream/health/discovery, request ID fingerprint·replay·실패 후 재시도, pre/post-send abort, provider final usage, 완료·비텍스트·도구·오류·누락 종료 fail-closed. Important 재작업: Responses semantic stream의 허용 text lifecycle을 명시하고 unknown/refusal/tool/nontext 이벤트를 거부한다.
- `tests/providers/test_openai_adapter_f10.py`: 위 계약의 fixture-only 검증. TDD RED에서 새 module 부재로 수집 실패(exit 1)를 확인하고 GREEN 22 PASS, 이후 `response.output_item.added` function call 성공 오분류를 RED 1 FAIL/26 PASS로 재현하여 거부 처리 후 GREEN 27 PASS. Important 2건 재작업에서 7 FAIL/29 PASS의 RED와 수정 후 36 PASS의 GREEN을 확인했다.
- `docs/04_test_reports/F-10_COMPLETION_REPORT.md`: 본 기록. 제품 외 파일·기존 Provider/Gateway·control/progress는 수정하지 않았다.
- `git status --short`: 위 제품 코드·테스트 4개 untracked 및 본 완료보고 1개 untracked. Git commit/push는 수행하지 않았다. Main이 해당 exact5 diff를 검토·stage한다.

## 실행 검증

1. `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers/test_openai_adapter_f10.py` → 재작업 최종 exit 0, `36 passed in 0.07s`.
2. `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers tests/llm_gateway tests/provider_catalog tests/model_registry tests/budget` → 재작업 최종 exit 0, `630 passed, 4 skipped in 4.38s`. 4 skip 모두 `tests/budget/test_atomic_reservation.py`의 격리 PostgreSQL 18 DSN 미설정이다.
3. Python `ast.parse` 대상 adapter/models/errors/test 4파일 → exit 0, `AST PASS 4`.
4. `git -c core.excludesFile= diff --check` → exit 0. 단, untracked 파일은 이 명령의 diff 범위에 포함되지 않으므로 Main stage 후 다시 실행해야 한다.

## 미검증·잔여 위험

- 실제 OpenAI API, API key, 네트워크, 실 Provider rate/quota 동작, DB, WSL-server, 브라우저, 배포를 실행하지 않았다. Discovery는 OmniRoute pin 정적 목록이며 live freshness/credential health는 `UNVERIFIED`다. Health `AVAILABLE`은 주입된 host의 authenticated `/v1/models/gpt-4o` fixture 증거에서만 판정했다.
- Responses semantic SSE에서 허용하는 이벤트는 created/in_progress, assistant message output_item, output_text content_part/delta/done, completed에 한정한다. 미지원 unknown/non-text/tool/refusal 이벤트는 성공으로 승격하지 않으며 host-only contract 이후 실제 live 형식은 별도 검증해야 한다.
- 공유 `GatewayResponse`의 비어 있지 않은 output 선행·후행 공백 거부 제약은 변경하지 않았다. Adapter는 자동 strip하지 않고 `OUTPUT_TEXT_NON_CANONICAL`로 안전하게 실패한다.
- 요청 alias와 serving model이 다를 수 있어 request model과 serving model을 receipt에 각각 기록한다. 동일 stream 안의 ID/model 불일치는 거부한다.
- 프로젝트 전체 test suite·typecheck/lint/build는 본 제품 exact5 범위에서 실행하지 않았다. 위 관련 회귀와 AST만 PASS다.

## Rollback·인계

- Main이 아직 stage/commit하지 않은 본 제품 exact5 신규 파일만 제거하면 변경 전 상태로 돌아간다. 그 밖의 사용자·공유 파일을 삭제하지 않는다. Main이 commit 이후에는 해당 exact5 변경을 별도 정상 revert PR로 복구한다.
- `docs/progress/build-progress.json`, `BUILD_HANDOFF.md`, `docs/WORK_STATUS.md`는 write lease scope 밖이므로 갱신하지 않았다. Main이 독립 검토 후 progress/HANDOFF 결박 및 Git 절차를 소유한다.
