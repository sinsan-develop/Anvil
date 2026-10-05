# F-20/U-01 R46 secure fence reissue handoff

```json anvil-recovery-summary
{
  "event_sequence": 2088,
  "last_event_id": "evt_f20_2088_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r46",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r46-4af330e0cb84fa12b35488761ac5f24c",
    "actor_id": "developer-primary-f20-u01-r46",
    "subject_ref": "F-20/U01-R46",
    "status": "ACTIVE",
    "issued_at": "2026-10-05T03:47:04+00:00",
    "expires_at": "2026-10-06T03:47:04+00:00",
    "lease_epoch": 62,
    "fencing_token": "f20-u01-r46-execution-fence-epoch-62-4af330e0cb84fa12b35488761ac5f24c",
    "execution_fencing_token": "f20-u01-r46-execution-fence-epoch-62-4af330e0cb84fa12b35488761ac5f24c",
    "baseline_git_commit": "37d7d88fbce53844c8d20725ec212431a61e7186",
    "dispatch_head": "37d7d88fbce53844c8d20725ec212431a61e7186",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R46_SCOPED_QUARANTINE_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r46-cefc04442328aaaa2af078e75e912b20",
    "actor_id": "developer-primary-f20-u01-r46",
    "subject_ref": "F-20/U01-R46",
    "status": "ACTIVE",
    "issued_at": "2026-10-05T03:47:04+00:00",
    "expires_at": "2026-10-06T03:47:04+00:00",
    "lease_epoch": 62,
    "fencing_token": "f20-u01-r46-write-fence-epoch-62-cefc04442328aaaa2af078e75e912b20",
    "execution_fencing_token": "f20-u01-r46-execution-fence-epoch-62-4af330e0cb84fa12b35488761ac5f24c",
    "baseline_git_commit": "37d7d88fbce53844c8d20725ec212431a61e7186",
    "dispatch_head": "37d7d88fbce53844c8d20725ec212431a61e7186",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R46_SCOPED_QUARANTINE_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r46-4af330e0cb84fa12b35488761ac5f24c",
    "write_epoch": 62,
    "write_fencing_token": "f20-u01-r46-write-fence-epoch-62-cefc04442328aaaa2af078e75e912b20"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": false,
  "next_safe_action": "F20_U01_R46_SCOPED_QUARANTINE_IMPLEMENTATION",
  "repository_head": "37d7d88fbce53844c8d20725ec212431a61e7186",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- R45 closed; independent random epoch62 fences. C30 quarantined history retained; F-20 unaccepted; Release DEFER; Production NOT_EXECUTED.
