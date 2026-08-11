# A-03 Rework WorkInstruction Revision 2

## Artifact envelope

- artifact_id: `WI-A-03-20260811-002`
- artifact_type: `rework_work_instruction`
- package_id: `A-03`
- revision: `2`
- artifact_status: `approved`
- package_status: `ACTIVE`
- created_by: `{ actor_type: agent, actor_id: main-agent-eoul }`
- created_at: `2026-08-11T15:10:00+09:00`
- predecessor_work_instruction: `docs/work_orders/A-03_WORK_INSTRUCTION.md`
- predecessor_work_instruction_sha256: `E85FD1D62A70C77E2A4A87AAFA9B727B94CBF428BAA52736975B1FEA572C079F`
- source_test_report: `docs/test_reports/A-03_TEST_REPORT.md`
- source_test_report_sha256: `DD89EB18AB4F16FB46C752734870DBC125D11AC38512EC1F79B25D47EEDC00D6`
- revision_classification: `MAIN_RECONFIRMED_NON_SEMANTIC`
- semantic_diff: `NONE`
- executor: `developer-primary-a03`

## 목적과 고정 경계

첫 독립 Tester의 `A03-TST-BLK-001`, `A03-TST-BLK-002`만 최소 보완한다. 기존 A-03 기능 범위·요구사항·중요 위험·화면 집합·runtime owner를 확장하지 않는다. original WI, Developer revision 1 manifest, completion progress manifest, Tester report와 sequence 1~63은 불변 predecessor다.

판정 경계는 계속 다음과 같다.

- package: `STATIC_CONTRACT_PASS` 후보
- canonical L7: `RUNTIME_DEFERRED / NOT_EXECUTED`
- evidence: `E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED`
- A-04: 독립 Tester revision 2 PASS와 Main acceptance 전 차단

## A03-TST-BLK-001 최소 보완

Project Register의 이미 승인된 운영 field 계약을 누락 없이 복원한다.

1. `environment`
2. `backend_policy_profile`
3. `operational_environment_connection_state`

세 field는 catalog, registration 문서, onboarding SVG, checker expected/document/SVG binding, unit test와 hostile mutation에 동일 이름과 의미로 결박한다. 각 field 삭제·swap·unknown은 stable reason code로 실패해야 한다. credential·secret·내부 주소는 노출하지 않고 connection state는 화면 표시 계약만 정의한다.

## A03-TST-BLK-002 최소 보완

G-07 회귀에서 historical completion `validated_base_commit`과 현재 실제 upstream을 같은 SHA로 고정하지 않는다.

- sequence 63 completion Event의 historical base `dc2ba63e1d923663724d1291cbcec007e4e7e7fe`는 불변 검증한다.
- current upstream은 실행 시 `git rev-parse @{u}` 관측값과 checker report를 비교한다.
- push 후에도 historical projection과 current Git 관측을 분리해 검증한다.

이 보완은 Main projection test 경로에서 이미 반영되며 Developer는 해당 파일을 다시 수정하지 않는다.

## Developer write scope

- `docs/architecture/a03/A-03_ONBOARDING_CATALOG.json`
- `docs/architecture/a03/A-03_PROJECT_REGISTRATION.md`
- `docs/architecture/a03/A-03_ONBOARDING_STATIC_RENDER.svg`
- `scripts/check_a03_onboarding.py`
- `tests/tooling/test_a03_onboarding.py`
- `tests/fixtures/a03/canonical-contract.json`
- `tests/fixtures/a03/mutation-catalog.json`
- `docs/validation/A-03_ONBOARDING_VALIDATION.md`
- `docs/completion_reports/A-03_COMPLETION_REPORT.md`
- `docs/evidence/manifests/A-03_EVIDENCE_MANIFEST_R2.json`

## 금지

- original WI, revision 1 Developer manifest, completion progress manifest, Tester report 수정
- findings와 무관한 Dashboard, repository onboarding, state render 재설계
- browser/API/DB/runtime 구현 또는 PASS 승격
- source cleanup, Git mutation, commit, push, deploy
- 권위 문서·A-01·A-02 evidence·progress Main 경로 수정

## TDD와 완료조건

1. 세 필수 field 누락을 기존 checker가 놓치는 RED를 먼저 관찰한다.
2. catalog·문서·SVG·checker·test·fixture를 최소 수정한다.
3. 각 field 제거 hostile mutation이 stable reason code로 실패함을 확인한다.
4. A-03 focused suite/checker와 A-02/project/G-07/Phase-G 회귀를 fresh 실행한다.
5. successor manifest `A-03_EVIDENCE_MANIFEST_R2.json`에 exact raw/target/delivered/self-reference=false를 결박한다.
6. CompletionReport에 변경 diff, RED→GREEN, 명령·exit code, 미실행 runtime, rollback을 기록한다.
7. 결과는 `COMPLETED_PENDING_INDEPENDENT_RETEST`로 제출하며 acceptance를 주장하지 않는다.
