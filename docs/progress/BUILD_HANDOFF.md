# F-18 WSL R39 OIDC host configuration writer start

```json anvil-recovery-summary
{
  "event_sequence": 1626,
  "last_event_id": "evt_f18_local_1626_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r39-oidc-host-config",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r39-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r39-oidc-host-config",
    "subject_ref": "F-18/WSL_OPS_R39_OIDC_HOST_CONFIG",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T22:48:01+09:00",
    "expires_at": "2026-09-27T10:48:01+09:00",
    "lease_epoch": 23,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-23-3fcaae976c239536",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-23-3fcaae976c239536",
    "baseline_git_commit": "72fc16b705e7ad1099dc218ad351eaaccf617789",
    "dispatch_head": "72fc16b705e7ad1099dc218ad351eaaccf617789",
    "path_scope": [
      "apps/api/anvil_api/asgi.py",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/api/test_oidc_asgi_binding.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r39-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r39-oidc-host-config",
    "subject_ref": "F-18/WSL_OPS_R39_OIDC_HOST_CONFIG",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T22:48:01+09:00",
    "expires_at": "2026-09-27T10:48:01+09:00",
    "lease_epoch": 23,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-23-3fcaae976c239536",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-23-3fcaae976c239536",
    "baseline_git_commit": "72fc16b705e7ad1099dc218ad351eaaccf617789",
    "dispatch_head": "72fc16b705e7ad1099dc218ad351eaaccf617789",
    "path_scope": [
      "apps/api/anvil_api/asgi.py",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/api/test_oidc_asgi_binding.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r39-20260926-001",
    "write_epoch": 23,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-23-3fcaae976c239536"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_OIDC_HOST_CONFIG_EXACT3",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_OIDC_HOST_CONFIG_EXACT3"
}
```

- R39 OIDC host config exact3 only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
