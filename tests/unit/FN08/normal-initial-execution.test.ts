import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
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

async function host(transform:(value:any,count:number,signal:AbortSignal)=>any=v=>v,work?:'LINKED'|'LEGACY',prepare:boolean|'UNDEFINED'|'GETTER'=false) {
 const eid=randomUUID();
 const f=await executionStartOriginFixture({normalExecutionId:eid,connectorEnvironment:true,richContext:true,constitutionContext:true,environmentDependencies:true,snapshotRoot:true,originConsumptionStorage:true});
 const workState={latest:null as any,fresh:0,history:0,deny:false};let workBasis:any;
 if(work){
  const original=f.preparation.data,ref=(n:number)=>({id:'a9040104-0000-4000-8000-'+String(n).padStart(12,'0'),version:1,contentHash:'a'.repeat(64)});
  workBasis={kind:'NORMAL_UNDERSTANDING_WORK_BASIS',reviewRef:ref(1),scope:{projectId:f.pid,executionId:randomUUID(),executionGeneration:1},preparationRef:original.ref,
   assignmentRef:original.snapshot.intent.assignmentRef,roleBindingRef:original.snapshot.intent.roleBindingRef,agentSessionRef:f.binding.data.snapshot.sessionRef,contextBundleRef:original.snapshot.intent.contextBundleRef,
   connectionRef:original.snapshot.intent.connectionRef,environmentRef:original.snapshot.intent.environmentRef,responseRef:ref(2),requestRef:ref(3),basisRefs:original.snapshot.basisRefs,latestInstructionRefs:original.snapshot.latestInstructionRefs};
  workState.latest=structuredClone(workBasis.reviewRef);const base=f.db.query;
  f.db.query=(async(sql:string,a:any[]=[])=>{
   if(sql==='SELECT clock_timestamp() AS at,txid_current()::text AS tx'){const r=await base('SELECT clock_timestamp() AS at');return{rows:[{at:r.rows[0].at,tx:String(f.modes.tx)}]};}
   if(sql.includes('fn09_normal_understanding_metadata_current')){
    const selection=JSON.parse(a[3]),now=(await base('SELECT clock_timestamp() AS at')).rows[0].at;
    if(selection.purpose==='WORK_PREPARATION_HISTORY')return{rows:[{projection:{status:'WORK_PREPARATION_HISTORY',basis:workBasis}}]};
    if(selection.purpose==='WORK_START_REPLAY')workState.history++;
    if(selection.purpose==='WORK_START_BASIS'){workState.fresh++;if(workState.deny||canonicalJson(workState.latest)!==canonicalJson(workBasis.reviewRef))throw Object.assign(Error('WORK_START_UNDERSTANDING_CHANGED'),{code:'P0001'});}
    return{rows:[{projection:{status:selection.purpose,basis:workBasis,checkedAt:now.toISOString(),expiresAt:new Date(now.getTime()+20000).toISOString()}}]};
   }
   return base(sql,a);
  }) as typeof f.db.query;
  const command={...f.originCommand(),operation:'prepareExecution',payload:{...original.snapshot.intent,mode:'WORK',...(work==='LINKED'?{understandingReviewRef:workBasis.reviewRef}:{})}};
  f.preparation=await f.run(a=>f.preparations.save(f.db,a,command as any,f.policyRef)) as any;
 }
 const prep=f.preparation.data,raw=prep.snapshot.intent,ref=prep.ref;
 const until=f.actor.authSession.idleExpiresAt,permissionPolicyRef=f.policyRef;
 const {registrationRef}=await import('../../../apps/server/modules/connections/project-registrations.ts');
 const attested={basis:prep.snapshot.basisRefs,source:raw.sourceScopes.map((s:any)=>s.observationRef),capability:[raw.capabilityRef],osFence:[ref],storage:[ref]};
 let observations=0;
  const observation=async(scope:any,stamp:string,signal:AbortSignal)=>{
   assert.ok(signal instanceof AbortSignal);assert.ok(!('query' in scope));const at=new Date(stamp);
   observations++;
   const value={scope,registrationRef:registrationRef(f.registration!.row as any),checkedAt:at.toISOString(),expiresAt:until,writerState:'NONE',
    stageRef:f.stage.data.snapshot.input.stageRef,demand:{attempts:1,calls:1,spoolBytes:1024,cost:null,costStatus:'VERIFIED_NO_CHARGE'},
    understandingReviewRef:work?workBasis.reviewRef:null,checks:{...Object.fromEntries(Object.entries(attested).map(([key,evidenceRefs])=>[key,{state:'VERIFIED_CURRENT',evidenceRefs}])),understanding:work?{state:'VERIFIED_CURRENT',evidenceRefs:[workBasis.reviewRef]}:{state:'NOT_REQUIRED',evidenceRefs:[]}}};
   return transform(value,observations,signal);
  };
  const preparation={creates:0,reads:0,handoffs:0,closes:0,closed:0,captures:0,fallback:0,aborted:0,failRead:false,hangRead:false,failHandoff:false,commits:[]as any[],owners:[]as any[],inputs:[]as any[]};
  const source={observe:async(...args:Parameters<typeof observation>)=>{preparation.fallback++;return observation(...args);},...(prepare===true||prepare==='GETTER'?{preparation:{async create(input:any,signal:AbortSignal){
   preparation.creates++;preparation.inputs.push(input);assert.equal(f.active(),true);assert(!signal.aborted);
   assert.equal(input.commandId,command.commandId);assert.equal(input.scope.requestHash,contentHash(canonicalJson(command)));assert.deepEqual(input.registrationRef,registrationRef(f.registration!.row as any));
   assert(f.trace.some(sql=>sql.includes('FROM anvil.connector_registrations r JOIN')));assert(f.trace.some(sql=>sql.includes('FROM anvil.permission_policies')));
   const owner={async read(scope:any,stamp:string,readSignal:AbortSignal){
    assert.equal(this,owner);assert.deepEqual(scope,input.scope);preparation.reads++;if(preparation.failRead)throw Error('RAM_READ_FAILED');
    if(preparation.hangRead)return new Promise<never>((_resolve,reject)=>readSignal.addEventListener('abort',()=>{preparation.aborted++;reject(Error('RAM_READ_CANCELLED'));},{once:true}));
    return{...await observation(scope,stamp,readSignal),expiresAt:input.expiresAt};
   },async handoff(commit:any){assert.equal(this,owner);assert.equal(f.active(),false);assert(f.trace.includes('COMMIT'));preparation.handoffs++;preparation.commits.push(commit);if(preparation.failHandoff)throw Error('RAM_HANDOFF_UNKNOWN');return owner;},async close(){preparation.closes++;preparation.closed++;}};
   preparation.owners.push(owner);return owner;
  }}}:{})};
  if(prepare==='UNDEFINED')Object.defineProperty(source,'preparation',{value:undefined,writable:true,configurable:true});
  class PreparedCurrent{get preparation(){preparation.captures++;return source.preparation;}observe(...args:Parameters<typeof observation>){return source.observe(...args);}}
  const configured=prepare==='GETTER'?new PreparedCurrent():source;
  const app=buildApp({},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root},undefined,undefined,undefined,undefined,null,undefined,undefined,configured);
 const command={...f.originCommand(),operation:'queueExecutionCommand',approvalRef:null,payload:{operation:'START_SESSION',executionId:eid,executionGeneration:1,preparationRef:ref,
   permissionPolicyRef,budgetPolicyRef:raw.budgetPolicyRef,payload:{contextBundleRef:raw.contextBundleRef,optionsRef:ref}}};
 const post=(payload=command)=>app.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands',payload,headers:{host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',
   cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf}});
  return {f,post,app,command,workBasis,workState,preparation,source:configured,observations:()=>observations};
}

