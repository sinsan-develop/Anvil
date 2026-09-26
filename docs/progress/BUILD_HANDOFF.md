# F-18 WSL R43A OIDC formal host static contract active

```json anvil-recovery-summary
{
  "event_sequence": 1646,
  "last_event_id": "evt_f18_local_1646_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r43a-oidc-formal-host",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r43a-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r43a-oidc-formal-host",
    "subject_ref": "F-18/WSL_OPS_R43A_OIDC_FORMAL_HOST",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T02:23:21+09:00",
    "expires_at": "2026-09-27T14:23:21+09:00",
    "lease_epoch": 27,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-27-955102978eb5c687",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-27-955102978eb5c687",
    "baseline_git_commit": "7bfa04fbcc4a487a8c43e4d176700bd0a410a1a2",
    "dispatch_head": "7bfa04fbcc4a487a8c43e4d176700bd0a410a1a2",
    "path_scope": [
      "deploy/wsl/compose.f18.oidc.yml",
      "deploy/wsl/nginx-f18-oidc.conf",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_oidc_formal_host_contract.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r43a-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r43a-oidc-formal-host",
    "subject_ref": "F-18/WSL_OPS_R43A_OIDC_FORMAL_HOST",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T02:23:21+09:00",
    "expires_at": "2026-09-27T14:23:21+09:00",
    "lease_epoch": 27,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-27-955102978eb5c687",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-27-955102978eb5c687",
    "baseline_git_commit": "7bfa04fbcc4a487a8c43e4d176700bd0a410a1a2",
    "dispatch_head": "7bfa04fbcc4a487a8c43e4d176700bd0a410a1a2",
    "path_scope": [
      "deploy/wsl/compose.f18.oidc.yml",
      "deploy/wsl/nginx-f18-oidc.conf",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_oidc_formal_host_contract.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r43a-20260927-001",
    "write_epoch": 27,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-27-955102978eb5c687"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_OIDC_FORMAL_HOST_R43A_EXACT4",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_OIDC_FORMAL_HOST_R43A_EXACT4"
}
```

- R43A exact4 static host contract only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
