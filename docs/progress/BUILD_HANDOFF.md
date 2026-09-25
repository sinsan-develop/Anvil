# F-18 WSL R7 ID Token verifier writer start

```json anvil-recovery-summary
{
  "event_sequence": 1536,
  "last_event_id": "evt_f18_local_1536_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r7-id-token",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r7-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r7-id-token",
    "subject_ref": "F-18/WSL_OPS_R7_ID_TOKEN",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T12:13:45+09:00",
    "expires_at": "2026-09-26T00:13:45+09:00",
    "lease_epoch": 5,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-5-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-5-69247977e4e51781",
    "baseline_git_commit": "aa4d71cbfb6f74a25e23ae3738eafe6b66ee96b6",
    "dispatch_head": "aa4d71cbfb6f74a25e23ae3738eafe6b66ee96b6",
    "path_scope": [
      "deploy/wsl/requirements-runtime.txt",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_identity.py",
      "pyproject.toml",
      "tests/api/test_oidc_identity.py",
      "uv.lock"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r7-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r7-id-token",
    "subject_ref": "F-18/WSL_OPS_R7_ID_TOKEN",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T12:13:45+09:00",
    "expires_at": "2026-09-26T00:13:45+09:00",
    "lease_epoch": 5,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-5-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-5-69247977e4e51781",
    "baseline_git_commit": "aa4d71cbfb6f74a25e23ae3738eafe6b66ee96b6",
    "dispatch_head": "aa4d71cbfb6f74a25e23ae3738eafe6b66ee96b6",
    "path_scope": [
      "deploy/wsl/requirements-runtime.txt",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_identity.py",
      "pyproject.toml",
      "tests/api/test_oidc_identity.py",
      "uv.lock"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r7-20260925-001",
    "write_epoch": 5,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-5-69247977e4e51781"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_BUILD_F18_OIDC_ID_TOKEN_EXACT6",
  "runtime_next_action": "DEVELOPER_BUILD_F18_OIDC_ID_TOKEN_EXACT6"
}
```

- R7 exact6 verifier only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
