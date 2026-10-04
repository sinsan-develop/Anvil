# F-20/U-01 R42 known menu start handoff

```json anvil-recovery-summary
{
  "event_sequence": 2058,
  "last_event_id": "evt_f20_2058_package_resumed",
  "status": "ACTIVE",
  "current_work_package": "F-20",
  "active_agent": "developer-primary-f20-u01-r42",
  "worker_lease": {
    "lease_id": "worker-lease-f20-u01-r42-r42menu1004",
    "actor_id": "developer-primary-f20-u01-r42",
    "subject_ref": "F-20/U01-R42",
    "status": "ACTIVE",
    "issued_at": "2026-10-04T13:37:47+00:00",
    "expires_at": "2026-10-05T13:37:47+00:00",
    "lease_epoch": 57,
    "fencing_token": "f20-u01-r42-execution-fence-epoch-57-r42menu1004",
    "execution_fencing_token": "f20-u01-r42-execution-fence-epoch-57-r42menu1004",
    "baseline_git_commit": "97a917cc9cfb765e9adfd2546715a31a050ddab1",
    "dispatch_head": "97a917cc9cfb765e9adfd2546715a31a050ddab1",
    "path_scope": [
      "packages/api/fastapi_app.py",
      "apps/web/server.mjs",
      "tests/api/test_public_asgi_frontend.py",
      "apps/web/tests/ui-preview-runtime.test.mjs",
      "docs/04_test_reports/F-20_U01_R42_KNOWN_MENU_NAVIGATION_RESULT.md"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f20-u01-r42-r42menu1004",
    "actor_id": "developer-primary-f20-u01-r42",
    "subject_ref": "F-20/U01-R42",
    "status": "ACTIVE",
    "issued_at": "2026-10-04T13:37:47+00:00",
    "expires_at": "2026-10-05T13:37:47+00:00",
    "lease_epoch": 57,
    "fencing_token": "f20-u01-r42-write-fence-epoch-57-r42menu1004",
    "execution_fencing_token": "f20-u01-r42-execution-fence-epoch-57-r42menu1004",
    "baseline_git_commit": "97a917cc9cfb765e9adfd2546715a31a050ddab1",
    "dispatch_head": "97a917cc9cfb765e9adfd2546715a31a050ddab1",
    "path_scope": [
      "packages/api/fastapi_app.py",
      "apps/web/server.mjs",
      "tests/api/test_public_asgi_frontend.py",
      "apps/web/tests/ui-preview-runtime.test.mjs",
      "docs/04_test_reports/F-20_U01_R42_KNOWN_MENU_NAVIGATION_RESULT.md"
    ],
    "worker_lease_id": "worker-lease-f20-u01-r42-r42menu1004",
    "write_epoch": 57,
    "write_fencing_token": "f20-u01-r42-write-fence-epoch-57-r42menu1004"
  },
  "incident_event_id": "evt_f20_1764_defect_recorded",
  "incident_blocking": false,
  "next_safe_action": "F20_U01_R42_KNOWN_MENU_NAVIGATION_IMPLEMENTATION",
  "repository_head": "97a917cc9cfb765e9adfd2546715a31a050ddab1",
  "repository_upstream": "development/codex/f18-wsl-ops",
  "reporting_decision": "AUTO_CONTINUE"
}
```

- Exact menu HTML navigation only; C30 quarantined history retained; F-20 unaccepted; Release DEFER; Production NOT_EXECUTED.
