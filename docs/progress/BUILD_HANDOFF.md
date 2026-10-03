# F-20/U-01 R36 Scoped Agent owner summary start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2020,
  "last_event_id": "evt_f20_2020_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r36",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r36-r36agent1004",
    "actor_id": "developer-primary-f20-u01-r36",
    "subject_ref": "F-20/U01-R36",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T19:00:30+00:00",
    "expires_at": "2026-10-04T07:00:30+00:00",
    "lease_epoch": 51,
    "fencing_token": "f20-u01-r36-execution-fence-epoch-51-r36agent1004",
    "execution_fencing_token": "f20-u01-r36-execution-fence-epoch-51-r36agent1004",
    "baseline_git_commit": "94f5347edd9f9d9235507172598abe0d792944ad",
    "dispatch_head": "94f5347edd9f9d9235507172598abe0d792944ad",
    "path_scope": [
      "packages/observability/agent_owner_summary.py",
      "tests/observability/test_f20_u01_r36_agent_owner_summary.py",
      "packages/observability/service.py",
      "apps/api/anvil_api/oidc_process.py",
      "tests/observability/test_f20_u01_r36_agent_host_binding.py",
      "tests/integration/test_f20_u01_r36_agent_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R36_SCOPED_AGENT_SUMMARY_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r36-r36agent1004",
    "actor_id": "developer-primary-f20-u01-r36",
    "subject_ref": "F-20/U01-R36",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T19:00:30+00:00",
    "expires_at": "2026-10-04T07:00:30+00:00",
    "lease_epoch": 51,
    "fencing_token": "f20-u01-r36-write-fence-epoch-51-r36agent1004",
    "execution_fencing_token": "f20-u01-r36-execution-fence-epoch-51-r36agent1004",
    "baseline_git_commit": "94f5347edd9f9d9235507172598abe0d792944ad",
    "dispatch_head": "94f5347edd9f9d9235507172598abe0d792944ad",
    "path_scope": [
      "packages/observability/agent_owner_summary.py",
      "tests/observability/test_f20_u01_r36_agent_owner_summary.py",
      "packages/observability/service.py",
      "apps/api/anvil_api/oidc_process.py",
      "tests/observability/test_f20_u01_r36_agent_host_binding.py",
      "tests/integration/test_f20_u01_r36_agent_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R36_SCOPED_AGENT_SUMMARY_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r36-r36agent1004",
    "write_epoch": 51,
    "write_fencing_token": "f20-u01-r36-write-fence-epoch-51-r36agent1004"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R36_SCOPED_AGENT_SUMMARY_IMPLEMENTATION",
  "repository_head": "94f5347edd9f9d9235507172598abe0d792944ad",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Internal read only; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
