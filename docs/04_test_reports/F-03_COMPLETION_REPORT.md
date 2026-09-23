# F-03 CEREBRAS adapter Developer 완료보고

## 판정

`COMPLETED` — exact5 제품 범위 안에서 host-only CEREBRAS adapter와 계약 테스트를 TDD로 구현했다. 이 판정은 Developer 기본 검증 결과이며 Main 검토·독립 Tester acceptance가 아니다.

## 기준선·권한

- Work Package: `F-03`
- branch / 시작 HEAD: `codex/f03-cerebras-adapter` / `9ec430908a3473815d5839f028d290414494f37b`
- 등록 start baseline `1fadc0a7c7a69588a5cb5a6e36a95399b1a1791e`는 현재 HEAD의 ancestor이며, Main dispatch가 현재 clean upstream HEAD `9ec4309...`를 실행 기준으로 재확인했다.
- actor: `developer-primary-f03-r1`
- worker lease / execution fence: `worker-lease-f03-r1-20260923-001` / `f03-r1-execution-fence-epoch-1-1fadc0a7c7a69588`
- write lease / write fence: `write-lease-f03-r1-20260923-001` / `f03-r1-write-fence-epoch-1-5cb5a6e36a95399b`
- WorkInstruction SHA-256: `656DE3EF0FC3510C2796CCCE6AB1F04B5541476E796AD0FFE0E1851898819D2A`
- Invocation SHA-256: `9F178535BBBE15573B4029646EA847D3D6C8B52FC7AF3E9D1254E163224589B7`

## 변경과 계약

1. `packages/providers/cerebras_adapter.py`
   - 주입된 host transport만 소비하며 직접 network·credential·DB I/O를 수행하지 않는다.
   - 기존 `ProviderAdapter`의 `generate/probe` 및 `GatewayRequest/GatewayResponse/TokenUsage/UsageProvenance` 계약을 재사용한다.
   - `generate`, `stream`, `health`, `discovery`, pre-send abort, post-send abort/final usage, request replay/conflict를 구현했다.
2. `packages/providers/cerebras_models.py`
   - plain JSON transport response, immutable detached receipt, stream result, canonical serialization/hash를 구현했다.
3. `packages/providers/cerebras_errors.py`
   - auth/permission/rate-limit/quota/timeout/5xx/invalid-request를 안정 code로 결정론적으로 매핑한다.
   - 429 ambiguity, unknown error, malformed/overflow retry-after, credential material은 retry/fallback 가능한 정상 오류로 승격하지 않고 fail-closed한다.
4. `tests/providers/test_cerebras_adapter_f03.py`
   - fake transport만 사용해 정상/stream/health/discovery/abort/usage/error/ambiguity/credential/replay/immutability/determinism을 검증한다.
5. 이 보고서.

## TDD·검증 증거

- RED 1: `python -m pytest ...`는 실행 파일 부재, `uv run pytest ...` 첫 실행은 sandbox의 uv cache ACL 거부였다. 이는 제품 RED가 아니다.
- RED 2(유효): `.venv/Scripts/python.exe -m pytest ... tests/providers/test_cerebras_adapter_f03.py -q` → exit1, `ModuleNotFoundError: packages.providers`로 신규 기능 부재를 확인했다.
- GREEN 1: F-03 focused → exit0, `28 passed in 0.08s`.
- Provider-neutral probe 보강 RED: 단독 테스트 → exit1, `isinstance(adapter, ProviderAdapter) == False`.
- GREEN 2: F-03 focused → exit0, `29 passed in 0.07s`.
- 관련 회귀 1: F-03 + C-01 gateway + F-01 catalog + F-02 routing → exit0, `169 passed in 8.82s`.
- 관련 회귀 2: `--import-mode=importlib`로 providers/model_registry/provider_catalog/D11/budget/delegation/git_adapter → exit0, `693 passed, 4 skipped in 18.43s`. skip4는 기존 isolated PostgreSQL 18 DSN 미설정이며 실제 DB PASS가 아니다.
- completion 직전 fresh 재검증: focused exit0 `29 passed in 0.06s`; 같은 관련 회귀 exit0 `693 passed, 4 skipped in 13.61s`; builtin compile exact3 `COMPILE_PASS 3`; Git 상태 exact5 외 변경 0; exact5 trailing whitespace 0.
- repository 전체 bare pytest 시도 → collection exit1, 16 errors. 제품 assertion failure 전 단계에서 기존 실행환경의 `yaml`/`httpx` 미설치, fixture `src` 비패키지 수집, 동일 basename import mismatch로 중단됐다. 이 결과를 PASS로 승격하지 않는다.

