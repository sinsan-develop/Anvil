# F-18 WSL R43D runtime retest checkpoint

```json anvil-recovery-summary
{
  "event_sequence": 1664,
  "last_event_id": "evt_f18_local_1664_worker_lease_revoked",
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
  "next_safe_action": "AUDIT_F18_REMAINING_ACCEPTANCE_AND_NEGATIVE_GAPS",
  "runtime_next_action": "AUDIT_F18_REMAINING_ACCEPTANCE_AND_NEGATIVE_GAPS"
}
```

- Core runtime passed; negative/UI gaps remain; resources cleaned; F-18 accepted=false; Production NOT_EXECUTED.
