# F-20/U-01 R12 scoped Run read handoff

```json anvil-recovery-summary
{
  "event_sequence": 1864,
  "last_event_id": "evt_f20_1864_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r12",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r12-r12run3009a",
    "actor_id": "developer-primary-f20-u01-r12",
    "subject_ref": "F-20/U01-R12",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T22:18:11+00:00",
    "expires_at": "2026-09-30T10:18:11+00:00",
    "lease_epoch": 25,
    "fencing_token": "f20-u01-r12-execution-fence-epoch-25-r12run3009a",
    "execution_fencing_token": "f20-u01-r12-execution-fence-epoch-25-r12run3009a",
    "baseline_git_commit": "b31fc6856eadc30d8fb9c2a1cbf8c2c4141cde41",
    "dispatch_head": "b31fc6856eadc30d8fb9c2a1cbf8c2c4141cde41",
    "path_scope": [
      "packages/persistence/operations_run_read.py",
      "tests/persistence/test_f20_u01_run_read.py",
      "docs/04_test_reports/F-20_U01_R12_SCOPED_RUN_READ_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r12-r12run3009a",
    "actor_id": "developer-primary-f20-u01-r12",
    "subject_ref": "F-20/U01-R12",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T22:18:11+00:00",
    "expires_at": "2026-09-30T10:18:11+00:00",
    "lease_epoch": 25,
    "fencing_token": "f20-u01-r12-write-fence-epoch-25-r12run3009a",
    "execution_fencing_token": "f20-u01-r12-execution-fence-epoch-25-r12run3009a",
    "baseline_git_commit": "b31fc6856eadc30d8fb9c2a1cbf8c2c4141cde41",
    "dispatch_head": "b31fc6856eadc30d8fb9c2a1cbf8c2c4141cde41",
    "path_scope": [
      "packages/persistence/operations_run_read.py",
      "tests/persistence/test_f20_u01_run_read.py",
      "docs/04_test_reports/F-20_U01_R12_SCOPED_RUN_READ_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r12-r12run3009a",
    "write_epoch": 25,
    "write_fencing_token": "f20-u01-r12-write-fence-epoch-25-r12run3009a"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R12_SCOPED_RUN_READ_IMPLEMENTATION",
  "repository_head": "b31fc6856eadc30d8fb9c2a1cbf8c2c4141cde41",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
