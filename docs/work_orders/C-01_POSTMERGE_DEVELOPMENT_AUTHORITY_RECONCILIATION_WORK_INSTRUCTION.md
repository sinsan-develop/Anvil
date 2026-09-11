# C-01 Post-merge Development Authority Reconciliation WorkInstruction

- Work Package: `C-01`
- Step: `POSTMERGE-DEVELOPMENT-AUTHORITY-RECONCILIATION`
- Executor: `developer-primary`
- Baseline: `b0e70278d3799860beb1eef94c382def53a45057`
- Status: `ACTIVE`

## 목적

PR #2로 C-01 final record가 development `main`에 정상 병합됐지만 seq727 checker가 R5 staged/direct-child 상태만 허용하여 병합된 main을 거부하는 결함을 append-only seq728 successor로 교정한다. 개발 정본은 `git@github-sinsan-develop:sinsan-develop/Anvil.git`의 `main`이며, 병합된 R5 ref는 merged-main smoke가 통과한 뒤에만 정리한다.

## 불변 경계

- seq1~727 event object bytes와 historical evidence를 변경하지 않는다.
- C-01 `ACCEPTED`, C-02 `READY_NOT_STARTED`, active lease 없음 상태를 유지한다.
- Provider와 Telegram 실제 외부 검증은 `USER_OWNED_NOT_EXECUTED`로 유지한다.
- 제품 코드, WSL runtime, Docker, DB, Secret, 배포, Provider, Telegram을 변경하거나 호출하지 않는다.
- 구현 단계에서 push, PR, merge, branch 삭제를 실행하지 않는다.

## 기준 계보

- baseline merge: `b0e70278d3799860beb1eef94c382def53a45057`
- baseline parents: `e215c0612363050dbe20315646f1612f31b8cdc0`, `5d4a78555110dee16fce01e512a367524ba1eeec`
- final record: `5d4a78555110dee16fce01e512a367524ba1eeec`
- formal control: `2eba71ec37183ef6062157d7491ee48cb1fab6ba`
- product: `bb2ff4374c81865cab127eca14d3d4c9de575465`
- development remote: `git@github-sinsan-develop:sinsan-develop/Anvil.git`
- development main ref: `refs/remotes/development/main`

## exact12

1. `docs/04_test_reports/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_RESULT.md`
2. `docs/WORK_STATUS.md`
3. `docs/evidence/manifests/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_MANIFEST.json`
4. `docs/progress/BUILD_HANDOFF.md`
5. `docs/progress/build-progress.json`
6. `docs/progress/progress-events.json`
7. `docs/progress/progress-handoff-detached-digest-c01-postmerge-development-authority-reconciliation.json`
8. `docs/validation/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_VALIDATION.md`
9. `docs/work_orders/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_INVOCATION_PROMPT.md`
10. `docs/work_orders/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_WORK_INSTRUCTION.md`
11. `scripts/check_project_progress.py`
12. `tests/tooling/test_project_progress.py`

## 구현·검증

- seq728 event type은 canonical `REPOSITORY_RECONCILED`, decision/status는 `DEVELOPMENT_MAIN_AUTHORITY_RECONCILED`다.
- seq1~727 raw event object prefix를 baseline merge에서 exact 보존한다.
- baseline merge parent 순서, final record→control→product parent와 ancestor chain을 검증한다.
- 다음 Git 상태만 허용한다.
  - precommit: branch는 exact `codex/c01-postmerge-authority-reconcile-r1`, HEAD와 `refs/remotes/development/main`은 exact baseline `b0e70278d3799860beb1eef94c382def53a45057`, upstream은 없음 또는 `development/codex/c01-postmerge-authority-reconcile-r1`, exact12는 전부 staged, unstaged/untracked는 0이며 cached diff-check가 통과해야 한다.
  - postcommit: branch는 exact `codex/c01-postmerge-authority-reconcile-r1`, upstream은 없음 또는 `development/codex/c01-postmerge-authority-reconcile-r1`, `refs/remotes/development/main`은 baseline을 유지한다. reviewed postcommit은 baseline만을 sole parent로 갖고 baseline 대비 diff가 exact12이며 worktree clean과 range diff-check를 충족해야 한다.
  - development-main merge: branch는 `main`, upstream은 exact `development/main`, HEAD는 exact `refs/remotes/development/main`이어야 한다. ordered parents는 exact `[baseline b0e70278d3799860beb1eef94c382def53a45057, reviewed postcommit]`이며 reviewed postcommit은 baseline sole child이고 그 diff는 exact12여야 한다. baseline 대비 merge diff도 exact12이고 `git diff --quiet <reviewed-postcommit> <merge>`로 두 tree가 동일하며 worktree clean과 두 range diff-check를 모두 충족해야 한다.
  - detached merged-main smoke: branch는 빈 문자열, upstream은 없음, HEAD는 exact `refs/remotes/development/main`이어야 한다. ordered merge parents, reviewed postcommit sole-parent와 exact12 diff, baseline 대비 merge exact12 diff, postcommit/merge tree equality, worktree clean과 두 range diff-check를 development-main merge와 동일하게 모두 충족해야 한다.
- development 원격 URL/ref, branch/upstream, exact12, diff-check를 fail-closed로 검증한다.
- 삭제된 R5 ref 존재를 요구하지 않는다.
- TDD RED, focused GREEN, 전체 tooling, live checker와 독립 review를 수행한다.

## 완료 조건

- exact12 외 경로 변경 0
- seq1~727·historical evidence mutation 0
- precommit/postcommit/merged-main acceptance와 parent/path/dirty/upstream/remote 변조 거부 계약 통과
- 전체 tooling 및 checker PASS
- 독립 Reviewer `C0/I0/M0`
