# F-20/U-01 R14 Dashboard Health cards handoff

```json anvil-recovery-summary
{
  "event_sequence": 1876,
  "last_event_id": "evt_f20_1876_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r14",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r14-r14run3009a",
    "actor_id": "developer-primary-f20-u01-r14",
    "subject_ref": "F-20/U01-R14",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T00:01:53+00:00",
    "expires_at": "2026-09-30T12:01:53+00:00",
    "lease_epoch": 27,
    "fencing_token": "f20-u01-r14-execution-fence-epoch-27-r14run3009a",
    "execution_fencing_token": "f20-u01-r14-execution-fence-epoch-27-r14run3009a",
    "baseline_git_commit": "fb30a9ddc05b127753f823406efd70f3d9da8134",
    "dispatch_head": "fb30a9ddc05b127753f823406efd70f3d9da8134",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "docs/04_test_reports/F-20_U01_R14_DASHBOARD_HEALTH_CARDS_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r14-r14run3009a",
    "actor_id": "developer-primary-f20-u01-r14",
    "subject_ref": "F-20/U01-R14",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T00:01:53+00:00",
    "expires_at": "2026-09-30T12:01:53+00:00",
    "lease_epoch": 27,
    "fencing_token": "f20-u01-r14-write-fence-epoch-27-r14run3009a",
    "execution_fencing_token": "f20-u01-r14-execution-fence-epoch-27-r14run3009a",
    "baseline_git_commit": "fb30a9ddc05b127753f823406efd70f3d9da8134",
    "dispatch_head": "fb30a9ddc05b127753f823406efd70f3d9da8134",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "docs/04_test_reports/F-20_U01_R14_DASHBOARD_HEALTH_CARDS_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r14-r14run3009a",
    "write_epoch": 27,
    "write_fencing_token": "f20-u01-r14-write-fence-epoch-27-r14run3009a"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R14_DASHBOARD_HEALTH_CARDS_IMPLEMENTATION",
  "repository_head": "fb30a9ddc05b127753f823406efd70f3d9da8134",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
