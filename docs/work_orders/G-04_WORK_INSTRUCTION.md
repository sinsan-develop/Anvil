# G-04 WorkInstruction — 실행·검증·제품판정·릴리스 artifact template

## Artifact envelope

- artifact_id: `WI-G-04-20260810-002`
- artifact_type: `work_instruction`
- project_id: `anvil`
- package_id: `G-04`
- version: `2`
- artifact_status: `approved`
- package_status: `REWORK`
- content_hash: `파일 저장 후 SHA-256으로 결박`
- source_artifact_ids: `BASELINE-G-02-DERIVED-20260810-001`, `Anvil-WorkPlan-v1.4`
- source_evidence_ids: `G-03_TEST_REPORT_R4`
- created_by: `{ actor_type: agent, actor_id: main-agent-eoul }`
- created_at: `2026-08-10T00:00:00+09:00`
- supersedes_artifact_id: `WI-G-04-20260810-001`

## Revision 2 실패 계보

- supersedes_work_instruction_sha256: `F09526E83D7D96AE0D2C3A59A2A8EF46E299C696BFF82034E168F8EE583BEAC0`
- independent_test_report: `docs/test_reports/G-04_TEST_REPORT.md`
- independent_test_report_sha256: `E31E3B27BCCB6F34F13EE8C3438F60CCBE618B5CC1E3CA53F3FCECF73DF170B5`
- `G04-DEF-001` 최초 1회: expected 비열람 독립 session이 실행 의미 22/23을 복원했으나 `content_hash`와 출력 field/shape 선택 규칙을 WorkInstruction 단독으로 결정할 수 없어 semantic diff 0 실패
- `G04-DEF-002` 최초 1회: manifest 선언 규칙 재계산 `2109 bytes / C04684A5...`와 등록 `2162 bytes / 857179EF...`가 달라 target/delivered 결박 재현 실패
- 두 finding은 기능 범위·요구사항·중요 위험 변경이 아닌 G-04 완료조건의 재현성 결함이다.

## 승인·기준선 binding

- owner: `Main Agent 어울`
- executor: `developer-primary Subagent 1명`
- root_human_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- approval_subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- design_baseline_id: `BASELINE-G-02-DERIVED-20260810-001`
- design_baseline_sha256: `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B`
- design_source_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_version: `v1.4`
- work_plan_sha256: `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475`
- baseline_git_commit: `6fab9aa95811ad09aa2f27a0e9c7f5b73bf12cfd`
- parent_progress_commit: `6d2dd6b`
- approval_scope: `G-04 template·schema·검증 tooling만; 제품 기능과 운영환경 변경 없음`

## 목표

WorkInstruction, InvocationPrompt, CompletionReport, TestReport, ProductValidation, DefectAssessment, ReleaseDecision, EvidenceManifest의 8개 template을 공통 artifact envelope와 기계 검증 가능한 필드 계약으로 고정한다. 별도 세션이 WorkInstruction만 읽고 의미 차이 없이 실행 계약을 재구성할 수 있어야 하며 InvocationPrompt는 본문을 복사하지 않고 artifact ID·content hash만 참조해야 한다.

## 선행조건

1. G-03이 독립 Tester R4 PASS 뒤 Main Agent에 의해 `ACCEPTED`됐다.
2. Git `main`의 승인 기준선 commit은 `6fab9aa95811ad09aa2f27a0e9c7f5b73bf12cfd`이고 원격 저장소는 없다.
3. Developer는 본 지시의 허용 경로만 쓰며 Main Agent와 동시 write하지 않는다.

## 포함 범위

1. 8개 artifact template과 공통 envelope·schema version 계약
2. JSON 표준 라이브러리만으로 template/schema 필수 필드·enum·guard·참조 관계를 검사하는 tooling과 test-first 검증
3. WorkInstruction의 14개 `verification_contract` 필드 전체
4. InvocationPrompt의 WorkInstruction ID/hash 참조와 본문 비중복 guard
5. target/delivered hash, 사람 actor, blocking defect, EvidenceManifest 신뢰 사슬
6. 별도 세션의 WorkInstruction 재구성 실험에 사용할 최소 fixture와 expected semantic projection
7. CompletionReport, EvidenceManifest, progress/HANDOFF 갱신

## Template 공통 계약

8개 template 모두 다음 공통 envelope를 가진다.

