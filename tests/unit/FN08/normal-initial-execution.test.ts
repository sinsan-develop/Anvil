import test,{after,mock} from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as crypto from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import { executionStartOriginFixture, installExecutionStartOriginMemoryFS } from '../FN09/execution-start-origin-fixture.ts';

await installExecutionStartOriginMemoryFS();
// 양성 RAM은 원 ID 발급 전에 그 exact ID의 정책이 존재하는 오라클이다.
// 실제 발급 뒤 정책 변경의 환경/등록 현재성 순환은 별도 음성으로 보존한다.
let originUuid:{executionId:string;calls:number}|undefined;
const fixedRandomUUID=()=>{
 const value=randomUUID();
 return originUuid&&++originUuid.calls===7?originUuid.executionId:value;
};
const cryptoExports={...Object.fromEntries(Object.entries(crypto).filter(([key])=>key!=='default')),randomUUID:fixedRandomUUID};
const cryptoModule=mock.module('node:crypto',{defaultExport:{...cryptoExports},namedExports:cryptoExports});
after(()=>{originUuid=undefined;cryptoModule.restore();});
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

async function host(transform:(value:any,count:number,signal:AbortSignal)=>any=v=>v,work?:'LINKED'|'LEGACY',prepare:boolean|'UNDEFINED'|'GETTER'=false,admission?:'valid'|'missing'|'claim-lost'|'admission-lost'|'queue-cross') {
 let eid=randomUUID();
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
 const until=f.actor.authSession.idleExpiresAt,permissionPolicyRef=structuredClone(f.policyRef);
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
  const admissionState=admission?await normalAdmissionSourceFixture(f,source,admission):null;
  const configured=prepare==='GETTER'?new PreparedCurrent():source;
  const app=buildApp({},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root},undefined,undefined,undefined,undefined,null,undefined,undefined,configured);
 const originRequest={...f.originCommand(),payload:{...f.originCommand().payload,preparationRef:ref}};
 originUuid={executionId:eid,calls:0};
 const saved=await app.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands',payload:originRequest,headers:{host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf}}).finally(()=>{originUuid=undefined;});
 assert.equal(saved.statusCode,200,saved.body);
 const origin=saved.json().data;
 assert.equal(origin.snapshot.execution.executionId,eid);
 const parentState={reads:0,deny:false,fail:false,queries:[]as any[]};
 const base=f.db.query;
 f.db.query=(async(sql:string,a:any[]=[])=>{
  if(sql==='SELECT anvil.fn111_normal_start_parent_current($1,$2,$3,$4,$5::jsonb,$6) AS valid'){
   parentState.reads++;parentState.queries.push(structuredClone(a));assert(f.active());
   if(parentState.fail)throw Error('RAM_PRIVATE_PARENT_SOURCE_UNAVAILABLE');
   assert.deepEqual(a.slice(0,4),[f.actor.authSession.id,f.actor.actorId,f.actor.clientId,f.pid]);assert.equal(a[5],String(f.modes.tx));
   const input=JSON.parse(a[4]);assert.equal(input.purpose,'NORMAL_START_ORIGIN_PARENT_CURRENT');assert(['DIRECT','ADMISSION','QUEUE'].includes(input.mode));
   const q=input.request,p=q.payload,o=f.tables.origins!.find(row=>row.project_id===a[3]&&row.execution_id===p.executionId);
   const previous=(f.tables.normalAdmissions??[]).some(row=>row.snapshot.request.payload.executionId===p.executionId&&row.snapshot.request.payload.executionGeneration===p.executionGeneration&&(input.mode==='DIRECT'||canonicalJson(row.snapshot.request)!==canonicalJson(q)));
   const used=f.tables.executions!.some(row=>row.project_id===a[3]&&row.id===p.executionId&&(()=>{const c=f.commands.get(row.command_id);return !c||c.command_id!==q.commandId||c.actor_id!==a[1]||c.client_id!==a[2]||c.request_hash!==contentHash(canonicalJson(q));})());
   return{rows:[{valid:!parentState.deny&&!!o&&o.execution_generation===p.executionGeneration&&canonicalJson(p.originParent)===canonicalJson({originRef:{id:o.origin_id,version:o.version,contentHash:o.content_hash},reservationRef:{id:o.credential_id,version:1,contentHash:o.reservation_hash}})&&!previous&&!used}]};
  }
  if(sql.startsWith('SELECT c.id AS command_id FROM anvil.executions e JOIN anvil.commands c'))return{rows:f.tables.executions!.filter(r=>r.project_id===a[0]&&r.id===a[1]&&r.generation===a[2]).flatMap(r=>{
   const c=f.commands.get(r.command_id);
   return c&&c.project_id===a[0]&&c.command_id===a[3]&&c.actor_id===a[4]&&c.client_id===a[5]&&c.request_hash===a[6]&&canonicalJson(c.result_ref)===a[7]?[{command_id:c.id}]:[];
  })};
  if(sql==='SELECT anvil.normal_start_material_complete($1,$2) AS complete'){
   const c=f.commands.get(a[1]),x=f.tables.execution_commands!.filter(r=>r.project_id===a[0]&&r.created_command_id===a[1]),g=f.tables.execution_grants!.filter(r=>r.project_id===a[0]&&r.command_id===a[1]);
   const {envelope:_,...snapshot}=x[0]?.snapshot_json??{};
   return{rows:[{complete:!!c&&x.length===1&&g.length===1&&g[0].content_hash===contentHash(canonicalJson(g[0].snapshot_json))&&x[0].content_hash===contentHash(canonicalJson(snapshot))&&canonicalJson(snapshot)===canonicalJson(c.result_ref.data.snapshot)}]};
  }
  return base(sql,a);
 })as typeof f.db.query;
 const command={...f.originCommand(),operation:'queueExecutionCommand',approvalRef:null,payload:{operation:'START_SESSION',executionId:eid,executionGeneration:1,preparationRef:ref,
   permissionPolicyRef,budgetPolicyRef:raw.budgetPolicyRef,payload:{contextBundleRef:raw.contextBundleRef,optionsRef:ref},originParent:{originRef:origin.ref,reservationRef:origin.reservation.ref}}};
 const post=(payload=command)=>app.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands',payload,headers:{host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',
   cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf}});
  return {f,post,app,command,origin,parentState,workBasis,workState,preparation,source:configured,admissionState,observations:()=>observations};
}

