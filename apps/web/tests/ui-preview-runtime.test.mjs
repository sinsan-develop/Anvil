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

test('production mode serves Dashboard, keeps Provider Workbench separate, and hides fixtures by default', async () => {
  const runtime = await startWorkbenchServer({host: '127.0.0.1', port: 0});
  try {
    const page = await fetch(`${runtime.origin}/`);
    const production=await page.text();
    assert.match(production, /data-production-dashboard/);
    assert.doesNotMatch(production, /FIXTURE BROWSER RUNTIME/);
    const provider=await fetch(`${runtime.origin}/provider-workbench.html`);
    assert.equal(provider.status,200);
    assert.match(await provider.text(), /data-production-workbench/);
    const fixture=await fetch(`${runtime.origin}/fixture-workbench`);
    const fixtureHtml=await fetch(`${runtime.origin}/fixture-workbench.html`);
    assert.equal(fixture.status,404);
    assert.equal(fixtureHtml.status,404);
  } finally {
    await runtime.close();
  }

  const flagged = await startWorkbenchServer({host: '127.0.0.1', port: 0, fixtureEnabled: true});
  try {
    const fixture=await fetch(`${flagged.origin}/fixture-workbench`);
    assert.equal(fixture.status,200);
    assert.match(await fixture.text(), /FIXTURE BROWSER RUNTIME/);
  } finally { await flagged.close(); }
});

test('production runtime proxies Provider and SSE reads and never implements Provider writes', async () => {
  const seen=[];
  const upstream=(await import('node:http')).createServer((request,response)=>{seen.push([request.method,request.url,request.headers['last-event-id']]);response.writeHead(request.url.includes('/events')?200:501,{'content-type':request.url.includes('/events')?'text/event-stream':'application/json'});response.end(request.url.includes('/events')?'':'{"error":"not available"}');});
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  process.env.ANVIL_API_UPSTREAM=`http://127.0.0.1:${upstream.address().port}`;
  const {startWorkbenchServer:start}=await import(`../server.mjs?production-proxy=${Date.now()}`);
  const runtime=await start({host:'127.0.0.1',port:0});
  try {
    assert.equal((await fetch(`${runtime.origin}/api/providers`)).status,501);
    assert.equal((await fetch(`${runtime.origin}/api/runs/run-1/events`,{headers:{'Last-Event-ID':'evt-1'}})).status,200);
    assert.deepEqual(seen,[['GET','/api/providers',undefined],['GET','/api/runs/run-1/events','evt-1']]);
  } finally { await runtime.close();upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve));delete process.env.ANVIL_API_UPSTREAM; }
});
