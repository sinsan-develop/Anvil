# G-06 WorkInstruction — Fixture Repository·Golden Set·Fault/Security/Deploy 시나리오

## Artifact envelope

- artifact_id: `WI-G-06-20260810-002`
- artifact_type: `work_instruction`
- project_id: `anvil`
- package_id: `G-06`
- version: `2`
- artifact_status: `approved`
- package_status: `ACTIVE`
- content_hash: `파일 저장 후 SHA-256으로 결박`
- source_artifact_ids: `BASELINE-G-02-DERIVED-20260810-001`, `Anvil-WorkPlan-v1.4`
- source_evidence_ids: `G-05_TEST_REPORT_R2`, `EVIDENCE-MANIFEST-G-05-20260810-003`
- created_by: `{ actor_type: agent, actor_id: main-agent-eoul }`
- created_at: `2026-08-10T18:00:00+09:00`
- supersedes_artifact_id: `WI-G-06-20260810-001`

## Revision 2 — Package별 immutable progress evidence chain

- supersedes_work_instruction_sha256: `F30BC57A66657D9D39C96517B981114F9DE767B3C6A8D7F9BFB693358CBEB8FB`
- change_classification: `MAIN_RECONFIRMED_NON_SEMANTIC`
- reason: G-05 checker가 live progress/HANDOFF를 G-05 manifest의 mutable detached path에 고정해 다음 Package 진행 갱신 시 과거 ACCEPTED evidence가 깨지는 구현 결박을 발견했다.
- impact: 제품 기능·요구사항·중요 위험과 golden expected 값은 변경하지 않는다. Package별 immutable detached digest를 사용하도록 진행 checker를 일반화한다.

Revision 2에서는 G-05 accepted manifest와 G-05 generic detached artifact를 수정하지 않는다. G-06은 `progress-handoff-detached-digest-g06.json` 같은 Package 고유 immutable path를 만들고 G-06 manifest가 이를 결박한다. live progress는 현재 Package의 detached ref를 가리킨다. project-progress checker는 현재 Package ref를 검증하고, 과거 manifest는 자신이 기록한 raw path/hash만 검증한다. Package 전환 뒤 과거 detached를 현재 live progress와 비교하지 않는다.

## 승인·기준선 binding

- owner: `Main Agent 어울`
- executor: `developer-primary Subagent 1명`
- root_human_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- approval_subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- operating_approval_id: `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`
- design_baseline_id: `BASELINE-G-02-DERIVED-20260810-001`
- design_baseline_sha256: `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B`
- design_source_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_version: `v1.4`
- work_plan_sha256: `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475`
- validation_matrix_sha256: `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3`
- baseline_git_commit: `a70daa4`
- baseline_upstream: `origin/main`
- approval_scope: `G-06 검증용 source fixture·golden·scenario·materializer/checker만; 제품 runtime 구현과 서버 변경 없음`

## 목표

제품 구현 전에 8개 fixture repository, fixture별 golden acceptance case, 테스트계획 FI-01~08, 설계서 §49.17의 20개 fault/security/deploy 시나리오를 immutable 검증 자산으로 고정한다. 모든 자산은 실제 제품 PASS와 구분되고, 임시 디렉터리에 결정론적으로 materialize되며, read-only 검사 전후 무결성을 증명해야 한다.

## Phase G 판정 경계

G-06에서 PASS 가능한 것은 fixture 정의·materialization·hash 재현, dirty/untracked 보존, golden 사전 동결, 20 scenario trace, FI-01~08 주입 계약, 실제 secret 0, false PASS mutation 거부뿐이다.

§49.17 runtime 차단, DB/outbox/crash, fencing/budget, CSRF/SSRF/egress/secret runtime, WSL/ysna-server 배포, 실제 브라우저·UI badge·Monitoring·Release는 `NOT_EXECUTED`로 남긴다. fixture/mock/static 결과를 제품 PASS·RELEASED로 표시하면 실패다.

## 선행조건

