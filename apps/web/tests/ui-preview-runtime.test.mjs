import test from 'node:test';
import assert from 'node:assert/strict';

import {startWorkbenchServer} from '../server.mjs';

test('preview mode serves the preview and health endpoint', async () => {
  const runtime = await startWorkbenchServer({host: '127.0.0.1', port: 0, uiMode: 'preview'});
  try {
    const page = await fetch(`${runtime.origin}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /data-preview-shell/);

    const health = await fetch(`${runtime.origin}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {ok: true, service: 'anvil-web', mode: 'preview'});
  } finally {
    await runtime.close();
  }
});

test('preview assets and errors keep strict security headers', async () => {
  const runtime = await startWorkbenchServer({host: '127.0.0.1', port: 0, uiMode: 'preview'});
  try {
    const asset = await fetch(`${runtime.origin}/src/app/ui-preview.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(asset.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(asset.headers.get('referrer-policy'), 'no-referrer');

    const missing = await fetch(`${runtime.origin}/missing`);
    assert.equal(missing.status, 404);
  } finally {
    await runtime.close();
  }
});

test('fixture mode remains the default', async () => {
  const runtime = await startWorkbenchServer({host: '127.0.0.1', port: 0});
  try {
    const page = await fetch(`${runtime.origin}/`);
    assert.match(await page.text(), /Project Workbench/);
  } finally {
    await runtime.close();
  }
});
