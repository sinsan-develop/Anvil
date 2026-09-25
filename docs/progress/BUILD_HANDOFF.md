# F-18 WSL R10 OIDC token transport writer start

```json anvil-recovery-summary
{
  "event_sequence": 1551,
  "last_event_id": "evt_f18_local_1551_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r10-oidc-transport",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r10-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r10-oidc-transport",
    "subject_ref": "F-18/WSL_OPS_R10_OIDC_TRANSPORT",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T15:59:07+09:00",
    "expires_at": "2026-09-26T03:59:07+09:00",
    "lease_epoch": 8,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-8-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-8-69247977e4e51781",
    "baseline_git_commit": "46e45ed1bc2cd1cea98d267de1703b83a0799b32",
    "dispatch_head": "46e45ed1bc2cd1cea98d267de1703b83a0799b32",
    "path_scope": [
      "deploy/wsl/requirements-runtime.txt",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_issuer_transport.py",
      "pyproject.toml",
      "tests/api/test_oidc_issuer_transport.py",
      "uv.lock"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r10-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r10-oidc-transport",
    "subject_ref": "F-18/WSL_OPS_R10_OIDC_TRANSPORT",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T15:59:07+09:00",
    "expires_at": "2026-09-26T03:59:07+09:00",
    "lease_epoch": 8,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-8-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-8-69247977e4e51781",
    "baseline_git_commit": "46e45ed1bc2cd1cea98d267de1703b83a0799b32",
    "dispatch_head": "46e45ed1bc2cd1cea98d267de1703b83a0799b32",
    "path_scope": [
      "deploy/wsl/requirements-runtime.txt",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_issuer_transport.py",
      "pyproject.toml",
      "tests/api/test_oidc_issuer_transport.py",
      "uv.lock"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r10-20260925-001",
    "write_epoch": 8,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-8-69247977e4e51781"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_BUILD_F18_OIDC_TRANSPORT_EXACT6",
  "runtime_next_action": "DEVELOPER_BUILD_F18_OIDC_TRANSPORT_EXACT6"
}
```

- R10 exact6 token transport only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
