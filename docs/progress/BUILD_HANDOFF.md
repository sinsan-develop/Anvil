# F-18 WSL R45B same artifact QA active

```json anvil-recovery-summary
{
  "event_sequence": 1677,
  "last_event_id": "evt_f18_local_1677_worker_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "main-agent-eoul",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r45b-20260927-001",
    "actor_id": "main-agent-eoul",
    "subject_ref": "F-18/WSL_OPS_R45B_SAME_ARTIFACT",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T10:02:37+09:00",
    "expires_at": "2026-09-27T22:02:37+09:00",
    "lease_epoch": 35,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-35-c655984e0e434223",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-35-c655984e0e434223",
    "baseline_git_commit": "6563b8312077432755b7d7ae0a7d8e1e96c7a7fe",
    "dispatch_head": "6563b8312077432755b7d7ae0a7d8e1e96c7a7fe",
    "path_scope": []
  },
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "MAIN_VERIFY_F18_R45B_SAME_ARTIFACT",
  "runtime_next_action": "MAIN_VERIFY_F18_R45B_SAME_ARTIFACT"
}
```

- Main-only WSL-server same-artifact QA; product write scope empty; F-18 accepted=false; Production NOT_EXECUTED.
