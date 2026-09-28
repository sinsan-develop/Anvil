import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as consoleApp from '../src/console/App.tsx';

const {App, classifyReadiness} = consoleApp;

test('operational shell keeps canonical menu order with only the current Dashboard active', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/'}));
  for (const label of ['Dashboard', 'Workbench', 'Projects', 'Runs', 'Reviews', 'Quality',
                       'Knowledge', 'Agents &amp; Automation', 'Environments', 'Operations', 'Settings']) {
    assert.ok(html.includes(label), label);
  }
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /NOT CONNECTED/);
  assert.doesNotMatch(html, /localhost:8301|anvil-db:5432|READY · Database/);
});

test('unknown route is a safe route boundary without fake business content', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/not-a-menu'}));
  assert.match(html, /페이지를 사용할 수 없습니다/);
  assert.doesNotMatch(html, /Internal Server Error|stack trace/);
});

test('readiness accepts only confirmed operations or OIDC migration heads', () => {
  assert.equal(classifyReadiness({status:'ready', migration_head:'0019_oidc_sessions'}), 'READY');
  assert.equal(classifyReadiness({status:'ready', migration_head:'0016_operations_recovery'}), 'READY');
  assert.equal(classifyReadiness({status:'ready', migration_head:'0013_task_bootstrap_authority'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness({status:'ready', migration_head:'unknown'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness({status:'not_ready', migration_head:'0019_oidc_sessions'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness({status:'not_ready', reason:'database_unavailable'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness(null), 'NOT CONNECTED');
});

test('Database card shows the server-confirmed head without claiming a different migration', () => {
  const card = consoleApp.DatabaseHealthCard;
  assert.equal(typeof card, 'function');
  const oidc = renderToStaticMarkup(React.createElement(card, {
    value: {status:'ready', migration_head:'0019_oidc_sessions'},
  }));
  assert.match(oidc, /Database.*READY.*Migration 0019_oidc_sessions/s);
  assert.doesNotMatch(oidc, /0016_operations_recovery/);

  const operations = renderToStaticMarkup(React.createElement(card, {
    value: {status:'ready', migration_head:'0016_operations_recovery'},
  }));
  assert.match(operations, /Database.*READY.*Migration 0016_operations_recovery/s);

  const unknown = renderToStaticMarkup(React.createElement(card, {
    value: {status:'ready', migration_head:'unknown'},
  }));
  assert.match(unknown, /Database.*NOT CONNECTED.*연결된 상태 정보가 없습니다/s);
  assert.doesNotMatch(unknown, /Migration /);
});
