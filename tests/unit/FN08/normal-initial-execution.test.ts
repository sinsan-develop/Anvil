import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { executionStartOriginFixture, installExecutionStartOriginMemoryFS } from '../FN09/execution-start-origin-fixture.ts';

await installExecutionStartOriginMemoryFS();
const { buildApp } = await import('../../../apps/server/app.ts');

test('normal 최초 START는 기존 명령의 보호된 입력을 검사하고 caller 승인·current 입력을 거절한다', async () => {
  const f = await executionStartOriginFixture();
  let calls = 0;
  const source = {observe:async () => {calls++; throw Error('unexpected observation');}};
  const app = buildApp({}, undefined, {repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root},
    undefined, undefined, undefined, undefined, null, undefined, undefined, source);
  try {
    const command = {...f.originCommand(),operation:'queueExecutionCommand',approvalRef:null,payload:{
      operation:'START_SESSION',preparationRef:f.preparation.data.ref,executionId:randomUUID(),executionGeneration:1,
      permissionPolicyRef:f.policyRef,budgetPolicyRef:f.preparation.data.snapshot.intent.budgetPolicyRef,
      payload:{contextBundleRef:f.preparation.data.snapshot.intent.contextBundleRef,optionsRef:f.preparation.data.ref},
      current:{credentialGeneration:1},
    }};
    const r = await app.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands',payload:command,
      headers:{host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf}});
    assert.equal(r.statusCode,422,r.body);
    assert.match(r.body,/NORMAL_START_INPUT_INVALID/);
    assert.equal(calls,0);
  } finally {await app.close();}
});

async function host(transform:(value:any,count:number,signal:AbortSignal)=>any=v=>v) {
 const eid=randomUUID();
 const f=await executionStartOriginFixture({normalExecutionId:eid,connectorEnvironment:true,richContext:true,constitutionContext:true,environmentDependencies:true,snapshotRoot:true,originConsumptionStorage:true});
 const prep=f.preparation.data,raw=prep.snapshot.intent,ref=prep.ref;
 const until=f.actor.authSession.idleExpiresAt,permissionPolicyRef=f.policyRef;
 const {registrationRef}=await import('../../../apps/server/modules/connections/project-registrations.ts');
 const attested={basis:prep.snapshot.basisRefs,source:raw.sourceScopes.map((s:any)=>s.observationRef),capability:[raw.capabilityRef],osFence:[ref],storage:[ref]};
 let observations=0;
 const source={observe:async(scope:any,stamp:string,signal:AbortSignal)=>{
   assert.ok(signal instanceof AbortSignal);assert.ok(!('query' in scope));const at=new Date(stamp);
   observations++;
   const value={scope,registrationRef:registrationRef(f.registration!.row as any),checkedAt:at.toISOString(),expiresAt:until,writerState:'NONE',
    stageRef:f.stage.data.snapshot.input.stageRef,demand:{attempts:1,calls:1,spoolBytes:1024,cost:null,costStatus:'VERIFIED_NO_CHARGE'},
    understandingReviewRef:null,checks:{...Object.fromEntries(Object.entries(attested).map(([key,evidenceRefs])=>[key,{state:'VERIFIED_CURRENT',evidenceRefs}])),understanding:{state:'NOT_REQUIRED',evidenceRefs:[]}}};
   return transform(value,observations,signal);
 }};
 const app=buildApp({},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root},undefined,undefined,undefined,undefined,null,undefined,undefined,source);
 const command={...f.originCommand(),operation:'queueExecutionCommand',approvalRef:null,payload:{operation:'START_SESSION',executionId:eid,executionGeneration:1,preparationRef:ref,
   permissionPolicyRef,budgetPolicyRef:raw.budgetPolicyRef,payload:{contextBundleRef:raw.contextBundleRef,optionsRef:ref}}};
 const post=(payload=command)=>app.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands',payload,headers:{host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',
   cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf}});
 return {f,post,app,command,observations:()=>observations};
}

const graphTables=['executions','execution_grants','writer_claims','usage_reservations','execution_commands','delivery_outbox','execution_material_manifests','execution_materials'];

