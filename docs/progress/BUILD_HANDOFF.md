# F-20/U-01 R33 Operating Cards Shell start handoff

```json anvil-recovery-summary
{
  "event_sequence": 1996,
  "last_event_id": "evt_f20_1996_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r33",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r33-20c604e630935161",
    "actor_id": "developer-primary-f20-u01-r33",
    "subject_ref": "F-20/U01-R33",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T03:56:51+00:00",
    "expires_at": "2026-10-03T15:56:51+00:00",
    "lease_epoch": 47,
    "fencing_token": "f20-u01-r33-execution-fence-epoch-47-20c604e630935161",
    "execution_fencing_token": "f20-u01-r33-execution-fence-epoch-47-20c604e630935161",
    "baseline_git_commit": "4f6a01f2e883fbbbd65a2900ca7aa48ffad8d0a2",
    "dispatch_head": "4f6a01f2e883fbbbd65a2900ca7aa48ffad8d0a2",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R33_OPERATING_CARDS_SHELL_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r33-20c604e630935161",
    "actor_id": "developer-primary-f20-u01-r33",
    "subject_ref": "F-20/U01-R33",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T03:56:51+00:00",
    "expires_at": "2026-10-03T15:56:51+00:00",
    "lease_epoch": 47,
    "fencing_token": "f20-u01-r33-write-fence-epoch-47-20c604e630935161",
    "execution_fencing_token": "f20-u01-r33-execution-fence-epoch-47-20c604e630935161",
    "baseline_git_commit": "4f6a01f2e883fbbbd65a2900ca7aa48ffad8d0a2",
    "dispatch_head": "4f6a01f2e883fbbbd65a2900ca7aa48ffad8d0a2",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R33_OPERATING_CARDS_SHELL_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r33-20c604e630935161",
    "write_epoch": 47,
    "write_fencing_token": "f20-u01-r33-write-fence-epoch-47-20c604e630935161"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R33_OPERATING_CARDS_SHELL_IMPLEMENTATION",
  "repository_head": "4f6a01f2e883fbbbd65a2900ca7aa48ffad8d0a2",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- R33 UI shell only; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
