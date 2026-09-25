# F-18 WSL R8 OIDC code-flow writer start

```json anvil-recovery-summary
{
  "event_sequence": 1541,
  "last_event_id": "evt_f18_local_1541_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r8-code-flow",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r8-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r8-code-flow",
    "subject_ref": "F-18/WSL_OPS_R8_CODE_FLOW",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T13:03:10+09:00",
    "expires_at": "2026-09-26T01:03:10+09:00",
    "lease_epoch": 6,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-6-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-6-69247977e4e51781",
    "baseline_git_commit": "ac44e8e7fc447128cd68d3cb015410eee54644c8",
    "dispatch_head": "ac44e8e7fc447128cd68d3cb015410eee54644c8",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_code_flow.py",
      "tests/api/test_oidc_code_flow.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r8-20260925-001",
    "actor_id": "developer-primary-f18-wsl-ops-r8-code-flow",
    "subject_ref": "F-18/WSL_OPS_R8_CODE_FLOW",
    "status": "ACTIVE",
    "issued_at": "2026-09-25T13:03:10+09:00",
    "expires_at": "2026-09-26T01:03:10+09:00",
    "lease_epoch": 6,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-6-69247977e4e51781",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-6-69247977e4e51781",
    "baseline_git_commit": "ac44e8e7fc447128cd68d3cb015410eee54644c8",
    "dispatch_head": "ac44e8e7fc447128cd68d3cb015410eee54644c8",
    "path_scope": [
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "packages/api/oidc_code_flow.py",
      "tests/api/test_oidc_code_flow.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r8-20260925-001",
    "write_epoch": 6,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-6-69247977e4e51781"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_BUILD_F18_OIDC_CODE_FLOW_EXACT3",
  "runtime_next_action": "DEVELOPER_BUILD_F18_OIDC_CODE_FLOW_EXACT3"
}
```

- R8 exact3 code flow only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
