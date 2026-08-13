# B-03 WorkInstruction — design intent and approval-lineage persistence

- artifact_id: `WI-B-03-20260814-001`
- package/status: `B-03 / READY`
- executor: `developer-primary-b03`
- baseline_git_commit: `a589b17f26991432de5cf48cfe95c441cdd6da39`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- source_matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- source_test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b02_acceptance_manifest_sha256: `3BF009A1610C7C4C0CCCC0581AC3C5DD9E1ECC7D32454D07E3BAA7BDBACD0996`
- assigned: `AV-FLOW-001`, `AV-FLOW-002`
- environment: `ENV-LOCAL`

## 목적과 완료 조건

Intent → ProposalSet → DecisionRecord → DesignSpecification → immutable DesignBaseline의 계보와 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 binding을 domain, repository, framework-neutral API contract로 영속화한다. root human approval을 정확히 복원하고 비의미 파생 baseline이 부모 승인 범위를 넓히지 못하며, 기능 범위·요구사항·중요 위험 변경은 사람 재승인 없이는 fail-closed 됨을 증명한다.

## 구현 계약

- B-01 domain과 B-02 persistence foundation을 변경하지 않고 상위 설계 artifact aggregate가 이들에 단방향으로 의존한다.
- 각 artifact는 종류가 구분된 ID, revision, canonical content hash, parent/source refs, actor와 UTC timestamp를 가진다.
- DesignBaseline은 승인된 specification과 DecisionRecord의 immutable snapshot이다. 승인된 revision을 제자리 변경하지 않는다.
- nonsemantic binding은 `parent_baseline_id`, `root_human_approval_id`, old/new hash, semantic diff, 영향, 근거, 재확정 actor·시각을 필수로 하며 scope 확대를 거부한다.
- 기능 범위·요구사항·중요 위험 변경 또는 root approval 누락은 `MAIN_RECONFIRMED_NON_SEMANTIC`으로 우회할 수 없다.
- API contract는 입력/출력·오류·승인 guard를 framework-neutral하게 고정한다. FastAPI route registry, auth middleware, BFF와 공개 API 확정은 B-11 범위이며 여기서 구현하지 않는다.
- `AV-FLOW-001`은 실제 사용 흐름에서 모호한 intent에 복수 proposal이 제시되고 인증된 사람 결정 전 baseline/실행이 열리지 않는 L4+L7 증거가 필요하다. 실행 가능한 local UI/API 환경이 없으면 fixture·정적 test를 runtime PASS로 승격하지 말고 `BLOCKED` 또는 `NOT_EXECUTED`로 보고한다.
- `AV-FLOW-002`는 확정·보류·후속 확장 결정이 다음 revision과 project version에 전달되는 E-ART/E-AUD 계보로 증명한다.
- 실제 provider, production, deployment, shared DB, WSL-server, 외부 API, 서버 직접 patch는 금지한다. local 격리 DB migration이 필요하면 B-02의 승인된 격리 경계만 사용하고 미실행을 명시한다.

## Developer exact file-level write allowlist

- `packages/design/__init__.py`
- `packages/design/models.py`
- `packages/design/lineage.py`
- `packages/design/service.py`
- `packages/persistence/design_repository.py`
- `packages/api/__init__.py`
- `packages/api/design_contracts.py`
- `migrations/versions/0002_design_artifacts.py`
- `tests/design/test_models.py`
- `tests/design/test_lineage.py`
- `tests/design/test_service.py`
- `tests/design/test_repository.py`
- `docs/validation/B-03_DESIGN_LINEAGE_VALIDATION.md`
- `docs/evidence/manifests/B-03_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-03_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01/B-02 산출물, dependency/config, 다른 package/app, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline, authority hash, B-02 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다.
2. missing root approval, in-place mutation, scope expansion, semantic-risk misclassification, parent/hash mismatch, decision carryover 손실을 테스트로 먼저 작성하고 intended RED를 기록한다.
3. 최소 구현 후 focused design tests, 기존 domain/persistence/tooling 전체를 실행한다.
4. `AV-FLOW-001` L4+L7 실제 흐름을 실행할 환경이 없으면 PASS가 아닌 `BLOCKED`/`NOT_EXECUTED`로 분리하고, `AV-FLOW-002` artifact/audit 증거와 혼동하지 않는다.
5. EvidenceManifest는 exact 15 paths, raw checksum, target hash, self-reference false를 고정한다.
6. CompletionReport에 변경 파일·diff·명령/exit code·실제/미실행 범위·잔여 위험·rollback을 기록한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push와 progress/HANDOFF 수정은 하지 않는다.

B-03 acceptance, B-04 시작, 실제 provider/production/deploy/공개 API 확정은 이 WorkInstruction 범위가 아니다.
