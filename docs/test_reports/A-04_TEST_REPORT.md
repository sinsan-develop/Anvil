# A-04 독립 Tester 검증 보고서

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- package: `A-04`
- blocking finding: `0`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`
- Main acceptance: 아직 미실행
- A-05: Main acceptance 전까지 `BLOCKED_PENDING_A04_ACCEPTANCE`
- 기능 범위·요구사항·중요 위험 변경: 없음
- DIR-1·DIR-X: 미도달

## 판단 이유

A-04 정적 산출물은 Session Workbench, Conversation Request, Context Drawer, Phase Rail, Control Mode, Human Intervention, Stop/Resume 계약을 승인된 WorkInstruction과 A-01~03 predecessor에 결박한다. 요구사항 확정 guard, 세 control 축 분리, 고위험 `CONTROLLED + STOP`, approval/lease guard, 중복 실행을 막는 resume guard, phase/run status 분리, permission 분리, draft 보존, dirty/untracked 및 UNKNOWN/CONFLICT fail-closed 경계가 checker와 문서·SVG에 일치한다.

현재 정상 bundle을 fresh 검증했고, 독립 메모리·임시 디렉터리 mutation으로 각 보호 경계를 변조했을 때 선언된 stable reason code가 관찰됐다. Developer manifest와 completion progress manifest의 raw bytes/hash, canonical target, delivered target, self-reference 금지, Invocation/WI binding 및 exact 24-path completion projection도 별도로 재계산해 일치했다.

## 기준선과 독립 hash

| artifact | SHA-256 |
|---|---|
| Git HEAD / origin/main | `a5c60edff8ddfa4e8d06b315d728698ce7a06ef9` |
| WorkInstruction | `1B8CE8809EC6546ED483D0E48294CC547F0767A5D0D31D120B08787290ED753E` |
| InvocationPrompt | `DE5A605C7CDB3F84725C4792F612B0455AC00E5C669E8509C1FFF6F0A3F62CDB` |
| Developer evidence manifest | `C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB` |
| Completion progress manifest | `59EE07ABDA513FE9F56A4EC38B0CF7730EA21D85F7F42C6FCE34B99F48A55B12` |
| A-01 catalog / manifest R2 | `FC3A503E5038C86BFD841DA5F93826A3FC85B5EB2A020E1196385247C2B7DD69` / `BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4` |
| A-02 catalog / manifest R2 | `1709D227BB9C44480085CB10B53881B1613AED914F868B629F8B2C3D03D23207` / `779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168` |
| A-03 catalog / manifest R2 | `464F785FB0A72C3E5571D30755EE3A107259D641A6035830B18343E5A0922093` / `772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE` |

- 검증 진입 시 `main = origin/main`, worktree clean, progress sequence `77`, status `TEST_REVIEW`, active agent/worker lease/write lease 모두 `null`이었다.
- Developer manifest 독립 재계산: target/delivered `D2ED622DD179611026D8B396392C84EB5A373986C7733D0ADA78C897D049464E`, canonical `1,597` bytes, content `64,821` bytes, self-reference 없음.
- Completion progress manifest 독립 재계산: target/delivered `sha256:8AF996ADD10B49C025C013342517257C6A5FAFF2927C1872F04A91A18C080BF0`, canonical `629` bytes, content `17,993` bytes, self-reference 없음.
- completion base `49678f55b4b814415b6ed7b140d4fce173ab09ab..HEAD` 변경 경로는 manifest의 exact 24-path와 순서까지 일치하고 `git diff --check`는 exit `0`이다.
- authority 5종, WorkInstruction, InvocationPrompt, A-01~03 catalog/manifest hash는 승인 binding과 일치한다.

## 독립 hostile mutation

다음 35개 독립 항목을 workspace 제품 파일을 수정하지 않고 메모리 또는 임시 디렉터리에서 변조했다.

| 보호 경계 | 관찰 결과 |
|---|---|
| AV owner, evidence qualifier, canonical runtime 승격 | `VERIFICATION_CONTRACT_MISMATCH` |
| A-01~03 predecessor hash | `PREDECESSOR_BINDING_MISMATCH` |
| top context | `TOP_CONTEXT_CONTRACT_MISMATCH` |
| requirement field, assumption confirmation | `REQUIREMENT_FIELD_CONTRACT_MISMATCH`, `REQUIREMENT_CONFIRM_GUARD_MISMATCH` |
| A-01 rail step, human intervention point | `A01_RAIL_CONTRACT_MISMATCH`, `HUMAN_INTERVENTION_CONTRACT_MISMATCH` |
| control 축 병합, high-risk stop 제거 | `CONTROL_AXIS_SEPARATION_MISMATCH`, `HIGH_RISK_STOP_CONTRACT_MISMATCH` |
| approval/worker lease 제거 | `EXECUTION_APPROVAL_LEASE_GUARD_MISMATCH` |
| subject hash/checkpoint/reconcile/no-duplicate resume guard | `STOP_RESUME_GUARD_MISMATCH` |
| phase/run status 병합, non-success 오염 | `STATUS_SEPARATION_MISMATCH`, `NON_SUCCESS_STATUS_CONTAMINATION` |
| A-02 font token, 360px drawer | `A02_PRESENTATION_TOKEN_DRIFT`, `CONTEXT_DRAWER_CONTRACT_MISMATCH` |
| A-03 dirty/untracked, policy/protected, UNKNOWN/CONFLICT | `A03_STATE_PRESERVATION_MISMATCH` |
| capability 분리, draft 보존 | `PERMISSION_BOUNDARY_MISMATCH`, `DRAFT_PRESERVATION_MISMATCH` |
| secret/CLI 노출 | `SENSITIVE_DISCLOSURE_FORBIDDEN` |
| Markdown/SVG semantic binding | `DOCUMENT_SEMANTIC_BINDING_MISMATCH`, `STATIC_RENDER_SEMANTIC_BINDING_MISMATCH` |
| manifest WI binding/self-reference/raw hash/target | `EVIDENCE_RUNTIME_QUALIFIER_MISMATCH`, `EVIDENCE_SELF_REFERENCE_FORBIDDEN`, `EVIDENCE_RAW_HASH_MISMATCH`, `EVIDENCE_TARGET_HASH_MISMATCH` |
| bundle에서 manifest validator 호출 | 독립 trap `INDEPENDENT_MANIFEST_VALIDATOR_TRAP` 관찰 |

문서·SVG 탐색성 mutation의 첫 호출은 중복 표기 중 한 군데만 변경해 동일 required token이 다른 위치에 남았으므로 2건을 검출하지 못했다. 이는 불완전 mutation이며 제품 failure로 집계하지 않았다. 해당 token의 모든 출현을 제거한 교정 호출에서는 위 두 stable reason code가 각각 관찰됐다.

## fresh 전체 검증

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests\tooling -p 'test_*.py'
```

