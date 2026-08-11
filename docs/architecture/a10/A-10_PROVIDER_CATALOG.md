# A-10 Provider Catalog

- classification: `STATIC_ONLY`; package verdict: `STATIC_CONTRACT_PASS`
- verification: `AV-OPS-010`, `AV-LRN-028`; runtime owners: `D-11`, `F-02`
- runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`

The Settings catalog fixes this visible order: CEREBRAS, GROQ, MISTRAL, OPENROUTER, UPSTAGE, GEMINI, ANTHROPIC, OPENAI, OLLAMA. Every unavailable entry remains visible with reason and next_action; a credential is represented only by a masked reference and status.

- reason: this static catalog does not establish a real provider connection or capability.
- next_action: F-02 obtains an approved capability probe and benchmark before route activation.
- actual Provider/Secret/Egress/API/DB/Event/browser/network/runtime/DIR: NOT_EXECUTED
