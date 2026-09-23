# F-08 GEMINI adapter 완료보고

## 판정

`COMPLETED` — F-08 제품 exact5의 host-only 구현과 결정론적 계약 테스트를 완료하고 독립 검토 `C0/I3/M1` 및 재검토 `C0/I1/M1`의 Important 보완을 반영했다. Main Agent의 재검토와 인수 판정은 별도다. 실제 Gemini key/API/network, DB, 브라우저, WSL, 배포는 실행하지 않았다.

## 판단 이유

- 작업자: `developer-primary-f08-r1`. 시작 시 worker lease `worker-lease-f08-r1-20260924-001` / execution fence `f08-r1-execution-fence-epoch-1-150139c4bf73fcfa`, write lease `write-lease-f08-r1-20260924-001` / write fence `f08-r1-write-fence-epoch-1-4e5464af995bc431`을 progress/HANDOFF에서 확인했다. 두 lease는 `ACTIVE`, 만료 `2026-09-24T13:15:00+09:00`, path scope는 이 보고서 포함 제품 exact5다.
- 시작 worktree `D:\Project\Anvil\.codex-sandbox\f08-gemini-adapter`, branch `codex/f08-gemini-adapter`, HEAD `22bc931cd527a67a04d5f61fa1f4e200895ddce2`, `git status --short` clean. lease의 기준 Git commit/dispatch HEAD `150139c4bf73fcfa4e5464af995bc431f3d2a056`과 후속 worktree HEAD를 구분했다.
- 기준 SHA-256: 설계 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`; 작업계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`; 통합검증매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`; 테스트계획 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`; 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`; F-08 WorkInstruction `751FFDBF493C58A7F6D47A1B8E7A680E180E7A27D6E01D291EB8095055030DC2`. 활성 WorkInstruction의 SHA는 progress 기록과 일치했다.
- OmniRoute read-only source `D:\Project\.omniroute-inspect`, `release/v3.8.51` HEAD `20f39008892b683a639063fb8aed8c07782fb0c3`의 `open-sse/config/providers/registry/gemini/index.ts` 및 `open-sse/config/providers/shared.ts`를 확인했다. 정적 모델 8개, `format=gemini`, `executor=default`, base URL, `x-goog-api-key`, generate/stream URL builder가 기준이다. Google 공식 [generateContent API](https://ai.google.dev/api/generate-content), [Models API](https://ai.google.dev/api/models), [API errors](https://ai.google.dev/gemini-api/docs/generate-content/api-errors)는 wire·오류 해석의 보조 기준이다.
- F-02 model snapshot/routing/Secret 경계와 기존 Provider 파일은 수정하지 않았다. 계약 검증 범위는 `AV-OPS-010`, `AV-OPS-011`, `AV-FLOW-019(GEMINI)`의 host fixture 경계다.

## 조치와 변경 파일

- `packages/providers/gemini_models.py`: OmniRoute 정적 모델 8개와 TTS 전용 표시, 검증된 model endpoint, transport/receipt/stream 값 객체와 결정적 hash. `TransportResponse.authenticated_probe`는 host가 제공하는 증거이며 Google model resource body와 별개다.
- `packages/providers/gemini_errors.py`: HTTP status와 Gemini `details[].reason`을 조합한 400/401/402/403/404/408/429/5xx 분류, `Retry-After` 형식·상한, credential 원문 차단. 일반 429 `RESOURCE_EXHAUSTED`는 rate와 spend 중 하나로 단정하지 않으며 명시적 rate reason일 때만 retryable이다.
- `packages/providers/gemini_adapter.py`: host에 검증된 endpoint와 `contents` JSON body를 분리해 전달한다. 송신 전 request ID/input fingerprint 결박, 성공 replay·실패 후 동일 입력 재시도, generate/stream, abort, final usage, receipt, 정적 discovery, 인증형 model GET health를 구현했다. `modelVersion`은 요청 alias와 다를 수 있어 유효한 응답값을 receipt에 보존하고 stream frame 간 상충은 거부한다. `totalTokenCount`에 thinking token을 포함해 Gateway output usage는 `total - prompt`로 기록한다.
- `tests/providers/test_gemini_adapter_f08.py`: 실제 key/network 없이 fake host로 native wire·endpoint/body 분리·stream final frame·응답 일관성·usage·abort·TTS 차단·health/discovery 분리·request ID·오류·credential 경계를 검증한다.
- 이 완료보고. 다른 제품·control/progress/HANDOFF 파일은 수정하지 않았다. Git commit/push/merge도 수행하지 않았다.

## 실행 명령과 실제 결과

모든 pytest는 worktree cwd에서 `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B`, `--import-mode=importlib -p no:cacheprovider`로 실행했다.

1. 최초 RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --import-mode=importlib -p no:cacheprovider tests/providers/test_gemini_adapter_f08.py` → exit 1, 수집 중 `ModuleNotFoundError: packages.providers.gemini_adapter`. 구현 부재를 확인했다.
2. 최초 GREEN: 같은 focused 명령 → exit 0, `30 passed`.
3. Endpoint/body 분리와 modelVersion/stream fixture 수정 RED: 같은 focused 명령 → exit 1, transport `endpoint` 인자 누락과 기존 wire/모델 처리 차이가 실패했다. 수정 후 같은 focused 명령 → exit 0, `32 passed`.
4. Health 인증 attestation 분리 RED: 같은 focused 명령에 `--tb=line` 추가 → exit 1, `TransportResponse`의 host attestation 인자가 아직 없었다. 반영 후 같은 명령 → exit 0, `32 passed`.
5. Thinking 합계와 stream intermediate usage RED: 같은 focused 명령에 `--tb=line -k 'thinking_tokens or intermediate_usage'` 추가 → exit 1, `2 failed, 32 deselected`. 반영 후 같은 focused 명령 → exit 0, `34 passed`.
6. 최초 구현 관련 회귀: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -rs --import-mode=importlib -p no:cacheprovider tests/providers tests/llm_gateway tests/provider_catalog tests/model_registry tests/budget` → exit 0, `545 passed, 4 skipped in 4.36s`. 4 SKIP은 `tests/budget/test_atomic_reservation.py`의 isolated PostgreSQL 18 DSN 미설정이다.
7. AST 검사: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -c "import ast,pathlib; files=['packages/providers/gemini_adapter.py','packages/providers/gemini_models.py','packages/providers/gemini_errors.py','tests/providers/test_gemini_adapter_f08.py']; [ast.parse(pathlib.Path(x).read_text(encoding='utf-8'),filename=x) for x in files]; print('compile AST OK',len(files))"` → exit 0, `compile AST OK 4`.
8. `git status --short; git diff --check; git diff --stat` → exit 0. 신규 제품 4개는 untracked이며 `git diff --check`의 검사 범위에 포함되지 않는다. 이 보고서는 그 검사 후 생성했다.

