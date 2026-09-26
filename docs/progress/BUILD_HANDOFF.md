# F-18 WSL R43B1 synthetic issuer local checkpoint

```json anvil-recovery-summary
{
  "event_sequence": 1653,
  "last_event_id": "evt_f18_local_1653_worker_lease_revoked",
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
  "next_safe_action": "PREPARE_F18_OIDC_FORMAL_RUNTIME_R43B2_STAGE",
  "runtime_next_action": "PREPARE_F18_OIDC_FORMAL_RUNTIME_R43B2_STAGE"
}
```

- R43B1 local-only QA issuer; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
