# F-20/U-01 R16 scoped Run status summary handoff

```json anvil-recovery-summary
{
  "event_sequence": 1888,
  "last_event_id": "evt_f20_1888_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r16",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r16-r16run3009c",
    "actor_id": "developer-primary-f20-u01-r16",
    "subject_ref": "F-20/U01-R16",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T02:15:18+00:00",
    "expires_at": "2026-09-30T14:15:18+00:00",
    "lease_epoch": 29,
    "fencing_token": "f20-u01-r16-execution-fence-epoch-29-r16run3009c",
    "execution_fencing_token": "f20-u01-r16-execution-fence-epoch-29-r16run3009c",
    "baseline_git_commit": "609a43562ec6f18434523beb5db04a9e661a70ff",
    "dispatch_head": "609a43562ec6f18434523beb5db04a9e661a70ff",
    "path_scope": [
      "packages/observability/run_status_summary.py",
      "tests/observability/test_f20_u01_run_status_summary.py",
      "docs/04_test_reports/F-20_U01_R16_SCOPED_RUN_STATUS_SUMMARY_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r16-r16run3009c",
    "actor_id": "developer-primary-f20-u01-r16",
    "subject_ref": "F-20/U01-R16",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T02:15:18+00:00",
    "expires_at": "2026-09-30T14:15:18+00:00",
    "lease_epoch": 29,
    "fencing_token": "f20-u01-r16-write-fence-epoch-29-r16run3009c",
    "execution_fencing_token": "f20-u01-r16-execution-fence-epoch-29-r16run3009c",
    "baseline_git_commit": "609a43562ec6f18434523beb5db04a9e661a70ff",
    "dispatch_head": "609a43562ec6f18434523beb5db04a9e661a70ff",
    "path_scope": [
      "packages/observability/run_status_summary.py",
      "tests/observability/test_f20_u01_run_status_summary.py",
      "docs/04_test_reports/F-20_U01_R16_SCOPED_RUN_STATUS_SUMMARY_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r16-r16run3009c",
    "write_epoch": 29,
    "write_fencing_token": "f20-u01-r16-write-fence-epoch-29-r16run3009c"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R16_SCOPED_RUN_STATUS_SUMMARY_IMPLEMENTATION",
  "repository_head": "609a43562ec6f18434523beb5db04a9e661a70ff",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
