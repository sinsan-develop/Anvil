# F-20/U-01 R45 Queue quarantine warning start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2076,
  "last_event_id": "evt_f20_2076_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r45",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r45-r45queue1005",
    "actor_id": "developer-primary-f20-u01-r45",
    "subject_ref": "F-20/U01-R45",
    "status": "ACTIVE",
    "issued_at": "2026-10-05T01:45:00+00:00",
    "expires_at": "2026-10-06T01:45:00+00:00",
    "lease_epoch": 60,
    "fencing_token": "f20-u01-r45-execution-fence-epoch-60-r45queue1005",
    "execution_fencing_token": "f20-u01-r45-execution-fence-epoch-60-r45queue1005",
    "baseline_git_commit": "2237d61b8119b29168d18830cb940288085a7abb",
    "dispatch_head": "2237d61b8119b29168d18830cb940288085a7abb",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R45_QUEUE_HEALTH_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r45-r45queue1005",
    "actor_id": "developer-primary-f20-u01-r45",
    "subject_ref": "F-20/U01-R45",
    "status": "ACTIVE",
    "issued_at": "2026-10-05T01:45:00+00:00",
    "expires_at": "2026-10-06T01:45:00+00:00",
    "lease_epoch": 60,
    "fencing_token": "f20-u01-r45-write-fence-epoch-60-r45queue1005",
    "execution_fencing_token": "f20-u01-r45-execution-fence-epoch-60-r45queue1005",
    "baseline_git_commit": "2237d61b8119b29168d18830cb940288085a7abb",
    "dispatch_head": "2237d61b8119b29168d18830cb940288085a7abb",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R45_QUEUE_HEALTH_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r45-r45queue1005",
    "write_epoch": 60,
    "write_fencing_token": "f20-u01-r45-write-fence-epoch-60-r45queue1005"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": false,
  "next_safe_action": "F20_U01_R45_QUEUE_HEALTH_IMPLEMENTATION",
  "repository_head": "2237d61b8119b29168d18830cb940288085a7abb",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Same-snapshot Queue quarantine warning only; C30 quarantined history retained; F-20 unaccepted; Release DEFER; Production NOT_EXECUTED.
