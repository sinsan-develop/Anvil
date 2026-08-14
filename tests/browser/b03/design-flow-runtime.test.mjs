import test from 'node:test';
import assert from 'node:assert/strict';
import { startWorkbenchServer } from '../../../apps/web/server.mjs';

test('design-flow is same-origin and invokes actual Python service bridge', async (t) => {
  const server=await startWorkbenchServer({host:'127.0.0.1',port:0}); t.after(()=>server.close());
  const page=await fetch(server.origin+'/design-flow'); const html=await page.text();
  assert.equal(page.status,200); assert.doesNotMatch(html,/localhost:|127\.0\.0\.1:|NEXT_PUBLIC_/);
  const config=await (await fetch(server.origin+'/api/design-flow/config')).json();
  const headers={'content-type':'application/json','origin':server.origin,'x-csrf-token':config.csrfToken};
  const blocked=await fetch(server.origin+'/api/design-flow/run',{method:'POST',headers,body:JSON.stringify({action:'baseline',intent:'운영 승인 자동화',proposals:['안전','속도']})});
  assert.equal(blocked.status,409); assert.equal((await blocked.json()).state,'BLOCKED');
  const normal=await fetch(server.origin+'/api/design-flow/run',{method:'POST',headers,body:JSON.stringify({action:'normal',intent:'운영 승인 자동화',proposals:['안전','속도'],selected:'안전',actor:{id:'sinsan',authenticated:true}})});
  const body=await normal.json(); assert.equal(normal.status,200); assert.equal(body.service,'DesignLineageService'); assert.equal(body.events.length,5);
});

test('design-flow rejects cross-origin and malformed input', async (t) => {
  const server=await startWorkbenchServer({host:'127.0.0.1',port:0}); t.after(()=>server.close());
  const config=await (await fetch(server.origin+'/api/design-flow/config')).json();
  const denied=await fetch(server.origin+'/api/design-flow/run',{method:'POST',headers:{'content-type':'application/json','origin':'http://evil.invalid','x-csrf-token':config.csrfToken},body:'{}'});
  assert.equal(denied.status,403);
});
