# F-18 WSL R45B artifact QA checkpoint

```json anvil-recovery-summary
{
  "event_sequence": 1678,
  "last_event_id": "evt_f18_local_1678_worker_lease_revoked",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "main-agent-eoul",
  "worker_lease": null,
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "PREPARE_F18_EXACT_ROLLBACK_ARTIFACT_RECOVERY",
  "runtime_next_action": "PREPARE_F18_EXACT_ROLLBACK_ARTIFACT_RECOVERY"
}
```

- R45B staging/target QA capability gate passed and resources cleaned; exact prior rollback artifact and browser UI login unverified; F-18 accepted=false; Production NOT_EXECUTED.
