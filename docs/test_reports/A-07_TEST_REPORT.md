# A-07 독립 Tester 검증 보고서

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- package: `A-07`
- assigned verification: `AV-AGT-029`의 A-07 정적 계약 slice
- blocking finding: `0`
- canonical L4 / method / evidence: `RUNTIME_DEFERRED / NOT_EXECUTED` / `AE NOT_EXECUTED` / `E-SHOT NOT_EXECUTED`
- Agent runtime / actual DIR: `NOT_EXECUTED`
- Main acceptance: 아직 미실행
- A-08: Main acceptance 전까지 `BLOCKED_PENDING_A07_ACCEPTANCE`
- 기능 범위·요구사항·중요 위험 변경: 없음
- DIR-1·DIR-X: 미도달

## 판단 이유

A-07 산출물은 Execution Control, Task Graph, Agent Drawer, Exception Inbox, Recovery Center, Fencing/Budget, Takeover, DIR Panel의 정적 계약을 승인된 WorkInstruction과 G-04·A-01~A-06 predecessor에 결박한다. Run·Step·Delegation·Lease·DIR 상태를 분리하고 Agent 필드와 권한 있는 stop, DAG/dependency/hash guard, worker+write fencing, heartbeat, reserve-before-provider budget, 유효 실패 집계, 3회/명시적 인수, recovery reconciliation 및 duplicate 금지, DIR owner direction/no-auto-clear를 fail-closed로 요구한다.

정상 bundle을 fresh 검증했고 workspace 제품 파일을 변경하지 않는 독립 메모리 mutation 43건에서 기대 stable reason code를 모두 관찰했다. Developer manifest와 completion projection의 raw byte/hash 및 canonical target을 별도로 재계산했고, 세 SVG의 1920×1080 규격과 주요 canonical 필드를 checker와 독립적으로 확인했다.

## 기준선과 독립 hash

| artifact | SHA-256 |
|---|---|
| Git HEAD / origin/main | `2818F9DD3957195D280DE40565EF90C80C37C7B3` |
| WorkInstruction | `240371EB038AECE4F2613E83613871A737D4831B5FE9A832CB6534A558730799` |
| InvocationPrompt | `1F6476D9F0B0D6EC571FA7456744160BC5CE04A4DBDB7A089A8E092289ABCD8F` |
| Developer evidence manifest | `796B40512FBB0D6EAA596409B3464190455E772246FF361F6EC056D701DEA3E7` |
| Developer target / delivered | `45633F09FF8690D56499B75C813D6F5000FF4EB0323742CB6C1AF820396ECB9B` |
| Completion progress manifest file | `C6497CED7F862AB19F32EB2F6C20FCFD2A55ECCD6C450425659BB6171F0A0F37` |
| Completion progress target / delivered | `131681C6DF3A810FC2F5C148A65A3B48B2C0003922249F4A47F89A4A9C0B98DF` |
| CompletionReport | `286DD6DBA62B41535340FD3F65AEB9327FFFB9857DCED2D4A84DB987C866DE7A` |

- 검증 진입 시 `main = origin/main`, worktree clean, progress sequence `98`, status `TEST_REVIEW`, active agent/worker lease/write lease 모두 `null`이었다.
- Developer manifest SHA와 14개 raw artifact의 byte/hash, canonical bytes `1914`, content bytes `47291`, target/delivered가 일치했다. manifest 자체를 제외한 raw artifact 14개와 manifest를 포함한 Developer 제품 경로 15개를 구분했다.
- completion manifest SHA와 5개 raw checksum, canonical bytes `629`, content bytes `12723`, target/delivered가 일치했다.
- completion base `7627d74dba65b08ad53494f232af836b46f7f120..HEAD` 변경 경로는 completion manifest의 exact 26-path와 일치했고 `git diff --check`는 exit `0`이었다.

## 독립 hostile mutation

다음 43개 항목을 workspace 제품 파일 수정 없이 메모리에서 독립 변조했다.

