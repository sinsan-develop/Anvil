import test from 'node:test';
import assert from 'node:assert/strict';
import { startWorkbenchServer } from '../../../apps/web/server.mjs';

async function fixtureServer(t) {
  const instance=await startWorkbenchServer({host:'127.0.0.1',port:0});
  t.after(()=>instance.close());
  return instance;
}

test('serves shell with strict security headers and no internal browser endpoint', async (t) => {
  const server=await fixtureServer(t);
  const response=await fetch(server.origin + '/');
  const html=await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.doesNotMatch(html, /NEXT_PUBLIC_|127\.0\.0\.1:|localhost:\d+|docker/i);
  assert.match(html, /Project Workbench/);
});

test('scan BFF enforces origin, csrf, role and allowlists before server-side A13 scan', async (t) => {
  const server=await fixtureServer(t);
  const endpoint=server.origin + '/api/workbench/scan';
  const body=JSON.stringify({projectId:'anvil-fixture',fixtureId:'FIX-PY-CLEAN',role:'operator'});
  const base={'content-type':'application/json','origin':server.origin};
  assert.equal((await fetch(endpoint,{method:'POST',headers:base,body})).status,403);
  assert.equal((await fetch(endpoint,{method:'POST',headers:{...base,host:'evil.invalid',origin:'http://evil.invalid','x-csrf-token':server.csrfToken},body})).status,403);
  assert.equal((await fetch(endpoint,{method:'POST',headers:{...base,'x-csrf-token':server.csrfToken},body:JSON.stringify({projectId:'nope',fixtureId:'FIX-PY-CLEAN',role:'operator'})})).status,403);
  assert.equal((await fetch(endpoint,{method:'POST',headers:{...base,'x-csrf-token':server.csrfToken},body:JSON.stringify({projectId:'anvil-fixture',fixtureId:'FIX-PY-CLEAN',role:'viewer'})})).status,403);
  const ok=await fetch(endpoint,{method:'POST',headers:{...base,'x-csrf-token':server.csrfToken},body});
  const payload=await ok.json();
  assert.equal(ok.status,200);
  assert.equal(payload.evidence.badge,'FIXTURE');
  assert.equal(payload.evidence.countsAsPass,false);
  assert.equal(payload.scan.status,'SCANNED_READ_ONLY');
});

test('malformed and hostile requests return masked errors without stack, path or secret', async (t) => {
  const server=await fixtureServer(t);
  const response=await fetch(server.origin+'/api/workbench/scan',{method:'POST',headers:{'content-type':'application/json','origin':server.origin,'x-csrf-token':server.csrfToken},body:'{"projectId":"<script>"}'});
  const text=await response.text();
  assert.equal(response.status,403);
  assert.doesNotMatch(text,/stack|sk-proj|packages[\\/]repository|\.git[\\/]/i);
});
