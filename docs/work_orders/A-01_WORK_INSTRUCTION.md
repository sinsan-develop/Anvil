# A-01 WorkInstruction — 전체 사용자 Journey·Phase Rail 정적 확정

## Artifact envelope

- artifact_id: `WI-A-01-20260811-001`
- artifact_type: `work_instruction`
- project_id: `anvil`
- package_id: `A-01`
- version: `1`
- artifact_status: `approved`
- package_status: `READY`
- content_hash: `파일 저장 후 SHA-256으로 결박`
- source_artifact_ids: `Anvil-Design-v2.6`, `Anvil-WorkPlan-v1.5`, `Anvil-ValidationMatrix-v1.3`, `Anvil-TestPlan-v1.4`, `Anvil-OperatingRules-v1.6`
- source_evidence_ids: `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001`, `A-01_PRECONDITION_TEST_REPORT`
- created_by: `{ actor_type: agent, actor_id: main-agent-eoul }`
- created_at: `2026-08-11T00:00:00+09:00`
- supersedes_artifact_id: `null`

## 승인·기준선 binding

- owner: `Main Agent 어울`
- executor: `developer-primary Subagent 1명`
- independent_tester: `구현 대화와 분리된 Tester Subagent 1명`
- root_human_approval_id: `APPROVAL-20260810-INTEGRATED-BASELINE-001`
- responsibility_approval_id: `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001`
- responsibility_approval_sha256: `9D440C46B0CD8F0F44C46B3143FCB1B4DF7322BF9A7E0BD0A52BCE8D873FA18F`
- precondition_test_report_sha256: `9555428AF1FA22C05A74010849564F3DA6160DAD9C1C736DBE5E0B3EBD998369`
- design_source_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- validation_matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- baseline_git_commit: `7422b07b85bcdcec52031e1b10098ab6ca089170`
- baseline_upstream: `origin/main`
- approval_scope: `A-01의 AV-UI-005 정적 journey artifact만. AV-FLOW-001 runtime은 A-05·B-03 및 A Gate에 유보한다.`

## 목표

아이디어 입력부터 대안 비교, 설계·계획 확정, 실행, 기술검증, ProductValidation, DefectAssessment, ReleaseDecision, 학습 반영까지 Anvil의 전체 사용자 여정을 하나의 정적 screen map과 Phase Rail로 확정한다. 정상·거부·보완·중단·재개 경로와 사람 결정·승인 지점을 빠짐없이 연결하되, 실제 브라우저·API·DB·Event runtime이 구현된 것처럼 표시하지 않는다.

## 선행조건

1. `A-01_PRECONDITION_TEST_REPORT.md`가 `PASS / READY_FOR_MAIN_ACCEPTANCE`다.
2. progress sequence 30이 `A-01 READY`, active WorkInstruction/worker lease/write lease `null`이다.
3. Git `main`, `origin/main`, 실제 remote main이 `7422b07b85bcdcec52031e1b10098ab6ca089170`으로 일치한다.
4. A-01 역색인은 `AV-UI-005` 단독이며 `AV-FLOW-001`은 A-05·B-03/A Gate에 남아 있다.

## 필수 산출물

1. `docs/architecture/a01/A-01_USER_JOURNEY.md`
   - 아이디어→ReleaseDecision→학습의 canonical 단계와 각 단계의 목적·입력·출력·다음 안전 행동
   - 정상·거부·보완·중단·재개 5개 end-to-end 경로
   - runtime 미구현 구간은 모두 `RUNTIME_DEFERRED / NOT_EXECUTED`
2. `docs/architecture/a01/A-01_SCREEN_MAP.md`
   - Workbench 중심의 전체 화면/패널 맵
   - 각 화면의 source artifact, 읽기/결정/승인/제어 책임, 진입·이탈 조건
   - 고정 12화면 강제가 아니라 progressive disclosure라는 경계
3. `docs/architecture/a01/A-01_PHASE_RAIL.md`
   - Idea, Design, Plan, Execute, Verify, Validate, Release, Learn 단계
   - 현재 상태, 완료, 대기, 차단, 중단, 재개, 보완 회귀를 구분하는 rail 규칙
4. `docs/architecture/a01/A-01_DECISION_APPROVAL_MAP.md`
   - 사람 결정·승인 지점, 대상 artifact/hash, actor, 허용 전이, 거부·보완 결과
   - 기능 범위·요구사항·중요 위험 변경과 routine 자동 진행의 경계
5. `docs/architecture/a01/A-01_PATH_CATALOG.json`
   - 위 5개 경로를 machine-readable step/edge/decision/terminal 구조로 표현
   - stable ID, source screen, target screen, trigger, guard, result, runtime_status 필수
6. `scripts/check_a01_journey.py`, `tests/tooling/test_a01_journey.py`, `tests/fixtures/a01/**`
   - 문서와 JSON catalog의 단계·edge·decision·상태·책임을 독립 재계산
