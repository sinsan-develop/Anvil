# A-05 독립 Tester 검증 보고서

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- package: `A-05`
- assigned verification: `AV-FLOW-001`의 A-05 정적 slice
- blocking finding: `0`
- canonical L4/L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-EVT_NOT_EXECUTED`
- Main acceptance: 아직 미실행
- A-06: Main acceptance 전까지 `BLOCKED_PENDING_A05_ACCEPTANCE`
- 기능 범위·요구사항·중요 위험 변경: 없음
- DIR-1·DIR-X: 미도달

## 판단 이유

A-05 산출물은 Proposal Compare, Decision Board, Design Baseline과 A-04 on-demand Context Drawer를 승인된 WorkInstruction 및 A-01~04 predecessor에 결박한다. 최소 2개 완전한 evidence-backed 대안, Agent 추천과 사람 선택의 분리, authenticated human과 exact subject/spec hash, 미해결 결정·invalid evidence의 승인 차단, HOLD/FUTURE_EXTENSION carryover, acyclic superseded lineage, 승인 baseline 불변성과 spec/hash 변경 시 invalidation, 분리된 permission과 secret/runtime 비승격 경계가 catalog·문서·SVG·checker에 일치한다.

정상 bundle을 fresh 검증했고, 제품 파일을 변경하지 않는 독립 메모리 mutation 25건으로 주요 보호 경계를 변조했을 때 선언된 stable reason code가 관찰됐다. Developer manifest와 completion progress projection의 raw hash, canonical target, self-reference 금지, WorkInstruction/Invocation binding, predecessor 및 exact 24-path도 별도로 재계산했다.

## 기준선과 독립 hash

| artifact | SHA-256 |
|---|---|
| Git HEAD / origin/main | `596FFF00AADA8D0827B2C2A711DF2BAF3FA6838C` |
| WorkInstruction | `F80E1641704BD0FD436F220A13228463FFEC6E2585F083A0405075B2C5E8375C` |
| InvocationPrompt | `68FC8350B726DE793A8F5DC8B6A988730A09E7B8C214579D49176D342B3C9F29` |
| Developer evidence manifest | `90C6AA195FC1DB6AB48D02B4A6403BBE242488177045F393C05E17EAF76085F1` |
| Developer target / delivered | `974045F91F01FFDD342099BAA6CC2788C525FE8D74C7C8F5D0BDD31679E22266` |
| Completion progress manifest file | `77FB8184F20FD353090E6E5A9DA882D24EC827221759638B9EB29F101CAA194F` |
| Completion progress target / delivered | `57EDB9FC76B3F68D6460484836CCBB53F6AF8BC383089EA48CDF07DBA713061F` |
| CompletionReport | `48C41226134475913A43AF82A9E2B25DD27DE5E5245700DE7B613E115692937B` |
| A-01 catalog / manifest R2 | `FC3A503E5038C86BFD841DA5F93826A3FC85B5EB2A020E1196385247C2B7DD69` / `BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4` |
| A-02 catalog / manifest R2 | `1709D227BB9C44480085CB10B53881B1613AED914F868B629F8B2C3D03D23207` / `779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168` |
| A-03 catalog / manifest R2 | `464F785FB0A72C3E5571D30755EE3A107259D641A6035830B18343E5A0922093` / `772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE` |
| A-04 catalog / manifest | `230E32C99256F80904660735BA8B4A8BF95F9068164D8906E9E872EEE96AFE73` / `C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB` |

- 검증 진입 시 `main = origin/main`, worktree clean, progress sequence `84`, status `TEST_REVIEW`, active agent/worker lease/write lease 모두 `null`이었다.
- Developer manifest 독립 검증: raw artifact byte/hash, target/delivered, self-reference 금지가 모두 일치했다.
- completion base `c47ed7c176243a8cdb72c3f26d3b325a66ff9040..HEAD` 변경 경로는 completion manifest의 exact 24-path와 집합·개수가 일치했다. 누락·초과는 각각 `0`이고 `git diff --check`는 exit `0`이다.
- authority 5종, WorkInstruction, InvocationPrompt, A-01~04 catalog/manifest hash는 승인 binding과 일치한다.

## 독립 hostile mutation

다음 25개 항목을 workspace 제품 파일을 수정하지 않고 메모리에서 독립 변조했다.

| 보호 경계 | 관찰 결과 |
|---|---|
| Proposal 최소 수·evidence | `PROPOSAL_MINIMUM_NOT_MET`, `PROPOSAL_EVIDENCE_MISSING` |
| Agent recommendation을 selection으로 오염 | `RECOMMENDATION_DECISION_CONTAMINATION` |
| 비인증 actor·subject hash guard 제거 | `HUMAN_HASH_CONFIRMATION_GUARD_MISMATCH` |
| unresolved decision·invalid evidence인데 승인 허용 | `DESIGN_APPROVAL_BLOCKED` |
| HOLD/FUTURE_EXTENSION carryover 제거 | `CARRYOVER_MISSING` |
| acyclic lineage·carryover target guard 제거 | `DECISION_LINEAGE_INVALID` |
| approved baseline mutation·spec/hash invalidation 제거 | `APPROVED_BASELINE_MUTATION` |
| capability 분리·unauthorized disabled guard 제거 | `PERMISSION_BOUNDARY_MISMATCH` |
| A-04 predecessor hash 변조 | `PREDECESSOR_BINDING_MISMATCH` |
| canonical runtime PASS 승격·runtime owner 축소 | `VERIFICATION_CONTRACT_MISMATCH` |
| secret·loopback 노출 | `SENSITIVE_DISCLOSURE_FORBIDDEN` |
| A-05에서 Execute 개방 | `EXECUTION_GUARD_MISMATCH` |
| manifest self-reference·raw hash·target·runtime qualifier 변조 | `EVIDENCE_SELF_REFERENCE_FORBIDDEN`, `EVIDENCE_RAW_HASH_MISMATCH`, `EVIDENCE_TARGET_HASH_MISMATCH`, `EVIDENCE_RUNTIME_QUALIFIER_MISMATCH` |

Developer의 36개 mutation catalog는 fresh 169-test 전체 회귀 안에서 추가로 검증됐으며 Proposal field 제거, recommendation approval 오염, HOLD status/field, 승인 baseline revision, permission, predecessor, Context Drawer 등의 stable reason을 모두 확인했다.

독립 hostile 첫 호출은 임시 테스트 도우미가 dictionary key를 list index로 처리한 오류로 exit `1`이었다. 제품·checker failure가 아니며 workspace 변경 없이 도우미를 교정해 동일 범위를 재실행했고 25/25가 exit `0`으로 완료됐다. 이 호출 오류는 정식 failure로 집계하지 않는다.

## fresh 전체 검증

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests\tooling -p 'test_*.py'
```