1. G-05가 독립 Tester R2 PASS 뒤 Main Agent에 의해 `ACCEPTED`됐다.
2. Git `main` HEAD `a70daa4`가 `origin/main`에 push됐다.
3. Developer는 허용 경로만 쓰고 Main Agent와 동시 write하지 않는다.
4. Node `v24.18.0`, npm `11.12.1`을 사용할 수 있으며 로컬 npm cache에 `typescript-5.9.3.tgz`가 존재한다.
5. fixture 외부로 network·server·DB를 사용하지 않는다.

## 포함 범위

1. 8개 source fixture template과 fixture index/schema
2. 임시 디렉터리에 실제 Git repository를 생성하는 Python 표준 라이브러리 materializer
3. 각 fixture의 baseline commit, clean/dirty/untracked/protected/large/conflict/tool 상태 재현
4. fixture별 최소 1개 golden case, golden schema/index/lock/hash
5. §49.17 scenario 20개와 AV ID·책임 Package·Gate·evidence 1:1 trace
6. FI-01~08 fault injection 계약과 `NOT_EXECUTED` 경계
7. fixture/golden/scenario checker와 test-first 검증
8. G-06 EvidenceManifest, CompletionReport, progress/HANDOFF 갱신

## 8개 fixture 계약

| Fixture | 필수 실제 상태 |
|---|---|
| `FIX-PY-CLEAN` | 최소 Python test 실제 PASS, clean Git |
| `FIX-PY-DIRTY` | baseline commit 뒤 tracked 수정 1개·untracked 1개, path/content/hash 고정 |
| `FIX-PY-REDFAIL` | baseline test가 결정론적으로 FAIL하고 expected fingerprint 고정 |
| `FIX-TS-CLEAN` | package/lock에 TypeScript `5.9.3` 고정, `npm ci --offline --ignore-scripts`, local `node_modules/.bin/tsc` 실제 version·typecheck 확인 |
| `FIX-TS-NOTOOL` | 같은 도구 선언·config, 설치 미수행, 격리 PATH에서 local executable 부재와 `BLOCKED TOOL_NOT_INSTALLED` |
| `FIX-PROTECTED` | protected path와 명백히 합성인 secret marker, 실제 credential 0 |
| `FIX-LARGE` | 고정 seed의 다수 모듈과 명시적 순환 의존 1개 이상 |
| `FIX-CONFLICT` | 두 Step이 같은 canonical path를 요구하는 TaskGraph |

원본 Anvil repository에는 중첩 `.git`과 `node_modules`를 저장하지 않는다. source template과 manifest만 보존하고 temp materialization에서 Git init/commit과 offline install을 수행한다. cache나 local executable이 없으면 `TOOLCHAIN_UNAVAILABLE`로 정직하게 BLOCKED하며 가짜 `tsc`를 만들지 않는다.

각 fixture manifest 필수 필드: ID/schema/purpose/AV IDs, source hash, materializer version/hash, branch/commit 규칙, tracked·dirty·untracked 상태, toolchain/install 상태, protected/synthetic secret 규칙, file path/bytes/hash, expected test/tool/Gate, reset/cleanup, 실제 secret·외부 시스템 금지.

## Golden acceptance 계약

각 fixture는 최소 1개 golden case를 가진다. 필수 필드:

- case/fixture ID·hash, source requirement·AV ID
- action/WorkInstruction ID·hash, precondition, `acquisition_mode=fixture`
- expected result status, changed/forbidden paths, expected diff/hash
- expected test PASS/FAIL/SKIP 수와 이유, Gate별 상태
- preserved dirty/untracked/protected path/hash
- expected Event·blocked/error code, EvidenceManifest expected skeleton
- forbidden side effects, `fail_if`, frozen_at/by, golden content hash
- supersedes·Owner approval ref

최초 set은 승인된 G-06 범위에서 동결한다. 이후 expected 값 변경은 신산님 승인과 old/new hash가 없으면 checker가 거부한다. 구현 결과를 본 뒤 expected를 조정하지 않는다.

## §49.17 scenario catalog

