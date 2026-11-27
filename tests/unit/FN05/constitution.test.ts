import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as state from '../../../apps/server/modules/knowledge/knowledge-state.ts';

const ref={id:'10000000-0000-4000-8000-000000000001',version:2,contentHash:'a'.repeat(64)};
const view={ref,entry:{kind:'CONSTITUTION'},state:'CONFIRMED',headVersion:2,confirmation:{eventId:'20000000-0000-4000-8000-000000000002'},currentConfirmationValid:true};
test('헌법 적용은 확정·현재 버전·최신 검토의 실제 상태를 구분하고 과거 적용을 지우지 않는다',()=>{
  const inspect=(state as any).constitutionEligibility;
  assert.equal(typeof inspect,'function','프로젝트 헌법의 현재 사용 가능 판정이 필요하다');
  assert.deepEqual(inspect(view),{usable:true,reasons:[]});
  assert.deepEqual(inspect({...view,headVersion:3,state:'SUPERSEDED'}),{usable:false,reasons:['SUPERSEDED']});
  assert.deepEqual(inspect({...view,state:'EXCLUDED'}),{usable:false,reasons:['EXCLUDED']});
  assert.deepEqual(inspect({...view,currentConfirmationValid:false}),{usable:false,reasons:['REVIEW_NOT_CURRENT']});
  assert.deepEqual(inspect({...view,confirmation:null,state:'PROPOSED',currentConfirmationValid:false}),{usable:false,reasons:['NOT_CONFIRMED']});
  assert.deepEqual(inspect({...view,entry:{kind:'FACT'}}),{usable:false,reasons:['NOT_CONSTITUTION']});
});
test('별도 적용 입력은 확인·정확 버전·확정 사건·이유만 수용하고 자동 실행 필드를 거절한다',()=>{
  const read=(state as any).readConstitutionApplication;
  assert.equal(typeof read,'function','헌법 적용 입력 검사 필요');
  const input={versionRef:ref,confirmationId:view.confirmation.eventId,reason:'이 프로젝트의 기준으로 별도 적용',acknowledged:true};
  assert.deepEqual(read(input),input);
  for(const bad of [{...input,acknowledged:false},{...input,reason:' '},{...input,confirmationId:'invalid'},{...input,agentDelivery:true},{...input,versionRef:{...ref,version:0}}])assert.throws(()=>read(bad),{message:'CONSTITUTION_INPUT_INVALID'});
});


