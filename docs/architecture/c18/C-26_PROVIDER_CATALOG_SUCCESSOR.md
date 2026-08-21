# C-26 Provider Catalog Successor

This successor catalog supports the user-confirmed providers in canonical
order: CEREBRAS, GROQ, MISTRAL, OPENROUTER, UPSTAGE, GEMINI, ANTHROPIC, OPENAI,
OLLAMA. UPSTAGE is the default/primary provider when it is eligible.

Routing remains capability-based. A capability profile, privacy class, egress
policy, health and budget check determines eligibility first. An explicit
provider selection overrides the primary preference only when that provider is
eligible. Fallback order is deterministic canonical order and never bypasses
privacy, egress, capability, health, budget, or approval constraints.

The catalog stores only provider identifiers and placeholder configuration-key
names (`*_API_KEY` or `OLLAMA_BASE_URL`). Secret values are resolved later by
the Secret Broker and are never emitted to source, logs, reports, browser
payloads, or this document. The current environment's provider-key existence
was not inspected or copied into this artifact; live provider calls remain
out of scope for C-26.

The historical A-10 catalog and its evidence manifest remain unchanged. This
file and `packages/agent_team/provider_catalog.py` are a successor projection;
their content requires the successor artifact hash/binding to be refreshed
before promotion to an active operational baseline.
