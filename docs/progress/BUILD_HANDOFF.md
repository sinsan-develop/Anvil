# F-18 WSL operational rehearsal R3 runtime bundle writer start

```json anvil-recovery-summary
{
  "event_sequence": 1525,
  "last_event_id": "evt_f18_local_1525_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r3",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r3-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r3",
    "subject_ref": "F-18/WSL_OPS_R3_RUNTIME_BUNDLE",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T04:13:51+09:00",
    "expires_at": "2026-09-25T16:13:51+09:00",
    "lease_epoch": 3,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-3-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-3-69247977e4e51781",
    "baseline_git_commit": "0f0ff0df5495edcec8a3e49cacea516e5d1de3c6",
    "dispatch_head": "0f0ff0df5495edcec8a3e49cacea516e5d1de3c6",
    "path_scope": [
      "deploy/wsl/Dockerfile.web",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "pyproject.toml",
      "tests/deploy/test_f18_wsl_dependencies.py",
      "uv.lock"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r3-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r3",
    "subject_ref": "F-18/WSL_OPS_R3_RUNTIME_BUNDLE",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T04:13:51+09:00",
    "expires_at": "2026-09-25T16:13:51+09:00",
    "lease_epoch": 3,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-3-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-3-69247977e4e51781",
    "baseline_git_commit": "0f0ff0df5495edcec8a3e49cacea516e5d1de3c6",
    "dispatch_head": "0f0ff0df5495edcec8a3e49cacea516e5d1de3c6",
    "path_scope": [
      "deploy/wsl/Dockerfile.web",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "pyproject.toml",
      "tests/deploy/test_f18_wsl_dependencies.py",
      "uv.lock"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r3-20260925-001",
    "write_epoch": 3,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-3-69247977e4e51781"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_FIX_F18_WSL_RUNTIME_BUNDLE_EXACT5",
  "runtime_next_action": "DEVELOPER_FIX_F18_WSL_RUNTIME_BUNDLE_EXACT5"
}
```

- R2 leases revoked; R3 runtime bundle write lease exact5; Production NOT_EXECUTED; F-19 blocked.
