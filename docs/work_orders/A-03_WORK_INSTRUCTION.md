# A-03 WorkInstruction — Project Dashboard·Repository Onboarding 정적 계약

## Artifact envelope

- artifact_id: `WI-A-03-20260811-001`
- artifact_type: `work_instruction`
- project_id: `anvil`
- package_id: `A-03`
- version: `1`
- artifact_status: `approved`
- package_status: `READY`
- created_by: `{ actor_type: agent, actor_id: main-agent-eoul }`
- created_at: `2026-08-11T12:40:00+09:00`
- source_spec_sha256: `8F9CAC4310E8E46252C20CF39BDBED1EEC82E8CC5BE47EB5478B95FD4CD02C93`
- source_plan_sha256: `C657B20678EB63B2882044EACBD66502A9121A8F27B711921B9FEDCBDAF58466`
- baseline_git_commit: `a150a13fbc9874dcf18df7e7f0c713f7ca5d67ab`
- executor: `developer-primary-a03`
- independent_tester: `구현 대화와 분리된 Tester 1명`

## 권위·predecessor binding

- design_source_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- validation_matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- predecessor_packages: `A-01 ACCEPTED`, `A-02 ACCEPTED`
- a01_manifest_sha256: `BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4`
- a02_manifest_sha256: `779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168`
- a02_test_report_sha256: `C2E545EE3B60921030EFB5F1267F86EAB7AF4EB63220B99154FBC960D762354D`
- a02_acceptance_manifest_sha256: `41408A11D736B95BC6A2CA7B96AA52DB011D5458C5B96D44953EE9BEE428D7F2`

## 목표와 staged 판정

Project 등록, Repository read-only scan, onboarding review, Project Dashboard·Detail의 화면·field·state·edge 계약을 정적 artifact로 확정한다. baseline, tracked dirty, untracked, policy, protected path와 unknown/blocked 상태를 사용자가 CLI·DB 없이 구분할 수 있도록 설계한다.

A-03 판정은 `STATIC_CONTRACT_PASS / CANONICAL_L7_RUNTIME_DEFERRED_NOT_EXECUTED`다.

- `AV-UI-003`: A-03은 정적 화면 계약만 검증한다. 실제 운영자 L7 판정은 F-01/F-12/F Gate다.
- `AV-UI-004`: A-03은 정적 onboarding slice만 검증한다. 실제 전체 흐름 L7 판정은 A-14/A Gate이며 A-04가 정적 후속 화면을 담당한다.
- `E-SHOT`은 `E-SHOT_STATIC_NOT_RUNTIME_UI`, `E-DEC`은 `E-DEC_NOT_EXECUTED`로만 기록한다.

## canonical screens

1. `SCREEN-PROJECT-DASHBOARD`
   - filter: Project, Environment, 오늘/7일/30일, refresh time
   - Health 6종: Database, Queue, Worker, LLM Providers, Execution Backends, Artifact Store
   - 운영 card 6종: running, approval waiting, BLOCKED, required Gate not passed, cost overrun, baseline conflict
   - Next Actions와 Critical Alerts는 reason·elapsed/source·deep link를 가진다.
2. `SCREEN-PROJECT-REGISTER`
   - name, slug, description, source type(local/git), conditional localPath/remoteUrl, defaultBranch, environment, backend/policy
   - submit은 Project/Repository record와 read-only scan 예약만 의미한다.
3. `SCREEN-REPOSITORY-ONBOARDING`
   - canonical root/remote/branch/HEAD/baseline, tracked dirty/untracked, manifest/toolchain/commands, rules/protected paths, secret masking, scan mutation count
4. `SCREEN-ONBOARDING-REVIEW`
   - default branch, Project Rules, protected paths, allowed environments, baseline summary, uncertainty, isolation status, evidence link
5. `SCREEN-PROJECT-DETAIL`
   - Overview/Repositories/Baselines/Rules/Toolchain/Environments/Members tabs와 read-only rescan

## field·state·edge contract

### 상태

