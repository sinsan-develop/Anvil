# F-20/U-01 R47 secure fence reissue handoff

```json anvil-recovery-summary
{
  "event_sequence": 2094,
  "last_event_id": "evt_f20_2094_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r47",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r47-f4adfb108f01fc165194f0867fb8f336",
    "actor_id": "developer-primary-f20-u01-r47",
    "subject_ref": "F-20/U01-R47",
    "status": "ACTIVE",
    "issued_at": "2026-10-05T06:36:33+00:00",
    "expires_at": "2026-10-06T06:36:33+00:00",
    "lease_epoch": 63,
    "fencing_token": "f20-u01-r47-execution-fence-epoch-63-f4adfb108f01fc165194f0867fb8f336",
    "execution_fencing_token": "f20-u01-r47-execution-fence-epoch-63-f4adfb108f01fc165194f0867fb8f336",
    "baseline_git_commit": "9e75cde63b90a9c3afe22f75f4fcf269c4bfb000",
    "dispatch_head": "9e75cde63b90a9c3afe22f75f4fcf269c4bfb000",
    "path_scope": [
      "apps/api/anvil_api/oidc_process.py",
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/api/test_f20_u01_r47_database_health_host.py",
      "tests/integration/test_f20_u01_r47_database_health_pg15.py",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R47_DATABASE_HEALTH_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r47-142f159f45c27e3e49adfadbcbca4fcc",
    "actor_id": "developer-primary-f20-u01-r47",
    "subject_ref": "F-20/U01-R47",
    "status": "ACTIVE",
    "issued_at": "2026-10-05T06:36:33+00:00",
    "expires_at": "2026-10-06T06:36:33+00:00",
    "lease_epoch": 63,
    "fencing_token": "f20-u01-r47-write-fence-epoch-63-142f159f45c27e3e49adfadbcbca4fcc",
    "execution_fencing_token": "f20-u01-r47-execution-fence-epoch-63-f4adfb108f01fc165194f0867fb8f336",
    "baseline_git_commit": "9e75cde63b90a9c3afe22f75f4fcf269c4bfb000",
    "dispatch_head": "9e75cde63b90a9c3afe22f75f4fcf269c4bfb000",
    "path_scope": [
      "apps/api/anvil_api/oidc_process.py",
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "tests/api/test_f20_u01_r47_database_health_host.py",
      "tests/integration/test_f20_u01_r47_database_health_pg15.py",
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R47_DATABASE_HEALTH_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r47-f4adfb108f01fc165194f0867fb8f336",
    "write_epoch": 63,
    "write_fencing_token": "f20-u01-r47-write-fence-epoch-63-142f159f45c27e3e49adfadbcbca4fcc"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": false,
  "next_safe_action": "F20_U01_R47_DATABASE_HEALTH_IMPLEMENTATION",
  "repository_head": "9e75cde63b90a9c3afe22f75f4fcf269c4bfb000",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- R46 closed; independent random epoch63 fences. C30 quarantined history retained; F-20 unaccepted; Release DEFER; Production NOT_EXECUTED.
