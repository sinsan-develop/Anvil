# F-20 R5e append-only C30 Event-integrity incident

```json anvil-recovery-summary
{
  "event_sequence": 1768,
  "last_event_id": "evt_f20_1768_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-r5e",
  "worker_lease": {
    "lease_id": "worker-lease-f20-r5e-27674f6cecba",
    "actor_id": "developer-primary-f20-r5e",
    "subject_ref": "F-20/R5e",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T03:16:47+00:00",
    "expires_at": "2026-09-28T15:16:47+00:00",
    "lease_epoch": 9,
    "fencing_token": "f20-r5e-execution-fence-epoch-9-27674f6cecba",
    "execution_fencing_token": "f20-r5e-execution-fence-epoch-9-27674f6cecba",
    "baseline_git_commit": "55c7730071e6bd99064b4bceb57d1c6e59353ae0",
    "dispatch_head": "55c7730071e6bd99064b4bceb57d1c6e59353ae0",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5E_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-r5e-27674f6cecba",
    "actor_id": "developer-primary-f20-r5e",
    "subject_ref": "F-20/R5e",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T03:16:47+00:00",
    "expires_at": "2026-09-28T15:16:47+00:00",
    "lease_epoch": 9,
    "fencing_token": "f20-r5e-write-fence-epoch-9-27674f6cecba",
    "execution_fencing_token": "f20-r5e-execution-fence-epoch-9-27674f6cecba",
    "baseline_git_commit": "55c7730071e6bd99064b4bceb57d1c6e59353ae0",
    "dispatch_head": "55c7730071e6bd99064b4bceb57d1c6e59353ae0",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R5E_RESULT.md",
      "tests/tooling/test_project_progress.py"
    ],
    "worker_lease_id": "worker-lease-f20-r5e-27674f6cecba",
    "write_epoch": 9,
    "write_fencing_token": "f20-r5e-write-fence-epoch-9-27674f6cecba"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_R5E_C30_AUDIT_REWORK",
  "repository_head": "55c7730071e6bd99064b4bceb57d1c6e59353ae0",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- CRITICAL Event-history defect OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
