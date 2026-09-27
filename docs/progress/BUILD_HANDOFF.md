# F-18 WSL R45A corrected staging artifact QA active

```json anvil-recovery-summary
{
  "event_sequence": 1674,
  "last_event_id": "evt_f18_local_1674_worker_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "main-agent-eoul",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r45a-20260927-002",
    "actor_id": "main-agent-eoul",
    "subject_ref": "F-18/WSL_OPS_R45A_STAGING_ARTIFACT_PORT_REVISION",
    "status": "ACTIVE",
    "issued_at": "2026-09-27T09:11:59+09:00",
    "expires_at": "2026-09-27T21:11:59+09:00",
    "lease_epoch": 34,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-34-d36de847842804ca",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-34-d36de847842804ca",
    "baseline_git_commit": "bc4ba2f8725bfc3f32f13742d642a828c4393405",
    "dispatch_head": "bc4ba2f8725bfc3f32f13742d642a828c4393405",
    "path_scope": []
  },
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "MAIN_VERIFY_F18_R45A_STAGING_ARTIFACT_PORT_CORRECTED",
  "runtime_next_action": "MAIN_VERIFY_F18_R45A_STAGING_ARTIFACT_PORT_CORRECTED"
}
```

- Main-only WSL-server QA fixed 8444 port; product write scope empty; F-18 accepted=false; Production NOT_EXECUTED.
