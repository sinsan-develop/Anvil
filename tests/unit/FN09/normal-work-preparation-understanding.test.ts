import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {fixture as base} from '../FN08/execution-preparation.test.ts';
import * as normal from '../../../apps/server/modules/executions/normal-understanding-review.ts';
const id=(n:number)=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(){
 const at=Date.now(),pid=id(1),actor:any={actorId:id(2),clientId:id(3),credentialGeneration:1,serverOwner:false,reauthUntil:new Date(at+60000),authSession:{id:id(4),idleExpiresAt:new Date(at+60000).toISOString(),absoluteExpiresAt:new Date(at+60000).toISOString()}};
 const input={projectId:pid,mode:'WORK',connectionKind:'REGISTERED_DEFINITION',optionsFormat:'CLAUDE_QUERY_DATA_V1',assignmentRef:ref(5),roleBindingRef:ref(6),contextBundleRef:ref(7),connectionRef:ref(8),environmentRef:ref(9),capabilityRef:ref(10),budgetPolicyRef:ref(11),sourceScopes:[{sourceRootRef:ref(21),mappingRef:null,observationRef:ref(22),baselineRef:ref(23),targets:[{relativePath:'src/main.ts',kind:'FILE',access:'WRITE',recursive:false}]}],reason:'명시 검토 선택',understandingReviewRef:{...ref(12),version:2}};
 const q:any={schemaVersion:1,projectId:pid,commandId:id(13),clientId:actor.clientId,controlGeneration:1,operation:'prepareExecution',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:input};
 const basis:any={kind:'NORMAL_UNDERSTANDING_WORK_BASIS',reviewRef:input.understandingReviewRef,scope:{projectId:pid,executionId:id(14),executionGeneration:1},preparationRef:ref(15),assignmentRef:input.assignmentRef,roleBindingRef:input.roleBindingRef,agentSessionRef:ref(16),contextBundleRef:input.contextBundleRef,connectionRef:input.connectionRef,environmentRef:input.environmentRef,responseRef:ref(17),requestRef:ref(18),basisRefs:[ref(19)],latestInstructionRefs:[]};
 const projection:any={status:'WORK_PREPARATION_BASIS',basis,checkedAt:new Date(at).toISOString(),expiresAt:new Date(at+20000).toISOString()};let writes=0,reads=0;
 const db:any={query:async(sql:string,p:any[])=>{if(sql.includes('clock_timestamp()'))return {rows:[{at:new Date(at),tx:'42'}]};if(sql.includes('fn09_normal_understanding_metadata_current')){reads++;assert.equal(p[0],actor.authSession.id);assert.deepEqual(JSON.parse(p[3]),{purpose:'WORK_PREPARATION_BASIS',projectId:pid,command:q});assert.deepEqual(JSON.parse(p[4]),ref(20));assert.equal(p[5],'42');return {rows:[{projection:structuredClone(projection)}]};}writes++;throw Error('WRITE0');}};
 const read=()=>{assert.equal(typeof (normal as any).readNormalWorkPreparationBasis,'function');return (normal as any).readNormalWorkPreparationBasis(db,actor,q,ref(20));};
 return{actor,q,basis,projection,db,read,get writes(){return writes;},get reads(){return reads;}};
}
test('WORK 준비 근거는 같은 인증 거래의 명시 목적에서 refs만 검산하고 원 명령을 바꾸지 않는다',async()=>{const f=fixture(),before=canonicalJson(f.q),b=await f.read();assert.deepEqual(b,f.basis);assert.notEqual(b,f.basis);assert.equal(canonicalJson(f.q),before);assert.equal(f.reads,1);assert.equal(f.writes,0);assert.equal('body' in b,false);assert.equal('executionAuthorized' in b,false);});
test('WORK 준비 근거의 선택·원 임무/역할/맥락/도구/환경·수명·원형 오염은 저장 전 거절한다',async()=>{
 for(const key of ['reviewRef','assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef']){const f=fixture();f.projection.basis[key]={...ref(99)};await assert.rejects(f.read());assert.equal(f.writes,0);}
 for(const change of [(v:any)=>v.basis.scope.projectId=id(99),(v:any)=>v.basis.raw='원문',(v:any)=>v.basis.executionAuthorized=true,(v:any)=>v.expiresAt=v.checkedAt,(v:any)=>v.status='ACCEPTED']){const f=fixture();change(f.projection);await assert.rejects(f.read());assert.equal(f.writes,0);}
});


