# F-20/U-01 R1b history-test handoff

```json anvil-recovery-summary
{
  "event_sequence": 1780,
  "last_event_id": "evt_f20_1780_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r1b",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r1b-r1bbbf49d14ed1f",
    "actor_id": "developer-primary-f20-u01-r1b",
    "subject_ref": "F-20/U01-R1B",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T07:55:16+00:00",
    "expires_at": "2026-09-28T19:55:16+00:00",
    "lease_epoch": 11,
    "fencing_token": "f20-u01-r1b-execution-fence-epoch-11-r1bbbf49d14ed1f",
    "execution_fencing_token": "f20-u01-r1b-execution-fence-epoch-11-r1bbbf49d14ed1f",
    "baseline_git_commit": "6cd90bb9ac5b173991dceaa9fd00432bafa4ebdd",
    "dispatch_head": "6cd90bb9ac5b173991dceaa9fd00432bafa4ebdd",
    "path_scope": [
      "tests/tooling/test_project_progress.py",
      "docs/04_test_reports/F-20_U01_R1B_HISTORY_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r1b-r1bbbf49d14ed1f",
    "actor_id": "developer-primary-f20-u01-r1b",
    "subject_ref": "F-20/U01-R1B",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T07:55:16+00:00",
    "expires_at": "2026-09-28T19:55:16+00:00",
    "lease_epoch": 11,
    "fencing_token": "f20-u01-r1b-write-fence-epoch-11-r1bbbf49d14ed1f",
    "execution_fencing_token": "f20-u01-r1b-execution-fence-epoch-11-r1bbbf49d14ed1f",
    "baseline_git_commit": "6cd90bb9ac5b173991dceaa9fd00432bafa4ebdd",
    "dispatch_head": "6cd90bb9ac5b173991dceaa9fd00432bafa4ebdd",
    "path_scope": [
      "tests/tooling/test_project_progress.py",
      "docs/04_test_reports/F-20_U01_R1B_HISTORY_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r1b-r1bbbf49d14ed1f",
    "write_epoch": 11,
    "write_fencing_token": "f20-u01-r1b-write-fence-epoch-11-r1bbbf49d14ed1f"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R1B_HISTORY_REWORK",
  "repository_head": "6cd90bb9ac5b173991dceaa9fd00432bafa4ebdd",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 CRITICAL OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
