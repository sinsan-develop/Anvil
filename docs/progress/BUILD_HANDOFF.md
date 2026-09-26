# F-18 WSL R34 OIDC session-coordinator checkpoint

```json anvil-recovery-summary
{
  "event_sequence": 1603,
  "last_event_id": "evt_f18_local_1603_worker_lease_revoked",
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
  "next_safe_action": "PREPARE_F18_OIDC_SAME_ORIGIN_API_STAGE",
  "runtime_next_action": "PREPARE_F18_OIDC_SAME_ORIGIN_API_STAGE"
}
```

- R34 leases revoked after same-SHA WSL OIDC session-coordinator QA; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
