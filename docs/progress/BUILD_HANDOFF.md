# F-20/U-01 R34 Scoped Run Cards start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2008,
  "last_event_id": "evt_f20_2008_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r34",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r34-r34run031003",
    "actor_id": "developer-primary-f20-u01-r34",
    "subject_ref": "F-20/U01-R34",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T13:49:47+00:00",
    "expires_at": "2026-10-04T01:49:47+00:00",
    "lease_epoch": 49,
    "fencing_token": "f20-u01-r34-execution-fence-epoch-49-r34run031003",
    "execution_fencing_token": "f20-u01-r34-execution-fence-epoch-49-r34run031003",
    "baseline_git_commit": "02ecd4617761fca7defcf98f8b1620e5ef35fc1b",
    "dispatch_head": "02ecd4617761fca7defcf98f8b1620e5ef35fc1b",
    "path_scope": [
      "tests/tooling/test_f20_u01_r33t_start_projection.py",
      "packages/api/operations.py",
      "apps/web/src/console/App.tsx",
      "tests/api/test_f20_u01_r10_dashboard_api.py",
      "apps/web/tests/f15-console.test.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R34_SCOPED_RUN_CARDS_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r34-r34run031003",
    "actor_id": "developer-primary-f20-u01-r34",
    "subject_ref": "F-20/U01-R34",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T13:49:47+00:00",
    "expires_at": "2026-10-04T01:49:47+00:00",
    "lease_epoch": 49,
    "fencing_token": "f20-u01-r34-write-fence-epoch-49-r34run031003",
    "execution_fencing_token": "f20-u01-r34-execution-fence-epoch-49-r34run031003",
    "baseline_git_commit": "02ecd4617761fca7defcf98f8b1620e5ef35fc1b",
    "dispatch_head": "02ecd4617761fca7defcf98f8b1620e5ef35fc1b",
    "path_scope": [
      "tests/tooling/test_f20_u01_r33t_start_projection.py",
      "packages/api/operations.py",
      "apps/web/src/console/App.tsx",
      "tests/api/test_f20_u01_r10_dashboard_api.py",
      "apps/web/tests/f15-console.test.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R34_SCOPED_RUN_CARDS_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r34-r34run031003",
    "write_epoch": 49,
    "write_fencing_token": "f20-u01-r34-write-fence-epoch-49-r34run031003"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R34_HISTORY_THEN_SCOPED_RUN_CARDS_IMPLEMENTATION",
  "repository_head": "02ecd4617761fca7defcf98f8b1620e5ef35fc1b",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Historical test repair first; Run cards read-only; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