const graphTables=['executions','execution_grants','writer_claims','usage_reservations','execution_commands','delivery_outbox','execution_material_manifests','execution_materials'];

test('새 normal START는 원자료 부모 없이 보호 관측·준비·queue를 시작하지 않는다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const h=await host(undefined,undefined,true);
 try{
  const before=graphTables.map(name=>h.f.tables[name]!.length);
  const {originParent:_,...payload}=h.command.payload;
  const response=await h.post({...h.command,payload}as typeof h.command);
  assert.equal(response.statusCode,422,response.body);
  assert.equal(response.json().code??response.json().error?.code,'NORMAL_START_ORIGIN_PARENT_REQUIRED');
  assert.equal(h.observations(),0);
  assert.equal(h.preparation.creates,0);
  assert.equal(h.preparation.handoffs,0);
  assert.deepEqual(graphTables.map(name=>h.f.tables[name]!.length),before);
 }finally{await h.app.close();}
});

test('원 부모의 fullref·예약·고정 실행 ID 교체는 새 관측/객체/저장 없이 거절한다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const h=await host(undefined,undefined,true);
 try{
  const before=graphTables.map(name=>h.f.tables[name]!.length);
  for(const change of ['ORIGIN','RESERVATION','EXECUTION','GENERATION']as const){
   const c=structuredClone(h.command);
   if(change==='ORIGIN')c.payload.originParent.originRef.contentHash='e'.repeat(64);
   if(change==='RESERVATION')c.payload.originParent.reservationRef.id=randomUUID();
   if(change==='EXECUTION')c.payload.executionId=randomUUID();
   if(change==='GENERATION')c.payload.executionGeneration++;
   const r=await h.post(c);assert.equal(r.statusCode,409,r.body);assert.match(r.body,/NORMAL_START_ORIGIN_PARENT_MISMATCH/);
  }
  assert.equal(h.observations(),0);assert.equal(h.preparation.creates,0);assert.equal(h.preparation.handoffs,0);
  assert.deepEqual(graphTables.map(name=>h.f.tables[name]!.length),before);
  assert.equal(h.origin.reservation.snapshot.state,'RESERVED_NOT_ISSUED');
 }finally{await h.app.close();}
});