| 보호 경계 | 관찰 결과 |
|---|---|
| Agent 필수 필드·stop 권한·reason/next action·stop 후 차단 | `AGENT_REQUIRED_FIELD_MISSING`, `AGENT_STOP_AUTHORITY_MISMATCH` |
| Run/Step 상태 분리·hash guard | `EXECUTION_CONTROL_MISMATCH` |
| DAG cycle·failed dependency·success pollution·node/step 필드 | `TASK_GRAPH_GUARD_MISMATCH` |
| worker/write lease·stale token·alias conflict·heartbeat·token masking | `FENCING_GUARD_MISMATCH` |
| reserve-before-provider·hard limit·usage reconcile·sequence | `BUDGET_RESERVATION_MISMATCH` |
| 동일 lineage/fingerprint·유효 실패 제외·success pollution | `FAILURE_CLASSIFICATION_MISMATCH` |
| 3회보다 이른/늦은 takeover·human record·lease 회수·packet | `TAKEOVER_GUARD_MISMATCH` |
| duplicate 실행·무조정 resume·side-effect 분류 | `RECOVERY_GUARD_MISMATCH` |
| DIR state/verdict 분리·no-auto-clear·owner direction·actual DIR 비승격 | `DIR_CONTRACT_MISMATCH` |
| 권한·secret/raw fencing token·runtime PASS 승격 | `PERMISSION_BOUNDARY_MISMATCH`, `SENSITIVE_DISCLOSURE_FORBIDDEN`, `VERIFICATION_CONTRACT_MISMATCH` |
| manifest raw hash·self-reference·delivered target 변조 | `EVIDENCE_RAW_HASH_MISMATCH`, `EVIDENCE_SELF_REFERENCE_FORBIDDEN`, `EVIDENCE_TARGET_HASH_MISMATCH` |

- 결과: `INDEPENDENT_HOSTILE total=43 pass=43 fail=0`.
- 첫 독립 helper 호출에서 delivered hash 변조의 실제 stable reason `EVIDENCE_TARGET_HASH_MISMATCH`를 helper가 존재하지 않는 더 세분화된 이름으로 기대해 exit `1`이 발생했다. 제품·checker failure가 아니고 workspace 변경도 없었으며, 실제 checker 계약에 맞춰 같은 범위를 재실행해 43/43 PASS를 확인했다. 정식 failure로 집계하지 않는다.
- Developer mutation catalog의 40개 stable reason은 focused/전체 회귀에서도 추가 검증됐다.

## fresh 전체 검증

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a07_execution_control
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests\tooling -p "test_*.py"
```

- focused: exit `0`, `12/12 PASS`, `Ran 12 tests in 0.016s`
- 전체: exit `0`, `193/193 PASS`, `Ran 193 tests in 57.330s`
- failure `0`, error `0`, skip `0`

```powershell
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a07_execution_control.py
C:\Users\cyhuh\anaconda3\python.exe scripts\check_project_progress.py
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g07_baseline.py
C:\Users\cyhuh\anaconda3\python.exe scripts\check_phase_g_gate.py
git diff --check
```

- 모두 exit `0`.
- A-07: PASS, errors `0`.
- progress: PASS, sequence `98`, reporting `AUTO_CONTINUE`.
- G-07: PASS, packages `97`, AV `255`, uncovered `0`, scenarios `20`.
- Phase G Gate: PASS, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`.
- Developer/Completion raw target 독립 재계산과 세 SVG XML parse/1920×1080 검증도 PASS다.

## 정적 계약과 미실행 범위

- `AV-AGT-029`의 A-07 `STATIC_ONLY / STATIC_CONTRACT_PASS` slice만 PASS다.
- A-07은 DIR Panel을 정적으로 정의하지만 실제 DIR trigger에 도달하거나 DIR review를 수행하지 않았다.
- 실제 L4 Agent runtime, AE, E-SHOT, API, DB, Event, Browser, Network, Docker, WSL, server, deploy, release는 `NOT_EXECUTED`다.
- 정적 Markdown/SVG와 fixture를 runtime 또는 실제 DIR PASS로 승격하지 않는다.

## 조치

Main Agent는 본 evidence를 fresh 검토한 뒤에만 A-07 최종 수락 여부를 판정할 수 있다. Tester는 `ACCEPTED`, progress 갱신, commit/push 또는 A-08 착수를 수행하지 않았다. Tester workspace write는 본 보고서 한 파일뿐이다.
