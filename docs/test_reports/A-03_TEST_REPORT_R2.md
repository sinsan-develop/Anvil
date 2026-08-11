# A-03 독립 Tester 재검증 보고서 R2

## 판정

`PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE`

- package: `A-03 revision 2`
- blocking finding: 0건
- `A03-TST-BLK-001`: `CLOSED`
- `A03-TST-BLK-002`: `CLOSED`
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- Main acceptance: 아직 미실행
- A-04: Main acceptance 전까지 차단
- 기능 범위·요구사항·중요 위험 변경: 없음
- DIR-1·DIR-X: 미도달

## 판단 이유

Revision 2는 승인된 Project Register 운영 field 세 개를 catalog·문서·SVG·checker·test·hostile fixture에 동일 이름으로 복원했고, 각 field 제거와 추가 swap/unknown 변형을 stable reason code로 거부했다. historical completion base와 현재 upstream도 별도 source에서 검증하도록 분리됐으며, 요구된 전체 회귀 88개가 fresh 실행에서 실패·오류·skip 없이 통과했다. R1 evidence와 Tester report는 byte-immutable이고 두 manifest의 raw/target/delivered/self-reference, exact 20-path projection, A-01/A-02 predecessor도 독립 재계산에서 일치했다.

## 기준선과 독립 hash

| artifact | SHA-256 |
|---|---|
| Git HEAD / origin/main | `82b40d8e99c49d03741542dda7cceea0262b8270` |
| original WorkInstruction | `E85FD1D62A70C77E2A4A87AAFA9B727B94CBF428BAA52736975B1FEA572C079F` |
| R2 WorkInstruction | `6FBED907089748236B8CF7FA119E517EFB55CA92A693738F0BB20A93781C35ED` |
| R1 Developer manifest | `9C3E9C70B61C7D477736B15502F5F3061493A5C8718F26D0B091FE23CB66F1CC` |
| R1 Tester report | `DD89EB18AB4F16FB46C752734870DBC125D11AC38512EC1F79B25D47EEDC00D6` |
| R2 Developer manifest | `772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE` |
| R2 completion progress manifest | `EEC14A31DD13D63DFA906D71926F0C2BCD2927C75B8E42EB8D076187F17D079A` |
| A-02 token catalog | `1709D227BB9C44480085CB10B53881B1613AED914F868B629F8B2C3D03D23207` |

- 검증 진입 시 `main = origin/main`, worktree clean, progress sequence 70 `TEST_REVIEW / COMPLETED / R2_PENDING`, worker/write lease null.
- R2 Developer manifest 독립 재계산: raw hash/bytes 오류 0, target/delivered `7D089D2EAC2ADF5899F041B6234B0A1393EA1256F2AC8395789CBE1EBF2CEA2A`, canonical 1,594 bytes, content 81,048 bytes, self path 없음.
- R2 completion manifest 독립 재계산: raw hash/bytes 오류 0, target/delivered `sha256:F8388A774E33BD79C5236809BDAC991DA72AE7C3BA0A448DFD3F91E814B4DA53`, canonical 631 bytes, self path 없음.
- `ed922520...HEAD`의 변경 경로는 manifest의 exact 20-path와 일치하며 `git diff --check`는 exit 0이다.
- R1 manifest/report/original WI와 A-02 token catalog hash는 고정값과 일치한다. A-01/A-02 accepted predecessor 경로에는 revision 2 변경이 없다.

## finding closure

### A03-TST-BLK-001 — CLOSED

