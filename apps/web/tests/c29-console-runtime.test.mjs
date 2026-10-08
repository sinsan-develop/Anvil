import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {startWorkbenchServer} from '../server.mjs';
import {apiPath} from '../src/api/workbench-client.js';
const h='sha256:'+'a'.repeat(64);
async function clientModule(){const u=new URL('../src/api/c29-agent-console-client.js',import.meta.url);assert.ok(existsSync(u),'C29 client missing');return import(u.href);}
async function runtimeModule(){const u=new URL('../src/app/c29-console-runtime.js',import.meta.url);assert.ok(existsSync(u),'C29 runtime missing');return import(u.href);}
const payload=(menu='team')=>({schema:'agent-console/v1',menu,state:'NORMAL',target_hash:h,baseline_hash:h,session_id:'session',projection_hash:h,data:{tasks:[]},deploy_readiness:'NOT_EVALUATED',external_runtime:'NOT_EXECUTED',automatic_acceptance:false,counts_as_pass:false});

test('BFF unconfigured fails closed rather than fake runtime success',async()=>{
  const server=await startWorkbenchServer({port:0});try{
    const r=await fetch(server.origin+'/api/agent-console/team');assert.equal(r.status,503);assert.equal((await r.json()).state,'OFFLINE');
    const page=await fetch(server.origin+'/agent-console');assert.equal(page.status,200);assert.match(await page.text(),/data-c29-console/);
  }finally{await server.close();}
});

test('browser client uses only relative paths and does not disclose raw server failures',async()=>{
  const m=await clientModule(),seen=[];
  const client=m.createAgentConsoleClient(async(path,options)=>{seen.push({path,options});return new Response(JSON.stringify(payload()),{status:200});});
  await client.read('team');assert.equal(seen[0].path,'/api/agent-console/team');assert.equal(seen[0].options.credentials,'same-origin');
  assert.throws(()=>client.read('https://evil.test'),/MENU_INVALID/);
  const bad=m.createAgentConsoleClient(async()=>new Response(JSON.stringify({message:'FAKE_TEST_SECRET'}),{status:500}));
  await assert.rejects(bad.read('team'),e=>e.message==='CONSOLE_REQUEST_FAILED'&&!e.message.includes('FAKE'));
});

test('agent console fetch validates the path at the network boundary',()=>{
  const source=readFileSync(new URL('../src/api/c29-agent-console-client.js',import.meta.url),'utf8');
  assert.match(source,/fetchImpl\(apiPath\(path\),/);
  for(const unsafe of ['https://external.test/api/agent-console/team','http://127.0.0.1:8301/api/agent-console/team','//internal/api/agent-console/team','/other']){
    assert.throws(()=>apiPath(unsafe),/same-origin/i);
  }
});

test('BFF permits exact loopback routes, binds CSRF and preserves POST intent',async()=>{
  const seen=[];const upstream=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;seen.push([req.method,req.url,body]);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(body?{schema:'agent-console-control/v1',state:'REQUESTED_NOT_APPLIED',allowed:false,applied:false,io_count:0,target_hash:JSON.parse(body).target_hash,request_id:JSON.parse(body).request_id}:payload(req.url.split('/').at(-1))));});
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const server=await startWorkbenchServer({port:0,agentConsoleUpstream:`http://127.0.0.1:${upstream.address().port}`});
  try{
    const r=await fetch(server.origin+'/api/agent-console/team');assert.equal(r.status,200);
    assert.deepEqual(seen[0],['GET','/api/agent-console/team','']);
    const body=JSON.stringify({action:'pause',target_hash:h,request_id:'r'});
    assert.equal((await fetch(server.origin+'/api/agent-console/control',{method:'POST',body})).status,403);
    const config=await(await fetch(server.origin+'/api/agent-console/config')).json();
    const good=await fetch(server.origin+'/api/agent-console/control',{method:'POST',headers:{origin:server.origin,'x-csrf-token':config.csrfToken,'content-type':'application/json'},body});
    assert.equal(good.status,200);assert.equal(seen.length,2);assert.equal(JSON.parse(seen[1][2]).action,'pause');
    assert.equal((await fetch(server.origin+'/api/agent-console/team?token=FAKE')).status,400);
  }finally{await server.close();upstream.closeAllConnections();await new Promise(r=>upstream.close(r));}
});

