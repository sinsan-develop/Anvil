import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { materialRules, authorizeMaterial, ProjectPolicyRepository, type ProjectCommand } from '../../../apps/server/modules/access/project-command.ts';
import * as runtime from '../../../apps/server/modules/executions/runtime-policy.ts';
const auth:any=runtime;
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',actor:any={actorId:pid,clientId:eid};
const ref={id:pid,version:1,contentHash:'a'.repeat(64)},now=new Date('2026-10-19T12:00:00.000Z');
const source=(paths=['src/a.ts'])=>[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:paths.map(relativePath=>({relativePath,kind:'FILE',access:'WRITE',recursive:false}))}];
const scope=()=>({executionId:eid,executionGeneration:1,permissionPolicyRef:ref,budgetPolicyRef:ref,sourceScopes:source()});
const rule=(patch:any={})=>({ruleId:'run',subjectRef:{kind:'HUMAN',userId:pid},operations:['authorizeExecution','queueExecutionCommand'],targetScopes:[{kind:'EXECUTION',projectId:pid,executionId:eid,executionGeneration:1,sourceScopes:source()}],disposition:'AUTO',limitPolicyRef:ref,expiresAt:'2026-10-19T13:00:00.000Z',...patch});
const request=():ProjectCommand=>({schemaVersion:1,projectId:pid,commandId:crypto.randomUUID(),clientId:eid,controlGeneration:2,operation:'authorizeExecution',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}});

