# A-02 독립 Tester 보고서

## 판정

`FAILURE_REPORT / REWORK_REQUIRED`

- package 판정: `STATIC_CONTRACT_REWORK_REQUIRED`
- canonical L4: `RUNTIME_DEFERRED / NOT_EXECUTED`
- Main acceptance: 금지
- A-03: `BLOCKED_PENDING_A02_ACCEPTANCE`
- blocking defect: 2건
- 기능 범위·요구사항·중요 위험 변경: 없음
- DIR-1·DIR-X: 미도달

## 판단 이유

실제 A-02 정적 token 값, semantic palette, contrast, 설명 인터페이스, SVG 크기와 A-01 불변성은 현재 입력에서 일치한다. 그러나 필수 checker가 증거 manifest를 CLI bundle에서 검증하지 않고, manifest self-reference·byte aggregate·raw path 변조를 직접 validator에서도 거부하지 않는다. 또한 Markdown binding이 token의 의미 연결이 아니라 literal 존재만 확인하여 body와 sidebar 값을 의미적으로 바꿔도 PASS한다. 따라서 현재 정상 파일에 대한 PASS만으로 fail-closed 계약을 증명할 수 없다.

## 기준 binding과 독립 hash

| artifact | SHA-256 |
|---|---|
| A-02 WorkInstruction | `E98C59E23CA907993B250C663E69F9DCF93BA79DAD17BDADDD0EFF76429381F0` |
| A-02 InvocationPrompt | `1644769B1ED65EDE6C8366B76CD617CC1F39CFD0DC0225AD3DA62C34820AF493` |
| Developer evidence manifest | `FC2D3BD61BA7014CB74635D96AF68C3CCEE970E9FEAC52327A020570A52E5269` |
| Main completion progress manifest | `3C9BB8DE57F5DB93FBB7CBA316E0F62E0260415918BA46D2B04B9262DCDBF046` |
| CompletionReport | `5CAA3F7ECF50E48B38773B8D6E89080CC69AD74373E94D13C79D9CA74EC65BFB` |
| A-01 accepted path catalog | `FC3A503E5038C86BFD841DA5F93826A3FC85B5EB2A020E1196385247C2B7DD69` |

- Developer manifest 독립 재계산: target/delivered `D4CFB774263C4BEC16294155C8603B18CA6A677B389D9390B1644173B59029F0`, canonical 1,559 bytes, content 75,135 bytes로 현재 manifest와 일치.
- Main completion manifest 독립 재계산: content/target/delivered `sha256:EE1DAF9E6540E48497BEB3C2B545A0C7CC9A3010A67EBFD34D1876237F795198`, canonical 629 bytes, content 19,570 bytes로 현재 manifest와 일치.
- 현재 두 manifest의 `self_reference=false`는 맞지만, 아래 적대 mutation에서 이 guard가 fail-open임을 확인했다.

## 정적 계약 확인 결과

- viewport: `1920×1080`
- typography: body/form 12px, small 10px, auxiliary 9px, sidebar title 14px, screen title 16px
- layout: sidebar 224px/56px, header 48px, context drawer 360px ON_DEMAND, padding 16px, card gap 12px
- explanation: `i-icon`, tooltip/popover, reason/next_action, hover-only 금지, focus/keyboard, Escape close, trigger focus return, persistent box=false
- status: color-only 금지, `icon + status_label + short_description`
- SVG XML: width 1920, height 1080, viewBox `0 0 1920 1080`, XML parse 성공, 47 elements
- contrast 독립 계산: text-primary/canvas 17.752, text-primary/surface 15.505, text-muted/surface 9.287, interactive/surface 7.666, focus/canvas 13.223, border/canvas 3.875. 선언한 4.5:1/3.0:1 기준 충족.
- A-01 predecessor: accepted catalog hash 일치, A-02 completion base 이후 A-01 관련 diff 없음.
- 판정 경계: `STATIC_ONLY / E-SHOT_STATIC_NOT_RUNTIME_UI`; `AV-UI-001/002` canonical L4는 `RUNTIME_DEFERRED / NOT_EXECUTED`로 유지.

