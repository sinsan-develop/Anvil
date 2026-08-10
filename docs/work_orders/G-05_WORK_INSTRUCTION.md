# G-05 WorkInstruction — 개발 진행·복구·실패·DIR 정본

## Artifact envelope

- artifact_id: `WI-G-05-20260810-001`
- artifact_type: `work_instruction`
- project_id: `anvil`
- package_id: `G-05`
- version: `1`
- artifact_status: `approved`
- package_status: `ACTIVE`
- content_hash: `파일 저장 후 SHA-256으로 결박`
- source_artifact_ids: `BASELINE-G-02-DERIVED-20260810-001`, `Anvil-WorkPlan-v1.4`
- source_evidence_ids: `G-04_TEST_REPORT_R2`, `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`
- created_by: `{ actor_type: agent, actor_id: main-agent-eoul }`
- created_at: `2026-08-10T15:39:17+09:00`
- supersedes_artifact_id: `null`

## 승인·기준선 binding

- owner: `Main Agent 어울`
- executor: `developer-primary Subagent 1명`
- root_human_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- approval_subject_hash: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- operating_approval_id: `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`
- operating_approval_sha256: `A0986462BB0D2894BDC24C5C2A9022116B2173138C63A077F1E4B58500B85288`
- design_baseline_id: `BASELINE-G-02-DERIVED-20260810-001`
- design_baseline_sha256: `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B`
- design_source_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_version: `v1.4`
- work_plan_sha256: `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475`
- validation_matrix_sha256: `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3`
- baseline_git_commit: `a3014da95b34d8fe3a0a22418d78016b0fe57e61`
- approval_scope: `G-05 개발 프로젝트 진행·복구 artifact와 검사 tooling만; 제품 API/UI/DB/배포 변경 없음`

## 목표

개발 프로젝트 자체의 진행 상태를 기계 검증 가능한 JSON 정본으로 만든다. 새 Session이 root human approval, 파생 baseline, 완료·실패·다음 안전 행동, failure lineage, 비의미 revision binding, DIR 상태를 파일만으로 복구하고 잘못된 자동 재개를 거부해야 한다.

신산님의 최신 운영 승인을 우선 적용한다. 복구 시 owner 보고 payload는 항상 계산·영속화하되, 대화 보고와 실행 중단은 기능 범위·요구사항·중요 위험 변경 또는 DIR 도달일 때만 발생한다. 그 밖에는 progress/HANDOFF에 복구 근거를 남기고 자동 진행한다.

## 선행조건

1. G-04가 독립 Tester R2 PASS 뒤 Main Agent에 의해 `ACCEPTED`됐다.
2. Git `main` HEAD `a3014da95b34d8fe3a0a22418d78016b0fe57e61`가 `origin/main`에 push됐다.
3. Developer는 본 지시의 허용 경로만 쓰며 Main Agent와 동시 write하지 않는다.
4. 권위 문서 hash가 위 binding과 일치한다.

## 포함 범위

1. `build-progress.json` schema와 canonical 예시 정규화
2. `BUILD_HANDOFF.md`의 기계 판독 가능한 대응 필드와 sequence 결박
3. accepted/rejected failure report를 분리하는 failure ledger schema·정본
4. `non_semantic_revision_bindings` schema·정본과 root approval scope 비확장 guard
5. `DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED` checkpoint schema·정본과 자동 재개 차단 guard
6. Package 시작·완료·실패·중단·승인대기·재개, 인계, failure 수락/거부, lease, Gate/DIR, commit/push/deploy의 append-only progress event 계약
7. session recovery projection과 적대 fixture, 표준 라이브러리 checker, test-first 검증
8. EvidenceManifest, CompletionReport, progress/HANDOFF 갱신

G-05는 정적 계약·fixture·checker까지만 구현한다. DB transaction, atomic replace, outbox와 실제 process crash durable recovery는 B-08/B-12 범위이며 G-05 PASS로 주장하지 않는다.

## 정본 계약

### build-progress

작업계획서 15장의 최소 필드를 빠짐없이 유지한다: plan/design baseline, phase, Package, 상태, 완료 Package, active Agent, worker/write lease, budget reservation, valid failure count, evidence/manifest, pending approval, DIR review, next safe action. 현재 구조화 객체는 projection을 제공하되 단일 의미 필드를 둘 이상 충돌하게 저장하지 않는다.