import {buildApp} from '../../../apps/server/app.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {Pool} from 'pg';
const uuid=(n:number)=>'af050005-0000-4000-8000-'+String(n).padStart(12,'0'),hash=(v:unknown)=>contentHash(canonicalJson(v));
function replayFixture(versionOne=false){
 const projectId=uuid(1),actorId=uuid(2),clientId=uuid(3),token='T'.repeat(43),csrf='C'.repeat(43),origin='https://localhost:3830',now=new Date(),expires=new Date(now.getTime()+3600000),policyRef={id:uuid(4),version:1,contentHash:''},rules=[{ruleId:'CONSTITUTION_ONLY',subjectRef:{kind:'HUMAN',userId:actorId},operations:['applyConstitution'],targetScopes:[{kind:'PROJECT',projectId}],disposition:'AUTO',limitPolicyRef:null,expiresAt:expires.toISOString()}];policyRef.contentHash=hash({rules,reason:'같은 사람 명시 적용',reviewRefs:[]});
 const commands:any[]=[],applications:any[]=[],receipts:any[]=[],calls:{sql:string;args:any[];tx:number}[]=[];let transaction=0,active=false,controlled=true,policyVersion=1;
 function stored(version:number,oldActor=actorId){
  const command={schemaVersion:1,projectId,commandId:uuid(100+version),clientId:oldActor===actorId?clientId:uuid(90),controlGeneration:1,operation:'applyConstitution',targetId:projectId,expectedVersion:version-1,baselineRefs:[],approvalRef:null,payload:{versionRef:{id:uuid(10+version),version:1,contentHash:'a'.repeat(64)},confirmationId:uuid(20+version),reason:'확정 헌법 별도 적용 '+version,acknowledged:true}};
  const previous=applications.at(-1),application={projectId,...command.payload,reviewRef:{id:uuid(30+version),targetRef:command.payload.versionRef,criteriaVersion:1,outcome:'ACCEPTED'},previousApplicationRef:previous?{id:projectId,version:version-1,contentHash:previous.content_hash}:null,appliedBy:{kind:'HUMAN',userId:oldActor,clientId:command.clientId},controlGeneration:1},ref={id:projectId,version,contentHash:hash(application)},result={operationId:uuid(40+version),commandId:command.commandId,projectId,status:'APPLIED',targetId:projectId,version,data:{ref,status:'CONSTITUTION_APPLIED',application},evidenceRefs:[],warnings:[],serverReceivedAt:now.toISOString()},scopeDigest=hash({projectId,actorId:oldActor,clientId:command.clientId,controlGeneration:1,requestHash:hash(command),policyRef,targetRef:ref});
  const c={id:uuid(50+version),scope_kind:'PROJECT',scope_id:projectId,project_id:projectId,operation_id:result.operationId,operation:command.operation,actor_id:oldActor,client_id:command.clientId,command_id:command.commandId,request_hash:hash(command),state:'APPLIED',expected_version:version-1,control_generation:1,policy_ref:structuredClone(policyRef),result_ref:result,authorization_receipt_id:uuid(60+version)};
  applications.push({project_id:projectId,application_version:version,content_hash:ref.contentHash,entry_id:command.payload.versionRef.id,version:1,confirmation_id:command.payload.confirmationId,snapshot_json:application,applied_by:oldActor,client_id:command.clientId,command_id:c.id,created_at:now});commands.push(c);receipts.push({id:c.authorization_receipt_id,command_id:c.id,scope_kind:'PROJECT',scope_id:projectId,subject_ref:{kind:'HUMAN',userId:oldActor,clientId:command.clientId},policy_ref:structuredClone(policyRef),scope_digest:scopeDigest});return{command,c,result,ref};
 }
 const first=stored(1,versionOne?actorId:uuid(91)),second=stored(2),original=versionOne?first:second;stored(3); // 직전 작성자와 이후 head가 달라도 원 v2 replay가 기준이다.
 const db={release(){assert(!active);},query:async(sql:string,args:any[]=[])=>{
  if(sql==='BEGIN'){assert(!active);active=true;transaction++;return{rows:[],command:'BEGIN'};}assert(active,'보호 조회는 원 authenticated 거래 안에서만');calls.push({sql,args:structuredClone(args),tx:transaction});if(sql==='COMMIT'||sql==='ROLLBACK'){active=false;return{rows:[],command:sql};}
  if(sql.includes('FROM anvil.auth_sessions')){assert.equal(args[0],contentHash(token));return{rows:[{id:uuid(70),uid:actorId,client_id:clientId,server_owner:false,user_status:'ACTIVE',revoked_at:null,user_revoked_at:null,client_revoked_at:null,credential_generation:1,current_generation:1,idle_expires_at:expires,absolute_expires_at:expires,reauth_until:expires,csrf_digest:contentHash(csrf)}]};}
  if(sql.includes('JOIN anvil.project_members'))return{rows:[{id:projectId,participation:'OWNER',archived_at:null}]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{actor_id:actorId,client_id:clientId,generation:controlled?1:2,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:[{id:policyRef.id,head_version:policyVersion,rules_json:rules,reason:'같은 사람 명시 적용',review_refs:[],content_hash:policyRef.contentHash,created_at:now}]};
  if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return{rows:commands.filter(c=>c.project_id===args[0]&&c.actor_id===args[1]&&c.command_id===args[2]).map(c=>({operation:c.operation,request_hash:c.request_hash,result_ref:structuredClone(c.result_ref)}))};
  if(sql.includes('FROM anvil.constitution_applications a'))return{rows:applications.filter(a=>a.project_id===args[0]&&a.application_version===args[1]).flatMap(a=>{
   const c=commands.find(c=>c.id===a.command_id&&c.project_id===a.project_id),r=receipts.find(r=>r.id===c?.authorization_receipt_id&&r.command_id===c.id&&canonicalJson(r.policy_ref)===canonicalJson(c.policy_ref));
   return c&&r?[{...structuredClone(a),command_state:c.state,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,control_generation:c.control_generation,expected_version:c.expected_version,policy_ref:c.policy_ref,result_ref:c.result_ref,external_command_id:c.command_id,request_hash:c.request_hash,command_scope_kind:c.scope_kind,command_scope_id:c.scope_id,command_operation_id:c.operation_id,receipt_scope_kind:r.scope_kind,receipt_scope_id:r.scope_id,receipt_subject:r.subject_ref,receipt_scope_digest:r.scope_digest}]:[];
  })};
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes('SERVER_DENIAL'))return{rows:[]};
  assert.fail('미허용 SQL: '+sql);
 }};
 const repository=new AccessRepository({connect:async()=>db} as unknown as Pool,{installationId:uuid(80),key:Buffer.alloc(32,1)}),app=buildApp({},undefined,{repository,origin});
 return{app,original,commands,applications,receipts,calls,policyRef,rules,policyHead(disposition='AUTO'){policyVersion++;rules[0]!.ruleId='CURRENT_HEAD';rules[0]!.disposition=disposition;policyRef.contentHash=hash({rules,reason:'같은 사람 명시 적용',reviewRefs:[]});},controlled(v:boolean){controlled=v;},send:(command=original.command)=>app.inject({method:'POST',url:'/api/v1/projects/'+projectId+'/commands',headers:{host:'localhost:3830',origin,cookie:'__Host-anvil.sid='+token,'x-anvil-csrf':csrf,'idempotency-key':command.commandId},payload:command})};
}
for(const mode of ['missing','corrupt','crossCommand','coherentCrossCommand','resultCommand','operationId','commandScope','control','duplicate','previousHash','receiptScope'] as const)test('헌법 실제 route 원명령 replay는 '+mode+' 원 불변 자료를 확정으로 반환하지 않는다',async()=>{
 const f=replayFixture();try{
  if(mode==='missing')f.applications.splice(1,1);
  if(mode==='corrupt')f.applications[1].snapshot_json.reason='손상';
  if(mode==='crossCommand')f.applications[1].command_id=f.commands[2].id;
  if(mode==='coherentCrossCommand'){const c=structuredClone(f.commands[1]),receipt=structuredClone(f.receipts[1]);c.id=uuid(201);c.command_id=uuid(202);c.result_ref.commandId=c.command_id;c.authorization_receipt_id=uuid(203);c.request_hash=hash({...f.original.command,commandId:c.command_id});receipt.scope_digest=hash({projectId:c.project_id,actorId:c.actor_id,clientId:c.client_id,controlGeneration:c.control_generation,requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:c.result_ref.data.ref});receipt.id=c.authorization_receipt_id;receipt.command_id=c.id;f.commands.push(c);f.receipts.push(receipt);f.applications[1].command_id=c.id;}
  if(mode==='resultCommand')f.original.result.commandId=uuid(204);
  if(mode==='operationId')f.original.result.operationId=uuid(206);
  if(mode==='commandScope')f.commands[1].scope_id=uuid(207);
  if(mode==='control'){f.applications[1].snapshot_json.controlGeneration=2;f.commands[1].control_generation=2;f.applications[1].content_hash=hash(f.applications[1].snapshot_json);f.original.result.data.ref.contentHash=f.applications[1].content_hash;f.receipts[1].scope_digest=hash({projectId:f.original.command.projectId,actorId:f.commands[1].actor_id,clientId:f.commands[1].client_id,controlGeneration:1,requestHash:hash(f.original.command),policyRef:f.policyRef,targetRef:f.original.result.data.ref});}
  if(mode==='duplicate')f.applications.push(structuredClone(f.applications[1]));
  if(mode==='previousHash'){
   const row=f.applications[1];row.snapshot_json.previousApplicationRef.contentHash='f'.repeat(64);row.content_hash=hash(row.snapshot_json);f.original.result.data.ref.contentHash=row.content_hash;
   f.receipts[1].scope_digest=hash({projectId:f.original.command.projectId,actorId:f.commands[1].actor_id,clientId:f.commands[1].client_id,controlGeneration:1,requestHash:hash(f.original.command),policyRef:f.policyRef,targetRef:f.original.result.data.ref});
  }
  if(mode==='receiptScope')f.receipts[1].scope_digest='f'.repeat(64);
  const response=await f.send();assert.equal(response.statusCode,503);assert.equal(response.json().code,'CONSTITUTION_INTEGRITY_FAILED');assert.equal(f.calls.filter(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)).length,0);assert.equal(f.calls.some(c=>c.sql==='ROLLBACK'),true);
 }finally{await f.app.close();}
});
test('헌법 실제 route 원 v2 replay는 v3 head·다른 직전 작성자와 관계없이 원 결과이며 새 쓰기0이다',async()=>{
 const f=replayFixture();try{const response=await f.send();assert.equal(response.statusCode,200);assert.deepEqual(response.json(),f.original.result);assert.deepEqual(f.calls.filter(c=>c.sql.includes('FROM anvil.constitution_applications a')).map(c=>c.args),[[f.original.command.projectId,2],[f.original.command.projectId,1]]);assert.equal(new Set(f.calls.map(c=>c.tx)).size,1);assert.equal(f.calls.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)),false);assert.equal(f.calls.some(c=>c.sql.includes('project_constitutions')||c.sql.includes('knowledge_versions')),false);}finally{await f.app.close();}
});


