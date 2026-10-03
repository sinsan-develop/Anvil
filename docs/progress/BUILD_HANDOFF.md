# F-20/U-01 R33T History Suite Repair start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2002,
  "last_event_id": "evt_f20_2002_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r33t",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r33t-historyfix1003a",
    "actor_id": "developer-primary-f20-u01-r33t",
    "subject_ref": "F-20/U01-R33T",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T10:30:16+00:00",
    "expires_at": "2026-10-03T22:30:16+00:00",
    "lease_epoch": 48,
    "fencing_token": "f20-u01-r33t-execution-fence-epoch-48-historyfix1003a",
    "execution_fencing_token": "f20-u01-r33t-execution-fence-epoch-48-historyfix1003a",
    "baseline_git_commit": "9ed778f2ae4fad4a7c13d3ac9896e9f961e328c8",
    "dispatch_head": "9ed778f2ae4fad4a7c13d3ac9896e9f961e328c8",
    "path_scope": [
      "tests/tooling/test_f20_u01_r2_projection.py",
      "tests/tooling/test_f20_u01_r2b_projection.py",
      "tests/tooling/test_f20_u01_r3b_projection.py",
      "tests/tooling/test_f20_u01_r4_projection.py",
      "tests/tooling/test_f20_u01_r5_projection.py",
      "tests/tooling/test_f20_u01_r6_projection.py",
      "tests/tooling/test_f20_u01_r6b_projection.py",
      "tests/tooling/test_f20_u01_r7_projection.py",
      "tests/tooling/test_f20_u01_r8_projection.py",
      "tests/tooling/test_f20_u01_r20_prep_projection.py",
      "tests/tooling/test_project_progress.py",
      "tests/verification/test_c01_l3_independent_acceptance.py",
      "docs/04_test_reports/F-20_U01_R33T_HISTORY_SUITE_REPAIR_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r33t-historyfix1003a",
    "actor_id": "developer-primary-f20-u01-r33t",
    "subject_ref": "F-20/U01-R33T",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T10:30:16+00:00",
    "expires_at": "2026-10-03T22:30:16+00:00",
    "lease_epoch": 48,
    "fencing_token": "f20-u01-r33t-write-fence-epoch-48-historyfix1003a",
    "execution_fencing_token": "f20-u01-r33t-execution-fence-epoch-48-historyfix1003a",
    "baseline_git_commit": "9ed778f2ae4fad4a7c13d3ac9896e9f961e328c8",
    "dispatch_head": "9ed778f2ae4fad4a7c13d3ac9896e9f961e328c8",
    "path_scope": [
      "tests/tooling/test_f20_u01_r2_projection.py",
      "tests/tooling/test_f20_u01_r2b_projection.py",
      "tests/tooling/test_f20_u01_r3b_projection.py",
      "tests/tooling/test_f20_u01_r4_projection.py",
      "tests/tooling/test_f20_u01_r5_projection.py",
      "tests/tooling/test_f20_u01_r6_projection.py",
      "tests/tooling/test_f20_u01_r6b_projection.py",
      "tests/tooling/test_f20_u01_r7_projection.py",
      "tests/tooling/test_f20_u01_r8_projection.py",
      "tests/tooling/test_f20_u01_r20_prep_projection.py",
      "tests/tooling/test_project_progress.py",
      "tests/verification/test_c01_l3_independent_acceptance.py",
      "docs/04_test_reports/F-20_U01_R33T_HISTORY_SUITE_REPAIR_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r33t-historyfix1003a",
    "write_epoch": 48,
    "write_fencing_token": "f20-u01-r33t-write-fence-epoch-48-historyfix1003a"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R33T_HISTORY_SUITE_REPAIR_IMPLEMENTATION",
  "repository_head": "9ed778f2ae4fad4a7c13d3ac9896e9f961e328c8",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Test-only R33T; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