추가로 `schema_version`, `snapshot_id`, monotonic `event_sequence`, `snapshot_hash`, `updated_at`, `last_event_id`, root approval binding, derived baseline binding, Git local/remote commit·branch·upstream·status, active/last accepted WorkInstruction 분리, reporting decision을 검증한다. failure ledger·nonsemantic registry·DIR checkpoint는 path/hash ref로 결박한다. `latest_evidence_refs`의 동일 path가 서로 다른 hash로 중복되면 거부한다.

### HANDOFF

사람용 Markdown이지만 machine-readable fenced JSON summary를 포함하고 build-progress의 `event_sequence`, 상태, current Package, last event, 기준선 hash, failure count, DIR 상태, repository HEAD/upstream, next safe action과 정확히 일치해야 한다. 불일치 상태에서 새 작업을 시작하지 않는다. 기존 역사 설명은 current recovery summary와 분리한다.

### failure ledger

- canonical key는 `(step_lineage_id, failure_fingerprint)`다.
- `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`를 구분한다.
- evidence와 validator acceptance가 있는 정식 `FAILURE_REPORT`만 `accepted=true`와 count 증가를 허용한다.
- 내부 재시도, tool/quota/permission/environment 중단, `INCOMPLETE`, rejected report는 count를 늘리지 않는다.
- 동일 key의 accepted sequence가 3이 되면 `MAIN_AGENT_TAKEOVER_REQUIRED`; 그 자체는 owner 보고 조건이 아니다.

### non-semantic revision binding

필수 필드: parent baseline ID, root human approval ID, artifact ID/path, old/new hash, semantic diff classification, changed clauses, impact, rationale, reconfirmed actor/time, root approval scope, derived scope. `derived_scope`가 root scope를 넓히거나 기능 범위·요구사항·중요 위험 변경을 `NON_SEMANTIC`으로 표시하면 거부한다.

### DIR checkpoint

- checkpoint: `DIR-1 | DIR-2 | DIR-3 | DIR-X`
- status: `NOT_REACHED | DIR_HOLD | REPORTING | WAITING_OWNER_DIRECTION | CLEARED`
- verdict: `ALIGNED | DRIFT_MINOR | DRIFT_MAJOR | DIVERGED | null`
- subject/evidence/baseline hash, trigger event, report ref, owner direction event, lease release, blocked next action을 보존한다.
- `ALIGNED`여도 owner direction Event 없이는 `CLEARED`, Gate 평가, 다음 Package lease를 허용하지 않는다.
- A-15/C-15/E-11 ACCEPTED 또는 canonical DIR-X trigger 뒤 자동 다음 Phase 예약을 거부한다.

### session recovery와 보고 결정

복구기는 진행/HANDOFF/Git/기준선 hash를 먼저 읽고 recovery summary를 만든다. `reporting_decision`은 `AUTO_CONTINUE | STOP_AND_REPORT_SCOPE_RISK | STOP_AND_REPORT_DIR` 중 하나다. 최신 사람 승인에 따라 routine Package 진행은 `AUTO_CONTINUE`이며, 나머지 두 상태만 대화 보고 전에 실행을 중단한다. 이 결정과 근거는 progress event에 남긴다.

## 허용 경로

- `docs/progress/**`
- `docs/governance/schemas/**`
- `tests/fixtures/g05/**`
- `scripts/check_project_progress.py`
- `tests/tooling/test_project_progress.py`
- `docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/G-05_COMPLETION_REPORT.md`
- 독립 Tester 전용 `docs/test_reports/G-05_TEST_REPORT*.md`

## 금지·제외 범위

- 설계서·작업계획서·검증매트릭스·테스트계획서·운영규칙·AGENTS.md 수정
- G-01~G-04 artifact/TestReport 수정 또는 증거 삭제
- 제품 API/UI/DB/migration/queue/Provider/Docker 구현
- dependency 설치, lockfile, network, WSL/server/DB 접속, 배포
- 실제 secret·credential 기록
- DIR 상태를 Package/Run 상태 enum에 합치기
- `ALIGNED`만으로 자동 `CLEARED` 처리
- rejected/incomplete failure를 유효 실패로 집계
- routine progress를 신산님에게 보고하거나 계속 여부를 묻기

## TDD·검증 절차