- exact field: `environment`, `backend_policy_profile`, `operational_environment_connection_state`
- catalog `PROJECT_REGISTER.fields`, `A-03_PROJECT_REGISTRATION.md`, `A-03_ONBOARDING_STATIC_RENDER.svg`에 세 field가 동일 이름과 표시 경계로 존재한다.
- credential·secret·내부 주소는 표시하지 않고 connection state는 정적 화면 표시 계약으로만 정의한다.
- checker는 field 집합과 문서·SVG를 모두 검증하며 누락 시 `PROJECT_REGISTER_OPERATIONAL_FIELD_MISMATCH`를 반환한다.
- hostile fixture M29~M31과 unit test는 세 field를 각각 제거해 같은 stable reason code를 확인한다.
- 추가 독립 mutation으로 `environment`/`backend_policy_profile` swap과 connection field unknown 치환을 동시에 적용했으며 `SCREEN_FIELD_CONTRACT_MISMATCH`, `PROJECT_REGISTER_OPERATIONAL_FIELD_MISMATCH`가 함께 발생했다.

### A03-TST-BLK-002 — CLOSED

- sequence 63 historical completion `validated_base_commit`은 `dc2ba63e1d923663724d1291cbcec007e4e7e7fe`로 불변 검증한다.
- 현재 upstream은 실행 시 `git rev-parse @{u}` 결과와 checker report의 `git.upstream_head`를 비교한다.
- 전용 test `test_a03_completion_history_and_current_upstream_are_separate`가 PASS했고, 전체 88-test suite에도 포함돼 PASS했다.
- historical base와 current upstream을 동일 SHA로 강제하지 않는다.

## 전체 검증 결과

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a03_onboarding tests.tooling.test_a02_tokens tests.tooling.test_project_progress tests.tooling.test_g07_baseline tests.tooling.test_phase_g_gate
```

- exit 0
- `Ran 88 tests in 96.386s`
- failure 0, error 0, skip 0

```powershell
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a03_onboarding.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_a02_tokens.py --json
C:\Users\cyhuh\anaconda3\python.exe scripts\check_project_progress.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_g07_baseline.py .
C:\Users\cyhuh\anaconda3\python.exe scripts\check_phase_g_gate.py .
```

- 모두 exit 0.
- A-03/A-02: PASS, errors 0.
- progress: PASS, sequence 70, AUTO_CONTINUE.
- G-07: PASS, packages 97, AV 255, uncovered 0, scenarios 20.
- Phase G Gate: PASS, accepted 7, decisions 10, packages 97, AV 255, scenarios 20, sync 7.

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest -v tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_project_register_operational_fields_are_exact tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_project_register_operational_fields_bind_document_and_svg tests.tooling.test_a03_onboarding.A03OnboardingContractTests.test_project_register_operational_field_removal_is_fail_closed tests.tooling.test_g07_baseline.G07BaselineTests.test_a03_completion_history_and_current_upstream_are_separate
```

- exit 0, 4/4 PASS.
- 앞선 탐색성 targeted 호출에서 존재하지 않는 method 이름 하나를 지정해 loader error 1건이 있었고, 실제 method 이름을 확인한 위 명령으로 즉시 교정했다. 제품·계약 failure로 집계하지 않는다.

## 정적 계약과 미검증 범위

- 5개 screen, state/reason/error/edge, dirty/untracked 분리, user-owned source 보존, scan/rescan read-only, 권한·masking, Dashboard health/operation 6+6, 기간·표본·PASS/SKIPPED, deep link, A-02 token/설명 interface를 회귀 확인했다.
- assigned `AV-UI-003`, `AV-UI-004`의 A-03 정적 slice만 PASS다.
- package evidence는 `STATIC_ONLY / E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`다.
- Browser, Playwright, API, DB, Event, Network, Docker, WSL, server, deploy, release는 `NOT_EXECUTED`다.
- runtime owner는 `AV-UI-003`: F-01/F-12/F Gate, `AV-UI-004`: A-04/A-14/A Gate로 유지한다.

## 조치

Main Agent는 본 R2 evidence를 fresh 검토한 뒤에만 A-03 최종 수락 여부를 판정한다. 본 Tester는 `ACCEPTED`, commit/push 또는 A-04 착수를 수행하지 않았다. Tester workspace write는 본 보고서 한 파일뿐이다.
