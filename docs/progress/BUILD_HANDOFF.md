# F-18 WSL R45C rollback rehearsal QA active

```json anvil-recovery-summary
{
  "event_sequence": 1680,
  "last_event_id": "evt_f18_local_1680_worker_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "main-agent-eoul",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r45c-20260927-001",
    "actor_id": "main-agent-eoul",
    "subject_ref": "F-18/WSL_OPS_R45C_ROLLBACK_REHEARSAL",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T13:24:25+09:00",
    "expires_at": "2026-09-28T01:24:25+09:00",
    "lease_epoch": 36,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-36-da187871091219e8",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-36-da187871091219e8",
    "baseline_git_commit": "28417a864313a1bff771c9cafaf4096436cfbb24",
    "dispatch_head": "28417a864313a1bff771c9cafaf4096436cfbb24",
    "path_scope": []
  },
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "MAIN_VERIFY_F18_R45C_ROLLBACK_REHEARSAL",
  "runtime_next_action": "MAIN_VERIFY_F18_R45C_ROLLBACK_REHEARSAL"
}
```

- Main-only WSL-server same-artifact QA; product write scope empty; F-18 accepted=false; Production NOT_EXECUTED.
