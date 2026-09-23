# F-04 GROQ adapter 시작

```json anvil-recovery-summary
{
  "event_sequence": 1372,
  "last_event_id": "evt_f04_1372_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-04",
  "active_agent": "developer-primary-f04-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f04-r1-20260923-001",
    "actor_id": "developer-primary-f04-r1",
    "subject_ref": "F-04",
    "status": "ACTIVE",
    "issued_at": "2026-09-23T20:00:00+09:00",
    "expires_at": "2026-09-24T08:00:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f04-r1-execution-fence-epoch-1-b53a53f9611e8fae",
    "execution_fencing_token": "f04-r1-execution-fence-epoch-1-b53a53f9611e8fae",
    "baseline_git_commit": "b53a53f9611e8fae70d0ab2b9cd175f6ab2e3918",
    "dispatch_head": "b53a53f9611e8fae70d0ab2b9cd175f6ab2e3918",
    "path_scope": [
      "docs/04_test_reports/F-04_COMPLETION_REPORT.md",
      "packages/providers/groq_adapter.py",
      "packages/providers/groq_errors.py",
      "packages/providers/groq_models.py",
      "tests/providers/test_groq_adapter_f04.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f04-r1-20260923-001",
    "actor_id": "developer-primary-f04-r1",
    "subject_ref": "F-04",
    "status": "ACTIVE",
    "issued_at": "2026-09-23T20:00:00+09:00",
    "expires_at": "2026-09-24T08:00:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f04-r1-write-fence-epoch-1-70d0ab2b9cd175f6",
    "execution_fencing_token": "f04-r1-execution-fence-epoch-1-b53a53f9611e8fae",
    "baseline_git_commit": "b53a53f9611e8fae70d0ab2b9cd175f6ab2e3918",
    "dispatch_head": "b53a53f9611e8fae70d0ab2b9cd175f6ab2e3918",
    "path_scope": [
      "docs/04_test_reports/F-04_COMPLETION_REPORT.md",
      "packages/providers/groq_adapter.py",
      "packages/providers/groq_errors.py",
      "packages/providers/groq_models.py",
      "tests/providers/test_groq_adapter_f04.py"
    ],
    "worker_lease_id": "worker-lease-f04-r1-20260923-001",
    "write_epoch": 1,
    "write_fencing_token": "f04-r1-write-fence-epoch-1-70d0ab2b9cd175f6"
  },
  "next_work_package": {
    "package_id": "F-05",
    "status": "BLOCKED_PENDING_F04_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F04_EXACT5",
  "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F04_EXACT5"
}
```