- `NOT_STARTED`
- `PATH_VALIDATING`
- `SCANNING_READ_ONLY`
- `REVIEW_REQUIRED`
- `BLOCKED`
- `READY_TO_REGISTER`
- `REGISTERED`

repository는 `PENDING | READY | ERROR`, baseline은 `NOT_CREATED | CLEAN | DIRTY | CONFLICT | UNKNOWN | ISOLATION_DEGRADED`, health는 `NORMAL | WARNING | ERROR`를 구분한다.

### reason/error

- `ROOT_OUTSIDE_ALLOWED`
- `PATH_NOT_FOUND`
- `PERMISSION_DENIED`
- `NON_GIT_REVIEW_REQUIRED`
- `DIRTY_TRACKED_PRESENT`
- `UNTRACKED_PRESENT`
- `BASELINE_CONFLICT`
- `PROTECTED_PATH_POLICY_INVALID`
- `SCAN_MUTATION_DETECTED`
- `409 PROJECT_SLUG_EXISTS`
- `403 REPOSITORY_PATH_DENIED`
- `422 REPOSITORY_NOT_FOUND`

### 핵심 edge

- valid register submit → scan queued → `SCANNING_READ_ONLY` → review → baseline create
- 409/403/422 → form 유지 + field/global reason + next action
- dirty/untracked/NON_GIT/unknown → `REVIEW_REQUIRED`, 원본 보존, 자동 READY 금지
- outside-root/permission/mutation → `BLOCKED`
- baseline conflict → 원본 보존 + 사용자 선택
- Dashboard alert/next action → Project Detail의 해당 tab/deep link
- read-only rescan → 새 profile/baseline candidate, 원본 불변

## 보존·권한·표현

- tracked dirty와 untracked를 하나의 수치로 합치지 않는다.
- dirty/untracked를 자동 정리·이동·삭제하지 않는다.
- scan/rescan에서 source write, install, format, Git mutation을 금지한다.
- Project view와 Project/Repository manage capability를 분리한다.
- unauthorized edit/confirm은 disabled + reason/next action으로 표시한다.
- credential·secret은 reference/masked만 허용한다.
- 모든 상태는 A-02 `icon + status label + short description`과 i tooltip/popover를 사용한다.
- success rate에는 기간·표본 수·PASS/SKIPPED 구성을 포함하고 SKIPPED를 성공으로 집계하지 않는다.

## 필수 산출물

1. `docs/architecture/a03/A-03_ONBOARDING_CATALOG.json`
2. `docs/architecture/a03/A-03_PROJECT_DASHBOARD.md`
3. `docs/architecture/a03/A-03_PROJECT_REGISTRATION.md`
4. `docs/architecture/a03/A-03_REPOSITORY_ONBOARDING.md`
5. `docs/architecture/a03/A-03_DASHBOARD_STATIC_RENDER.svg`
6. `docs/architecture/a03/A-03_ONBOARDING_STATIC_RENDER.svg`
7. `docs/architecture/a03/A-03_REPOSITORY_STATE_STATIC_RENDER.svg`
8. `scripts/check_a03_onboarding.py`
9. `tests/tooling/test_a03_onboarding.py`
10. `tests/fixtures/a03/canonical-contract.json`
11. `tests/fixtures/a03/mutation-catalog.json`
12. `docs/validation/A-03_ONBOARDING_VALIDATION.md`
13. `docs/evidence/manifests/A-03_EVIDENCE_MANIFEST.json`
14. `docs/completion_reports/A-03_COMPLETION_REPORT.md`
15. Main projection의 `docs/progress/**`

## 허용 경로

- `docs/architecture/a03/**`
- `scripts/check_a03_onboarding.py`
- `tests/tooling/test_a03_onboarding.py`
- `tests/fixtures/a03/**`
- `docs/validation/A-03_*`
- `docs/evidence/manifests/A-03_EVIDENCE_MANIFEST*.json`
- `docs/completion_reports/A-03_COMPLETION_REPORT.md`
- Main 전용 `docs/work_orders/A-03_*`, `docs/progress/**`
- Tester 전용 `docs/test_reports/A-03_TEST_REPORT*.md`

