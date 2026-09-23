# F-12 Provider Settings 통합 시작

```json anvil-recovery-summary
{
  "event_sequence": 1436,
  "last_event_id": "evt_f12_1436_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-12",
  "active_agent": "developer-primary-f12-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f12-r1-20260924-001",
    "actor_id": "developer-primary-f12-r1",
    "subject_ref": "F-12",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T04:04:00+09:00",
    "expires_at": "2026-09-24T16:04:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f12-r1-execution-fence-epoch-1-798ed952ad6900c8",
    "execution_fencing_token": "f12-r1-execution-fence-epoch-1-798ed952ad6900c8",
    "baseline_git_commit": "798ed952ad6900c87db2c0b2e1d6f71c2755f69c",
    "dispatch_head": "798ed952ad6900c87db2c0b2e1d6f71c2755f69c",
    "path_scope": [
      "docs/04_test_reports/F-12_COMPLETION_REPORT.md",
      "packages/api/provider_settings.py",
      "packages/api/runtime.py",
      "packages/bff/provider_settings.py",
      "packages/provider_settings/projection.py",
      "packages/provider_settings/service.py",
      "tests/api/test_f12_provider_settings_api.py",
      "tests/provider_settings/test_f12_settings.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f12-r1-20260924-001",
    "actor_id": "developer-primary-f12-r1",
    "subject_ref": "F-12",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T04:04:00+09:00",
    "expires_at": "2026-09-24T16:04:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f12-r1-write-fence-epoch-1-db2c0b2e1d6f71c2",
    "execution_fencing_token": "f12-r1-execution-fence-epoch-1-798ed952ad6900c8",
    "baseline_git_commit": "798ed952ad6900c87db2c0b2e1d6f71c2755f69c",
    "dispatch_head": "798ed952ad6900c87db2c0b2e1d6f71c2755f69c",
    "path_scope": [
      "docs/04_test_reports/F-12_COMPLETION_REPORT.md",
      "packages/api/provider_settings.py",
      "packages/api/runtime.py",
      "packages/bff/provider_settings.py",
      "packages/provider_settings/projection.py",
      "packages/provider_settings/service.py",
      "tests/api/test_f12_provider_settings_api.py",
      "tests/provider_settings/test_f12_settings.py"
    ],
    "worker_lease_id": "worker-lease-f12-r1-20260924-001",
    "write_epoch": 1,
    "write_fencing_token": "f12-r1-write-fence-epoch-1-db2c0b2e1d6f71c2"
  },
  "next_work_package": {
    "package_id": "F-13",
    "status": "BLOCKED_PENDING_F12_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F12_EXACT8",
  "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F12_EXACT8"
}
```
