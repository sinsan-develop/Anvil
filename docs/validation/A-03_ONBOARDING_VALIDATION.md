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

## Revision 2 — A03-TST-BLK-001

- source TestReport: `DD89EB18AB4F16FB46C752734870DBC125D11AC38512EC1F79B25D47EEDC00D6`
- R2 WI: `6FBED907089748236B8CF7FA119E517EFB55CA92A693738F0BB20A93781C35ED`
- RED: operational field 3종을 검사하는 3개 test를 실행해 `7 failures`, exit `1`을 관찰했다. catalog field 누락 1건, 문서/SVG 누락 subtest 3건, checker stable reason fail-open subtest 3건이다.
- root cause: catalog와 checker가 동일한 불완전한 7-field 집합을 정본으로 삼아 승인 spec의 `environment`, `backend_policy_profile`, `operational_environment_connection_state`를 모두 놓쳤다.
- 최소 GREEN: 세 field를 catalog·registration doc·onboarding SVG·checker·test에 동일 이름으로 결박하고, field 제거 3건을 `PROJECT_REGISTER_OPERATIONAL_FIELD_MISMATCH`로 거부한다.
- hostile catalog는 M29~M31을 추가해 총 31건이다.
- A03-TST-BLK-002 제품 변경 없음. Main projection의 historical base/current upstream 분리 회귀를 fresh 확인한다.
- R1 manifest와 Tester report는 byte immutable predecessor로 유지한다.

### Revision 2 pre-freeze 검증

- focused: `13/13 PASS`, exit `0`; A-03 checker `PASS`, errors `[]`, exit `0`.
- required integration 첫 실행은 60초 제한에서 timeout되어 결과로 승격하지 않았다.
- 동일 명령 재실행: `Ran 88 tests`, failures `4`, exit `1`.
- 네 실패는 project-progress bundle의 `GIT_DESCENDANT_WORKTREE_DIRTY`와 `PRG_REFERENCED_HASH_MISMATCH` 조합이다. 전자는 commit 전 Developer product diff, 후자는 progress가 R1 CompletionReport hash를 참조하는 동안 R2 기록으로 현재 파일 hash가 달라진 Main projection 이전 상태다. Main completion projection 후 재실행해야 한다.
- A03-TST-BLK-002 전용 successor test `test_a03_completion_history_and_current_upstream_are_separate`: `1/1 PASS`, exit `0`. historical completion base와 current upstream이 분리됐다.

### Revision 2 post-freeze 재검증

- A-03 focused `13/13 PASS`, A-02 `10/10 PASS`, A-03/G-07/Phase-G checker PASS, JSON 4개·SVG 1개 parse PASS, `git diff --check` PASS.
- project checker만 `GIT_DESCENDANT_WORKTREE_DIRTY`, `PRG_REFERENCED_HASH_MISMATCH`로 exit `1`.
- full integration 재실행: `Ran 88 tests in 76.312s`, failures `4`, exit `1`; 네 실패는 모두 위 두 Main projection reason의 동일 집합이다.
- 제품 finding인 A03-TST-BLK-001과 Main successor test인 A03-TST-BLK-002에는 남은 focused failure가 없다. 전체 exit 0 판정은 Main completion projection 뒤에만 가능하다.