## 독립 hostile mutation

### DEF-A02-001 — evidence manifest fail-open

- severity: blocking MAJOR
- fingerprint: `A02-EVIDENCE-MANIFEST-NOT-IN-BUNDLE-AND-INCOMPLETE-GUARDS`
- 재현 결과:
  - Developer manifest의 `self_reference=true` → `validate_evidence_manifest()` errors `[]`
  - `target_canonical_bytes=0`, `target_content_bytes=0` → errors `[]`
  - `AGENTS.md`를 arbitrary raw path로 추가하고 target/delivered를 다시 계산 → errors `[]`
  - `validate_evidence_manifest`가 호출되면 예외를 내도록 trap한 뒤 `validate_bundle()` 실행 → errors `[]`; trap 미호출
- 영향: manifest가 self-referential이거나 byte aggregate/raw set이 변조돼도 대표 A-02 checker CLI가 PASS할 수 있다. WI의 raw checksum/target/delivered/self-reference와 fail-closed evidence binding을 만족하지 못한다.
- 요구 조치: `validate_bundle()`에서 evidence manifest를 반드시 로드·검증하고, exact raw path set, `self_reference is False`, target canonical/content bytes, raw bytes/hash, target/delivered를 모두 독립 재계산해 stable reason code로 거부한다. 해당 mutation test를 fixture와 fresh test에 추가한다.

### DEF-A02-002 — catalog/Markdown 의미 binding fail-open

- severity: blocking MAJOR
- fingerprint: `A02-DOCUMENT-LITERAL-PRESENCE-NOT-SEMANTIC-BINDING`
- 재현 결과: 메모리에서 spec의 `body/form 12px`를 `body/form 16px`로 바꾸고 sidebar `224px / 56px`를 `56px / 224px`로 swap했지만 `validate_document_alignment()` errors `[]`.
- 영향: 모든 숫자 literal이 문서 어딘가에 남아 있으면 token의 의미가 catalog와 달라도 PASS한다. WI의 catalog-doc-SVG binding과 exact token contract를 보장하지 못한다.
- 요구 조치: 구조화된 Markdown table을 token key별로 parse하여 catalog 값과 1:1 비교하고, SVG도 표시된 token key/value 및 핵심 presentation binding을 구조적으로 비교한다. semantic swap mutation을 stable reason code로 거부한다.

## fresh 명령과 실제 결과

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest -v tests.tooling.test_a02_tokens
```

- exit 0, 8/8 PASS, failure 0, error 0, skip 0.

```powershell
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a02_tokens.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_project_progress.py
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g07_baseline.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_phase_g_gate.py .
```

- 각각 exit 0.
- A-02 checker: PASS/errors 0.
- project progress: PASS, sequence 49, AUTO_CONTINUE.
- G-07: PASS, packages 97, AV 255, uncovered 0, scenarios 20.
- Phase G Gate: PASS, accepted 7, decisions 10, packages 97, AV 255, scenarios 20, sync 7.

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a02_tokens tests.tooling.test_project_progress tests.tooling.test_g07_baseline tests.tooling.test_phase_g_gate
```

- exit 1, 70개 중 65 PASS/5 FAIL, skip 0.
- 5개는 과거 checkpoint를 현재 root에 투영하면서 `ACTIVE`, seq46, `MAIN_PACKAGE_ACCEPTED`를 고정 기대하는 historical unit expectation이다. 현재의 정당한 seq49 `TEST_REVIEW / PACKAGE_COMPLETED`와 충돌했다.
- 실패 test: `test_a01_post_push_materialization_projects_current_ready_checkpoint`, `test_phase_g_checkpoint_push_projects_a01_ready_without_active_instruction`, `test_task4_acceptance_projects_ready_for_a01_work_instruction`, `test_repository_projection_accepts_only_exact_evidence_descendant`, `test_repository_reconciliation_and_failure_lineages_are_explicit`.
- 현재 상태 전용 CLI 4종은 모두 PASS했으므로 이 5건은 DEF-A02-001/002와 분리 기록하며 A-02 제품 결함으로 계산하지 않는다.

