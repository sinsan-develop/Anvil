# Phase B Gate WorkInstruction — dependency-safe exact 44 verification set

- artifact_id: `WI-PHASE-B-GATE-20260821-001`
- package_id: `PHASE_B_GATE`
- revision: `1`
- package/status: `ACTIVE`
- executor: `developer-primary-phase-b-gate`
- baseline_git_commit: `165a9bfff5e085bfec322c748e83464477642f8a`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- human_approval_ref: `docs/approvals/APPROVAL-20260821-PHASE-B-GATE-EXACT44-001.md`
- predecessor: `B-01~B-12 ACCEPTED`, `DIR-1 CLEARED`, `C-01 BLOCKED_PENDING_B_GATE`

## 목적

Phase B의 durable state, event, progress, queue, intervention, common API/BFF와 recovery가 설계된 운영 계약을 충족하는지 독립적으로 검증한다. Gate는 제품 기능을 추가하지 않으며 C-01을 시작하기 위한 readiness만 판정한다.

## Direct Gate verification IDs — exact 44

```text
AV-STAT-001~016,
AV-STAT-020, AV-STAT-026~027, AV-STAT-030~039, AV-STAT-043,
AV-SAFE-002~005, AV-SAFE-025, AV-SAFE-028~029, AV-SAFE-033,
AV-UI-016, AV-OPS-009,
AV-FLOW-002, AV-FLOW-010~012
```

`AV-STAT-021/022/023/024/025/028`은 후속 Package 책임으로 이관되어 Phase B Gate direct set에서 제외한다. `AV-STAT-029`는 정의되지 않았으므로 제외한다. Exclusion은 삭제가 아니며 후속 책임/미정의 상태를 EvidenceManifest에 기록한다.

## 검증 계약

- selector 재계산: 51 slots, 정의 50, direct 44, 후속 책임 6, undefined 1을 정확히 보고한다.
- 44개 ID 전량에 대해 required evidence, severity, level, owner package, actual execution status를 매핑한다.
- B-01~B-12 accepted evidence와 target/hash provenance를 재사용하되 다른 target/environment 증거를 PASS로 승격하지 않는다.
- FI-01~FI-08, progress/HANDOFF/DB event sequence, stale fencing, ACK, cancellation, budget, same-origin BFF/SSE 계약을 Gate 범위에 맞게 검증한다.
- 실제 API/DB/UI/browser/WSL/provider/deployment는 수행한 범위만 PASS로 기록하고 미실행은 `NOT_EXECUTED`로 남긴다.

## Developer exact write allowlist

- `docs/approvals/APPROVAL-20260821-PHASE-B-GATE-EXACT44-001.md`
- `docs/work_orders/PHASE_B_GATE_WORK_INSTRUCTION.md`
- `docs/work_orders/PHASE_B_GATE_INVOCATION_PROMPT.md`
- `docs/validation/PHASE_B_GATE_VALIDATION.md`
- `docs/evidence/manifests/PHASE_B_GATE_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/PHASE_B_GATE_COMPLETION_REPORT.md`
- `scripts/check_phase_b_gate.py`
- `tests/tooling/test_phase_b_gate.py`
- `scripts/check_project_progress.py`
- `tests/tooling/test_project_progress.py`

Main-owned projection paths (`docs/progress/**`) are not Developer write paths. Main will issue/revoke leases and append progress events separately.

## 금지·중단선

- 권위 문서 원문, B-01~B-12 accepted product/evidence, migrations, packages, API/UI/provider source 수정
- C-01 또는 메뉴별 기능 시작
- shared DB, WSL/ysna, production, deployment, external provider mutation
- selector를 44 이외로 변경하거나 `AV-STAT-029`를 추측 정의
- DIR 도달, semantic scope expansion, secret 발견 시 즉시 `BLOCKED` 보고

## 완료조건

checker/test와 validation/evidence/completion report가 exact 44 direct set, 6 deferred, 1 undefined를 동일하게 기록하고, assigned IDs·required evidence·actual execution boundary·rollback을 포함한다. Developer는 `COMPLETED` 또는 증거 부족 시 `INCOMPLETE/BLOCKED`를 보고하며 Gate `ACCEPTED`, C-01 시작, commit/push는 수행하지 않는다.