const graphTables=['executions','execution_grants','writer_claims','usage_reservations','execution_commands','delivery_outbox','execution_material_manifests','execution_materials'];

test('optional 준비 own undefined는 미구성이고 class getter port는 한 번만 캡처해 같은 객체를 소비한다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});for(const mode of ['UNDEFINED','GETTER']as const){const h=await host(undefined,undefined,mode);try{
  const response=await h.post();assert.equal(response.statusCode,200,response.body);assert.equal(h.preparation.creates,mode==='GETTER'?1:0);assert.equal(h.preparation.captures,mode==='GETTER'?1:0);assert.equal(h.preparation.handoffs,mode==='GETTER'?1:0);
  const retry=await h.post();assert.equal(retry.statusCode,200,retry.body);assert.equal(h.preparation.captures,mode==='GETTER'?1:0);
 }finally{await h.app.close();}}
 const {NormalInitialExecution}=await import('../../../apps/server/modules/executions/normal-initial-execution.ts');
 for(const preparation of [null,{},false])assert.throws(()=>new NormalInitialExecution({}as any,{}as any,{observe:async()=>null,preparation}as any),{message:'NORMAL_START_PREPARATION_REQUIRED'});
});
test('캡처 뒤 준비 port 교체는 구형 관측 fallback이나 다른 port 재생성으로 전환하지 않는다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});let swap=()=>{};const h=await host((value,count)=>{if(count===1)swap();return value;},undefined,true);try{
  swap=()=>Object.defineProperty(h.source,'preparation',{value:undefined,writable:true,configurable:true});
  const response=await h.post();assert.equal(response.statusCode,503,response.body);assert.equal(h.preparation.creates,1);assert.equal(h.preparation.fallback,0);assert.equal(h.preparation.handoffs,0);
 }finally{await h.app.close();}
});

