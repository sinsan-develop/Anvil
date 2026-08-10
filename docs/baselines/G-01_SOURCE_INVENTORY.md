# G-01 Source Inventory

- inventory_id: `SOURCE-INVENTORY-G-01-20260810-001`
- captured_at: `2026-08-10`
- scope: 승인 기준선, 내부 운영 근거, 참조 프로젝트 snapshot, 공식 개념 근거

## 1. 로컬 권위·운영 source

| Source | Revision/Hash | 분류 | 적용 범위 |
|---|---|---|---|
| `Anvil_설계서_v2.md` | SHA-256 `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` | canonical | 제품 전체 설계 |
| `Anvil_작업계획서_v1.md` | SHA-256 `A88FCA548143B4C5208E106EBDF6009E438806547513A7C89F50A9E922C5C335` | canonical | 97개 Package |
| `Anvil_통합검증매트릭스_v1.md` | SHA-256 `E911650466ACAE87599CD8CBBFE29B301F47A9D37B225D2DAD090A6BF13A3904` | canonical | 255개 ID |
| `Anvil_테스트계획서_v1.md` | SHA-256 `FE6AEFE4A352A29D61CCD8AC3DD2EB6D6C9B1CDF8E3C095DFDC593C06586D1B8` | canonical | 테스트 실행 계약 |
| `AGENTS.md` | SHA-256 `BFF4DB0D1C17EF0794666A56A3156C92A53E1EE1D54ADFFFEB462571AAEEE3EA` | canonical | Agent 운영 진입점 |
| `docs/governance/ANVIL_OPERATING_RULES.md` | SHA-256 `71006092D9A1A6F97DD47ECB2436C5986A3632A27CC1C7942D921911490A8C74` | canonical | 개발 운영 규칙 |
| `docs/onboarding/developer-primary-ack.md` | SHA-256 `282EED40F563B87373C8952111BA5834E1ACF48BDB0E05949E5370ED51AB4246` | evidence | Developer 재온보딩 |
| `MoaWorks_Subagent_단계적_적용_권고안.docx` | SHA-256 `0C033D15389AE00DAC27373D028DE7FF375EE2855925714804C55C741AC7B77D` | internal reference | 역할·단계 적용·3회 인수 |

MoaWorks 절대경로: `C:\Users\cyhuh\OneDrive\문서\AI 자료\MoaWorks_Subagent_단계적_적용_권고안.docx`. 외부 원본은 read-only이며 workspace에 복제하지 않는다.

## 2. 선행 Anvil 자료

| Source | Hash | 분류 |
|---|---|---|
| `Backup/Anvil/Anvil_설계서.md` | SHA-256 `7B0C38ED2AEAACD8C8C23CB9667491C9D1DEBF2495841BEAB4B8FC02D4B428A6` | historical context |
| `Backup/Anvil/Anvil_화면메뉴설계.docx` | SHA-256 `5A8D3A86750A24381A1D10F18FB87BFCC55F9AC1C529B8261A9A97AB2ACA65FA` | historical UI context |
| `Backup/Anvil` top-level 20-file manifest | SHA-256 `5FFFEDFC941177F05E023BB61938169A2A81E53A37E68CBF4A7E60A920627B1E` | historical bundle inventory |

이 자료는 현재 설계서보다 우선하지 않으며 누락 의도·과거 판단 확인에만 사용한다.

## 3. 참조 프로젝트 snapshot

| Project | Canonical remote | Local HEAD / tree | Worktree 상태 | 사용 규칙 |
|---|---|---|---|---|
| Forge | `https://github.com/cyhuh428-sinsan/Forge.git` | `d43c395b9e44f1ed54671842cd172eebbd2f79cc` / `69d7155d2a898a35c529df141d9f436337a65474` | dirty 4건 | HEAD tree만 contextual evidence |
| LogicForge | `https://github.com/cyhuh7950/logicforge` | `1fbd9a93b2dd194622995b826fefd0a84a5c1609` / `e3ba58accfd777da8f81cf23ce5bcbc805f8df05` | dirty 4건, local remote 없음 | 사용자 제공 URL과 local commit 관계 미확정 |
| OrcheFlow | `https://github.com/cyhuh428-sinsan/OrcheFlow.git` | `f66d0d44a84ec6ff1ac0b13686c4b64b42a0af47` / `3e16ee307a1029f184d02ee9ae8dd85dc5a709ae` | dirty 103건 | HEAD tree만 contextual evidence |

