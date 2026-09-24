# F-18 이후 로컬·WSL-server 보안 수정분 통합 실행계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task by task. Each code step uses RED→GREEN and the exact published Git commit is tested on WSL-server before evidence-only finalization.

**Goal:** 이미 검증한 로컬 Provider/보안 수정분을 F-18 전체 인수 및 F-19 정식 인수와 혼동하지 않고 단일 PR로 main에 통합한다.

**Architecture:** F-18의 `accepted=false`, Production `NOT_EXECUTED`, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`는 유지한다. 기존 F-18 merged main `e2f3d994b95c2e60f6a3e597101c30daa25089b4`에서 갈라진 정확한 `codex/f19-test-dependency` 변경 범위와 WSL-server 시험 commit을 새 fail-closed G-05 mode로 결박한다. 병합 main은 정확한 첫 부모와 작업 HEAD를 두 번째 부모로 갖는 2-parent merge 및 동일 tree만 허용한다.

**Tech Stack:** Python 3.12/3.13, pytest, uv, Git, SSH alias `development`/`WSL-server`.

**Spec:** 신산님의 최신 직접 지시(로컬 개발→Git push→WSL-server Git pull·테스트, 운영·`ysna-server` 제외), `Anvil_작업계획서_v1.md` F-18/F-19, `docs/04_test_reports/F-19_LOCAL_PROVIDER_SECURITY_PRECHECK_REPORT.md`.

## Global Constraints

- F-18 전체 `accepted=false`, Production `NOT_EXECUTED`, F-19 정식 `BLOCKED_PENDING_F18_ACCEPTANCE`를 변경하지 않는다.
- `main` 직접 개발·커밋 금지. 현재 단일 작업 브랜치에서 마치고 병합·삭제 전 새 브랜치 금지.
- 제품 변경은 `pyproject.toml`, `uv.lock`, `packages/provider_catalog/service.py`만; 나머지는 한정 control/test/evidence 경로만 허용한다.
- WSL-server에는 로컬 push한 정확한 commit을 Git으로 받아 시험하고 임시 checkout/venv를 제거한다. 로컬 WSL·운영 서버·기존 서비스/DB는 사용하지 않는다.
- G-05의 기존 F-18 모드는 그대로 유효해야 한다. 새 모드는 exact base, branch/upstream/remote HEAD, 변경 경로, QA SHA, evidence-only 후속 변경, merge 부모/tree를 모두 검증한다.

## Review Focus

- 원격 main이 `e2f3d99` 이후 이동한 경우: 새 mode가 첫 부모 불일치를 거부한다.
- 병합 tree가 작업 branch tree와 다른 경우: 새 mode가 거부한다.
- WSL QA SHA 이후 제품 코드·테스트가 바뀐 경우: 새 mode가 거부한다.
- F-18/F-19의 전체 accepted를 true로 만들거나 Production PASS를 기록한 경우: 새 state validator가 거부한다.
- 변경 경로 밖의 파일이 브랜치 또는 병합 결과에 섞인 경우: 새 mode가 거부한다.

## Task 1: fail-closed 후속 통합 Git 계약

**Files:** `scripts/f18_progress_overlay.py`, `tests/tooling/test_f18_progress_overlay.py`, `docs/work_orders/F-18_F-19_LOCAL_INTEGRATION_PLAN.md`.

**Interfaces:** `validate_start_git_facts`는 기존 F-18 기본값을 유지하고 새 mode의 `expected_branch`, `required_control_paths`, `post_qa_allowed_paths`를 받는다. `collect_git`은 progress mode에 따라 F-18 또는 후속 통합 기준을 선택한다.

- [ ] 새 mode 순수 계약 테스트와 실제 임시 Git graph 테스트를 먼저 추가하고 예상한 `F18_LOCAL_START_GIT_INVALID` RED를 관측한다.
- [ ] 정확한 base/branch/scope/QA/merge 부모·tree 조건만 허용하는 최소 구현을 한다. 기존 F-18 graph 테스트를 함께 GREEN으로 만든다.
- [ ] `tests/tooling/test_f18_progress_overlay.py`와 `git diff --check`를 실행하고 결과를 기록한다.

## Task 2: 정본 상태·이벤트·checksum 결박

**Files:** `scripts/f18_progress_overlay.py`, `tests/tooling/test_f18_progress_overlay.py`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/progress-handoff-detached-digest-f18-local.json`, `docs/evidence/manifests/F-18_LOCAL_START_MANIFEST.json`, `docs/WORK_STATUS.md`, `docs/04_test_reports/F-19_LOCAL_PROVIDER_SECURITY_PRECHECK_REPORT.md`.

**Interfaces:** 새 projection mode는 event sequence 1511의 로컬 통합 checkpoint이며 F-18/F-19 전체 판정을 유지한다. 게시된 WSL QA SHA를 `repository.local_wsl_qa_head`로 결박하고 이후 evidence-only diff만 허용한다.

- [ ] F-18 accepted/Production/F-19 상태 변조 거부와 checksum 불일치 거부 테스트를 RED로 추가한다.
- [ ] 안전한 event append 및 progress/HANDOFF/digest/manifest 재생성 경로를 구현한다. 최초 code checkpoint는 로컬 관련 회귀와 G-05 단위 계약 통과 후 push한다.
- [ ] WSL-server 격리 QA에서 정확한 code checkpoint를 Git 수신해 동일 회귀·G-05 단위 계약을 실행한다. 임시 자원을 exact 검증 뒤 정리한다.
- [ ] QA SHA를 기록하고 evidence-only commit을 push해 현재 브랜치 G-05 PASS를 확인한다. 전체 F-18/F-19 합격은 계속 false/blocked다.

## Task 3: 독립 검토·PR·병합·정리

**Files:** 위 두 Task의 변경 파일만.

- [ ] 변경 diff·테스트·WSL 증거와 위험을 독립적으로 재검토하고 Critical/Important 0을 확인한다.
- [ ] `development/main`이 정확한 base인지 재확인한다. PR Broker 요청 tag를 main SHA에 생성·push한다. PR 목적/변경/영향/검증/미검증/rollback을 보고서와 PR에 남긴다.
- [ ] 병합 main의 feature ancestry, 2-parent, 첫 부모, tree, G-05, 관련 테스트를 확인한다.
- [ ] 원격 branch 삭제와 로컬 clean 상태·복구 ref를 확인한 뒤 작업 branch/worktree를 삭제한다. F-18/F-19 전체 인수·운영 검증은 미실행으로 남긴다.
