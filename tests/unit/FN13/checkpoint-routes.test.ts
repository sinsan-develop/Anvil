import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes,randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {buildApp} from '../../../apps/server/app.ts';import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {checkpointFixture} from './checkpoint-fixture.ts';
import {criteriaId as id} from '../FN12/result-criteria-fixture.ts';
import {readAssignmentDraftInput} from '../../../apps/server/modules/assignments/assignment-input.ts';
import {assignmentContentCriteria} from '../../../apps/server/modules/assignments/assignment-confirmation-input.ts';
import {prepareCheckpointDraft} from '../../../apps/server/modules/checkpoints/checkpoint-input.ts';
import {createCheckpointRecord} from '../../../apps/server/modules/checkpoints/checkpoint-record.ts';
test('FN13 중지이력 HUMAN/host/query/실행credential 경계는 조회전거절',async()=>{const id=randomUUID(),pool=new Pool({host:'127.0.0.1',port:1,connectionTimeoutMillis:50}),repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository,origin:'https://localhost:3830'}),path=`/api/v1/projects/${id}/results/${id}/stop-requests`;try{for(const[url,headers,status]of[[path,{host:'localhost:3830'},401],[path,{host:'other.invalid'},403],[path+'?stop=true',{host:'localhost:3830'},400],[path,{host:'localhost:3830',authorization:'Bearer av3ex1_'+'x'.repeat(43)},401]]as const){const r=await app.inject({method:'GET',url,headers});assert.equal(r.statusCode,status,r.body);assert.equal(r.headers['cache-control'],'no-store');}assert.equal(pool.totalCount,0);}finally{await app.close();await pool.end();}});
test('FN13 보관 관측조회는 HUMAN·같은host·무query이며 실행credential을 허용하지 않음',async()=>{const id=randomUUID(),origin='https://localhost:3830',pool=new Pool({host:'127.0.0.1',port:1,connectionTimeoutMillis:50}),repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository,origin}),path=`/api/v1/projects/${id}/results/${id}/observation-journal`;try{for(const[url,h,status]of[[path,{host:'localhost:3830'},401],[path,{host:'other.invalid'},403],[path+'?current=true',{host:'localhost:3830'},400],[path,{host:'localhost:3830',authorization:'Bearer av3ex1_'+'x'.repeat(43)},401]]as const){const response=await app.inject({method:'GET',url,headers:h});assert.equal(response.statusCode,status,response.body);}assert.equal(pool.totalCount,0);}finally{await app.close();await pool.end();}});
test('FN13 기록 준비는 HUMAN·CSRF·동일origin/host만 허용하고 실행/query 우회를 거절',async()=>{
 const id=randomUUID(),origin='https://localhost:3830',pool=new Pool({host:'127.0.0.1',port:1,connectionTimeoutMillis:50}),repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository,origin}),path=`/api/v1/projects/${id}/checkpoints/prepare`,body={assignmentRef:{id,version:1,contentHash:'a'.repeat(64)},input:{}},headers={host:'localhost:3830',origin,'x-anvil-csrf':'C'.repeat(43)};
 try{for(const[url,h,status]of[[path,headers,401],[path,{...headers,'x-anvil-csrf':undefined},403],[path,{...headers,host:'other.invalid'},403],[path,{...headers,origin:'https://other.invalid'},403],[path+'?resume=true',headers,400],[path,{...headers,authorization:'Bearer av3ct1_'+'x'.repeat(43)},403]]as const){const r=await app.inject({method:'POST',url,headers:Object.fromEntries(Object.entries(h).filter(([,v])=>v!==undefined)) as Record<string,string>,payload:body});assert.equal(r.statusCode,status,r.body);assert.equal(r.headers['cache-control'],'no-store');}assert.equal(pool.totalCount,0);}finally{await app.close();await pool.end();}
});

