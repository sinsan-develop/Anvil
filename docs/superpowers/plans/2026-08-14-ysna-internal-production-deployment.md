# Anvil ysna-server Internal Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 Git commit의 Anvil을 `ysna-server:~/deploy/anvil`에 localhost-only로 지속 실행하고, 기존 `shared-db` PostgreSQL 18 안에 격리된 Anvil 전용 DB·role·migration 계보를 구축한다.

**Architecture:** WSL에서 격리 DB와 실제 API/UI를 먼저 검증한 뒤 동일한 full Git SHA만 ysna로 승격한다. ysna에서는 Git checkout, secret runtime state, evidence를 `repo/`, `runtime/`, `evidence/`로 분리한다. Web 컨테이너는 전용 bridge network와 `127.0.0.1` 포트만 사용하고, 일회성 migration 컨테이너만 기존 `proxy-network`를 통해 `shared-db`에 접근한다. 현재 API/Worker entrypoint는 reserved 상태이므로 공개 Production Release로 승격하지 않고 내부 Workbench와 DB migration 기반만 지속 운영한다.

**Tech Stack:** Git, Docker Engine 29.6.1, Docker Compose v5.3.1, Node.js 22 container, Python 3.12 virtualenv, PostgreSQL 18 `shared-db`, SQLAlchemy 2, Alembic 1.x, psycopg 3.

## Global Constraints

- 배포 루트는 `~/deploy/anvil`; checkout은 `~/deploy/anvil/repo`, secret은 `~/deploy/anvil/runtime`, evidence는 `~/deploy/anvil/evidence`에 둔다.
- 기존 `shared-db`, 기존 컨테이너, volume, `proxy-network`, reverse proxy를 restart·recreate·patch하지 않는다.
- 기존 `postgres` DB와 다른 서비스 schema/data를 application query나 migration 대상으로 사용하지 않는다.
- 전용 DB는 `anvil`; roles는 `anvil_owner`(NOLOGIN), `anvil_migrator`(LOGIN), `anvil_app`(LOGIN)으로 고정한다.
- 평문 credential은 Git, 명령 출력, 로그, EvidenceManifest에 남기지 않는다. runtime env 파일 권한은 `0600`이다.
- Web은 `127.0.0.1:4173`만 bind한다. `envil.sinsan.kr`, Nginx Proxy Manager, 공개 DNS는 변경하지 않는다.
- 브라우저 코드는 same-origin 상대 경로만 사용한다.
- 서버 배포는 origin의 승인 commit을 fetch/checkout하며 `scp` source overwrite와 server-local patch를 금지한다.
- WSL 검증 commit과 ysna 배포 commit은 동일한 full 40-character SHA여야 한다.
- DB/API/UI/browser/배포 증거는 실행한 범위만 PASS로 기록한다.
- 현재 B-04 dirty projection은 별도 exact commit으로 먼저 마감하고, active write lease가 없는 상태에서만 배포 파일을 구현한다.

---

### Task 1: Human Override와 B-04 경계 재결박

**Files:**
- Create: `docs/approvals/APPROVAL-20260814-YSNA-INTERNAL-DEPLOY-001.md`
- Modify: `docs/work_orders/B-04_WORK_INSTRUCTION.md`
- Modify: `docs/work_orders/B-04_INVOCATION_PROMPT.md`
- Modify: `docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json`
- Modify: `docs/progress/build-progress.json`
- Modify: `docs/progress/progress-events.json`
- Modify: `docs/progress/BUILD_HANDOFF.md`
- Test: `tests/tooling/test_project_progress.py`
- Test: `tests/tooling/test_g07_baseline.py`
- Test: `tests/tooling/test_phase_g_gate.py`
- Test: `tests/tooling/test_a13_repository_scan.py`

**Interfaces:**
- Consumes: owner direction `ysna-server`, `~/deploy/anvil`, `shared-db`, localhost-only persistent deployment.
- Produces: authenticated approval binding, revised B-04 start manifest, clean `B-04 ACTIVE` lease state, explicit server mutation allowlist.

- [ ] **Step 1: Write the approval-binding failure test**

```python
def test_b04_start_binds_ysna_internal_deploy_approval(self):
    progress = load_progress()
    manifest = load_json(ROOT / "docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json")
    assert progress["current_work_package"] == "B-04"
    assert progress["status"] == "ACTIVE"
    assert manifest["runtime_boundary"]["host"] == "ysna-server"
    assert manifest["runtime_boundary"]["deploy_root"] == "~/deploy/anvil"
    assert manifest["runtime_boundary"]["database_container"] == "shared-db"
    assert manifest["runtime_boundary"]["public_exposure"] == "DENIED_PENDING_SEPARATE_APPROVAL"
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_project_progress -v`

