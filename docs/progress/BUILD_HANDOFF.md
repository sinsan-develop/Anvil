# F-18 WSL R32 OIDC trusted-directory writer start

```json anvil-recovery-summary
{
  "event_sequence": 1591,
  "last_event_id": "evt_f18_local_1591_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r32-trusted-directory",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r32-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r32-trusted-directory",
    "subject_ref": "F-18/WSL_OPS_R32_TRUSTED_DIRECTORY",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T14:47:00+09:00",
    "expires_at": "2026-09-27T02:47:00+09:00",
    "lease_epoch": 16,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-16-ae3d7b24165ff9d",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-16-ae3d7b24165ff9d",
    "baseline_git_commit": "aaa00fc7f6ab6df1979cd93fffeb21eba265e802",
    "dispatch_head": "aaa00fc7f6ab6df1979cd93fffeb21eba265e802",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "migrations/versions/0018_oidc_principal_directory.py",
      "packages/persistence/oidc_principal_directory.py",
      "tests/persistence/test_oidc_principal_directory.py",
      "tests/persistence/test_oidc_principal_directory_postgres.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r32-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r32-trusted-directory",
    "subject_ref": "F-18/WSL_OPS_R32_TRUSTED_DIRECTORY",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T14:47:00+09:00",
    "expires_at": "2026-09-27T02:47:00+09:00",
    "lease_epoch": 16,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-16-ae3d7b24165ff9d",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-16-ae3d7b24165ff9d",
    "baseline_git_commit": "aaa00fc7f6ab6df1979cd93fffeb21eba265e802",
    "dispatch_head": "aaa00fc7f6ab6df1979cd93fffeb21eba265e802",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "migrations/versions/0018_oidc_principal_directory.py",
      "packages/persistence/oidc_principal_directory.py",
      "tests/persistence/test_oidc_principal_directory.py",
      "tests/persistence/test_oidc_principal_directory_postgres.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r32-20260926-001",
    "write_epoch": 16,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-16-ae3d7b24165ff9d"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_OIDC_TRUSTED_DIRECTORY_EXACT5",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_OIDC_TRUSTED_DIRECTORY_EXACT5"
}
```

- R32 OIDC trusted directory exact5 only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
