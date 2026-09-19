import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {startWorkbenchServer} from '../server.mjs';

const cookie='anvil_session='+'a'.repeat(64)+'; HttpOnly; Max-Age=3600; Path=/; SameSite=strict';
async function fixture(run,options={}) {
  const seen=[];
  const upstream=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    seen.push({method:req.method,path:req.url,body,origin:req.headers.origin});
    if(options.respond)return options.respond(req,res,body);
    if(req.method==='GET'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<form method="post"><input name="account"><button>QA login</button></form>');}
    else if(body!=='account=qa-reader'){res.writeHead(403);res.end('RAW_PRIVATE_UPSTREAM_ERROR');}
    else {res.writeHead(303,{'set-cookie':cookie,location:'/agent-console'});res.end('RAW_PRIVATE_UPSTREAM_SUCCESS');}
  });
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const upstreamOrigin=`http://127.0.0.1:${upstream.address().port}`;
  const server=await startWorkbenchServer({port:0,uiMode:'fixture',fixtureEnabled:true,qaLoginUpstream:upstreamOrigin,...options.server});
  try{await run(server,seen,upstreamOrigin);}finally{await server.close();upstream.closeAllConnections();await new Promise(r=>upstream.close(r));}
}
function submit(server,body='account=qa-reader',headers={}){
  return fetch(server.origin+'/auth/c30r3-qa',{method:'POST',redirect:'manual',body,
    headers:{origin:server.origin,'content-type':'application/x-www-form-urlencoded',...headers}});
}

test('explicit fixture upstream relays login form and exact 303 HttpOnly cookie without response secrets',async()=>{
  await fixture(async(server,seen,upstream)=>{
    const page=await fetch(server.origin+'/auth/c30r3-qa');assert.equal(page.status,200);assert.match(await page.text(),/<form/);
    const response=await submit(server);assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/agent-console');
    assert.equal(response.headers.get('set-cookie'),cookie);assert.equal(await response.text(),'');
    assert.deepEqual(seen[1],{method:'POST',path:'/auth/c30r3-qa',body:'account=qa-reader',origin:server.origin});
    const shell=await fetch(server.origin+'/agent-console');const html=await shell.text();assert.ok(!html.includes(upstream));
    assert.match(shell.headers.get('content-security-policy'),/connect-src 'self'/);
  });
});

for(const config of [{uiMode:'production'},{fixtureEnabled:false},{uiMode:'preview'}])
test('QA route is absent outside explicit fixture mode '+JSON.stringify(config),async()=>{
  await fixture(async(server,seen)=>{assert.equal((await submit(server)).status,404);assert.equal((await fetch(server.origin+'/auth/c30r3-qa')).status,404);assert.equal(seen.length,0);},{server:config});
});

test('fixture without explicit QA upstream remains fail closed',async()=>{
  const server=await startWorkbenchServer({port:0,uiMode:'fixture',fixtureEnabled:true});
  try{assert.equal((await submit(server)).status,404);}finally{await server.close();}
});

test('foreign origin malformed input role spoof and query never mint QA cookie',async()=>{
  await fixture(async(server,seen)=>{
    for(const [body,headers] of [['account=qa-reader',{origin:'http://foreign.invalid'}],['account=qa-reader',{origin:''}],['account=admin',{}],['account=qa-reader&role=admin',{}]]){
      const r=await submit(server,body,headers);assert.equal(r.status,403);assert.equal(r.headers.get('set-cookie'),null);assert.ok(!(await r.text()).includes('RAW_PRIVATE'));
    }
    const query=await fetch(server.origin+'/auth/c30r3-qa?upstream=http://foreign.invalid');assert.equal(query.status,400);
    assert.ok(seen.every(x=>x.origin===server.origin));
    assert.equal((await fetch(server.origin+'/api/agent-console/control',{method:'POST',body:'{}'})).status,403);
    assert.equal((await fetch(server.origin+'/api/agent-console/team')).status,503);
  });
});

for(const bad of ['https://127.0.0.1:1','http://foreign.invalid:1','http://user:fake@127.0.0.1:1','http://127.0.0.1:1/path'])
test('QA upstream rejects nonlocal or nonorigin configuration '+bad,async()=>{
  let server;try{await assert.rejects(async()=>{server=await startWorkbenchServer({port:0,uiMode:'fixture',fixtureEnabled:true,qaLoginUpstream:bad});},/UPSTREAM_INVALID/);}
  finally{if(server)await server.close();}
});

for(const headers of [ {location:'http://internal.invalid/private','set-cookie':cookie},
  {location:'/agent-console','set-cookie':'anvil_session=fake; Path=/'},
  {location:'/agent-console','set-cookie':cookie.replace('HttpOnly','Domain=internal.invalid')}])
test('invalid upstream redirect or cookie is not exposed '+JSON.stringify(headers),async()=>{
  await fixture(async server=>{const r=await submit(server);assert.equal(r.status,503);assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('location'),null);assert.ok(!(await r.text()).includes('RAW_PRIVATE'));},
    {respond:(req,res)=>{res.writeHead(303,headers);res.end('RAW_PRIVATE');}});
});

test('upstream denial preserves denied authority without disclosing internal body',async()=>{
  await fixture(async server=>{const r=await submit(server);assert.equal(r.status,403);assert.equal(r.headers.get('set-cookie'),null);assert.ok(!(await r.text()).includes('RAW_PRIVATE'));},
    {respond:(req,res)=>{res.writeHead(403);res.end('RAW_PRIVATE');}});
});

test('QA form keeps same-origin navigation Origin instead of a no-referrer null Origin',async()=>{
  await fixture(async server=>{
    const form=await fetch(server.origin+'/auth/c30r3-qa');
    assert.equal(form.headers.get('referrer-policy'),'same-origin');
    const normal=await fetch(server.origin+'/agent-console');
    assert.equal(normal.headers.get('referrer-policy'),'no-referrer');
  });
});

for(const body of ['<p>http://internal.invalid/private</p>','<p>anvil_session=FAKE_TEST_ONLY</p>','x'.repeat(32769)])
test('QA form does not expose internal URL token or unbounded body '+body.length,async()=>{
  await fixture(async server=>{const r=await fetch(server.origin+'/auth/c30r3-qa');assert.equal(r.status,503);assert.ok(!(await r.text()).includes('FAKE_TEST_ONLY'));},
    {respond:(req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(body);}});
});