## 독립 검토 재작업 — `C0/I3/M1`

- I1 변경 전: Provider 응답의 분할된 text part/frame은 개별 JSON에서 credential 정규식에 걸리지 않으며 결합 후에는 response/receipt로 저장될 수 있었다. 변경 후: generate와 stream의 전체 출력 결합 직후, `GatewayResponse`·receipt 생성 전에 `guard_material`을 적용한다. `api_` + `key=very-secret` 두 경로 모두 거부하고 receipt를 남기지 않는 테스트를 추가했다.
- I2 변경 전: host가 던진 `GeminiAdapterError`를 그대로 전파하거나 일반 예외를 암묵적으로 chaining할 수 있었다. 변경 후: host 호출에서 발생한 모든 `Exception`을 고정 `TRANSPORT_FAILURE`로 바꾸고 `from None`으로 원문 traceback chaining 표시를 억제한다. Gemini형/일반 host 예외 각각에 대해 출력된 traceback에 secret이 없는지 검증했다.
- I3 변경 전: 앞 frame에 text가 있어도 마지막 `STOP`+완전한 usage frame의 본문이 비면 거부했다. 변경 후: 동일 response ID/modelVersion의 마지막 빈 본문은 허용한다. 앞선 text가 전혀 없으면 계속 거부하며, final usage가 없거나 ID/version이 다르면 기존 fail-closed 경계를 유지한다.
- M1 변경 전: 선행·후행 공백이 있는 Provider 출력이 공통 `GatewayResponse`의 `ValueError`로 노출됐다. 변경 후: 공통 계약은 유지하며, 출력의 정규형을 adapter에서 검사해 `OUTPUT_TEXT_NON_CANONICAL`로 거부한다. 자동 strip으로 Provider 원문을 바꾸지 않는다. Generate/stream 테스트를 추가했다.
- 재작업 RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --tb=line --import-mode=importlib -p no:cacheprovider tests/providers/test_gemini_adapter_f08.py -k 'joined_text or host_exception or empty_stop or noncanonical_provider'` → exit 1, `7 failed, 1 passed, 37 deselected`. 기존 구현이 네 finding을 재현했다.
- 재작업 focused GREEN: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --tb=line --import-mode=importlib -p no:cacheprovider tests/providers/test_gemini_adapter_f08.py` → exit 0, `45 passed in 0.08s`.
- 재작업 후 관련 회귀: 6번과 같은 명령 → exit 0, `553 passed, 4 skipped in 4.10s`. Skip 원인은 위와 같다.
- 재작업 후 AST: 7번과 같은 명령 → exit 0, `compile AST OK 4`. `git status --short`는 이 보고서 포함 정확한 신규 5개 파일만 표시했다. 신규 untracked 파일은 `git diff` 출력에 포함되지 않는다.

