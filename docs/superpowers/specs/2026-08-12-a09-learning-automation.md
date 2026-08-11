# A-09 Learning·Skill·Hook·Agent Catalog 정적 계약

## 목적과 경계

Learning Studio, Candidate Review, Evaluation/Activation/Rollback, Skill Catalog·Selection Trace, Hook Catalog·Replay, AgentDefinition Catalog과 lineage를 정적 UI·artifact 계약으로 확정한다.

- assigned: `AV-LRN-018`, `AV-LRN-024`
- verdict: `STATIC_CONTRACT_PASS`
- actual L4/AE/MX/E-SHOT/E-AUD and Skill/Hook runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`
- canonical runtime owner: `D-12`

## 핵심 계약

- Source에는 locator/hash/provenance/license/confidentiality/exclusions/security scan이 필요하다. revoked/unverified source를 positive exemplar로 승격하지 않는다.
- Candidate는 source/diff/reason/scope/risk/evaluation/approval/trust와 no-change reason을 가진다. candidate/evaluated/approved/active/applied를 구분한다.
- Activation은 version/hash/approval/applies-from snapshot을 결박하고 현재 Run snapshot을 바꾸지 않는다. Rollback·revocation impact와 affected Run lineage를 보존한다.
- Skill lifecycle DRAFT→PILOT→ACTIVE→DEPRECATED→ARCHIVED; 신규 Skill은 3개 대표 pilot, reproducibility, scans, human approval이 필요하다. Selection Trace는 matched evidence, why, rejected candidates, loaded resources, precondition, result와 actual Run을 보여준다.
- Hook은 Event→Matcher→Program→Result/Fault Policy의 deterministic 계약이다. definition hash와 program hash/permission/principal을 분리한다. lifecycle OBSERVED→DRAFT→STATIC_VALIDATED→SHADOW→PILOT→TRUST_REVIEW→ACTIVE→QUARANTINED|RETIRED. SHADOW는 side effect 금지, PILOT replay 필수, deny>ask>modify>allow, modify conflict 자동 병합 금지.
- AgentDefinition은 active Agent instance와 분리하고 parent permission을 `inherit_and_narrow`만 한다. persistent memory default none, Hook은 Subagent를 spawn하지 않는다.

## artifacts and verification

Catalog, focused Markdown contracts, 1920×1080 SVGs, checker/test/fixtures, validation, EvidenceManifest, CompletionReport를 만든다. Hostile verification은 source/provenance/revoke, candidate/activation/snapshot/rollback, Skill pilot/selection/progressive disclosure, Hook hash/trust/shadow/pilot/precedence/timeout/permission/recursion, Agent permission, static promotion, secrets, manifest integrity를 fail-closed 검증한다.

No actual `.anvil`/Skill/Hook installation, executable Hook, runtime, network, deploy, apps/packages/dependency mutation. DIR is not reached at A-09.