test('명시 원 시도 준비는 같은 거래 create1/read3 뒤 확정 COMMIT에서만 인계하고 정확 재조회 추가효과0이다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,undefined,true);try{
  const response=await h.post();assert.equal(response.statusCode,200,response.body);const result=response.json(),p=h.preparation;
  assert.equal(p.creates,1);assert(p.reads>=3);assert.equal(p.handoffs,1);assert.equal(p.closes,0);assert.equal(p.fallback,0);
  assert.deepEqual(p.commits[0],{preparation:p.inputs[0],commandRef:result.data.ref,grantRef:result.data.snapshot.grantRef,envelopeHash:h.f.tables.execution_commands![0]!.envelope_hash});
  assert(Date.parse(p.inputs[0].expiresAt)-Date.parse(p.inputs[0].createdAt)<=10000);
  const calls=[p.creates,p.reads,p.handoffs],counts=graphTables.map(name=>h.f.tables[name]!.length);
  const replay=await h.post();assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),result);assert.deepEqual([p.creates,p.reads,p.handoffs],calls);assert.deepEqual(graphTables.map(name=>h.f.tables[name]!.length),counts);
 }finally{await h.app.close();}
});
test('명시 준비의 source/writer 거절·거래 실패/COMMIT불명은 UNKNOWN이며 인계0/같은 port 재생성0이다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});for(const mode of ['READ','HANG','SOURCE','WRITER','INSERT','COMMIT']as const){const h=await host(v=>mode==='SOURCE'?{...v,checks:{...v.checks,source:{state:'UNKNOWN',evidenceRefs:[]}}}:mode==='WRITER'?{...v,writerState:'OWNED'}:v,undefined,true);try{
  if(mode==='READ')h.preparation.failRead=true;
  if(mode==='HANG')h.preparation.hangRead=true;
  h.f.modes.hook=sql=>{if(mode==='INSERT'&&sql.startsWith('INSERT INTO anvil.executions')||mode==='COMMIT'&&sql==='COMMIT')throw Error('RAM_TRANSACTION_FAILED');};
  const response=await h.post();assert.equal(response.statusCode,503,response.body);assert.equal(response.json().code??response.json().error?.code,'NORMAL_START_PREPARATION_OUTCOME_UNKNOWN');assert.equal(h.preparation.creates,1);assert.equal(h.preparation.handoffs,0);assert.equal(h.preparation.fallback,0);assert(h.f.trace.includes('ROLLBACK'));
  assert.equal(h.preparation.closes,mode==='COMMIT'?0:1);assert.equal(h.preparation.closed,mode==='COMMIT'?0:1);
  if(mode==='HANG')assert.equal(h.preparation.aborted,1);
  h.f.modes.hook=null;h.preparation.failRead=false;const retry=await h.post();assert.equal(retry.statusCode,503,retry.body);assert.equal(h.preparation.creates,1);assert.equal(h.preparation.handoffs,0);
 }finally{h.f.modes.hook=null;await h.app.close();}}
});
test('확정 queue 뒤 인계불명은 새 거절 거래 없이 보존하고 원 receipt 재확인도 인계 재시도0이다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,undefined,true);try{
  const before=h.f.trace.length;h.preparation.failHandoff=true;const response=await h.post();assert.equal(response.statusCode,503,response.body);assert.equal(h.preparation.handoffs,1);assert.equal(h.preparation.closes,0);assert.equal(h.f.active(),false);
  assert.equal(h.f.trace.slice(before).filter(sql=>sql==='BEGIN').length,1);assert.equal(h.f.trace.at(-1),'COMMIT');
  Object.defineProperty(h.source,'preparation',{value:undefined,writable:true,configurable:true});
  const trace=h.f.trace.length,counts=graphTables.map(name=>h.f.tables[name]!.length),retry=await h.post();assert.equal(retry.statusCode,200,retry.body);assert.deepEqual(graphTables.map(name=>h.f.tables[name]!.length),counts);assert.equal(h.preparation.creates,1);assert.equal(h.preparation.handoffs,1);assert(!h.f.trace.slice(trace).some(sql=>sql.startsWith('INSERT')));
 }finally{await h.app.close();}
});
test('준비 생성 전 현재 인증·정책/등록·입력 거절은 port/관측/인계0이다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});for(const mode of ['AUTH','CONTROL','REGISTRATION','INPUT']as const){const h=await host(undefined,undefined,true);try{
  if(mode==='AUTH')h.f.state.member=false;if(mode==='CONTROL')h.f.state.current=false;if(mode==='REGISTRATION')h.f.registration!.row.revoked_at=new Date();
  const command=mode==='INPUT'?{...h.command,payload:{...h.command.payload,operation:'SEND_INSTRUCTION'}}:h.command,response=await h.post(command);
  assert([401,403,409,412,422].includes(response.statusCode),response.body);assert.equal(h.preparation.creates,0);assert.equal(h.preparation.reads,0);assert.equal(h.preparation.handoffs,0);
 }finally{await h.app.close();}}
});
test('명시 준비 port는 기존 linked WORK에 생성 권위나 대체 관측을 더하지 않는다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,'LINKED',true);try{
  const response=await h.post();assert.equal(response.statusCode,200,response.body);assert.equal(h.preparation.creates,0);assert.equal(h.preparation.handoffs,0);assert(h.preparation.fallback>=3);
 }finally{await h.app.close();}
});

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