```text
artifact_id, artifact_type, project_id, version,
artifact_status(draft|proposed|approved|superseded|rejected),
content_hash, source_artifact_ids, source_evidence_ids,
created_by.actor_type, created_by.actor_id, created_at,
supersedes_artifact_id
```

`artifact_status`와 Build Package 상태(`READY|ACTIVE|TEST_REVIEW|ACCEPTED|...`)를 서로 다른 필드와 enum으로 유지한다. 논리 `artifact_id`와 실제 저장 `artifact_path`도 분리한다.

## Template별 필수 계약

### WorkInstruction

- package·revision·supersedes, DesignBaseline ID/hash, WorkPlan ID/hash, approval ID/subject/scope
- owner·executor, 목표, 선행조건, 포함·제외·보호 범위, 허용·금지 path/action, rollback 경계
- 완료조건, 결과 상태·보고 계약
- 아래 `verification_contract` 14개 필드 전부

### InvocationPrompt

- invocation artifact ID, WorkInstruction artifact ID/content hash, approval subject hash
- 실행 모드, Agent 역할, CompletionReport template ID/hash, 보고 경로
- “참조 WorkInstruction대로 수행” 지침
- 목표·범위·완료조건·금지사항의 복사 또는 추가 재해석 금지

### CompletionReport

- Package/Run/Delegation/WorkInstruction ID·hash
- `result_status: COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`
- actor ID/type/role, target/delivered hash, 전후 Git HEAD/status, changed paths/diff
- action, command·exit code·실제 출력, test/evidence/manifest refs
- missing/carryover/SKIPPED/BLOCKED/unverified, assumptions/unresolved/decision request
- checkpoint/handoff, rollback, started/finished timestamp

### TestReport

- 검증 revision, DesignBaseline/WorkInstruction/target/delivered/EvidenceManifest hash
- 환경·Tester actor, 진입기준, 검증 ID·level·method·result·evidence
- PASS/FAIL/SKIPPED/BLOCKED 집계, defect, 미검증 범위
- `ACCEPT | REWORK | BLOCKED | CARRYOVER | REJECT`, 판단 이유, 조치, 재검증 범위

### ProductValidation

- `product_validation_id`, `acceptance_criterion_id`, target/delivered hash, environment
- procedure, expected, observed, evidence refs
- `SUITABLE | NEEDS_IMPROVEMENT | UNSUITABLE | BLOCKED`, validated_by/at

### DefectAssessment

- defect ID·요약, target hash, severity, blocking, status, owner
- verification ID·source clause, 이유, 재현, evidence, impact, 조치, 재검증
- retest evidence, carryover ref, Owner decision actor/time/reason
- 상태는 `OPEN → ACCEPTED → FIXING → READY_FOR_RETEST → CLOSED`, 분기는 `DEFERRED | REJECTED`
- `CRITICAL`은 항상 blocking, `MAJOR`는 `blocking=true`일 때 Release 차단

### ReleaseDecision

- ID, target/delivered/EvidenceManifest hash, ProductValidation refs, blocking defect refs/count
- `RELEASE | REWORK | DEFER | REJECT`, conditions, proposed_by, decided_by_human, decided_at, reason, next transition
- 네 결정 모두 인증된 사람만 확정한다. Main/Tester는 제안만 가능하다.
- `DEFER`는 risk, reconsider_at, CarryoverItem을 요구한다.
- `BLOCKED`를 decision enum으로 추가하지 않는다. 필수 validation 미완료 또는 open blocking defect는 decision 생성/`RELEASE` 전이를 막는 guard 결과다.

### EvidenceManifest

- manifest ID, DesignBaseline/WorkPlan/WorkInstruction/target/delivered hash
- Git HEAD·전후 status, image digest, DB migration head/set, DB profile/version
- config/policy/Provider routing hash, environment, toolchain, commands
- verification ID/result/evidence hash, actor ID/role, acquisition mode
- raw checksum, skipped/blocked, unverified, started/finished, creator/time/signature, 실제 전달 대상 비교
- target·commit·image·migration·routing·environment가 다르면 이전 PASS 재사용 금지

## canonical representation

