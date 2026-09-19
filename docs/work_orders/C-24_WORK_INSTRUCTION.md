# C-24 WorkInstruction — MoA and Capability Routing Contracts

## Scope

Implement the approved v2.8/v1.7 C-24 host-only contract. Keep Agent Team orchestration (C-23), C-22 role/lease/result contracts, and historical F-01/F-02 Provider Catalog/Model Registry behavior compatible. MoA deliberation must remain separate from Provider/Model capability routing and connect only through immutable proposal/routing provenance.

## Required contract

- Define deterministic MoA proposal, critique, synthesis, quorum and conflict projections with parent/session trace and bounded evidence.
- Define CapabilityProfile/Catalog/Router/Fallback/RoutingProvenance contracts that consume F-01/F-02 inputs read-only; no provider call or billing behavior.
- Enforce capability, privacy, region, cost, quota and model/provider drift checks fail-closed. Unknown quota remains `Quota not reported`; never estimate or hard-code it.
- Keep fallback approval-boundary and quality/cost/capability degradation explicit. Unapproved fallback, stale catalog, conflicting provenance or quorum failure must be rejected with stable reason codes.
- Preserve detached/callback-free inputs and deterministic hashes/replay. No DB, network, Provider, UI, WSL or Oracle execution.

## TDD and verification

1. RED: add focused tests for MoA proposal/critique/synthesis/quorum/conflict, capability catalog/profile validation, router admission, drift/quota fail-closed, fallback reapproval and immutable routing provenance.
2. GREEN: implement the smallest additive extension in allowed modules and exports; reuse existing C-23/C-22 authority and F-01/F-02 read-only contracts.
3. Run focused C-24 tests, related `tests/agent_team` regression, compile, `git diff --check`, and canonical progress checker. Record exact exit codes and unverified external scope.

## Allowed paths

- `packages/agent_team/moa.py`
- `packages/agent_team/provider_catalog.py`
- `packages/agent_team/provider_status.py`
- `packages/agent_team/__init__.py` only for public exports
- `tests/agent_team/test_moa_c24.py`
- `tests/agent_team/test_provider_catalog_c24.py`
- `tests/agent_team/test_provider_status_c24.py`
- `tests/agent_team/test_routing_c24.py`
- `docs/04_test_reports/C-24_COMPLETION_REPORT.md`

Do not modify other product paths, migrations, UI, adapters, deployment files, secrets, progress history or historical reports. Do not commit, push, merge, deploy, or contact external services.

## Completion and rollback

Completion requires focused and related regression PASS, stable hashes, independent read-only review, explicit `NOT_EXECUTED/NOT_INTEGRATED` scope and rollback note. Rollback is limited to the C-24 exact scope; preserve all pre-existing dirty/untracked state.
