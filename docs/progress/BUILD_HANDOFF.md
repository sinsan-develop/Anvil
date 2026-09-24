# Local/WSL operational-scope revision; Production NOT_EXECUTED

```json anvil-recovery-summary
{
  "event_sequence": 1512,
  "last_event_id": "evt_f18_local_1512_handoff_recorded",
  "status": "PAUSED",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": null,
  "worker_lease": null,
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "PREPARE_F18_WSL_OPS_WORK_INSTRUCTION",
  "runtime_next_action": "PREPARE_F18_WSL_OPS_WORK_INSTRUCTION"
}
```

- F-18 remains partial; F-19 remains blocked pending revised F-18 WSL acceptance.
- Production/ysna-server NOT_EXECUTED; ReleaseDecision DEFER.
