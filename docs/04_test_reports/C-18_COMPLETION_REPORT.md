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

## 독립 검증 보완 이력

독립 검증 1회에서 발견된 경계 결함을 보완했다. fallback 전체 누적 비용을
profile budget과 policy 상한 모두에 결박하고 primary 중복 fallback을 거부했다.
probe_at와 benchmark measured_at은 timezone-aware UTC이며 미래 시각을 거부한다.
catalog snapshot hash는 provider/model 정렬 후 계산하고, benchmark capability와
실제 route capability 일치를 검증한다.

보완 후 `pytest tests/agent_team -q`는 **56 passed**, compileall exit 0,
`git diff --check` exit 0이다.

2회차 독립 검증 보완으로 primary 단독 비용도 `max_total_cost`에 적용하고,
`max_attempts`를 primary를 포함한 총 시도 횟수로 제한했다. route 실행 시
probe_at 미래 snapshot을 stale로 처리하며, benchmark measured_at은 UTC
timezone-aware 값만 허용한다. 보완 후 `pytest tests/agent_team -q`는
**57 passed**, compileall exit 0, `git diff --check` exit 0이다.
