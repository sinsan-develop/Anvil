# A-10 Provider·Egress·Secret·Routing 정적 계약

## 목적과 경계

Settings와 Execution Mode에서 canonical 9개 LLM Provider, model capability, role routing, DataEgressProfile, Secret 상태, capability drift를 같은 정적 UI·artifact 계약으로 확정한다.

- assigned: `AV-OPS-010`, `AV-LRN-028`
- verdict: `STATIC_CONTRACT_PASS`
- actual L3/L5, AI/AN, E-AUD/E-TEST and Provider/Secret/Egress runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`
- canonical runtime owners: `D-11`, `F-02`, `F-01~F-12`

## 핵심 계약

- Provider는 `CEREBRAS`, `GROQ`, `MISTRAL`, `OPENROUTER`, `UPSTAGE`, `GEMINI`, `ANTHROPIC`, `OPENAI`, `OLLAMA` 순서를 고정한다. unavailable provider도 숨기지 않고 상태·이유·다음 조치를 표시한다.
- Provider 상태는 `NOT_CONFIGURED|CHECKING|AVAILABLE|DEGRADED|UNAVAILABLE|DISABLED`다. credential reference, health, model discovery, capability snapshot, probe·benchmark evidence가 없으면 route를 활성화하지 않는다.
- Model capability는 이름으로 추측하지 않는다. provider/model revision, upstream, region/account reference, context·tool·structured output·image·cache, privacy/retention/training/ZDR, pricing version, probe·benchmark revision과 TTL을 결박한다.
- Secret 화면은 reference/version/status/audit만 표시한다. 값, token, API key, raw endpoint, provider raw error, unauthorized local path를 브라우저 payload·fixture·SVG에 넣지 않는다. 상태는 `ACTIVE|ROTATING|REVOKED|EXPIRED`다.
- DataEgressProfile은 `local_only|metadata_only|approved_paths|masked_content`와 provider allowlist, approved/excluded paths, revision/hash, actor/time, current/proposed diff, affected Run을 분리한다. 확장과 privacy·중요 capability·cost 변경은 사람 승인 전 활성화하지 않고 현재 Run snapshot을 소급 변경하지 않는다.
- Role routing은 Main/Developer/Reviewer/Tester/Reflection/Skill Curator의 required capability와 provider/model snapshot을 비교한다. Settings와 Execution Mode는 같은 9-provider catalog와 상태 의미를 사용한다.
- 동일 model ID라도 privacy, price, upstream, region/account, capability, probe·benchmark snapshot이 바뀌면 새 Run을 `BLOCKED_CAPABILITY_DRIFT`로 차단하고 재검증·필요 승인을 요구한다. current frozen Run은 바꾸지 않는다.
- fallback은 rate limit, timeout, transient 5xx만 허용하며 local-only→cloud, privacy/capability/context semantic drift, high-risk Reviewer 약화는 silent fallback하지 않는다.

## 화면과 검증

Provider Catalog, Provider/Model Detail, Credential Status Drawer, DataEgressProfile, Role Routing/Execution Mode, Drift Comparison, Evidence/Audit Drawer를 catalog와 focused Markdown, 1920×1080 SVG로 표현한다. Checker와 fixtures는 provider 순서·필드·상태, secret/endpoint 비노출, probe·benchmark, routing/egress/privacy guards, drift block, permission 분리, static promotion, predecessor·manifest integrity를 hostile mutation으로 fail-closed 검증한다.

No actual credential registration, provider connection/model refresh, routing activation, secret rotation/revoke, egress revision, API/DB/Event/browser/network/deploy. DIR is not reached at A-10.
