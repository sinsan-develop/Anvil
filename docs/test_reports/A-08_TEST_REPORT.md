# A-08 독립 Tester 검증 보고서

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- package: `A-08`
- assigned verification: `AV-UI-008`, `AV-UI-009`, `AV-FLOW-025`의 A-08 정적 계약 slice
- blocking finding: `0`
- canonical L4/L5/L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- actual ProductValidation / ReleaseDecision / Apply / Deploy / DIR: `NOT_EXECUTED`
- Main acceptance: 아직 미실행
- A-09: Main acceptance 전까지 `BLOCKED_PENDING_A08_ACCEPTANCE`
- 기능 범위·요구사항·중요 위험 변경: 없음
- DIR-1·DIR-X: 미도달

## 판단 이유

A-08 산출물은 Completion의 Plan-vs-Actual, 기술 결과, criterion 단위 ProductValidation, 결함 lifecycle·독립 재검증, 인증된 사람의 ReleaseDecision, Evidence Drawer를 서로 다른 결과 계층으로 분리한다. `Package ACCEPTED is not RELEASE`를 명시하며, 필수 PV 누락·BLOCKED·UNSUITABLE, blocking defect, target/delivered/evidence hash 불일치를 RELEASE·Apply·Deploy의 공통 fail-closed 조건으로 둔다.

정상 bundle을 fresh 검증했고 workspace 제품 파일을 변경하지 않는 독립 메모리 hostile mutation 26건에서 기대 stable reason code를 모두 관찰했다. Developer manifest와 completion projection의 raw byte/hash 및 canonical target을 독립 재계산했고, 세 SVG의 XML parse와 1920×1080 규격을 별도로 확인했다.

## 기준선과 독립 hash

| artifact | SHA-256 |
|---|---|
| Git HEAD / origin/main | `757DA39D234F6300148638C931B6C62AA241236D` |
| WorkInstruction | `E418BE54E9AC98BEF61F782B127A83332C75ADD1A60CCCFE8DA8766634CC489E` |
| InvocationPrompt | `5BB5F8C23B7CD90CCB478E023F8ECE3A1867768FDE9D56941292E9D0FD0C11CF` |
| Developer evidence manifest | `73CC3936D3AF55674412C746B1CB95D53F08B3C8BDA927765286F3E60BE6C9A5` |
| Developer target / delivered | `0C10A4F557B2AAF6D90B5BA8C9320CFD694B4DCBF42C9FF3495E3B5D431DE52C` |
| Completion progress manifest file | `0DF508A8F7EA86E9E8110507EC2C58A2F08C2D15A280D394735FFA5A41CA2D11` |
| Completion progress target / delivered | `9BAF18FE4129DEC81E6BC9584D3615D7B0A20F70D4A10278DF476E9623CD0CE5` |
| CompletionReport | `45D57AD6B65768CC344EBCEA0252E932C7C4C9FB44172117CA0136E8DEC70751` |

- 검증 진입 시 `main = origin/main`, worktree clean, progress sequence `105`, status `TEST_REVIEW`, active agent/worker lease/write lease 모두 `null`이었다.
- Developer manifest SHA와 14개 raw artifact의 byte/hash, canonical bytes `1927`, content bytes `47510`, target/delivered가 일치했다. manifest 자체를 제외한 raw artifact 14개와 manifest를 포함한 Developer 제품 경로 15개를 구분했다.
- completion manifest SHA와 5개 raw checksum, canonical bytes `629`, content bytes `12169`, target/delivered가 일치했다.
- completion base `3f6c7f26d5b5a4aaec435fbe7daefaa423230d42..HEAD` 변경 경로는 completion manifest의 exact 26-path와 일치했고 `git diff --check`는 exit `0`이었다.

## 독립 hostile mutation

다음 26개 항목을 workspace 제품 파일 수정 없이 메모리에서 독립 변조했다.

