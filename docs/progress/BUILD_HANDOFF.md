# F-20/U-01 R35 Health and Critical read start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2014,
  "last_event_id": "evt_f20_2014_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r35",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r35-r35read04b",
    "actor_id": "developer-primary-f20-u01-r35",
    "subject_ref": "F-20/U01-R35",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T17:11:08+00:00",
    "expires_at": "2026-10-04T05:11:08+00:00",
    "lease_epoch": 50,
    "fencing_token": "f20-u01-r35-execution-fence-epoch-50-r35read04b",
    "execution_fencing_token": "f20-u01-r35-execution-fence-epoch-50-r35read04b",
    "baseline_git_commit": "7850b7fbbdef431ab7bedeee250ee6fef0579d04",
    "dispatch_head": "7850b7fbbdef431ab7bedeee250ee6fef0579d04",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R35_HEALTH_ALERT_READ_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r35-r35read04b",
    "actor_id": "developer-primary-f20-u01-r35",
    "subject_ref": "F-20/U01-R35",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T17:11:08+00:00",
    "expires_at": "2026-10-04T05:11:08+00:00",
    "lease_epoch": 50,
    "fencing_token": "f20-u01-r35-write-fence-epoch-50-r35read04b",
    "execution_fencing_token": "f20-u01-r35-execution-fence-epoch-50-r35read04b",
    "baseline_git_commit": "7850b7fbbdef431ab7bedeee250ee6fef0579d04",
    "dispatch_head": "7850b7fbbdef431ab7bedeee250ee6fef0579d04",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R35_HEALTH_ALERT_READ_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r35-r35read04b",
    "write_epoch": 50,
    "write_fencing_token": "f20-u01-r35-write-fence-epoch-50-r35read04b"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R35_HEALTH_ALERT_READ_IMPLEMENTATION",
  "repository_head": "7850b7fbbdef431ab7bedeee250ee6fef0579d04",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Existing GET only; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
