# F-18 WSL R31 OIDC pending-store checkpoint

```json anvil-recovery-summary
{
  "event_sequence": 1588,
  "last_event_id": "evt_f18_local_1588_worker_lease_revoked",
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
  "next_safe_action": "PREPARE_F18_OIDC_TRUSTED_MAPPING_STAGE",
  "runtime_next_action": "PREPARE_F18_OIDC_TRUSTED_MAPPING_STAGE"
}
```

- R31 leases revoked after same-SHA WSL PG18 OIDC pending-store QA; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
