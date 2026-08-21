# Anvil Public UI Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `anvil.sinsan.kr`에서 Anvil의 11개 전체 메뉴와 Workbench LLM 소통 위치를 직접 클릭해 확인할 수 있는 읽기 전용 UI 프리뷰를 `anvil-web:3770`으로 지속 배포한다.

**Architecture:** 기존 Fixture Workbench는 기본 모드로 보존하고 `ANVIL_UI_MODE=preview`일 때만 새 UI 프리뷰를 `/`에 제공한다. 프리뷰는 dependency-free HTML/CSS/JavaScript로 구현하고 mutation과 외부 API를 호출하지 않는다. ysna 배포는 승인 Git SHA를 checkout한 `~/deploy/anvil/repo`에서 이미지를 빌드하며, `anvil-web`을 기존 외부 `proxy-network`에 연결해 NPM이 서비스 이름과 포트 `3770`으로 접근하게 한다.

**Tech Stack:** Node.js 22 built-in HTTP/test runner, semantic HTML, CSS, browser JavaScript, Docker Compose, Nginx Proxy Manager, SSH, Git.

## Global Constraints

- 최상위 메뉴는 설계서 순서의 11개이며 1920×1080에서 스크롤 없이 모두 보여야 한다.
- Workbench 탭은 Conversation, Instructions, Progress, Reports, Approvals, History 6개다.
- 기본 본문·폼 12px, 작은 설명 10px, 보조 9px, Sidebar 제목 14px, 화면 제목 16px다.
- 브라우저 코드는 same-origin 상대 경로만 사용하고 내부 API 주소, `localhost`, `127.0.0.1`, Docker hostname을 포함하지 않는다.
- 실제 API·DB·LLM·Agent·Provider·업무 mutation은 구현하지 않고 `NOT CONNECTED` 또는 `UI PREVIEW`로 표시한다.
- 기존 Fixture Workbench의 기본 `/`, `/design-flow`, 테스트 계약을 보존한다.
- `shared-db`, NPM, 기존 컨테이너·volume·network를 restart·recreate·patch하지 않는다.
- 공개 서비스명은 `anvil-web`, 내부 포트는 `3770`, 외부 Docker network는 기존 `proxy-network`다.
- 배포는 승인 full Git SHA와 tag를 사용하고 서버 직접 patch·`scp` source overwrite를 금지한다.

---

### Task 1: UI Preview Read Model

**Files:**
- Create: `apps/web/src/features/ui-preview/ui-preview-model.js`
- Create: `apps/web/tests/ui-preview-model.test.mjs`

**Interfaces:**
- Produces: `MENU_ITEMS`, `WORKBENCH_TABS`, `DEFAULT_MENU_ID`, `getMenuById(id)`, `normalizeMenuId(value)`
- Consumes: no runtime dependencies

- [ ] **Step 1: Write the failing model tests**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MENU_ID,
  MENU_ITEMS,
  WORKBENCH_TABS,
  getMenuById,
  normalizeMenuId,
} from '../src/features/ui-preview/ui-preview-model.js';

test('exposes all canonical menus in order', () => {
  assert.deepEqual(MENU_ITEMS.map(item => item.id), [
    'dashboard','workbench','projects','runs','reviews','quality',
    'knowledge','agents-automation','environments','operations','settings',
  ]);
});

test('exposes all Workbench communication tabs', () => {
  assert.deepEqual(WORKBENCH_TABS.map(item => item.id), [
    'conversation','instructions','progress','reports','approvals','history',
  ]);
});

