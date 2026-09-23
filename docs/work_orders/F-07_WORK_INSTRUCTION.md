# F-07 WorkInstruction — UPSTAGE adapter

- 승인 범위: 작업계획서 F-07의 UPSTAGE adapter와 계약 테스트. `generate`, `stream`, host transport `health`, model `discovery`, request ID, abort, final usage, quota/error/retry-after mapping을 구현한다.
- 제품 exact5: `packages/providers/upstage_adapter.py`, `packages/providers/upstage_models.py`, `packages/providers/upstage_errors.py`, `tests/providers/test_upstage_adapter_f07.py`, `docs/04_test_reports/F-07_COMPLETION_REPORT.md`.
- 기준: 설계서 canonical Provider ID `upstage`; 통합검증 `AV-OPS-010`, `AV-OPS-011`, `AV-FLOW-019(UPSTAGE)`; F-02 model snapshot·routing 계약을 수정하지 않는다.
- OmniRoute `release/v3.8.51` commit `20f39008892b683a639063fb8aed8c07782fb0c3`의 built-in `upstage` registry가 Provider 구현 기준이다. `format=openai`, `executor=default`, bearer key, 채팅 base URL `https://api.upstage.ai/v1/chat/completions`, 등록 모델 `solar-pro3`·`solar-mini`를 보존한다. Upstage 공식 자료는 응답·오류 wire 참고로만 사용하고, 모델 목록이나 제품 범위를 임의 확장하지 않는다.
- `discovery`는 OmniRoute 등록 모델 목록의 출처와 정적 성격을 명시한다. 공개 목록이나 정적 등록 결과를 credential health 또는 실시간 최신 모델 증거로 승격하지 않는다. host `health`는 인증된 실제 Provider probe에서 얻은 근거만 `AVAILABLE`로 판정하고, 이 Package는 구체적 host HTTP wiring을 구현하거나 실행하지 않는다.
- generate·stream은 기존 F-03~F-06 adapter의 주입형 transport/GatewayRequest/Response 경계를 따른다. 요청 ID를 송신 전 입력 fingerprint에 결박하고, 같은 입력 성공 replay는 결정적이며 실패 후 같은 입력 재시도는 허용한다. 다른 입력·operation 재사용은 송신 전에 거부한다.
- 스트림은 role-only delta, `usage:null`, 최종 usage와 completion ID의 일관성을 처리한다. final usage 없는 성공은 fail-closed한다. pre/post-send abort와 `PROVIDER_FINAL` 사용량 출처를 구분한다. 근거 없는 0 토큰·성공 상태를 만들지 않는다.
- 오류는 Upstage 특성을 반영한다. 401은 key/auth, 400은 요청 형식, 404/405는 endpoint/method를 우선 의심하고, 429는 명시적 응답 code/header를 근거로 rate limit과 usage/credit limit을 분리한다. 403은 credit·billing·IP policy 가능성이 있으므로 증거 없는 일괄 quota 또는 key 오류 단정을 금지한다. 408·5xx 일시 오류, retry-after 유효성·상한, 미확인 오류를 fail-closed 처리한다. 오류 본문·헤더·receipt에 credential 원문을 남기지 않는다.
- 테스트는 결정론적 fake host transport로 수행한다. 실제 Upstage key·API·network·DB·browser·WSL·deployment는 이 host-only Package에서 실행하지 않는다. 키 부재·무효 때문에 생기는 실제 연동 실패는 제품 코드 결함으로 집계하지 않고 미검증으로 기록한다.
- Developer는 제품 exact5만 수정한다. control/progress/HANDOFF, Git commit·push·merge는 Main Agent가 담당한다.
- 완료 조건: TDD RED/GREEN, focused test, 관련 provider·gateway·catalog·registry·budget 회귀, compile, 독립 검토, 미검증·잔여 위험·rollback 기록.
