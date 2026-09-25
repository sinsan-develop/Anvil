# F-18 WSL R12 auth ingress writer start

```json anvil-recovery-summary
{
  "event_sequence": 1561,
  "last_event_id": "evt_f18_local_1561_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r12-auth-ingress",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r12-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r12-auth-ingress",
    "subject_ref": "F-18/WSL_OPS_R12_AUTH_INGRESS",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T20:02:58+09:00",
    "expires_at": "2026-09-26T08:02:58+09:00",
    "lease_epoch": 10,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-10-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-10-69247977e4e51781",
    "baseline_git_commit": "30637da8301acdeccd32510656e914677c123e23",
    "dispatch_head": "30637da8301acdeccd32510656e914677c123e23",
    "path_scope": [
      "deploy/local/nginx.conf",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/integration/test_f15_local_stack.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r12-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r12-auth-ingress",
    "subject_ref": "F-18/WSL_OPS_R12_AUTH_INGRESS",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T20:02:58+09:00",
    "expires_at": "2026-09-26T08:02:58+09:00",
    "lease_epoch": 10,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-10-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-10-69247977e4e51781",
    "baseline_git_commit": "30637da8301acdeccd32510656e914677c123e23",
    "dispatch_head": "30637da8301acdeccd32510656e914677c123e23",
    "path_scope": [
      "deploy/local/nginx.conf",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/integration/test_f15_local_stack.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r12-20260925-001",
    "write_epoch": 10,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-10-69247977e4e51781"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_FIX_F18_AUTH_INGRESS_EXACT3",
  "runtime_next_action": "DEVELOPER_FIX_F18_AUTH_INGRESS_EXACT3"
}
```

- R12 exact3 ingress only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
