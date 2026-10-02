# F-20/U-01 R28 Browser Evidence Contract handoff

```json anvil-recovery-summary
{
  "event_sequence": 1966,
  "last_event_id": "evt_f20_1966_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r28",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r28-r28contract1002",
    "actor_id": "developer-primary-f20-u01-r28",
    "subject_ref": "F-20/U01-R28",
    "status": "ACTIVE",
    "issued_at": "2026-10-02T05:07:36+00:00",
    "expires_at": "2026-10-02T17:07:36+00:00",
    "lease_epoch": 42,
    "fencing_token": "f20-u01-r28-execution-fence-epoch-42-r28contract1002",
    "execution_fencing_token": "f20-u01-r28-execution-fence-epoch-42-r28contract1002",
    "baseline_git_commit": "91bfe15667368c7cb2e4f0be6716dffd82d53f8f",
    "dispatch_head": "91bfe15667368c7cb2e4f0be6716dffd82d53f8f",
    "path_scope": [
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r28-r28contract1002",
    "actor_id": "developer-primary-f20-u01-r28",
    "subject_ref": "F-20/U01-R28",
    "status": "ACTIVE",
    "issued_at": "2026-10-02T05:07:36+00:00",
    "expires_at": "2026-10-02T17:07:36+00:00",
    "lease_epoch": 42,
    "fencing_token": "f20-u01-r28-write-fence-epoch-42-r28contract1002",
    "execution_fencing_token": "f20-u01-r28-execution-fence-epoch-42-r28contract1002",
    "baseline_git_commit": "91bfe15667368c7cb2e4f0be6716dffd82d53f8f",
    "dispatch_head": "91bfe15667368c7cb2e4f0be6716dffd82d53f8f",
    "path_scope": [
      "tests/integration/test_f20_u01_oidc_browser_pg15.py",
      "docs/04_test_reports/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r28-r28contract1002",
    "write_epoch": 42,
    "write_fencing_token": "f20-u01-r28-write-fence-epoch-42-r28contract1002"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R28_BROWSER_EVIDENCE_CONTRACT_REWORK",
  "repository_head": "91bfe15667368c7cb2e4f0be6716dffd82d53f8f",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- R27 lease revoked incomplete; R28 evidence-contract rework only; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