test('normalizes invalid routes to Dashboard', () => {
  assert.equal(DEFAULT_MENU_ID, 'dashboard');
  assert.equal(normalizeMenuId('missing'), 'dashboard');
  assert.equal(getMenuById('workbench').title, 'Workbench');
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test apps/web/tests/ui-preview-model.test.mjs`

Expected: FAIL because `ui-preview-model.js` does not exist.

- [ ] **Step 3: Implement the immutable read model**

Create frozen menu objects with `id`, `title`, `label`, `icon`, `description`, `status`, `cards`, and `nextAction`. Use the canonical menu and tab orders above. Every unavailable function uses `UI_PREVIEW` or `NOT_CONNECTED`; no entry claims runtime PASS.

- [ ] **Step 4: Run the model test**

Run: `node --test apps/web/tests/ui-preview-model.test.mjs`

Expected: `3/3 PASS`.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/features/ui-preview/ui-preview-model.js apps/web/tests/ui-preview-model.test.mjs
git commit -m "feat(web): add UI preview navigation model"
```

---

### Task 2: Clickable 1920×1080 Application Shell

**Files:**
- Create: `apps/web/ui-preview.html`
- Create: `apps/web/src/app/ui-preview.js`
- Create: `apps/web/src/styles/ui-preview.css`
- Create: `apps/web/tests/ui-preview-shell.test.mjs`

**Interfaces:**
- Consumes: `MENU_ITEMS`, `WORKBENCH_TABS`, `normalizeMenuId`
- Produces: sidebar navigation, menu content surface, Workbench tabs, global Eoul drawer

- [ ] **Step 1: Write the failing shell contract test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('preview shell exposes navigation and Eoul surfaces', async () => {
  const html = await readFile(new URL('ui-preview.html', root), 'utf8');
  assert.match(html, /data-preview-shell/);
  assert.match(html, /aria-label="Anvil 전체 메뉴"/);
  assert.match(html, /id="eoul-drawer"/);
  assert.match(html, /UI PREVIEW/);
});

test('browser code contains no internal endpoint', async () => {
  const source = await readFile(new URL('src/app/ui-preview.js', root), 'utf8');
  assert.doesNotMatch(source, /localhost|127\.0\.0\.1|anvil-api|shared-db|http:\/\//i);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test apps/web/tests/ui-preview-shell.test.mjs`

Expected: FAIL because the preview files do not exist.

- [ ] **Step 3: Build the semantic shell**

`ui-preview.html` contains a 224px sidebar, top header, main content region, status strip, dialog-compatible drawer, tooltip-only help controls, and a no-script warning. Load only `/src/styles/ui-preview.css` and `/src/app/ui-preview.js`.

`ui-preview.js` must:

```javascript
function selectMenu(menuId) {
  const id = normalizeMenuId(menuId);
  history.replaceState(null, '', `#${id}`);
  renderSidebar(id);
  renderMenu(getMenuById(id));
}

function openWorkbench(tabId = 'conversation') {
  selectMenu('workbench');
  renderWorkbenchTab(tabId);
}
```

Add keyboard selection, `aria-current="page"`, Escape drawer close, invalid-fragment fallback, and a non-mutating unavailable-feature popover.

- [ ] **Step 4: Apply the screen standard**

CSS must use the documented font sizes, fit all 11 menus at 1080px height, retain visible focus, avoid horizontal scrolling at 1920px, and collapse to a compact sidebar below 1280px without hiding menu access.

- [ ] **Step 5: Run shell and existing web tests**

```powershell
node --test apps/web/tests/ui-preview-shell.test.mjs
node --test apps/web/tests/workbench.test.mjs
```

Expected: preview tests PASS and existing Workbench tests remain PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/ui-preview.html apps/web/src/app/ui-preview.js apps/web/src/styles/ui-preview.css apps/web/tests/ui-preview-shell.test.mjs
git commit -m "feat(web): add clickable Anvil UI preview"
```

---

### Task 3: Preview Runtime Mode and Health Endpoint

**Files:**
- Modify: `apps/web/server.mjs`
- Create: `apps/web/tests/ui-preview-runtime.test.mjs`

**Interfaces:**
- Consumes: `ANVIL_UI_MODE`, `ANVIL_HOST`, `ANVIL_PORT`
- Produces: preview `/`, `/healthz`, static assets, 404 and security headers

- [ ] **Step 1: Write the failing runtime tests**

```javascript
test('preview mode serves the preview and health endpoint', async () => {
  const runtime = await startWorkbenchServer({host:'127.0.0.1', port:0, uiMode:'preview'});
  try {
    const page = await fetch(`${runtime.origin}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /data-preview-shell/);
    const health = await fetch(`${runtime.origin}/healthz`);
    assert.deepEqual(await health.json(), {ok:true, service:'anvil-web', mode:'preview'});
  } finally { await runtime.close(); }
});
```

Also assert CSP, nosniff, referrer policy, unknown path 404, and default mode still serves the Fixture Workbench.

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --test apps/web/tests/ui-preview-runtime.test.mjs`

