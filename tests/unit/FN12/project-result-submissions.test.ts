import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {materialRules} from '../../../apps/server/modules/access/project-command.ts';
import {pgExecutionFixture} from './result-execution-pg-fixture.ts';
const mod:any=await import('../../../apps/server/modules/results/project-result-submissions.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,hash=(v:unknown)=>contentHash(canonicalJson(v)),at='2026-10-19T08:30:00.000Z';
function fixture(){
 const f=pgExecutionFixture(),actor:any={actorId:id(1),clientId:id(2),credentialGeneration:3,authSession:{id:id(2),idleExpiresAt:'2026-10-19T09:00:00.000Z',absoluteExpiresAt:'2026-10-19T10:00:00.000Z'}},submissionId=id(50),manifest={assignmentRef:f.scope.assignmentRef,executionRef:f.scope.executionRef,baselineRefs:[],submissionState:'INCOMPLETE',changes:[],commandResults:[],testResults:[],artifactRefs:[],unexecuted:[],risks:[],rollback:'원문 보존',checkpointRef:null};
 const request:any={schemaVersion:1,projectId:f.scope.projectId,commandId:id(51),clientId:actor.clientId,controlGeneration:2,operation:'submitResult',targetId:submissionId,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{scope:f.scope,submissionId,manifest}};
 const rule={ruleId:'results',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['submitResult'],targetScopes:[{kind:'PROJECT',projectId:f.scope.projectId}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-10-19T09:00:00.000Z'},policy={id:id(52),head_version:1,rules_json:[rule],reason:'결과 제출',review_refs:[],content_hash:hash({rules:[rule],reason:'결과 제출',reviewRefs:[]})};
 let row:any=null,member=true,head:any={...policy,created_at:new Date(at)},now=at;const calls:any[]=[];
 const db:any={query:async(sql:string,p:any[]=[])=>{calls.push({sql,p});
  if(sql.includes('AS execution,to_jsonb(q)'))return f.db.query(sql,p);
  if(sql.includes('JOIN anvil.project_members'))return{rows:member?[{id:f.scope.projectId,archived_at:null,participation:'OWNER'}]:[]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{actor_id:actor.actorId,client_id:actor.clientId,generation:2,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:head?[head]:[]};
  if(sql.includes('transaction_timestamp()')||sql.includes('clock_timestamp()'))return{rows:[{at:new Date(now)}]};
  if(sql.startsWith('SELECT')&&sql.includes('FROM anvil.result_submissions'))return{rows:row?[structuredClone(row)]:[]};
  if(sql.startsWith('INSERT INTO anvil.result_submissions')){assert.equal(row,null);row={project_id:p[0],id:p[1],execution_id:p[2],generation:p[3],assignment_ref:JSON.parse(p[4]),execution_ref:JSON.parse(p[5]),manifest_ref:JSON.parse(p[6]),manifest_hash:p[7],submission_state:p[8],submitted_by:p[9],client_id:p[10],command_id:p[11],content_hash:p[12],snapshot_json:JSON.parse(p[13]),submitted_at:new Date(p[14])};return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.commands')||sql.startsWith('INSERT INTO anvil.authorization_receipts')||sql.startsWith('INSERT INTO anvil.audit_events')||sql.startsWith('SELECT set_config'))return{rows:[],rowCount:1};
  throw Error('UNEXPECTED_QUERY:'+sql);
 }};
 return{...f,actor,request,policy,db,calls,row:()=>row,setRow:(v:any)=>row=v,member:(v:boolean)=>member=v,policyHead:(v:any)=>head=v,now:(v:string)=>now=v};
}
function service(){assert.equal(typeof mod.ProjectResultSubmissions,'function','결과 제출의 PG 저장/조회 구현 누락');return new mod.ProjectResultSubmissions();}
test('계획된submitResult는자동허가가아니라명시정책등록가능연산이다',()=>{const f=fixture();assert.equal(materialRules(f.policy.rules_json,f.scope.projectId,f.actor.actorId,new Date(at))[0]!.operations[0],'submitResult');});
test('현재제어/명시정책과원실행에결박해manifest/원영수증을저장하고원문을조회한다',async()=>{
 const f=fixture(),s=service(),value=await s.submit(f.db,f.actor,f.request,{id:f.policy.id,version:1,contentHash:f.policy.content_hash});assert.equal(value.data.status,'RESULT_SUBMITTED');assert.deepEqual(f.row().snapshot_json.manifest,f.request.payload.manifest);assert.equal(f.row().snapshot_json.sourceKind,'WORKER_CLAIM');assert.equal(f.row().snapshot_json.completionAccepted,false);assert.equal(f.row().snapshot_json.executionAuthorized,false);assert.equal(f.row().manifest_hash,hash(f.request.payload.manifest));
 const before=f.calls.filter(c=>c.sql.startsWith('INSERT')).length,read=await s.read(f.db,f.actor,f.scope.projectId,f.request.targetId);assert.deepEqual(read.snapshot.manifest,f.request.payload.manifest);assert.equal(f.calls.filter(c=>c.sql.startsWith('INSERT')).length,before);assert.equal(read.ref.contentHash,hash(read.snapshot));read.snapshot.manifest.rollback='반환값 변경';assert.equal(f.row().snapshot_json.manifest.rollback,'원문 보존');
});
test('명시정책부재/권한·세션만료/중복ID·원실행불일치는저장하지않는다',async()=>{
 for(const alter of [(f:any)=>f.policyHead(null),(f:any)=>f.member(false),(f:any)=>f.actor.authSession.idleExpiresAt='2026-10-19T08:00:00.000Z',(f:any)=>f.scope.executionRef.contentHash='f'.repeat(64)]){
  const f=fixture();alter(f);await assert.rejects(service().submit(f.db,f.actor,f.request,{id:f.policy.id,version:1,contentHash:f.policy.content_hash}));assert.equal(f.row(),null);
 }
 const f=fixture(),s=service();await s.submit(f.db,f.actor,f.request,{id:f.policy.id,version:1,contentHash:f.policy.content_hash});await assert.rejects(s.submit(f.db,f.actor,f.request,{id:f.policy.id,version:1,contentHash:f.policy.content_hash}),/RESULT_SUBMISSION_ID_CONFLICT/);assert.equal(f.calls.filter(c=>c.sql.startsWith('INSERT INTO anvil.result_submissions')).length,1);
});
test('다른프로젝트/멤버회수·저장hash손상은조회로노출하지않는다',async()=>{
 for(const alter of [(f:any)=>f.member(false),(f:any)=>f.row().snapshot_json.manifest.rollback='손상',(f:any)=>f.row().project_id=id(80)]){const f=fixture(),s=service();await s.submit(f.db,f.actor,f.request,{id:f.policy.id,version:1,contentHash:f.policy.content_hash});alter(f);await assert.rejects(s.read(f.db,f.actor,f.scope.projectId,f.request.targetId));}
});
