# F-18 WSL R44 manifest head writer active

```json anvil-recovery-summary
{
  "event_sequence": 1667,
  "last_event_id": "evt_f18_local_1667_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r44-manifest-head",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r44-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r44-manifest-head",
    "subject_ref": "F-18/WSL_OPS_R44_MANIFEST_HEAD",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T08:34:57+09:00",
    "expires_at": "2026-09-27T20:34:57+09:00",
    "lease_epoch": 32,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-32-838a7591fd63f641",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-32-838a7591fd63f641",
    "baseline_git_commit": "7c1e6cfb1ea74e11f4c4268c2bff7d23f7e216ca",
    "dispatch_head": "7c1e6cfb1ea74e11f4c4268c2bff7d23f7e216ca",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/deployment/release_manifest.py",
      "tests/deploy/test_f16_release_manifest.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r44-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r44-manifest-head",
    "subject_ref": "F-18/WSL_OPS_R44_MANIFEST_HEAD",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T08:34:57+09:00",
    "expires_at": "2026-09-27T20:34:57+09:00",
    "lease_epoch": 32,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-32-838a7591fd63f641",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-32-838a7591fd63f641",
    "baseline_git_commit": "7c1e6cfb1ea74e11f4c4268c2bff7d23f7e216ca",
    "dispatch_head": "7c1e6cfb1ea74e11f4c4268c2bff7d23f7e216ca",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/deployment/release_manifest.py",
      "tests/deploy/test_f16_release_manifest.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r44-20260927-001",
    "write_epoch": 32,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-32-838a7591fd63f641"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_R44_EXACT3",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_R44_EXACT3"
}
```

- R44 exact3 local manifest-head repair only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
