# A-10 독립 Tester 검증 보고서

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- package: `A-10`
- assigned verification: `AV-OPS-010`, `AV-LRN-028`의 A-10 정적 계약 slice
- blocking finding: `0`
- canonical L4 / L3 / L5 / AI / AN / E-AUD / E-TEST: `RUNTIME_DEFERRED / NOT_EXECUTED`
- actual Provider / Secret / Egress / API / DB / Event / Browser / Network / Runtime / DIR: `NOT_EXECUTED`
- Main acceptance, progress/HANDOFF 갱신, commit/push 및 A-11 착수: 미실행
- 기능 범위·요구사항·중요 위험 변경: 없음

## 판단 이유

권위 문서와 A-10 WorkInstruction에서 독립적으로 재구성한 계약은 canonical provider 순서 `cerebras → groq → mistral → openrouter → upstage → gemini → anthropic → openai → ollama`의 9개 항목, 모든 unavailable 사유의 가시성, SecretRef의 reference/status/purpose/environment만 노출하고 값·내부 endpoint를 노출하지 않는 경계다.

각 route는 probe·benchmark revision, TTL, snapshot hash를 포함한 검증된 capability snapshot을 요구하며, capability·privacy·egress·cost 조건을 만족해야 한다. Settings의 Execution Mode와 route activation은 현재 Run을 바꾸지 않고 다음 immutable snapshot에서만 효력이 생긴다. DataEgressProfile 확대와 privacy·local-to-cloud·tool capability·context loss·high-risk reviewer 변화는 사람 재승인을 요구한다.

fallback은 rate limit, provider timeout, transient 5xx에만 제한되며 unsafe fallback은 차단된다. `REVOKED`/`EXPIRED` Secret은 route를 차단한다. 같은 model ID라도 privacy·cost·retention·training use·ZDR·context·tool capability·probe·benchmark·TTL이 달라지면 새 Run은 `BLOCKED_CAPABILITY_DRIFT`로 fail-closed되고 probe·benchmark·필요 승인 후에만 재개할 수 있다. Provider/Secret/Egress 권한과 audit은 독립적이며, 정적 계약은 실제 Provider·Secret·egress·runtime 증거로 승격되지 않는다.

## 기준선과 독립 hash

| artifact | SHA-256 / 상태 |
|---|---|
| Git HEAD / origin/main | `FF433BCAE92948BDECFE9A51FCB13A9C5C5050C2` / equal |
| WorkInstruction | `A7D527B3AA9B50F30589526EDC1D790B75A778D96C47A959B7C966418BFECCF5` |
| InvocationPrompt | `5E7A236BF98C80B881F6B9C4FEFDAD2C047EE0A4FF758FEE0289B42D2343AD9E` |
| Developer evidence manifest | `C9667081B8BEA555C32F8833D7F28BCF3528882324814CCE08CAAEAA27DE6A84` |
| Developer target / delivered | `C179BA2371401BB57CAA02B5148D96A58B094092BE52088E85C6BA9882CFA64A` |
| Completion progress manifest file | `2BA9B814CBAEAE3E113EFAA6C15DB37F69C8416EBAB9EDE2B4685088802DAEC7` |
| Completion progress target / delivered | `3FAE3307A52D5B542346DF437053312C2E4B75096D484664F67423E22BD9DE30` |

- 진입 시 `main = origin/main`, worktree clean, progress sequence `119`, `A-10 / TEST_REVIEW / COMPLETED / accepted=false`, active agent/worker lease/write lease 모두 `null`이었다.
- Developer manifest raw artifact `15/15`의 bytes/hash가 일치했고, self-reference는 `false`, target canonical bytes는 `2031`, content bytes는 `45891`이었다. raw path/sha256 정렬 JSON projection을 독립 재계산해 target/delivered `C179…`와 일치시켰다.
- Completion manifest raw checksum `5/5`의 bytes/hash가 일치했고 self-reference는 `false`였다. UTF-8 byte-ordinal path 정렬의 TAB row projection을 독립 재계산해 canonical bytes `629`, target/delivered `3FAE…`와 일치시켰다.
- catalog의 accepted predecessor binding `A-01~A-09`는 `9/9` 실제 manifest hash와 일치했다.
- completion base `1e26f461c78dbf10eb13a607f70ad7c4b7e78df5..HEAD` 변경 경로는 `27`개이고 completion manifest allowlist `27`개와 정확히 일치했다.

## 독립 hostile mutation

