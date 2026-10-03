# F-20/U-01 R31 Dashboard Reconnect State handoff

```json anvil-recovery-summary
{
  "event_sequence": 1984,
  "last_event_id": "evt_f20_1984_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r31",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r31-r31reconnect1003",
    "actor_id": "developer-primary-f20-u01-r31",
    "subject_ref": "F-20/U01-R31",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T00:05:07+00:00",
    "expires_at": "2026-10-03T12:05:07+00:00",
    "lease_epoch": 45,
    "fencing_token": "f20-u01-r31-execution-fence-epoch-45-r31reconnect1003",
    "execution_fencing_token": "f20-u01-r31-execution-fence-epoch-45-r31reconnect1003",
    "baseline_git_commit": "fe00147d8995288dbff172ad1ef2c25a2e925cd5",
    "dispatch_head": "fe00147d8995288dbff172ad1ef2c25a2e925cd5",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R31_DASHBOARD_RECONNECT_STATE_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r31-r31reconnect1003",
    "actor_id": "developer-primary-f20-u01-r31",
    "subject_ref": "F-20/U01-R31",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T00:05:07+00:00",
    "expires_at": "2026-10-03T12:05:07+00:00",
    "lease_epoch": 45,
    "fencing_token": "f20-u01-r31-write-fence-epoch-45-r31reconnect1003",
    "execution_fencing_token": "f20-u01-r31-execution-fence-epoch-45-r31reconnect1003",
    "baseline_git_commit": "fe00147d8995288dbff172ad1ef2c25a2e925cd5",
    "dispatch_head": "fe00147d8995288dbff172ad1ef2c25a2e925cd5",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R31_DASHBOARD_RECONNECT_STATE_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r31-r31reconnect1003",
    "write_epoch": 45,
    "write_fencing_token": "f20-u01-r31-write-fence-epoch-45-r31reconnect1003"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R31_DASHBOARD_RECONNECT_STATE_IMPLEMENTATION",
  "repository_head": "fe00147d8995288dbff172ad1ef2c25a2e925cd5",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- R31 browser Dashboard read-reconnect rework only; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