test('runtime 정책은 exact 실행/세대·파일·유효 예산 ref를 별도 요구하고 문서 null 경계를 보존한다',()=>{
 assert.equal(materialRules([rule()],pid,pid,now).length,1);
 const document={...rule(),operations:['saveDocumentDraft'],targetScopes:[{kind:'PROJECT',projectId:pid}],limitPolicyRef:null};assert.equal(materialRules([document],pid,pid,now).length,1);
 for(const invalid of [rule({limitPolicyRef:null}),rule({operations:['saveDocumentDraft']}),{...document,operations:['authorizeExecution']},rule({targetScopes:[{...rule().targetScopes[0],executionGeneration:0}]}),rule({targetScopes:[{...rule().targetScopes[0],sourceScopes:[]}]}),rule({targetScopes:[{...rule().targetScopes[0],projectId:eid}]})])assert.throws(()=>materialRules([invalid],pid,pid,now));
});
function fixture(rules:any[]=[rule()]){
 let control=2,expired=false,missing=false,budgetCalls=0;const payload=()=>({rules,reason:'합성 명시 실행 범위',reviewRefs:[]});
 const policyRef=()=>({id:pid,version:1,contentHash:contentHash(canonicalJson(payload()))});
 const db:any={query:async(sql:string)=>{
  if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:pid,participation:'OWNER',archived_at:null}]};
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return{rows:[{actor_id:pid,client_id:eid,generation:control,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:missing?[]:[{id:pid,head_version:1,rules_json:rules,reason:payload().reason,review_refs:[],content_hash:policyRef().contentHash,created_at:now}]};
  if(sql.startsWith('SELECT clock_timestamp()'))return{rows:[{at:expired?new Date('2026-10-19T14:00:00.000Z'):now}]};
  throw Error('UNEXPECTED_WRITE_OR_QUERY');
 }};
 const budgets:any={resolveCurrent:async(_db:any,_actor:any,p:any,r:any,s:any)=>{budgetCalls++;assert.equal(p,pid);assert.deepEqual(r,ref);assert.deepEqual(s,{kind:'PROJECT',projectId:pid});return{projectId:pid,ref,snapshot:{state:'APPLIED',expiresAt:'2026-10-19T12:30:00.000Z'}};}};
 const input=()=>({...scope(),permissionPolicyRef:policyRef()});
 return{db,budgets,input,request,policyRef,calls:()=>budgetCalls,stale:()=>{control=3;},expire:()=>{expired=true;},unconfigured:()=>{missing=true;}};
}
async function check(f:ReturnType<typeof fixture>,input=f.input(),req=f.request()) {assert.equal(typeof auth.authorizeRuntimePolicy,'function');return auth.authorizeRuntimePolicy(f.db,actor,req,input,f.budgets);}
test('현재 제어·명시 runtime 정책/범위·budget을 검사하고 결과를 실행 허가로 승격하지 않는다',async()=>{
 const f=fixture(),result=await check(f);assert.deepEqual(result.policyRef,f.policyRef());assert.deepEqual(result.budgetPolicyRef,ref);assert.equal(result.validUntil,Date.parse('2026-10-19T12:30:00.000Z'));assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);assert.equal(f.calls(),1);
 await assert.rejects(authorizeMaterial(f.db,actor,{...f.request(),operation:'saveDocumentDraft'} as any),/PROJECT_OPERATION_DENIED/);
});
test('좁은 DENY 파일이 요청 일부와 겹쳐도 broad AUTO를 우회하지 않는다',async()=>{
 assert.equal(typeof auth.authorizeRuntimePolicy,'function');
 const deny=rule({ruleId:'deny',disposition:'DENY',targetScopes:[{...rule().targetScopes[0],sourceScopes:source(['src/a.ts'])}],limitPolicyRef:{...ref,version:2}});
 const allow=rule({targetScopes:[{...rule().targetScopes[0],sourceScopes:source(['src/a.ts','src/b.ts'])}]});
 const f=fixture([allow,deny]);await assert.rejects(check(f,{...f.input(),sourceScopes:source(['src/a.ts','src/b.ts'])}),/RUNTIME_OPERATION_DENIED/);assert.equal(f.calls(),0);
 const caseDeny=fixture([allow,{...deny,targetScopes:[{...deny.targetScopes[0],sourceScopes:source(['SRC/A.TS'])}]}]);await assert.rejects(check(caseDeny),/RUNTIME_OPERATION_DENIED/);
});
test('옛 정책/세대·다른 실행·파일 이탈·예산 참조/정책 만료는 거절한다',async()=>{
 assert.equal(typeof auth.authorizeRuntimePolicy,'function');
 const f=fixture();for(const patch of [{executionId:pid},{executionGeneration:2},{sourceScopes:source(['src/outside.ts'])},{budgetPolicyRef:{...ref,version:2}},{permissionPolicyRef:ref}])await assert.rejects(check(f,{...f.input(),...patch}));
 f.stale();await assert.rejects(check(f),/CONTROL_GENERATION_CONFLICT/);
 const expired=fixture();expired.expire();await assert.rejects(check(expired),/RUNTIME_OPERATION_DENIED/);
 const missing=fixture();missing.unconfigured();await assert.rejects(check(missing),/PERMISSION_POLICY_UNCONFIGURED/);
});
test('필요한 runtime 일회 승인 분기는 미연결이면 거절하며 AUTO에 남의 승인 ref를 재사용하지 않는다',async()=>{
 assert.equal(typeof auth.authorizeRuntimePolicy,'function');
 const need=fixture([rule({disposition:'REQUIRE_APPROVAL'})]);await assert.rejects(check(need),/EXECUTION_APPROVAL_NOT_CONNECTED/);
 const auto=fixture();await assert.rejects(check(auto,auto.input(),{...auto.request(),approvalRef:{requestId:pid,decisionId:eid,scopeDigest:'b'.repeat(64)}}),/APPROVAL_NOT_REQUIRED/);
});

test('배열/객체 disposition을 정책 저장 입력에서 거절한다',()=>{
 for(const disposition of [['DENY'],['REQUIRE_APPROVAL'],['AUTO'],null,{},true]){
  assert.throws(()=>materialRules([rule({disposition})],pid,pid,now),/POLICY_INPUT_INVALID/);
 }
});
test('잘못 저장된 disposition도 현재 원문 소비에서 거절하여 DENY/승인 분기를 우회하지 않는다',async()=>{
 for(const disposition of [['DENY'],['REQUIRE_APPROVAL'],['AUTO'],null,{},true]){
  // 정상 broad AUTO와 함께 있어도 잘못 저장된 제한을 무시하고 허용하지 않는다.
  const f=fixture([rule(),rule({ruleId:'malformed',disposition})]);
  await assert.rejects(check(f),/POLICY_INTEGRITY_FAILED/);assert.equal(f.calls(),0);
  await assert.rejects(authorizeMaterial(f.db,actor,{...f.request(),operation:'saveDocumentDraft'}),/POLICY_INTEGRITY_FAILED/);
 }
});