`S49-17-01`~`S49-17-20`을 정확히 한 번씩 만들고 다음 AV ID와 1:1로 결박한다.

```text
01 AV-STAT-041   02 AV-STAT-042   03 AV-FLOW-024   04 AV-FLOW-025
05 AV-STAT-043   06 AV-SAFE-028   07 AV-AGT-038    08 AV-OPS-019
09 AV-SAFE-029   10 AV-SAFE-030   11 AV-SAFE-031   12 AV-SAFE-032
13 AV-LRN-027    14 AV-LRN-028    15 AV-GATE-025   16 AV-OPS-020
17 AV-OPS-021    18 AV-OPS-022    19 AV-OPS-023    20 AV-OPS-024
```

각 파일은 source clause/AV ID/책임 Package/Gate/level/method/environment, fixture/golden refs, precondition, injection/action, expected state·blocked/error code, 금지 side effect, evidence type, reset/cleanup, repeat count, 실제 실행 Phase, `implementation_status=DESIGN_LOCKED`, `execution_status=NOT_EXECUTED`를 가진다.

FI-01~08은 테스트계획의 DB/file/worker/request/PC/SSE 중단 지점을 계약으로만 고정하며 실제 kill·DB fault를 실행하지 않는다.

## 허용 경로

- `tests/fixtures/repositories/**`
- `tests/fixtures/golden/**`
- `tests/fixtures/schemas/**`
- `tests/fault/**`
- `scripts/materialize_fixture_repository.py`
- `scripts/check_g06_test_assets.py`
- `tests/tooling/test_g06_test_assets.py`
- `scripts/check_project_progress.py`
- `tests/tooling/test_project_progress.py`
- `docs/governance/schemas/project-progress.schema.json`
- `docs/evidence/manifests/G-06_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/G-06_COMPLETION_REPORT.md`
- `docs/progress/**`
- 독립 Tester 전용 `docs/test_reports/G-06_TEST_REPORT*.md`

## 금지·제외 범위

- 설계서·작업계획서·매트릭스·테스트계획서·운영규칙·AGENTS.md 수정
- G-01~G-05 artifact/TestReport/immutable manifest 수정
- 제품 API/UI/DB/migration/queue/Provider/Docker 구현
- nested `.git`, `node_modules`, 실제 secret, 외부 endpoint·credential commit
- online npm install, WSL/server/DB 접속, 배포, tag
- fixture/mock/static 결과를 실제 제품 PASS·RELEASED·runtime verified로 표시
- §49.17 expected result를 실제 구현 결과에 맞춰 변경

## TDD·검증 절차

1. 먼저 `tests/tooling/test_g06_test_assets.py`를 작성해 checker/materializer 부재 RED를 실제 관찰한다.
2. schema/index/source template/materializer/checker를 최소 구현해 GREEN을 만든다.
3. 8개를 각각 새 OS temp dir에 materialize하고 Git branch/HEAD/status, tests/tools, manifest hash를 검증한다.
4. `FIX-PY-DIRTY`는 read-only 검사 전후 전체 tracked/dirty/untracked content·mtime/hash를 비교해 변화 0을 증명한다.
5. `FIX-TS-CLEAN`은 `npm ci --offline --ignore-scripts`와 local `tsc --version`/typecheck를 실행한다. 글로벌 tool fallback을 금지한다.
6. `FIX-TS-NOTOOL`은 격리 PATH와 local executable 부재에서 `TOOL_NOT_INSTALLED`를 재현한다.
7. 8 fixture/golden, 20 scenario, FI-01~08의 count·unique·trace·hash를 검사한다.
8. 다음 mutation을 거부한다: 실제 PASS 표기, NOT_EXECUTED 누락, golden hash/expected 변조, fixture 누락·중복, dirty/untracked 변경, 실제-looking secret, scenario AV/Package/evidence 누락, TS global fallback.
9. G-05/G-04/G-03 회귀를 함께 실행한다.
10. G-05 accepted manifest·detached를 byte 불변으로 보존한 채 G-06 live progress/HANDOFF를 갱신하고, Package별 detached ref가 과거 evidence와 current progress를 동시에 안전하게 검증하는지 회귀한다.

