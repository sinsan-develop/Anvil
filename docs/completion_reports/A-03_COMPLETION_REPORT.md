# A-03 CompletionReport

## 판정

`COMPLETED_PENDING_INDEPENDENT_TEST`

## 판단 이유

- Work Package: `A-03`
- WI SHA-256: `E85FD1D62A70C77E2A4A87AAFA9B727B94CBF428BAA52736975B1FEA572C079F`
- 시작 HEAD/branch: `dc2ba63e1d923663724d1291cbcec007e4e7e7fe` / `main`
- 시작 upstream: `origin/main = dc2ba63e1d923663724d1291cbcec007e4e7e7fe`
- 시작 Git 상태: clean
- worker lease/token: `worker-lease-a03-20260811-001` / `a03-execution-fence-epoch-1-39af6aa`
- write lease/token: `write-lease-a03-20260811-001` / `a03-write-fence-epoch-1-39af6aa`
- A-02 token catalog SHA-256: `1709D227BB9C44480085CB10B53881B1613AED914F868B629F8B2C3D03D23207`
- authority hashes는 WI의 design/work plan/matrix/test plan/operating rules 값과 일치했다.

Project Dashboard, Project Register, Repository Onboarding, Onboarding Review, Project Detail의 field/state/action 계약과 1920×1080 정적 render를 단일 catalog에 결박했다. dirty와 untracked를 분리하고 user-owned source 보존, read-only scan, policy/protected path, permission, error, deep-link, static/runtime 경계를 fail-closed로 검증한다.

## 변경 경로

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

Main 전용 progress/WI/authority/A-01/A-02와 `apps/**`, `packages/**`, dependency/lock/config는 수정하지 않았다.

## RED → GREEN

- RED: focused unittest exit `1`, 필수 8산출물 missing 1 failure를 실제 관찰했다.
- 확장 RED: docs/renders/manifest missing과 mutation executor 오류를 구분했다.
- root cause: mutation dict path replace가 list index 분기를 공유함.
- 최소 수정 뒤 catalog/docs/renders/28 hostile mutation targeted suite: `7/7 PASS`, exit `0`.
- manifest 제외 checker: `PASS`, errors `0`, exit `0`.
- manifest 포함 full A-03 suite: `9/9 PASS`, exit `0`.
- A-03 checker JSON: `PASS`, errors `0`, exit `0`.
- 첫 manifest target mismatch는 serializer 차이로 root cause를 확인하고 checker의 Python canonical bytes로 재계산했다.
- 통합 회귀 `tests.tooling.test_a03_onboarding + test_a02_tokens + test_project_progress + test_g07_baseline + test_phase_g_gate`: `Ran 82`, exit `1`, failure `3`.
- 회귀 실패 2건은 Developer 제품 diff가 존재하는 동안 Main start-only allowlist가 내는 `GIT_DESCENDANT_WORKTREE_DIRTY`; 나머지 1건은 start projection test가 과거 upstream `39af6aa...`를 기대하지만 실제 clean dispatch/current upstream은 `dc2ba63...`인 Main projection 차이다. A-03 제품 계약 실패로 승격하지 않으며 Main completion projection에서 재실행해야 한다.
- CLI: A-03 `PASS`, A-02 `PASS`, G-07 `PASS`, Phase-G `PASS`; project-progress만 동일한 `GIT_DESCENDANT_WORKTREE_DIRTY`로 exit `1`.
- 이 CompletionReport 변경을 포함해 manifest를 재생성한 뒤 A-03 focused suite와 checker를 fresh 재실행한다.

## evidence

- manifest: `docs/evidence/manifests/A-03_EVIDENCE_MANIFEST.json`
- algorithm: `SHA256(canonical JSON of sorted [{path,sha256}] raw_artifacts)`
- self-reference: false
- raw/target/delivered는 manifest byte-bound 값으로 고정한다.

## 기존 기능 유지와 잔여 위험

- A-02 accepted token catalog는 hash까지 검증했으며 수정하지 않았다.
- source scan/rescan에서 write/install/format/Git mutation/cleanup은 모두 금지한다.
- `STATIC_ONLY / E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- Browser/Playwright/API/DB/Event/Network/Docker/WSL/server/deploy/release: `NOT_EXECUTED`
- 독립 Tester PASS와 Main ACCEPTED 전 A-03 ACCEPTED 또는 A-04 시작을 주장하지 않는다.
- 기능 범위·요구사항·중요 위험 변경 없음. DIR 미도달.

## rollback

Main이 아직 commit하지 않은 위 A-03 Developer 제품 경로만 제거하면 된다. Developer는 rollback, commit, push를 수행하지 않는다. predecessor와 progress/history는 rollback 대상이 아니다.

## 조치

manifest와 fresh verification을 동결한 뒤 Main에게 lease 회수, `TEST_REVIEW` projection, 독립 Tester 진입을 이관한다.