## 금지 범위

- 권위 문서, AGENTS.md, approval/baseline, A-01/A-02 accepted evidence 수정
- `apps/**`, `packages/**`, dependency/lock/config, 실제 scanner/API/DB/browser/Playwright runtime
- A-04 이후 화면/interaction 선점
- source write/install/format/Git mutation을 read-only scan으로 표시
- raw credential·secret·무권한 local full path 노출
- static/mock을 L7·runtime PASS로 표시
- 기존 progress Event·manifest 소급 수정
- Developer commit/push, server/DB/WSL/ysna 배포

## TDD·hostile mutations

RED를 실제 관찰한 뒤 최소 GREEN을 구현한다. validator는 다음을 stable reason code로 거부한다.

- 필수 5화면, field, state, reason code, edge 누락·swap·unknown
- baseline/branch/commit 또는 tracked dirty/untracked 누락·병합
- dirty/untracked/NON_GIT/unknown을 CLEAN·READY·PASS로 승격
- user-owned·원본 보존·자동 cleanup 금지 문구 제거
- policy/rules/protected paths/allowed environments 누락
- protected path를 warning으로 낮추거나 next action 누락
- local/git conditional field 위반, 409/403/422 병합·누락
- credential·secret·무권한 local path 원문 노출
- view/manage permission 혼합
- scan/rescan write/install/format 허용
- Health/운영 card 6종, sample/기간/PASS-SKIPPED, deep link 누락
- A-02 token/tooltip/static qualifier drift
- catalog·Markdown·SVG semantic binding drift
- AV owner/level/method/evidence/severity 또는 runtime owner drift

## verification_contract

```yaml
verification_contract:
  matrix_revision: "sha256:982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A"
  assigned_verification_ids: ["AV-UI-003", "AV-UI-004"]
  required_levels: ["L7"]
  required_methods: ["MX"]
  required_evidence: ["E-SHOT", "E-DEC", "E-ART", "E-MAN", "E-TEST"]
  execution_classification: "STATIC_ONLY"
  package_verdict: "STATIC_CONTRACT_PASS"
  canonical_runtime_verdict: "RUNTIME_DEFERRED / NOT_EXECUTED"
  evidence_qualifier: "E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED"
  runtime_owners:
    AV-UI-003: ["F-01", "F-12", "F Gate"]
    AV-UI-004: ["A-04", "A-14", "A Gate"]
  environment: "ENV-LOCAL"
  regression_suite: "tests.tooling.test_a03_onboarding + tests.tooling.test_a02_tokens + tests.tooling.test_project_progress + tests.tooling.test_g07_baseline + tests.tooling.test_phase_g_gate"
  evidence_manifest_required: true
  blocking_defect_policy: "CRITICAL 또는 blocking MAJOR 1건 이상이면 ACCEPTED 금지"
  immediate_stop_conditions:
    - "기능 범위·요구사항·중요 위험 변경 필요"
    - "DIR-1·DIR-2·DIR-3·DIR-X 도달"
    - "권위 문서 semantic drift 또는 승인 계보 불일치"
    - "secret 또는 unauthorized path write 발견"
```

## 완료·보고

Developer는 exact diff, RED→GREEN 명령·결과, hostile reason code, manifest raw/target, 미실행 runtime, predecessor 불변, rollback을 CompletionReport에 기록하고 `COMPLETED_PENDING_INDEPENDENT_TEST`로 제출한다. Main은 leases를 회수하고 `TEST_REVIEW`로 전환한다.

Tester는 구현 대화와 분리해 catalog·문서·SVG·manifest, independent hostile mutations, read-only preservation과 static/runtime qualifier를 재검증한다. blocking defect 0이면 `PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`를 기록한다. Main 수락 전 A-04 시작을 금지한다.

기능 범위·요구사항·중요 위험 변경과 DIR 도달이 없으므로 routine 진행은 신산님에게 보고하지 않는다.
