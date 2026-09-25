# F-18 WSL R9 OIDC step-up request writer start

```json anvil-recovery-summary
{
  "event_sequence": 1546,
  "last_event_id": "evt_f18_local_1546_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r9-step-up-request",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r9-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r9-step-up-request",
    "subject_ref": "F-18/WSL_OPS_R9_STEP_UP_REQUEST",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T14:56:13+09:00",
    "expires_at": "2026-09-26T02:56:13+09:00",
    "lease_epoch": 7,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-7-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-7-69247977e4e51781",
    "baseline_git_commit": "c1870433d1298433235b23f945eae0c5fa117924",
    "dispatch_head": "c1870433d1298433235b23f945eae0c5fa117924",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_code_flow.py",
      "packages/api/oidc_identity.py",
      "tests/api/test_oidc_code_flow.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r9-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r9-step-up-request",
    "subject_ref": "F-18/WSL_OPS_R9_STEP_UP_REQUEST",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T14:56:13+09:00",
    "expires_at": "2026-09-26T02:56:13+09:00",
    "lease_epoch": 7,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-7-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-7-69247977e4e51781",
    "baseline_git_commit": "c1870433d1298433235b23f945eae0c5fa117924",
    "dispatch_head": "c1870433d1298433235b23f945eae0c5fa117924",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_code_flow.py",
      "packages/api/oidc_identity.py",
      "tests/api/test_oidc_code_flow.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r9-20260925-001",
    "write_epoch": 7,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-7-69247977e4e51781"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_BUILD_F18_OIDC_STEP_UP_REQUEST_EXACT4",
  "runtime_next_action": "DEVELOPER_BUILD_F18_OIDC_STEP_UP_REQUEST_EXACT4"
}
```

- R9 exact4 request contract only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
