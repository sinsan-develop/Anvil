import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AccessRepository, AuthFailure } from '../../../apps/server/modules/access/repository.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { ProjectExecutionBudget } from '../../../apps/server/modules/executions/execution-budget.ts';
const queue:any=await import('../../../apps/server/modules/executions/execution-commands.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
const ref={id:pid,version:1,contentHash:'a'.repeat(64)},at=new Date().toISOString(),until=new Date(Date.now()+3600000).toISOString();
const scopes=()=>[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/main.ts',kind:'FILE',access:'READ',recursive:false}]}];
const intent=()=>({projectId:pid,assignmentRef:ref,roleBindingRef:ref,contextBundleRef:ref,connectionRef:ref,environmentRef:ref,capabilityRef:ref,budgetPolicyRef:ref,sourceScopes:scopes(),mode:'CONTEXT_REVIEW',reason:'합성 첫 세션'});
function fixture(){
 assert.equal(typeof queue.ProjectInitialExecutionQueue,'function');
 const token='t'.repeat(43),csrf='c'.repeat(43),tables:Record<string,any[]>={};
 for(const t of ['commands','authorization_receipts','audit_events','executions','execution_grants','execution_commands','usage_reservations','writer_claims','delivery_outbox'])tables[t]=[];
 let checkpoint:any=null,failAt='',revoked=false,control=2,basisCalls=0,currentCalls=0,mode='CURRENT',sequence=Promise.resolve(),clock=new Date(at);
 const rules=[eid,other].map(executionId=>({ruleId:executionId,subjectRef:{kind:'HUMAN',userId:pid},operations:['authorizeExecution','queueExecutionCommand'],targetScopes:[{kind:'EXECUTION',projectId:pid,executionId,executionGeneration:1,sourceScopes:scopes()}],disposition:'AUTO',limitPolicyRef:ref,expiresAt:until}));
 const policy=()=>({rules,reason:'합성 현재 정책',reviewRefs:[]}),policyRef=()=>({id:pid,version:1,contentHash:contentHash(canonicalJson(policy()))});
 const db:any={query:async(sql:string,p:any[]=[])=>{
  if(sql==='BEGIN'){checkpoint=structuredClone(tables);return{rows:[]};}
  if(sql==='COMMIT'){checkpoint=null;return{rows:[]};}
  if(sql==='ROLLBACK'){for(const k of Object.keys(tables))tables[k]=checkpoint[k];checkpoint=null;return{rows:[]};}
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return{rows:[{id:other,uid:pid,client_id:cid,current_generation:3,credential_generation:3,user_status:'ACTIVE',user_revoked_at:null,client_revoked_at:null,revoked_at:null,idle_expires_at:new Date(mode==='SESSION_SOON'?Date.parse(at)+300000:Date.parse(until)+3600000),absolute_expires_at:new Date('2099-01-01T00:00:00.000Z'),csrf_digest:createHash('sha256').update(csrf).digest('hex'),reauth_until:null,server_owner:false}]};
  if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:pid,participation:'OWNER',archived_at:null}]};
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return{rows:[{actor_id:pid,client_id:cid,generation:control,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:revoked?[]:[{id:pid,head_version:1,rules_json:rules,reason:policy().reason,review_refs:[],content_hash:policyRef().contentHash,created_at:new Date(at)}]};
  if(sql.startsWith('SELECT operation,request_hash,result_ref'))return{rows:tables.commands!.filter(r=>r.project_id===p[0]&&r.actor_id===p[1]&&r.command_key===p[2])};
  if(sql.startsWith('SELECT clock_timestamp()'))return{rows:[{at:new Date(clock)}]};
  if(sql.startsWith('SELECT transaction_timestamp()'))return{rows:[{at:new Date(at)}]};
  if(sql.includes('FROM anvil.writer_claims'))return{rows:tables.writer_claims!.filter(r=>r.project_id===p[0]&&!r.reclaimed_at)};
  if(sql.includes('FROM anvil.executions'))return{rows:tables.executions!.filter(r=>r.project_id===p[0]&&r.id===p[1])};
  if(sql.includes('FROM anvil.usage_reservations'))return{rows:tables.usage_reservations!.filter(r=>r.project_id===p[0]).sort((a,b)=>a.server_sequence-b.server_sequence)};
  if(sql.startsWith('SELECT set_config'))return{rows:[]};
  if(sql.startsWith('INSERT INTO')){
   const table=/INSERT INTO anvil\.([a-z_]+)/.exec(sql)![1]!;if(failAt===table)throw new AuthFailure('SYNTHETIC_STORAGE_UNAVAILABLE',503);
   assert(tables[table],`UNKNOWN_TABLE ${table}`);let row:any={params:structuredClone(p)};
   if(table==='commands')row={id:p[0],project_id:p[1],actor_id:p[2],client_id:p[3],operation:p[4],command_key:p[5],request_hash:p[6],result_ref:JSON.parse(p[14])};
   if(table==='usage_reservations')row={project_id:p[0],reservation_id:p[1],version:p[2],server_sequence:p[3],command_id:p[4],content_hash:p[5],snapshot_json:JSON.parse(p[6])};
   if(table==='writer_claims')row={...row,project_id:p[0],reclaimed_at:null};
   if(table==='executions')row={...row,project_id:p[0],id:p[1]};
   tables[table]!.push(row);return{rows:[],rowCount:1};
  }
  throw Error('UNEXPECTED_SQL '+sql);
 },release:()=>{}};
 // 외부 DB 경계만 직렬 fake로 대체한다. 실제 AccessRepository의 BEGIN/COMMIT/ROLLBACK을 소비한다.
 const pool:any={connect:async()=>{let release!:()=>void;const prior=sequence;sequence=new Promise<void>(r=>{release=r;});await prior;return{query:db.query,release};}};
 const access=new AccessRepository(pool,{installationId:pid,key:randomBytes(32)});
 const policies:any={resolveCurrent:async(_db:any,_actor:any,projectId:any,budgetRef:any,scope:any)=>{
  assert.equal(projectId,pid);assert.deepEqual(budgetRef,ref);assert.deepEqual(scope,{kind:'PROJECT',projectId:pid});
  if(mode==='BUDGET_REVOKED')throw new AuthFailure('LIMIT_POLICY_REVOKED',412);
  return{projectId:pid,ref,snapshot:{state:'APPLIED',scope,limits:{maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1024,maxOfflineMs:0},decidedAt:at,expiresAt:until}};
 }};
 const provider:any={transport:'SYNTHETIC_ONLY',basis:async(_db:any,actor:any,request:any)=>{
  basisCalls++;assert.equal(actor.actorId,pid);
  const claim={projectId:pid,executionId:request.payload.executionId,executionGeneration:1,commandId:request.commandId,assignmentRef:ref,stageRef:{applicationRef:ref,nodeId:'개발'},policyRef:ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:32,cost:null,costStatus:'VERIFIED_NO_CHARGE'}};
  return{intent:intent(),claim};
 },current:async(_db:any,actor:any,request:any,basis:any,reservation:any)=>{
  currentCalls++;const checks=Object.fromEntries(['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'].map(name=>[name,{state:name==='understanding'?'NOT_REQUIRED':'VERIFIED_CURRENT',evidenceRefs:name==='understanding'?[]:name==='budget'?[reservation.record.ref]:[ref]}]));
  checks.permissionPolicy={state:'VERIFIED_CURRENT',evidenceRefs:[policyRef()]};if(mode==='UNVERIFIED_OS')checks.osFence={state:'UNVERIFIED',evidenceRefs:[]};
  return{schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:'SYNTHETIC_ONLY',projectId:pid,executionId:request.payload.executionId,executionGeneration:1,subject:{userId:pid,clientId:cid,humanSessionId:mode==='WRONG_SESSION'?pid:actor.authSession.id,controlGeneration:2,credentialGeneration:3},agentSession:{sessionRef:ref,roleBindingRef:ref,credentialGeneration:4},registration:{ref,connectorId:pid,generation:5,hostPublicKeyFingerprint:'b'.repeat(64)},intent:basis.intent,preparationRef:ref,permissionPolicyRef:policyRef(),budgetReservationRef:reservation.record.ref,basisRefs:[ref],latestInstructionRefs:[],understandingReviewRef:null,checks,writerState:'NONE',expires:{humanSession:until,permissionPolicy:until,registration:until,budget:until,automaticScope:until},checkedAt:at,executionAuthorized:false,dispatchPerformed:false};
 }};
 const repo=new queue.ProjectInitialExecutionQueue(access,provider,new ProjectExecutionBudget(policies),policies);
 const request=()=>({schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:cid,controlGeneration:2,operation:'queueExecutionCommand',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{preparationRef:ref,executionId:eid,executionGeneration:1,permissionPolicyRef:policyRef(),budgetPolicyRef:ref,operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}}});
 return{tables,rules,request,provider,run:(r=request())=>repo.command(token,csrf,r),fail:(table:string)=>{failAt=table;},revoke:()=>{revoked=true;},stale:()=>{control=3;},mode:(value:string)=>{mode=value;},advance:(ms:number)=>{clock=new Date(Date.parse(at)+ms);},calls:()=>({basisCalls,currentCalls})};
}
const domain=['commands','authorization_receipts','executions','execution_grants','execution_commands','usage_reservations','writer_claims','delivery_outbox'];
test('초기 합성 queue는 같은 transaction에 명령·grant·예약·writer·보류 outbox를 저장하고 실행 성공으로 표시하지 않는다',async()=>{
 const f=fixture(),result:any=await f.run();assert.equal(result.status,'APPLIED');assert.equal(result.data.status,'SYNTHETIC_QUEUE_STORED');assert.equal(result.data.executionAuthorized,false);assert.equal(result.data.dispatchPerformed,false);
 for(const table of domain)assert.equal(f.tables[table]!.length,1,table);
 assert.equal(f.tables.delivery_outbox![0].params[6],'HELD_SYNTHETIC_ONLY');assert.equal(f.tables.usage_reservations![0].snapshot_json.claim.commandId,result.commandId);
 assert.equal(JSON.parse(f.tables.execution_commands![0].params[9]).envelope.context.budgetRef.contentHash,f.tables.usage_reservations![0].content_hash);
});
test('봉투 권한 참조는 임의 UUID가 아니라 같은 transaction의 실제 authorization receipt와 scope hash에 결박한다',async()=>{
 const f=fixture();await f.run();const stored=JSON.parse(f.tables.execution_commands![0].params[9]),receipt=f.tables.authorization_receipts![0].params;
 assert.deepEqual(stored.envelope.context.authorizationReceiptRef,{id:receipt[0],version:1,contentHash:receipt[5]});
});
test('grant는 실제 로그인 session id와 가장 짧은 세션 만료에 결박하고 provider의 긴 기한을 쓰지 않는다',async()=>{
 const f=fixture();f.mode('SESSION_SOON');await f.run();const grant=JSON.parse(f.tables.execution_grants![0].params[6]);
 assert.equal(grant.binding.subject.humanSessionId,other);assert.equal(grant.expiresAt,new Date(Date.parse(at)+300000).toISOString());
});
test('await 중 원요청 변경은 기록할 요청 hash와 실제 queue payload를 엇갈리게 하지 않는다',async()=>{
 const f=fixture(),request=f.request(),original=canonicalJson(request),basis=f.provider.basis;
 f.provider.basis=async(...args:any[])=>{request.payload.payload.optionsRef={...ref,version:2};return basis(...args);};
 await f.run(request);assert.equal(f.tables.commands![0].request_hash,contentHash(original));
 assert.equal(JSON.parse(f.tables.execution_commands![0].params[9]).envelope.payload.optionsRef.version,1);
});
test('현재성 port가 받은 예약 객체를 수정해도 저장할 불변 예약 원문·hash는 바뀌지 않는다',async()=>{
 const f=fixture(),request=f.request(),current=f.provider.current;
 f.provider.current=async(...args:any[])=>{const fact=await current(...args);args[4].record.snapshot.claim.commandId=other;return fact;};
 await f.run(request);const saved=f.tables.usage_reservations![0];assert.equal(saved.snapshot_json.claim.commandId,request.commandId);assert.equal(saved.content_hash,contentHash(canonicalJson(saved.snapshot_json)));
});
function shortAuthorize(f:ReturnType<typeof fixture>){
 const split=f.rules.flatMap(rule=>[{...rule,ruleId:rule.ruleId+'_auth',operations:['authorizeExecution'],expiresAt:new Date(Date.parse(at)+300000).toISOString()},{...rule,operations:['queueExecutionCommand']}]);f.rules.splice(0,f.rules.length,...split);
}
test('grant 기한은 필수 authorizeExecution과 queue 정책 기한 중 가장 짧은 값이다',async()=>{
 const f=fixture();shortAuthorize(f);await f.run();assert.equal(JSON.parse(f.tables.execution_grants![0].params[6]).expiresAt,new Date(Date.parse(at)+300000).toISOString());
});
test('provider 대기 중 authorize 권한만 만료돼도 fresh fact와 긴 queue 권한으로 새 저장을 하지 않는다',async()=>{
 const f=fixture();shortAuthorize(f);const current=f.provider.current;
 f.provider.current=async(...args:any[])=>{const fact=await current(...args);f.advance(360000);fact.checkedAt=new Date(Date.parse(at)+360000).toISOString();return fact;};
 await assert.rejects(f.run(),/RUNTIME_OPERATION_DENIED/);for(const table of domain)assert.equal(f.tables[table]!.length,0,table);
});
test('응답 유실 뒤 같은 명령/hash는 원 결과만 돌려주고 다른 내용·새 실행을 자동 재시도하지 않는다',async()=>{
 const f=fixture(),request=f.request(),first=await f.run(request);assert.deepEqual(await f.run(request),first);
 assert.equal(f.tables.commands!.length,1);assert.equal(f.tables.usage_reservations!.length,1);assert.equal(f.tables.delivery_outbox!.length,1);assert.equal(f.calls().currentCalls,1);
 const changed=structuredClone(request);changed.payload.payload.optionsRef={...ref,version:2};await assert.rejects(f.run(changed),/IDEMPOTENCY_CONFLICT/);
 const next=f.request();next.payload.executionId=other;await assert.rejects(f.run(next),/EXECUTION_WRITER_UNAVAILABLE/);assert.equal(f.tables.commands!.length,1);
});
test('domain 저장 각 지점의 오류는 전체 transaction을 되돌려 고아 outbox·예산 예약을 남기지 않는다',async()=>{
 for(const table of domain){const f=fixture();f.fail(table);await assert.rejects(f.run(),/SYNTHETIC_STORAGE_UNAVAILABLE/);for(const name of domain)assert.equal(f.tables[name]!.length,0,table+'→'+name);}
});
test('현재 제어/정책·예산·OS 미확인과 옛 불명 writer는 새 queue를 막는다',async()=>{
 const codes:Record<string,string>={CONTROL:'CONTROL_GENERATION_CONFLICT',POLICY:'PERMISSION_POLICY_UNCONFIGURED',BUDGET_REVOKED:'LIMIT_POLICY_REVOKED',UNVERIFIED_OS:'EXECUTION_CURRENTNESS_REQUIRED',UNKNOWN_WRITER:'EXECUTION_WRITER_UNAVAILABLE',WRONG_SESSION:'EXECUTION_FACT_BINDING_MISMATCH'};
 for(const mode of ['CONTROL','POLICY','BUDGET_REVOKED','UNVERIFIED_OS','UNKNOWN_WRITER','WRONG_SESSION']){
  const f=fixture();if(mode==='CONTROL')f.stale();else if(mode==='POLICY')f.revoke();else if(mode==='UNKNOWN_WRITER')f.tables.writer_claims!.push({project_id:pid,reclaimed_at:null,expires_at:new Date('2000-01-01'),ownership_state:'UNKNOWN'});else f.mode(mode);
  await assert.rejects(f.run(),new RegExp(codes[mode]!));for(const table of domain.filter(n=>n!=='writer_claims'))assert.equal(f.tables[table]!.length,0,mode+'→'+table);
 }
});
test('직렬 DB 경계에서 같은 프로젝트의 동시 첫 요청은 한 writer/예약/outbox만 남긴다',async()=>{
 const f=fixture(),first=f.request(),second=f.request();second.payload.executionId=other;
 const results=await Promise.allSettled([f.run(first),f.run(second)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 for(const table of domain)assert.equal(f.tables[table]!.length,1,table);
});
test('외부 transport fallback·caller fact와 미지원 명령을 허용하지 않는다',async()=>{
 const f=fixture();for(const patch of [{operation:'SEND_INSTRUCTION'},{ready:true},{fact:{}},{executionGeneration:0},{permissionPolicyRef:{...ref,version:2}}]){const r=f.request();Object.assign(r.payload,patch);await assert.rejects(f.run(r));}
 f.provider.transport='CODEX';await assert.rejects(f.run(),/SYNTHETIC_PROVIDER_REQUIRED/);for(const table of domain)assert.equal(f.tables[table]!.length,0);
});
