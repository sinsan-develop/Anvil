# F-18 WSL operational rehearsal R2 dependency writer start

```json anvil-recovery-summary
{
  "event_sequence": 1520,
  "last_event_id": "evt_f18_local_1520_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r2",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r2-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r2",
    "subject_ref": "F-18/WSL_OPS_R2_DEPENDENCY",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T03:42:00+09:00",
    "expires_at": "2026-09-25T15:42:00+09:00",
    "lease_epoch": 2,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-2-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-2-69247977e4e51781",
    "baseline_git_commit": "3b968e900b07d82f487090bf4de89748d057a221",
    "dispatch_head": "3b968e900b07d82f487090bf4de89748d057a221",
    "path_scope": [
      "deploy/wsl/requirements-runtime.txt",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "pyproject.toml",
      "tests/deploy/test_f18_wsl_dependencies.py",
      "uv.lock"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r2-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r2",
    "subject_ref": "F-18/WSL_OPS_R2_DEPENDENCY",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T03:42:00+09:00",
    "expires_at": "2026-09-25T15:42:00+09:00",
    "lease_epoch": 2,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-2-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-2-69247977e4e51781",
    "baseline_git_commit": "3b968e900b07d82f487090bf4de89748d057a221",
    "dispatch_head": "3b968e900b07d82f487090bf4de89748d057a221",
    "path_scope": [
      "deploy/wsl/requirements-runtime.txt",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "pyproject.toml",
      "tests/deploy/test_f18_wsl_dependencies.py",
      "uv.lock"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r2-20260925-001",
    "write_epoch": 2,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-2-69247977e4e51781"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_FIX_F18_WSL_LOCKED_CRYPTOGRAPHY_EXACT5",
  "runtime_next_action": "DEVELOPER_FIX_F18_WSL_LOCKED_CRYPTOGRAPHY_EXACT5"
}
```

- R1 leases revoked; R2 dependency write lease exact5; Production NOT_EXECUTED; F-19 blocked.