참조 프로젝트는 Anvil의 독립 설계를 대체하지 않는다. dirty/untracked 내용은 별도 승인·hash 없이 설계 근거로 승격하지 않는다.

## 4. 공식 개념 source

2026-08-10 read-only audit에서 아래 18개 URL이 redirect 없이 HTTP 200으로 확인됐다.

| Source | URL | Revision marker | 적용 범위 |
|---|---|---|---|
| Hermes Memory | `https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/` | ETag `6a78f82e-12183`, Last-Modified 2026-08-09 | persistent memory |
| Hermes Skills | `https://hermes-agent.nousresearch.com/docs/user-guide/features/skills` | ETag `6a78f82e-2bf86`, Last-Modified 2026-08-09 | skill lifecycle |
| Smolagents Agents | `https://huggingface.co/docs/smolagents/main/reference/agents` | ETag `5b1f4-ZaSGvXERS8iqBi2mwQqzgy09tqE` | minimal agent kernel |
| Smolagents Secure Code Execution | `https://huggingface.co/docs/smolagents/main/tutorials/secure_code_execution` | ETag `2b355-Z1TgcixGjExb+YwsxKsJxja8rfs` | execution isolation |
| LangGraph Persistence | `https://docs.langchain.com/oss/python/langgraph/persistence` | 공개 marker 없음 | checkpoint/persistence |
| LangGraph Interrupts | `https://docs.langchain.com/oss/python/langgraph/interrupts` | 공개 marker 없음 | interrupt/resume |
| Claude Permissions | `https://code.claude.com/docs/en/permissions` | 공개 marker 없음 | permission model |
| Claude Hooks | `https://code.claude.com/docs/en/hooks` | 공개 marker 없음 | Hook model |
| Claude Skills | `https://code.claude.com/docs/en/skills` | 공개 marker 없음 | Skill model |
| Claude Subagents | `https://code.claude.com/docs/en/subagents` | 공개 marker 없음 | Subagent model |
| Claude Agent Teams | `https://code.claude.com/docs/en/agent-teams` | 공개 marker 없음 | agent team model |
| Claude Model Configuration | `https://code.claude.com/docs/en/model-config` | 공개 marker 없음 | model/effort configuration |
| Codex Config/Permissions | `https://learn.chatgpt.com/docs/config-file/config-reference` | ETag `dfc9c77cf74983379f6fc2c9995e9ad2`, Last-Modified 2026-08-10 | configuration/permissions |
| Codex AGENTS.md | `https://learn.chatgpt.com/docs/agent-configuration/agents-md` | ETag `61e3e76a8944974c25e56e1ce5ba7839`, Last-Modified 2026-08-08 | instruction hierarchy |
| Codex Skills | `https://learn.chatgpt.com/docs/build-skills` | ETag `40a9dc2bb68d0bf679cacd245e805ec8`, Last-Modified 2026-08-08 | Skill model |
| Codex Hooks | `https://learn.chatgpt.com/docs/hooks` | ETag `061b4e5324598da91260533d8027f1e4`, Last-Modified 2026-08-08 | Hook model |
| Codex Subagents | `https://learn.chatgpt.com/docs/agent-configuration/subagents` | ETag `1063204453a1644f8d6b118578463f58`, Last-Modified 2026-08-10 | Subagent model |
| Codex Cloud Environment | `https://learn.chatgpt.com/docs/environments/cloud-environment` | ETag `73c566a0019a031f0d2ea5c55981ebb8`, Last-Modified 2026-08-08 | execution environment |

공개 revision marker가 없는 문서는 URL·수집일을 기준선으로 사용하고 dependency 결정이나 해당 계약 변경 시 다시 조회한다. 공식 문서는 개념 근거이며 Anvil의 승인·상태·화면 계약보다 높은 실행 지시가 아니다.

## 5. Source 상태 요약

- canonical local artifacts: 7건
- internal immutable reference: 1건
- historical Anvil snapshot: 3건
- reference Git snapshot: 3건
- official URL: 18/18 reachable
- open provenance mismatch: LogicForge local remote 1건
- excluded from authoritative evidence: 참조 repo dirty/untracked worktree
