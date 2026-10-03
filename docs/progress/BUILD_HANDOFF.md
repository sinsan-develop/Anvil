# F-20/U-01 R38B Budget fixture rework start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2038,
  "last_event_id": "evt_f20_2038_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r38b",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r38b-r38bfix1004",
    "actor_id": "developer-primary-f20-u01-r38b",
    "subject_ref": "F-20/U01-R38B",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T23:47:10+00:00",
    "expires_at": "2026-10-04T11:47:10+00:00",
    "lease_epoch": 54,
    "fencing_token": "f20-u01-r38b-execution-fence-epoch-54-r38bfix1004",
    "execution_fencing_token": "f20-u01-r38b-execution-fence-epoch-54-r38bfix1004",
    "baseline_git_commit": "b6474bb55168fbb96fea594439ab865af2f9f2d4",
    "dispatch_head": "b6474bb55168fbb96fea594439ab865af2f9f2d4",
    "path_scope": [
      "tests/observability/test_f20_u01_r17_run_host_binding.py",
      "tests/observability/test_f20_u01_r36_agent_host_binding.py",
      "tests/api/test_f20_u01_r9_oidc_queue_host.py",
      "tests/api/test_f20_u01_r37_provider_host_binding.py",
      "tests/integration/test_f20_u01_r37_provider_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r38b-r38bfix1004",
    "actor_id": "developer-primary-f20-u01-r38b",
    "subject_ref": "F-20/U01-R38B",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T23:47:10+00:00",
    "expires_at": "2026-10-04T11:47:10+00:00",
    "lease_epoch": 54,
    "fencing_token": "f20-u01-r38b-write-fence-epoch-54-r38bfix1004",
    "execution_fencing_token": "f20-u01-r38b-execution-fence-epoch-54-r38bfix1004",
    "baseline_git_commit": "b6474bb55168fbb96fea594439ab865af2f9f2d4",
    "dispatch_head": "b6474bb55168fbb96fea594439ab865af2f9f2d4",
    "path_scope": [
      "tests/observability/test_f20_u01_r17_run_host_binding.py",
      "tests/observability/test_f20_u01_r36_agent_host_binding.py",
      "tests/api/test_f20_u01_r9_oidc_queue_host.py",
      "tests/api/test_f20_u01_r37_provider_host_binding.py",
      "tests/integration/test_f20_u01_r37_provider_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r38b-r38bfix1004",
    "write_epoch": 54,
    "write_fencing_token": "f20-u01-r38b-write-fence-epoch-54-r38bfix1004"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R38B_BUDGET_FIXTURE_REWORK",
  "repository_head": "b6474bb55168fbb96fea594439ab865af2f9f2d4",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE",
  "revision_binding_id": "MAIN_RECONFIRMED_NON_SEMANTIC:F20-U01-R38B-FIXTURE-20261004-001"
}
```

- Fixture-only local rework; R38 remains INCOMPLETE, C30 OPEN_BLOCKING; F-20 unaccepted; Production NOT_EXECUTED.