Expected: FAIL because preview mode and `/healthz` are absent.

- [ ] **Step 3: Implement mode selection without changing default behavior**

Extend `startWorkbenchServer` with `uiMode='fixture'`. Map `/` to `ui-preview.html` only for `preview`; keep `index.html` for `fixture`. Serve preview assets from the existing allowlist. When executed directly, read:

```javascript
const host = process.env.ANVIL_HOST || '127.0.0.1';
const port = Number(process.env.ANVIL_PORT || 4173);
const uiMode = process.env.ANVIL_UI_MODE || 'fixture';
```

- [ ] **Step 4: Run runtime and browser-contract tests**

```powershell
node --test apps/web/tests/ui-preview-runtime.test.mjs
node --test apps/web/tests/*.test.mjs
node --test tests/browser/a14/workbench-runtime.test.mjs
```

Expected: all executed Node tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/server.mjs apps/web/tests/ui-preview-runtime.test.mjs
git commit -m "feat(web): serve preview runtime on configured port"
```

---

### Task 4: Hardened ysna Preview Container Contract

**Files:**
- Create: `deploy/ysna/Dockerfile.web-preview`
- Create: `deploy/ysna/compose.public-preview.yml`
- Create: `deploy/ysna/.dockerignore`
- Create: `deploy/ysna/README.public-preview.md`
- Create: `tests/deploy/test_anvil_public_preview_contract.py`

**Interfaces:**
- Consumes: repository source and existing external `proxy-network`
- Produces: Compose service `anvil-web` on internal port 3770

- [ ] **Step 1: Write the failing Compose contract test**

```python
def test_public_preview_uses_existing_proxy_network(compose):
    web = compose['services']['anvil-web']
    assert web['networks'] == ['proxy-network']
    assert web['expose'] == ['3770']
    assert 'ports' not in web
    assert compose['networks']['proxy-network'] == {'external': True}

def test_public_preview_is_hardened(compose):
    web = compose['services']['anvil-web']
    assert web['restart'] == 'unless-stopped'
    assert web['read_only'] is True
    assert web['cap_drop'] == ['ALL']
    assert web['security_opt'] == ['no-new-privileges:true']
```

- [ ] **Step 2: Confirm RED**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_anvil_public_preview_contract -v`

Expected: FAIL because deploy files do not exist.

- [ ] **Step 3: Create the pinned non-root image**

Use a pinned Node 22 slim image, copy only `apps/web`, create an unprivileged `anvil` user, expose 3770, and run `node apps/web/server.mjs` with `ANVIL_UI_MODE=preview`, `ANVIL_HOST=0.0.0.0`, `ANVIL_PORT=3770`.

- [ ] **Step 4: Create the Compose network boundary**

The exact required network structure is:

```yaml
services:
  anvil-web:
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
```

Do not add `shared-db`, `DATABASE_URL`, host port publishing, or an API service.

- [ ] **Step 5: Verify contract and image**

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_anvil_public_preview_contract -v
docker compose -f deploy/ysna/compose.public-preview.yml config
docker build -f deploy/ysna/Dockerfile.web-preview -t anvil-web:preview-test .
```

Expected: contract PASS, Compose config PASS, image build PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- deploy/ysna tests/deploy/test_anvil_public_preview_contract.py
git commit -m "feat(deploy): add ysna public UI preview container"
```

---

### Task 5: Release, Deploy, Verify, and Rollback Scripts

**Files:**
- Create: `deploy/ysna/deploy-public-preview.sh`
- Create: `deploy/ysna/verify-public-preview.sh`
- Create: `deploy/ysna/rollback-public-preview.sh`
- Create: `deploy/ysna/release-manifest.public-preview.json`
- Create: `tests/deploy/test_anvil_public_preview_scripts.py`

**Interfaces:**
- Consumes: `ANVIL_RELEASE_COMMIT` full SHA, `ANVIL_RELEASE_TAG`, `~/deploy/anvil`
- Produces: clean server checkout, running `anvil-web`, redacted evidence, prior SHA rollback

- [ ] **Step 1: Write failing script safety tests**

