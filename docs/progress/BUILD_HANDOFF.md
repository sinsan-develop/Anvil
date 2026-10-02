# F-20/U-01 R27 Dashboard Manual Refresh handoff

```json anvil-recovery-summary
{
  "event_sequence": 1960,
  "last_event_id": "evt_f20_1960_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r27",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r27-r27refresh1002",
    "actor_id": "developer-primary-f20-u01-r27",
    "subject_ref": "F-20/U01-R27",
    "status": "ACTIVE",
    "issued_at": "2026-10-02T01:05:01+00:00",
    "expires_at": "2026-10-02T13:05:01+00:00",
    "lease_epoch": 41,
    "fencing_token": "f20-u01-r27-execution-fence-epoch-41-r27refresh1002",
    "execution_fencing_token": "f20-u01-r27-execution-fence-epoch-41-r27refresh1002",
    "baseline_git_commit": "1f1e96cdbe585ea5111518d747f1f7633cbb05a4",
    "dispatch_head": "1f1e96cdbe585ea5111518d747f1f7633cbb05a4",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r27-r27refresh1002",
    "actor_id": "developer-primary-f20-u01-r27",
    "subject_ref": "F-20/U01-R27",
    "status": "ACTIVE",
    "issued_at": "2026-10-02T01:05:01+00:00",
    "expires_at": "2026-10-02T13:05:01+00:00",
    "lease_epoch": 41,
    "fencing_token": "f20-u01-r27-write-fence-epoch-41-r27refresh1002",
    "execution_fencing_token": "f20-u01-r27-execution-fence-epoch-41-r27refresh1002",
    "baseline_git_commit": "1f1e96cdbe585ea5111518d747f1f7633cbb05a4",
    "dispatch_head": "1f1e96cdbe585ea5111518d747f1f7633cbb05a4",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r27-r27refresh1002",
    "write_epoch": 41,
    "write_fencing_token": "f20-u01-r27-write-fence-epoch-41-r27refresh1002"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R27_DASHBOARD_MANUAL_REFRESH_IMPLEMENTATION",
  "repository_head": "1f1e96cdbe585ea5111518d747f1f7633cbb05a4",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