적대 검증은 workspace 파일을 변조하지 않고 Python 메모리 객체와 `unittest.mock`으로 실행했다. 핵심 실행은 다음과 같다.

```powershell
C:\Users\cyhuh\anaconda3\python.exe -c "... self_reference=True; target_canonical_bytes=0; target_content_bytes=0; arbitrary AGENTS.md raw row; validate_evidence_manifest(...); validate_bundle(...) ..."
C:\Users\cyhuh\anaconda3\python.exe -c "... spec body/form 12px->16px; sidebar 224px/56px->56px/224px; mock Path.read_text; validate_document_alignment(...) ..."
```

- 첫 명령 결과: self-reference errors `[]`, zero-byte errors `[]`, arbitrary-path errors `[]`, bundle errors `[]`.
- 둘째 명령 결과: document semantic swap errors `[]`; manifest-validator trap을 둔 bundle errors `[]`, trap 미호출.

## progress·repository 확인

- progress sequence 49, status `TEST_REVIEW`, active agent/worker lease/write lease 모두 null.
- active WI result `COMPLETED`, accepted=false, independent_tester_status=PENDING.
- A-03은 `BLOCKED_PENDING_A02_ACCEPTANCE`.
- HEAD `2bd88123e93550db5874b479c82d78d4733fd53f`, origin/main `1ace56384d55cbe11d34f2532e9f602d389a9512`, push는 Main 소유 `PUSH_PENDING_MAIN`.
- Tester 보고서 생성 전 exact TEST_REVIEW worktree path는 manifest와 같은 22개였다.
- HEAD의 seq1~46 event와 현재 progress-events seq1~46은 byte-equivalent parsed objects이며, 현재는 seq47~49만 후속 append됐다.
- `git diff --check` exit 0.

## exact 22-path TEST_REVIEW envelope

1. `docs/architecture/a02/A-02_EXPLANATION_INTERFACE.md`
2. `docs/architecture/a02/A-02_SCREEN_TOKEN_SPEC.md`
3. `docs/architecture/a02/A-02_STATIC_RENDER.svg`
4. `docs/architecture/a02/A-02_TOKEN_CATALOG.json`
5. `docs/completion_reports/A-02_COMPLETION_REPORT.md`
6. `docs/evidence/manifests/A-02_COMPLETION_PROGRESS_MANIFEST.json`
7. `docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json`
8. `docs/progress/BUILD_HANDOFF.md`
9. `docs/progress/build-progress.json`
10. `docs/progress/progress-events.json`
11. `docs/progress/progress-handoff-detached-digest-a02-completion-test-review.json`
12. `docs/validation/A-02_TOKEN_VALIDATION.md`
13. `scripts/check_a02_tokens.py`
14. `scripts/check_g07_baseline.py`
15. `scripts/check_phase_g_gate.py`
16. `scripts/check_project_progress.py`
17. `tests/fixtures/a02/canonical-contract.json`
18. `tests/fixtures/a02/mutation-catalog.json`
19. `tests/tooling/test_a02_tokens.py`
20. `tests/tooling/test_g07_baseline.py`
21. `tests/tooling/test_phase_g_gate.py`
22. `tests/tooling/test_project_progress.py`

## 미실행·잔여 위험

- Playwright/browser screenshot, API, DB, Event, Network, Docker, WSL, server, deploy, release: `NOT_EXECUTED`.
- 정적 SVG는 runtime UI 증거가 아니다.
- fail-open 2건 수정 및 독립 재검증 전 `PASS_STATIC_CONTRACT`, `READY_FOR_MAIN_ACCEPTANCE`, ACCEPTED를 주장할 수 없다.

## 조치

Main은 동일 lineage의 1회 `FAILURE_REPORT`로 기록하고 Developer에게 DEF-A02-001/002의 최소 보완을 지시한다. 제품 계약 자체나 palette/token 값은 다시 열지 않는다. Tester는 ACCEPTED, commit, push, A-03을 수행하지 않았다.
