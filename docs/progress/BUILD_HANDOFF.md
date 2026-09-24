# F-18 Local/WSL preflight start; Production NOT_EXECUTED

```json anvil-recovery-summary
{
  "event_sequence": 1495,
  "last_event_id": "evt_f18_local_1495_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-local-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f18-local-r1-20260924-001",
    "actor_id": "developer-primary-f18-local-r1",
    "subject_ref": "F-18/LOCAL_WSL_PREFLIGHT",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T19:20:00+09:00",
    "expires_at": "2026-09-25T07:20:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f18-local-execution-fence-epoch-1-b6b3ff047b311ced",
    "execution_fencing_token": "f18-local-execution-fence-epoch-1-b6b3ff047b311ced",
    "baseline_git_commit": "b6b3ff047b311cedabecdd745e8ef0cccac2f92e",
    "dispatch_head": "b6b3ff047b311cedabecdd745e8ef0cccac2f92e",
    "path_scope": [
      "docs/04_test_reports/F-18_LOCAL_WSL_PREFLIGHT_REPORT.md",
      "packages/deployment/deploy_approval.py",
      "packages/deployment/promotion_preflight.py",
      "tests/deploy/test_f18_deploy_approval.py",
      "tests/deploy/test_f18_promotion_preflight.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-local-r1-20260924-001",
    "actor_id": "developer-primary-f18-local-r1",
    "subject_ref": "F-18/LOCAL_WSL_PREFLIGHT",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T19:20:00+09:00",
    "expires_at": "2026-09-25T07:20:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f18-local-write-fence-epoch-1-abecdd745e8ef0cc",
    "execution_fencing_token": "f18-local-execution-fence-epoch-1-b6b3ff047b311ced",
    "baseline_git_commit": "b6b3ff047b311cedabecdd745e8ef0cccac2f92e",
    "dispatch_head": "b6b3ff047b311cedabecdd745e8ef0cccac2f92e",
    "path_scope": [
      "docs/04_test_reports/F-18_LOCAL_WSL_PREFLIGHT_REPORT.md",
      "packages/deployment/deploy_approval.py",
      "packages/deployment/promotion_preflight.py",
      "tests/deploy/test_f18_deploy_approval.py",
      "tests/deploy/test_f18_promotion_preflight.py"
    ],
    "worker_lease_id": "worker-lease-f18-local-r1-20260924-001",
    "write_epoch": 1,
    "write_fencing_token": "f18-local-write-fence-epoch-1-abecdd745e8ef0cc"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_LOCAL_PREFLIGHT_EXACT5",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_LOCAL_PREFLIGHT_EXACT5"
}
```

- F-18 overall acceptance and F-19 remain blocked on Production evidence.
- This worker may modify only local product paths and use WSL-server for QA.
