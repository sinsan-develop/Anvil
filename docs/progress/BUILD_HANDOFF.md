# F-18 WSL R18 distinct digest writer start

```json anvil-recovery-summary
{
  "event_sequence": 1571,
  "last_event_id": "evt_f18_local_1571_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r18-distinct-digest",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r18-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r18-distinct-digest",
    "subject_ref": "F-18/WSL_OPS_R18_DISTINCT_DIGEST",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T01:49:28+09:00",
    "expires_at": "2026-09-26T13:49:28+09:00",
    "lease_epoch": 12,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-12-3f664fb8d9c474a9",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-12-3f664fb8d9c474a9",
    "baseline_git_commit": "fa8a9ea1d754203adddb0fc034282ed34d3518bc",
    "dispatch_head": "fa8a9ea1d754203adddb0fc034282ed34d3518bc",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/deployment/promotion_preflight.py",
      "tests/deploy/test_f18_promotion_preflight.py",
      "tests/deploy/test_f18_wsl_operational.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r18-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r18-distinct-digest",
    "subject_ref": "F-18/WSL_OPS_R18_DISTINCT_DIGEST",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T01:49:28+09:00",
    "expires_at": "2026-09-26T13:49:28+09:00",
    "lease_epoch": 12,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-12-3f664fb8d9c474a9",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-12-3f664fb8d9c474a9",
    "baseline_git_commit": "fa8a9ea1d754203adddb0fc034282ed34d3518bc",
    "dispatch_head": "fa8a9ea1d754203adddb0fc034282ed34d3518bc",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/deployment/promotion_preflight.py",
      "tests/deploy/test_f18_promotion_preflight.py",
      "tests/deploy/test_f18_wsl_operational.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r18-20260926-001",
    "write_epoch": 12,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-12-3f664fb8d9c474a9"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_FIX_F18_DISTINCT_DIGEST_EXACT4",
  "runtime_next_action": "DEVELOPER_FIX_F18_DISTINCT_DIGEST_EXACT4"
}
```

- R18 exact4 distinct-digest preflight only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