- exit `0`
- `Ran 158 tests in 45.614s`
- failure `0`, error `0`, skip `0`

관련 7개 모듈을 별도로 실행한 결과도 exit `0`, `110 tests`, failure/error/skip `0`이었다.

```powershell
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a04_workbench.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a03_onboarding.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a02_tokens.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a01_journey.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_project_progress.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g07_baseline.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_phase_g_gate.py .
```

- 모두 exit `0`.
- A-04/A-03/A-02/A-01: PASS, errors `[]`.
- progress: PASS, sequence `77`, reporting `AUTO_CONTINUE`.
- G-07: PASS, packages `97`, AV `255`, uncovered `0`, scenarios `20`.
- Phase G Gate: PASS, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`.

탐색 중 공통 checker 3개에 지원되지 않는 `--json`/`--help`를 지정한 호출은 CLI usage/load error로 종료됐다. 각 스크립트의 실제 positional root 인터페이스를 확인해 위 명령으로 교정했고 모두 PASS했다. 이 호출 오류는 제품·계약 failure로 집계하지 않는다.

## 정적 계약과 미실행 범위

- `AV-UI-004/005`의 A-04 정적 slice만 PASS다.
- A-01 14-step rail·21 edges·5 paths와 5개 human point를 재정의 없이 소비한다.
- A-02 1920×1080, 12/10/9/14/16px, 360px on-demand drawer, i-tooltip/popover와 접근성 계약을 유지한다.
- A-03 dirty/untracked 분리, policy/protected path, UNKNOWN/CONFLICT fail-closed를 유지한다.
- 실제 Browser, Playwright, API, DB, Event, Network, Docker, WSL, server, deploy, release는 `NOT_EXECUTED`다.
- 정적 SVG/XML 검증을 실제 브라우저 UI 또는 runtime `E-SHOT` PASS로 승격하지 않는다.

## 조치

Main Agent는 본 evidence를 fresh 검토한 뒤에만 A-04 최종 수락 여부를 판정할 수 있다. Tester는 `ACCEPTED`, progress 갱신, commit/push 또는 A-05 착수를 수행하지 않았다. Tester workspace write는 본 보고서 한 파일뿐이다.
