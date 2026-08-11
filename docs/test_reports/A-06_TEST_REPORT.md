# A-06 독립 Tester 검증 보고서

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- package: `A-06`
- assigned verification: `AV-SAFE-005`, `AV-FLOW-003`의 A-06 정적 slice
- blocking finding: `0`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-ART`; `E-API / E-AUD / E-SHOT / E-EVT NOT_EXECUTED`
- Main acceptance: 아직 미실행
- A-07: Main acceptance 전까지 `BLOCKED_PENDING_A06_ACCEPTANCE`
- 기능 범위·요구사항·중요 위험 변경: 없음
- DIR-1·DIR-X: 미도달

## 판단 이유

A-06 산출물은 WorkPlan, Iteration, G-04 exact WorkInstruction field set, reference-only Invocation, 다섯 종류의 독립 승인 lane, 비의미 파생 baseline을 승인된 WorkInstruction과 A-01~A-05 predecessor에 결박한다. 승인 종류 간 대체·record 재사용·만료·hash 변경·자동 실행을 fail-closed로 차단하며, 비의미 변경의 root/parent/old-new lineage와 scope 비확장을 요구한다. 권한·secret·정적 evidence 경계도 catalog·문서·SVG·checker에서 일치한다.

정상 bundle을 fresh 검증했고 제품 파일을 변경하지 않는 독립 메모리 mutation 26건으로 주요 보호 경계를 변조했을 때 기대 stable reason code가 모두 관찰됐다. Developer manifest와 completion projection의 raw hash, canonical target, self-reference 금지, WorkInstruction/Invocation binding, predecessor 및 exact 26-path도 별도로 확인했다.

## 기준선과 독립 hash

| artifact | SHA-256 |
|---|---|
| Git HEAD / origin/main | `D358E04C795A4C02018C44B8D7A8FB32A23814CC` |
| WorkInstruction | `83B1F04472D28631CF73645486D8EC138BBB75B7F8EE8679BDA4F8B0C37AECC6` |
| InvocationPrompt | `B4DBBD9937DEFD6F569585D0C3BDDCACD36262C199563E8A651E46B8E84765A1` |
| Developer evidence manifest | `A6F2B8B2E866A4F4AF6E2BAD8BAA2D005217071E263BA52FE63F35C935844449` |
| Developer target / delivered | `0CCF57584738B6CF38949D959297AF0877DC084070C352F7944C85AA0AF91258` |
| Completion progress manifest file | `93F0200ED0C056220D4BF6424B61282CF8EC34DBEDC1C454979C8B6A1C1B8793` |
| Completion progress target / delivered | `7FCEF8D7EFCB013E565029BAE947BCFAF3E8134F7D73575EFC9527B8D56CCB7F` |
| CompletionReport | `0704C201C1FFAB4C0187A3E8D4DF92A3BDF331A6D33B8D01191E48F93B6DFE07` |
| A-01 catalog | `FC3A503E5038C86BFD841DA5F93826A3FC85B5EB2A020E1196385247C2B7DD69` |
| A-02 catalog | `1709D227BB9C44480085CB10B53881B1613AED914F868B629F8B2C3D03D23207` |
| A-03 catalog | `464F785FB0A72C3E5571D30755EE3A107259D641A6035830B18343E5A0922093` |
| A-04 catalog | `230E32C99256F80904660735BA8B4A8BF95F9068164D8906E9E872EEE96AFE73` |
| A-05 catalog | `83A8987AED3C1442FBAFF4D2237185FC3BCAEEDC2C352C2F794B91091A4F138B` |

- 검증 진입 시 `main = origin/main`, worktree clean, progress sequence `91`, status `TEST_REVIEW`, active agent/worker lease/write lease 모두 `null`이었다.
- Developer manifest의 raw artifact byte/hash, target/delivered 및 self-reference 금지가 checker에서 일치했다.
- completion base `9cfe99e22ea71593575964a63e07ca4ee559d39f..HEAD`의 변경 경로는 completion manifest의 exact 26-path와 일치했고 `git diff --check`는 exit `0`이었다.

## 독립 hostile mutation

다음 26개 항목을 workspace 제품 파일 수정 없이 메모리에서 독립 변조했다.

| 보호 경계 | 관찰 결과 |
|---|---|
| 승인 type/record field/다섯 lane 독립성 | `APPROVAL_TYPE_OR_RECORD_MISMATCH`, `APPROVAL_INDEPENDENCE_GUARD_MISSING` |
| 승인 cross-substitution·reuse·expiry·hash invalidation | `APPROVAL_INDEPENDENCE_GUARD_MISSING` |
| 승인 auto-run·record type collapse | `APPROVAL_COLLAPSE_OR_AUTORUN` |
| WorkPlan field/hash, Iteration parent scope/hash | `WORK_PLAN_CONTRACT_MISMATCH`, `ITERATION_CONTRACT_MISMATCH` |
| G-04 template hash, allowed/forbidden overlap | `WORK_INSTRUCTION_TEMPLATE_MISMATCH`, `WORK_INSTRUCTION_SCOPE_OVERLAP` |
| Invocation field/duplication/WI·approval hash stale guard | `INVOCATION_DUPLICATION_OR_FIELD_MISMATCH`, `INVOCATION_STALE_GUARD_MISSING` |
| 비의미 root-parent/old-new lineage·material 오분류·scope 확장·human guard | `NONSEMANTIC_LINEAGE_INVALID`, `NONSEMANTIC_MISCLASSIFIED`, `NONSEMANTIC_SCOPE_EXPANSION`, `MATERIAL_CHANGE_HUMAN_GUARD_MISSING` |
| 권한 분리·runtime PASS 승격·manifest self-reference | `PERMISSION_BOUNDARY_MISMATCH`, `VERIFICATION_CONTRACT_MISMATCH`, `EVIDENCE_SELF_REFERENCE_FORBIDDEN` |

- 결과: `A06_INDEPENDENT_HOSTILE=26/26 PASS`.
- 첫 독립 helper 호출은 tester 임시 setter의 list/dictionary 분기 오류로 exit `1`이었다. 제품·checker failure가 아니고 workspace 변경도 없었으며, helper만 교정해 같은 범위를 26/26 재실행했다. 정식 failure로 집계하지 않는다.
- Developer mutation catalog의 40개 stable reason은 fresh 181-test 회귀에서 추가 검증됐다.

## fresh 전체 검증

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests\tooling -p test_*.py
```

