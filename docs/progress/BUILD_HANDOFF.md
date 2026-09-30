# F-20/U-01 R17 scoped Run host binding handoff

```json anvil-recovery-summary
{
  "event_sequence": 1894,
  "last_event_id": "evt_f20_1894_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r17",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r17-r17run3009d",
    "actor_id": "developer-primary-f20-u01-r17",
    "subject_ref": "F-20/U01-R17",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T03:04:55+00:00",
    "expires_at": "2026-09-30T15:04:55+00:00",
    "lease_epoch": 30,
    "fencing_token": "f20-u01-r17-execution-fence-epoch-30-r17run3009d",
    "execution_fencing_token": "f20-u01-r17-execution-fence-epoch-30-r17run3009d",
    "baseline_git_commit": "e045b702d062ed2740766b546b8c11b16d869a9f",
    "dispatch_head": "e045b702d062ed2740766b546b8c11b16d869a9f",
    "path_scope": [
      "packages/observability/service.py",
      "apps/api/anvil_api/oidc_process.py",
      "tests/observability/test_f20_u01_r17_run_host_binding.py",
      "docs/04_test_reports/F-20_U01_R17_SCOPED_RUN_HOST_BINDING_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r17-r17run3009d",
    "actor_id": "developer-primary-f20-u01-r17",
    "subject_ref": "F-20/U01-R17",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T03:04:55+00:00",
    "expires_at": "2026-09-30T15:04:55+00:00",
    "lease_epoch": 30,
    "fencing_token": "f20-u01-r17-write-fence-epoch-30-r17run3009d",
    "execution_fencing_token": "f20-u01-r17-execution-fence-epoch-30-r17run3009d",
    "baseline_git_commit": "e045b702d062ed2740766b546b8c11b16d869a9f",
    "dispatch_head": "e045b702d062ed2740766b546b8c11b16d869a9f",
    "path_scope": [
      "packages/observability/service.py",
      "apps/api/anvil_api/oidc_process.py",
      "tests/observability/test_f20_u01_r17_run_host_binding.py",
      "docs/04_test_reports/F-20_U01_R17_SCOPED_RUN_HOST_BINDING_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r17-r17run3009d",
    "write_epoch": 30,
    "write_fencing_token": "f20-u01-r17-write-fence-epoch-30-r17run3009d"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R17_SCOPED_RUN_HOST_BINDING_IMPLEMENTATION",
  "repository_head": "e045b702d062ed2740766b546b8c11b16d869a9f",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