test('헌법 과거 replay의 원 v1·null 이전 참조와 현재 다른 AUTO 정책 head도 원 결과로만 재확인한다',async()=>{
 const f=replayFixture(true);f.policyHead();try{const response=await f.send();assert.equal(response.statusCode,200);assert.deepEqual(response.json(),f.original.result);assert.equal(response.json().data.application.previousApplicationRef,null);assert.deepEqual(f.calls.filter(c=>c.sql.includes('FROM anvil.constitution_applications a')).map(c=>c.args),[[f.original.command.projectId,1]]);assert.equal(f.calls.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)),false);}finally{await f.app.close();}
});
for(const mode of ['policy','generation','client'] as const)test('헌법 replay도 기존 현재 '+mode+' 거절을 우회하지 않고 원 자료 조회0이다',async()=>{
 const f=replayFixture();if(mode==='policy')f.policyHead('DENY');if(mode==='generation')f.controlled(false);const command=structuredClone(f.original.command);if(mode==='client')command.clientId=uuid(205);
 try{const response=await f.send(command);assert.equal(response.statusCode,mode==='generation'?409:403);assert.equal(f.calls.some(c=>c.sql.includes('FROM anvil.constitution_applications a')),false);assert.equal(f.calls.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)&&!c.sql.includes('SERVER_DENIAL')),false);assert.equal(f.commands.length,3);assert.equal(f.applications.length,3);}finally{await f.app.close();}
});
