# A-03 Repository Onboarding 정적 계약

contract_screen_id: `REPOSITORY_ONBOARDING`

이 문서는 `STATIC_ONLY / STATIC_CONTRACT_PASS` 계약이다. canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 증거는 `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`다.

## read-only 8단계 scan

QUEUED → `SCANNING_READ_ONLY`에서 PATH_POLICY, GIT_STATUS, MANIFESTS, TOOLCHAIN, FILE_CLASSIFICATION, PROJECT_RULES, PROTECTED_PATHS, PROFILE 순으로 확인한다. `source write forbidden`, `install forbidden`, `format forbidden`, `Git mutation forbidden`, `automatic cleanup forbidden`이다. mutation_count는 반드시 0이어야 한다.

tracked 상태는 `tracked_dirty`, `tracked_dirty_count`, tracked_dirty_paths로, untracked 상태는 `untracked_count`, untracked_paths로 분리한다. `user-owned` source는 원본 그대로 보존하며 dirty/untracked/NON_GIT/UNKNOWN은 REVIEW_REQUIRED다. 자동 CLEAN·READY·PASS 승격을 금지한다.

`ROOT_OUTSIDE_ALLOWED`, PATH_NOT_FOUND, PERMISSION_DENIED, NON_GIT_REVIEW_REQUIRED, DIRTY_TRACKED_PRESENT, UNTRACKED_PRESENT, BASELINE_CONFLICT, PROTECTED_PATH_POLICY_INVALID, `SCAN_MUTATION_DETECTED`는 reason과 next_action을 가진다. outside-root·permission·mutation은 BLOCKED다.

review는 project_rules, `protected_paths`, `allowed_environments`, baseline_id, baseline_branch, baseline_commit, dirty/untracked, evidence_link, isolation_status를 확인한다. Project Detail은 Overview, Repositories, Baselines, Rules, Toolchain, Environments, Members tab과 read-only rescan을 제공한다. rescan은 새 profile/baseline candidate만 만들고 원본을 변경하지 않는다.

설명은 `i-icon`의 `tooltip` 또는 `popover`로 열고 `reason`과 `next_action`을 포함한다. 상태는 icon + status_label + short_description으로 표시한다.