| 보호 경계 | 관찰 결과 |
|---|---|
| 결과 계층·Package ACCEPTED의 Release 승격 | `PLAN_ACTUAL_LAYER_MISMATCH` |
| 기술 미실행 결과의 PASS 승격 | `TECHNICAL_RESULT_PROMOTION_FORBIDDEN` |
| 필수 PV·criterion 누락·target hash·실제 PV 승격 | `PRODUCT_VALIDATION_CONTRACT_MISMATCH` |
| 결함 전이·Developer close·독립 동일-target retest | `DEFECT_LIFECYCLE_RETEST_MISMATCH` |
| 사람 actor·Developer release 금지 | `HUMAN_RELEASE_AUTHORITY_MISMATCH` |
| Release·Apply·Deploy 공통 fail-closed guard | `RELEASE_APPLY_DEPLOY_GUARD_MISMATCH` |
| REWORK·DEFER·REJECT 효과 분리 | `RELEASE_NONRELEASE_EFFECT_MISMATCH` |
| hash 재사용 금지 | `HASH_INVALIDATION_MISMATCH` |
| 권한·정적 qualifier·secret | `PERMISSION_BOUNDARY_MISMATCH`, `VERIFICATION_CONTRACT_MISMATCH`, `SENSITIVE_DISCLOSURE_FORBIDDEN` |
| manifest raw hash·self-reference·target 변조 | `EVIDENCE_RAW_HASH_MISMATCH`, `EVIDENCE_SELF_REFERENCE_FORBIDDEN`, `EVIDENCE_TARGET_HASH_MISMATCH` |

- 결과: `INDEPENDENT_HOSTILE total=26 pass=26 fail=0`.
- 첫 독립 helper 실행은 Tester helper의 list/dict 경로 대입 구현 오류로 exit `1`이었다. 제품·checker failure가 아니고 workspace 변경도 없었다. helper를 수정해 같은 범위를 재실행했고 26/26 PASS를 확인했으므로 정식 `FAILURE_REPORT`로 집계하지 않는다.
- Developer mutation catalog의 44개 stable reason은 focused 및 전체 회귀에서도 추가 검증됐다.

## fresh 전체 검증

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a08_completion_validation
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests\tooling -p "test_*.py"
```

- focused: exit `0`, `12/12 PASS`, `Ran 12 tests in 0.026s`
- 전체: exit `0`, `205/205 PASS`, `Ran 205 tests in 55.605s`
- failure `0`, error `0`, skip `0`

```powershell
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a08_completion_validation.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_project_progress.py
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g07_baseline.py
C:\Users\cyhuh\anaconda3\python.exe scripts\check_phase_g_gate.py
git diff --check
```

- 모두 exit `0`.
- A-08: PASS, errors `0`.
- progress: PASS, sequence `105`, reporting `AUTO_CONTINUE`.
- G-07: PASS, packages `97`, AV `255`, uncovered `0`, scenarios `20`.
- Phase G Gate: PASS, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`.
- Developer/Completion raw target 독립 재계산과 세 SVG XML parse/1920×1080 검증도 PASS다.

## 정적 계약과 미실행 범위

- `AV-UI-008`, `AV-UI-009`, `AV-FLOW-025`의 A-08 `STATIC_ONLY / STATIC_CONTRACT_PASS` slice만 PASS다.
- 실제 ProductValidation, ReleaseDecision, defect retest, Apply, Deploy 또는 DIR 판단을 수행하지 않았다.
- 실제 L4/L5/L7, MI, AE, E-SHOT, E-EVT, E-DEC, API, DB, Event, Browser, Network, Docker, WSL, server, deploy, release는 `NOT_EXECUTED`다.
- 정적 Markdown/SVG와 fixture를 runtime·사용자 기능판정·release PASS로 승격하지 않는다.

## 조치

Main Agent는 본 evidence를 fresh 검토한 뒤에만 A-08 최종 수락 여부를 판정할 수 있다. Tester는 `ACCEPTED`, progress 갱신, commit/push 또는 A-09 착수를 수행하지 않았다. Tester workspace write는 본 보고서 한 파일뿐이다.
