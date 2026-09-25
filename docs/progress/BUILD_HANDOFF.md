# F-18 WSL R17 role image writer start

```json anvil-recovery-summary
{
  "event_sequence": 1566,
  "last_event_id": "evt_f18_local_1566_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r17-role-images",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r17-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r17-role-images",
    "subject_ref": "F-18/WSL_OPS_R17_ROLE_IMAGES",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T01:05:00+09:00",
    "expires_at": "2026-09-26T13:05:00+09:00",
    "lease_epoch": 11,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-11-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-11-69247977e4e51781",
    "baseline_git_commit": "b59936123dc74f5d81126b20d70ad2ebb483ac65",
    "dispatch_head": "b59936123dc74f5d81126b20d70ad2ebb483ac65",
    "path_scope": [
      "deploy/wsl/Dockerfile.f18",
      "deploy/wsl/Dockerfile.f18.dockerignore",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_role_images.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r17-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r17-role-images",
    "subject_ref": "F-18/WSL_OPS_R17_ROLE_IMAGES",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T01:05:00+09:00",
    "expires_at": "2026-09-26T13:05:00+09:00",
    "lease_epoch": 11,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-11-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-11-69247977e4e51781",
    "baseline_git_commit": "b59936123dc74f5d81126b20d70ad2ebb483ac65",
    "dispatch_head": "b59936123dc74f5d81126b20d70ad2ebb483ac65",
    "path_scope": [
      "deploy/wsl/Dockerfile.f18",
      "deploy/wsl/Dockerfile.f18.dockerignore",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_role_images.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r17-20260926-001",
    "write_epoch": 11,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-11-69247977e4e51781"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_BUILD_F18_ROLE_IMAGES_EXACT4",
  "runtime_next_action": "DEVELOPER_BUILD_F18_ROLE_IMAGES_EXACT4"
}
```

- R17 exact4 role-image build only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
