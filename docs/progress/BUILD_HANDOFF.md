# F-18 WSL R38 OIDC host binding writer start

```json anvil-recovery-summary
{
  "event_sequence": 1621,
  "last_event_id": "evt_f18_local_1621_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r38-oidc-host-binding",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r38-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r38-oidc-host-binding",
    "subject_ref": "F-18/WSL_OPS_R38_OIDC_HOST_BINDING",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T21:48:57+09:00",
    "expires_at": "2026-09-27T09:48:57+09:00",
    "lease_epoch": 22,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-22-972e873bc2b3d57c",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-22-972e873bc2b3d57c",
    "baseline_git_commit": "cdce09c1d0689986ec4aefee7c4a8990d9fdf4d8",
    "dispatch_head": "cdce09c1d0689986ec4aefee7c4a8990d9fdf4d8",
    "path_scope": [
      "apps/api/anvil_api/asgi.py",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/api/test_oidc_asgi_binding.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r38-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r38-oidc-host-binding",
    "subject_ref": "F-18/WSL_OPS_R38_OIDC_HOST_BINDING",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T21:48:57+09:00",
    "expires_at": "2026-09-27T09:48:57+09:00",
    "lease_epoch": 22,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-22-972e873bc2b3d57c",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-22-972e873bc2b3d57c",
    "baseline_git_commit": "cdce09c1d0689986ec4aefee7c4a8990d9fdf4d8",
    "dispatch_head": "cdce09c1d0689986ec4aefee7c4a8990d9fdf4d8",
    "path_scope": [
      "apps/api/anvil_api/asgi.py",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/api/test_oidc_asgi_binding.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r38-20260926-001",
    "write_epoch": 22,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-22-972e873bc2b3d57c"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_OIDC_HOST_BINDING_EXACT3",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_OIDC_HOST_BINDING_EXACT3"
}
```

- R38 OIDC host binding exact3 only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
