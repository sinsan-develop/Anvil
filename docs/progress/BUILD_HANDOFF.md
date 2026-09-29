# F-20/U-01 R13 scoped Agent owner handoff

```json anvil-recovery-summary
{
  "event_sequence": 1870,
  "last_event_id": "evt_f20_1870_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r13",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r13-r13run3009a",
    "actor_id": "developer-primary-f20-u01-r13",
    "subject_ref": "F-20/U01-R13",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T22:58:29+00:00",
    "expires_at": "2026-09-30T10:58:29+00:00",
    "lease_epoch": 26,
    "fencing_token": "f20-u01-r13-execution-fence-epoch-26-r13run3009a",
    "execution_fencing_token": "f20-u01-r13-execution-fence-epoch-26-r13run3009a",
    "baseline_git_commit": "489d656b4715f4176b51539de89b0c09ddae3cf2",
    "dispatch_head": "489d656b4715f4176b51539de89b0c09ddae3cf2",
    "path_scope": [
      "packages/persistence/operations_agent_owner_read.py",
      "tests/persistence/test_f20_u01_agent_owner_read.py",
      "docs/04_test_reports/F-20_U01_R13_SCOPED_AGENT_OWNER_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r13-r13run3009a",
    "actor_id": "developer-primary-f20-u01-r13",
    "subject_ref": "F-20/U01-R13",
    "status": "ACTIVE",
    "issued_at": "2026-09-29T22:58:29+00:00",
    "expires_at": "2026-09-30T10:58:29+00:00",
    "lease_epoch": 26,
    "fencing_token": "f20-u01-r13-write-fence-epoch-26-r13run3009a",
    "execution_fencing_token": "f20-u01-r13-execution-fence-epoch-26-r13run3009a",
    "baseline_git_commit": "489d656b4715f4176b51539de89b0c09ddae3cf2",
    "dispatch_head": "489d656b4715f4176b51539de89b0c09ddae3cf2",
    "path_scope": [
      "packages/persistence/operations_agent_owner_read.py",
      "tests/persistence/test_f20_u01_agent_owner_read.py",
      "docs/04_test_reports/F-20_U01_R13_SCOPED_AGENT_OWNER_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r13-r13run3009a",
    "write_epoch": 26,
    "write_fencing_token": "f20-u01-r13-write-fence-epoch-26-r13run3009a"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R13_SCOPED_AGENT_OWNER_IMPLEMENTATION",
  "repository_head": "489d656b4715f4176b51539de89b0c09ddae3cf2",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
