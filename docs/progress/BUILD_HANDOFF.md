# F-18 WSL operational rehearsal R1 writer start

```json anvil-recovery-summary
{
  "event_sequence": 1515,
  "last_event_id": "evt_f18_local_1515_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r1-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r1",
    "subject_ref": "F-18/WSL_OPS_R1",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T03:07:45+09:00",
    "expires_at": "2026-09-25T15:07:45+09:00",
    "lease_epoch": 1,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-1-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-1-69247977e4e51781",
    "baseline_git_commit": "b865ccb3b0a3f978b67b8c9e69b626a49b0874f8",
    "dispatch_head": "b865ccb3b0a3f978b67b8c9e69b626a49b0874f8",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/deployment/wsl_operational.py",
      "tests/deploy/test_f18_wsl_operational.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r1-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r1",
    "subject_ref": "F-18/WSL_OPS_R1",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T03:07:45+09:00",
    "expires_at": "2026-09-25T15:07:45+09:00",
    "lease_epoch": 1,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-1-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-1-69247977e4e51781",
    "baseline_git_commit": "b865ccb3b0a3f978b67b8c9e69b626a49b0874f8",
    "dispatch_head": "b865ccb3b0a3f978b67b8c9e69b626a49b0874f8",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/deployment/wsl_operational.py",
      "tests/deploy/test_f18_wsl_operational.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r1-20260925-001",
    "write_epoch": 1,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-1-69247977e4e51781"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_WSL_OPS_PREFLIGHT_EXACT3",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_WSL_OPS_PREFLIGHT_EXACT3"
}
```

- Product write lease exact3; Production NOT_EXECUTED; F-19 blocked.
