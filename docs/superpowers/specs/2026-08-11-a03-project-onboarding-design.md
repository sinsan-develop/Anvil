# A-03 Project Dashboard·Repository Onboarding 설계

## 목적과 범위

A-03은 Project 등록부터 Repository read-only scan, baseline·dirty/untracked·policy·protected path 검토, Dashboard 상태 확인까지의 정적 화면·field·state 계약을 확정한다. 제품 UI·API·DB·scanner runtime은 구현하지 않는다.

A-03 역색인은 `AV-UI-003`, `AV-UI-004`지만 canonical runtime owner는 각각 F-01/F-12/F Gate와 A-14/A Gate다. 따라서 A-03 판정은 `STATIC_CONTRACT_PASS / L7_RUNTIME_DEFERRED_NOT_EXECUTED`이며, 정적 render를 L7 사용자 인수나 실제 E-SHOT PASS로 승격하지 않는다.

## 접근 비교와 선택

1. **Catalog + 3개 focused screen contract + 3개 static render — 선택**
   - field/state/guard를 기계 검증할 수 있고 정상·경고·차단을 분리한다.
2. 단일 대형 wireframe
   - 보기 쉽지만 상태·전이·필수 field 누락을 fail-closed 검증하기 어렵다.
3. 클릭형 runtime prototype
   - 실제 상호작용은 보여주지만 A-14와 F-01 책임을 선점한다.

## 화면 구성

### Project Dashboard

- 상단 filter: Project, Environment, 오늘/7일/30일, 새로고침 시각
- Health: Database, Queue, Worker, LLM Providers, Execution Backends, Artifact Store
- 각 Health card: icon, 상태명, 짧은 설명, 마지막 점검 시각, 오류 수, 상세 link
- 운영 card: 실행 중, 승인 대기, BLOCKED, 필수 Gate 미통과, 예상 비용 초과, baseline 충돌
- Next Actions: 우선순위, 대상, 이유, 경과시간, 이동 action
- Critical Alerts: code, source, 발생시각, 담당자, 확인 action
- 성공률에는 기간·표본 수·PASS/SKIPPED 구성을 함께 표시한다.

### Project Registration

- project name
- repository source: local path 또는 remote URL
- canonical root path
- default branch
- environment
- backend/policy profile
- 운영환경 연결 상태
- `Repository 검사`는 read-only scan만 시작하며 등록 완료를 의미하지 않는다.

### Repository Onboarding

다음 field를 한 화면의 progressive disclosure로 확인한다.

- repository kind: GIT / NON_GIT / UNKNOWN
- canonical root, remote, branch, HEAD, baseline commit
- tracked dirty count·paths, untracked count·paths
- manifest, language, framework, package manager, runtime
- build/test/lint/typecheck/deploy command discovery
- source/test/config/deploy file classification
- Project Rules와 protected paths
- secret candidate와 masking 대상
- scan step, last scan time, mutation count

### Onboarding Review·Project Detail

- review 확정 대상: default branch, Project Rules, protected paths, allowed environments
- baseline summary: baseline ID, branch, commit SHA, tracked dirty 여부·개수, untracked 개수, 생성 시각, profile/evidence link, isolation status
- Project Detail tab: Overview, Repositories, Baselines, Rules, Toolchain, Environments, Members
- repository card: remote/local, branch/commit, dirty/untracked, last scan, language/framework, build/test status, read-only rescan
- tracked dirty와 untracked를 단일 `changes` 수치로 합치지 않는다.

## 상태·전이 계약

상태는 `icon + label + short description`으로 표현한다.

- `NOT_STARTED`: 경로 입력 전
- `PATH_VALIDATING`: canonical root·allowed root·권한 확인
- `SCANNING_READ_ONLY`: Git/status/manifest/toolchain/rule 탐지, 파일 mutation 금지
- `REVIEW_REQUIRED`: dirty/untracked, NON_GIT 또는 불확실성 검토 필요
- `BLOCKED`: allowed root 이탈, 경로 없음, 권한 거부, protected policy 결함
- `READY_TO_REGISTER`: scan 완료·필수 검토 완료·mutation 0
- `REGISTERED`: Project Profile artifact 저장 완료