## verification_contract

```yaml
verification_contract:
  matrix_revision: "sha256:0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3"
  assigned_verification_ids: ["AV-GATE-005(fixture 기준)", "AV-SAFE-010(fixture 준비)"]
  required_levels: ["L4-fixture-contract", "L5-fixture-preparation"]
  required_evidence: ["E-ART", "E-GIT", "E-TEST", "E-MAN"]
  tester_entry_conditions:
    - "8 fixture와 golden lock, 20 scenario, FI-01~08, CompletionReport, EvidenceManifest 존재"
    - "Main Agent PRELIMINARY_ACCEPT 및 고정 revision"
  package_exit_conditions:
    - "8/8 fixture materialization·hash 재현"
    - "FIX-PY-DIRTY dirty/untracked 보존"
    - "golden 사전 동결·false PASS mutation 거부"
    - "20/20 scenario trace와 FI-01~08 NOT_EXECUTED 계약"
    - "blocking defect 0"
  regression_suite: "tests.tooling.test_g06_test_assets + G-05/G-04/G-03 tooling suites"
  fixture_ids: ["FIX-PY-CLEAN", "FIX-PY-DIRTY", "FIX-PY-REDFAIL", "FIX-TS-CLEAN", "FIX-TS-NOTOOL", "FIX-PROTECTED", "FIX-LARGE", "FIX-CONFLICT"]
  environment: "ENV-LOCAL"
  immediate_stop_conditions:
    - "기능 범위·요구사항·중요 위험 변경 필요"
    - "실제 DIR 도달"
    - "기준선 hash 불일치 또는 보호 경로 변경"
    - "실제 secret 발견"
    - "offline TypeScript cache 부재로 FIX-TS-CLEAN 재현 불가"
  evidence_manifest_required: true
  product_validation_criteria: []
  blocking_defect_policy: "CRITICAL 또는 blocking MAJOR 1건 이상이면 ACCEPTED 금지"
  release_decision_required: false
```

## 완료조건

1. 8/8 fixture가 index에 고유하게 존재하고 실제 temp Git repository로 재현된다.
2. clean/dirty/redfail/TS installed/TS missing/protected/large/conflict 상태가 기대와 일치한다.
3. TS-CLEAN local TypeScript 5.9.3 offline 설치·typecheck, TS-NOTOOL 글로벌 우회 없는 차단이 재현된다.
4. PY-DIRTY 검사 전후 dirty/untracked content·mtime/hash 변화 0이다.
5. fixture 전체 manifest/hash가 재계산된다.
6. fixture별 golden case가 구현 전에 hash·approval ref와 함께 동결된다.
7. false PASS·golden 변조·실제 secret·trace 누락 mutation이 전부 거부된다.
8. §49.17 scenario 20/20과 AV ID·책임 Package·evidence trace가 일치한다.
9. FI-01~08은 존재하고 실제 fault 미실행을 명시한다.
10. G-05/G-04/G-03 회귀와 G-06 checker가 PASS한다.
11. EvidenceManifest target/delivered hash가 일치한다.
12. 독립 Tester PASS 전 `ACCEPTED`, commit, push, G-07 시작을 금지한다.

## rollback 경계

실패 시 G-06 신규 허용 경로와 G-06 progress/HANDOFF 변경만 되돌린다. G-05 이전 기준선과 immutable evidence는 수정·삭제하지 않는다.

## 보고 계약

Developer는 CompletionReport에만 `판정 → 판단 이유 → 조치`로 기록한다. RED/GREEN 명령·exit·실제 출력, 8 fixture materialization 결과, TS offline 실제 version, dirty/untracked before/after hash·mtime, golden/scenario/FI count, mutation 결과, target/delivered, SKIPPED/BLOCKED/미검증 범위를 포함한다. routine 진행은 신산님에게 보고하지 않는다.
