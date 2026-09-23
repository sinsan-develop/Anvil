# F-13 Operations read model/API start

```json anvil-recovery-summary
{
  "event_sequence": 1450,
  "last_event_id": "evt_f13_1450_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-13",
  "active_agent": "developer-primary-f13-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f13-r1-20260924-001",
    "actor_id": "developer-primary-f13-r1",
    "subject_ref": "F-13",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T07:45:00+09:00",
    "expires_at": "2026-09-24T19:45:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f13-r1-execution-fence-epoch-1-a612fdac2c7eabbb",
    "execution_fencing_token": "f13-r1-execution-fence-epoch-1-a612fdac2c7eabbb",
    "baseline_git_commit": "a612fdac2c7eabbb381e8da9d3111d797460f9bf",
    "dispatch_head": "a612fdac2c7eabbb381e8da9d3111d797460f9bf",
    "path_scope": [
      "docs/04_test_reports/F-13_COMPLETION_REPORT.md",
      "packages/api/operations.py",
      "packages/api/registry.py",
      "packages/api/runtime.py",
      "packages/observability/models.py",
      "packages/observability/projection.py",
      "packages/observability/service.py",
      "tests/api/test_f13_operations_api.py",
      "tests/observability/test_f13_operations.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f13-r1-20260924-001",
    "actor_id": "developer-primary-f13-r1",
    "subject_ref": "F-13",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T07:45:00+09:00",
    "expires_at": "2026-09-24T19:45:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f13-r1-write-fence-epoch-1-381e8da9d3111d79",
    "execution_fencing_token": "f13-r1-execution-fence-epoch-1-a612fdac2c7eabbb",
    "baseline_git_commit": "a612fdac2c7eabbb381e8da9d3111d797460f9bf",
    "dispatch_head": "a612fdac2c7eabbb381e8da9d3111d797460f9bf",
    "path_scope": [
      "docs/04_test_reports/F-13_COMPLETION_REPORT.md",
      "packages/api/operations.py",
      "packages/api/registry.py",
      "packages/api/runtime.py",
      "packages/observability/models.py",
      "packages/observability/projection.py",
      "packages/observability/service.py",
      "tests/api/test_f13_operations_api.py",
      "tests/observability/test_f13_operations.py"
    ],
    "worker_lease_id": "worker-lease-f13-r1-20260924-001",
    "write_epoch": 1,
    "write_fencing_token": "f13-r1-write-fence-epoch-1-381e8da9d3111d79"
  },
  "next_work_package": {
    "package_id": "F-14",
    "status": "BLOCKED_PENDING_F13_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F13_EXACT9",
  "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F13_EXACT9"
}
```
