# F-20 R5c append-only lease handoff and C09 historical review rework

```json anvil-recovery-summary
{
  "event_sequence": 1755,
  "last_event_id": "evt_f20_1755_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-r5c",
  "worker_lease": {
    "lease_id": "worker-lease-f20-r5c-0cd188a1",
    "actor_id": "developer-primary-f20-r5c",
    "subject_ref": "F-20/R5c",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T23:29:27+00:00",
    "expires_at": "2026-09-28T11:29:27+00:00",
    "lease_epoch": 7,
    "fencing_token": "f20-r5c-execution-fence-epoch-7-0cd188a1",
    "execution_fencing_token": "f20-r5c-execution-fence-epoch-7-0cd188a1",
    "baseline_git_commit": "7c6c10b4a8dbf29c4a5b6c810100fe0ab8aff71d",
    "dispatch_head": "7c6c10b4a8dbf29c4a5b6c810100fe0ab8aff71d",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5C_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-r5c-0cd188a1",
    "actor_id": "developer-primary-f20-r5c",
    "subject_ref": "F-20/R5c",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T23:29:27+00:00",
    "expires_at": "2026-09-28T11:29:27+00:00",
    "lease_epoch": 7,
    "fencing_token": "f20-r5c-write-fence-epoch-7-0cd188a1",
    "execution_fencing_token": "f20-r5c-execution-fence-epoch-7-0cd188a1",
    "baseline_git_commit": "7c6c10b4a8dbf29c4a5b6c810100fe0ab8aff71d",
    "dispatch_head": "7c6c10b4a8dbf29c4a5b6c810100fe0ab8aff71d",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5C_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ],
    "worker_lease_id": "worker-lease-f20-r5c-0cd188a1",
    "write_epoch": 7,
    "write_fencing_token": "f20-r5c-write-fence-epoch-7-0cd188a1"
  },
  "next_safe_action": "F20_R5C_C09_HISTORY_REWORK",
  "repository_head": "7c6c10b4a8dbf29c4a5b6c810100fe0ab8aff71d",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- F-20 incomplete; Production NOT_EXECUTED.