test('같은 거래 부모 current RPC의 실패는 독립 관측/준비 port 이전에 닫힌다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,undefined,true);
 try{
  h.parentState.deny=true;
  const response=await h.post();assert.equal(response.statusCode,412,response.body);assert.match(response.body,/NORMAL_START_ORIGIN_PARENT_CURRENT_REQUIRED/);
  assert.equal(h.parentState.reads,1);h.parentState.deny=false;h.parentState.fail=true;
  const unavailable=await h.post();assert.equal(unavailable.statusCode,503,unavailable.body);assert.match(unavailable.body,/NORMAL_START_ORIGIN_PARENT_CURRENT_REQUIRED/);assert.doesNotMatch(unavailable.body,/RAM_PRIVATE_PARENT_SOURCE_UNAVAILABLE/);
  assert.equal(h.parentState.reads,2);assert.equal(h.observations(),0);assert.equal(h.preparation.creates,0);assert.equal(h.preparation.handoffs,0);
  for(const name of graphTables)assert.equal(h.f.tables[name]!.length,0,name);
 }finally{await h.app.close();}
});

test('부모의 정착 재조회는 새 source/head 없이 원 저장을 검산하고 손상·모호한 원 execution을 거절한다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host();
 try{
  const saved=await h.post();assert.equal(saved.statusCode,200,saved.body);
  const observed=h.observations(),counts=graphTables.map(name=>h.f.tables[name]!.length);
  h.f.modes.sourceHead=2;
  const retry=await h.post();assert.equal(retry.statusCode,200,retry.body);assert.deepEqual(retry.json(),saved.json());assert.equal(h.observations(),observed);
  const row=h.f.tables.origins![0]!,prior=structuredClone(row);row.reservation_json.state='ISSUED';
  const corrupt=await h.post();assert.equal(corrupt.statusCode,503,corrupt.body);h.f.tables.origins![0]=prior;
  const execution=h.f.tables.executions![0]!;h.f.tables.executions!.push(structuredClone(execution));
  const ambiguous=await h.post();assert.equal(ambiguous.statusCode,503,ambiguous.body);assert.match(ambiguous.body,/NORMAL_START_ORIGIN_PARENT_INTEGRITY_FAILED/);h.f.tables.executions!.pop();
  assert.equal(h.observations(),observed);assert.deepEqual(graphTables.map(name=>h.f.tables[name]!.length),counts);
 }finally{await h.app.close();}
});

test('원 receipt와 다른 내부 execution command를 섞은 재조회는 완결 RPC 전에 거절한다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host();
 try{
  const saved=await h.post();assert.equal(saved.statusCode,200,saved.body);
  h.f.tables.executions![0]!.command_id=h.f.tables.origins![0]!.server_command_id;
  const calls:string[]=[],query=h.f.db.query;
  h.f.db.query=(async(sql:string,args:any[]=[])=>{calls.push(sql);return query(sql,args);})as typeof query;
  const response=await h.post();assert.equal(response.statusCode,503,response.body);assert.match(response.body,/NORMAL_START_ORIGIN_PARENT_INTEGRITY_FAILED/);
  assert(calls.some(sql=>sql.startsWith('SELECT c.id AS command_id FROM anvil.executions e JOIN anvil.commands c')));
  assert(!calls.some(sql=>sql==='SELECT anvil.normal_start_material_complete($1,$2) AS complete'));
 }finally{await h.app.close();}
});

