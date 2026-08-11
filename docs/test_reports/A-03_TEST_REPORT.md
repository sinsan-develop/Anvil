# A-03 독립 Tester 보고서

## 판정

`FAILURE_REPORT / REWORK_REQUIRED`

- package 판정: `STATIC_CONTRACT_REWORK_REQUIRED`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- Main acceptance: 금지
- A-04: `BLOCKED_PENDING_A03_ACCEPTANCE`
- blocking defect: 2건
- 기능 범위·요구사항·중요 위험 변경: 없음
- DIR-1·DIR-X: 미도달

## 판단 이유

dirty/untracked 분리, source 보존, read-only scan, 권한·masking, Dashboard 6+6 card, 기간·표본·PASS/SKIPPED, deep link, A-02 token, static/runtime qualifier와 두 manifest의 byte binding은 현재 입력에서 일치한다. 그러나 Project Register의 승인 계약에 있는 `environment`, `backend/policy profile`이 catalog·문서·SVG·checker·test에서 함께 빠져 있고 checker는 이 불완전한 자기 기대값을 PASS한다. 또한 WorkInstruction이 요구한 회귀 suite는 현재 clean/pushed HEAD에서 1건이 반복 실패한다. blocking MAJOR 2건이므로 A-03을 합격시킬 수 없다.

## 기준 binding과 독립 hash

| artifact | SHA-256 |
|---|---|
| 설계서 | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| 작업계획서 | `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A` |
| 통합검증매트릭스 | `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A` |
| 테스트계획서 | `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8` |
| 운영규칙 | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| A-03 WorkInstruction | `E85FD1D62A70C77E2A4A87AAFA9B727B94CBF428BAA52736975B1FEA572C079F` |
| Developer manifest | `9C3E9C70B61C7D477736B15502F5F3061493A5C8718F26D0B091FE23CB66F1CC` |
| Main completion progress manifest | `9C7319A06605598243C3E9D03E278AB8293683341A1261A090540EB6B1B806D5` |

- 검증 기준 Git: `main = origin/main = f8b52a5a3b3acfa2776b06bd178e0911c1ead582`, worktree clean.
- Developer manifest 독립 재계산: raw hash 오류 0, target/delivered `18DED6D1F1034044F7A8B55864AF35F507789BF08FE9B60C70806A6C190093CA`, canonical 2,018 bytes, self path 없음.
- Main completion manifest 독립 재계산: raw hash/bytes 오류 0, target/delivered `sha256:F3594818865DD544CD8C25F1891A631DCA460756484C340EF9917EF471514BF9`, canonical 630 bytes, self path 없음.
- `dc2ba63e...HEAD` 변경은 completion manifest의 exact 25-path와 일치하고 A-01/A-02 predecessor 경로 변경은 없다. `git diff --check`는 exit 0이다.

## 검증 결과

| 검증 대상 | 결과 | 증거 |
|---|---|---|
| `AV-UI-003` A-03 정적 slice | FAIL | Project Register 필수 운영 field 계약 누락 |
| `AV-UI-004` A-03 정적 slice | FAIL | 동일 누락으로 전체 onboarding 설명 계약 불완전 |
| dirty/untracked·baseline·policy·protected path | PASS | catalog·문서·SVG 및 28 mutation 재검증 |
| source 보존·read-only·권한·masking | PASS | stable reason code mutation 및 exact contract |
| Dashboard 6+6·sample/PASS-SKIPPED·deep link | PASS | catalog·문서·SVG·checker |
| A-02 token·설명 interface | PASS | predecessor SHA와 exact presentation binding |
| static qualifier/runtime owner | PASS | `STATIC_ONLY`, `E-SHOT_STATIC_NOT_RUNTIME_UI`, `E-DEC_NOT_EXECUTED`; owner F-01/F-12/F Gate와 A-04/A-14/A Gate |
| manifest integrity | PASS | raw/target/delivered/self-reference 독립 재계산 |
| 필수 통합 회귀 | FAIL | 83개 중 1개 실패, 2회 동일 재현 |

## blocking defects

### A03-TST-BLK-001 — Project Register 필수 운영 field 계약 누락

