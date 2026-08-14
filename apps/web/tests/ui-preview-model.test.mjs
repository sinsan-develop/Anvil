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
    'dashboard',
    'workbench',
    'projects',
    'runs',
    'reviews',
    'quality',
    'knowledge',
    'agents-automation',
    'environments',
    'operations',
    'settings',
  ]);
});

test('exposes all Workbench communication tabs', () => {
  assert.deepEqual(WORKBENCH_TABS.map(item => item.id), [
    'conversation',
    'instructions',
    'progress',
    'reports',
    'approvals',
    'history',
  ]);
});

test('normalizes invalid routes to Dashboard', () => {
  assert.equal(DEFAULT_MENU_ID, 'dashboard');
  assert.equal(normalizeMenuId('missing'), 'dashboard');
  assert.equal(getMenuById('workbench').title, 'Workbench');
});