Expected: FAIL because the approved ysna runtime binding is absent.

- [ ] **Step 3: Add the approval and re-hash the exact B-04 projection**

The approval must bind the design spec SHA-256, owner direction, `ysna-server`, `~/deploy/anvil`, `shared-db`, dedicated DB/roles, localhost-only listener, prohibited existing-resource mutations, rollback boundary, and no public Release claim. Recalculate WI, Invocation, progress, event, digest, manifest, and successor hashes without changing product files.

- [ ] **Step 4: Run the canonical projection suites**

Run:

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_project_progress tests.tooling.test_g07_baseline tests.tooling.test_phase_g_gate tests.tooling.test_a13_repository_scan
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py'
```

Expected: focused suite PASS and tooling `282/282 PASS`.

- [ ] **Step 5: Commit the exact projection**

```powershell
git add -- docs/approvals/APPROVAL-20260814-YSNA-INTERNAL-DEPLOY-001.md docs/work_orders/B-04_WORK_INSTRUCTION.md docs/work_orders/B-04_INVOCATION_PROMPT.md docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json docs/progress/build-progress.json docs/progress/progress-events.json docs/progress/BUILD_HANDOFF.md docs/progress/progress-handoff-detached-digest-b04-start.json scripts/check_project_progress.py scripts/check_g07_baseline.py scripts/check_phase_g_gate.py scripts/check_a13_repository_scan.py tests/tooling/test_project_progress.py tests/tooling/test_g07_baseline.py tests/tooling/test_phase_g_gate.py tests/tooling/test_a13_repository_scan.py
git diff --cached --check
git commit -m "chore(b04): bind ysna internal deployment runtime"
git push origin main
```

Verify a fresh default clone before any server mutation.

---

### Task 2: Deployment Contract and Hardened Container Image

**Files:**
- Create: `deploy/ysna/Dockerfile.web`
- Create: `deploy/ysna/compose.internal.yml`
- Create: `deploy/ysna/.dockerignore`
- Create: `deploy/ysna/README.md`
- Create: `tests/deploy/test_ysna_deployment_contract.py`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: repository root, `apps/web/server.mjs`, Python package modules, `alembic.ini`, runtime env path.
- Produces: Compose project `anvil-internal`, service `web`, one-shot profile service `migrate`, localhost health endpoint contract.

- [ ] **Step 1: Write the deployment contract tests**

```python
def test_web_is_localhost_only(compose):
    assert compose["services"]["web"]["ports"] == ["127.0.0.1:4173:4173"]
    assert compose["services"]["web"]["read_only"] is True
    assert compose["services"]["web"]["cap_drop"] == ["ALL"]
    assert compose["services"]["web"]["security_opt"] == ["no-new-privileges:true"]

def test_only_migrator_can_reach_shared_db(compose):
    assert "proxy-network" not in compose["services"]["web"]["networks"]
    assert compose["services"]["migrate"]["networks"] == ["proxy-network"]
    assert compose["networks"]["proxy-network"]["external"] is True
```

- [ ] **Step 2: Confirm RED**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_ysna_deployment_contract -v`

Expected: FAIL because deploy artifacts do not exist.

- [ ] **Step 3: Build the non-root web image**

`Dockerfile.web` must use a pinned Node 22 Debian slim image, install Python 3.12 tooling, create `/opt/venv`, install the local Python project, copy only runtime-required source, create an unprivileged `anvil` user, set `ANVIL_PYTHON=/opt/venv/bin/python`, and run `node apps/web/server.mjs`. Do not bake credentials into the image.

- [ ] **Step 4: Define the Compose boundary**

`web` uses only `anvil-internal`, read-only root FS, `/tmp` tmpfs, `cap_drop: [ALL]`, `no-new-privileges`, restart `unless-stopped`, and `127.0.0.1:4173:4173`. `migrate` uses profile `tools`, receives `DATABASE_URL` from the runtime env file, joins only external `proxy-network`, runs `alembic upgrade head`, and is never persistent.

- [ ] **Step 5: Run static and image tests**

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_ysna_deployment_contract -v
docker compose -f deploy/ysna/compose.internal.yml config
docker build -f deploy/ysna/Dockerfile.web -t anvil-internal:test .
```

Expected: contract PASS, Compose config PASS, image build PASS, secret scan finds no credential.

- [ ] **Step 6: Commit**

```powershell
git add deploy/ysna tests/deploy .gitignore
git diff --cached --check
git commit -m "feat(deploy): add hardened ysna internal runtime"
```

---

### Task 3: Idempotent shared-db Bootstrap

**Files:**
- Create: `deploy/ysna/bootstrap-db.sh`
- Create: `deploy/ysna/verify-db-boundary.sh`
- Test: `tests/deploy/test_ysna_db_bootstrap_contract.py`

**Interfaces:**
- Consumes: fixed container `shared-db`, fixed DB/role names, secret variables `ANVIL_MIGRATOR_PASSWORD` and `ANVIL_APP_PASSWORD`.
- Produces: `anvil` DB, `anvil_owner` NOLOGIN role, `anvil_migrator` and `anvil_app` LOGIN roles, least-privilege verification JSON.

- [ ] **Step 1: Write hostile bootstrap tests**

```python
def test_bootstrap_never_restarts_or_recreates_shared_db(script):
    forbidden = ["docker restart", "docker rm", "docker compose down", "DROP DATABASE", "DROP ROLE"]
    assert all(token not in script for token in forbidden)

