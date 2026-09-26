# F-18 WSL R40 live OIDC host QA writer start

```json anvil-recovery-summary
{
  "event_sequence": 1631,
  "last_event_id": "evt_f18_local_1631_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r40-live-oidc-host",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r40-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r40-live-oidc-host",
    "subject_ref": "F-18/WSL_OPS_R40_LIVE_OIDC_HOST",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T23:28:35+09:00",
    "expires_at": "2026-09-27T11:28:35+09:00",
    "lease_epoch": 24,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-24-8969e4e57b543131",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-24-8969e4e57b543131",
    "baseline_git_commit": "741b4cbdd6d81949bc77074a36c38567fd92a5ee",
    "dispatch_head": "741b4cbdd6d81949bc77074a36c38567fd92a5ee",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/integration/f18_oidc_live_host.py",
      "tests/integration/test_f18_oidc_live_host.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r40-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r40-live-oidc-host",
    "subject_ref": "F-18/WSL_OPS_R40_LIVE_OIDC_HOST",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T23:28:35+09:00",
    "expires_at": "2026-09-27T11:28:35+09:00",
    "lease_epoch": 24,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-24-8969e4e57b543131",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-24-8969e4e57b543131",
    "baseline_git_commit": "741b4cbdd6d81949bc77074a36c38567fd92a5ee",
    "dispatch_head": "741b4cbdd6d81949bc77074a36c38567fd92a5ee",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/integration/f18_oidc_live_host.py",
      "tests/integration/test_f18_oidc_live_host.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r40-20260926-001",
    "write_epoch": 24,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-24-8969e4e57b543131"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_LIVE_OIDC_HOST_QA_EXACT3",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_LIVE_OIDC_HOST_QA_EXACT3"
}
```

- R40 live OIDC host QA exact3 only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
