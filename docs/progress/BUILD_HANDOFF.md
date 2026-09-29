# F-20/U-01 R9 Queue source host handoff

```json anvil-recovery-summary
{
  "event_sequence": 1846,
  "last_event_id": "evt_f20_1846_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r9",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r9-14d850d8af36",
    "actor_id": "developer-primary-f20-u01-r9",
    "subject_ref": "F-20/U01-R9",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T13:41:30+00:00",
    "expires_at": "2026-09-30T01:41:30+00:00",
    "lease_epoch": 22,
    "fencing_token": "f20-u01-r9-execution-fence-epoch-22-14d850d8af36",
    "execution_fencing_token": "f20-u01-r9-execution-fence-epoch-22-14d850d8af36",
    "baseline_git_commit": "9ab4958af595925b3316439688cb6aac7db5092d",
    "dispatch_head": "9ab4958af595925b3316439688cb6aac7db5092d",
    "path_scope": [
      "packages/observability/service.py",
      "apps/api/anvil_api/oidc_process.py",
      "tests/observability/test_f20_u01_r9_queue_host.py",
      "tests/api/test_f20_u01_r9_oidc_queue_host.py",
      "docs/04_test_reports/F-20_U01_R9_QUEUE_HOST_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r9-14d850d8af36",
    "actor_id": "developer-primary-f20-u01-r9",
    "subject_ref": "F-20/U01-R9",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T13:41:30+00:00",
    "expires_at": "2026-09-30T01:41:30+00:00",
    "lease_epoch": 22,
    "fencing_token": "f20-u01-r9-write-fence-epoch-22-14d850d8af36",
    "execution_fencing_token": "f20-u01-r9-execution-fence-epoch-22-14d850d8af36",
    "baseline_git_commit": "9ab4958af595925b3316439688cb6aac7db5092d",
    "dispatch_head": "9ab4958af595925b3316439688cb6aac7db5092d",
    "path_scope": [
      "packages/observability/service.py",
      "apps/api/anvil_api/oidc_process.py",
      "tests/observability/test_f20_u01_r9_queue_host.py",
      "tests/api/test_f20_u01_r9_oidc_queue_host.py",
      "docs/04_test_reports/F-20_U01_R9_QUEUE_HOST_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r9-14d850d8af36",
    "write_epoch": 22,
    "write_fencing_token": "f20-u01-r9-write-fence-epoch-22-14d850d8af36"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R9_QUEUE_SOURCE_HOST_IMPLEMENTATION",
  "repository_head": "9ab4958af595925b3316439688cb6aac7db5092d",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
