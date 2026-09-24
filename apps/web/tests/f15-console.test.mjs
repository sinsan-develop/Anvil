import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {App, classifyReadiness} from '../src/console/App.tsx';

test('operational shell keeps canonical menu order but only Dashboard active', () => {
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

test('readiness requires the F-14 head and cannot promote absent source', () => {
  assert.equal(classifyReadiness({status:'ready', migration_head:'0016_operations_recovery'}), 'READY');
  assert.equal(classifyReadiness({status:'ready', migration_head:'0013_task_bootstrap_authority'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness({status:'not_ready', reason:'database_unavailable'}), 'NOT CONNECTED');
  assert.equal(classifyReadiness(null), 'NOT CONNECTED');
});