- exit `0`
- `Ran 169 tests in 45.657s`
- failure `0`, error `0`, skip `0`

```powershell
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a05_design_decisions.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a04_workbench.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a03_onboarding.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a02_tokens.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a01_journey.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_project_progress.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g07_baseline.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_phase_g_gate.py .
git diff --check
```

- 모두 exit `0`.
- A-05~A-01: PASS, errors `[]`.
- progress: PASS, sequence `84`, reporting `AUTO_CONTINUE`.
- G-07: PASS, packages `97`, AV `255`, uncovered `0`, scenarios `20`.
- Phase G Gate: PASS, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`.

## 정적 계약과 미실행 범위

- `AV-FLOW-001`의 A-05 정적 계약 slice만 PASS다.
- 사람 선택은 Design Refinement만 열며 Apply/Execute 승인이 아니다.
- 실제 L4/L7 Browser, API, DB, Event, Network, Docker, WSL, server, deploy, release는 `NOT_EXECUTED`다.
- 정적 Markdown/SVG와 fixture/mock을 실제 `E-SHOT` 또는 `E-EVT` runtime PASS로 승격하지 않는다.
- runtime owner는 `B-03`, `A-14`, `A Gate`를 포함한 승인된 계약대로 유지한다.

## 조치

Main Agent는 본 evidence를 fresh 검토한 뒤에만 A-05 최종 수락 여부를 판정할 수 있다. Tester는 `ACCEPTED`, progress 갱신, commit/push 또는 A-06 착수를 수행하지 않았다. Tester workspace write는 본 보고서 한 파일뿐이다.
