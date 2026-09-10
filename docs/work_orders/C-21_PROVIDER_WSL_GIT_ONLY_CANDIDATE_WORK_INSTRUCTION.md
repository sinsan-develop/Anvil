# C-21 Provider WSL Git-only Candidate WorkInstruction

- Artifact ID: `WI-C-21-PROVIDER-WSL-GIT-ONLY-CANDIDATE-20260906-001`
- Executor: `developer-primary`
- Dispatch base/source: `e4cccf3ce99e29005103cea3bd76fa0eede36f28`
- Predecessor remote control: `772afbd5eb55791ca7b5002d58378437ea496750`
- Candidate ref: `refs/remotes/origin/candidates/c21-wsl-exact107`
- Result state at dispatch: `IN_PROGRESS`

## 목적

이 WorkInstruction을 포함하는 Stage S direct-child source를 C-21 Provider WSL Git-only candidate로 결박한다. 다음 Developer는 아래 K exact12 안에서만 candidate manifest·guard·검증·governance 기록을 갱신한다.

## source 및 candidate 계약

1. Stage S source는 dispatch base의 single direct-child exact10 commit이어야 한다.
2. source cumulative exact107은 path-list SHA-256 `E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70`이다.
3. candidate ref는 정확히 `refs/remotes/origin/candidates/c21-wsl-exact107`만 사용한다.
4. predecessor remote control `772afbd5eb55791ca7b5002d58378437ea496750`과 source commit을 혼동하지 않는다.
5. K 완료 후 cumulative exact109 path-list SHA-256은 `16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E`여야 한다.

## K write lease exact12

- `deploy/wsl/CandidateReleaseManifest.json`
- `deploy/wsl/candidate-manifest-guard.sh`
- `docs/DEVELOPMENT_ENVIRONMENT.md`
- `docs/WORK_STATUS.md`
- `docs/evidence/manifests/C-21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_MANIFEST.json`
- `docs/progress/BUILD_HANDOFF.md`
- `docs/progress/build-progress.json`
- `docs/progress/progress-events.json`
- `docs/progress/progress-handoff-detached-digest-c21-provider-wsl-git-only-candidate-bound.json`
- `scripts/check_project_progress.py`
- `tests/deploy/test_wsl_staging_harness.py`
- `tests/tooling/test_project_progress.py`

Path-list SHA-256: `6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765`.

## 금지선과 완료 계약

- Stage S에서는 commit, push, WSL, Docker, DB, Provider, Telegram, ysna, main을 실행하지 않는다.
- Developer는 K exact12 밖의 제품·historical evidence·seq1~527을 수정하지 않는다.
- 실제 외부 실행을 로컬·Git-only 검증 PASS로 승격하지 않는다.
- TDD와 exact path/direct-child/clean-dirty 검증을 기록하고 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다.

