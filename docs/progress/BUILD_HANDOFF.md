# F-20/U-01 R18 R1 isolated PG15 Run host QA handoff

```json anvil-recovery-summary
{
  "event_sequence": 1906,
  "last_event_id": "evt_f20_1906_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r18",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r18-r1-r18r1run3009f",
    "actor_id": "developer-primary-f20-u01-r18",
    "subject_ref": "F-20/U01-R18-R1",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T08:48:42+00:00",
    "expires_at": "2026-09-30T20:48:42+00:00",
    "lease_epoch": 32,
    "fencing_token": "f20-u01-r18-execution-fence-epoch-32-r18r1run3009f",
    "execution_fencing_token": "f20-u01-r18-execution-fence-epoch-32-r18r1run3009f",
    "baseline_git_commit": "d4a6a957c44a4e1f493563c7928b70079f31cdcc",
    "dispatch_head": "d4a6a957c44a4e1f493563c7928b70079f31cdcc",
    "path_scope": [
      "tests/api/test_f20_u01_r18_run_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R18_RUN_HOST_PG15_QA_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r18-r1-r18r1run3009f",
    "actor_id": "developer-primary-f20-u01-r18",
    "subject_ref": "F-20/U01-R18-R1",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T08:48:42+00:00",
    "expires_at": "2026-09-30T20:48:42+00:00",
    "lease_epoch": 32,
    "fencing_token": "f20-u01-r18-write-fence-epoch-32-r18r1run3009f",
    "execution_fencing_token": "f20-u01-r18-execution-fence-epoch-32-r18r1run3009f",
    "baseline_git_commit": "d4a6a957c44a4e1f493563c7928b70079f31cdcc",
    "dispatch_head": "d4a6a957c44a4e1f493563c7928b70079f31cdcc",
    "path_scope": [
      "tests/api/test_f20_u01_r18_run_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R18_RUN_HOST_PG15_QA_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r18-r1-r18r1run3009f",
    "write_epoch": 32,
    "write_fencing_token": "f20-u01-r18-write-fence-epoch-32-r18r1run3009f"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R18_R1_RUN_HOST_PG15_QA_TEST_IMPLEMENTATION",
  "repository_head": "d4a6a957c44a4e1f493563c7928b70079f31cdcc",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
