# F-15 common Web shell and local stack start

```json anvil-recovery-summary
{
  "event_sequence": 1468,
  "last_event_id": "evt_f15_1468_write_lease_issued",
  "status": "ACTIVE",
  "current_phase": "F",
  "current_work_package": "F-15",
  "active_agent": "developer-primary-f15-r1",
  "worker_lease": {
    "lease_id": "worker-lease-f15-r1-20260924-001",
    "actor_id": "developer-primary-f15-r1",
    "subject_ref": "F-15",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T10:18:00+09:00",
    "expires_at": "2026-09-24T22:18:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f15-r1-execution-fence-epoch-1-41e7e06cb0f4e76a",
    "execution_fencing_token": "f15-r1-execution-fence-epoch-1-41e7e06cb0f4e76a",
    "baseline_git_commit": "41e7e06cb0f4e76a0d8be31cab24120a4b530420",
    "dispatch_head": "41e7e06cb0f4e76a0d8be31cab24120a4b530420",
    "path_scope": [
      "apps/api/anvil_api/asgi.py",
      "apps/web/console/index.html",
      "apps/web/package.json",
      "apps/web/src/console/App.tsx",
      "apps/web/src/console/app-shell.css",
      "apps/web/src/console/main.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "apps/web/tsconfig.json",
      "apps/web/vite.config.ts",
      "apps/worker/anvil_worker/main.py",
      "deploy/local/Dockerfile.runtime",
      "deploy/local/nginx.conf",
      "docker-compose.local.yml",
      "docs/04_test_reports/F-15_COMPLETION_REPORT.md",
      "package-lock.json",
      "package.json",
      "packages/api/fastapi_app.py",
      "tests/api/test_f15_web_security.py",
      "tests/integration/test_f15_local_stack.py"
    ]
  },
  "write_lease": {
    "lease_id": "write-lease-f15-r1-20260924-001",
    "actor_id": "developer-primary-f15-r1",
    "subject_ref": "F-15",
    "status": "ACTIVE",
    "issued_at": "2026-09-24T10:18:00+09:00",
    "expires_at": "2026-09-24T22:18:00+09:00",
    "lease_epoch": 1,
    "fencing_token": "f15-r1-write-fence-epoch-1-d8be31cab24120a4",
    "execution_fencing_token": "f15-r1-execution-fence-epoch-1-41e7e06cb0f4e76a",
    "baseline_git_commit": "41e7e06cb0f4e76a0d8be31cab24120a4b530420",
    "dispatch_head": "41e7e06cb0f4e76a0d8be31cab24120a4b530420",
    "path_scope": [
      "apps/api/anvil_api/asgi.py",
      "apps/web/console/index.html",
      "apps/web/package.json",
      "apps/web/src/console/App.tsx",
      "apps/web/src/console/app-shell.css",
      "apps/web/src/console/main.tsx",
      "apps/web/tests/f15-console.test.mjs",
      "apps/web/tsconfig.json",
      "apps/web/vite.config.ts",
      "apps/worker/anvil_worker/main.py",
      "deploy/local/Dockerfile.runtime",
      "deploy/local/nginx.conf",
      "docker-compose.local.yml",
      "docs/04_test_reports/F-15_COMPLETION_REPORT.md",
      "package-lock.json",
      "package.json",
      "packages/api/fastapi_app.py",
      "tests/api/test_f15_web_security.py",
      "tests/integration/test_f15_local_stack.py"
    ],
    "worker_lease_id": "worker-lease-f15-r1-20260924-001",
    "write_epoch": 1,
    "write_fencing_token": "f15-r1-write-fence-epoch-1-d8be31cab24120a4"
  },
  "next_work_package": {
    "package_id": "F-16",
    "status": "BLOCKED_PENDING_F15_ACCEPTANCE"
  },
  "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F15_EXACT19",
  "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F15_EXACT19"
}
```
