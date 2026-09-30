# F-20/U-01 R20 Next Actions Browser handoff

```json anvil-recovery-summary
{
  "event_sequence": 1918,
  "last_event_id": "evt_f20_1918_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r20",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r20-r20br1001",
    "actor_id": "developer-primary-f20-u01-r20",
    "subject_ref": "F-20/U01-R20",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T16:34:05+00:00",
    "expires_at": "2026-10-01T04:34:05+00:00",
    "lease_epoch": 34,
    "fencing_token": "f20-u01-r20-execution-fence-epoch-34-r20br1001",
    "execution_fencing_token": "f20-u01-r20-execution-fence-epoch-34-r20br1001",
    "baseline_git_commit": "2302980694acaf214b213d8e6728b294ca172a9a",
    "dispatch_head": "2302980694acaf214b213d8e6728b294ca172a9a",
    "path_scope": [
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R20_NEXT_ACTIONS_BROWSER_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r20-r20br1001",
    "actor_id": "developer-primary-f20-u01-r20",
    "subject_ref": "F-20/U01-R20",
    "status": "ACTIVE",
    "issued_at": "2026-09-30T16:34:05+00:00",
    "expires_at": "2026-10-01T04:34:05+00:00",
    "lease_epoch": 34,
    "fencing_token": "f20-u01-r20-write-fence-epoch-34-r20br1001",
    "execution_fencing_token": "f20-u01-r20-execution-fence-epoch-34-r20br1001",
    "baseline_git_commit": "2302980694acaf214b213d8e6728b294ca172a9a",
    "dispatch_head": "2302980694acaf214b213d8e6728b294ca172a9a",
    "path_scope": [
      "tests/browser/f20-u01-oidc-browser-pg15.mjs",
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R20_NEXT_ACTIONS_BROWSER_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r20-r20br1001",
    "write_epoch": 34,
    "write_fencing_token": "f20-u01-r20-write-fence-epoch-34-r20br1001"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R20_BROWSER_HARNESS_IMPLEMENTATION",
  "repository_head": "2302980694acaf214b213d8e6728b294ca172a9a",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