test('FN13 저장기록 fixed/list 소비선은 인증 전 DB 연결 없이 보호 GET으로 존재',async()=>{
 const id=randomUUID(),pool=new Pool({host:'127.0.0.1',port:1,connectionTimeoutMillis:50}),repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});
 try{for(const url of [`/api/v1/projects/${id}/checkpoints/${id}`,`/api/v1/projects/${id}/checkpoints?assignmentId=${id}&assignmentVersion=1&assignmentHash=${'a'.repeat(64)}&limit=20`]){const r=await app.inject({method:'GET',url,headers:{host:'localhost:3830'}});assert.equal(r.statusCode,401,r.body);assert.equal(r.headers['cache-control'],'no-store');}assert.equal(pool.totalCount,0);}finally{await app.close();await pool.end();}
});
test('FN13 목록 exact MAX_SAFE 임무버전은 schema에서 잘리지 않고 인증401',async()=>{const id=randomUUID(),pool=new Pool({host:'127.0.0.1',port:1,connectionTimeoutMillis:50}),repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});try{const r=await app.inject({method:'GET',url:`/api/v1/projects/${id}/checkpoints?assignmentId=${id}&assignmentVersion=9007199254740991&assignmentHash=${'a'.repeat(64)}`,headers:{host:'localhost:3830'}});assert.equal(r.statusCode,401,r.body);assert.equal(pool.totalCount,0);}finally{await app.close();await pool.end();}});

