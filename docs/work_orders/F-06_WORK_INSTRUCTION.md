# F-06 WorkInstruction — OPENROUTER adapter

- 승인 범위: 계획서 F-06의 OPENROUTER adapter와 계약 테스트. `generate`, `stream`, host transport `health`, model `discovery`, request ID, abort, final usage, 가격·quota/error mapping을 구현한다.
- 제품 exact5: `packages/providers/openrouter_adapter.py`, `packages/providers/openrouter_models.py`, `packages/providers/openrouter_errors.py`, `tests/providers/test_openrouter_adapter_f06.py`, `docs/04_test_reports/F-06_COMPLETION_REPORT.md`.
- 기준: 설계서 canonical Provider ID `openrouter`; 통합검증 `AV-OPS-010`, `AV-OPS-011`, `AV-FLOW-019(OPENROUTER)`; F-02의 model snapshot·routing 계약은 수정하지 않는다.
- OmniRoute `release/v3.8.51` commit `20f39008892b683a639063fb8aed8c07782fb0c3`의 built-in `openrouter` registry, model discovery/catalog, quota/error rule이 구현 기준이다. OpenRouter 공개 코드·API 문서는 wire 형태의 참고 자료일 뿐 제품 코드를 복사하거나 OmniRoute보다 상위 기준으로 삼지 않는다.
- OmniRoute 핵심 매핑: canonical `openrouter`, OpenAI-format chat/default executor, model passthrough, `/api/v1/models` discovery(공개 catalog라 credential health 증거가 아님), 별도 인증형 key health, model별 가격 문자열, 402 account/connection credit exhaustion, 모델별 404 실패가 다른 모델을 오염시키지 않도록 하는 error scope.
- 요청 모델 ID·응답의 실제 served model ID·generation ID를 구분해 영속 receipt에 보존한다. 실제 serving upstream provider는 응답의 신뢰 가능한 routing metadata 또는 generation metadata에서 확인된 경우만 기록한다. 모델 slug의 접두어를 실제 제공자로 추측하지 않는다. metadata가 없으면 `UNVERIFIED`로 남긴다.
- 가격은 catalog의 USD/token quoted rate와 응답·generation metadata의 실제 USD billed cost를 구분한다. Decimal로 finite·nonnegative를 검증하며, 가격 부재·불일치를 0원 또는 검증된 비용으로 둔갑시키지 않는다. F-02의 승인·budget·snapshot 데이터를 직접 변경하지 않는다.
- stream은 `stream_options.include_usage=true`를 요청하고 role-only delta, `usage:null`, `choices:[]` final usage를 처리한다. 최종 usage 없는 성공은 fail-closed한다. pre/post-send abort와 provider-final usage provenance를 구분한다.
- 동일 request ID의 입력 fingerprint를 첫 전송 전에 예약한다. 성공 replay는 결정적이고 실패 후 같은 입력 재시도는 가능하되 변경 입력·operation은 전송 전에 거부한다. malformed/unknown response, credential material, retry-after 오류와 non-finite JSON은 fail-closed한다.
- 실제 OpenRouter API, network, credential, DB, browser, WSL, deployment는 이 host-only Package에서 실행하지 않는다. 주입형 fake transport를 사용한다. 키 부재·무효 때문에 생기는 실제 연동 오류는 제품 결함으로 집계하지 않고 미검증으로 기록한다.
- Developer는 제품 exact5만 수정한다. control/progress/HANDOFF, Git commit·push·merge는 Main Agent가 담당한다.
- 완료 조건: TDD RED/GREEN, focused test, 관련 provider·registry·budget 회귀, compile, 독립 검토, 미검증·잔여 위험·rollback 기록.
