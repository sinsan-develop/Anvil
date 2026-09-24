# F-14 PostgreSQL isolated recovery accepted

```json anvil-recovery-summary
{
  "event_sequence": 1464,
  "last_event_id": "evt_f14_1464_main_package_accepted",
  "status": "ACCEPTED",
  "current_phase": "F",
  "current_work_package": "F-14",
  "active_agent": null,
  "worker_lease": null,
  "write_lease": null,
  "next_work_package": {
    "package_id": "F-15",
    "status": "READY_AFTER_F14_MERGE_CLEANUP"
  },
  "next_safe_action": "MERGE_F14_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
  "runtime_next_action": "MERGE_F14_PR_THEN_DELETE_BRANCH_AND_WORKTREE"
}
```
