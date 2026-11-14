import test from 'node:test';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {normalInstructionFixture} from './normal-instruction-dispatch-fixture.ts';
import {executionStartOriginFixture} from '../FN09/execution-start-origin-fixture.ts';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const {buildApp}=await import('../../../apps/server/app.ts');
const {registrationRef}=await import('../../../apps/server/modules/connections/project-registrations.ts');
const {normalStopScopeRefV1}=await import('../../../contracts/runtime/normal-stop-target-v1.ts');
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const {NormalStopTargets,readNormalStopOptions,readNormalStopQuery}=await import('../../../apps/server/modules/executions/normal-stop-target.ts');
const {NormalStopCommands,readNormalStopRecord}=await import('../../../apps/server/modules/executions/normal-stop-command.ts');

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
test('normal STOP 옵션은 current callback·Proxy·추가키를 허용하지 않고 query는 정확한 네 문자열만 받는다',()=>{
 assert.deepEqual(readNormalStopOptions({mode:'NORMAL_PROTECTED'}),{mode:'NORMAL_PROTECTED'});
 let called=0;for(const value of [{},{mode:'SYNTHETIC_ONLY'},{mode:'NORMAL_PROTECTED',current:()=>{called++;}},new Proxy({mode:'NORMAL_PROTECTED'},{ownKeys(){called++;return [];}}),Object.defineProperty({},'mode',{enumerable:true,get(){called++;return 'NORMAL_PROTECTED';}})])assert.throws(()=>readNormalStopOptions(value));assert.equal(called,0);
 const q={generation:'2',grantId:'00000000-0000-4000-8000-000000000001',grantVersion:'1',grantHash:'a'.repeat(64)};assert.equal(readNormalStopQuery(q).generation,2);
 for(const bad of [{...q,generation:'01'},{...q,grantVersion:1},{...q,extra:1},{...q,grantHash:'z'.repeat(64)}])assert.throws(()=>readNormalStopQuery(bad));
});
test('GET은 원 current prototype/instance 교체와 인증 대기 중 교체를 권위로 받지 않는다',async()=>{
 const q={generation:'1',grantId:randomUUID(),grantVersion:'1',grantHash:'a'.repeat(64)},pid=randomUUID(),eid=randomUUID();let calls=0;
 const fake=async()=>{calls++;return {projection:{forged:true}};},original=Object.getOwnPropertyDescriptor(NormalStopTargets.prototype,'current')!;
 const access={async authenticated(_t:unknown,_c:unknown,body:any){return body({},{});}};
 const targets=new NormalStopTargets(access as any);
 try{
  Object.defineProperty(NormalStopTargets.prototype,'current',{...original,value:fake});
  await assert.rejects(targets.read('token',pid,eid,q),/NORMAL_STOP_CURRENT_SOURCE_CHANGED/);
 }finally{Object.defineProperty(NormalStopTargets.prototype,'current',original);}
 for(const descriptor of [{value:fake,configurable:true},{get(){calls++;return fake;},configurable:true}]){
  Object.defineProperty(targets,'current',descriptor);
  try{await assert.rejects(targets.read('token',pid,eid,q),/NORMAL_STOP_CURRENT_SOURCE_CHANGED/);}finally{Reflect.deleteProperty(targets,'current');}
 }
 const delayed=new NormalStopTargets({async authenticated(_t:unknown,_c:unknown,body:any){Object.defineProperty(NormalStopTargets.prototype,'current',{...original,value:fake});return body({},{});}} as any);
 try{await assert.rejects(delayed.read('token',pid,eid,q),/NORMAL_STOP_CURRENT_SOURCE_CHANGED/);}finally{Object.defineProperty(NormalStopTargets.prototype,'current',original);}
 assert.equal(calls,0);
});
test('원 normal START·정책 검산 뒤에도 CURRENT 생산자가 없으면 GET/저장412이며 효과와 callback권위는 없다',async()=>{
 const f=await stopFixture();try{
  const targets=new NormalStopTargets(f.f.access,f.f.limits),commands=new NormalStopCommands(f.f.access, f.f.limits);
  const q={generation:String(f.g.generation),grantId:f.g.id,grantVersion:String(f.g.version),grantHash:f.g.content_hash};
  const request={...f.request,operation:'requestExecutionStop',payload:{grantRef:f.request.payload.grantRef,sessionBindingRef:f.request.payload.sessionBindingRef,stopScopeRef:{id:f.start.id,version:1,contentHash:'b'.repeat(64)},permissionPolicyRef:f.request.payload.permissionPolicyRef,budgetPolicyRef:f.request.payload.budgetPolicyRef,reason:'명시 협력 중지'}};
  const effects=()=>({commands:f.f.commands.size,receipts:f.f.receipts.size,grants:structuredClone(f.f.tables.execution_grants),executionCommands:structuredClone(f.f.tables.execution_commands),outbox:structuredClone(f.f.tables.delivery_outbox),reservations:structuredClone(f.f.tables.usage_reservations)});const before=effects();
  await assert.rejects(targets.read(f.f.token,f.f.pid,f.g.execution_id,q),(e:any)=>e.message==='NORMAL_STOP_CURRENT_NOT_CONNECTED'&&e.statusCode===412);
  await assert.rejects(commands.command(f.f.token,f.f.csrf,request),(e:any)=>e.message==='NORMAL_STOP_CURRENT_NOT_CONNECTED'&&e.statusCode===412);
  assert.deepEqual(effects(),before);assert.equal(f.mode.reads,0);
 }finally{await f.close();}
});