- 기계 판정의 정본은 UTF-8 JSON template과 JSON Schema Draft 2020-12다.
- 사람용 Markdown 예시는 정본 JSON에서 파생되는 설명이며 같은 필드를 삭제하거나 enum을 넓힐 수 없다.
- placeholder는 `__REQUIRED_*__`처럼 명시하며 빈 문자열·임의 PASS 기본값을 쓰지 않는다.
- content hash 계산 규칙은 UTF-8, LF, BOM 없음, canonical JSON(key sort, compact separator)을 문서화하고 test한다.

## Revision 2 결정론적 재구성 계약

- WorkInstruction template과 reconstruction fixture 자체에 `reconstruction_contract`를 포함한다.
- 이 계약은 최소 `contract_version`, `projection_fields`의 정확한 순서, `output_shape`, `canonicalization`, `hash_algorithm`을 가진다.
- `projection_fields`에는 `artifact_id`, `content_hash`와 실행에 필요한 모든 의미 필드를 명시한다. 외부 checker 함수나 expected fixture를 보아야만 field를 선택할 수 있어서는 안 된다.
- 독립 session은 source WorkInstruction 하나만 읽고 `reconstruction_contract.projection_fields` 순서대로 flat JSON object를 작성한다.
- 출력은 UTF-8 canonical JSON(key sort, compact separator, LF 없음, BOM 없음)으로 hash한다.
- test는 helper가 숨긴 hard-coded field 목록이 아니라 source artifact 내부의 `reconstruction_contract`만 사용해 projection을 생성하고 expected와 byte/semantic diff 0을 확인한다.

## Revision 2 EvidenceManifest target canonicalization

- target은 `raw_checksums` 배열의 실제 전달 artifact만으로 계산한다.
- 각 row는 정확히 `path + "\t" + decimal_bytes + "\t" + uppercase_sha256_without_prefix`다.
- path는 repository-relative POSIX `/`, Unicode 문자열의 UTF-8 byte ordinal 오름차순으로 정렬한다.
- row 사이는 단일 LF(`0x0A`), 마지막 row 뒤 LF 없음, encoding UTF-8, BOM 없음이다.
- `target_algorithm` 구조체에 algorithm version, row format, path normalization, sort, separator, final newline, encoding, BOM, hash algorithm을 각각 필드로 저장한다. 자연어 한 줄만 두지 않는다.
- checker에 `canonical_target_bytes(raw_checksums)`와 `canonical_target_sha256(raw_checksums)`를 제공하고 manifest의 `target_canonical_bytes`, `target_hash`, `delivered_hash`를 실제로 대조한다.
- WorkInstruction·template·schema·checker가 revision 2에서 변경되므로 모든 raw checksum, canonical bytes, target/delivered, manifest content/file hash를 새 결과로 재생성한다. 기존 `857179EF...`를 재사용하지 않는다.

## 허용 경로

- `docs/work_orders/templates/**`
- `docs/validation/templates/**`
- `docs/release/templates/**`
- `docs/evidence/templates/**`
- `docs/templates/**`
- `tests/fixtures/g04/**`
- `scripts/check_artifact_templates.py`
- `tests/tooling/test_artifact_templates.py`
- `docs/evidence/manifests/G-04_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/G-04_COMPLETION_REPORT.md`
- `docs/progress/build-progress.json`, `docs/progress/BUILD_HANDOFF.md`
- 독립 Tester 전용 `docs/test_reports/G-04_TEST_REPORT.md` 및 revision 보고서

## 금지·제외 범위

- 승인된 설계서·작업계획서·검증매트릭스·테스트계획서·운영규칙 수정
- G-01~G-03 artifact와 TestReport 수정
- 제품 API/UI/DB/migration/queue/Provider/Docker service 구현
- dependency 설치, lockfile, network, WSL/server/DB 접속
- commit, remote 추가, push, tag, 배포
- 실제 secret·credential·운영 endpoint 기록
- template enum을 상위 설계보다 임의 확대하거나 `BLOCKED`를 ReleaseDecision 값으로 추가

## TDD·검증 절차

1. 먼저 `tests/tooling/test_artifact_templates.py`를 작성한다.
2. checker/schema/template이 없거나 불완전한 상태의 예상 RED를 명령·exit·출력과 함께 기록한다.
3. 최소 schema/template/checker를 구현해 GREEN을 만든다.
4. positive fixture와 아래 negative mutation을 모두 검증한다.
   - InvocationPrompt 본문 복사 또는 WorkInstruction hash 누락
   - `verification_contract` 필드 누락
   - target/delivered 또는 manifest binding 누락
   - `RELEASE`인데 사람 actor 없음, open blocking defect 존재, 필수 ProductValidation 미완료
   - `DEFER`인데 risk/reconsider/carryover 누락
   - `CRITICAL`인데 blocking=false
   - EvidenceManifest 환경·target 불일치 재사용
   - artifact status와 Package status enum 혼용
