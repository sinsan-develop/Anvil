# F-20 C30 recovery v2 verifier start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2044,
  "last_event_id": "evt_f20_2044_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-c30-recovery-v2",
  "worker_lease": {
    "lease_id": "worker-lease-f20-c30v2-c30v2001",
    "actor_id": "developer-primary-f20-c30-recovery-v2",
    "subject_ref": "F-20/C30-RECOVERY-V2",
    "status": "ACTIVE",
    "issued_at": "2026-10-04T09:25:52+00:00",
    "expires_at": "2026-10-05T09:25:52+00:00",
    "lease_epoch": 55,
    "fencing_token": "f20-c30v2-execution-fence-epoch-55-c30v2001",
    "execution_fencing_token": "f20-c30v2-execution-fence-epoch-55-c30v2001",
    "baseline_git_commit": "f1e992d85c08fabbec69db271dbf70bed7dc0fce",
    "dispatch_head": "f1e992d85c08fabbec69db271dbf70bed7dc0fce",
    "path_scope": [
      "scripts/f20_c30_recovery_v2.py",
      "tests/tooling/test_f20_c30_recovery_v2.py",
      "docs/04_test_reports/F-20_C30_EVENT_RECOVERY_V2_DEVELOPER_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-c30v2-c30v2001",
    "actor_id": "developer-primary-f20-c30-recovery-v2",
    "subject_ref": "F-20/C30-RECOVERY-V2",
    "status": "ACTIVE",
    "issued_at": "2026-10-04T09:25:52+00:00",
    "expires_at": "2026-10-05T09:25:52+00:00",
    "lease_epoch": 55,
    "fencing_token": "f20-c30v2-write-fence-epoch-55-c30v2001",
    "execution_fencing_token": "f20-c30v2-execution-fence-epoch-55-c30v2001",
    "baseline_git_commit": "f1e992d85c08fabbec69db271dbf70bed7dc0fce",
    "dispatch_head": "f1e992d85c08fabbec69db271dbf70bed7dc0fce",
    "path_scope": [
      "scripts/f20_c30_recovery_v2.py",
      "tests/tooling/test_f20_c30_recovery_v2.py",
      "docs/04_test_reports/F-20_C30_EVENT_RECOVERY_V2_DEVELOPER_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-c30v2-c30v2001",
    "write_epoch": 55,
    "write_fencing_token": "f20-c30v2-write-fence-epoch-55-c30v2001"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "C30_V2_VERIFIER_EXACT_SCOPE_IMPLEMENTATION",
  "repository_head": "f1e992d85c08fabbec69db271dbf70bed7dc0fce",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Exact3 verifier write lease only; C30 OPEN_BLOCKING; F-20 unaccepted; Release DEFER; Production NOT_EXECUTED.
