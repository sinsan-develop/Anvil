# F-20 R5b append-only lease handoff and C09 historical authority rework

```json anvil-recovery-summary
{
  "event_sequence": 1749,
  "last_event_id": "evt_f20_1749_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-r5b",
  "worker_lease": {
    "lease_id": "worker-lease-f20-r5b-2c8cd368",
    "actor_id": "developer-primary-f20-r5b",
    "subject_ref": "F-20/R5b",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T22:01:29+00:00",
    "expires_at": "2026-09-28T10:01:29+00:00",
    "lease_epoch": 6,
    "fencing_token": "f20-r5b-execution-fence-epoch-6-2c8cd368",
    "execution_fencing_token": "f20-r5b-execution-fence-epoch-6-2c8cd368",
    "baseline_git_commit": "d8a7e2dd4ce2a144c53607242b326a9afd16c468",
    "dispatch_head": "d8a7e2dd4ce2a144c53607242b326a9afd16c468",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5B_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-r5b-2c8cd368",
    "actor_id": "developer-primary-f20-r5b",
    "subject_ref": "F-20/R5b",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T22:01:29+00:00",
    "expires_at": "2026-09-28T10:01:29+00:00",
    "lease_epoch": 6,
    "fencing_token": "f20-r5b-write-fence-epoch-6-2c8cd368",
    "execution_fencing_token": "f20-r5b-execution-fence-epoch-6-2c8cd368",
    "baseline_git_commit": "d8a7e2dd4ce2a144c53607242b326a9afd16c468",
    "dispatch_head": "d8a7e2dd4ce2a144c53607242b326a9afd16c468",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5B_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ],
    "worker_lease_id": "worker-lease-f20-r5b-2c8cd368",
    "write_epoch": 6,
    "write_fencing_token": "f20-r5b-write-fence-epoch-6-2c8cd368"
  },
  "next_safe_action": "F20_R5B_C09_HISTORY_REWORK",
  "repository_head": "d8a7e2dd4ce2a144c53607242b326a9afd16c468",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- F-20 incomplete; Production NOT_EXECUTED.
