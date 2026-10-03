# F-20/U-01 R37 Provider registration source start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2026,
  "last_event_id": "evt_f20_2026_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r37",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r37-r37prov1004",
    "actor_id": "developer-primary-f20-u01-r37",
    "subject_ref": "F-20/U01-R37",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T20:21:43+00:00",
    "expires_at": "2026-10-04T08:21:43+00:00",
    "lease_epoch": 52,
    "fencing_token": "f20-u01-r37-execution-fence-epoch-52-r37prov1004",
    "execution_fencing_token": "f20-u01-r37-execution-fence-epoch-52-r37prov1004",
    "baseline_git_commit": "6aa7fd80f78ea849cccd0c6378d298c2b317b35d",
    "dispatch_head": "6aa7fd80f78ea849cccd0c6378d298c2b317b35d",
    "path_scope": [
      "apps/api/anvil_api/oidc_process.py",
      "tests/api/test_f20_u01_r37_provider_host_binding.py",
      "tests/integration/test_f20_u01_r37_provider_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R37_PROVIDER_REGISTRATION_SOURCE_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r37-r37prov1004",
    "actor_id": "developer-primary-f20-u01-r37",
    "subject_ref": "F-20/U01-R37",
    "status": "ACTIVE",
    "issued_at": "2026-10-03T20:21:43+00:00",
    "expires_at": "2026-10-04T08:21:43+00:00",
    "lease_epoch": 52,
    "fencing_token": "f20-u01-r37-write-fence-epoch-52-r37prov1004",
    "execution_fencing_token": "f20-u01-r37-execution-fence-epoch-52-r37prov1004",
    "baseline_git_commit": "6aa7fd80f78ea849cccd0c6378d298c2b317b35d",
    "dispatch_head": "6aa7fd80f78ea849cccd0c6378d298c2b317b35d",
    "path_scope": [
      "apps/api/anvil_api/oidc_process.py",
      "tests/api/test_f20_u01_r37_provider_host_binding.py",
      "tests/integration/test_f20_u01_r37_provider_host_pg15.py",
      "docs/04_test_reports/F-20_U01_R37_PROVIDER_REGISTRATION_SOURCE_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r37-r37prov1004",
    "write_epoch": 52,
    "write_fencing_token": "f20-u01-r37-write-fence-epoch-52-r37prov1004"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R37_PROVIDER_REGISTRATION_SOURCE_IMPLEMENTATION",
  "repository_head": "6aa7fd80f78ea849cccd0c6378d298c2b317b35d",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Credential presence only, not Provider health; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
