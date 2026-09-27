# F-20 R3 append-only lease handoff and browser path rework

```json anvil-recovery-summary
{
  "event_sequence": 1731,
  "last_event_id": "evt_f20_1731_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-r3",
  "worker_lease": {
    "lease_id": "worker-lease-f20-r3-r3sameorigin9f2",
    "actor_id": "developer-primary-f20-r3",
    "subject_ref": "F-20/R3",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T17:03:48+00:00",
    "expires_at": "2026-09-28T05:03:48+00:00",
    "lease_epoch": 3,
    "fencing_token": "f20-r3-execution-fence-epoch-3-r3sameorigin9f2",
    "execution_fencing_token": "f20-r3-execution-fence-epoch-3-r3sameorigin9f2",
    "baseline_git_commit": "e6e85b631ddc82308b1ae9fe90c3f818c8136627",
    "dispatch_head": "e6e85b631ddc82308b1ae9fe90c3f818c8136627",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R3_RESULT.md",
      "apps/web/src/api/c29-agent-console-client.js",
      "apps/web/src/api/projects-client.js",
      "apps/web/tests/c29-console-runtime.test.mjs",
      "apps/web/tests/projects.test.mjs"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-r3-r3sameorigin9f2",
    "actor_id": "developer-primary-f20-r3",
    "subject_ref": "F-20/R3",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T17:03:48+00:00",
    "expires_at": "2026-09-28T05:03:48+00:00",
    "lease_epoch": 3,
    "fencing_token": "f20-r3-write-fence-epoch-3-r3sameorigin9f2",
    "execution_fencing_token": "f20-r3-execution-fence-epoch-3-r3sameorigin9f2",
    "baseline_git_commit": "e6e85b631ddc82308b1ae9fe90c3f818c8136627",
    "dispatch_head": "e6e85b631ddc82308b1ae9fe90c3f818c8136627",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R3_RESULT.md",
      "apps/web/src/api/c29-agent-console-client.js",
      "apps/web/src/api/projects-client.js",
      "apps/web/tests/c29-console-runtime.test.mjs",
      "apps/web/tests/projects.test.mjs"
    ],
    "worker_lease_id": "worker-lease-f20-r3-r3sameorigin9f2",
    "write_epoch": 3,
    "write_fencing_token": "f20-r3-write-fence-epoch-3-r3sameorigin9f2"
  },
  "next_safe_action": "F20_R3_BROWSER_SAME_ORIGIN_REWORK",
  "repository_head": "e6e85b631ddc82308b1ae9fe90c3f818c8136627",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- F-20 incomplete; Production NOT_EXECUTED.