Assert full 40-character SHA validation, clean checkout requirement, `git fetch --prune origin`, fixed Compose project name, protected container snapshots, no `docker network rm`, no `docker volume rm`, no `shared-db` mutation, and no source `scp`.

- [ ] **Step 2: Confirm RED**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_anvil_public_preview_scripts -v`

Expected: FAIL because scripts and manifest do not exist.

- [ ] **Step 3: Implement Git-only deployment**

`deploy-public-preview.sh` clones the configured origin only when `repo/.git` is absent, fetches, rejects dirty state, verifies the full SHA and tag, records prior SHA and protected container IDs, checks out detached, builds, and starts only Compose project `anvil-public-preview` service `anvil-web`. Evidence goes to `~/deploy/anvil/evidence/public-preview-deploy.json` without secrets.

- [ ] **Step 4: Implement verification and rollback**

Verification checks exact SHA, clean status, container health, membership in `proxy-network`, internal `http://anvil-web:3770/healthz` from NPM's network namespace, security headers, 11 menu markers, and protected-resource equality. Rollback checks out the recorded prior approved SHA and recreates only `anvil-web`.

- [ ] **Step 5: Run script tests**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.deploy.test_anvil_public_preview_scripts -v`

Expected: all script safety tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- deploy/ysna tests/deploy/test_anvil_public_preview_scripts.py
git commit -m "feat(deploy): add public preview release workflow"
```

---

### Task 6: Full Verification, Push, ysna Deployment, and Browser Evidence

**Files:**
- Create: `docs/validation/ANVIL_PUBLIC_UI_PREVIEW_VALIDATION.md`
- Create: `docs/evidence/manifests/ANVIL_PUBLIC_UI_PREVIEW_EVIDENCE_MANIFEST.json`
- Create on server: `~/deploy/anvil/evidence/public-preview-deploy.json`
- Create on server: `~/deploy/anvil/evidence/public-preview-verify.json`

**Interfaces:**
- Consumes: Tasks 1-5 committed branch
- Produces: approved Git SHA/tag, running public preview, browser evidence and rollback record

- [ ] **Step 1: Run all local focused and regression tests**

```powershell
node --test apps/web/tests/*.test.mjs
node --test tests/browser/a14/workbench-runtime.test.mjs
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/deploy -p 'test_*.py'
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py'
git diff --check
```

Record each suite's actual count and exit code separately.

- [ ] **Step 2: Verify the container locally**

Build and start the Compose project on an isolated test network, request `/`, all static assets, `/healthz`, invalid route, and security headers, then remove only the test project.

- [ ] **Step 3: Verify at 1920×1080**

Use the actual browser to click all 11 sidebar menus, all 6 Workbench tabs, the global Eoul drawer, and one unavailable mutation action. Confirm title/fragment/selected state, no console error, and no request to an internal hostname or absolute API URL.

- [ ] **Step 4: Create evidence, final commit, and tag**

Create a manifest containing changed paths, file hashes, test outputs, image digest, rollback command, and `shared-db` protected status. Commit it, push the branch, integrate through the approved project path, and create annotated tag `anvil-ui-preview-20260814.1` on the exact release commit.

- [ ] **Step 5: Capture ysna preflight**

Read hostname, disk, Docker version, running container IDs/status, `proxy-network` membership, `shared-db` ID/status, existing 3770 listener, and `~/deploy/anvil` state. Do not print secrets.

- [ ] **Step 6: Deploy the approved full SHA**

On `ysna-server`, run the committed deployment script with the exact release SHA and tag. Confirm `anvil-web` is `Up`, attached to `proxy-network`, listening on 3770 internally, and reachable by service name from the NPM network.

- [ ] **Step 7: Verify `https://anvil.sinsan.kr`**

Use the browser at 1920×1080 and repeat the 11-menu, 6-tab, Eoul drawer, HTTPS, console, Network, and security-header checks against the public domain. Save screenshots and event evidence.

- [ ] **Step 8: Confirm protected resources and report exact scope**

Verify `shared-db`, NPM, other containers, volumes, and networks match preflight. Report UI preview and deployment PASS only for executed checks; keep API, DB application access, LLM, Agent, Provider, and business functions as `NOT_EXECUTED`.
