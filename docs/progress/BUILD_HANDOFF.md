# F-18 WSL R29 network writer start

```json anvil-recovery-summary
{
  "event_sequence": 1576,
  "last_event_id": "evt_f18_local_1576_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-18",
  "active_agent": "developer-primary-f18-wsl-ops-r29-network",
  "worker_lease": {
    "lease_id": "worker-lease-f18-wsl-ops-r29-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r29-network",
    "subject_ref": "F-18/WSL_OPS_R29_NETWORK",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T10:11:25+09:00",
    "expires_at": "2026-09-26T22:11:25+09:00",
    "lease_epoch": 13,
    "fencing_token": "f18-wsl-ops-execution-fence-epoch-13-85f7d946925de91e",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-13-85f7d946925de91e",
    "baseline_git_commit": "6bd7309b8bbd969efc14528fae27f190ec922e2f",
    "dispatch_head": "6bd7309b8bbd969efc14528fae27f190ec922e2f",
    "path_scope": [
      "deploy/wsl/compose.f18.yml",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_network_topology.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f18-wsl-ops-r29-20260926-001",
    "actor_id": "developer-primary-f18-wsl-ops-r29-network",
    "subject_ref": "F-18/WSL_OPS_R29_NETWORK",
    "status": "ACTIVE",
    "issued_at": "2026-09-26T10:11:25+09:00",
    "expires_at": "2026-09-26T22:11:25+09:00",
    "lease_epoch": 13,
    "fencing_token": "f18-wsl-ops-write-fence-epoch-13-85f7d946925de91e",
    "execution_fencing_token": "f18-wsl-ops-execution-fence-epoch-13-85f7d946925de91e",
    "baseline_git_commit": "6bd7309b8bbd969efc14528fae27f190ec922e2f",
    "dispatch_head": "6bd7309b8bbd969efc14528fae27f190ec922e2f",
    "path_scope": [
      "deploy/wsl/compose.f18.yml",
      "docs/04_test_reports/F-18_WSL_OPS_REPORT.md",
      "tests/deploy/test_f18_network_topology.py"
    ],
    "worker_lease_id": "worker-lease-f18-wsl-ops-r29-20260926-001",
    "write_epoch": 13,
    "write_fencing_token": "f18-wsl-ops-write-fence-epoch-13-85f7d946925de91e"
  },
  "next_work_package": {
    "package_id": "F-19",
    "status": "BLOCKED_PENDING_F18_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_IMPLEMENT_F18_NETWORK_EXACT3",
  "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_NETWORK_EXACT3"
}
```

- R29 network exact3 only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.
