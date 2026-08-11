# A-02 독립 Tester 재검증 보고서 R2

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- blocking defect: 0
- DEF-A02-001: CLOSED
- DEF-A02-002: CLOSED
- canonical L4: `RUNTIME_DEFERRED / NOT_EXECUTED`
- Main acceptance 전 A-03: `BLOCKED_PENDING_A02_ACCEPTANCE`
- 기능 범위·요구사항·중요 위험 변경: 없음
- DIR-1·DIR-X: 미도달

## 판단 이유

Revision 2 checker는 successor evidence manifest를 실제 bundle 검사 경로에서 호출하며 self-reference, exact raw set, canonical/content byte aggregate, 실제 bytes/hash, target/delivered 및 predecessor/TestReport binding을 fail-closed로 거부한다. Markdown screen token과 explanation table도 key/value 의미 단위로 catalog에 결박된다. R1에서 재현된 두 fail-open과 추가 semantic mutation을 모두 독립 메모리 mutation으로 재시험했으며 stable reason code가 관찰됐다.

현재 정상 bundle의 exact viewport/font/layout/spacing, semantic palette/contrast, color-only 금지, `icon + status_label + short_description`, `i-icon + tooltip/popover`, reason/next_action, focus/keyboard, persistent box=false, SVG 1920×1080, A-01 predecessor와 R1 evidence 불변성도 확인했다.

## 기준 hash와 raw chain

| artifact | SHA-256 |
|---|---|
| WorkInstruction | `E98C59E23CA907993B250C663E69F9DCF93BA79DAD17BDADDD0EFF76429381F0` |
| InvocationPrompt | `1644769B1ED65EDE6C8366B76CD617CC1F39CFD0DC0225AD3DA62C34820AF493` |
| R2 Developer manifest | `779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168` |
| R2 completion progress manifest | `A0C64FB3A07A2C4D120863ECE68FA6B39AEE9F299D85F8899FED8FAB29439B4D` |
| R1 Developer manifest | `FC2D3BD61BA7014CB74635D96AF68C3CCEE970E9FEAC52327A020570A52E5269` |
| R1 independent TestReport | `1732C036F79FBE05DF9EBF1BB59B67E621DAE8CC40259D30585714C01F73FAF8` |
| A-01 accepted path catalog | `FC3A503E5038C86BFD841DA5F93826A3FC85B5EB2A020E1196385247C2B7DD69` |

- R2 Developer manifest 독립 재계산: target/delivered `5600CF11BED593D1187C454B54CA5CD218E149724EC0A7955C512E0520839CFD`, canonical 1,823 bytes, content 105,205 bytes로 일치.
- R2 completion manifest 독립 재계산: content/target/delivered `sha256:FA30D9994161A184784182B06E145DD0D9B2CD34B3EF24019F4C19ACA1411F14`, canonical 622 bytes, content 26,528 bytes로 일치.
- successor가 R1 manifest와 R1 TestReport의 exact hash를 raw row와 명시 binding으로 보존한다.

## DEF-A02-001 독립 closure

정상 R2 manifest를 메모리에서 각각 변조하여 `validate_evidence_manifest()`와 bundle 연결을 직접 검사했다.

| mutation | 관찰된 stable reason code |
|---|---|
| `self_reference=true` | `EVIDENCE_SELF_REFERENCE_FORBIDDEN` |
| `target_canonical_bytes=0` | `EVIDENCE_CANONICAL_BYTES_MISMATCH` |
| `target_content_bytes=0` | `EVIDENCE_CONTENT_BYTES_MISMATCH` |
| `AGENTS.md` raw row 추가 후 target/bytes까지 재계산 | `EVIDENCE_RAW_PATH_SET_MISMATCH` |
| raw bytes +1 | `EVIDENCE_RAW_BYTES_MISMATCH` |
| raw SHA zero | `EVIDENCE_RAW_HASH_MISMATCH` |
| target/delivered zero | `EVIDENCE_TARGET_HASH_MISMATCH` |
| predecessor hash zero | `EVIDENCE_PREDECESSOR_BINDING_MISMATCH` |
| R1 TestReport hash zero | `EVIDENCE_TEST_REPORT_BINDING_MISMATCH` |