- exit `0`
- `Ran 181 tests in 52.997s`
- failure `0`, error `0`, skip `0`

```powershell
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a06_planning_approvals.py --json
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
- A-06~A-01: PASS, errors `[]`.
- progress: PASS, sequence `91`, reporting `AUTO_CONTINUE`.
- G-07: PASS, packages `97`, AV `255`, uncovered `0`, scenarios `20`.
- Phase G Gate: PASS, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`.

## 정적 계약과 미실행 범위

- `AV-SAFE-005`, `AV-FLOW-003`의 A-06 `E-ART` 정적 계약 slice만 PASS다.
- 계획·승인 record는 Apply/Deploy/Destructive 실행을 열지 않으며 approval 자체가 자동 실행을 유발하지 않는다.
- 실제 L7 Browser, API, Audit, DB, Event, Network, Docker, WSL, server, deploy, release는 `NOT_EXECUTED`다.
- 정적 Markdown/SVG와 fixture/mock을 runtime 또는 `E-API/E-AUD/E-SHOT/E-EVT` PASS로 승격하지 않는다.
- runtime owner는 `B-04`, `C-14`로 유지한다.

## 조치

Main Agent는 본 evidence를 fresh 검토한 뒤에만 A-06 최종 수락 여부를 판정할 수 있다. Tester는 `ACCEPTED`, progress 갱신, commit/push 또는 A-07 착수를 수행하지 않았다. Tester workspace write는 본 보고서 한 파일뿐이다.
