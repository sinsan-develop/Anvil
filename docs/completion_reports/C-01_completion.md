# C-01 완료 및 Main acceptance

R4는 WI 항목7의 regression 수 오기20→18 및 epoch4/증거 metadata만 정정한다. 제품·테스트 판정 로직 변경0이다. Main full tooling697 PASS는 정정 이전 R3 exact20에서 실행됐으며 R4 이후 full suite 실행을 주장하지 않는다. Main 전달 Reviewer C0/I0/M1의 Minor1을 resolved로 보존한다.

```yaml
work_package_result:
  work_package_id: C-01
  status: COMPLETED
  design_baseline_hash: DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3
  work_instruction_hash: F99FE2D6C009E7B897130DD3802460258F5CF406BE973DA0939D49DAA5E367A5
  work_instruction_id: C-01_WORK_INSTRUCTION
  target_commit: 66c0e43a092215ea2e9be24606d7a28e10dff359
  target_hash: 66c0e43a092215ea2e9be24606d7a28e10dff359
  delivered_hash: 66c0e43a092215ea2e9be24606d7a28e10dff359
  initial_product_commit: f56ac2514d0c5bca41768e456ed57f2036ab3137
  product_changed_path_occurrences: 11
  product_unique_path_count: 9
  acceptance_projection_path_count: 20
  cumulative_unique_path_count: 28
  historical_accepted_failure_count: 32
  historical_ops_r2_failure_count: 2
  changed_paths:
    - docs/04_test_reports/C-01_IMPLEMENTATION_RESULT.md
    - docs/WORK_STATUS.md
    - docs/work_orders/C-01_WORK_INSTRUCTION.md
    - packages/llm_gateway/contracts.py
    - packages/orchestration/__init__.py
    - packages/orchestration/kernel.py
    - packages/orchestration/native_agent_adapter.py
    - tests/llm_gateway/test_c01_kernel.py
    - tests/orchestration/test_c01_native_agent_adapter.py
  actions_taken: [gateway_contract_correction, lifecycle_protocol, in_memory_budget_evidence, unknown_usage_reconciliation_preserved]
  tests: [historical_developer_test_rerun_18_passed, independent_design_round1_8_passed_1_failed, independent_design_round2_9_passed, fix_review_spec_pass_quality_approved]
  validation_ids: [AV-AGT-002, AV-AGT-003, AV-OPS-011]
  validation_environment: ENV-LOCAL-DETERMINISTIC-FAKE
  evidence_refs:
    - docs/04_test_reports/C-01_IMPLEMENTATION_RESULT.md
    - docs/test_reports/C-01_MAINLINE_INDEPENDENT_TEST_REPORT.md
    - docs/evidence/raw/C-01_BACKEND_CONTRACT_EVIDENCE.json
    - docs/evidence/raw/C-01_BUDGET_EVENT_EVIDENCE.json
  evidence_manifest_ref: docs/evidence/manifests/C-01_MAINLINE_ACCEPTANCE_MANIFEST.json
  skipped_or_blocked: []
  unverified_scope: [actual_coding_backends, backend_swap_e2e, Provider, network, Telegram, DB, API, browser, WSL, deployment, persistent_external_events, Release, user_acceptance]
  unresolved: []
  failure_fingerprint: null
  resolved_findings: [C01-ACCEPTANCE-INDEPENDENT-SCENARIO-MISSING-v1, C01-UNKNOWN-USAGE-CONSUMED-ZERO-RELEASE-v1, C01-G07-NULL-LINEAGE-LEGACY-CONSUMER-v1, C01-GIT-MUTATION-ERA-EXPECTATION-v1]
  full_tooling_attempt1: {failed: 20, passed: 673, exit_code: 1, seconds: '1675.07'}
  full_tooling_attempt2: {passed: 697, failed: 0, exit_code: 0, seconds: '1661.64', executor: MAIN_AGENT, execution_revision: R3_BEFORE_R4_CORRECTION}
  full_tooling_attempt2_parent_manifest_sha256: D79B87D632DA0C5ACE12190D93B8ECCFA0050A429965D46E00E5B1FAC8A15D4F
  full_tooling_rerun: PASS_R3_ATTEMPT2_BEFORE_R4_CORRECTION
  projection_revision: R4_MAIN_RECONFIRMED_NON_SEMANTIC
  projection_write_epoch: 4
  reviewer_final: {source: MAIN_RELAY_OF_REVIEWER_FINAL, spec: PASS, quality: APPROVED, critical: 0, important: 0, minor: 1}
  reviewer_minor_resolution: WI_ITEM7_REGRESSION_COUNT_20_TO_18_RESOLVED
  post_correction_main_gate: FOCUSED_CHECKER_CHECKSUM_DETERMINISM_PENDING_MAIN
  status_poll_wrapper_syntax_error_count: 1
  checkpoint_ref: docs/progress/build-progress.json
  next_action: C02_READY_FOR_WORK_INSTRUCTION
```

판정: Main `ACCEPTED`는 검증된 `LOCAL_FIXTURE_CONTRACT_SCOPE`에 한정한다. 판단 이유: 원 code review와 fix review SPEC/QUALITY 합격, 설계·matrix에서 별도 작성한 독립9 시나리오의 round1 8/1 및 제품 수정 후 round2 9/0을 product chain e215c061→f56ac251→66c0e43에 결박했다. 조치: seq715 canonical completion과 다음 C-02 readiness를 기록한다. 실제 외부/운영 검증, C Gate, 사용자 acceptance나 Release를 뜻하지 않는다.

이전 R1에서는 Developer tests18 재실행을 independent acceptance로 잘못 분류했다. Reviewer Important finding C0/I1/M0와 새 시나리오가 발견한 UNKNOWN usage reservation 조기 해제 실패를 보존하고, 현재는 각각 독립 설계 유도 suite와 product fix/동일 suite round2로 해소한다. UNKNOWN은 StepResult가 아니라 기존 UsageReconciliationRequired 예외 및 보존된 reservation으로 나타난다.

Git target/delivered hash는 동일 검토 fix commit이며 배포 artifact가 아니다. R3는 no-active current 역사32/map OPS-R2 2를 immutable ledger에서 도출하고 역사seq700 raw는 보존한다. rollback은 product fix 이후 acceptance projection exact20 diff만 역적용한다. status-poll syntax 오류는 non-product다.