test('원자료 뒤 정책 head 변경의 환경/등록 현재성은 여전히 거절하며 부모를 현재 허가로 승격하지 않는다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,undefined,true);
 try{
  h.f.modes.policyVersion++;
  const environment=await h.f.run(actor=>h.f.environments.read(h.f.db,actor,h.f.pid,h.f.preparation.data.snapshot.intent.environmentRef.id,1));
  assert.notEqual(environment.current.configurationCurrentness,'MATCHED');
  assert(environment.current.issues.some((issue:any)=>issue.code==='POLICY_CHANGED'));
  const response=await h.post();assert.equal(response.statusCode,412,response.body);assert.match(response.body,/EXECUTION_PREPARATION_SOURCE_NOT_CURRENT/);
  assert.equal(h.observations(),0);assert.equal(h.preparation.creates,0);assert.equal(h.preparation.handoffs,0);
  for(const name of graphTables)assert.equal(h.f.tables[name]!.length,0,name);
 }finally{await h.app.close();}
});

test('원 부모/예약의 만료 뒤에는 원 객체 생성·ACK·queue 정착을 시작하지 않는다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,undefined,true);
 try{
  const end=Math.min(Date.parse(h.origin.snapshot.expiresAt),Date.parse(h.origin.reservation.snapshot.expiresAt));
  h.f.advance(end-Date.now()+1);
  const response=await h.post();assert.equal(response.statusCode,409,response.body);assert.match(response.body,/NORMAL_START_ORIGIN_PARENT_MISMATCH/);
  assert.equal(h.observations(),0);assert.equal(h.preparation.creates,0);assert.equal(h.preparation.handoffs,0);
  for(const name of graphTables)assert.equal(h.f.tables[name]!.length,0,name);
 }finally{await h.app.close();}
});

test('준비 생성 직전 거래 재검산 await 중 원 부모 기한이 지나면 port 호출0이다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,undefined,true);
 let transitions=0;
 try{
  const end=Math.min(Date.parse(h.origin.snapshot.expiresAt),Date.parse(h.origin.reservation.snapshot.expiresAt));
  h.f.modes.hook=sql=>{
   // 앞 두 쌍은 부모 판독→current RPC xid, 세 번째는 until 산출→create 직전 checkTx다.
   if(sql==='SELECT txid_current()::text AS transaction_id'&&h.f.trace.at(-2)==='SELECT clock_timestamp() AS at'&&++transitions===3)h.f.advance(end-Date.now()+1);
  };
  const response=await h.post();assert.equal(response.statusCode,412,response.body);assert.equal(transitions,3);
  assert.equal(h.preparation.creates,0);assert.equal(h.preparation.handoffs,0);assert.equal(h.observations(),0);
  for(const name of graphTables)assert.equal(h.f.tables[name]!.length,0,name);
 }finally{h.f.modes.hook=null;await h.app.close();}
});

test('기존 parentless 정상 원 명령은 과거 exact hash/영수증으로만 재조회하고 새 admission/객체를 발급하지 않는다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,undefined,true);
 try{
  const response=await h.post();assert.equal(response.statusCode,200,response.body);
  // 0111 이전의 동일 공개 graph/영수증과 원 7키 명령 해시를 모델링한다. 새 발행에는 이 입력을 허용하지 않는다.
  const {originParent:_,...payload}=h.command.payload,legacy={...h.command,payload};
  const execution=h.f.tables.executions![0]!,command=h.f.commands.get(execution.command_id)!;
  command.request_hash=contentHash(canonicalJson(legacy));
  const before=[h.preparation.creates,h.preparation.reads,h.preparation.handoffs,h.observations()];
  const replay=await h.post(legacy as typeof h.command);assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),response.json());
  assert.deepEqual([h.preparation.creates,h.preparation.reads,h.preparation.handoffs,h.observations()],before);
 }finally{await h.app.close();}
});

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
   const observed=h.observations(),r=await h.post({...h.command,commandId:randomUUID()});assert.equal(r.statusCode,412,r.body);assert.match(r.body,/NORMAL_START_ORIGIN_PARENT_CURRENT_REQUIRED/);assert.equal(h.observations(),observed);
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
 try{const r=await h.post();assert.equal(r.statusCode,change==='OLD_EXECUTION'?409:412,r.body);if(change==='OLD_EXECUTION')assert.match(r.body,/NORMAL_START_ORIGIN_PARENT_MISMATCH/);for(const n of graphTables)assert.equal(h.f.tables[n]!.length,0,n);assert.equal(h.f.receipts.size,receipts);assert.equal(h.f.audits.size,audits);}finally{await h.app.close();}
});


