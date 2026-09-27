# F-18 WSL R45A staging artifact QA active

```json anvil-recovery-summary
{
  "event_sequence": 1671,
  "last_event_id": "evt_f18_local_1671_worker_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "main-agent-eoul",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r45a-20260927-001",
    "actor_id": "main-agent-eoul",
    "subject_ref": "F-18/WSL_OPS_R45A_STAGING_ARTIFACT",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T09:03:36+09:00",
    "expires_at": "2026-09-27T21:03:36+09:00",
    "lease_epoch": 33,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-33-dfdbdcb95be53ff1",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-33-dfdbdcb95be53ff1",
    "baseline_git_commit": "312e62b93d3d1e8370f975b8b93dd3d98a8808c5",
    "dispatch_head": "312e62b93d3d1e8370f975b8b93dd3d98a8808c5",
    "path_scope": []
  },
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "MAIN_VERIFY_F18_R45A_STAGING_ARTIFACT",
  "runtime_next_action": "MAIN_VERIFY_F18_R45A_STAGING_ARTIFACT"
}
```

- Main-only WSL-server staging QA; product write scope empty; F-18 accepted=false; Production NOT_EXECUTED.
