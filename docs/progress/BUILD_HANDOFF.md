# F-18 WSL R17 role images checkpoint

```json anvil-recovery-summary
{
  "event_sequence": 1568,
  "last_event_id": "evt_f18_local_1568_worker_lease_revoked",
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
  "next_safe_action": "PREPARE_F18_WSL_REMAINING_VERIFICATION",
  "runtime_next_action": "PREPARE_F18_WSL_REMAINING_VERIFICATION"
}
```

- R17 writer revoked after same-SHA three-image WSL QA; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