5. 별도 독립 Tester는 Developer context를 사용하지 않고 WorkInstruction fixture 하나만 읽어 semantic projection을 재구성하고 expected와 비교한다.
6. revision 2 Tester는 source fixture 내부 `reconstruction_contract`만으로 projection을 생성하고 expected를 열기 전에 projection file/hash를 고정한다.
7. revision 2 Tester는 manifest `raw_checksums`에서 위 구조화 규칙으로 canonical bytes와 target hash를 직접 재계산한다.

## verification_contract

```yaml
verification_contract:
  matrix_revision: "sha256:0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3"
  assigned_verification_ids: ["AV-FLOW-003"]
  required_levels: ["L2"]
  required_evidence: ["E-ART", "E-MAN"]
  tester_entry_conditions:
    - "CompletionReport와 EvidenceManifest가 존재하고 target/delivered hash가 일치"
    - "Main Agent PRELIMINARY_ACCEPT 및 고정 revision"
  package_exit_conditions:
    - "AV-FLOW-003 PASS"
    - "8개 template과 schema/checker 검증 PASS"
    - "별도 세션 재구성 semantic diff 0"
    - "blocking defect 0"
  regression_suite: "tests.tooling.test_artifact_templates"
  fixture_ids: ["G04-RECONSTRUCT-001", "G04-NEGATIVE-MUTATIONS-001"]
  environment: "ENV-LOCAL"
  immediate_stop_conditions:
    - "기능 범위·요구사항·중요 위험 변경 필요"
    - "승인 기준선 hash 불일치"
    - "보호 경로 변경 또는 secret 발견"
  evidence_manifest_required: true
  product_validation_criteria: []
  blocking_defect_policy: "CRITICAL 또는 blocking MAJOR 1건 이상이면 ACCEPTED 금지"
  release_decision_required: false
```

## 완료조건

1. 8개 template, 공통 schema/catalog, checker, test가 존재한다.
2. 8개 template 모두 공통 envelope를 가지며 필수 계약 누락 0건이다.
3. InvocationPrompt는 WorkInstruction ID/hash만으로 실행 대상을 고정하고 본문 중복 검사가 통과한다.
4. WorkInstruction의 `verification_contract` 14개 필드가 기계 검증된다.
5. target/delivered hash, 사람 actor, blocking defect, Release guard, EvidenceManifest 신뢰 사슬의 positive/negative test가 통과한다.
6. CompletionReport 최초 canonical schema가 정의되고 기존 Markdown은 표현 layer임을 명시한다.
7. TestReport는 테스트계획서의 Markdown 구조를 보존하되 정본 JSON 필드와 1:1 대응한다.
8. `ReleaseDecision=BLOCKED`를 생성하지 않고 guard 결과로만 표현한다.
9. 별도 세션 재구성 실험에 필요한 fixture와 expected projection이 준비된다.
10. EvidenceManifest target/delivered hash가 일치하고 독립 Tester PASS 전 `ACCEPTED`, commit, G-05 시작을 금지한다.
11. expected 비열람 독립 projection이 field/shape/content hash를 포함해 byte diff 0이며, 선택 규칙이 source WorkInstruction 내부에 존재한다.
12. EvidenceManifest의 target canonical bytes/hash가 구조화된 `target_algorithm`과 raw checksum으로 제3자 재현된다.

## rollback 경계

G-04가 실패하면 G-04가 새로 만든 허용 경로만 제거하거나 이전 commit으로 되돌릴 수 있다. G-03 기준선 commit과 기존 권위·증거 artifact는 수정하거나 삭제하지 않는다.

## 보고 계약

Developer는 `판정 → 판단 이유 → 조치` 순서로 보고한다. 변경 path, RED/GREEN 명령·exit code·실제 출력, schema/template 검사 수, negative mutation 결과, target/delivered hash, SKIPPED/BLOCKED/미검증 범위와 rollback을 CompletionReport에 기록한다.