test('non-loopback or credential-bearing upstream cannot start',async()=>{
  for(const agentConsoleUpstream of ['https://example.test','http://user:fake@127.0.0.1:1234']){
    let server;try{await assert.rejects(async()=>{server=await startWorkbenchServer({port:0,agentConsoleUpstream});},/UPSTREAM_INVALID/);}
    finally{if(server)await server.close();}
  }
});

test('runtime rejects stale completion and maps permission/offline without old data',async()=>{
  const m=await runtimeModule();let resolveTeam;const changes=[];
  const runtime=m.createConsoleRuntime({client:{read:menu=>menu==='team'?new Promise(r=>resolveTeam=r):Promise.resolve(payload(menu))},onChange:v=>changes.push(v)});
  const first=runtime.select('team');await runtime.select('moa');resolveTeam(payload());await first;
  assert.equal(runtime.state().menu,'moa');assert.equal(runtime.state().projection.menu,'moa');
  const denied=m.createConsoleRuntime({client:{read:async()=>{throw Object.assign(Error('safe'),{status:403});}},onChange:()=>{}});
  await denied.select('team');assert.equal(denied.state().condition,'permission');assert.equal(denied.state().projection,null);
});

test('runtime high risk requires explicit reconfirm and preserves denied state',async()=>{
  const m=await runtimeModule(),seen=[];const r=m.createConsoleRuntime({client:{read:async()=>payload(),control:async(...args)=>{seen.push(args);return {state:'HUMAN_APPROVAL_REQUIRED'};}},onChange:()=>{}});
  await r.select('team');r.request('deploy');assert.equal(seen.length,0);assert.equal(r.state().modal,'deploy');
  await r.confirm();assert.equal(seen.length,1);assert.equal(r.state().notice,'HUMAN_APPROVAL_REQUIRED');
});

test('projection raw fields and forged acceptance fail closed before rendering',async()=>{
  const m=await clientModule();
  for(const change of [{automatic_acceptance:true},{data:{raw_transcript:'FAKE_TEST_ONLY'}},{extra:'FAKE_TEST_ONLY'}]){
    const client=m.createAgentConsoleClient(async()=>new Response(JSON.stringify({...payload(),...change})));
    await assert.rejects(client.read('team'),/PROJECTION_INVALID/);
  }
});

test('BFF never relays successful unstructured or raw projection payloads',async()=>{
  const upstream=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({...payload(),data:{raw_transcript:'FAKE_TEST_ONLY'}}));});
  await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const server=await startWorkbenchServer({port:0,agentConsoleUpstream:`http://127.0.0.1:${upstream.address().port}`});
  try{const r=await fetch(server.origin+'/api/agent-console/team');assert.equal(r.status,503);assert.ok(!(await r.text()).includes('FAKE_TEST_ONLY'));}
  finally{await server.close();upstream.closeAllConnections();await new Promise(r=>upstream.close(r));}
});

test('runtime detached views, empty/offline, pending modal and false control success remain honest',async()=>{
  const m=await runtimeModule();let calls=0;
  const r=m.createConsoleRuntime({client:{read:async menu=>({...payload(menu),state:'EMPTY'}),control:async()=>{calls++;return {state:'APPLIED',applied:true};}}});
  await r.select('team');const view=r.state();view.projection.data.tasks.push('mutated');assert.equal(r.state().projection.data.tasks.length,0);assert.equal(r.state().condition,'empty');
  r.request('deploy');await r.select('sns');await r.confirm();assert.equal(calls,0);
  await r.request('pause');assert.equal(r.state().notice,'NOT_APPLIED');
  const offline=m.createConsoleRuntime({client:{read:async()=>{throw Object.assign(Error(),{status:503});}}});await offline.select('team');assert.equal(offline.state().condition,'offline');
});