test('FN13 실제 인증 목록 GET과 발급 cursor 다음 GET은 보관 이력을 보호 검산하고 쓰기 없이 반환한다',async()=>{
 const f=checkpointFixture(),pid=f.assignment.projectId,uid=f.by.userId,cid=f.by.clientId;
 const hash=(v:unknown)=>contentHash(canonicalJson(v)),calls:string[]=[],token='T'.repeat(43);
 const analysis=readAssignmentDraftInput({baseRef:null,definition:f.d,reason:'합성 과거 임무'});
 const draftSnapshot={definition:analysis.input.definition,reason:analysis.input.reason,previousRef:null,
  basis:{planRef:f.d.taskRef.planRef,applicationRef:f.d.taskRef.applicationRef,designRef:f.d.baselineRefs[0],taskCode:f.d.taskRef.taskCode,nodeId:f.d.taskRef.nodeId,taskCardHash:'b'.repeat(64)},
  readinessIssues:analysis.readinessIssues,status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const draftRef={id:f.assignment.ref.id,version:1,contentHash:hash(draftSnapshot)};
 const reviewSnapshot={draftRef,criteriaVersion:1,items:assignmentContentCriteria.map(criterionId=>({criterionId,outcome:'ACCEPTED',reason:'보관 검토',evidenceRefs:[]})),
  outcome:'ACCEPTED',reason:'보관된 합성 검토',reviewedBy:{kind:'HUMAN',userId:uid},reviewedAt:f.at,independence:'NOT_CLAIMED'};
 const reviewRef={id:id(103),version:1,contentHash:hash(reviewSnapshot)};
 const snapshot={...f.assignment.snapshot,draftRef,definition:draftSnapshot.definition,reviewRefs:[reviewRef],
  confirmedBy:{kind:'HUMAN',userId:uid},readinessIssues:draftSnapshot.readinessIssues};
 const assignment={...f.assignment,ref:{...f.assignment.ref,contentHash:hash(snapshot)},snapshot};
 const sourceRow=(operation:string,status:string,ref:unknown,snapshot:unknown)=>({
  project_id:pid,created_by:uid,client_id:cid,command_actor:uid,command_client:cid,operation,state:'APPLIED',
  result_ref:{status:'APPLIED',projectId:pid,data:{status,ref,snapshot}},
 });
 const draftRow={...sourceRow('prepareAssignment','ASSIGNMENT_DRAFT_STORED',draftRef,draftSnapshot),
  draft_id:draftRef.id,version:1,head_version:1,content_hash:draftRef.contentHash,version_json:draftSnapshot,expected_version:0};
 const confirmedRow={...sourceRow('confirmAssignment','ASSIGNMENT_CONTENT_CONFIRMED',assignment.ref,snapshot),
  assignment_id:assignment.ref.id,version:1,content_hash:assignment.ref.contentHash,version_json:snapshot,expected_version:1,confirmation_id:id(104)};
 Object.assign(confirmedRow.result_ref.data,{confirmationId:confirmedRow.confirmation_id});
 const reviewRow={...sourceRow('reviewAssignmentContent','ASSIGNMENT_CONTENT_REVIEWED',reviewRef,reviewSnapshot),
  review_id:reviewRef.id,draft_id:draftRef.id,draft_version:1,draft_hash:draftRef.contentHash,content_hash:reviewRef.contentHash,
  review_json:reviewSnapshot,expected_version:1,server_sequence:'1',draft_author:uid};
 const policyRef={id:id(105),version:1,contentHash:'c'.repeat(64)};
 const records:any[]=[];
 for(let n=0;n<2;n++){
  const previous=records.at(-1),input={...structuredClone(f.input),baseRef:previous?{id:previous.id,version:1,contentHash:previous.content_hash}:null};
  input.state.assignmentRef=assignment.ref;
  const record=createCheckpointRecord(prepareCheckpointDraft(assignment,input),f.by,f.at);
  const ref={id:id(110+n),version:1,contentHash:hash(record.snapshot)};
  const command={schemaVersion:1,projectId:pid,commandId:id(120+n),clientId:cid,controlGeneration:1,operation:'saveCheckpoint',
   targetId:assignment.ref.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:input};
  const requestHash=hash(command),scopeDigest=hash({projectId:pid,actorId:uid,clientId:cid,controlGeneration:1,requestHash,policyRef,targetRef:ref});
  records.push({project_id:pid,id:ref.id,assignment_id:assignment.ref.id,assignment_version:1,assignment_hash:assignment.ref.contentHash,
   previous_id:input.baseRef?.id??null,previous_hash:input.baseRef?.contentHash??null,content_hash:ref.contentHash,snapshot_json:record.snapshot,record_text:record.recordText,
   created_by:uid,client_id:cid,command_id:id(130+n),created_at:new Date(f.at),original_command_id:command.commandId,source_operation_id:id(140+n),
   operation:'saveCheckpoint',state:'APPLIED',actor_id:uid,command_client_id:cid,expected_version:1,control_generation:1,
   request_hash:requestHash,policy_ref:policyRef,authorization_receipt_id:id(150+n),receipt_subject:{kind:'HUMAN',userId:uid,clientId:cid},
   receipt_policy_ref:policyRef,scope_digest:scopeDigest,approval_decision_ref:null,audit_count:1,chain_count:1,server_sequence:String(n+1),
   result_ref:{status:'APPLIED',commandId:command.commandId,projectId:pid,operationId:id(140+n),targetId:ref.id,version:1,serverReceivedAt:f.at,
    data:{ref,status:'CHECKPOINT_RECORDED',snapshot:record.snapshot,checkpointStored:true,recordFileStored:false,currentFactsVerified:false,
     writerReleaseVerified:false,resumeAuthorized:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false}}});
 }
 // 인증·임무·원 command/receipt/audit의 저장 행만 메모리로 공급한다. 실제 보호 reader를 교체하지 않는다.
 const db={async query(sql:string,args:unknown[]=[]){
  calls.push(sql);
  if(sql==='BEGIN'||sql==='ROLLBACK'||sql==='COMMIT')return {rows:[],command:sql};
  if(sql.startsWith('SELECT s.*,u.id AS uid')){
   assert.equal(args.length,1);assert.equal(args[0],contentHash(token));
   return {rows:[{id:id(160),uid,client_id:cid,server_owner:false,user_status:'ACTIVE',credential_generation:1,current_generation:1,
    revoked_at:null,user_revoked_at:null,client_revoked_at:null,reauth_until:null,idle_expires_at:new Date('2099-01-01'),absolute_expires_at:new Date('2099-01-02')}]};
  }
  if(sql.includes('JOIN anvil.project_members')){
   assert.deepEqual(args,[pid,uid]);return {rows:[{id:pid,participation:'OWNER',archived_at:null}]};
  }
  if(sql==='SELECT clock_timestamp() AS at')return {rows:[{at:new Date(f.at)}]};
  if(sql.includes('FROM anvil.assignment_versions v')){
   assert.deepEqual(args,[pid,assignment.ref.id,1]);return {rows:[structuredClone(confirmedRow)]};
  }
  if(sql.includes('FROM anvil.assignment_draft_versions v')){
   assert.deepEqual(args,[pid,draftRef.id,1]);return {rows:[structuredClone(draftRow)]};
  }
  if(sql.includes('FROM anvil.assignment_content_reviews r')){
   assert.deepEqual(args,[pid,reviewRef.id]);return {rows:[structuredClone(reviewRow)]};
  }
  if(sql.startsWith('SELECT v.id FROM anvil.checkpoint_records v LEFT JOIN')){
   assert.deepEqual(args,[pid,assignment.ref.id,1,assignment.ref.contentHash]);return {rows:[]};
  }
  if(sql.startsWith('SELECT MAX(a.server_sequence)')){
   assert.deepEqual(args,[pid,assignment.ref.id,1,assignment.ref.contentHash]);return {rows:[{upper:'2'}]};
  }
  if(sql.startsWith('SELECT v.id,a.server_sequence')){
   assert.deepEqual(args.slice(0,5),[pid,assignment.ref.id,1,assignment.ref.contentHash,2]);assert.equal(args[6],2);
   assert.ok(args[5]===null||args[5]===2);
   return {rows:records.filter(row=>args[5]===null||Number(row.server_sequence)<Number(args[5])).toReversed().map(row=>({id:row.id,server_sequence:row.server_sequence}))};
  }
  if(sql.includes('FROM anvil.checkpoint_records v')){
   assert.equal(sql.endsWith('WHERE v.project_id=$1 AND v.id=$2 LIMIT 2'),true);
   assert.equal(args[0],pid);return {rows:records.filter(row=>row.id===args[1]).map(row=>structuredClone(row))};
  }
  throw Error('UNSUPPORTED_CHECKPOINT_ROUTE_SQL');
 },release(){}};
 const pool={async connect(){return db;}} as unknown as Pool;
 const repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)});
 const app=buildApp({},undefined,{repository,origin:'https://localhost:3830'}),base='/api/v1/projects/'+pid+'/checkpoints';
 const query=new URLSearchParams({assignmentId:assignment.ref.id,assignmentVersion:'1',assignmentHash:assignment.ref.contentHash,limit:'1'});
 const headers={host:'localhost:3830',cookie:'__Host-anvil.sid='+token};
 try{
  const first=await app.inject({method:'GET',url:base+'?'+query,headers});
  assert.equal(first.statusCode,200,first.body);
  const page=first.json();assert.equal(page.items.length,1);assert.equal(page.items[0].ref.id,records[1].id);assert.equal(page.hasMore,true);assert.equal(typeof page.nextCursor,'string');
  query.set('cursor',page.nextCursor);
  const second=await app.inject({method:'GET',url:base+'?'+query,headers});
  assert.equal(second.statusCode,200,second.body);
  assert.equal(second.json().items[0].ref.id,records[0].id);assert.equal(second.json().hasMore,false);assert.equal(second.json().nextCursor,null);
  const before=calls.length;
  const extra=await app.inject({method:'GET',url:base+'?'+query+'&unexpected=true',headers});
  assert.equal(extra.statusCode,400,extra.body);assert.equal(calls.length,before);
  const anonymous=await app.inject({method:'GET',url:base+'?'+query,headers:{host:'localhost:3830'}});
  assert.equal(anonymous.statusCode,401);assert.equal(calls.length,before);
  assert.equal(calls.some(sql=>/^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE)\b/.test(sql)),false);
  assert.equal(calls.filter(sql=>sql==='COMMIT').length,2);
 }finally{await app.close();}
});