def test_roles_are_not_privileged(script):
    for privilege in ["SUPERUSER", "CREATEDB", "CREATEROLE", "REPLICATION", "BYPASSRLS"]:
        assert f"NO{privilege}" in script
```

- [ ] **Step 2: Confirm RED**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_ysna_db_bootstrap_contract -v`

Expected: FAIL because scripts do not exist.

- [ ] **Step 3: Implement fixed-identifier, secret-safe bootstrap**

The script must fail unless both passwords match `^[0-9a-f]{64}$`, inspect existing objects first, create only absent roles/DB, set `anvil_owner` NOLOGIN, set all LOGIN roles NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, revoke `PUBLIC` privileges on the new `anvil` DB/schema, and grant migration/app privileges separately. It must never print passwords.

- [ ] **Step 4: Implement read-only boundary verification**

The verifier emits only role flags, DB owner, schema owner, grants, migration revision, and prohibited object-change counts. It must not print connection strings or password hashes.

- [ ] **Step 5: Run tests and commit**

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_ysna_db_bootstrap_contract -v
git add deploy/ysna tests/deploy/test_ysna_db_bootstrap_contract.py
git commit -m "feat(deploy): add isolated shared-db bootstrap"
```

---

### Task 4: Git-only Deploy, Health Verification, and Rollback

**Files:**
- Create: `deploy/ysna/deploy.sh`
- Create: `deploy/ysna/verify.sh`
- Create: `deploy/ysna/rollback.sh`
- Test: `tests/deploy/test_ysna_scripts_contract.py`

**Interfaces:**
- Consumes: `ANVIL_RELEASE_COMMIT` full 40-character SHA, repository URL, runtime env, approved migration revision.
- Produces: clean detached checkout, running `anvil-internal-web`, deployment evidence JSON, recoverable previous commit record.

- [ ] **Step 1: Write script contract tests**

```python
def test_deploy_requires_full_commit(script):
    assert "^[0-9a-f]{40}$" in script
    assert "git fetch --prune origin" in script
    assert "git checkout --detach" in script
    assert "git status --porcelain" in script

def test_rollback_never_drops_data(script):
    assert "DROP DATABASE" not in script
    assert "DROP ROLE" not in script
    assert "docker volume rm" not in script
```

- [ ] **Step 2: Confirm RED**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_ysna_scripts_contract -v`

Expected: FAIL because scripts do not exist.

- [ ] **Step 3: Implement deploy.sh**

The script creates `repo/runtime/evidence`, clones `https://github.com/cyhuh7950/anvil.git` only when absent, fetches origin, rejects a dirty checkout, verifies the requested full SHA exists on origin, records the previous SHA, checks out detached, builds the image, runs the one-shot migration profile, starts only `web`, and writes a redacted evidence JSON. Every command uses `set -euo pipefail` and fixed literal paths.

- [ ] **Step 4: Implement verify.sh**

Verify exact HEAD, clean Git, Compose service state, `127.0.0.1:4173` listener, `/api/design-flow/config`, security headers, Host/Origin/CSRF hostile 403, DB name/owner/roles, Alembic head, no public proxy route, and unchanged protected container IDs.

- [ ] **Step 5: Implement rollback.sh**

Rollback requires a recorded previous full SHA, stops only Compose project `anvil-internal`, checks out the previous approved commit, rebuilds, and restarts. It refuses schema downgrade unless an explicit tested downgrade manifest SHA is supplied; otherwise it uses application rollback only and reports schema compatibility as a blocker.

- [ ] **Step 6: Run tests and commit**

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_ysna_scripts_contract -v
git add deploy/ysna tests/deploy/test_ysna_scripts_contract.py
git commit -m "feat(deploy): add git-only deploy and rollback"
```

---

### Task 5: Local·WSL Full Verification and Release Commit

**Files:**
- Create: `docs/validation/YSNA_INTERNAL_DEPLOYMENT_VALIDATION.md`
- Create: `docs/evidence/manifests/YSNA_INTERNAL_DEPLOYMENT_EVIDENCE_MANIFEST.json`

**Interfaces:**
- Consumes: Tasks 1-4 committed artifacts.
- Produces: local과 WSL에서 검증된 하나의 full commit eligible for internal ysna deployment.

- [ ] **Step 1: Run all focused deployment tests**

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/deploy -p 'test_*.py'
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py'
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/design -p 'test_*.py'
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/domain -p 'test_*.py'
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/persistence -p 'test_*.py'
```