test('linked WORK는 준비의 exact 선택을 DB 현재성에 결박하고 같은 명령 재확인은 새 head/observer를 소비하지 않는다',async()=>{
 const h=await host(v=>v,'LINKED');try{
  const r=await h.post();assert.equal(r.statusCode,200,r.body);assert.ok(h.workState.fresh>=3);
  const fact=h.f.tables.execution_grants![0]!.snapshot_json.binding;assert.deepEqual(fact.understandingReviewRef,h.workBasis.reviewRef);assert.notEqual(fact.executionId,h.workBasis.scope.executionId);
  const fresh=h.workState.fresh,observed=h.observations(),counts=graphTables.map(n=>h.f.tables[n]!.length);
  h.workState.latest={...h.workBasis.reviewRef,version:2};h.workState.deny=true;h.f.modes.sourceHead=2;
  const retry=await h.post();assert.equal(retry.statusCode,200,retry.body);assert.deepEqual(retry.json(),r.json());assert.equal(h.workState.fresh,fresh);assert.equal(h.observations(),observed);assert.equal(h.workState.history,1);assert.deepEqual(graphTables.map(n=>h.f.tables[n]!.length),counts);
 }finally{await h.app.close();}
});
for(const change of ['LEGACY','SELECTOR','OLD_EXECUTION','STALE','LATE','AUTHORITY'])test('linked WORK 신규 START 거절과 원 거래 rollback '+change,async()=>{
 const h=await host((v,n)=>{if(change==='SELECTOR')v.understandingReviewRef={...v.understandingReviewRef,version:2};return v;},change==='LEGACY'?'LEGACY':'LINKED');
 const receipts=h.f.receipts.size,audits=h.f.audits.size;
 if(change==='OLD_EXECUTION')h.command.payload.executionId=h.workBasis.scope.executionId;
 if(change==='STALE')h.workState.latest={...h.workBasis.reviewRef,version:2};
 if(change==='AUTHORITY')h.workState.deny=true;
 if(change==='LATE')h.f.modes.hook=sql=>{if(sql.startsWith('INSERT INTO anvil.execution_materials('))h.workState.deny=true;};
 try{const r=await h.post();assert.equal(r.statusCode,412,r.body);for(const n of graphTables)assert.equal(h.f.tables[n]!.length,0,n);assert.equal(h.f.receipts.size,receipts);assert.equal(h.f.audits.size,audits);}finally{await h.app.close();}
});
