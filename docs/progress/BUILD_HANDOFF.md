# F-20 R2 append-only lease handoff and WSL suite rework

```json anvil-recovery-summary
{
  "event_sequence": 1725,
  "last_event_id": "evt_f20_1725_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-r2",
  "worker_lease": {
    "lease_id": "worker-lease-f20-r2-r228f20suite",
    "actor_id": "developer-primary-f20-r2",
    "subject_ref": "F-20/R2",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T15:59:26+00:00",
    "expires_at": "2026-09-28T03:59:26+00:00",
    "lease_epoch": 2,
    "fencing_token": "f20-r2-execution-fence-epoch-2-r228f20suite",
    "execution_fencing_token": "f20-r2-execution-fence-epoch-2-r228f20suite",
    "baseline_git_commit": "fd34d507bea0e8aea4294a9263fd28301c6a0c36",
    "dispatch_head": "fd34d507bea0e8aea4294a9263fd28301c6a0c36",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R2_RESULT.md",
      "packages/paths/identity.py",
      "tests/paths/test_conflict_scope_identity.py",
      "tests/deploy/test_wsl_staging_harness.py",
      "tests/tooling/test_a14_workbench_prototype.py",
      "tests/execution_backends/test_git_worktree.py",
      "tests/persistence/test_oidc_pending_auth.py",
      "tests/integration/test_c30r3_formal_entity.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-r2-r228f20suite",
    "actor_id": "developer-primary-f20-r2",
    "subject_ref": "F-20/R2",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T15:59:26+00:00",
    "expires_at": "2026-09-28T03:59:26+00:00",
    "lease_epoch": 2,
    "fencing_token": "f20-r2-write-fence-epoch-2-r228f20suite",
    "execution_fencing_token": "f20-r2-execution-fence-epoch-2-r228f20suite",
    "baseline_git_commit": "fd34d507bea0e8aea4294a9263fd28301c6a0c36",
    "dispatch_head": "fd34d507bea0e8aea4294a9263fd28301c6a0c36",
    "path_scope": [
      "docs/04_test_reports/F-20_REWORK_R2_RESULT.md",
      "packages/paths/identity.py",
      "tests/paths/test_conflict_scope_identity.py",
      "tests/deploy/test_wsl_staging_harness.py",
      "tests/tooling/test_a14_workbench_prototype.py",
      "tests/execution_backends/test_git_worktree.py",
      "tests/persistence/test_oidc_pending_auth.py",
      "tests/integration/test_c30r3_formal_entity.py"
    ],
    "worker_lease_id": "worker-lease-f20-r2-r228f20suite",
    "write_epoch": 2,
    "write_fencing_token": "f20-r2-write-fence-epoch-2-r228f20suite"
  },
  "next_safe_action": "F20_R2_WSL_SUITE_PORTABILITY_REWORK",
  "repository_head": "fd34d507bea0e8aea4294a9263fd28301c6a0c36",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- F-20 incomplete; Production NOT_EXECUTED.