test('원 HUMAN 다섯 값·정책 head·회수 변경은 현재성 부재 이전에도 거절하고 새 저장은 없다',async()=>{
 const f=await stopFixture();try{
  const targets=new NormalStopTargets(f.f.access,f.f.limits),selection={generation:f.g.generation,grantRef:f.request.payload.grantRef};
  for(const key of ['actorId','clientId','credentialGeneration','session','control'] as const){
   const actor=structuredClone(f.f.actor);if(key==='session')actor.authSession.id=randomUUID();else if(key==='credentialGeneration')actor.credentialGeneration++;else if(key!=='control')actor[key]=randomUUID();
   const request=structuredClone(f.request);if(key==='control')request.controlGeneration++;
   await assert.rejects(targets.current(f.f.db,actor,f.f.pid,f.g.execution_id,selection,request),/NORMAL_STOP_SUBJECT_MISMATCH/);
  }
  const q={generation:String(f.g.generation),grantId:f.g.id,grantVersion:String(f.g.version),grantHash:f.g.content_hash};
  f.f.modes.policyVersion++;await assert.rejects(targets.read(f.f.token,f.f.pid,f.g.execution_id,q),/RUNTIME_POLICY_NOT_CURRENT/);f.f.modes.policyVersion--;
  f.mode.revoked=true;await assert.rejects(targets.read(f.f.token,f.f.pid,f.g.execution_id,q),/EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED/);
  assert.equal(f.f.tables.execution_commands!.length,1);
 }finally{await f.close();}
});
test('정상 저장 형상은 원 START namespace에 결박하고 재해시된 다른 주체·target·봉투를 거절한다(저장권위 아님)',async()=>{
 const f=await stopFixture();try{
  const r=stopRecord(f),scope=r.snapshot.scope,id=f.start.snapshot_json.envelope.commandId;
  assert.deepEqual(readNormalStopRecord(r,scope,id),r);
  for(const change of [(x:any)=>x.snapshot.target.grantRef.id=randomUUID(),(x:any)=>x.snapshot.target.sessionBindingRef.id=randomUUID(),(x:any)=>x.snapshot.requestedBy.clientId=randomUUID(),(x:any)=>x.snapshot.executionAuthorized=true,(x:any)=>x.snapshot.expiresAt=new Date(Date.parse(x.snapshot.requestedAt)+30001).toISOString()]){
   const x=structuredClone(r);change(x);const{request:_,envelope:__,...intent}=x.snapshot;x.ref.contentHash=hash(intent);assert.throws(()=>readNormalStopRecord(x,scope,id),/NORMAL_STOP_RECORD_INVALID/);
  }
 }finally{await f.close();}
});
}/** 원 normal START를 RAM 원 정책에서 생산한다. CURRENT ownership은 생산하지 않는다. */
export async function stopFixture(){
 const eid=randomUUID(),f=await executionStartOriginFixture({normalStopPolicy:true,normalExecutionId:eid,connectorEnvironment:true,richContext:true,constitutionContext:true,environmentDependencies:true,snapshotRoot:true,originConsumptionStorage:true,budgetElapsedMs:3600000});
 const prep=f.preparation.data,intent=prep.snapshot.intent,reg=registrationRef(f.registration!.row as any);
 const evidence={basis:prep.snapshot.basisRefs,source:intent.sourceScopes.map((s:any)=>s.observationRef),capability:[intent.capabilityRef],osFence:[prep.ref],storage:[prep.ref]};
 const source={async observe(scope:any,checkedAt:string){return{scope,registrationRef:reg,checkedAt,expiresAt:f.actor.authSession.idleExpiresAt,writerState:'NONE',stageRef:f.stage.data.snapshot.input.stageRef,demand:{attempts:1,calls:1,spoolBytes:1024,cost:null,costStatus:'VERIFIED_NO_CHARGE'},understandingReviewRef:null,checks:{...Object.fromEntries(Object.entries(evidence).map(([k,evidenceRefs])=>[k,{state:'VERIFIED_CURRENT',evidenceRefs}])),understanding:{state:'NOT_REQUIRED',evidenceRefs:[]}}};}};
 const args:any[]=[{},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root}];args[7]=null;args[10]=source;
 const app=Reflect.apply(buildApp,undefined,args),headers={host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 const startRequest={...f.originCommand(),operation:'queueExecutionCommand',approvalRef:null,payload:{operation:'START_SESSION',executionId:eid,executionGeneration:1,preparationRef:prep.ref,permissionPolicyRef:f.policyRef,budgetPolicyRef:intent.budgetPolicyRef,payload:{contextBundleRef:intent.contextBundleRef,optionsRef:prep.ref}}};
 const response=await app.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/commands',headers,payload:startRequest});assert.equal(response.statusCode,200,response.body);
 const g=f.tables.execution_grants![0]!,start=f.tables.execution_commands![0]!,fact=g.snapshot_json.binding,raw=f.db.query;
 const grantRef={id:g.id,version:g.version,contentHash:g.content_hash};const mode={reads:0,revoked:false};
 f.db.query=async(sql:string,a:any[]=[])=>{
  if(sql.startsWith('SELECT g.*,c.id AS start_id')){assert.deepEqual(a,[f.pid,eid,g.generation,g.id,g.version]);assert.equal(start.created_command_id,g.command_id);return{rows:[{...g,start_id:start.id,start_version:start.version,start_hash:start.content_hash,start_envelope_hash:start.envelope_hash,start_snapshot:start.snapshot_json}]};}
  if(sql.startsWith('SELECT * FROM anvil.normal_exchange_current(')){
   assert.deepEqual(a,[f.pid,fact.registration.connectorId,eid,g.id,g.version,g.content_hash,fact.executionCredentialReservation.generation]);if(mode.revoked)return{rows:[]};
   const policy=f.tables.limits!.find(r=>r.policy_id===fact.intent.budgetPolicyRef.id&&r.version===fact.intent.budgetPolicyRef.version)!;
   const at=(await raw('SELECT clock_timestamp() AS at')).rows[0].at;
   return{rows:[{binding:{transport:'NORMAL_PROTECTED',mode:'EXECUTION',projectId:f.pid,connectorId:fact.registration.connectorId,executionId:eid,executionGeneration:g.generation,grantRef,scopeDigest:g.snapshot_json.scopeDigest,credentialGeneration:fact.executionCredentialReservation.generation,publicKeyFingerprint:fact.registration.hostPublicKeyFingerprint},spki:f.registration!.connector.public_key_spki,deadline:new Date(g.snapshot_json.expiresAt),observed_at:at,budget_ref:fact.budgetReservationRef,budget_policy:{projectId:f.pid,ref:fact.intent.budgetPolicyRef,snapshot:policy.snapshot_json}}]};
  }
  return raw(sql,a);
 };
 const request={...f.originCommand(),operation:'requestExecutionStop',targetId:eid,expectedVersion:g.generation,payload:{grantRef,sessionBindingRef:fact.agentSession.sessionRef,stopScopeRef:{id:randomUUID(),version:1,contentHash:'b'.repeat(64)},permissionPolicyRef:fact.permissionPolicyRef,budgetPolicyRef:fact.intent.budgetPolicyRef,reason:'명시 협력 중지'}};
 return{f,g,start,request,mode,args,headers,close:()=>app.close()};
}

