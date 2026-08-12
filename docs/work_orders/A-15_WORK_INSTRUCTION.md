# A-15 WorkInstruction — Artifact·§49 상태·API·화면 필드 Trace와 사용자 UX 승인

- artifact_id: `WI-A-15-20260813-001`
- package/status: `A-15 / READY`
- executor: `developer-primary-a15`
- baseline_git_commit: `4bb8155e2d4a6bae7db57d2832716bd08eb0e4f9`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- source_matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- source_test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- predecessor_acceptance_manifest_sha256: `910900E99464B00E362F1895BA55389550EF740DBE6177FB0A4E75D272A62C09`
- assigned: `AV-UI-015`, `AV-STAT-041`, `AV-STAT-042`
- environment: `ENV-LOCAL`
- result/runtime boundary: `STATIC_TRACE_CONTRACT_ONLY / USER_UX_APPROVAL_PENDING / DIR_NOT_REACHED`

## 목적

A-14에서 승인된 Workbench 화면을 기준으로 Artifact와 설계서 §49의 canonical aggregate·상태·API·화면 필드를 하나의 trace 계약으로 고정한다. ProductValidation·Defect·ReleaseDecision, DIR, worker/write fencing, budget reservation, egress/secret, EvidenceManifest, ReleaseManifest·deployment 상태가 source aggregate 또는 projection에 빠짐없이 연결되어야 하며 신산님이 실제 UX 승인 여부를 판단할 수 있는 검토 자료를 만든다.

## 구현 계약

- artifact schema는 §49.1~17의 canonical aggregate, enum, hash binding, 사람 전용 결정과 차단 코드를 source reference와 함께 고정한다.
- API draft는 §49.15 endpoint와 공통 mutation envelope(actor/role, `Idempotency-Key`, expected version/`If-Match`, target hash, permission scope, reason, audit Event)를 고정한다. 구현 또는 실제 호출을 하지 않는다.
- field trace matrix의 각 행은 `artifact/schema field → canonical source aggregate 또는 projection → API request/response field → A-14 화면/상태 표시 → 권한 → evidence/AV ID → runtime boundary`를 가져야 한다.
- 필수 trace 영역은 ProductValidation, Defect, ReleaseDecision, Apply/Deploy approval, DIR 4상태, worker/write fencing, budget reservation, DataEgressProfile, SecretRef, EvidenceManifest, ReleaseManifest, DeploymentRun·Monitoring이다.
- source aggregate와 projection을 구분하며 화면 read model이나 fixture를 canonical 원본으로 승격하지 않는다.
- 상태·필드의 근거 없는 발명, source 없는 화면 필드, 화면/API에만 존재하는 canonical write, 서로 다른 target/environment evidence 재사용을 fail-closed 한다.
- A-14 제품·browser evidence bytes를 수정하지 않는다. R5 실제 fixture browser 증거와 R6 IAB `ENVIRONMENT_BLOCKED / NOT_EXECUTED` 경계를 그대로 보존한다.
- 사용자 UX 검토 자료는 1920×1080·기본 12px·tooltip/popover 설명 원칙과 기존 A-14 화면을 기준으로 작성한다. Developer는 승인 요청만 만들며 신산님의 승인·서명·결정 Event를 대신 생성하지 않는다.
- A-15 Developer 완료만으로 DIR-1에 도달하지 않는다. 독립 Tester PASS와 Main acceptance 뒤 canonical trigger가 발생할 때만 `DIR_HOLD`를 생성한다.

## Developer exact file-level write allowlist

- `docs/architecture/a15/A-15_ARTIFACT_STATE_API_UI_TRACE.md`
- `docs/architecture/a15/A-15_ARTIFACT_SCHEMA.json`
- `docs/architecture/a15/A-15_API_DRAFT.json`
- `docs/architecture/a15/A-15_FIELD_TRACE_MATRIX.json`
- `docs/architecture/a15/A-15_USER_UX_APPROVAL_REQUEST.md`
- `tests/fixtures/a15/canonical-trace-contract.json`
- `tests/fixtures/a15/trace-mutations.json`
- `scripts/check_a15_artifact_state_api_ui_trace.py`
- `tests/tooling/test_a15_artifact_state_api_ui_trace.py`
- `docs/validation/A-15_ARTIFACT_STATE_API_UI_TRACE_VALIDATION.md`
- `docs/evidence/manifests/A-15_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/A-15_COMPLETION_REPORT.md`

`docs/approvals/A-15_USER_UX_APPROVAL.md`, DIR report/Event/checkpoint, authority, progress/HANDOFF, A-01~A-14 accepted evidence와 제품, `apps/**`, `packages/**`, dependencies/config, Git refs/index는 Developer 수정 금지다. network fetch, API/DB/browser/provider/WSL/production/deploy 실행도 금지한다.

## TDD·검증·완료 계약

1. 권위 문서, Developer AgentDefinition, A-14 accepted predecessor, epoch-1 worker/write token과 exact allowlist를 먼저 검증한다.
2. 누락 trace, source/projection 혼동, wrong enum/API/permission/evidence binding, 가짜 사람 승인, 조기 DIR을 각각 검출하는 테스트를 먼저 작성하고 intended RED를 기록한 뒤 최소 산출물로 GREEN한다.
3. focused A-15 checker/tests, project/G-07/Phase G/A-14 predecessor 회귀, 전체 tooling을 실행한다. JSON/raw target/self-reference false/exact diff/diff-check도 검증한다.
4. UX approval request는 승인할 항목, 근거 화면/trace, 미실행 범위, 승인·보완·반려 선택지를 명확히 제시하되 결과를 선기입하지 않는다.
5. EvidenceManifest는 exact 12 paths와 raw checksums/target hash를 고정한다. CompletionReport에는 명령·exit code·변경 파일·미실행·잔여 위험·rollback과 `USER_UX_APPROVAL_PENDING`을 기록한다.
6. Developer는 commit/push와 progress/HANDOFF/DIR 수정을 하지 않는다. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다.

제품 구현과 A-15 acceptance는 이 WorkInstruction 범위가 아니다. Developer 완료 후 Main은 lease 회수와 독립 Tester 진입만 수행하며, A-15 acceptance 전 DIR-1은 계속 `NOT_REACHED`다.
