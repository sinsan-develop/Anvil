# F-18 WSL R43B1 synthetic issuer active

```json anvil-recovery-summary
{
  "event_sequence": 1651,
  "last_event_id": "evt_f18_local_1651_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r43b1-qa-issuer",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r43b1-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r43b1-qa-issuer",
    "subject_ref": "F-18/WSL_OPS_R43B1_QA_ISSUER",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T03:05:41+09:00",
    "expires_at": "2026-09-27T15:05:41+09:00",
    "lease_epoch": 28,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-28-8e45b37ef11f8cd5",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-28-8e45b37ef11f8cd5",
    "baseline_git_commit": "fdbbc05e79c5d6ae4136f2f1e86c9f4a09736061",
    "dispatch_head": "fdbbc05e79c5d6ae4136f2f1e86c9f4a09736061",
    "path_scope": [
      "deploy/wsl/Dockerfile.f18.oidc-qa",
      "deploy/wsl/compose.f18.oidc.yml",
      "deploy/wsl/oidc_qa_issuer.py",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_oidc_qa_issuer.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r43b1-20260927-001",
    "actor_id": "developer-primary-f18-wsl-ops-r43b1-qa-issuer",
    "subject_ref": "F-18/WSL_OPS_R43B1_QA_ISSUER",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T03:05:41+09:00",
    "expires_at": "2026-09-27T15:05:41+09:00",
    "lease_epoch": 28,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-28-8e45b37ef11f8cd5",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-28-8e45b37ef11f8cd5",
    "baseline_git_commit": "fdbbc05e79c5d6ae4136f2f1e86c9f4a09736061",
    "dispatch_head": "fdbbc05e79c5d6ae4136f2f1e86c9f4a09736061",
    "path_scope": [
      "deploy/wsl/Dockerfile.f18.oidc-qa",
      "deploy/wsl/compose.f18.oidc.yml",
      "deploy/wsl/oidc_qa_issuer.py",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_oidc_qa_issuer.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r43b1-20260927-001",
    "write_epoch": 28,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-28-8e45b37ef11f8cd5"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_QA_OIDC_ISSUER_R43B1_EXACT5",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_QA_OIDC_ISSUER_R43B1_EXACT5"
}
```

- R43B1 exact5 synthetic issuer only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