reason code는 최소 `ROOT_OUTSIDE_ALLOWED`, `PATH_NOT_FOUND`, `PERMISSION_DENIED`, `NON_GIT_REVIEW_REQUIRED`, `DIRTY_TRACKED_PRESENT`, `UNTRACKED_PRESENT`, `BASELINE_CONFLICT`, `PROTECTED_PATH_POLICY_INVALID`, `SCAN_MUTATION_DETECTED`를 포함한다.

등록 error는 `409 PROJECT_SLUG_EXISTS`, `403 REPOSITORY_PATH_DENIED`, `422 REPOSITORY_NOT_FOUND`를 서로 다른 field/global reason과 next action으로 표시한다. 권한은 Project view와 Project/Repository manage를 구분하며, unauthorized 사용자는 edit·확정 action을 비활성화하고 이유를 확인할 수 있어야 한다. credential·secret은 literal로 표시하지 않고 reference/masked 형태만 허용한다.

dirty/untracked는 자동 정리·이동·삭제하지 않는다. `clean repository`, `dirty tracked`, `untracked 포함`, `Git이 아닌 경로`, `allowed root 밖`, `scan mutation`을 서로 다른 상태와 다음 안전 action으로 표현한다.

## A-02 token binding

- viewport 1920×1080, body/form 12px
- A-02 typography/layout/semantic color role만 사용
- 설명은 i icon의 tooltip/popover로 제공하고 reason·next action을 포함
- 상시 설명 box와 color-only 상태를 금지
- three static renders는 `E-SHOT_STATIC_NOT_RUNTIME_UI` 캡션을 가진다.

## 산출물

- `docs/architecture/a03/A-03_ONBOARDING_CATALOG.json`
- `docs/architecture/a03/A-03_PROJECT_DASHBOARD.md`
- `docs/architecture/a03/A-03_PROJECT_REGISTRATION.md`
- `docs/architecture/a03/A-03_REPOSITORY_ONBOARDING.md`
- `docs/architecture/a03/A-03_DASHBOARD_STATIC_RENDER.svg`
- `docs/architecture/a03/A-03_ONBOARDING_STATIC_RENDER.svg`
- `docs/architecture/a03/A-03_REPOSITORY_STATE_STATIC_RENDER.svg`
- `scripts/check_a03_onboarding.py`
- `tests/tooling/test_a03_onboarding.py`
- `tests/fixtures/a03/{canonical-contract,mutation-catalog}.json`
- validation, EvidenceManifest, CompletionReport

## 적대 검증

validator는 다음을 stable reason code로 거부한다.

- baseline, dirty, untracked, policy, protected path field 누락·swap
- dirty/untracked를 clean으로 표시하거나 자동 cleanup action 제공
- NON_GIT·outside-root·permission·mutation을 READY/PASS로 승격
- scan step 중 source file mutation 허용
- protected path 상세·reason·next action 누락
- local/git source conditional field 위반, 409/403/422 병합·누락
- credential·secret 또는 무권한 local path 원문 노출
- Project view와 manage capability 혼합
- Health 필수 6종 또는 운영 card 필수 6종 누락
- 표본 수 없는 성공률, SKIPPED의 성공 포함, 원인으로 연결되지 않는 경고
- A-02 token drift, persistent help box, color-only status
- catalog·Markdown·SVG semantic binding drift
- static qualifier 제거 또는 L7/runtime PASS 위조
- AV owner/level/method/evidence/severity drift

## 안전·범위

허용 범위는 A-03 architecture, 전용 checker/test/fixture, validation/evidence/completion, Main의 WorkInstruction/Invocation/progress다. `apps/**`, `packages/**`, 실제 scanner·API·DB·browser·Playwright·dependency·server·deploy와 기존 accepted A-01/A-02 evidence는 수정하지 않는다.

기능 범위·요구사항·중요 위험 변경은 없다. DIR-1은 A-15 뒤이므로 A-03에서 도달하지 않는다.
