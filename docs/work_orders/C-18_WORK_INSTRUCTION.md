# C-18 WorkInstruction — Capability-based MoA Provider/Model routing

## 범위

`packages/agent_team`의 기존 provider catalog를 확장해 CapabilityProfile·ProviderModelCatalog·CapabilityRouter·FallbackPolicy·RoutingProvenance·benchmark 계약과 provider/model drift 차단을 구현한다. 글쓰기·코딩·디자인 등 capability별 최적 provider/model 선택을 deterministic하게 재현하고, privacy/가격/region/retention/ZDR·probe TTL snapshot을 provenance에 남긴다.

허용 경로: `packages/agent_team/**`, `tests/agent_team/**`, `docs/04_test_reports/C-18_COMPLETION_REPORT.md`.

실제 Provider API/key, network, DB/API/browser/Telegram/deployment 호출과 secret 사용은 금지한다. Agent Team peer conversation은 변경하지 않는다.

## 완료 조건

1. capability 요구와 catalog snapshot에 맞는 provider/model이 deterministic하게 선택된다.
2. fallback policy가 비용·privacy·availability·budget 경계를 넘으면 fail-closed한다.
3. routing provenance와 benchmark 결과가 snapshot hash에 결박된다.
4. provider/model capability·가격·privacy drift와 stale probe TTL이 감지되면 신규 Run을 차단한다.
5. 신규·관련 테스트, compileall, diff-check와 미검증 운영 경계를 보고한다.
