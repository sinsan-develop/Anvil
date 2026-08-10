# Phase G Gate WorkInstruction

- artifact_id: `WI-PHASE-G-GATE-20260810-001`
- package_id: `PHASE_G_GATE`
- revision: `1`
- package_status_on_developer_exit: `TEST_REVIEW`
- baseline_git_head: `23bc0019aeba0d6ae2b04c52fad6c778d8b7b6e8`
- design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- work_plan_sha256: `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475`
- matrix_sha256: `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3`
- test_plan_sha256: `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5`
- operating_rules_sha256: `7D5E2AD0F272CBA1052EA8A21622F1E16438ABAB9AA4AAB7A1D34374B4FFB5F3`
- G-07 accepted immutable manifest: `docs/evidence/manifests/G-07_EVIDENCE_MANIFEST_R2.json` / `7967674B6CBDA114ADF530C98B94BFB062888278F05AF7A9A775EA64EBE46320`
- G-07 independent TestReport: `docs/test_reports/G-07_TEST_REPORT.md` / `8F3C8CF31FA31DA7908F308953BFDDC9141327AB46D70AD4909CEFD540270DAF`

## 판정 목표

G-01~G-07 수락 증거와 Phase G Gate 조건을 독립적으로 재계산해 `COMPLETED / TEST_REVIEW` 증거만 만든다. Developer는 Gate `ACCEPTED`, `PHASE_GATE_DECIDED`, A-01 READY/시작, commit, push를 수행하지 않는다. 기존 standing approval은 본 Gate 보고서의 직접 승인으로 해석하거나 기록하지 않는다.

## reconstruction_contract

```json
{
  "contract_version": "1.0.0",
  "inputs": [
    "Anvil_설계서_v2.md",
    "Anvil_작업계획서_v1.md",
    "Anvil_통합검증매트릭스_v1.md",
    "Anvil_테스트계획서_v1.md",
    "AGENTS.md",
    "docs/governance/ANVIL_OPERATING_RULES.md",
    "docs/onboarding/developer-primary-ack.md",
    "docs/decisions/G-02_DECISION_RECORD.md",
    "docs/approvals/APPROVAL-20260810-INTEGRATED-BASELINE-001.md",
    "docs/progress/build-progress.json",
    "docs/progress/BUILD_HANDOFF.md",
    "docs/progress/progress-events.json"
  ],
  "checks": {
    "accepted_packages": ["G-01", "G-02", "G-03", "G-04", "G-05", "G-06", "G-07"],
    "decision_ids": ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10"],
    "lease_dry_run": ["worker_claim", "write_claim", "second_writer_rejected", "stale_worker_rejected", "valid_commit", "stale_write_rejected", "write_revoke", "worker_revoke"],
    "document_sync_count": 7,
    "package_count": 97,
    "unique_av_count": 255,
    "scenario_count": 20,
    "key_verifications": ["AV-FLOW-003", "AV-STAT-015", "AV-STAT-016", "AV-GATE-026", "AV-CON-016(RV)"]
  },
  "outputs": [
    "scripts/check_phase_g_gate.py",
    "tests/tooling/test_phase_g_gate.py",
    "tests/fixtures/phase_g_gate/lease-dry-run.json",
    "docs/validation/PHASE_G_GATE_VERIFICATION_REPORT.json",
    "docs/validation/PHASE_G_GATE_VERIFICATION_REPORT.md",
    "docs/completion_reports/PHASE_G_GATE_COMPLETION_REPORT.md",
    "docs/evidence/manifests/PHASE_G_GATE_EVIDENCE_MANIFEST.json",
    "docs/progress/progress-handoff-detached-digest-phase-g-gate.json"
  ],
  "exit_projection": {
    "current_work_package": "PHASE_G_GATE",
    "status": "TEST_REVIEW",
    "next_conditional_package": "A-01",
    "next_safe_action": "Independent Tester verifies Phase G Gate evidence; Main may decide the Gate only after PASS",
    "g_gate_status": "NOT_DECIDED",
    "a01_start_allowed": false
  }
}
```

다른 Agent는 이 파일만으로 입력, 검증 항목, 산출물, 종료 투영과 금지선을 재구성해야 한다. Invocation은 이 내용을 복제하지 않고 artifact ID와 SHA만 전달한다.

## 검증 절차

1. 권위 문서 hash와 Git HEAD/upstream을 실제 파일·Git에서 확인한다.
2. G-01~G-07이 completed projection, 최종 독립 TestReport, target=delivered manifest, acceptance evidence로 수락됐는지 확인한다.
3. G-02 DecisionRecord와 사람 승인 계보에서 D1~D8·D10 `HUMAN_CONFIRMED`, D9 `BENCHMARK_POLICY_CONFIRMED`를 확인한다. standing approval을 Gate 직접 승인으로 승격하지 않는다.
4. synthetic dry-run fixture를 상태 전이로 실행해 하나의 worker lease에 종속된 하나의 write lease만 허용하고, 두 번째 writer와 stale execution token을 거부한 뒤 두 lease를 회수한다. 실제 shared lease를 발급하지 않는다.
5. `reconstruction_contract`를 WorkInstruction 파일에서 직접 파싱하고 required input/check/output/exit field의 누락·변형을 거부한다.
6. progress/HANDOFF가 Phase G Gate와 조건부 다음 Package A-01, 독립 Tester→Main Gate 판정 순서를 명확히 표현하는지 확인한다.
7. 작업계획의 97 Package, 매트릭스 255 unique AV와 97 역색인, §49.17 20 scenario, §49.18 7개 동기화 대상을 실제 Markdown/JSON에서 파싱한다.
8. 핵심 AV 5종의 독립 PASS evidence를 확인하고 G-07·G-06·G-05·G-04·G-03 전체 회귀를 fresh 실행한다.
9. wrong-but-nonempty package/decision/lease/reconstruction/progress/sync/AV mutation이 안정 reason code로 거부되는지 확인한다.

## 허용 경로

- `docs/work_orders/PHASE_G_GATE_WORK_INSTRUCTION.md`
- `docs/work_orders/PHASE_G_GATE_INVOCATION_PROMPT.md`
- `scripts/check_phase_g_gate.py`
- `tests/tooling/test_phase_g_gate.py`
- `tests/fixtures/phase_g_gate/**`
- `docs/validation/PHASE_G_GATE_VERIFICATION_REPORT.{json,md}`
- `docs/completion_reports/PHASE_G_GATE_COMPLETION_REPORT.md`
- `docs/evidence/manifests/PHASE_G_GATE_EVIDENCE_MANIFEST.json`
- `docs/progress/**`
- Gate projection 회귀에 필요한 `tests/tooling/test_project_progress.py` 최소 수정

## 금지·중단선

- 권위 문서, G-01~G-07 accepted evidence/TestReport/immutable manifest 수정
- 실제 제품 코드·DB·서버·배포·tag·lease 발급
- Gate `ACCEPTED`, `PHASE_GATE_DECIDED`, A-01 READY/시작, commit, push
- standing approval을 이 Gate 보고서에 대한 사람 직접 승인으로 기록
- 기능 범위·요구사항·중요 위험 변경 또는 실제 DIR 도달 시 즉시 중단·Main 보고

## 완료조건

필수 검증과 적대 mutation, 기존 전체 회귀가 PASS하고 report/manifest/progress/HANDOFF가 `TEST_REVIEW`, Gate `NOT_DECIDED`, A-01 `false`를 단방향 결박한다. Developer 완료는 독립 Tester 또는 Main Gate 수락이 아니다.