test('runtime 정책 저장은 현재 예산 원문을 재확인하고 없는 ref와 예산보다 긴 유효기간을 쓰지 않는다',async()=>{
 // 누락된 resolveCurrent 호출/예산 expiry 대조는 이 검사를 실패시킨다. DB 경계만 대체하며 실제 정책 저장 경로를 호출한다.
 for(const mode of ['MISSING','TOO_LONG','CURRENT','DOCUMENT'] as const){
  const at=new Date(),until=new Date(at.getTime()+60000).toISOString(),limits={maxAttempts:3,maxElapsedMs:120000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1024,maxOfflineMs:0};
  const snapshot={limits,scope:{kind:'PROJECT',projectId:pid},reason:'합성 한도',policyBaseVersion:0,state:'APPLIED',previousRef:null,decidedBy:{kind:'HUMAN',userId:pid},decidedAt:new Date(at.getTime()-60000).toISOString(),expiresAt:until,executionAuthorized:false,dispatchPerformed:false};
  const budgetRef={id:eid,version:1,contentHash:contentHash(canonicalJson(snapshot))};
  const budgetCommand={...request(),controlGeneration:2,operation:'applyLimitPolicy',payload:{limits,scope:snapshot.scope,reason:snapshot.reason,policyBaseVersion:0}};
  const row={project_id:pid,policy_id:eid,version:1,content_hash:budgetRef.contentHash,snapshot_json:snapshot,created_by:pid,client_id:eid,state:'APPLIED',command_actor:pid,command_client:eid,operation:'applyLimitPolicy',command_key:budgetCommand.commandId,control_generation:2,request_hash:contentHash(canonicalJson(budgetCommand)),result_ref:{projectId:pid,status:'APPLIED',data:{status:'LIMIT_POLICY_APPLIED',ref:budgetRef,snapshot}}};
  const r:any=mode==='DOCUMENT'?{...rule(),operations:['saveDocumentDraft'],targetScopes:[{kind:'PROJECT',projectId:pid}],limitPolicyRef:null,expiresAt:until}:rule({limitPolicyRef:budgetRef,expiresAt:new Date(at.getTime()+(mode==='TOO_LONG'?90000:30000)).toISOString()});
  let writes=0,budgetReads=0;const db:any={query:async(sql:string,p:any[]=[])=>{
   if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:pid,participation:'OWNER',archived_at:null}]};
   if(sql.startsWith('SELECT * FROM anvil.project_control'))return{rows:[{actor_id:pid,client_id:eid,generation:2,revoked_at:null}]};
   if(sql.includes('FROM anvil.permission_policies')||sql.startsWith('SELECT operation,request_hash'))return{rows:[]};
   if(sql.includes('FROM anvil.limit_policy_versions v')){budgetReads++;assert.equal(p[0],pid);return{rows:mode==='MISSING'?[]:[row]};}
   if(sql.startsWith('SELECT clock_timestamp()')||sql.startsWith('SELECT transaction_timestamp()'))return{rows:[{at}]};
   if(sql.startsWith('SELECT set_config'))return{rows:[]};
   if(sql.startsWith('INSERT INTO anvil.audit_events'))return{rows:[]};
   if(sql.startsWith('INSERT INTO')){writes++;return{rows:[]};}
   throw Error('UNEXPECTED_SQL');
  }};
  const owner={...actor,reauthUntil:new Date(at.getTime()+60000)},repo=new ProjectPolicyRepository({authenticated:async(_t:any,_c:any,run:any)=>run(db,owner)} as any);
  const candidate={...request(),operation:'savePermissionPolicy',payload:{rules:[r],reason:'합성 명시 정책',reviewRefs:[]}};
  if(mode==='MISSING')await assert.rejects(repo.command('t','c',candidate),/LIMIT_POLICY_NOT_CURRENT/);
  else if(mode==='TOO_LONG')await assert.rejects(repo.command('t','c',candidate),/RUNTIME_POLICY_EXCEEDS_BUDGET_EXPIRY/);
  else{const result:any=await repo.command('t','c',candidate);assert.equal(result.data.status,'POLICY_SAVED');assert(writes>0);}
  assert.equal(budgetReads,mode==='DOCUMENT'?0:1);if(mode==='MISSING'||mode==='TOO_LONG')assert.equal(writes,0);
 }
});
