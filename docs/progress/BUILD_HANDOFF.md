# F-18 WSL R41 OIDC PG18 integration writer start

```json anvil-recovery-summary
{
  "event_sequence": 1636,
  "last_event_id": "evt_f18_local_1636_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r41-oidc-pg18",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r41-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r41-oidc-pg18",
    "subject_ref": "F-18/WSL_OPS_R41_OIDC_PG18",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T00:14:41+09:00",
    "expires_at": "2026-09-27T12:14:41+09:00",
    "lease_epoch": 25,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-25-243ad642d2d091ad",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-25-243ad642d2d091ad",
    "baseline_git_commit": "c4f483223984dc9a5c1a8caef76b8e10742ae598",
    "dispatch_head": "c4f483223984dc9a5c1a8caef76b8e10742ae598",
    "path_scope": [
      "apps/api/anvil_api/asgi.py",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/api/test_oidc_asgi_binding.py",
      "tests/integration/f18_oidc_live_host.py",
      "tests/integration/test_f18_oidc_pg18.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r41-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r41-oidc-pg18",
    "subject_ref": "F-18/WSL_OPS_R41_OIDC_PG18",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T00:14:41+09:00",
    "expires_at": "2026-09-27T12:14:41+09:00",
    "lease_epoch": 25,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-25-243ad642d2d091ad",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-25-243ad642d2d091ad",
    "baseline_git_commit": "c4f483223984dc9a5c1a8caef76b8e10742ae598",
    "dispatch_head": "c4f483223984dc9a5c1a8caef76b8e10742ae598",
    "path_scope": [
      "apps/api/anvil_api/asgi.py",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/api/test_oidc_asgi_binding.py",
      "tests/integration/f18_oidc_live_host.py",
      "tests/integration/test_f18_oidc_pg18.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r41-20260927-001",
    "write_epoch": 25,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-25-243ad642d2d091ad"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_OIDC_PG18_EXACT5",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_OIDC_PG18_EXACT5"
}
```

- R41 OIDC PG18 integration exact5 only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
