# F-18 WSL R43D isolated runtime retest active

```json anvil-recovery-summary
{
  "event_sequence": 1663,
  "last_event_id": "evt_f18_local_1663_worker_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "main-agent-eoul",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r43d-20260927-001",
    "actor_id": "main-agent-eoul",
    "subject_ref": "F-18/WSL_OPS_R43D_RUNTIME_RETEST",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T04:29:28+09:00",
    "expires_at": "2026-09-27T16:29:28+09:00",
    "lease_epoch": 31,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-31-567514f0801c7087",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-31-567514f0801c7087",
    "baseline_git_commit": "4d93d025191c3fce3b8c6fadc1c9776fcd1cb1c0",
    "dispatch_head": "4d93d025191c3fce3b8c6fadc1c9776fcd1cb1c0",
    "path_scope": []
  },
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "MAIN_VERIFY_F18_OIDC_RUNTIME_R43D",
  "runtime_next_action": "MAIN_VERIFY_F18_OIDC_RUNTIME_R43D"
}
```

- Main-only WSL-server QA; product write scope empty; F-18 accepted=false; Production NOT_EXECUTED.