// 공개 정상 DTO나 fabricated custody는 없다. fixture 원 등록의 RAM 키로 STREAM proof/owner를 거친다.
async function normalAdmissionSourceFixture(f:Awaited<ReturnType<typeof executionStartOriginFixture>>,source:object,mode:string){
 const {NativeFirstReceiveService}=await import('../../../apps/server/modules/executions/native-first-receive-service.ts');
 const {NativeFirstReceiveStore}=await import('../../../apps/server/modules/executions/native-first-receive-store.ts');
 const {receiveCanonical,receiveHash}=await import('../../../contracts/runtime/native-first-receive-v1.ts');
 const {registrationRef,connectorRef}=await import('../../../apps/server/modules/connections/project-registrations.ts');
 const rr=(n:number)=>({id:'a7050105-0000-4000-8000-'+String(n).padStart(12,'0'),version:1,contentHash:'a'.repeat(64)});
 const at=new Date().toISOString(),end=new Date(Date.now()+30000).toISOString(),registration=f.registration!,reg=registrationRef(registration.row as any),connector=connectorRef(registration.row as any,1);
 const w:any={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_WINDOW',windowId:rr(1).id,installationId:f.access.installationId,projectId:f.pid,
  registrationRef:reg,connectorRef:connector,hostPublicKeyFingerprint:registration.row.expected_host_fingerprint,profileRef:rr(2),localReceiveAttemptId:rr(3).id,
  human:{userId:f.actor.actorId,clientId:f.actor.clientId,credentialGeneration:f.actor.credentialGeneration,controlGeneration:1},authBindingHash:'',writerHeadRef:rr(4),policyRef:f.policyRef,issuedAt:at,expiresAt:end};
 const {authBindingHash,...basis}=w;w.authBindingHash=receiveHash({authSessionId:f.actor.authSession.id,window:basis});
 const window={ref:{id:w.windowId,version:1,contentHash:receiveHash(w)},snapshot:w};
 const ss={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_SESSION',sessionId:rr(5).id,windowRef:window.ref,credentialId:rr(6).id,issuedAt:at,expiresAt:end};
 const session={ref:{id:ss.sessionId,version:1,contentHash:receiveHash(ss)},snapshot:ss},target={method:'GET',path:'/api/v1/native-first-receive/sessions/'+ss.sessionId+'/stream',queryHash:receiveHash({}),bodyHash:receiveHash({})};
 const cs={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_CHALLENGE',challengeId:rr(7).id,requestId:rr(8).id,phase:'STREAM',windowRef:window.ref,receiveSessionRef:session.ref,
  offerRef:null,armRef:null,deliveryRef:null,authorityRef:null,commandHash:null,target,serverNonce:'A'.repeat(43),issuedAt:at,expiresAt:end};
 const challenge={ref:{id:cs.challengeId,version:1,contentHash:receiveHash(cs)},snapshot:cs};
 const proof={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_PROOF',phase:'STREAM',requestId:cs.requestId,installationId:w.installationId,projectId:f.pid,
  registrationRef:reg,connectorRef:connector,hostPublicKeyFingerprint:w.hostPublicKeyFingerprint,profileRef:w.profileRef,localReceiveAttemptId:w.localReceiveAttemptId,
  windowRef:window.ref,receiveSessionRef:session.ref,offerRef:null,armRef:null,bindingRef:undefined,deliveryRef:null,authorityRef:null,commandHash:null,
  authBindingHash:w.authBindingHash,challengeRef:challenge.ref,serverNonce:cs.serverNonce,target,issuedAt:at,expiresAt:end};
 delete (proof as any).bindingRef;
 const signature=f.signConnectorBytes(Buffer.from(receiveCanonical(proof)));
 let streamOwner:any=null;
 const nativeTrace:string[]=[],state:any={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_STATE',windowRef:window.ref,phase:'STREAMING',receiveSessionRef:session.ref,
  offerRef:null,armRef:null,bindingRef:null,deliveryRef:null,authorityRef:null,ackRef:null,terminalRef:null,current:{checkedAt:at,usable:true,reason:'CURRENT'},observedAt:at,expiresAt:end,executionAuthorized:false};
 const nativeDb={query:async(sql:string,args:any[]=[])=>{
  nativeTrace.push(sql);
  if(sql==='BEGIN'||sql==='COMMIT')return{rows:[],rowCount:0};
  if(sql.includes('transaction_id'))return{rows:[{transaction_id:'1001'}],rowCount:1};
  if(sql.includes('native_receive_phase_entry'))return{rows:[{result:{context:{window,session,challenge,publicKeySpki:registration.connector.public_key_spki,profileOrigin:'https://anvil-synthetic.invalid',transactionId:'1001',phase:'OPENED',revision:2},replay:false}}],rowCount:1};
  assert(sql.includes('native_receive_stream_consume'));const material=JSON.parse(args[1]),proposed=JSON.parse(args[2]);streamOwner=proposed;
  return{rows:[{result:{state,requestHash:material.requestHash,brokerInstanceId:proposed.brokerInstanceId,operationFence:proposed.operationFence}}],rowCount:1};
 },release:()=>{nativeTrace.push('RELEASE');}};
 let next=20;const receiver=new NativeFirstReceiveService({installationId:f.access.installationId,pool:{connect:async()=>nativeDb},authenticated:async()=>{throw Error('NO_PUBLIC_NATIVE_HUMAN_CALL');}}as any,new NativeFirstReceiveStore(()=>rr(next++).id),Date.now,null,undefined,'https://anvil-synthetic.invalid');
 const controller=new AbortController();
 const stream=mode==='missing'?null:await receiver.nativeStream(ss.sessionId,'A'.repeat(43),proof,signature,controller.signal);
 assert.equal(mode==='missing'?nativeTrace.length:nativeTrace.at(-1),mode==='missing'?0:'RELEASE');
 Object.defineProperty(source,'preparationAdmission',{value:{purpose:'NORMAL_START_PREPARATION_ADMISSION_V1',receiver},enumerable:true});
 const out={committed:null as any,claim:null as any,pending:null as any,pendingClaim:null as any,phase:'',admissions:0,claims:0,commits:[]as string[],queueReads:0,reads:[]as any[],used:0,held:0,close:()=>controller.abort()};
 f.tables.normalAdmissions=[];
 const base=f.db.query;
 f.db.query=(async(sql:string,args:any[]=[])=>{
  if(sql==='BEGIN'){out.pending=structuredClone(out.committed);out.pendingClaim=structuredClone(out.claim);out.phase='';return base(sql,args);}
  if(sql==='ROLLBACK'){out.pending=structuredClone(out.committed);out.pendingClaim=structuredClone(out.claim);return base(sql,args);}
  if(sql==='COMMIT'){
   const result=await base(sql,args);out.committed=structuredClone(out.pending);out.claim=structuredClone(out.pendingClaim);out.commits.push(out.phase||'QUEUE');
   if(out.phase==='ADMISSION'&&out.committed&&!f.tables.normalAdmissions!.some(row=>row.ref.id===out.committed.ref.id))f.tables.normalAdmissions!.push(structuredClone(out.committed));
   if(mode==='admission-lost'&&out.phase==='ADMISSION'||mode==='claim-lost'&&out.phase==='CLAIM')throw Error('RAM_COMMIT_REPLY_LOST');return result;
  }
  if(sql==='SELECT txid_current()::text AS transaction_id'){const result=await base(sql,args);return{rows:result.rows.map((r:any)=>({transaction_id:r.transaction_id})),rowCount:result.rows.length};}
  if(sql.includes('native_receive_human_read')){
   out.reads.push({args,tx:String(f.modes.tx)});
   assert.equal(args[0],f.pid);assert.equal(args[1],f.actor.authSession.id);assert.equal(args[4],String(f.modes.tx));
   const now=new Date().toISOString(),value=args[2]==='ACTIVE'?{projectId:f.pid,registrationRef:reg,window:mode==='missing'?null:window,observedAt:now,executionAuthorized:false}:{...state,observedAt:now,current:{checkedAt:now,usable:true,reason:'CURRENT'}};
   return{rows:[{result:{value,transactionId:String(f.modes.tx),expiresAt:end}}],rowCount:1};
  }
  if(sql.includes('fn08_start_preparation_admit')){
   const q=JSON.parse(args[4]),p=JSON.parse(args[5]);assert.equal(args[6],String(f.modes.tx));assert.equal(p.provenance.streamProofHash,receiveHash(proof));
   if(out.pending){assert.deepEqual(out.pending.snapshot.request,q);return{rows:[{result:{...out.pending,disposition:'REPLAY_ONLY'}}],rowCount:1};}
   const snapshot={schemaVersion:1,purpose:'NORMAL_START_PREPARATION_ADMISSION',admissionId:p.ids.admissionId,claimId:p.ids.claimId,request:q,requestHash:contentHash(canonicalJson(q)),scope:p.scope,
    provenance:p.provenance,brokerInstanceId:streamOwner.brokerInstanceId,operationFence:streamOwner.operationFence,transactionId:args[6],recordedAt:new Date().toISOString(),expiresAt:p.expiresAt,executionAuthorized:false,dispatchPerformed:false};
   out.pending={ref:{id:p.ids.admissionId,version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};out.admissions++;out.phase='ADMISSION';
   return{rows:[{result:{...out.pending,disposition:'FIRST_COMMIT'}}],rowCount:1};
  }
  if(sql.includes('fn08_start_preparation_claim')){
   assert.ok(out.committed);assert.deepEqual(JSON.parse(args[5]),out.committed.ref);assert.notEqual(args[7],out.committed.snapshot.transactionId);
   if(out.pendingClaim)return{rows:[{result:{...out.pendingClaim,disposition:'REPLAY_ONLY'}}],rowCount:1};
   const a=out.committed,snapshot={schemaVersion:1,purpose:'NORMAL_START_PREPARATION_CLAIM',claimId:a.snapshot.claimId,admissionRef:a.ref,requestHash:a.snapshot.requestHash,
    windowRef:a.snapshot.scope.windowRef,receiveSessionRef:a.snapshot.scope.receiveSessionRef,streamProofHash:a.snapshot.provenance.streamProofHash,
    transactionId:args[7],claimedAt:new Date().toISOString(),expiresAt:a.snapshot.expiresAt,executionAuthorized:false,dispatchPerformed:false};
   out.pendingClaim={ref:{id:snapshot.claimId,version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};out.claims++;out.phase='CLAIM';
   return{rows:[{result:{...out.pendingClaim,disposition:'FIRST_COMMIT'}}],rowCount:1};
  }
  if(sql.includes('fn08_start_preparation_queue')){
   out.queueReads++;assert.ok(out.claim);assert.deepEqual(JSON.parse(args[5]),out.committed.ref);assert.deepEqual(JSON.parse(args[6]),out.claim.ref);
   assert.notEqual(args[7],out.committed.snapshot.transactionId);assert.notEqual(args[7],out.claim.snapshot.transactionId);
   return{rows:[{result:{admissionRef:mode==='queue-cross'?rr(99):out.committed.ref,claimRef:out.claim.ref,requestHash:out.committed.snapshot.requestHash,
    scope:out.committed.snapshot.scope,transactionId:args[7],expiresAt:out.committed.snapshot.expiresAt}}],rowCount:1};
  }
  return base(sql,args);
 })as typeof f.db.query;
 return out;
}

test('normal START 접수/단회 claim은 원 등록 STREAM과 별도 COMMIT 뒤 새 queue 거래에 exact 결박한다',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,undefined,true,'valid');
 try{
  const before=graphTables.map(n=>h.f.tables[n]!.length),response=await h.post();assert.equal(response.statusCode,200,response.body);
  const a=h.admissionState!;assert.equal(a.admissions,1);assert.equal(a.claims,1);assert.equal(a.queueReads,1);assert.deepEqual(a.commits.slice(-3),['ADMISSION','CLAIM','QUEUE']);
  assert.equal(h.preparation.creates,1);assert(h.preparation.reads>=3);assert.equal(h.preparation.handoffs,1);
  assert.equal(a.committed.snapshot.requestHash,contentHash(canonicalJson(h.command)));
  assert.deepEqual(a.committed.snapshot.request.payload.preparationRef,h.command.payload.preparationRef);
  assert.notEqual(a.committed.snapshot.transactionId,a.claim.snapshot.transactionId);
  const after=graphTables.map(n=>h.f.tables[n]!.length),again=await h.post();assert.equal(again.statusCode,200,again.body);assert.deepEqual(again.json(),response.json());
  assert.deepEqual(graphTables.map(n=>h.f.tables[n]!.length),after);assert.equal(a.admissions,1);assert.equal(a.claims,1);assert.equal(h.preparation.creates,1);
  assert(after.some((n,i)=>n>before[i]!));
 }finally{h.admissionState?.close();await h.app.close();}
});

test('normal admission의 부재/COMMIT 불명/교차 claim은 queue·원 객체·인계0이고 같은 시도 재생성0이다',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 for(const mode of ['missing','admission-lost','claim-lost','queue-cross']as const){
  const h=await host(undefined,undefined,true,mode);
  try{
   const before=graphTables.map(n=>h.f.tables[n]!.length),response=await h.post();assert.equal(response.statusCode,503,response.body);
   assert.deepEqual(graphTables.map(n=>h.f.tables[n]!.length),before);assert.equal(h.preparation.creates,0);assert.equal(h.preparation.handoffs,0);
   const a=h.admissionState!;assert.equal(a.admissions,mode==='missing'?0:1);assert.equal(a.claims,['claim-lost','queue-cross'].includes(mode)?1:0);
   const again=await h.post();assert.equal(again.statusCode,503,again.body);assert.equal(h.preparation.creates,0);assert.equal(a.admissions,mode==='missing'?0:1);
  }finally{h.admissionState?.close();await h.app.close();}
 }
});

