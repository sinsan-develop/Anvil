# F-20/U-01 R6B Error Body handoff

```json anvil-recovery-summary
{
  "event_sequence": 1828,
  "last_event_id": "evt_f20_1828_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r6b",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r6b-r6bbody1",
    "actor_id": "developer-primary-f20-u01-r6b",
    "subject_ref": "F-20/U01-R6B",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T05:48:19+00:00",
    "expires_at": "2026-09-29T17:48:19+00:00",
    "lease_epoch": 19,
    "fencing_token": "f20-u01-r6b-execution-fence-epoch-19-r6bbody1",
    "execution_fencing_token": "f20-u01-r6b-execution-fence-epoch-19-r6bbody1",
    "baseline_git_commit": "e4c483263d2ca614ce3e677c7c259a13eef14d1e",
    "dispatch_head": "e4c483263d2ca614ce3e677c7c259a13eef14d1e",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R6_OIDC_BROWSER_PG15_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r6b-r6bbody1",
    "actor_id": "developer-primary-f20-u01-r6b",
    "subject_ref": "F-20/U01-R6B",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T05:48:19+00:00",
    "expires_at": "2026-09-29T17:48:19+00:00",
    "lease_epoch": 19,
    "fencing_token": "f20-u01-r6b-write-fence-epoch-19-r6bbody1",
    "execution_fencing_token": "f20-u01-r6b-execution-fence-epoch-19-r6bbody1",
    "baseline_git_commit": "e4c483263d2ca614ce3e677c7c259a13eef14d1e",
    "dispatch_head": "e4c483263d2ca614ce3e677c7c259a13eef14d1e",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "docs/04_test_reports/F-20_U01_R6_OIDC_BROWSER_PG15_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r6b-r6bbody1",
    "write_epoch": 19,
    "write_fencing_token": "f20-u01-r6b-write-fence-epoch-19-r6bbody1"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R6B_ERROR_BODY_REWORK",
  "repository_head": "e4c483263d2ca614ce3e677c7c259a13eef14d1e",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 CRITICAL OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
