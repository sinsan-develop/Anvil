# C-18 완료 보고서 — Capability-based MoA Provider/Model routing

## 판정

구현 범위의 로컬 계약 검증을 완료했다. Provider API/key, 네트워크, DB/API,
브라우저, Telegram, Docker/WSL, 배포는 실행하지 않았다.

## 변경 내용

- `packages/agent_team/moa.py`
  - `CapabilityProfile`, `ProviderModelEntry`, `ProviderModelCatalog`
  - capability/privacy/region/retention/ZDR/health/budget/latency/TTL eligibility
  - deterministic score/tie-break route와 fallback budget/attempt 제한
  - canonical catalog `snapshot_hash` 및 drift 검출
  - `RoutingProvenance` snapshot 결박
  - `BenchmarkRecord.bind`와 snapshot/route/age fail-closed 검증
- `packages/agent_team/__init__.py`: 공개 export 추가
- `tests/agent_team/test_moa_routing_contract.py`: deterministic, policy/TTL,
  fallback budget, benchmark drift/age 회귀

## 검증 증거

시작 기준 branch는 `codex/c18-moa-routing`이며 시작 시 worktree는 clean이었다.

실행 명령과 결과:

```text
C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/agent_team/test_moa.py tests/agent_team/test_provider_catalog.py tests/agent_team/test_moa_routing_contract.py -q
11 passed

C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/agent_team -q
55 passed

C:\Users\cyhuh\anaconda3\python.exe -m compileall -q packages tests
exit 0

git diff --check
exit 0
```

## 미검증 및 잔여 위험

실제 provider 호출·credential resolution·network availability, DB/API/browser
통합, Docker/WSL 및 운영 배포/분산 persistence는 C-18 범위 밖으로 미검증이다.
Routing layer는 외부 probe를 수행하지 않으며 호출자가 제공한 probe snapshot의
시간과 TTL을 검증한다.

## 롤백

C-18 커밋을 revert하면 된다. 기존 `provider_catalog.py`의 historical catalog와
Agent Team conversation 계약은 변경하지 않았다.