`validate_evidence_manifest()`을 `INDEPENDENT_MANIFEST_TRAP` 반환 mock으로 바꾼 뒤 `validate_bundle()`을 실행했을 때 bundle error에 해당 trap이 포함됐다. 따라서 CLI bundle의 manifest validator 호출도 독립 확인했다.

## DEF-A02-002 독립 closure

workspace를 수정하지 않고 `Path.read_text`를 메모리 mock하여 다음 semantic mutation을 검사했다.

| mutation | 관찰된 stable reason code |
|---|---|
| body/form 12px → 16px | `DOCUMENT_SCREEN_TOKEN_BINDING_MISMATCH` |
| sidebar 224px/56px → 56px/224px | `DOCUMENT_SCREEN_TOKEN_BINDING_MISMATCH` |
| context drawer ON_DEMAND → ALWAYS_OPEN | `DOCUMENT_SCREEN_TOKEN_BINDING_MISMATCH` |
| success/warning palette value swap | `DOCUMENT_COLOR_ALIGNMENT_MISMATCH` |
| persistent explanation false → true | `DOCUMENT_EXPLANATION_BINDING_MISMATCH` |
| required_content 순서 swap | `DOCUMENT_EXPLANATION_BINDING_MISMATCH` |
| keyboard access true → false | `DOCUMENT_EXPLANATION_BINDING_MISMATCH` |

원래 두 fail-open과 추가 semantic mutation 전부 거부되어 DEF-A02-002는 닫혔다.

## fresh verification

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest -v tests.tooling.test_a02_tokens
```

- exit 0, 10/10 PASS, failure 0, error 0, skip 0.

```powershell
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a02_tokens.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_project_progress.py
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g07_baseline.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_phase_g_gate.py .
```

- 모두 exit 0.
- A-02 checker: PASS, errors `[]`.
- project progress: PASS, sequence 56, reporting AUTO_CONTINUE.
- G-07: PASS, packages 97, AV 255, uncovered 0, scenarios 20.
- Phase G Gate: PASS, accepted 7, decisions 10, packages 97, AV 255, scenarios 20, sync 7.

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a02_tokens tests.tooling.test_project_progress tests.tooling.test_g07_baseline tests.tooling.test_phase_g_gate
```

- exit 1, 72개 중 67 PASS/5 FAIL, skip 0.
- 5개는 과거 checkpoint를 현재 root에 적용하면서 `ACTIVE`, seq46, `MAIN_PACKAGE_ACCEPTED`를 고정 기대하는 historical unit expectation이며 현재 seq56 `TEST_REVIEW / PACKAGE_COMPLETED`와 충돌한다.
- 실패 test는 R1 보고서와 동일한 `test_a01_post_push_materialization_projects_current_ready_checkpoint`, `test_phase_g_checkpoint_push_projects_a01_ready_without_active_instruction`, `test_task4_acceptance_projects_ready_for_a01_work_instruction`, `test_repository_projection_accepts_only_exact_evidence_descendant`, `test_repository_reconciliation_and_failure_lineages_are_explicit`이다.
- 현재 projection 전용 CLI 4종은 모두 PASS하므로 이 historical 5건을 A-02 R2 blocking defect로 승격하지 않는다.

## 정적 계약·progress 확인

