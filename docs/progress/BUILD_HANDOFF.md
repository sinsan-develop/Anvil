# F-16 Git-only WSL staging and ReleaseManifest start

```json anvil-recovery-summary
{
  "event_sequence": 1477,
  "last_event_id": "evt_f16_1477_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-16",
  "active_agent": "developer-primary-f16-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f16-r1-20260924-001",
    "actor_id": "developer-primary-f16-r1",
    "subject_ref": "F-16",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T12:37:00+09:00",
    "expires_at": "2026-09-25T00:37:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f16-r1-execution-fence-epoch-1-f2b124a4c8dfdcf1",
    "execution_fencing_token": "f16-r1-execution-fence-epoch-1-f2b124a4c8dfdcf1",
    "baseline_git_commit": "f2b124a4c8dfdcf15a61261912aab93728fc757c",
    "dispatch_head": "f2b124a4c8dfdcf15a61261912aab93728fc757c",
    "path_scope": [
      "deploy/wsl/compose.f16.yml",
      "deploy/wsl/f16_staging.py",
      "docs/04_test_reports/F-16_COMPLETION_REPORT.md",
      "packages/deployment/__init__.py",
      "packages/deployment/release_manifest.py",
      "tests/deploy/test_f16_release_manifest.py",
      "tests/deploy/test_f16_staging_compose.py",
      "tests/deploy/test_f16_staging_git.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f16-r1-20260924-001",
    "actor_id": "developer-primary-f16-r1",
    "subject_ref": "F-16",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T12:37:00+09:00",
    "expires_at": "2026-09-25T00:37:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f16-r1-write-fence-epoch-1-5a61261912aab937",
    "execution_fencing_token": "f16-r1-execution-fence-epoch-1-f2b124a4c8dfdcf1",
    "baseline_git_commit": "f2b124a4c8dfdcf15a61261912aab93728fc757c",
    "dispatch_head": "f2b124a4c8dfdcf15a61261912aab93728fc757c",
    "path_scope": [
      "deploy/wsl/compose.f16.yml",
      "deploy/wsl/f16_staging.py",
      "docs/04_test_reports/F-16_COMPLETION_REPORT.md",
      "packages/deployment/__init__.py",
      "packages/deployment/release_manifest.py",
      "tests/deploy/test_f16_release_manifest.py",
      "tests/deploy/test_f16_staging_compose.py",
      "tests/deploy/test_f16_staging_git.py"
    ],
    "worker_lease_id": "worker-lease-f16-r1-20260924-001",
    "write_epoch": 1,
    "write_fencing_token": "f16-r1-write-fence-epoch-1-5a61261912aab937"
  },
  "next_work_package": {
    "package_id": "F-17",
    "status": "BLOCKED_PENDING_F16_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F16_EXACT8",
  "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F16_EXACT8"
}
```