- severity: blocking MAJOR
- fingerprint: `A03-PROJECT-REGISTER-ENVIRONMENT-BACKEND-POLICY-OMITTED-AND-VALIDATOR-FAIL-OPEN`
- 권위 근거: WorkInstruction `SCREEN-PROJECT-REGISTER`는 name/slug/description/source/defaultBranch와 함께 `environment`, `backend/policy`를 요구하고, 승인 설계 spec도 `environment`, `backend/policy profile`, 운영환경 연결 상태를 고정한다.
- 관측: catalog의 `PROJECT_REGISTER.fields`는 `project_name`, `project_slug`, `description`, `repository_source_type`, `local_path`, `remote_url`, `default_branch`뿐이다. `A-03_PROJECT_REGISTRATION.md`와 `A-03_ONBOARDING_STATIC_RENDER.svg`에도 해당 운영 field가 없다.
- 독립 재현: 현재 fields와 WI 필수 집합의 차이는 `['backend_policy', 'environment']`인데 `validate_catalog(catalog)`는 `[]`를 반환한다. checker `EXPECTED_SCREEN_FIELDS`, 문서 needle, unit test도 같은 누락을 자기 기대값으로 삼아 fail-open이다.
- 영향: 운영자가 등록 시 환경과 backend/policy profile을 화면에서 선택·확인한다는 승인 field 계약과 `AV-UI-003/004` 정적 slice가 불완전하다.
- 요구 조치: 승인 명칭을 일관되게 확정해 catalog·registration 문서·onboarding SVG·checker expected/document binding·unit/hostile fixture에 최소 반영하고, 각 field 제거 시 stable reason code로 실패하게 한다.

### A03-TST-BLK-002 — 필수 회귀의 completion-era upstream 하드코딩

- severity: blocking MAJOR
- fingerprint: `A03-G07-REGRESSION-STale-UPSTREAM-ASSERTION-AFTER-PUSH`
- 재현 명령: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_g07_baseline.G07BaselineTests.test_a03_completion_projection_preserves_exact_worktree`
- 실제 결과: 2회 모두 line 233에서 expected `dc2ba63e1d923663724d1291cbcec007e4e7e7fe`, actual `f8b52a5a3b3acfa2776b06bd178e0911c1ead582`로 동일 실패.
- 원인 추적: completion projection의 historical `validated_base_commit=dc2ba63...`은 보존돼야 하지만 checker report의 `git.upstream_head`는 현재 실제 upstream을 관측한다. test가 두 개념을 같은 SHA로 고정해 push 뒤 실패한다. G-07 CLI 자체는 current state에서 PASS한다.
- 영향: WI의 exact regression suite가 exit 0이 아니므로 package exit condition을 충족하지 못한다.
- 요구 조치: historical validated base assertion과 current upstream assertion을 분리해 각각 올바른 source에 결박하고, pushed clean state와 completion-era detached projection을 모두 회귀로 검증한다.

## fresh 명령과 실제 결과

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a03_onboarding tests.tooling.test_a02_tokens tests.tooling.test_project_progress tests.tooling.test_g07_baseline tests.tooling.test_phase_g_gate
```

- exit 1, `Ran 83 tests`, failure 1, error 0, skip 0.
- 실패: `test_a03_completion_projection_preserves_exact_worktree`.

```powershell
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a03_onboarding.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a02_tokens.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_project_progress.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g07_baseline.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_phase_g_gate.py .
```

- 각 checker exit 0.
- A-03/A-02: PASS, errors 0.
- progress: PASS, sequence 63, AUTO_CONTINUE.
- G-07: PASS, packages 97, AV 255, uncovered 0, scenarios 20.
- Phase G Gate: PASS, accepted 7, decisions 10, packages 97, AV 255, scenarios 20, sync 7.
- checker PASS는 위 독립 원문 대조 결함과 필수 regression 실패를 상쇄하지 않는다.

## progress·권한·미검증 범위

- progress: sequence 63, `A-03 / TEST_REVIEW`, result `COMPLETED`, accepted=false, independent Tester `PENDING`.
- active agent, worker lease, write lease는 모두 null이며 A-04는 차단 상태다.
- Tester write는 본 보고서 한 파일뿐이다. commit/push/acceptance/A-04 작업은 수행하지 않았다.
- Browser, Playwright, API, DB, Event, Network, Docker, WSL, server, deploy, release는 `NOT_EXECUTED`다. 정적 SVG를 runtime UI 증거로 승격하지 않는다.

## 조치

Main은 같은 A-03 lineage의 첫 유효 `FAILURE_REPORT`로 기록하고, Developer에게 `A03-TST-BLK-001`과 `A03-TST-BLK-002`만 최소 보완하도록 revision을 발행한다. 기존 dirty/untracked·preservation·permission·Dashboard·token·manifest 계약은 다시 열지 않는다. 보완 뒤 full regression과 동일 hostile reproduction을 새 독립 Tester가 재검증하기 전에는 `PASS_STATIC_CONTRACT`, `READY_FOR_MAIN_ACCEPTANCE`, `ACCEPTED`를 선언하지 않는다.
