# F-20 R5a append-only lease handoff and current progress rework

```json anvil-recovery-summary
{
  "event_sequence": 1743,
  "last_event_id": "evt_f20_1743_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-r5a",
  "worker_lease": {
    "lease_id": "worker-lease-f20-r5a-f3a32d5d",
    "actor_id": "developer-primary-f20-r5a",
    "subject_ref": "F-20/R5a",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T20:41:32+00:00",
    "expires_at": "2026-09-28T08:41:32+00:00",
    "lease_epoch": 5,
    "fencing_token": "f20-r5a-execution-fence-epoch-5-f3a32d5d",
    "execution_fencing_token": "f20-r5a-execution-fence-epoch-5-f3a32d5d",
    "baseline_git_commit": "3b7f8391f3392f9a862c1be9c01da47cb277b550",
    "dispatch_head": "3b7f8391f3392f9a862c1be9c01da47cb277b550",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5A_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-r5a-f3a32d5d",
    "actor_id": "developer-primary-f20-r5a",
    "subject_ref": "F-20/R5a",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T20:41:32+00:00",
    "expires_at": "2026-09-28T08:41:32+00:00",
    "lease_epoch": 5,
    "fencing_token": "f20-r5a-write-fence-epoch-5-f3a32d5d",
    "execution_fencing_token": "f20-r5a-execution-fence-epoch-5-f3a32d5d",
    "baseline_git_commit": "3b7f8391f3392f9a862c1be9c01da47cb277b550",
    "dispatch_head": "3b7f8391f3392f9a862c1be9c01da47cb277b550",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5A_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ],
    "worker_lease_id": "worker-lease-f20-r5a-f3a32d5d",
    "write_epoch": 5,
    "write_fencing_token": "f20-r5a-write-fence-epoch-5-f3a32d5d"
  },
  "next_safe_action": "F20_R5A_CURRENT_PROGRESS_REWORK",
  "repository_head": "3b7f8391f3392f9a862c1be9c01da47cb277b550",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- F-20 incomplete; Production NOT_EXECUTED.