- viewport 1920×1080, body/form 12px, small 10px, auxiliary 9px, sidebar title 14px, screen title 16px.
- sidebar 224px/56px, header 48px, context drawer 360px ON_DEMAND, padding 16px, card gap 12px.
- semantic contrast는 R1 독립 계산값 17.752, 15.505, 9.287, 7.666, 13.223, 3.875 조합으로 4.5:1/3.0:1 guard를 충족하며 palette 값은 R2에서 변하지 않았다.
- SVG XML width 1920, height 1080, viewBox `0 0 1920 1080`; `E-SHOT_STATIC_NOT_RUNTIME_UI`와 `RUNTIME_DEFERRED / NOT_EXECUTED` 유지.
- progress seq56, status `TEST_REVIEW`, active agent/worker lease/write lease 모두 null.
- result `COMPLETED`, accepted=false, `independent_tester_status=R2_PENDING`, finding 상태 `FIXED_AWAITING_INDEPENDENT_RETEST`.
- event sequence는 1~56이 연속이며 HEAD의 seq1~46과 현재 seq1~46이 동일하다. seq47~56은 revoke/revoke/completed → failure accepted → rework lease/lease/resumed → revoke/revoke/completed의 one-way 순서다.
- R1 manifest, R1 TestReport, A-01 catalog hash는 기준값과 일치한다.
- `git diff --check` exit 0.

## exact R2 TEST_REVIEW 29-path envelope

1. `docs/architecture/a02/A-02_EXPLANATION_INTERFACE.md`
2. `docs/architecture/a02/A-02_SCREEN_TOKEN_SPEC.md`
3. `docs/architecture/a02/A-02_STATIC_RENDER.svg`
4. `docs/architecture/a02/A-02_TOKEN_CATALOG.json`
5. `docs/completion_reports/A-02_COMPLETION_REPORT.md`
6. `docs/evidence/manifests/A-02_COMPLETION_PROGRESS_MANIFEST.json`
7. `docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json`
8. `docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json`
9. `docs/evidence/manifests/A-02_REWORK_COMPLETION_PROGRESS_MANIFEST.json`
10. `docs/evidence/manifests/A-02_REWORK_START_MANIFEST.json`
11. `docs/progress/BUILD_HANDOFF.md`
12. `docs/progress/build-progress.json`
13. `docs/progress/failure-ledger.json`
14. `docs/progress/progress-events.json`
15. `docs/progress/progress-handoff-detached-digest-a02-completion-test-review.json`
16. `docs/progress/progress-handoff-detached-digest-a02-rework-completion-test-review.json`
17. `docs/progress/progress-handoff-detached-digest-a02-rework-start.json`
18. `docs/test_reports/A-02_TEST_REPORT.md`
19. `docs/validation/A-02_TOKEN_VALIDATION.md`
20. `scripts/check_a02_tokens.py`
21. `scripts/check_g07_baseline.py`
22. `scripts/check_phase_g_gate.py`
23. `scripts/check_project_progress.py`
24. `tests/fixtures/a02/canonical-contract.json`
25. `tests/fixtures/a02/mutation-catalog.json`
26. `tests/tooling/test_a02_tokens.py`
27. `tests/tooling/test_g07_baseline.py`
28. `tests/tooling/test_phase_g_gate.py`
29. `tests/tooling/test_project_progress.py`

이 보고서 생성으로 Tester 전용 허용 path인 `docs/test_reports/A-02_TEST_REPORT_R2.md`만 30번째 path로 추가됐다.

## 미실행·잔여 위험

- `AV-UI-001/002` canonical L4 Playwright/browser screenshot: `RUNTIME_DEFERRED / NOT_EXECUTED`.
- API, DB, Event, Network, Docker, WSL, server, deploy, release: `NOT_EXECUTED`.
- 정적 SVG를 runtime E-SHOT PASS로 승격하지 않는다.
- Main ACCEPTED와 commit/push/A-03은 Tester 범위 밖이며 수행하지 않았다.

## 조치

Main은 본 R2 PASS evidence를 검토해 blocking defect 0을 확인한 뒤 A-02 acceptance projection을 수행할 수 있다. Tester는 R1 보고서나 기존 artifact를 수정하지 않았다.
