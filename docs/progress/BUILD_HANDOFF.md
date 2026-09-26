# F-18 WSL R43B2 formal runtime verification active

```json anvil-recovery-summary
{
  "event_sequence": 1655,
  "last_event_id": "evt_f18_local_1655_worker_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "main-agent-eoul",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r43b2-20260927-001",
    "actor_id": "main-agent-eoul",
    "subject_ref": "F-18/WSL_OPS_R43B2_FORMAL_RUNTIME",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T03:28:11+09:00",
    "expires_at": "2026-09-27T15:28:11+09:00",
    "lease_epoch": 29,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-29-c6baa6a75da984ba3",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-29-c6baa6a75da984ba3",
    "baseline_git_commit": "c64d4801ede963d8b9b3f2d4b96336e841c1ba21",
    "dispatch_head": "c64d4801ede963d8b9b3f2d4b96336e841c1ba21",
    "path_scope": []
  },
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "MAIN_VERIFY_F18_OIDC_FORMAL_RUNTIME_R43B2",
  "runtime_next_action": "MAIN_VERIFY_F18_OIDC_FORMAL_RUNTIME_R43B2"
}
```

- Main-only WSL runtime QA; product write scope empty; F-18 accepted=false; Production NOT_EXECUTED.