test('실제 준비 저장은 같은 선택을 명령·정산·분리 snapshot에 결박하고 기존 실행 intent와 미허가를 보존한다',async()=>{
 const {ProjectExecutionPreparations}=await import('../../../apps/server/modules/executions/project-execution-preparations.ts');
 const {ProjectConnectionDefinitions}=await import('../../../apps/server/modules/connections/project-connection-definitions.ts');
 const {ProjectEnvironments}=await import('../../../apps/server/modules/connections/project-environments.ts');
 const {ProjectStorageQuota}=await import('../../../apps/server/modules/projects/project-storage-quota.ts');
 const f=fixture(),q=base(),old=q.db.query;
 Object.assign(q.actor,f.actor);q.assignment.projectId=f.q.projectId;q.binding.projectId=f.q.projectId;q.context.projectId=f.q.projectId;q.assignment.ref=f.q.payload.assignmentRef;q.assignment.snapshot.definition.allowedScopes=f.q.payload.sourceScopes;
 Object.assign(q.binding,{ref:f.q.payload.roleBindingRef,snapshot:{...q.binding.snapshot,assignmentRef:f.q.payload.assignmentRef,connectionRef:f.q.payload.connectionRef,connectionKind:'REGISTERED_DEFINITION',connectionReadiness:'REGISTERED_DEFINITION_ONLY'}});
 Object.assign(q.context,{ref:f.q.payload.contextBundleRef,manifest:{...q.context.manifest,assignmentRef:f.q.payload.assignmentRef,baselineRefs:[],constitutionRef:null,latestInstructionRefs:[],missingRequired:[]}});
 f.basis.basisRefs=[{id:'11111111-1111-4111-8111-111111111111',version:1,contentHash:'a'.repeat(64)}];
 let count=0,settled=0,reserved=0,captured:any,currentUnavailable=false;const replayRows:any[]=[];
 q.db.query=async(sql:string,p:any[])=>{
  if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:f.q.projectId,participation:'OWNER'}]};
  if(sql.startsWith('SELECT txid_current()::text AS transaction_id'))return{rows:[{transaction_id:'42',observed_at:new Date(f.projection.checkedAt)}]};
  if(sql.includes('clock_timestamp()'))return f.db.query(sql,p);
  if(sql.startsWith('SELECT * FROM anvil.fn09_registered_prepare_reserve')){reserved++;assert.deepEqual(JSON.parse(p[4]),f.q);captured=JSON.parse(p[6]);const ids=JSON.parse(p[8]);return{rows:[{reservation_id:ids.serverCommandId,transaction_id:'42',preparation_hash:JSON.parse(p[5]).contentHash,plan_hash:'b'.repeat(64),reserved_bytes:'2048',authorized_until:f.projection.expiresAt}]};}
  if(sql.startsWith('SELECT * FROM anvil.fn09_registered_prepare_settle')){assert.equal(q.rows.length,1);assert.deepEqual(JSON.parse(p[8]).data.snapshot,captured);settled++;return{rows:[{status:'SETTLED',reservation_id:p[5],transaction_id:'42',settled_bytes:'2048'}]};}
  if(sql.startsWith('INSERT INTO anvil.commands'))replayRows.push({operation:p[4],request_hash:p[6],result_ref:JSON.parse(p[14])});
  if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return{rows:replayRows};
  if(sql.includes('fn09_normal_understanding_metadata_current')){const selection=JSON.parse(p[3]);if(selection.purpose==='WORK_PREPARATION_BASIS'){count++;if(currentUnavailable)throw Error('old grant/transport expired: current read forbidden');}return{rows:[{projection:selection.purpose==='WORK_PREPARATION_HISTORY'?{status:'WORK_PREPARATION_HISTORY',basis:f.basis}:{...f.projection,basis:f.basis}}]};}
  if(sql.startsWith('SELECT txid_current()'))return{rows:[{tx:'42'}]};
  if(sql.startsWith('SELECT binding_id'))return{rows:[{binding_id:f.q.payload.roleBindingRef.id,version:1,content_hash:'a'.repeat(64)}]};
  return old(sql,p);
 };
 const handles=[mock.method(ProjectConnectionDefinitions.prototype,'read',async()=>({projectId:f.q.projectId,ref:f.q.payload.connectionRef,definition:{environmentRef:f.q.payload.environmentRef,adapterKind:'CLAUDE_AGENT_SDK',toolProduct:'Claude Code',modelOptions:{claudeQueryParams:{model:'auto'}}},currentStatus:{configurationCurrent:true}}) as any),mock.method(ProjectEnvironments.prototype,'read',async()=>({projectId:f.q.projectId,ref:f.q.payload.environmentRef,current:{configurationCurrentness:'MATCHED'}}) as any)];
 try{
  const store=new ProjectExecutionPreparations(q.store.assignments,q.store.drafts,q.store.sessions,q.store.contexts,q.store.candidates,{definitions:Object.create(ProjectConnectionDefinitions.prototype),environments:Object.create(ProjectEnvironments.prototype),quota:new ProjectStorageQuota({} as any)});
  for(const state of ['CHANGED','UNAVAILABLE']){q.context.currentCheck.state=state;await assert.rejects(store.save(q.db,q.actor,f.q,ref(20)),/WORK_PREPARATION_UNDERSTANDING_CHANGED/);assert.equal(q.rows.length,0);assert.equal(reserved,0);assert.equal(count,0);}
  q.context.currentCheck.state='MATCHED_METADATA';q.context.manifest.missingRequired=['LATEST_INSTRUCTIONS'];await assert.rejects(store.save(q.db,q.actor,f.q,ref(20)),/WORK_PREPARATION_UNDERSTANDING_CHANGED/);assert.equal(reserved,0);assert.equal(count,0);q.context.manifest.missingRequired=[];
  const result:any=await store.save(q.db,q.actor,f.q,ref(20));assert.equal(q.rows.length,1);assert.equal(settled,1);assert.equal(reserved,1);assert.equal(count,2);
  assert.deepEqual(result.data.snapshot.understandingBasis,f.basis);assert.equal('understandingReviewRef' in result.data.snapshot.intent,false);
  assert.equal(result.data.snapshot.authorizationState,'NOT_AUTHORIZED');assert.equal(result.data.snapshot.executionAuthorized,false);assert.equal(result.data.snapshot.dispatchPerformed,false);
  assert.ok(result.data.snapshot.missingConditions.includes('UNDERSTANDING_NOT_REVIEWED'));
  currentUnavailable=true;const {projectReplay}=await import('../../../apps/server/modules/access/project-command.ts');
  const recovered=await projectReplay(q.db,q.actor,f.q);assert.deepEqual(recovered,result);
  await assert.rejects(projectReplay(q.db,q.actor,{...f.q,payload:{...f.q.payload,understandingReviewRef:ref(99)}}),/IDEMPOTENCY_CONFLICT/);
  await store.verifyRegisteredReplay(q.db,q.actor,f.q,result);assert.equal(count,2);assert.equal(reserved,1);assert.equal(settled,1);assert.equal(q.rows.length,1);
  await assert.rejects(store.verifyRegisteredReplay(q.db,q.actor,{...f.q,payload:{...f.q.payload,understandingReviewRef:ref(99)}},result));assert.equal(settled,1);
 }finally{handles.forEach(h=>h.mock.restore());}
});
