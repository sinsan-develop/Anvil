# F-18 WSL R31 OIDC pending-store writer start

```json anvil-recovery-summary
{
  "event_sequence": 1586,
  "last_event_id": "evt_f18_local_1586_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r31-pending-store",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r31-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r31-pending-store",
    "subject_ref": "F-18/WSL_OPS_R31_PENDING_STORE",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T12:43:40+09:00",
    "expires_at": "2026-09-27T00:43:40+09:00",
    "lease_epoch": 15,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-15-fb8903edc8892aa0",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-15-fb8903edc8892aa0",
    "baseline_git_commit": "c5a131abeaa7319cfe894d0bdc96613fd9a1eac4",
    "dispatch_head": "c5a131abeaa7319cfe894d0bdc96613fd9a1eac4",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "migrations/versions/0017_oidc_pending_auth.py",
      "packages/persistence/oidc_pending_auth.py",
      "tests/persistence/test_oidc_pending_auth.py",
      "tests/persistence/test_oidc_pending_auth_postgres.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r31-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r31-pending-store",
    "subject_ref": "F-18/WSL_OPS_R31_PENDING_STORE",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T12:43:40+09:00",
    "expires_at": "2026-09-27T00:43:40+09:00",
    "lease_epoch": 15,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-15-fb8903edc8892aa0",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-15-fb8903edc8892aa0",
    "baseline_git_commit": "c5a131abeaa7319cfe894d0bdc96613fd9a1eac4",
    "dispatch_head": "c5a131abeaa7319cfe894d0bdc96613fd9a1eac4",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "migrations/versions/0017_oidc_pending_auth.py",
      "packages/persistence/oidc_pending_auth.py",
      "tests/persistence/test_oidc_pending_auth.py",
      "tests/persistence/test_oidc_pending_auth_postgres.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r31-20260926-001",
    "write_epoch": 15,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-15-fb8903edc8892aa0"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_OIDC_PENDING_STORE_EXACT5",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_OIDC_PENDING_STORE_EXACT5"
}
```

- R31 OIDC pending store exact5 only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
