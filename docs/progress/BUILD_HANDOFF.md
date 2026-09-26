# F-18 WSL R30 OIDC principal writer start

```json anvil-recovery-summary
{
  "event_sequence": 1581,
  "last_event_id": "evt_f18_local_1581_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r30-oidc-principal",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r30-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r30-oidc-principal",
    "subject_ref": "F-18/WSL_OPS_R30_OIDC_PRINCIPAL",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T12:10:15+09:00",
    "expires_at": "2026-09-27T00:10:15+09:00",
    "lease_epoch": 14,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-14-1dfe23d453a93fca",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-14-1dfe23d453a93fca",
    "baseline_git_commit": "d9b384b01b003e06d327e7cd9c2bd4e98e97b298",
    "dispatch_head": "d9b384b01b003e06d327e7cd9c2bd4e98e97b298",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_principal.py",
      "tests/api/test_oidc_principal.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r30-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r30-oidc-principal",
    "subject_ref": "F-18/WSL_OPS_R30_OIDC_PRINCIPAL",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T12:10:15+09:00",
    "expires_at": "2026-09-27T00:10:15+09:00",
    "lease_epoch": 14,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-14-1dfe23d453a93fca",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-14-1dfe23d453a93fca",
    "baseline_git_commit": "d9b384b01b003e06d327e7cd9c2bd4e98e97b298",
    "dispatch_head": "d9b384b01b003e06d327e7cd9c2bd4e98e97b298",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_principal.py",
      "tests/api/test_oidc_principal.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r30-20260926-001",
    "write_epoch": 14,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-14-1dfe23d453a93fca"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_OIDC_PRINCIPAL_EXACT3",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_OIDC_PRINCIPAL_EXACT3"
}
```

- R30 OIDC principal exact3 only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