test('실행 credential 예약 세대는 HUMAN 세대와 독립이며 manifest·자료가 서버의 같은 예약을 가리킨다',async()=>{
 const h=await host();try{
   const r=await h.post();assert.equal(r.statusCode,200,r.body);
   const g=h.f.tables.execution_grants![0]!,f=g.snapshot_json.binding,rows=h.f.tables.execution_credentials??[];
   assert.equal(rows.length,1);
   const row=rows[0]!,s=row.snapshot_json,ref=r.json().data.snapshot.grantRef;
   assert.deepEqual(f.executionCredentialReservation,{id:row.id,generation:1});
   assert.equal(f.subject.credentialGeneration,3);assert.equal(f.agentSession.bindingGeneration,h.f.binding.data.snapshot.generation);
   assert.equal(row.credential_generation,1);assert.equal(s.credentialGeneration,1);assert.equal(s.state,'RESERVED_NO_TOKEN');
   assert.deepEqual(s.grantRef,ref);assert.equal(row.grant_id,ref.id);assert.equal(row.grant_version,ref.version);
   assert.equal(s.scopeDigest,g.snapshot_json.scopeDigest);assert.equal(s.commandId,h.command.commandId);
   assert.equal(s.credentialIssued,false);assert.equal(s.expiresAt,g.snapshot_json.expiresAt);assert.equal('token' in s,false);
   const d=h.f.tables.execution_material_manifests![0]!;
   assert.equal(d.snapshot_json.scope.credentialGeneration,1);assert.equal(d.credential_generation,1);
   assert.ok(h.f.tables.execution_materials!.every(m=>m.credential_generation===row.credential_generation));
   const replay=await h.post();assert.equal(replay.statusCode,200);assert.equal(h.f.tables.execution_credentials!.length,1);
 }finally{await h.app.close();}
});

test('실행 credential 예약 hash 또는 세대 불일치는 최종 보호 조회에서 rollback한다',async()=>{
 const h=await host();let corrupted=false;
 h.f.modes.hook=sql=>{
   if(sql.startsWith('SELECT id,credential_generation,content_hash FROM anvil.execution_credentials')){
     h.f.tables.execution_credentials![0]!.credential_generation=h.f.actor.credentialGeneration;corrupted=true;
   }
 };
 try{const r=await h.post();assert.equal(corrupted,true);assert.equal(r.statusCode,412,r.body);assert.match(r.body,/NORMAL_CREDENTIAL_RESERVATION_MISMATCH/);
   for(const table of [...graphTables,'execution_credentials'])assert.equal(h.f.tables[table]!.length,0,table);
 }finally{await h.app.close();}
});

test('실행 credential 예약 INSERT 실패는 grant·명령·영수증·예약·자료 전체를 rollback한다',async()=>{
 const h=await host();let hit=false;
 const before=[h.f.receipts.size,h.f.audits.size,h.f.commands.size];
 h.f.modes.hook=sql=>{if(sql.startsWith('INSERT INTO anvil.execution_credentials(')){hit=true;throw Error('INJECTED_RESERVATION_FAILURE');}};
 try{
   const r=await h.post();assert.equal(hit,true);assert.notEqual(r.statusCode,200);
   for(const t of [...graphTables,'execution_credentials'])assert.equal(h.f.tables[t]!.length,0,t);
   assert.deepEqual([h.f.receipts.size,h.f.audits.size,h.f.commands.size],before);
   assert.ok(h.f.trace.includes('ROLLBACK'));
 }finally{await h.app.close();}
});

test('기존 POST가 보호 자료·grant·예산·영수증·outbox를 한 번 저장하고 동일 요청을 재조회한다',async()=>{
 const {app,post,f,observations}=await host(v=>{f.advance(1);return v;});
 try {
   const r=await post();assert.equal(r.statusCode,200,r.body);assert.equal(r.json().data.status,'NORMAL_QUEUE_STORED');
   const count=observations();assert.ok(count>=3);
   const again=await post();assert.equal(again.statusCode,200,again.body);assert.deepEqual(again.json(),r.json());
   for(const name of graphTables)assert.equal(f.tables[name]!.length,name==='execution_materials'?2:1,name);
 }finally{await app.close();}
});

