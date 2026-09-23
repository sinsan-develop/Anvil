# F-03 CEREBRAS adapter start

```json anvil-recovery-summary
{
  "event_sequence": 1363,
  "last_event_id": "evt_f03_1363_package_started",
  "status": "IN_PROGRESS",
  "current_phase": "F",
  "current_work_package": "F-03",
  "active_agent": {
    "actor_id": "developer-primary-f03-r1",
    "role": "PRIMARY_DEVELOPER",
    "work_package_id": "F-03",
    "status": "ACTIVE",
    "execution_fencing_token": "f03-r1-execution-fence-epoch-1-1fadc0a7c7a69588"
  },
  "worker_lease": {
    "lease_id": "worker-lease-f03-r1-20260923-001",
    "actor_id": "developer-primary-f03-r1",
    "subject_ref": "F-03",
    "status": "ACTIVE",
    "issued_at": "2026-09-23T18:20:00+09:00",
    "expires_at": "2026-09-24T06:20:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f03-r1-execution-fence-epoch-1-1fadc0a7c7a69588",
    "execution_fencing_token": "f03-r1-execution-fence-epoch-1-1fadc0a7c7a69588",
    "baseline_git_commit": "1fadc0a7c7a69588a5cb5a6e36a95399b1a1791e",
    "dispatch_head": "1fadc0a7c7a69588a5cb5a6e36a95399b1a1791e",
    "path_scope": [
      "docs/04_test_reports/F-03_COMPLETION_REPORT.md",
      "packages/providers/cerebras_adapter.py",
      "packages/providers/cerebras_errors.py",
      "packages/providers/cerebras_models.py",
      "tests/providers/test_cerebras_adapter_f03.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f03-r1-20260923-001",
    "actor_id": "developer-primary-f03-r1",
    "subject_ref": "F-03",
    "status": "ACTIVE",
    "issued_at": "2026-09-23T18:20:00+09:00",
    "expires_at": "2026-09-24T06:20:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f03-r1-write-fence-epoch-1-5cb5a6e36a95399b",
    "execution_fencing_token": "f03-r1-execution-fence-epoch-1-1fadc0a7c7a69588",
    "baseline_git_commit": "1fadc0a7c7a69588a5cb5a6e36a95399b1a1791e",
    "dispatch_head": "1fadc0a7c7a69588a5cb5a6e36a95399b1a1791e",
    "path_scope": [
      "docs/04_test_reports/F-03_COMPLETION_REPORT.md",
      "packages/providers/cerebras_adapter.py",
      "packages/providers/cerebras_errors.py",
      "packages/providers/cerebras_models.py",
      "tests/providers/test_cerebras_adapter_f03.py"
    ],
    "worker_lease_id": "worker-lease-f03-r1-20260923-001",
    "write_epoch": 1,
    "write_fencing_token": "f03-r1-write-fence-epoch-1-5cb5a6e36a95399b"
  },
  "next_work_package": {
    "package_id": "F-03",
    "status": "IN_PROGRESS"
  },
  "next_successor_work_package": {
    "package_id": "F-04",
    "status": "NOT_READY"
  },
  "next_safe_action": "F03_CEREBRAS_ADAPTER_TDD",
  "runtime_next_action": "F03_CEREBRAS_ADAPTER_TDD",
  "repository_validated_base": "1fadc0a7c7a69588a5cb5a6e36a95399b1a1791e",
  "repository_branch": "codex/f03-cerebras-adapter",
  "external_execution": "NOT_AUTHORIZED_NOT_EXECUTED"
}
```
