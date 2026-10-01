# F-20/U-01 R26 Dashboard Observation Time handoff

```json anvil-recovery-summary
{
  "event_sequence": 1954,
  "last_event_id": "evt_f20_1954_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r26",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r26-r26observe1001",
    "actor_id": "developer-primary-f20-u01-r26",
    "subject_ref": "F-20/U01-R26",
    "status": "ACTIVE",
    "issued_at": "2026-10-01T22:57:20+00:00",
    "expires_at": "2026-10-02T10:57:20+00:00",
    "lease_epoch": 40,
    "fencing_token": "f20-u01-r26-execution-fence-epoch-40-r26observe1001",
    "execution_fencing_token": "f20-u01-r26-execution-fence-epoch-40-r26observe1001",
    "baseline_git_commit": "d8fc41e0d5712fd2690d242d488939f3f3b52500",
    "dispatch_head": "d8fc41e0d5712fd2690d242d488939f3f3b52500",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R26_DASHBOARD_OBSERVATION_TIME_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r26-r26observe1001",
    "actor_id": "developer-primary-f20-u01-r26",
    "subject_ref": "F-20/U01-R26",
    "status": "ACTIVE",
    "issued_at": "2026-10-01T22:57:20+00:00",
    "expires_at": "2026-10-02T10:57:20+00:00",
    "lease_epoch": 40,
    "fencing_token": "f20-u01-r26-write-fence-epoch-40-r26observe1001",
    "execution_fencing_token": "f20-u01-r26-execution-fence-epoch-40-r26observe1001",
    "baseline_git_commit": "d8fc41e0d5712fd2690d242d488939f3f3b52500",
    "dispatch_head": "d8fc41e0d5712fd2690d242d488939f3f3b52500",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R26_DASHBOARD_OBSERVATION_TIME_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r26-r26observe1001",
    "write_epoch": 40,
    "write_fencing_token": "f20-u01-r26-write-fence-epoch-40-r26observe1001"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R26_DASHBOARD_OBSERVATION_TIME_IMPLEMENTATION",
  "repository_head": "d8fc41e0d5712fd2690d242d488939f3f3b52500",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
