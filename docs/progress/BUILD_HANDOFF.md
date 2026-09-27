# F-20 R4 append-only lease handoff and historical test rework

```json anvil-recovery-summary
{
  "event_sequence": 1737,
  "last_event_id": "evt_f20_1737_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-r4",
  "worker_lease": {
    "lease_id": "worker-lease-f20-r4-2f3b14c1",
    "actor_id": "developer-primary-f20-r4",
    "subject_ref": "F-20/R4",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T19:09:26+00:00",
    "expires_at": "2026-09-28T07:09:26+00:00",
    "lease_epoch": 4,
    "fencing_token": "f20-r4-execution-fence-epoch-4-2f3b14c1",
    "execution_fencing_token": "f20-r4-execution-fence-epoch-4-2f3b14c1",
    "baseline_git_commit": "508d6cef57bc2ca30801b3574aaac2fb12017215",
    "dispatch_head": "508d6cef57bc2ca30801b3574aaac2fb12017215",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R4_RESULT.md",
      "tests/integration/test_c30_contract_matrix.py",
      "tests/tooling/test_a13_repository_scan.py",
      "tests/tooling/test_f18_wsl_ops_r12_overlay.py",
      "tests/tooling/test_phase_b_gate.py",
      "tests/verification/test_c01_l3_independent_acceptance.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-r4-2f3b14c1",
    "actor_id": "developer-primary-f20-r4",
    "subject_ref": "F-20/R4",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T19:09:26+00:00",
    "expires_at": "2026-09-28T07:09:26+00:00",
    "lease_epoch": 4,
    "fencing_token": "f20-r4-write-fence-epoch-4-2f3b14c1",
    "execution_fencing_token": "f20-r4-execution-fence-epoch-4-2f3b14c1",
    "baseline_git_commit": "508d6cef57bc2ca30801b3574aaac2fb12017215",
    "dispatch_head": "508d6cef57bc2ca30801b3574aaac2fb12017215",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R4_RESULT.md",
      "tests/integration/test_c30_contract_matrix.py",
      "tests/tooling/test_a13_repository_scan.py",
      "tests/tooling/test_f18_wsl_ops_r12_overlay.py",
      "tests/tooling/test_phase_b_gate.py",
      "tests/verification/test_c01_l3_independent_acceptance.py"
    ],
    "worker_lease_id": "worker-lease-f20-r4-2f3b14c1",
    "write_epoch": 4,
    "write_fencing_token": "f20-r4-write-fence-epoch-4-2f3b14c1"
  },
  "next_safe_action": "F20_R4_HISTORICAL_TEST_REWORK",
  "repository_head": "508d6cef57bc2ca30801b3574aaac2fb12017215",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- F-20 incomplete; Production NOT_EXECUTED.
