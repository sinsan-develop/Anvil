# F-20 R1 append-only evidence invalidation and bounded rework

```json anvil-recovery-summary
{
  "event_sequence": 1719,
  "last_event_id": "evt_f20_1719_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f20-r1-s927f20r1",
    "actor_id": "developer-primary-f20-r1",
    "subject_ref": "F-20/R1",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T14:03:41+00:00",
    "expires_at": "2026-09-28T02:03:41+00:00",
    "lease_epoch": 1,
    "fencing_token": "f20-r1-execution-fence-epoch-1-s927f20r1",
    "execution_fencing_token": "f20-r1-execution-fence-epoch-1-s927f20r1",
    "baseline_git_commit": "2c966d6b5fb275360e07d6440b011a5b6df351ed",
    "dispatch_head": "2c966d6b5fb275360e07d6440b011a5b6df351ed",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R1_RESULT.md",
      "packages/agent_team/worktree_writes.py",
      "tests/agent_team/test_worktree_writes_e06.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-r1-s927f20r1",
    "actor_id": "developer-primary-f20-r1",
    "subject_ref": "F-20/R1",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T14:03:41+00:00",
    "expires_at": "2026-09-28T02:03:41+00:00",
    "lease_epoch": 1,
    "fencing_token": "f20-r1-write-fence-epoch-1-s927f20r1",
    "execution_fencing_token": "f20-r1-execution-fence-epoch-1-s927f20r1",
    "baseline_git_commit": "2c966d6b5fb275360e07d6440b011a5b6df351ed",
    "dispatch_head": "2c966d6b5fb275360e07d6440b011a5b6df351ed",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R1_RESULT.md",
      "packages/agent_team/worktree_writes.py",
      "tests/agent_team/test_worktree_writes_e06.py"
    ],
    "worker_lease_id": "worker-lease-f20-r1-s927f20r1",
    "write_epoch": 1,
    "write_fencing_token": "f20-r1-write-fence-epoch-1-s927f20r1"
  },
  "next_safe_action": "F20_R1_GIT_WRITE_ERROR_REWORK",
  "repository_head": "2c966d6b5fb275360e07d6440b011a5b6df351ed",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Historical acceptance invalidated; F-20 incomplete; Production NOT_EXECUTED.