7. `docs/validation/A-01_JOURNEY_VALIDATION.md`, `docs/evidence/manifests/A-01_EVIDENCE_MANIFEST.json`, `docs/completion_reports/A-01_COMPLETION_REPORT.md`
8. `docs/progress/**`의 비소급 event, progress, HANDOFF, detached digest 갱신

## canonical journey 단계

| 순서 | 단계 | 주 화면/패널 | 필수 결과 |
|---:|---|---|---|
| 1 | Idea Capture | Workbench Conversation | Intent 후보와 원문 보존 |
| 2 | Clarify & Alternatives | Proposal Compare | 대안·가정·미결정 표시 |
| 3 | Concept Decision | Decision Board | 선택·보류·거부·보완 결정 |
| 4 | Design Baseline | Design Baseline | 승인 대상 hash와 기준선 |
| 5 | Work Planning | Plan Workspace | WorkPlan·IterationPlan |
| 6 | WorkInstruction Approval | Approval Drawer | 실행 범위·금지·검증 계약 |
| 7 | Execution | Execution Control | Step·Subagent·예외·checkpoint |
| 8 | Completion Review | Completion | delivered artifact와 미완료 |
| 9 | Technical Test | Test & Evidence | 기술 판정과 실제 evidence |
| 10 | Product Validation | Validation | criterion별 사용자 기능판정 |
| 11 | Defect Assessment | Defect Board | blocking/non-blocking 분류 |
| 12 | Release Decision | Release Decision | RELEASE/REWORK/DEFER/REJECT |
| 13 | Learning Review | Learning Studio | reusable success/failure/correction 후보 |
| 14 | Skill·Hook Activation | Learning Journey | 평가·승인·활성·rollback 계보 |

단계 수는 canonical journey의 설명 단위이며 사용자에게 14개 독립 화면을 강제하지 않는다. Workbench와 progressive disclosure panel이 여러 단계를 한 화면에서 표현할 수 있다.

## 5개 필수 경로

1. `PATH-NORMAL`: 승인된 설계·계획→실행→기술 PASS→ProductValidation PASS→RELEASE→학습
2. `PATH-REJECT`: 대안 또는 ReleaseDecision에서 REJECT→종료/새 Intent 분기, 실행 자동 개방 금지
3. `PATH-REVISE`: 보완 요청→영향 artifact 새 revision→필요 승인→해당 단계로 회귀
4. `PATH-STOP`: 사용자 pause/cancel 또는 quota/안전 차단→checkpoint·중단 이유·다음 안전 행동
5. `PATH-RESUME`: 동일 hash·checkpoint·완료 단계 복원→중복 실행 없이 재개

각 경로는 시작·종료, 모든 중간 edge, 사람 개입 지점, 실패/차단의 정직한 표시를 가져야 한다. `SKIPPED`, `BLOCKED`, `NOT_EXECUTED`, fixture를 PASS로 표시하지 않는다.

## 화면·표현 계약

