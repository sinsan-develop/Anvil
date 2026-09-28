# F-20 R5d append-only lease handoff and E09 historical WI rework

```json anvil-recovery-summary
{
  "event_sequence": 1761,
  "last_event_id": "evt_f20_1761_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-r5d",
  "worker_lease": {
    "lease_id": "worker-lease-f20-r5d-r5d20260928",
    "actor_id": "developer-primary-f20-r5d",
    "subject_ref": "F-20/R5d",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T10:11:50+09:00",
    "expires_at": "2026-09-28T22:11:50+09:00",
    "lease_epoch": 8,
    "fencing_token": "f20-r5d-execution-fence-epoch-8-r5d20260928",
    "execution_fencing_token": "f20-r5d-execution-fence-epoch-8-r5d20260928",
    "baseline_git_commit": "8eb806be6304c741e20f49266aa5ddfb4a693f8a",
    "dispatch_head": "8eb806be6304c741e20f49266aa5ddfb4a693f8a",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5D_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-r5d-r5d20260928",
    "actor_id": "developer-primary-f20-r5d",
    "subject_ref": "F-20/R5d",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T10:11:50+09:00",
    "expires_at": "2026-09-28T22:11:50+09:00",
    "lease_epoch": 8,
    "fencing_token": "f20-r5d-write-fence-epoch-8-r5d20260928",
    "execution_fencing_token": "f20-r5d-execution-fence-epoch-8-r5d20260928",
    "baseline_git_commit": "8eb806be6304c741e20f49266aa5ddfb4a693f8a",
    "dispatch_head": "8eb806be6304c741e20f49266aa5ddfb4a693f8a",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5D_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ],
    "worker_lease_id": "worker-lease-f20-r5d-r5d20260928",
    "write_epoch": 8,
    "write_fencing_token": "f20-r5d-write-fence-epoch-8-r5d20260928"
  },
  "next_safe_action": "F20_R5D_E09_HISTORY_REWORK",
  "repository_head": "8eb806be6304c741e20f49266aa5ddfb4a693f8a",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- F-20 incomplete; Production NOT_EXECUTED.
