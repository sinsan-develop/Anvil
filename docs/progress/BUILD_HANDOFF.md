# F-18 WSL R35 OIDC HTTP writer start

```json anvil-recovery-summary
{
  "event_sequence": 1606,
  "last_event_id": "evt_f18_local_1606_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r35-oidc-http",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r35-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r35-oidc-http",
    "subject_ref": "F-18/WSL_OPS_R35_OIDC_HTTP",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T19:19:27+09:00",
    "expires_at": "2026-09-27T07:19:27+09:00",
    "lease_epoch": 19,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-19-0d1c1d67771983f5",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-19-0d1c1d67771983f5",
    "baseline_git_commit": "d6a26006d466af9879dee24bb9b845418dacfda9",
    "dispatch_head": "d6a26006d466af9879dee24bb9b845418dacfda9",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/fastapi_app.py",
      "tests/api/test_oidc_http.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r35-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r35-oidc-http",
    "subject_ref": "F-18/WSL_OPS_R35_OIDC_HTTP",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T19:19:27+09:00",
    "expires_at": "2026-09-27T07:19:27+09:00",
    "lease_epoch": 19,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-19-0d1c1d67771983f5",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-19-0d1c1d67771983f5",
    "baseline_git_commit": "d6a26006d466af9879dee24bb9b845418dacfda9",
    "dispatch_head": "d6a26006d466af9879dee24bb9b845418dacfda9",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/fastapi_app.py",
      "tests/api/test_oidc_http.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r35-20260926-001",
    "write_epoch": 19,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-19-0d1c1d67771983f5"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_OIDC_HTTP_EXACT3",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_OIDC_HTTP_EXACT3"
}
```

- R35 same-origin OIDC HTTP exact3 only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