- 기준 viewport는 1920×1080이며 본문/폼 12px, 작은 설명 10px, 보조 9px, 사이드바 14px, 제목 16px다. A-01은 토큰 구현 Package가 아니므로 이 값은 후속 A-02 입력으로만 기록한다.
- 설명은 `i` tooltip/popover 인터페이스로 연결하고 상시 설명 박스를 설계하지 않는다.
- 사용자는 Python·DB·CLI 없이 현재 위치, 결정 필요사항, 승인 대상, 차단 이유, 다음 행동을 이해할 수 있어야 한다.
- Main Agent와 Developer/Tester/Subagent 역할, 실행 결과 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`를 혼동하지 않는다.
- 기술 테스트 PASS, ProductValidation, DefectAssessment, ReleaseDecision을 하나의 성공 상태로 합치지 않는다.
- 실제 runtime이 없는 A-01 정적 산출물에는 실제 클릭·API·영속 Event·same-origin Network가 검증됐다는 표현을 금지한다.

## 허용 경로

- `docs/architecture/a01/**`
- `scripts/check_a01_journey.py`
- `tests/tooling/test_a01_journey.py`
- `tests/fixtures/a01/**`
- `docs/validation/A-01_*`
- `docs/evidence/manifests/A-01_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/A-01_COMPLETION_REPORT.md`
- `docs/progress/**`
- 독립 Tester 전용 `docs/test_reports/A-01_TEST_REPORT*.md`

## 금지·제외 범위

- 권위 문서 5개, AGENTS.md, 승인·파생 기준선 수정
- `apps/**`, `packages/**`, DB/API/runtime/Provider/Docker 구현
- 브라우저 클릭·API·DB·Event·Network를 구현하거나 검증했다고 주장
- A-02 이후 화면 token/wireframe/prototype 구현 선점
- `AV-FLOW-001`을 A-01 판정에 재삽입하거나 정적 fixture로 runtime PASS 처리
- 기존 accepted evidence·historical event의 소급 수정
- commit/push, server/DB/WSL/ysna-server 접속·배포

## TDD·적대 검증

1. 먼저 validator test를 작성하고 validator/artifact 부재 RED를 실제 관찰한다.
2. 최소 산출물과 validator를 구현하여 GREEN으로 전환한다.
3. 다음 mutation을 모두 거부한다.
   - 필수 5경로 중 하나 누락, edge 단절, 시작/종료 없음
   - 승인 전 Execute 진입, REJECT 후 자동 실행, REWORK 후 구 hash 재사용
   - STOP checkpoint/사유/다음 행동 누락, RESUME 중복 실행 허용
   - 기술 PASS를 ProductValidation 또는 RELEASE로 승격
   - `NOT_EXECUTED|BLOCKED|SKIPPED`를 PASS로 표시
   - `AV-FLOW-001` A-01 재삽입 또는 runtime PASS 위조
   - 사람 actor·approval subject hash·decision result 누락
   - 문서와 catalog의 step/edge/decision 불일치
4. 기존 progress/G-07 책임 정합성 회귀를 함께 실행한다.

## verification_contract

```yaml
verification_contract:
  matrix_revision: "sha256:982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A"
  assigned_verification_ids: ["AV-UI-005"]
  required_levels: ["L7"]
  required_evidence: ["E-ART", "E-SHOT", "E-DEC", "E-MAN", "E-TEST"]
  verification_mode: "STATIC_ONLY"
  evidence_qualifier: "E-SHOT is a static screen-map render, not runtime UI evidence"
  tester_entry_conditions:
    - "5개 정적 journey artifact와 catalog, validator, report, manifest 존재"
    - "Main Agent PRELIMINARY_ACCEPT 및 고정 revision"
  package_exit_conditions:
    - "정상·거부·보완·중단·재개 5개 경로가 단절 없이 연결"
    - "모든 decision/approval point와 다음 안전 행동이 정적 화면 맵에 표시"
    - "AV-FLOW-001 runtime은 RUNTIME_DEFERRED / NOT_EXECUTED"
    - "blocking defect 0"
  regression_suite: "tests.tooling.test_a01_journey + tests.tooling.test_project_progress + tests.tooling.test_g07_baseline"
  fixture_ids: ["A01-JOURNEY-CANONICAL", "A01-JOURNEY-MUTATIONS"]
  environment: "ENV-LOCAL"
  immediate_stop_conditions:
    - "기능 범위·요구사항·중요 위험 변경 필요"
    - "DIR-1·DIR-2·DIR-3·DIR-X 도달"
    - "권위 문서 semantic drift 또는 승인 계보 불일치"
    - "실제 secret 발견"
  evidence_manifest_required: true
  product_validation_criteria: []
  blocking_defect_policy: "CRITICAL 또는 blocking MAJOR 1건 이상이면 ACCEPTED 금지"
  release_decision_required: false
```

`E-SHOT_STATIC`은 정적 screen map/Phase Rail render 증거이며 제품 runtime screenshot이 아니다. TestReport와 화면 캡션에 이 경계를 표시한다.

## 완료조건

1. 14개 canonical 단계와 5개 경로가 문서·catalog에서 동일하다.
2. 모든 edge에 trigger, guard, result, source/target, runtime_status가 있다.
3. 사람 결정·승인 지점이 대상 artifact/hash 및 거부·보완 결과와 연결된다.
4. 중단·재개는 checkpoint, 완료 단계, 중단 이유, 다음 안전 행동, 중복 실행 금지를 명시한다.
5. 기술검증·ProductValidation·DefectAssessment·ReleaseDecision·Learning이 분리된다.
6. Workbench progressive disclosure와 후속 A-02~A-15 책임 경계가 명확하다.
7. `AV-UI-005` 정적 검증과 회귀가 PASS하고 blocking defect가 0이다.
8. `AV-FLOW-001`은 `RUNTIME_DEFERRED / NOT_EXECUTED`이며 A-05·B-03/A Gate 책임을 유지한다.
9. EvidenceManifest target/delivered 및 raw artifact hash가 일치한다.
10. 독립 Tester PASS 전 `ACCEPTED`와 A-02 시작을 금지한다.

## rollback 경계

실패 시 A-01 신규 허용 경로와 A-01 progress/HANDOFF 변경만 되돌린다. 권위 문서, 승인, 파생 기준선, G/Phase Gate accepted evidence, A-01 사전조건 evidence는 수정·삭제하지 않는다.

## 보고 계약

Developer는 CompletionReport에만 `판정 → 판단 이유 → 조치`를 기록한다. 정식 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 분류한다. routine 진행은 신산님에게 보고하지 않으며 기능 범위·요구사항·중요 위험 변경 또는 DIR 도달 때만 즉시 멈춰 Main Agent에게 보고한다.