Expected: every suite PASS with counts recorded separately.

- [ ] **Step 2: Run security and artifact checks**

```powershell
git diff --check
git grep -n -I -E '(password|secret|token)\s*[:=]\s*["''][^$]' -- ':!docs/evidence/**'
docker compose -f deploy/ysna/compose.internal.yml config
```

Expected: no hardcoded secret, no forbidden browser internal URL, valid Compose.

- [ ] **Step 3: Verify a fresh clone**

Clone origin/main to a temporary directory with default Git settings and rerun deploy contract, tooling, design, domain, and persistence suites. Confirm the clone remains clean.

- [ ] **Step 4: Verify the same commit in WSL**

Create the clean validation checkout at `/home/daon/deploy/anvil-validation` from origin, check out the full candidate SHA detached, and run `wsl --cd /home/daon/deploy/anvil-validation -- git rev-parse HEAD`. Require the exact full SHA selected for deployment. In WSL run deployment contract, tooling, design, domain, persistence, migration upgrade/downgrade/re-upgrade against isolated PostgreSQL, and actual localhost browser/API security checks. Record WSL environment, DB server version, migration revision, command exits, E-SHOT/E-EVT, and cleanup evidence separately from ysna evidence.

- [ ] **Step 5: Commit and push the release candidate**

```powershell
git add deploy/ysna tests/deploy docs/validation/YSNA_INTERNAL_DEPLOYMENT_VALIDATION.md docs/evidence/manifests/YSNA_INTERNAL_DEPLOYMENT_EVIDENCE_MANIFEST.json .gitignore
git diff --cached --check
git commit -m "feat: prepare ysna internal Anvil deployment"
git push origin main
```

---

### Task 6: ysna-server Persistent Internal Deployment

**Files on server:**
- Create: `~/deploy/anvil/repo`
- Create: `~/deploy/anvil/runtime/anvil.env` with mode `0600`
- Create: `~/deploy/anvil/evidence/preflight.json`
- Create: `~/deploy/anvil/evidence/deployment.json`
- Create: `~/deploy/anvil/evidence/verification.json`

**Interfaces:**
- Consumes: approved release commit, two generated 64-hex DB passwords, existing `shared-db`, existing `proxy-network`.
- Produces: persistent localhost-only Anvil web container, migrated `anvil` DB, redacted deployment evidence.

- [ ] **Step 1: Capture protected-resource preflight**

Run read-only SSH commands to record hostname, disk, Docker version, protected container IDs/images/status, networks, volumes, listeners, `shared-db` image/ID/restart policy, and current DB names. Hash the redacted record.

- [ ] **Step 2: Generate runtime secrets without displaying them**

On the server create `runtime/anvil.env` with `umask 077`, generate both passwords using `openssl rand -hex 32`, write fixed non-secret names and URLs, and verify mode `600`. Do not return file contents to the client.

- [ ] **Step 3: Bootstrap the dedicated DB**

Run `bootstrap-db.sh` against `shared-db`, then `verify-db-boundary.sh`. Abort if any existing Anvil-named object has unexpected owner/privilege or if protected container identity changes.

- [ ] **Step 4: Deploy the approved commit**

Set `ANVIL_RELEASE_COMMIT` to the exact full SHA that passed WSL verification and run `./deploy.sh "$ANVIL_RELEASE_COMMIT"`. Do not use a branch name or short SHA. Confirm migration exits 0 before starting web.

- [ ] **Step 5: Verify actual runtime**

Run `verify.sh`, then perform actual browser NORMAL/ERROR/BLOCKED flows through an SSH tunnel to `127.0.0.1:4173`. Capture E-SHOT/E-EVT and Network evidence showing same-origin requests and no DB/internal hostname exposure.

- [ ] **Step 6: Compare protected resources and clean up transient resources**

Verify protected container IDs/status, existing networks, volumes, ports, and non-Anvil DB objects match preflight. Remove only transient migration containers/build cache created by the deployment. Keep the persistent `anvil-internal-web` service running.

- [ ] **Step 7: Record honest completion state**

Mark internal persistent deployment PASS only if Git, DB boundary, migration, health, security, browser, evidence, and rollback rehearsal all pass. Keep public domain, external traffic, provider, Production Release, and deployment promotion as `NOT_EXECUTED / PENDING_SEPARATE_APPROVAL`.
