import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const {buildApp}=await import('../../../apps/server/app.ts');
const {NormalPageCursors}=await import('../../../apps/server/modules/executions/normal-command-pages.ts');
const {executionChallengeRequestBytes}=await import('../../../apps/server/modules/executions/execution-proof.ts');
import {journey} from './normal-request-challenge-fixture.ts';
const {revocationFixture}=await import('./normal-grant-revocation.test.ts');

// SQL의 보호 현재성 결과만 실제 생산/회수 행에서 도출한다. 실제 PostgreSQL guard 실행은 아니다.
test('원 normal START/credential → 다른 OWNER 회수 HTTP → 원영수증 → 기존 challenge 거절',async()=>{
 let revoker:ReturnType<typeof revocationFixture>|undefined,currentDenied=0,osCalls=0;
 const j=await journey({cursors:new NormalPageCursors(randomBytes(32)),sql(sql,args,{f}){
  if(sql.startsWith('SELECT * FROM anvil.normal_exchange_current(')&&revoker?.state.entries.length){
   const g=f.tables.execution_grants![0]!;assert.deepEqual(args.slice(0,1),[g.project_id]);assert.deepEqual(args.slice(3,6),[g.id,g.version,g.content_hash]);
   assert.deepEqual(revoker.state.entries[0].snapshot_json.currentBinding.grantRef,{id:g.id,version:g.version,contentHash:g.content_hash});currentDenied++;return{rows:[]};
  }
  return undefined;
 }});
 const original=structuredClone(j.f.tables.execution_grants![0]!),saved=JSON.stringify({grants:j.f.tables.execution_grants,credentials:j.f.tables.execution_credentials,commands:j.f.tables.execution_commands,outbox:j.f.tables.delivery_outbox});
 revoker=revocationFixture({grant:original,db:j.f.db});const f=revoker;
 const args:any[]=[{},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:j.f.root}];
 args[10]={async observe(){osCalls++;throw Error('OS_SOURCE_MUST_NOT_RUN');}};args[20]={mode:'NORMAL_PROTECTED'};
 const app=(buildApp as any)(...args),headers={host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 const send=(payload=f.request(),extra:Record<string,string>={},suffix='')=>app.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands'+suffix,payload,headers:{...headers,...extra}});
 try{
  const q=f.request(),result=await send(q);assert.equal(result.statusCode,200,result.body);const receipt=result.json();
  assert.equal(receipt.data.status,'NORMAL_GRANT_REVOCATION_STORED');assert.notEqual(f.uid,original.snapshot_json.binding.subject.userId);
  assert.equal(receipt.data.snapshot.currentBinding.grantSubject.userId,original.snapshot_json.binding.subject.userId);assert.equal(receipt.data.snapshot.requestedBy.userId,f.uid);
  assert.equal(receipt.data.snapshot.transport,'NORMAL_PROTECTED');assert.equal(receipt.data.snapshot.state,'NORMAL_REVOCATION_STORED');assert.equal(receipt.status,'APPLIED');
  for(const k of ['revocationEffectiveVerified','credentialRevocationVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed']){assert.equal(receipt.data[k],false);assert.equal(receipt.data.snapshot[k],false);}
  assert.deepEqual((await send(q)).json(),receipt);assert.equal(f.state.entries.length,1);assert.equal(f.state.commands.length,1);assert.equal(f.state.auth.length,1);assert.equal(f.state.audits.length,1);
  assert.equal((await send()).statusCode,409);assert.equal((await send(q,{},'?extra=1')).statusCode,400);assert.equal((await send(q,{authorization:'Bearer av3ex1_'+ 'x'.repeat(43)})).statusCode,403);
  const r={...j.exchangeRequest,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url'),issuedAt:j.store.now().toISOString()};
  const denied=await j.app.inject({method:'POST',url:r.target.path.replace('/credential-exchange','/challenges'),payload:{...r,signature:j.signBytes(executionChallengeRequestBytes('EXECUTION',r))}});
  assert.equal(denied.statusCode,412,denied.body);assert.equal(denied.json().code,'EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED');assert.equal(currentDenied,1);assert.equal(osCalls,0);
  assert.equal(JSON.stringify({grants:j.f.tables.execution_grants,credentials:j.f.tables.execution_credentials,commands:j.f.tables.execution_commands,outbox:j.f.tables.delivery_outbox}),saved);
  for(const kind of ['TAG','LOST']){
   const c=revocationFixture({grant:original,db:j.f.db}),config=[...args];config[2]={...args[2],repository:c.access};config[10]=undefined;
   c.state.badTag=kind==='TAG';c.state.lost=kind==='LOST';const a=(buildApp as any)(...config),packet=c.request();
   const call=()=>a.inject({method:'POST',url:'/api/v1/projects/'+c.pid+'/commands',payload:packet,headers});
   try{const unknown=await call();assert.equal(unknown.statusCode,503,unknown.body);assert.equal(unknown.json().code,'STORAGE_FAILED');assert.equal(unknown.json().retryDisposition,'reconcile-first');assert.equal(c.state.discarded,1);assert.equal(c.state.entries.length,kind==='LOST'?1:0);
    if(kind==='LOST'){const stored=structuredClone(c.state.commands[0].result_ref);c.state.lost=false;const replay=await call();assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),stored);assert.equal(c.state.entries.length,1);}
   }finally{await a.close();}
  }
  const defaultApp=buildApp({},undefined,args[2]);try{const a=await defaultApp.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands',payload:q,headers});assert.equal(a.statusCode,400);}finally{await defaultApp.close();}
 }finally{await app.close();await j.app.close();}
});

test('normal 회수는 정확한 내부 opt-in만 허용하고 잘못된 옵션/합성 혼합을 열지 않는다',()=>{
 const f=revocationFixture(),base:any[]=[{},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:process.cwd()}];
 for(const option of [null,{}, {mode:'SYNTHETIC_ONLY'}, {mode:'NORMAL_PROTECTED',extra:true},Object.defineProperty({},'mode',{enumerable:true,get(){throw Error('getter must not run');}}),new Proxy({mode:'NORMAL_PROTECTED'},{ownKeys(){throw Error('trap must not run');}})]){const args=[...base];args[20]=option;assert.throws(()=>(buildApp as any)(...args),/NORMAL_REVOCATION_CONFIGURATION_INVALID/);}
 const mixed=[...base];mixed[3]={};mixed[20]={mode:'NORMAL_PROTECTED'};assert.throws(()=>(buildApp as any)(...mixed),/NORMAL_REVOCATION_CONFIGURATION_INVALID/);
});

test('exported route 직접 조립도 mode/proxy/accessor를 먼저 거절한다',async()=>{
 const {registerProjectRoutes}=await import('../../../apps/server/modules/projects/routes.ts');const {default:Fastify}=await import('fastify');
 const f=revocationFixture(),access={repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:process.cwd()};
 for(const option of [null,{}, {mode:'SYNTHETIC_ONLY'}, {mode:'NORMAL_PROTECTED',extra:true},Object.defineProperty({},'mode',{enumerable:true,get(){throw Error('getter must not run');}}),new Proxy({mode:'NORMAL_PROTECTED'},{ownKeys(){throw Error('trap must not run');}})]){
  const app=Fastify();try{assert.throws(()=>registerProjectRoutes(app,access,undefined,undefined,undefined,option as any),/NORMAL_REVOCATION_CONFIGURATION_INVALID/);assert.equal(app.hasRoute({method:'POST',url:'/api/v1/projects/:projectId/commands'}),false);}finally{await app.close();}
 }
});