## 재검토 Important 보완 — 마지막 frame의 `parts` 생략

- 원인: 앞 frame에서 text가 생성된 뒤 동일 ID/modelVersion의 마지막 `STOP` frame에 `content={"role":"model"}`가 오면 `_parse_frame`이 `parts`를 필수 list로 검사해 `RESPONSE_MALFORMED`로 거부했다. [ProtoJSON의 default field 규칙](https://protobuf.dev/programming-guides/json/#presence-and-default-values)은 빈 repeated field를 출력에서 생략할 수 있게 한다. [Gemini Content API](https://ai.google.dev/api/generate-content)는 `role`도 optional로 정의한다.
- 변경 전: 마지막 `content={"role":"model"}`와 `content={}` 모두 거부. 변경 후: 마지막 `STOP` frame에서 `parts`가 생략되고 role이 `model` 또는 생략된 경우에만 빈 본문으로 허용한다. 앞 frame의 text, 마지막 frame의 완전한 usage, 전체 frame의 동일 ID/modelVersion이 있어야 성공한다. 마지막만 비어 있는 전체 빈 응답은 계속 거부한다. 일반 중간 frame이나 generate의 생략은 허용하지 않는다.
- RED: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --tb=line --import-mode=importlib -p no:cacheprovider tests/providers/test_gemini_adapter_f08.py -k 'protojson'` → exit 1, `2 failed, 2 passed, 45 deselected`; `parts` 생략 성공 경로 두 개가 기존 검사에서 실패했다.
- GREEN focused: `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q --tb=line --import-mode=importlib -p no:cacheprovider tests/providers/test_gemini_adapter_f08.py` → exit 0, `49 passed in 0.09s`.
- 관련 회귀: 6번과 같은 명령 → exit 0, `557 passed, 4 skipped in 4.04s`. 4 SKIP은 isolated PostgreSQL 18 DSN 미설정이며 실제 DB 결과가 아니다.
- AST: 7번과 같은 명령 → exit 0, `compile AST OK 4`. `git status --short`는 완료보고 포함 신규 exact5만 표시하고 HEAD `22bc931cd527a67a04d5f61fa1f4e200895ddce2`는 불변이다. Git commit/push, control/progress/HANDOFF 수정은 수행하지 않았다.

## 미검증·잔여 위험·복구

- `UNVERIFIED`: 실제 Gemini credential/API/network, API-key 주입 및 OAuth/bearer 경로, 실제 model availability, authenticated live health, 실제 streamed SSE shape와 error detail 표현, DB, 브라우저, WSL, 배포. OmniRoute OAuth 설정은 이 host-only 범위에서 구현하지 않았다.
- 정적 discovery는 등록 출처와 미검증 상태만 표현한다. fake host의 `AVAILABLE` receipt는 live credential health의 증거가 아니다. `authenticated_probe=True`를 host가 실제 인증된 model GET과 결박하는 배선은 이 Package 밖이다.
- 사용량·응답 ID·stream 마지막 frame의 provider usage가 미완성 또는 상충하면 fail-closed한다. `modelVersion`과 요청 alias 사이의 lineage/drift 판정은 F-02 snapshot 경계에 남긴다. 오류 reason 미확인 429는 자동 재시도 대상으로 승격하지 않는다.
- Provider 출력이 선행·후행 공백을 포함하면 자동 정규화하지 않고 `OUTPUT_TEXT_NON_CANONICAL`로 거부한다. 이는 정상 Provider text도 해당 공백이 있으면 전달할 수 없다는 잔여 호환성 제약이며, 공통 `GatewayResponse` 계약 변경은 이 Package 범위 밖이다.
- Rollback: Main Agent가 이 F-08 신규 다섯 파일만 작업 브랜치에서 제거하고 관련 회귀를 다시 실행한다. 기존 F-02/다른 Provider 계약의 변경은 없다.
- `docs/progress/build-progress.json` 및 `docs/progress/BUILD_HANDOFF.md` 갱신, 독립 검토와 인수 판정은 Main Agent 소유이므로 작업자가 수행하지 않았다.