test('durable claim의 COMMIT 불명 뒤 다른 명령/기존 port만의 우회도 새 접수·create 전에 거절한다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const h=await host(undefined,undefined,true,'claim-lost');
 let direct:ReturnType<typeof buildApp>|undefined;
 try{
  const first=await h.post();assert.equal(first.statusCode,503,first.body);assert.equal(h.admissionState!.admissions,1);assert.equal(h.admissionState!.claims,1);
  const next={...h.command,commandId:randomUUID()};
  const second=await h.post(next);assert.equal(second.statusCode,412,second.body);assert.match(second.body,/NORMAL_START_ORIGIN_PARENT_CURRENT_REQUIRED/);
  direct=buildApp({},undefined,{repository:h.f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:h.f.root},undefined,undefined,undefined,undefined,null,undefined,undefined,{observe:h.source.observe.bind(h.source),preparation:h.source.preparation});
  for(const payload of [h.command,next]){
   const bypass:{statusCode:number;body:string}=await direct.inject({method:'POST',url:'/api/v1/projects/'+h.f.pid+'/commands',payload,headers:{host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+h.f.token,'x-anvil-csrf':h.f.csrf}});
   assert.equal(bypass.statusCode,412,bypass.body);assert.match(bypass.body,/NORMAL_START_ORIGIN_PARENT_CURRENT_REQUIRED/);
  }
  assert.equal(h.admissionState!.admissions,1);assert.equal(h.admissionState!.claims,1);assert.equal(h.preparation.creates,0);assert.equal(h.preparation.handoffs,0);assert.equal(h.observations(),0);
  for(const name of graphTables)assert.equal(h.f.tables[name]!.length,0,name);
 }finally{h.admissionState?.close();await direct?.close();await h.app.close();}
});
