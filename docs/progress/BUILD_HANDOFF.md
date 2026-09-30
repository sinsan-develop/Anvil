# F-20/U-01 R18 isolated PG15 Run host QA handoff

```json anvil-recovery-summary
{
  "event_sequence": 1900,
  "last_event_id": "evt_f20_1900_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r18",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r18-r18run3009e",
    "actor_id": "developer-primary-f20-u01-r18",
    "subject_ref": "F-20/U01-R18",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T07:57:33+00:00",
    "expires_at": "2026-09-30T19:57:33+00:00",
    "lease_epoch": 31,
    "fencing_token": "f20-u01-r18-execution-fence-epoch-31-r18run3009e",
    "execution_fencing_token": "f20-u01-r18-execution-fence-epoch-31-r18run3009e",
    "baseline_git_commit": "21021fbba6f84549767b6887e4682a4d70fac4db",
    "dispatch_head": "21021fbba6f84549767b6887e4682a4d70fac4db",
    "path_scope": [
      "tests/api/test_f20_u01_r18_run_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R18_RUN_HOST_PG15_QA_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r18-r18run3009e",
    "actor_id": "developer-primary-f20-u01-r18",
    "subject_ref": "F-20/U01-R18",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T07:57:33+00:00",
    "expires_at": "2026-09-30T19:57:33+00:00",
    "lease_epoch": 31,
    "fencing_token": "f20-u01-r18-write-fence-epoch-31-r18run3009e",
    "execution_fencing_token": "f20-u01-r18-execution-fence-epoch-31-r18run3009e",
    "baseline_git_commit": "21021fbba6f84549767b6887e4682a4d70fac4db",
    "dispatch_head": "21021fbba6f84549767b6887e4682a4d70fac4db",
    "path_scope": [
      "tests/api/test_f20_u01_r18_run_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R18_RUN_HOST_PG15_QA_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r18-r18run3009e",
    "write_epoch": 31,
    "write_fencing_token": "f20-u01-r18-write-fence-epoch-31-r18run3009e"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R18_RUN_HOST_PG15_QA_TEST_IMPLEMENTATION",
  "repository_head": "21021fbba6f84549767b6887e4682a4d70fac4db",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