/** codec/page 입력 형상 시험만. 이 원형은 DB 권위나 실제 CURRENT 생산자가 아니다. */
export function stopRecord(f:Awaited<ReturnType<typeof stopFixture>>){
 const ref=()=>({id:randomUUID(),version:1,contentHash:'c'.repeat(64)}),base=f.start.snapshot_json.envelope,fact=f.g.snapshot_json.binding;
 const target={kind:'NORMAL_STOP_SCOPE_V1',projectId:f.f.pid,executionId:f.g.execution_id,executionGeneration:f.g.generation,grantRef:f.request.payload.grantRef,parentStartCommandRef:{id:f.start.id,version:1,contentHash:f.start.content_hash},parentStartEnvelopeHash:base.envelopeHash,executorRegistrationRef:base.executorRegistrationRef,sessionBindingRef:fact.agentSession.sessionRef,roleBindingRef:fact.agentSession.roleBindingRef,bindingGeneration:fact.agentSession.bindingGeneration,ownershipRef:ref(),mode:'COOPERATIVE_REQUEST_ONLY',forceKillAllowed:false};
 const request={...structuredClone(f.request),payload:{...structuredClone(f.request.payload),stopScopeRef:normalStopScopeRefV1(target,base.commandId)}},intent={transport:'NORMAL_PROTECTED',state:'STOP_REQUEST_STORED',scope:{projectId:f.f.pid,executionId:f.g.execution_id,executionGeneration:f.g.generation},requestHash:hash(request),requestedBy:fact.subject,target,reason:request.payload.reason,requestedAt:base.issuedAt,expiresAt:new Date(Math.min(Date.parse(base.expiresAt),Date.parse(base.issuedAt)+30000)).toISOString(),executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false};
 const unsigned={...base,commandId:request.commandId,issuedAt:intent.requestedAt,expiresAt:intent.expiresAt,context:{...base.context,authorizationReceiptRef:ref()},operation:'REQUEST_STOP',payload:{sessionBindingRef:target.sessionBindingRef,stopScopeRef:request.payload.stopScopeRef}};delete unsigned.envelopeHash;
 return{ref:{...ref(),contentHash:hash(intent)},snapshot:{...intent,request,envelope:{...unsigned,envelopeHash:hash(unsigned)}}};
}
