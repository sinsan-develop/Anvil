# F-07 UPSTAGE adapter 시작

```json anvil-recovery-summary
{
  "event_sequence": 1396,
  "last_event_id": "evt_f07_1396_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-07",
  "active_agent": "developer-primary-f07-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f07-r1-20260924-001",
    "actor_id": "developer-primary-f07-r1",
    "subject_ref": "F-07",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T00:45:00+09:00",
    "expires_at": "2026-09-24T12:45:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f07-r1-execution-fence-epoch-1-f38880326e614b3e",
    "execution_fencing_token": "f07-r1-execution-fence-epoch-1-f38880326e614b3e",
    "baseline_git_commit": "f38880326e614b3e06a2b67ba7b1179957bdf3f1",
    "dispatch_head": "f38880326e614b3e06a2b67ba7b1179957bdf3f1",
    "path_scope": [
      "docs/04_test_reports/F-07_COMPLETION_REPORT.md",
      "packages/providers/upstage_adapter.py",
      "packages/providers/upstage_errors.py",
      "packages/providers/upstage_models.py",
      "tests/providers/test_upstage_adapter_f07.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f07-r1-20260924-001",
    "actor_id": "developer-primary-f07-r1",
    "subject_ref": "F-07",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T00:45:00+09:00",
    "expires_at": "2026-09-24T12:45:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f07-r1-write-fence-epoch-1-06a2b67ba7b11799",
    "execution_fencing_token": "f07-r1-execution-fence-epoch-1-f38880326e614b3e",
    "baseline_git_commit": "f38880326e614b3e06a2b67ba7b1179957bdf3f1",
    "dispatch_head": "f38880326e614b3e06a2b67ba7b1179957bdf3f1",
    "path_scope": [
      "docs/04_test_reports/F-07_COMPLETION_REPORT.md",
      "packages/providers/upstage_adapter.py",
      "packages/providers/upstage_errors.py",
      "packages/providers/upstage_models.py",
      "tests/providers/test_upstage_adapter_f07.py"
    ],
    "worker_lease_id": "worker-lease-f07-r1-20260924-001",
    "write_epoch": 1,
    "write_fencing_token": "f07-r1-write-fence-epoch-1-06a2b67ba7b11799"
  },
  "next_work_package": {
    "package_id": "F-08",
    "status": "BLOCKED_PENDING_F07_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F07_EXACT5",
  "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F07_EXACT5"
}
```
