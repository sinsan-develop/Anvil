# A-03 Onboarding Validation

## 판정

`STATIC_CONTRACT_GREEN`

## TDD 증거

### RED

명령:

`C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a03_onboarding`

- exit: `1`
- result: `FAILED (failures=1)`
- 관찰: catalog, Markdown 3개, SVG 3개, checker 등 필수 8개 산출물이 없어서 presence test가 예상대로 실패했다.

### 계약 확장 RED

같은 targeted suite를 확장한 뒤 문서·render·manifest가 없는 상태와 mutation executor 결함을 각각 `DOCUMENT_MISSING`, `STATIC_RENDER_MISSING`, `EVIDENCE_MANIFEST_MISSING_OR_INVALID`, `MUTATION_FIXTURE_INVALID`로 재현했다. mutation 결함의 root cause는 dict path replace에서 list index 분기를 잘못 적용한 것이며, 분기별 최소 수정을 적용했다.

### 부분 GREEN

명령:

`C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_catalog_and_a02_predecessor_are_exact tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_five_screens_keep_dirty_and_untracked_separate tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_read_only_scan_and_fail_closed_states_forbid_mutation tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_errors_permissions_dashboard_and_deep_links_are_bound tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_documents_and_three_renders_are_semantically_bound tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_hostile_mutations_all_emit_declared_stable_reason tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_runtime_pass_and_static_qualifier_forgery_are_rejected`

- exit: `0`
- result: `Ran 7 tests / OK`

명령:

`C:\Users\cyhuh\anaconda3\python.exe scripts\check_a03_onboarding.py --without-manifest --json`

- exit: `0`
- result: `PASS`, errors `[]`

## hostile coverage

- catalog mutations: `28`
- stable reason families: screen/field/state/source condition/reason/error/preservation/permission/dashboard/deep-link/transition/matrix/verification
- dirty/untracked/NON_GIT/UNKNOWN fail-open, source write/install/format/Git mutation/cleanup, credential literal, view/manage merge, missing cards, SKIPPED success counting, runtime PASS 위조를 거부한다.

## 검증 경계

- Package: `STATIC_ONLY / STATIC_CONTRACT_PASS`
- assigned: `AV-UI-003`, `AV-UI-004`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`
- Browser, Playwright, API, DB, Event, Network, Docker, WSL, server, deploy, release: `NOT_EXECUTED`

## manifest 포함 GREEN

- `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a03_onboarding` → exit `0`, `Ran 9 tests / OK`
- `C:\Users\cyhuh\anaconda3\python.exe scripts\check_a03_onboarding.py --json` → exit `0`, `PASS`, errors `[]`
- 첫 manifest target mismatch는 PowerShell과 Python canonical JSON serializer의 byte 차이가 원인이었다. checker의 Python canonicalization으로 target을 재계산해 단일 값으로 교정했다.

이 기록을 raw artifact로 다시 동결한 후 동일 full suite와 regression을 fresh 재실행한다.