## 미검증·제외

- 실제 CEREBRAS API, network, credential/Secret Broker injection, DB, UI/browser, container, WSL, staging, production, deploy는 `NOT_EXECUTED`다.
- 실제 provider의 wire schema/drift, upstream abort 전파·invoice reconciliation은 fake transport 계약만 검증했으며 운영 증거가 아니다.
- 독립 Tester 및 AV-OPS-010/011, AV-FLOW-019(CEREBRAS) 최종 판정은 미수행이다.
- 전체 repository bare pytest는 위 collection 환경 오류로 non-green이며, 관련 회귀 693건 결과만 현재 변경 영향의 회귀 증거다.

## 기존 기능·잔여 위험·rollback

- 기존 owner 파일 수정 0, control/progress/HANDOFF 수정 0, commit/push/PR/merge 0, 외부 side effect 0이다.
- 실패/receipt의 운영 저장, Secret Broker 실제 주입, Provider wire drift는 후속 통합 경계에 남는다.
- rollback은 Main이 이 보고서에 적힌 신규 exact5만 제거하면 된다. 기존 tracked/untracked 자료, control 파일, branch history는 변경하지 않는다.

## R1 Main adversarial 재작업

- 원인 1: credential 검사가 header 값의 `Bearer/Basic/key=value` 형태만 탐지하여, `authorization: innocent-looking-value`처럼 credential-bearing 이름 자체가 위험한 header를 허용했다.
- 원인 2: Python `json.dumps` 기본값이 비표준 `NaN/Infinity/-Infinity`를 허용하여 canonical JSON 경계가 RFC JSON보다 넓었다.
- 회귀 테스트 선행 RED: credential-bearing header 이름 8종과 non-finite number 3종, 합계 `11 failed, 29 deselected in 0.13s`, exit1.
- 최소 수정: normalized header name이 `authorization|apikey|token|secret` 계열이면 값과 무관하게 `CREDENTIAL_MATERIAL_DETECTED`; canonical serialization은 `allow_nan=False`로 고정했다. 오류 문자열은 stable code만 반환하여 header value를 포함하지 않는다.
- 신규 회귀 GREEN: `11 passed, 29 deselected in 0.06s`, exit0.
- R1 final focused: `40 passed in 0.07s`, exit0.
- R1 관련 회귀: `704 passed, 4 skipped in 8.51s`, exit0. skip4는 동일한 isolated PostgreSQL 18 DSN 미설정이며 실제 DB PASS가 아니다.
- R1 builtin compile exact3: `COMPILE_PASS 3`, exit0. 전용 pytest basetemp residue 0.
- R1은 기존 exact5 안의 `cerebras_errors.py`, `cerebras_models.py`, 테스트, 이 보고서만 수정했으며 control/commit/push/network 변경은 없다.

## R2 독립 Reviewer 재작업 — C0 / I2 / M0

- Reviewer 판정: Critical 0, Important 2, Minor 0, 따라서 `REWORK`.
- I1 원인: transport protocol이 pre-send/connect/ambiguous-send 단계를 증명하지 않는데도 `_send`가 임의 transport exception을 `retryable=True`로 승격했다. 안전한 재시도 증거가 없으므로 generic `TRANSPORT_FAILURE`를 non-retryable로 닫았다. 원문 exception은 stable code에 포함하지 않는다.
- I2 원인: stream parser가 `finish_reason=stop`과 final usage의 존재만 누적 확인하여 둘의 동일 terminal frame 결박과 후속 frame 0을 검증하지 않았다. terminal/final usage는 정확히 한 마지막 frame에 함께 있어야 하며, 선행 usage·usage 지연·terminal 이후 content/empty frame을 모두 `RESPONSE_MALFORMED`로 거부하도록 수정했다.
- 테스트 선행 RED: generic transport retry 승격 1건과 악성 stream 순서 4종, `5 failed, 40 deselected in 0.12s`, exit1.
- 최소 수정 GREEN: 같은 회귀 `5 passed, 40 deselected in 0.05s`, exit0.
- R2 final focused: `45 passed in 0.08s`, exit0.
- R2 관련 회귀: `709 passed, 4 skipped in 8.74s`, exit0. skip4는 기존 isolated PostgreSQL 18 DSN 미설정이며 실제 DB PASS가 아니다.
- R2 builtin compile exact3: `COMPILE_PASS 3`, exit0. 전용 pytest basetemp residue 0.
- R2는 공개 transport 계약이나 새 retry 단계 정보를 추가하지 않았고, 기존 exact5 밖 파일·control·commit·push·network를 변경하지 않았다.