for(const change of ['osFence','capability','storage','registration','expiry','basisRef'])test('마지막 자료 저장 중 변경을 rollback한다 '+change,async()=>{
 let changed=false,materials=0;
 const {app,post,f}=await host(v=>{
   if(changed){
     if(change==='registration')v.registrationRef.version++;
     else if(change==='expiry')v.expiresAt=new Date(Date.parse(v.checkedAt)+1).toISOString();
     else if(change==='basisRef')v.checks.basis.evidenceRefs=[v.registrationRef];
     else v.checks[change].state='REVOKED';
   }
   return v;
 });
 const receipts=f.receipts.size, audits=f.audits.size;
 f.modes.hook=(sql:string)=>{if(sql.startsWith('INSERT INTO anvil.execution_materials(')&&++materials===2)changed=true;};
 try {
   const r=await post();assert.equal(changed,true);assert.equal(r.statusCode,412,r.body);assert.equal(r.json().code??r.json().error?.code,'NORMAL_START_CURRENT_REQUIRED');
   for(const name of graphTables)assert.equal(f.tables[name]!.length,0,name);
   assert.equal(f.receipts.size,receipts);assert.equal(f.audits.size,audits);
 }finally{await app.close();}
});

test('관측이 멈추면 DB 손잡이를 노출하지 않고 취소·rollback하며 늦은 실패를 회수한다',async()=>{
 let signal:AbortSignal|undefined,scope:Record<string,unknown>|undefined,late:(()=>void)|undefined;
 const h=await host((v,n,s)=>{
   if(n<3)return v;
   signal=s;scope=v.scope;
   return new Promise((_,reject)=>{late=()=>reject(new Error('late observation'));});
 });
 try {
   const r=await h.post();assert.equal(r.statusCode,503,r.body);assert.match(r.body,/NORMAL_START_OBSERVATION_TIMEOUT/);
   assert.ok(signal?.aborted);assert.ok(scope);assert.equal('query' in scope,false);
   const n=h.f.trace.length;
   assert.throws(()=>Reflect.apply(scope!.query as Function,scope,[]),TypeError);
   late!();await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(h.f.trace.length,n);
   for(const name of graphTables)assert.equal(h.f.tables[name]!.length,0,name);
   assert.ok(h.f.trace.includes('ROLLBACK'));
 }finally{await h.app.close();}
});

test('동일 프로젝트의 동시 POST는 같은 영수증으로 수렴하며 후속 다른 원 명령은 claim을 중복하지 않는다',async()=>{
 const h=await host(),pool=h.f.access.pool;
 // 단일 합성 connection을 임대해 두 HTTP 요청을 겹쳐 접수한다. 실제 PostgreSQL 잠금 경합은 별도 검증이다.
 const original=pool.connect.bind(pool),clients=new WeakMap<object,()=>void>();
 let tail=Promise.resolve(),admissions=0;
 pool.connect=(async()=>{
   admissions++;const prior=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});await prior;
   const client=await original();
   if(!clients.has(client)){const underlying=client.release.bind(client);client.release=(error?:Error|boolean)=>{underlying(error);clients.get(client)?.();};}
   clients.set(client,release);return client;
 }) as typeof pool.connect;
 try{
   const [a,b]=await Promise.all([h.post(),h.post()]);assert.equal(admissions,2);
   assert.equal(a.statusCode,200,a.body);assert.equal(b.statusCode,200,b.body);assert.deepEqual(a.json(),b.json());
   const r=await h.post({...h.command,commandId:randomUUID()});assert.equal(r.statusCode,409,r.body);assert.match(r.body,/EXECUTION_WRITER_UNAVAILABLE/);
   for(const name of graphTables)assert.equal(h.f.tables[name]!.length,name==='execution_materials'?2:1,name);
 }finally{pool.connect=original;await h.app.close();}
});

for(const name of ['basis','capability','source','storage','osFence','understanding'])test('현재 관측 누락 시 실행 0 '+name,async()=>{
 const h=await host(v=>{delete v.checks[name];return v;});
 try{const r=await h.post();assert.equal(r.statusCode,412,r.body);assert.match(r.body,/NORMAL_START_CURRENT_REQUIRED/);
   for(const t of graphTables)assert.equal(h.f.tables[t]!.length,0,t);
 }finally{await h.app.close();}
});