test('actual local Python domain API through Node BFF remains intent-only', {timeout:20000},async()=>{
  // Synthetic host authentication; real C22-C25 owners, ASGI HTTP and BFF.
  // No production bootstrap, DB, provider or external adapter is imported.
  const code="import socket,uvicorn; from apps.api.tests.test_agent_console_routes import fixture,NOW; m,s,a,*_=fixture(True); app=m.create_agent_console_app(s,resolve_authority=lambda _:a,clock=lambda:NOW); sock=socket.socket(); sock.bind(('127.0.0.1',0)); sock.listen(128); print(sock.getsockname()[1],flush=True); uvicorn.Server(uvicorn.Config(app,log_level='critical',access_log=False)).run(sockets=[sock])";
  const child=spawn(process.env.ANVIL_PYTHON||'python',['-B','-u','-c',code],{cwd:fileURLToPath(new URL('../../..',import.meta.url)),windowsHide:true,stdio:['ignore','pipe','pipe']});
  const exited=once(child,'exit');let server;
  try{
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('LOCAL_API_START_TIMEOUT')),10000);let output='';
      child.stdout.on('data',chunk=>{output+=chunk;if(/^\d+\r?\n/.test(output)){clearTimeout(timer);resolve(Number(output.trim()));}});
      child.once('error',()=>{clearTimeout(timer);reject(Error('LOCAL_API_START_FAILED'));});
      child.once('exit',()=>{clearTimeout(timer);reject(Error('LOCAL_API_EXITED'));});
    });
    server=await startWorkbenchServer({port:0,agentConsoleUpstream:`http://127.0.0.1:${port}`});
    for(const menu of ['team','moa','sns','adapters']){
      const response=await fetch(server.origin+'/api/agent-console/'+menu);assert.equal(response.status,200,menu);
      const value=await response.json();assert.equal(value.menu,menu);assert.equal(value.counts_as_pass,false);assert.equal(value.external_runtime,'NOT_EXECUTED');
    }
    const config=await(await fetch(server.origin+'/api/agent-console/config')).json();
    for(const [action,code]of [['pause',202],['deploy',403]]){
      const r=await fetch(server.origin+'/api/agent-console/control',{method:'POST',headers:{origin:server.origin,'x-csrf-token':config.csrfToken,'content-type':'application/json'},body:JSON.stringify({action,target_hash:h,request_id:'local-'+action})});
      assert.equal(r.status,code);const value=await r.json();if(code===202)assert.equal(value.applied,false);
    }
  }finally{if(server)await server.close();child.kill();await exited;}
});

test('mounted runtime retains C28 shell and renders actual task rows instead of mock roles',async()=>{
  const {mountConsole}=await runtimeModule();
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.listeners={};this.textContent='';}
    append(...nodes){this.children.push(...nodes);}replaceChildren(){this.children=[];}
    setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,v){this.listeners[k]=v;}
    focus(){globalThis.document.activeElement=this;}
  }
  const before=globalThis.document;globalThis.document={createElement:tag=>new Element(tag),activeElement:null};
  try{
    const root=new Element('div');const p=payload();p.data.tasks=[{task_id:'task-real',parent_task_id:'parent-real',role:'REVIEW',status:'PENDING',result_hash:null}];
    const runtime=mountConsole(root,{read:async()=>p,control:async()=>({state:'HUMAN_APPROVAL_REQUIRED'})});await runtime.select('team');
    const nodes=[];function walk(e){nodes.push(e);e.children.forEach(walk);}walk(root);
    assert.ok(nodes.some(n=>n.className==='console-shell'));assert.ok(nodes.some(n=>n.tag==='table'));
    assert.ok(nodes.some(n=>n.textContent==='task-real'));assert.ok(nodes.some(n=>n.textContent==='parent-real'));
    assert.ok(!nodes.some(n=>n.textContent==='MOCKUP DATA'));
  }finally{globalThis.document=before;}
});

for(const action of ['provider','permission'])test('C28 '+action+' action remains reconfirm-only',async()=>{
  const m=await runtimeModule();let calls=0;const r=m.createConsoleRuntime({client:{read:async()=>payload(),control:async()=>{calls++;return {state:'HUMAN_APPROVAL_REQUIRED'};}}});
  await r.select('team');r.request(action);assert.equal(calls,0);assert.equal(r.state().modal,action);await r.confirm();assert.equal(r.state().notice,'HUMAN_APPROVAL_REQUIRED');
});

test('raw traversal cannot escape console route into the generic proxy',async()=>{
  const server=await startWorkbenchServer({port:0});try{
    for(const path of ['/api/agent-console/../auth/session','/api/agent-console/%2e%2e/team']){
      const response=await new Promise((resolve,reject)=>{const req=http.request(server.origin,{path},resolve);req.on('error',reject);req.end();});
      response.resume();assert.equal(response.statusCode,400);
    }
  }finally{await server.close();}
});