Developer fixture의 hostile mutation `18`건을 fresh tooling에서 실행해 모두 지정된 stable reason으로 fail-closed됨을 확인했다.

| 보호 경계 | 관찰 stable reason |
|---|---|
| provider 순서·삭제, unavailable 표시 | `PROVIDER_CATALOG_ORDER_MISMATCH`, `UNAVAILABLE_STATE_HIDDEN` |
| guessed/stale capability, probe/benchmark, snapshot activation | `GUESSED_OR_STALE_CAPABILITY_FORBIDDEN`, `CAPABILITY_PROBE_REQUIRED`, `CAPABILITY_BENCHMARK_REQUIRED`, `ROUTING_ACTIVATION_SNAPSHOT_BYPASS` |
| capability/privacy/egress route, egress 확대 | `ROUTE_ACTIVATION_WITHOUT_VERIFICATION`, `ROUTING_EGRESS_MATCH_BYPASS`, `EGRESS_EXPANSION_APPROVAL_BYPASS` |
| unsafe fallback, revoked Secret, secret/endpoint disclosure | `UNSAFE_FALLBACK_NOT_BLOCKED`, `REVOKED_SECRET_ROUTE_BYPASS`, `SECRET_LITERAL_DISCLOSURE_FORBIDDEN`, `INTERNAL_ENDPOINT_DISCLOSURE_FORBIDDEN` |
| same-model capability drift, permission collapse/expansion | `CAPABILITY_DRIFT_FAIL_CLOSED_REQUIRED`, `PERMISSION_COLLAPSE_FORBIDDEN`, `PERMISSION_EXPANSION_FORBIDDEN` |
| static-to-runtime promotion, raw hash/self-reference bypass | `VERIFICATION_CONTRACT_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`, `EVIDENCE_SELF_REFERENCE_FORBIDDEN` |

## fresh 전체 검증

```powershell
python -m unittest discover -s tests/tooling -v
python scripts/check_a01_journey.py --root .
python scripts/check_a02_tokens.py --root .
python scripts/check_a03_onboarding.py --root .
python scripts/check_a04_workbench.py --root .
python scripts/check_a05_design_decisions.py --root .
python scripts/check_a06_planning_approvals.py --root .
python scripts/check_a07_execution_control.py --root .
python scripts/check_a08_completion_validation.py --root .
python scripts/check_a09_learning_automation.py --root .
python scripts/check_a10_provider_routing.py --root . --json
python scripts/check_project_progress.py .
python scripts/check_g07_baseline.py .
python scripts/check_phase_g_gate.py .
```

- full tooling: exit `0`, `226/226 PASS`, `Ran 226 tests in 52.941s`.
- A-01~A-10 static checker: 모두 exit `0`; A-10은 `PASS`, errors `[]`.
- project-progress checker: exit `0`, `PASS`, sequence `119`, reporting `AUTO_CONTINUE`.
- G-07 checker: exit `0`, packages `97`, AV `255`, uncovered `0`, scenarios `20`.
- Phase G Gate checker: exit `0`, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`.

초기 일괄 실행에서 project/G-07/Phase-G checker에 지원하지 않는 `--root` 인자를 전달해 command-level exit `1/2/2`가 발생했다. CLI usage를 확인해 official positional-root 형식으로 즉시 재실행했고 위와 같이 모두 exit `0`이다. 코드·계약·산출물은 변경하지 않았으므로 정식 `FAILURE_REPORT`나 blocking finding으로 집계하지 않는다.

## 정적 계약과 미실행 범위

- A-10 `STATIC_ONLY / STATIC_CONTRACT_PASS` slice만 PASS다.
- `AV-OPS-010`, `AV-LRN-028`의 실제 Provider onboarding, credential broker, egress enforcement, probe/benchmark, route activation, fallback, drift, audit은 `D-11`, `F-02` runtime owner 범위이며 실행하지 않았다.
- 실제 Provider, Secret, Egress, API, DB, Event, Browser, Network, Runtime, Docker/WSL/server, deployment, release, DIR은 `NOT_EXECUTED`다.
- static Markdown/SVG/catalog/fixture 또는 hostile mutation test를 browser/Network/운영 기능 PASS로 승격하지 않는다.

## 조치

Main Agent는 이 독립 Tester evidence를 검토한 뒤에만 A-10 최종 수락 여부를 판정할 수 있다. Tester는 `ACCEPTED`, progress/HANDOFF 갱신, commit/push 또는 A-11 착수를 수행하지 않았다. Tester write는 본 보고서 한 파일로 제한했다.
