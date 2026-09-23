# F-09 ANTHROPIC adapter 개발 완료보고

## 판정

`COMPLETED` — host-only Anthropic Messages 어댑터 구현 및 독립 검토 Important 4건과 재검토 잔여 Important 1건 재작업 후 관련 로컬 회귀 통과. Main Agent의 재검토·진행 정본 결박·Git/PR 통합 판정은 남아 있다.

## 기준·범위

- Work Package `F-09`, 작업자 `developer-primary-f09-r1`, branch `codex/f09-anthropic-adapter`.
- 시작 HEAD `4664012d8d5794d8ebcca7686b648e6fc5326c9f`; 시작 `git -c core.excludesFile= status --short` 출력 없음.
- design SHA-256 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`; plan `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`; matrix `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`; test plan `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`; operating rules `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`; WorkInstruction `7E1EAE1729F2F8774A68DAFB02FB4FA863265E13E42A9D38CC0AE24F5EEE1C46`.
- 활성 `worker-lease-f09-r1-20260924-001`의 execution token `f09-r1-execution-fence-epoch-1-bad806b8ca0d4bbf`, 종속 `write-lease-f09-r1-20260924-001`의 write token `f09-r1-write-fence-epoch-1-18f22f138034c4a7` 확인.
- 1차 출처: 로컬 read-only OmniRoute `release/v3.8.51` `20f39008892b683a639063fb8aed8c07782fb0c3`의 Anthropic registry. 보조 출처: 공식 Messages·Streaming·Models Get·Errors 문서(WorkInstruction 링크).

## 변경 파일과 영향

- `packages/providers/anthropic_models.py`: pinned 11 모델 정적 목록, `claude` wire/endpoint 상수, host transport의 분리된 값 및 receipt.
- `packages/providers/anthropic_errors.py`: credential 비노출 검사, HTTP/Anthropic error type·Retry-After 근거 기반 분류. `enforced_spend_limit_reached`와 400/429의 지정 지출 한도 문구는 재시도 불가 지출 한도로 분류하며, 다른 429는 Retry-After 유무와 무관하게 `PROVIDER_429_AMBIGUOUS`.
- `packages/providers/anthropic_adapter.py`: 주입된 host transport로 Messages generate/stream/health/discovery, request ID binding/replay/재시도, pre/post-send abort, 누적 final usage, stream 순서·오류 검증. Cache read/creation 입력을 `TokenUsage.input_tokens`에 합산하고 raw 사용량을 receipt에 보존. API key는 어댑터가 수신하지 않음.
- `tests/providers/test_anthropic_adapter_f09.py`: native wire와 모델 alias, SSE 누적 usage·순서·오류, health attestation, 인증정보 차단, 오류/abort/replay 검증.
- 본 보고서. 기존 Provider/Gateway·control·progress/Git 파일 변경 없음.

## 검증 증거

- `& 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests/providers/test_anthropic_adapter_f09.py`: 최초 신규 모듈 부재로 collection 실패(exit 1); 구현 중 stream identity conflict와 중간 누적 usage 동작 테스트가 각각 기대한 실패(exit 1) 후 수정. 독립 검토 재작업 재현 테스트는 수정 전 `9 failed, 26 passed`(exit 1), 추가 입력 단조성 테스트는 수정 전 `1 failed, 35 passed`(exit 1). 재검토 잔여 429 테스트는 수정 전 `2 failed, 35 passed`(exit 1). 최종 `37 passed in 0.07s`, exit 0.
- `& 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests/providers tests/llm_gateway tests/provider_catalog tests/model_registry tests/budget`: 최초 `585 passed, 4 skipped`; 1차 재작업 후 `593 passed, 4 skipped`; 2차 재작업 후 `594 passed, 4 skipped in 4.87s`, exit 0. 네 skip은 기존 별도 환경 게이트이며 F-09 성공 증거로 계산하지 않는다.
- `& 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -c "import ast,pathlib; paths=['packages/providers/anthropic_adapter.py','packages/providers/anthropic_models.py','packages/providers/anthropic_errors.py','tests/providers/test_anthropic_adapter_f09.py']; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in paths]; print('AST PASS',len(paths))"`: `AST PASS 4`, exit 0.
- `git diff --check`: 출력 없음, exit 0. 네 제품 경로는 신규 untracked이므로 최종 staged diff 검사는 Main Agent가 수행한다.

## 독립 검토 재작업 전후

- I1 이전: 마지막 `message_delta`에 출력 사용량이 없어도 이전 누적값을 최종으로 승격. 이후: 마지막 delta에 `output_tokens` 필수, 시작 입력 증거와 입력·출력 누적 단조성 확인. 누락/감소는 `RESPONSE_MALFORMED`.
- I2 이전: 인증된 모델 GET body가 임의 `claude-*`면 health `AVAILABLE`. 이후: 요청 `claude-sonnet-4.6` alias와 동등하거나 `claude-sonnet-4-6-...` concrete ID인 경우만 허용. 다른 제품군 ID는 거부하고 해결된 ID는 receipt에 기록.
- I3 이전: 지정 지출 한도 400을 `INVALID_REQUEST`, 월 지출 한도 429와 Retry-After를 `RATE_LIMIT`으로 분류. 이후: 공식 지출 한도 문구·`enforced_spend_limit_reached` 세부 코드를 우선 판별해 재시도 불가 `SPEND_LIMIT_REACHED`.
- I4 이전: 캐시 입력을 gateway input tokens에 포함하지 않음. 이후: `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`를 확정 input 사용량으로 기록하고 원 세부값은 receipt에 보존. 공식 [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)의 total input 정의를 적용했다.
- I3 재검토 이전: 일반 429 `rate_limit_error`와 Retry-After를 자동으로 재시도 가능 RATE_LIMIT으로 판정. 이후: Claude Code workspace 지정 지출 한도에도 429와 Retry-After가 함께 올 수 있다는 [공식 한도 설명](https://platform.claude.com/docs/en/api/rate-limits)에 따라 명시적 spend 문구/코드만 지출 한도로 분류하고 다른 429는 헤더 유무와 관계없이 재시도 불가 `PROVIDER_429_AMBIGUOUS`로 유지.

## 미검증·잔여 제약

- 실제 Anthropic key/API·network, 모델별 실제 가용성, WSL/DB/browser/deploy, 실제 요금 사용은 수행하지 않았다. 정적 discovery의 credential health/live freshness는 `UNVERIFIED`.
- 공유 `GatewayResponse`가 선행·후행 공백을 금지하므로 정상 native text라도 해당 공백이 있으면 자동 절단하지 않고 `OUTPUT_TEXT_NON_CANONICAL`로 거부한다. 공개 데이터 계약 변경은 이 작업 범위 밖이다.
- Host transport가 반환한 구조화 응답/인증 결박 증거를 검증하는 계약 테스트이며 실제 host HTTP 구현과의 통합은 후속 검증 경계다.
- 실패 횟수: 정식 `FAILURE_REPORT` 0회. TDD 중 기대한 RED는 정식 실패로 계산하지 않았다.

## 다음 조치·rollback

- Main Agent가 exact5 diff와 보안·wire 독립 검토를 수행하고, 필요시 동일 lease 범위 재작업을 지시한다. 그 뒤 정본 progress/HANDOFF와 Git·PR 통합을 수행한다.
- 병합 전 rollback은 이 브랜치의 F-09 신규 파일/변경 commit을 제외하는 것이다. 병합 후에는 해당 Stage merge의 정상 revert를 사용한다. 기존 Provider/Gateway 계약 파일은 수정하지 않았다.
