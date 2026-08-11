# A-04 WorkInstruction — Session Workbench 정적 상호작용 계약

## Artifact envelope

- artifact_id: `WI-A-04-20260811-001`
- package_id: `A-04`
- version: `1`
- artifact_status: `approved`
- package_status: `READY`
- created_by: `main-agent-eoul`
- source_spec_sha256: `ED8D04212B95B266F1B6ABBC6411E95C033D7F4038BFABEE34C4E40A3E4289B2`
- source_plan_sha256: `FED52BC400D099E42092B00EDDEC2F54CA9F3E99A59D8D7C8C60E01898A37431`
- baseline_git_commit: `445765acfc5ca565d24bd794db6edd08c6dbca05`
- executor: `developer-primary-a04`

## Authority and predecessor binding

- design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- a01_manifest_sha256: `BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4`
- a02_manifest_sha256: `779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168`
- a03_manifest_sha256: `772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE`
- a03_test_report_sha256: `0D16D409B87B161F96811E9297A2F3877398B5124FA5D9D20D648C0235C07C2F`
- a03_acceptance_manifest_sha256: `6F5BA43D70E910CDA7D4F1A375C7C5AD0B801F2807B1D0468CB2661D4F768B22`

## Goal and staged verdict

Session Workbench·Conversation Request·Context Drawer·Phase Rail·Control Mode·Human Intervention·Stop/Resume의 정적 field/state/edge 계약을 확정한다.

- package: `STATIC_CONTRACT_PASS`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`
- `AV-UI-004`: A-04 static interaction contract; A-14/A Gate runtime owner
- `AV-UI-005`: A-01 canonical static predecessor; A-04 static consumer/regression; A Gate integrated runtime

## Exact contract

### Workbench

- top context: project, branch, baseline, environment
- panes: Conversation, Current Work, Evidence·Decision
- controls: stop, revision request, plan approve, apply approve, discard
- Progressive Disclosure이며 12개 고정 화면을 강제하지 않는다.

### Conversation and requirements

- objective, acceptance_criteria, included_scope, excluded_scope, protected_scope, assumptions, questions
- confirm, edit, reject, hold, view_evidence, request_reanalysis, confirm_requirements
- confirm guard: objective 존재, criterion 1개 이상, mandatory unanswered 0, assumptions 전부 user-confirmed
- agent guess와 confirmed fact를 구분한다.

### Context Drawer

- impact, source/evidence/hash, decision history, reason, next_action
- 360px on-demand; persistent box/hover-only 금지; keyboard/focus/Escape/focus-return 지원 계약

### Phase Rail and human points

- A-01 macro rail/14 steps/state/normal-reject-revise-stop-resume edge ID를 그대로 소비
- human points: STEP-03, STEP-06, STEP-10, STEP-12, STEP-14
- subject artifact/hash, actor/capability, decisions, reason, evidence, status, next action

### Modes and safety

- control level `LIGHT|STANDARD|CONTROLLED`
- execution strategy `SINGLE_WORKER|DELEGATED|PARALLEL_BATCH`
- failure policy `STOP|CONTINUE_INDEPENDENT|COLLECT_AND_REVIEW`
- 세 축을 합치지 않는다.
- high-risk ambiguity/migration/auth/secret/payment/prod deploy/deletion/shared schema/direction change/unverified input => `CONTROLLED + STOP`
- approval/lease 없이 Execute 자동 진입 금지

### Stop/resume

- interrupted point, last completed step, checkpoint/hash, side-effect reconciliation, changed conditions
- safe_resume, hold, restart, discard
- same hash/checkpoint/completed steps restored/no duplicate execution/side-effect reconciliation guard

### Status, permission, preservation

- phase와 Run status enum을 합치지 않는다.
- WAITING/BLOCKED/INTERRUPTED/SKIPPED를 success로 표시하지 않는다.
- Project view와 control/mode/approval/apply 권한을 분리한다.
- unauthorized action은 disabled + reason/next action이다.
- error 후 draft/input 보존.
- A-03 dirty/untracked/policy/protected/UNKNOWN/CONFLICT를 숨기거나 ready로 승격 금지.
- secret, raw internal endpoint, localhost, unauthorized path, shell/CLI 기본 노출 금지.

## Required artifacts

1. `docs/architecture/a04/A-04_WORKBENCH_CATALOG.json`
2. `docs/architecture/a04/A-04_SESSION_WORKBENCH.md`
3. `docs/architecture/a04/A-04_CONVERSATION_CONTEXT.md`
4. `docs/architecture/a04/A-04_PHASE_RAIL_CONTROL.md`
5. `docs/architecture/a04/A-04_WORKBENCH_STATIC_RENDER.svg`
6. `docs/architecture/a04/A-04_CONTROL_STATIC_RENDER.svg`
7. `scripts/check_a04_workbench.py`
8. `tests/tooling/test_a04_workbench.py`
9. `tests/fixtures/a04/canonical-contract.json`
10. `tests/fixtures/a04/mutation-catalog.json`
11. `docs/validation/A-04_WORKBENCH_VALIDATION.md`
12. `docs/evidence/manifests/A-04_EVIDENCE_MANIFEST.json`
13. `docs/completion_reports/A-04_COMPLETION_REPORT.md`

## Allowed paths

- `docs/architecture/a04/**`
- `scripts/check_a04_workbench.py`
- `tests/tooling/test_a04_workbench.py`
- `tests/fixtures/a04/**`
- `docs/validation/A-04_*`
- `docs/evidence/manifests/A-04_EVIDENCE_MANIFEST*.json`
- `docs/completion_reports/A-04_COMPLETION_REPORT.md`
- Main-only `docs/work_orders/A-04_*`, `docs/progress/**`
- Tester-only `docs/test_reports/A-04_TEST_REPORT*.md`

## Forbidden

- authority, AGENTS, A-01/A-02/A-03 accepted evidence mutation
- `apps/**`, `packages/**`, dependency/lock/config
- API/DB/runtime/browser/Playwright/deploy implementation
- A-05+ 화면 선점, static/mock의 L7/runtime PASS 승격
- existing Event/manifest retroactive mutation
- Developer commit/push

## TDD and hostile mutations

실제 RED 후 최소 GREEN. Checker는 다음을 stable reason code로 거부한다.

- AV/runtime owner/qualifier/predecessor hash drift
- top context/requirement field/confirm guard 누락
- A-01 step/edge/state/human point 누락·재정의
- mode/strategy/failure policy 병합
- high-risk stop, approval/lease guard 제거
- stop/resume hash/checkpoint/reconcile/no-duplicate guard 제거
- phase/status 병합, WAITING/BLOCKED/INTERRUPTED/SKIPPED success 오염
- A-02 token/drawer/explanation drift
- A-03 dirty/untracked/policy/protected/unknown/conflict 숨김·승격
- permission separation/draft preservation/reason-next_action 누락
- secret/internal endpoint/localhost/path/CLI 노출
- catalog/doc/SVG binding 또는 manifest integrity drift

## Verification and completion

Run A-04 focused tests/checker, A-01~03 relevant regressions, project/G07/Phase-G checkers, JSON/SVG/raw-target/self-reference/exact diff/diff-check. Browser/API/DB/runtime/deploy는 `NOT_EXECUTED`로 기록한다. Developer는 `COMPLETED_PENDING_INDEPENDENT_TEST`로 보고하고 Main이 leases를 회수해 TEST_REVIEW로 전환한다. Blocking MAJOR 이상이면 수락 금지. DIR은 A-15 이후이므로 현재 미도달이다.
