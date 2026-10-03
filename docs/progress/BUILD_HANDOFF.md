# F-20/U-01 R38 Scoped budget source start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2032,
  "last_event_id": "evt_f20_2032_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r38",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r38-r38bud1004",
    "actor_id": "developer-primary-f20-u01-r38",
    "subject_ref": "F-20/U01-R38",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T22:32:23+00:00",
    "expires_at": "2026-10-04T10:32:23+00:00",
    "lease_epoch": 53,
    "fencing_token": "f20-u01-r38-execution-fence-epoch-53-r38bud1004",
    "execution_fencing_token": "f20-u01-r38-execution-fence-epoch-53-r38bud1004",
    "baseline_git_commit": "fceffd660d3f99c27221d286b0f19c1787a13ccd",
    "dispatch_head": "fceffd660d3f99c27221d286b0f19c1787a13ccd",
    "path_scope": [
      "packages/persistence/operations_budget_read.py",
      "apps/api/anvil_api/oidc_process.py",
      "tests/persistence/test_operations_budget_read.py",
      "tests/api/test_f20_u01_r38_budget_host_binding.py",
      "tests/integration/test_f20_u01_r38_budget_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R38_SCOPED_BUDGET_SOURCE_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r38-r38bud1004",
    "actor_id": "developer-primary-f20-u01-r38",
    "subject_ref": "F-20/U01-R38",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T22:32:23+00:00",
    "expires_at": "2026-10-04T10:32:23+00:00",
    "lease_epoch": 53,
    "fencing_token": "f20-u01-r38-write-fence-epoch-53-r38bud1004",
    "execution_fencing_token": "f20-u01-r38-execution-fence-epoch-53-r38bud1004",
    "baseline_git_commit": "fceffd660d3f99c27221d286b0f19c1787a13ccd",
    "dispatch_head": "fceffd660d3f99c27221d286b0f19c1787a13ccd",
    "path_scope": [
      "packages/persistence/operations_budget_read.py",
      "apps/api/anvil_api/oidc_process.py",
      "tests/persistence/test_operations_budget_read.py",
      "tests/api/test_f20_u01_r38_budget_host_binding.py",
      "tests/integration/test_f20_u01_r38_budget_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R38_SCOPED_BUDGET_SOURCE_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r38-r38bud1004",
    "write_epoch": 53,
    "write_fencing_token": "f20-u01-r38-write-fence-epoch-53-r38bud1004"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R38_SCOPED_BUDGET_SOURCE_IMPLEMENTATION",
  "repository_head": "fceffd660d3f99c27221d286b0f19c1787a13ccd",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Scoped budget ledger/reservation only, not forecast-overrun acceptance; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
