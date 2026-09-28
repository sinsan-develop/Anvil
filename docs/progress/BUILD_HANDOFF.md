# F-20/U-01 R2 Provider Dashboard handoff

```json anvil-recovery-summary
{
  "event_sequence": 1786,
  "last_event_id": "evt_f20_1786_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r2",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r2-r2start20260928",
    "actor_id": "developer-primary-f20-u01-r2",
    "subject_ref": "F-20/U01-R2",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T10:27:01+00:00",
    "expires_at": "2026-09-28T22:27:01+00:00",
    "lease_epoch": 12,
    "fencing_token": "f20-u01-r2-execution-fence-epoch-12-r2start20260928",
    "execution_fencing_token": "f20-u01-r2-execution-fence-epoch-12-r2start20260928",
    "baseline_git_commit": "708a8cd4595a8de3904865eb841cb6354d5655f3",
    "dispatch_head": "708a8cd4595a8de3904865eb841cb6354d5655f3",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "docs/04_test_reports/F-20_U01_R2_PROVIDER_STATUS_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r2-r2start20260928",
    "actor_id": "developer-primary-f20-u01-r2",
    "subject_ref": "F-20/U01-R2",
    "status": "ACTIVE",
    "issued_at": "2026-09-28T10:27:01+00:00",
    "expires_at": "2026-09-28T22:27:01+00:00",
    "lease_epoch": 12,
    "fencing_token": "f20-u01-r2-write-fence-epoch-12-r2start20260928",
    "execution_fencing_token": "f20-u01-r2-execution-fence-epoch-12-r2start20260928",
    "baseline_git_commit": "708a8cd4595a8de3904865eb841cb6354d5655f3",
    "dispatch_head": "708a8cd4595a8de3904865eb841cb6354d5655f3",
    "path_scope": [
      "apps/web/src/console/App.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "docs/04_test_reports/F-20_U01_R2_PROVIDER_STATUS_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r2-r2start20260928",
    "write_epoch": 12,
    "write_fencing_token": "f20-u01-r2-write-fence-epoch-12-r2start20260928"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": true,
  "next_safe_action": "F20_U01_R2_PROVIDER_STATUS_REWORK",
  "repository_head": "708a8cd4595a8de3904865eb841cb6354d5655f3",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- C30 CRITICAL OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.
