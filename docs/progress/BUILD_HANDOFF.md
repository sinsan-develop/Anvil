# F-17 WSL PG15 integration and isolated PG18 RC start

```json anvil-recovery-summary
{
  "event_sequence": 1486,
  "last_event_id": "evt_f17_1486_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-17",
  "active_agent": "developer-primary-f17-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f17-r1-20260924-001",
    "actor_id": "developer-primary-f17-r1",
    "subject_ref": "F-17",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T14:23:00+09:00",
    "expires_at": "2026-09-25T02:23:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f17-r1-execution-fence-epoch-1-3460d9768b039568",
    "execution_fencing_token": "f17-r1-execution-fence-epoch-1-3460d9768b039568",
    "baseline_git_commit": "3460d9768b039568022fd43e24577cc0e2402dea",
    "dispatch_head": "3460d9768b039568022fd43e24577cc0e2402dea",
    "path_scope": [
      "deploy/wsl/compose.f17.yml",
      "deploy/wsl/f17_validation.py",
      "docs/04_test_reports/F-17_COMPLETION_REPORT.md",
      "tests/deploy/test_f17_validation.py",
      "tests/integration/test_f17_runtime_e2e.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f17-r1-20260924-001",
    "actor_id": "developer-primary-f17-r1",
    "subject_ref": "F-17",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T14:23:00+09:00",
    "expires_at": "2026-09-25T02:23:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f17-r1-write-fence-epoch-1-022fd43e24577cc0",
    "execution_fencing_token": "f17-r1-execution-fence-epoch-1-3460d9768b039568",
    "baseline_git_commit": "3460d9768b039568022fd43e24577cc0e2402dea",
    "dispatch_head": "3460d9768b039568022fd43e24577cc0e2402dea",
    "path_scope": [
      "deploy/wsl/compose.f17.yml",
      "deploy/wsl/f17_validation.py",
      "docs/04_test_reports/F-17_COMPLETION_REPORT.md",
      "tests/deploy/test_f17_validation.py",
      "tests/integration/test_f17_runtime_e2e.py"
    ],
    "worker_lease_id": "worker-lease-f17-r1-20260924-001",
    "write_epoch": 1,
    "write_fencing_token": "f17-r1-write-fence-epoch-1-022fd43e24577cc0"
  },
  "next_work_package": {
    "package_id": "F-18",
    "status": "BLOCKED_PENDING_F17_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F17_EXACT5",
  "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F17_EXACT5"
}
```
