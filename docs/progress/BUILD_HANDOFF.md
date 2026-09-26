# F-18 WSL R43C runtime rework active

```json anvil-recovery-summary
{
  "event_sequence": 1659,
  "last_event_id": "evt_f18_local_1659_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r43c-runtime-rework",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r43c-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r43c-runtime-rework",
    "subject_ref": "F-18/WSL_OPS_R43C_RUNTIME_REWORK",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T04:12:16+09:00",
    "expires_at": "2026-09-27T16:12:16+09:00",
    "lease_epoch": 30,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-30-d3481ae6e086bcbf",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-30-d3481ae6e086bcbf",
    "baseline_git_commit": "d31cf84d959d3ecada4bf3b515f24da825191a18",
    "dispatch_head": "d31cf84d959d3ecada4bf3b515f24da825191a18",
    "path_scope": [
      "apps/worker/anvil_worker/main.py",
      "deploy/wsl/compose.f18.oidc.yml",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_oidc_formal_host_contract.py",
      "tests/integration/test_f15_local_stack.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r43c-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r43c-runtime-rework",
    "subject_ref": "F-18/WSL_OPS_R43C_RUNTIME_REWORK",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T04:12:16+09:00",
    "expires_at": "2026-09-27T16:12:16+09:00",
    "lease_epoch": 30,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-30-d3481ae6e086bcbf",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-30-d3481ae6e086bcbf",
    "baseline_git_commit": "d31cf84d959d3ecada4bf3b515f24da825191a18",
    "dispatch_head": "d31cf84d959d3ecada4bf3b515f24da825191a18",
    "path_scope": [
      "apps/worker/anvil_worker/main.py",
      "deploy/wsl/compose.f18.oidc.yml",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_oidc_formal_host_contract.py",
      "tests/integration/test_f15_local_stack.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r43c-20260927-001",
    "write_epoch": 30,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-30-d3481ae6e086bcbf"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_R43C_EXACT5",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_R43C_EXACT5"
}
```

- R43C exact5 local repair only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
