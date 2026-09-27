# F-18 WSL R45A artifact QA checkpoint

```json anvil-recovery-summary
{
  "event_sequence": 1675,
  "last_event_id": "evt_f18_local_1675_worker_lease_revoked",
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
  "next_safe_action": "PREPARE_F18_R45B_SAME_ARTIFACT_TARGET_QA",
  "runtime_next_action": "PREPARE_F18_R45B_SAME_ARTIFACT_TARGET_QA"
}
```

- R45A artifact/PG15/PG18/OIDC and signed QA preflight passed; resources cleaned; R45B target unverified; F-18 accepted=false; Production NOT_EXECUTED.
