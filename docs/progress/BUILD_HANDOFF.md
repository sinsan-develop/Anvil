# F-20/U-01 R4 Critical Alerts handoff

```json anvil-recovery-summary
{
  "event_sequence": 1810,
  "last_event_id": "evt_f20_1810_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r4",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r4-r4alertstart1",
    "actor_id": "developer-primary-f20-u01-r4",
    "subject_ref": "F-20/U01-R4",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T22:09:55+00:00",
    "expires_at": "2026-09-29T10:09:55+00:00",
    "lease_epoch": 16,
    "fencing_token": "f20-u01-r4-execution-fence-epoch-16-r4alertstart1",
    "execution_fencing_token": "f20-u01-r4-execution-fence-epoch-16-r4alertstart1",
    "baseline_git_commit": "393e82da6a7ba86efe0bf25aab6010313b59a105",
    "dispatch_head": "393e82da6a7ba86efe0bf25aab6010313b59a105",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "docs/04_test_reports/F-20_U01_R4_CRITICAL_ALERTS_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r4-r4alertstart1",
    "actor_id": "developer-primary-f20-u01-r4",
    "subject_ref": "F-20/U01-R4",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T22:09:55+00:00",
    "expires_at": "2026-09-29T10:09:55+00:00",
    "lease_epoch": 16,
    "fencing_token": "f20-u01-r4-write-fence-epoch-16-r4alertstart1",
    "execution_fencing_token": "f20-u01-r4-execution-fence-epoch-16-r4alertstart1",
    "baseline_git_commit": "393e82da6a7ba86efe0bf25aab6010313b59a105",
    "dispatch_head": "393e82da6a7ba86efe0bf25aab6010313b59a105",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "docs/04_test_reports/F-20_U01_R4_CRITICAL_ALERTS_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r4-r4alertstart1",
    "write_epoch": 16,
    "write_fencing_token": "f20-u01-r4-write-fence-epoch-16-r4alertstart1"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R4_CRITICAL_ALERTS_REWORK",
  "repository_head": "393e82da6a7ba86efe0bf25aab6010313b59a105",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 CRITICAL OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