1. 먼저 `tests/tooling/test_project_progress.py`에 positive/negative test를 작성하고 RED를 실제 관찰한다.
2. 최소 schema, fixture, checker를 구현해 GREEN을 만든다.
3. 현재 `build-progress.json`과 `BUILD_HANDOFF.md`를 정본 schema에 맞게 정규화한다.
4. 다음 적대 변형을 모두 거부한다.
   - 15장 최소 필드 누락, duplicate evidence path/different hash, sequence 역행
   - progress/HANDOFF sequence·상태·다음 행동 불일치
   - rejected/INCOMPLETE failure count 증가, fingerprint만 같고 lineage가 다른 실패 합산
   - root approval 없는 파생 revision, old/new hash 동일, root scope 확대, semantic 변경 위장
   - `ALIGNED`지만 direction Event 없는 `CLEARED`, DIR_HOLD 중 lease/다음 Package 예약
   - A-15/C-15/E-11 뒤 DIR checkpoint 누락, canonical trigger 없는 DIR-X
   - routine 복구의 대화 보고 또는 scope/risk·DIR 상태의 자동 진행
5. checker CLI는 오류마다 안정적인 reason code와 nonzero exit를 반환한다.
6. G-04와 G-03 회귀를 함께 실행한다.

## verification_contract

```yaml
verification_contract:
  matrix_revision: "sha256:0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3"
  assigned_verification_ids: ["AV-STAT-014", "AV-STAT-015", "AV-STAT-016", "AV-STAT-041", "AV-STAT-042"]
  required_levels: ["L2", "L3", "L5", "L7"]
  required_evidence: ["E-PRG", "E-DEC", "E-EVT"]
  tester_entry_conditions:
    - "CompletionReport와 EvidenceManifest가 존재하고 target/delivered hash가 일치"
    - "Main Agent PRELIMINARY_ACCEPT 및 고정 revision"
  package_exit_conditions:
    - "작업계획서 15장 최소 필드 전부 존재"
    - "진행 갱신 범주 전부 fixture와 event로 검증"
    - "failure/nonsemantic/DIR/session recovery 적대 검증 PASS"
    - "blocking defect 0"
  regression_suite: "tests.tooling.test_project_progress + G-04/G-03 tooling suites"
  fixture_ids: ["G05-PROGRESS-001", "G05-FAILURE-001", "G05-NONSEMANTIC-001", "G05-DIR-001", "G05-RECOVERY-001"]
  environment: "ENV-LOCAL"
  immediate_stop_conditions:
    - "기능 범위·요구사항·중요 위험 변경 필요"
    - "DIR-1/2/3 또는 canonical DIR-X 실제 도달"
    - "승인 기준선 hash 불일치 또는 보호 경로 변경"
    - "secret 발견"
  evidence_manifest_required: true
  product_validation_criteria: []
  blocking_defect_policy: "CRITICAL 또는 blocking MAJOR 1건 이상이면 ACCEPTED 금지"
  release_decision_required: false
```

## 완료조건

1. 진행·failure·nonsemantic·DIR schema와 canonical fixture가 존재한다.
2. current progress/HANDOFF가 같은 sequence와 의미 상태를 가지며 schema/checker를 통과한다.
3. 15장 최소 필드와 모든 갱신 범주가 기계 검증된다.
4. 새 Session이 root human approval, 파생 baseline, 완료·실패, 다음 행동을 복원한다.
5. 최신 승인에 따른 보고 결정이 routine 자동 진행과 scope/risk·DIR 강제 중단을 정확히 구분한다.
6. 정식 실패만 집계하고 3번째 동일 실패에 Main 인수 상태를 만든다.
7. 비의미 binding이 root approval scope를 확장하지 못한다.
8. DIR_HOLD 이후 direction Event 없는 재개·Gate·lease가 거부된다.
9. 할당 검증 5개와 G-04/G-03 회귀가 PASS한다.
10. EvidenceManifest target/delivered hash가 일치하고 독립 Tester PASS 전 `ACCEPTED`, commit, G-06 시작을 금지한다.

## rollback 경계

G-05가 실패하면 G-05가 새로 만든 허용 경로와 G-05가 정규화한 progress/HANDOFF 변경만 이전 commit으로 되돌릴 수 있다. G-04 이전 기준선과 기존 증거는 수정하거나 삭제하지 않는다.

## 보고 계약

Developer는 내부 CompletionReport에만 `판정 → 판단 이유 → 조치` 순서로 기록한다. 변경 path, RED/GREEN 명령·exit·실제 출력, fixture/negative 결과, target/delivered hash, SKIPPED/BLOCKED/미검증 범위와 rollback을 포함한다. 신산님에게 routine Package 진행을 보고하지 않는다.
