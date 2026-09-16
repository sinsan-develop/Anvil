# D-11 WorkInstruction — Prompt/Model Registry·snapshot drift·atomic routing

## 1. 식별·권위
- Work Package: `D-11`; 선행: `D-05~D-06 ACCEPTED`, `D-Hook Gate ACCEPTED`
- 기준: `Anvil_설계서_v2.md` 8, 42, 49.9, 50.3; 작업계획 D-11
- 검증: `AV-LRN-026`, `AV-LRN-028`; 구현자: `developer-primary-d11-r1`

## 2. 목표
canonical 9개 Provider의 Prompt/Model Registry를 immutable version과 content hash로 관리한다. Provider/model snapshot의
upstream·region·retention·training/ZDR·가격·capability·probe/benchmark revision·TTL drift를 탐지하고, 동일 baseline에서
품질·비용·회귀를 비교한 evidence를 통과한 routing만 원자적으로 다음 Run에 활성화한다. 중요한 drift는 새 Run을
`BLOCKED_CAPABILITY_DRIFT`로 차단하며 probe·benchmark·필요한 사람 승인을 다시 요구한다.

## 3. product exact write scope
- `packages/knowledge/__init__.py`
- `packages/knowledge/model_registry.py`
- `packages/api/model_registry.py`
- `tests/knowledge/test_model_registry_d11.py`
- `tests/api/test_model_registry_d11.py`
- `docs/04_test_reports/D-11_COMPLETION_REPORT.md`

## 4. 필수 계약
1. Provider ID와 순서는 `cerebras, groq, mistral, openrouter, upstage, gemini, anthropic, openai, ollama`로 고정하고 임의 문자열을 거부한다.
2. Prompt version은 prompt body, input/output contract, role, source provenance, approval/trust binding을 canonical hash로 결박한다.
   payload가 approval, benchmark PASS, activation, principal, snapshot hash를 자가 부여할 수 없다.
3. Model snapshot은 provider/upstream provider, model ID/revision, endpoint identity ref, account/organization ref, region, context,
   tool/capability set, retention, training use, ZDR, 가격표/currency/unit, probe revision/result/time/TTL, benchmark revision을 포함한다.
   Secret value와 실제 OLLAMA endpoint는 저장·반환하지 않는다.
4. snapshot은 immutable이며 model ID가 같아도 중요 field 변경 또는 probe TTL 만료 시 drift로 판정한다. privacy, 비용,
   capability 변경은 `approval_required`; 그 밖의 중요한 provenance/availability 변경도 재-probe·benchmark 전 새 Run을 차단한다.
5. Benchmark는 동일 fixture/snapshot baseline에서 quality, regression, cost, latency, sample count와 evidence hash를 비교한다.
   입력 baseline/fixture/prompt/model snapshot hash 불일치, 불충분 표본, 회귀 또는 비용 한도 초과는 PASS로 승격하지 않는다.
6. Routing candidate는 role, prompt version, provider/model snapshot, capability/privacy/cost requirements, fallback policy,
   benchmark evidence를 exact 결박한다. `AVAILABLE`이 아니거나 필수 capability/privacy/비용을 충족하지 못하면 저장·활성화하지 않는다.
7. activation은 optimistic expected-current-version을 사용해 routing set 전체를 원자적으로 교체하고 immutable activation receipt를 남긴다.
   현재 Run에는 주입하지 않고 다음 Run snapshot부터 적용한다. 일부 role만 갱신되거나 stale writer가 덮어쓰는 상태를 허용하지 않는다.
8. 활성 snapshot 이후 drift/TTL 만료가 확인되면 해당 routing을 quarantine하고 새 Run 선택을 `BLOCKED_CAPABILITY_DRIFT`로 반환한다.
   진행 Run은 기존 immutable snapshot을 유지하되 영향·대체 금지·재검증 필요성을 audit로 기록한다.
9. privacy class, cloud/local egress, 가격/비용 한도, capability 의미가 바뀌는 activation은 사람 승인 receipt가 정확한
   candidate/snapshot/benchmark hash에 결박되어야 한다. 동등 변경은 Main 정책과 benchmark 근거로 처리할 수 있다.
10. OpenRouter는 Provider ID를 `openrouter`로 유지하면서 실제 upstream provider/model 계보를 보존한다.
11. export/import 재시작 복원은 registry version, snapshot, benchmark, active routing, quarantine, receipt/audit hash를 보존하고
    변조·누락·다른 principal/context를 거부한다.
12. API는 registry/snapshot/probe/benchmark/routing candidate/activate/run guard/export/import/query의 authenticated host adapter만 제공한다.
13. 실제 Provider 호출, 가격 조회, network, DB, HTTP, browser, WSL/Docker/deployment는 이번 fixture 검증에서 `NOT_EXECUTED`로 구분한다.

## 5. 검증·보고
- canonical 9개 순서·임의 ID 거부·OpenRouter upstream provenance
- prompt/model canonical hash·immutable conflict·secret/endpoint 비노출
- 동일 baseline benchmark quality/cost/regression·hash/표본/한도 적대 검증
- privacy/가격/capability/TTL drift → 재-probe·benchmark·approval 요구와 `BLOCKED_CAPABILITY_DRIFT`
- atomic activation CAS·부분 활성화/현재 Run 주입/stale writer 거부·다음 Run snapshot
- export/import 변조·principal/context·hash 적대 검증
- focused 두 test, `tests/knowledge tests/api`, compileall, diff-check

## 6. 완료 후
Main 독립 검토 후 D-12를 자동 시작한다. 실제 외부 Provider 상태나 가격 최신성은 검증했다고 표시하지 않는다.
