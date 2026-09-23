# F-14 PostgreSQL recovery start

```json anvil-recovery-summary
{
  "event_sequence": 1459,
  "last_event_id": "evt_f14_1459_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-14",
  "active_agent": "developer-primary-f14-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f14-r1-20260924-001",
    "actor_id": "developer-primary-f14-r1",
    "subject_ref": "F-14",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T08:39:00+09:00",
    "expires_at": "2026-09-24T20:39:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f14-r1-execution-fence-epoch-1-1584523ccca71bae",
    "execution_fencing_token": "f14-r1-execution-fence-epoch-1-1584523ccca71bae",
    "baseline_git_commit": "1584523ccca71bae4b3be01f592c7eb79c11935f",
    "dispatch_head": "1584523ccca71bae4b3be01f592c7eb79c11935f",
    "path_scope": [
      "docs/04_test_reports/F-14_COMPLETION_REPORT.md",
      "migrations/versions/0016_operations_recovery.py",
      "packages/persistence/operations_repository.py",
      "packages/recovery/__init__.py",
      "packages/recovery/disaster.py",
      "packages/recovery/retention.py",
      "packages/recovery/runbook.py",
      "tests/integration/test_f14_postgres_compat.py",
      "tests/persistence/test_f14_operations_repository.py",
      "tests/recovery/test_f14_disaster.py",
      "tests/recovery/test_f14_retention.py",
      "tests/recovery/test_f14_runbook.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f14-r1-20260924-001",
    "actor_id": "developer-primary-f14-r1",
    "subject_ref": "F-14",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T08:39:00+09:00",
    "expires_at": "2026-09-24T20:39:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f14-r1-write-fence-epoch-1-4b3be01f592c7eb7",
    "execution_fencing_token": "f14-r1-execution-fence-epoch-1-1584523ccca71bae",
    "baseline_git_commit": "1584523ccca71bae4b3be01f592c7eb79c11935f",
    "dispatch_head": "1584523ccca71bae4b3be01f592c7eb79c11935f",
    "path_scope": [
      "docs/04_test_reports/F-14_COMPLETION_REPORT.md",
      "migrations/versions/0016_operations_recovery.py",
      "packages/persistence/operations_repository.py",
      "packages/recovery/__init__.py",
      "packages/recovery/disaster.py",
      "packages/recovery/retention.py",
      "packages/recovery/runbook.py",
      "tests/integration/test_f14_postgres_compat.py",
      "tests/persistence/test_f14_operations_repository.py",
      "tests/recovery/test_f14_disaster.py",
      "tests/recovery/test_f14_retention.py",
      "tests/recovery/test_f14_runbook.py"
    ],
    "worker_lease_id": "worker-lease-f14-r1-20260924-001",
    "write_epoch": 1,
    "write_fencing_token": "f14-r1-write-fence-epoch-1-4b3be01f592c7eb7"
  },
  "next_work_package": {
    "package_id": "F-15",
    "status": "BLOCKED_PENDING_F14_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F14_EXACT12",
  "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F14_EXACT12"
}
```
