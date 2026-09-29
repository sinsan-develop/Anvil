# F-20/U-01 R8 Queue source handoff

```json anvil-recovery-summary
{
  "event_sequence": 1840,
  "last_event_id": "evt_f20_1840_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r8",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r8-fadec1ac",
    "actor_id": "developer-primary-f20-u01-r8",
    "subject_ref": "F-20/U01-R8",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T11:34:06+00:00",
    "expires_at": "2026-09-29T23:34:06+00:00",
    "lease_epoch": 21,
    "fencing_token": "f20-u01-r8-execution-fence-epoch-21-fadec1ac",
    "execution_fencing_token": "f20-u01-r8-execution-fence-epoch-21-fadec1ac",
    "baseline_git_commit": "989b7a38c927f925c5d3d882ade1d381c930b85a",
    "dispatch_head": "989b7a38c927f925c5d3d882ade1d381c930b85a",
    "path_scope": [
      "packages/persistence/operations_queue_read.py",
      "tests/persistence/test_f20_u01_r8_queue_read.py",
      "docs/04_test_reports/F-20_U01_R8_QUEUE_READ_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r8-fadec1ac",
    "actor_id": "developer-primary-f20-u01-r8",
    "subject_ref": "F-20/U01-R8",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T11:34:06+00:00",
    "expires_at": "2026-09-29T23:34:06+00:00",
    "lease_epoch": 21,
    "fencing_token": "f20-u01-r8-write-fence-epoch-21-fadec1ac",
    "execution_fencing_token": "f20-u01-r8-execution-fence-epoch-21-fadec1ac",
    "baseline_git_commit": "989b7a38c927f925c5d3d882ade1d381c930b85a",
    "dispatch_head": "989b7a38c927f925c5d3d882ade1d381c930b85a",
    "path_scope": [
      "packages/persistence/operations_queue_read.py",
      "tests/persistence/test_f20_u01_r8_queue_read.py",
      "docs/04_test_reports/F-20_U01_R8_QUEUE_READ_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r8-fadec1ac",
    "write_epoch": 21,
    "write_fencing_token": "f20-u01-r8-write-fence-epoch-21-fadec1ac"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R8_SCOPED_QUEUE_SOURCE_IMPLEMENTATION",
  "repository_head": "989b7a38c927f925c5d3d882ade1d381c930b85a",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
