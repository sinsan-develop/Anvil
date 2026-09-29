# F-20/U-01 R10 Dashboard read API handoff

```json anvil-recovery-summary
{
  "event_sequence": 1852,
  "last_event_id": "evt_f20_1852_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r10",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r10-50ec67954ea1",
    "actor_id": "developer-primary-f20-u01-r10",
    "subject_ref": "F-20/U01-R10",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T19:20:21+00:00",
    "expires_at": "2026-09-30T07:20:21+00:00",
    "lease_epoch": 23,
    "fencing_token": "f20-u01-r10-execution-fence-epoch-23-50ec67954ea1",
    "execution_fencing_token": "f20-u01-r10-execution-fence-epoch-23-50ec67954ea1",
    "baseline_git_commit": "641a0007e385aef4112b3ae642ec309115274ef0",
    "dispatch_head": "641a0007e385aef4112b3ae642ec309115274ef0",
    "path_scope": [
      "packages/api/registry.py",
      "packages/api/operations.py",
      "tests/api/test_f20_u01_r10_dashboard_api.py",
      "tests/api/test_f20_u01_r10_oidc_dashboard.py",
      "docs/04_test_reports/F-20_U01_R10_DASHBOARD_READ_API_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r10-50ec67954ea1",
    "actor_id": "developer-primary-f20-u01-r10",
    "subject_ref": "F-20/U01-R10",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T19:20:21+00:00",
    "expires_at": "2026-09-30T07:20:21+00:00",
    "lease_epoch": 23,
    "fencing_token": "f20-u01-r10-write-fence-epoch-23-50ec67954ea1",
    "execution_fencing_token": "f20-u01-r10-execution-fence-epoch-23-50ec67954ea1",
    "baseline_git_commit": "641a0007e385aef4112b3ae642ec309115274ef0",
    "dispatch_head": "641a0007e385aef4112b3ae642ec309115274ef0",
    "path_scope": [
      "packages/api/registry.py",
      "packages/api/operations.py",
      "tests/api/test_f20_u01_r10_dashboard_api.py",
      "tests/api/test_f20_u01_r10_oidc_dashboard.py",
      "docs/04_test_reports/F-20_U01_R10_DASHBOARD_READ_API_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r10-50ec67954ea1",
    "write_epoch": 23,
    "write_fencing_token": "f20-u01-r10-write-fence-epoch-23-50ec67954ea1"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R10_DASHBOARD_READ_API_IMPLEMENTATION",
  "repository_head": "641a0007e385aef4112b3ae642ec309115274ef0",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
