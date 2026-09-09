import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {
  DASHBOARD_HEALTH,
  DASHBOARD_OPERATIONS,
  DASHBOARD_OPERATION_DEFINITIONS,
  MENU_ITEMS,
  READY_PATH,
  createDashboardState,
  reduceDashboard,
} from '../src/features/app-shell/app-shell-model.js';

const root = new URL('../', import.meta.url);

test('dashboard shell exposes the canonical menu order and Provider secondary route', () => {
  assert.deepEqual(MENU_ITEMS.map(({id}) => id), [
    'dashboard', 'workbench', 'projects', 'runs', 'reviews', 'quality',
    'knowledge', 'agents-automation', 'environments', 'operations', 'settings',
  ]);
  assert.equal(MENU_ITEMS.at(-1).secondaryHref, '/provider-workbench.html');
  assert.equal(READY_PATH, '/health/ready');
});

test('dashboard state is honest until a same-origin readiness result arrives', () => {
  const initial = createDashboardState();
  assert.deepEqual(DASHBOARD_HEALTH, [
    'Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store',
  ]);
  assert.ok(initial.health.every(({status, reason}) => status === 'UNAVAILABLE' && reason));
  assert.deepEqual(DASHBOARD_OPERATIONS, [
    '실행 중', '승인 대기', 'BLOCKED', '필수 Gate 미통과', '예상 비용 초과', 'baseline 충돌',
  ]);
  assert.deepEqual(DASHBOARD_OPERATION_DEFINITIONS.map(({key, label}) => [key, label]), [
    ['running', '실행 중'], ['approvalWaiting', '승인 대기'], ['blocked', 'BLOCKED'],
    ['requiredGateFailed', '필수 Gate 미통과'], ['budgetExceeded', '예상 비용 초과'], ['baselineConflict', 'baseline 충돌'],
  ]);
  assert.deepEqual(Object.keys(initial.operations), [
    'running', 'approvalWaiting', 'blocked', 'requiredGateFailed', 'budgetExceeded', 'baselineConflict',
  ]);
  assert.equal(initial.operations.running.status, 'UNAVAILABLE');
  assert.equal(initial.operations.failedRuns, undefined);
  assert.equal(initial.nextActions.status, 'UNAVAILABLE');
  assert.equal(initial.criticalAlerts.status, 'UNAVAILABLE');
  for (const card of initial.health) {
    assert.equal(card.icon, '○');
    assert.equal(card.lastChecked, 'UNAVAILABLE');
    assert.equal(card.errorCount, 'UNAVAILABLE');
    assert.equal(card.detailLink.status, 'UNAVAILABLE');
  }

  const ready = reduceDashboard(initial, {
    type: 'READINESS_RECEIVED',
    payload: {status: 'ready', migration_head: '0013_task_bootstrap_authority'},
  });
  assert.equal(ready.health[0].status, 'READY');
  assert.equal(ready.health[0].detail, 'Migration 0013_task_bootstrap_authority');
  assert.ok(ready.health.slice(1).every(({status}) => status === 'UNAVAILABLE'));
});

test('dashboard HTML and CSS preserve accessible menu control and narrow viewport contract', async () => {
  const [html, css] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/styles/app-shell.css', root), 'utf8'),
  ]);
  assert.match(html, /data-production-dashboard/);
  assert.match(html, /id="dashboard-health"/);
  assert.match(html, /id="dashboard-next-actions"/);
  assert.match(html, /id="toggle-sidebar"[^>]*aria-expanded="true"/);
  assert.match(html, /aria-label="사이드바 접기 또는 펼치기"/);
  assert.match(html, /src="\/src\/app\/app-shell\.js"/);
  assert.match(css, /--sidebar-width:\s*224px/);
  assert.match(css, /--sidebar-collapsed-width:\s*56px/);
  assert.match(css, /--header-height:\s*48px/);
  assert.doesNotMatch(css, /body\s*\{[^}]*min-width\s*:/);
  assert.doesNotMatch(css, /overflow-x\s*:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.doesNotMatch(css, /@media\(max-width:760px\)[\s\S]*\.sidebar-toggle\{display:none\}/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.app-menu/);
});
