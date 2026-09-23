# F-05 Completion Report — MISTRAL adapter

## 판정

`COMPLETED` — developer 구현·host-only 기본 검증 및 reviewer Important 재작업 완료. Main 재검토와 독립 Tester 판정 전이다.

- Work Package: `F-05`; 담당: `developer-primary-f05-r1`
- 작업 경로: `D:\Project\Anvil\.codex-sandbox\f05-mistral-adapter`
- branch / 시작 HEAD: `codex/f05-mistral-adapter` / `1457650ae934c5b9737af6eeef98c9bf4b1d74ea`
- 시작 상태: tracked 변경·untracked 파일 없음
- WorkInstruction SHA-256: `09E1A9799FCB7AD6DA7B57B1F8C850EA457B031C2070DCE6546CF3E68C639266`
- Invocation SHA-256: `D997C82FF5968BF86C708FB3EC1DF161A2B37EEA69CEC665FE6F1A690734CEFC`
- 설계/계획/매트릭스/테스트계획 SHA-256: `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D` / `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477` / `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB` / `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`
- execution fencing token: `f05-r1-execution-fence-epoch-1-10c11d673f2195df`
- write fencing token: `f05-r1-write-fence-epoch-1-19982b85e78b48f7`

## 판단 이유

OmniRoute `release/v3.8.51` HEAD `20f3900`의 built-in Mistral provider를 기준으로 `mistral` ID, OpenAI 형식 chat completion, bearer 인증의 host transport 경계를 대조했다. OmniRoute의 동적 `openai-compatible-responses-UUID` 연결 ID는 이 built-in provider와 다른 경로다. Mistral 공식 Chat API는 `/v1/chat/completions`와 additive metadata를, Models API는 `/v1/models`의 model card 목록을 제시한다. OmniRoute discovery는 `data` 또는 `models` 배열을 수용한다. 공식 known-limitations와 OmniRoute default executor는 stream final usage를 위해 `stream_options.include_usage=true`를 명시한다.

주입형 fake transport만 사용하는 adapter에서 generate, stream, host transport health probe, discovery, request ID replay/conflict, pre/post-send abort, immutable·detached receipt, provider final usage, quota/error/retry-after, credential material, malformed/unknown response와 non-finite JSON을 검증했다. stream은 role delta와 finish 뒤의 단일 `choices: []` usage-only terminal을 수용하며, final usage 없는 완료는 fail-closed한다. Mistral의 bare `401 {"detail":"Unauthorized"}`는 OmniRoute 근거에 따라 키 무효와 quota 소진을 구별할 수 없으므로 nonretryable `CREDENTIAL_OR_QUOTA_AMBIGUOUS`로 처리한다. 명시적인 invalid-key 신호만 인증 실패로 분류한다.

참조:

- [Mistral Chat API](https://docs.mistral.ai/api)
- [Mistral Models API](https://docs.mistral.ai/api/endpoint/models)
- [Mistral known limitations](https://docs.mistral.ai/resources/known-limitations)
- OmniRoute `open-sse/config/providers/registry/mistral/index.ts`, `open-sse/executors/default.ts`, `open-sse/translator/response/openai-responses.ts`, `open-sse/services/accountFallback/mistralAmbiguousAuth.ts`, `src/app/api/providers/[id]/models/discovery/providerModelsConfig.ts`

## 검증

| 단계 | 정확한 명령 | 종료 코드·결과 |
|---|---|---|
| TDD 첫 RED | `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -m pytest -q tests/providers/test_mistral_adapter_f05.py` | 1; `ModuleNotFoundError: packages.providers.mistral_adapter` |
| OmniRoute 경계 RED | 위 focused 명령 | 1; bare 401과 `models` alias 2건 실패, 45건 통과 |
| 추가 경계 RED | 위 focused 명령 | 1; header/completion ID와 명시적 invalid-key 401 2건 실패, 48건 통과 |
| 최초 focused GREEN | 위 focused 명령 | 0; 50 passed in 0.07s |
| 최초 관련 provider·registry 회귀 | `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/providers tests/model_registry tests/provider_catalog tests/knowledge/test_model_registry_d11.py tests/budget tests/orchestration/test_delegation_packet.py tests/git_adapter --tb=short` | 0; 804 passed, 4 skipped in 11.16s |
| compile | `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -c "from pathlib import Path; files=['packages/providers/mistral_adapter.py','packages/providers/mistral_models.py','packages/providers/mistral_errors.py','tests/providers/test_mistral_adapter_f05.py']; [compile(Path(p).read_text(encoding='utf-8'), p, 'exec') for p in files]; print('compile-ok', len(files))"` | 0; `compile-ok 4` |

직접 `pytest` 명령은 설치되지 않아 exit 1, `D:\Project\Anvil\.venv\Scripts\python.exe -m pytest`와 Codex bundled Python의 `-m pytest`도 모듈 부재로 exit 1이었다. 위 기존 격리 venv 경로에서 정상 실행했다. `4 skipped`는 PASS가 아니다. 전체 bare suite, 실제 API/credential/DB/browser/WSL/deploy는 실행하지 않았다.

### 독립 reviewer Important 재작업

원인과 수정은 다음과 같다.

1. stream role-only frame 직후 abort가 발생하면 기존 코드는 이후 도착한 content를 버렸다. final usage만 있는 빈 출력을 `ABORT_REQUESTED_UPSTREAM_COMPLETED`로 공통 `GatewayResponse`에 전달하면서 raw `ValueError`가 발생했다. abort 요청 뒤 실제 도착한 content를 보존하고, 끝까지 content가 없을 때는 공통 계약이 허용하는 `ABORTED`와 `PROVIDER_FINAL` usage를 반환한다. receipt의 `transport_sent=true`가 pre-send abort와 구별한다.
2. 실패한 요청은 결과 저장 전이므로 동일 request ID의 signature가 보존되지 않았다. 첫 호출의 operation/provider/model/input fingerprint를 transport 전에 예약한다. 같은 입력은 실패 후 재시도할 수 있고 다른 입력은 전송 전 `REQUEST_ID_CONFLICT`로 거부한다.
3. generate transport 수행 중 abort가 참으로 바뀌면 `COMPLETED`로 남았다. 실제 provider 응답과 final usage를 검증한 뒤 `ABORT_REQUESTED_UPSTREAM_COMPLETED`로 표기한다.
4. 129자 request ID는 `GatewayRequest`를 통과하지만 뒤늦게 receipt 생성에서 raw `ValueError`가 났다. generate, stream, health, discovery 모두 transport 전 128자 제한을 검사해 `MistralAdapterError(REQUEST_ID_INVALID)`로 거부한다.

| 단계 | 정확한 명령 | 종료 코드·결과 |
|---|---|---|
| reviewer RED | `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/providers/test_mistral_adapter_f05.py --tb=short` | 1; 8 failed, 50 passed in 0.23s. stream abort 2, generate abort 1, 실패 ID 재사용 1, oversize ID 4 |
| reviewer GREEN / final focused | 위 reviewer RED 명령 | 0; 58 passed in 0.10s |
| final 관련 provider·registry 회귀 | `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/providers tests/model_registry tests/provider_catalog tests/knowledge/test_model_registry_d11.py tests/budget tests/orchestration/test_delegation_packet.py tests/git_adapter --tb=short` | 0; 812 passed, 4 skipped in 9.14s |
| final compile | `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -c "from pathlib import Path; files=['packages/providers/mistral_adapter.py','packages/providers/mistral_models.py','packages/providers/mistral_errors.py','tests/providers/test_mistral_adapter_f05.py']; [compile(Path(p).read_text(encoding='utf-8'), p, 'exec') for p in files]; print('compile-ok', len(files))"` | 0; `compile-ok 4` |

## 조치

변경 파일은 승인된 제품 exact5만이다.

- `packages/providers/mistral_adapter.py`
- `packages/providers/mistral_models.py`
- `packages/providers/mistral_errors.py`
- `tests/providers/test_mistral_adapter_f05.py`
- `docs/04_test_reports/F-05_COMPLETION_REPORT.md`

`health`는 주입된 host transport의 상태 응답을 검사하며 실제 Mistral health API 존재를 뜻하지 않는다. 실제 Mistral wire·키 유효성·quota 응답·지연·운영 model discovery는 미검증이다. 키 부재·무효로 발생하는 실제 연동 오류는 제품 결함으로 집계하지 않고 미검증으로 남긴다. control/progress/HANDOFF 파일은 수정하지 않았고 commit·push·merge를 실행하지 않았다.

rollback은 Main Agent가 위 신규 exact5 파일만 제거하는 것이다. 기존 파일과 사용자 dirty 자료에는 손대지 않는다.
