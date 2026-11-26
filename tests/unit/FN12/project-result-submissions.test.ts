import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {materialRules} from '../../../apps/server/modules/access/project-command.ts';
import {pgExecutionFixture} from './result-execution-pg-fixture.ts';
import {ProjectListCodec} from '../../../apps/server/modules/projects/service.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {AccessRepository,AuthFailure} from '../../../apps/server/modules/access/repository.ts';
import type {Pool} from 'pg';
const mod:any=await import('../../../apps/server/modules/results/project-result-submissions.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,hash=(v:unknown)=>contentHash(canonicalJson(v)),at='2026-10-19T08:30:00.000Z';
function fixture(){
 const f=pgExecutionFixture(),actor:any={actorId:id(1),clientId:id(2),credentialGeneration:3,authSession:{id:id(2),idleExpiresAt:'2026-10-19T09:00:00.000Z',absoluteExpiresAt:'2026-10-19T10:00:00.000Z'}},submissionId=id(50),manifest={assignmentRef:f.scope.assignmentRef,executionRef:f.scope.executionRef,baselineRefs:[],submissionState:'INCOMPLETE',changes:[],commandResults:[],testResults:[],artifactRefs:[],unexecuted:[],risks:[],rollback:'원문 보존',checkpointRef:null};
 const request:any={schemaVersion:1,projectId:f.scope.projectId,commandId:id(51),clientId:actor.clientId,controlGeneration:2,operation:'submitResult',targetId:submissionId,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{scope:f.scope,submissionId,manifest}};
 const rule={ruleId:'results',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['submitResult'],targetScopes:[{kind:'PROJECT',projectId:f.scope.projectId}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-10-19T09:00:00.000Z'},policy={id:id(52),head_version:1,rules_json:[rule],reason:'결과 제출',review_refs:[],content_hash:hash({rules:[rule],reason:'결과 제출',reviewRefs:[]})};
 let row:any=null,member=true,head:any={...policy,created_at:new Date(at)},now=at,generation=2;const calls:any[]=[],commands=new Map<string,any>(),receipts=new Map<string,any>(),audits:any[]=[];
 const db:any={query:async(sql:string,p:any[]=[])=>{calls.push({sql,p});
  if(sql.includes('AS execution,to_jsonb(q)'))return f.db.query(sql,p);
  if(sql.includes('JOIN anvil.project_members'))return{rows:member?[{id:f.scope.projectId,archived_at:null,participation:'OWNER'}]:[]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{actor_id:actor.actorId,client_id:actor.clientId,generation,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:head?[head]:[]};
  if(sql.includes('FROM anvil.assignment_versions'))return{rows:[{content_hash:f.scope.assignmentRef.contentHash}]};
  if(sql.includes('transaction_timestamp()')||sql.includes('clock_timestamp()'))return{rows:[{at:new Date(now)}]};
  if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return{rows:[...commands.values()].filter(c=>c.project_id===p[0]&&c.actor_id===p[1]&&c.command_id===p[2]).map(c=>({operation:c.operation,request_hash:c.request_hash,result_ref:structuredClone(c.result_ref)}))};
  if(sql.includes('FROM anvil.commands c')&&sql.includes('AS receipt')&&sql.includes('AS audit')){
   assert.equal(p[0],f.scope.projectId);const ids=p[1] as string[];assert.equal(p[2],ids.length+1);
   const selected=ids.flatMap(id=>{
    const c=commands.get(id),receipt=receipts.get(c?.authorization_receipt_id);
    if(c?.project_id!==p[0]||!receipt||receipt.command_id!==id)return [];
    return audits.filter(a=>a.command_id===id&&a.project_id===p[0]).map(a=>({...c,receipt,audit:a,authorized_at:receipt.authorized_at,recorded_at:a.recorded_at}));
   });
   return{rows:structuredClone(selected.slice(0,p[2]))};
  }
  if(sql.startsWith('SELECT')&&sql.includes('FROM anvil.result_submissions')){if(sql.includes('assignment_ref=$2')){assert.equal(p[0],f.scope.projectId);assert.deepEqual(JSON.parse(p[1]),f.scope.assignmentRef);}return{rows:row?[structuredClone(row)]:[]};}
  if(sql.startsWith('INSERT INTO anvil.result_submissions')){assert.equal(row,null);row={project_id:p[0],id:p[1],execution_id:p[2],generation:p[3],assignment_ref:JSON.parse(p[4]),execution_ref:JSON.parse(p[5]),manifest_ref:JSON.parse(p[6]),manifest_hash:p[7],submission_state:p[8],submitted_by:p[9],client_id:p[10],command_id:p[11],content_hash:p[12],snapshot_json:JSON.parse(p[13]),submitted_at:new Date(p[14])};return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.commands')){
   commands.set(p[0],{id:p[0],scope_kind:'PROJECT',scope_id:p[1],project_id:p[1],draft_id:null,actor_id:p[2],client_id:p[3],operation:p[4],command_id:p[5],request_hash:p[6],operation_id:p[7],state:'APPLIED',authorization_receipt_id:p[8],approval_consumption_id:p[9],expected_version:p[10],control_generation:String(p[11]),policy_ref:JSON.parse(p[12]),payload_ref:p[13],result_ref:JSON.parse(p[14]),completed_at:new Date(now)});
   return{rows:[],rowCount:1};
  }
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){
   receipts.set(p[0],{id:p[0],scope_kind:'PROJECT',scope_id:p[1],command_id:p[2],subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6],authorized_at:new Date(now)});
   return{rows:[],rowCount:1};
  }
  if(sql.startsWith('INSERT INTO anvil.audit_events')){
   if(sql.includes("'SERVER_DENIAL'")){
    audits.push({project_id:p[0],event_id:p[1],actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:null,target_ref:JSON.parse(p[4]),outcome:'DENIED',reason_code:p[5],source_kind:'SERVER_DENIAL',recorded_at:new Date(now),server_sequence:String(audits.length+1)});
    return{rows:[],rowCount:1};
   }
   audits.push({project_id:p[0],event_id:p[1],actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),policy_ref:JSON.parse(p[7]),approval_ref:p[8],outcome:'APPLIED',reason_code:p[9],scope_digest:p[10],source_kind:'HUMAN_COMMAND',correction_of:null,recorded_at:new Date(now),server_sequence:String(audits.length+1)});
   return{rows:[],rowCount:1};
  }
  if(sql.startsWith('SELECT set_config'))return{rows:[],rowCount:1};
  throw Error('UNEXPECTED_QUERY:'+sql);
 }};
 return{...f,actor,request,policy,db,calls,commands,receipts,audits,row:()=>row,setRow:(v:any)=>row=v,member:(v:boolean)=>member=v,policyHead:(v:any)=>head=v,now:(v:string)=>now=v,generation:(v:number)=>generation=v};
}
function service(){assert.equal(typeof mod.ProjectResultSubmissions,'function','결과 제출의 PG 저장/조회 구현 누락');return new mod.ProjectResultSubmissions();}

function submitRoutes(f:ReturnType<typeof fixture>){
 const origin='https://localhost:3830',csrf='C'.repeat(43),token='synthetic-submit-session';
 const repository=new AccessRepository({connect:()=>assert.fail('실제 PG 금지')} as unknown as Pool,{installationId:id(81),key:Buffer.alloc(32,1)});
 Object.defineProperty(repository,'authenticated',{value:async(t:string,c:string|null,body:Parameters<AccessRepository['authenticated']>[2])=>{
  if(t!==token)throw new AuthFailure('AUTH_REQUIRED',401);
  assert(c===null||c===csrf);return body(f.db,f.actor);
 }});
 const app=buildApp({},undefined,{repository,origin});
 return{close:()=>app.close(),send:(payload=f.request,cookie=true)=>app.inject({method:'POST',url:`/api/v1/projects/${f.scope.projectId}/commands`,headers:{host:'localhost:3830',origin,'x-anvil-csrf':csrf,'idempotency-key':payload.commandId,...(cookie?{cookie:`__Host-anvil.sid=${token}`}:{})},payload})};
}
test('동일 제출 HTTP 재확인은 원장 검산을 통과할 때만 같은 응답을 반환한다',async()=>{
 const f=fixture(),route=submitRoutes(f);
 try{
  const first=await route.send();assert.equal(first.statusCode,200,first.body);
  const inserts=()=>f.calls.filter(c=>c.sql.startsWith('INSERT')).length,before=inserts();
  const reason='후속 정책 버전도 같은 연산을 허용';
  f.policyHead({...f.policy,head_version:2,reason,content_hash:hash({rules:f.policy.rules_json,reason,reviewRefs:[]}),created_at:new Date(at)});
  const replay=await route.send();assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),first.json());assert.equal(inserts(),before);
  f.audits.push({...f.audits[0],event_id:id(99),reason_code:'BAD_DUPLICATE'});
  const corrupt=await route.send();assert.equal(corrupt.statusCode,503,corrupt.body);assert.equal(corrupt.json().code,'RESULT_SUBMISSION_LEDGER_INVALID');assert.equal(inserts(),before);
 }finally{await route.close();}
});
const submissionLedgerError={code:'RESULT_SUBMISSION_LEDGER_INVALID',status:503};
test('동일 제출 HTTP 재확인은 원 제출·영수증·실행이 없거나 다른 정확 원장이면 성공하지 않는다',async(t)=>{
 for(const mode of ['ROW_MISSING','MANIFEST_REHASH','RECEIPT_SCOPE','EXECUTION_MISSING','OTHER_ORIGINAL','RAW_REPLAY_SHAPE'] as const)await t.test(mode,async()=>{
  const f=fixture(),route=submitRoutes(f);
  try{
   const first=await route.send();assert.equal(first.statusCode,200,first.body);
   if(mode==='ROW_MISSING')f.setRow(null);
   if(mode==='MANIFEST_REHASH'){
    const row=f.row();row.snapshot_json.manifest.rollback='다른 원문';
    row.manifest_ref.contentHash=row.manifest_hash=row.snapshot_json.manifestHash=hash(row.snapshot_json.manifest);
    row.content_hash=hash(row.snapshot_json);
   }
   if(mode==='RECEIPT_SCOPE')f.receipts.get(f.commands.get(f.row().command_id).authorization_receipt_id).scope_digest='e'.repeat(64);
   if(mode==='OTHER_ORIGINAL'){
    f.setRow(null);
    const different=await route.send({...f.request,commandId:id(98)});assert.equal(different.statusCode,200,different.body);
    await service().read(f.db,f.actor,f.scope.projectId,f.request.targetId);
   }
   if(mode==='EXECUTION_MISSING'||mode==='RAW_REPLAY_SHAPE'){
    const query=f.db.query;f.db.query=async(sql:string,params:any[])=>{
     if(mode==='EXECUTION_MISSING'&&sql.includes('AS execution,to_jsonb(q)'))return{rows:[]};
     const data=await query(sql,params);
     if(mode==='RAW_REPLAY_SHAPE'&&sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))data.rows[0].result_ref.warnings=['WRONG'];
     return data;
    };
   }
   const before=f.calls.length,replay=await route.send();
   assert.equal(replay.statusCode,submissionLedgerError.status,replay.body);assert.equal(replay.json().code,submissionLedgerError.code);
   assert(!f.calls.slice(before).some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)));
  }finally{await route.close();}
 });
});
test('동일 제출 HTTP는 현재 인증·권한과 다른 내용의 충돌을 그대로 유지한다',async()=>{
 const f=fixture(),route=submitRoutes(f);
 try{
  const first=await route.send();assert.equal(first.statusCode,200,first.body);
  const before=f.calls.length;
  const unauthorized=await route.send(f.request,false);assert.equal(unauthorized.statusCode,401);assert.equal(f.calls.length,before);
  const change={...f.request,payload:{...f.request.payload,manifest:{...f.request.payload.manifest,rollback:'다른 내용'}}};
  const conflict=await route.send(change);assert.equal(conflict.statusCode,409);assert.equal(conflict.json().code,'IDEMPOTENCY_CONFLICT');
  f.generation(3);const controller=await route.send();assert.equal(controller.statusCode,409);assert.equal(controller.json().code,'CONTROL_GENERATION_CONFLICT');
  f.generation(2);f.policyHead(null);const policy=await route.send();assert.equal(policy.statusCode,412);assert.equal(policy.json().code,'PERMISSION_POLICY_UNCONFIGURED');
  assert(!f.calls.slice(before).some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)&&!c.sql.includes("'SERVER_DENIAL'")));
  assert.deepEqual(f.audits.filter(a=>a.source_kind==='SERVER_DENIAL').map(a=>a.reason_code),['IDEMPOTENCY_CONFLICT','CONTROL_GENERATION_CONFLICT','PERMISSION_POLICY_UNCONFIGURED']);
 }finally{await route.close();}
});
test('동일 제출 HTTP는 원장 검산을 기다리는 동안 사라진 현재 조건으로 성공하지 않는다',async(t)=>{
 for(const [mode,status,code] of [['MEMBER',404,'NOT_FOUND'],['CONTROL',409,'CONTROL_GENERATION_CONFLICT'],['POLICY',412,'PERMISSION_POLICY_UNCONFIGURED'],['SESSION',409,'RESULT_SUBMISSION_CURRENT_CHANGED']] as const)await t.test(mode,async()=>{
  const f=fixture(),route=submitRoutes(f);
  try{
   const first=await route.send();assert.equal(first.statusCode,200,first.body);
   const before=f.calls.length,query=f.db.query;
   f.db.query=async(sql:string,params:any[])=>{
    const data=await query(sql,params);
    if(sql.includes('FROM anvil.commands c')&&sql.includes('AS audit')){
     if(mode==='MEMBER')f.member(false);
     else if(mode==='CONTROL')f.generation(3);
     else if(mode==='POLICY')f.policyHead(null);
     else f.now('2026-10-19T09:00:00.000Z');
    }
    return data;
   };
   const replay=await route.send();assert.equal(replay.statusCode,status,replay.body);assert.equal(replay.json().code,code);
   assert(!f.calls.slice(before).some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)&&!c.sql.includes("'SERVER_DENIAL'")));
   assert.deepEqual(f.audits.filter(a=>a.source_kind==='SERVER_DENIAL').map(a=>a.reason_code),status===404?[]:[code]);
  }finally{await route.close();}
 });
});
test('제출 이전 페이지는 정확 임무/사용자 서명cursor와20+2 keyset으로 중복 없이 명시조회',async()=>{
 const f=fixture(),s=service(),rows:any[]=[];
 for(let index=0;index<22;index++){
  f.setRow(null);const submissionId=id(100+index);
  await s.submit(f.db,f.actor,{...f.request,commandId:id(150+index),targetId:submissionId,payload:{...f.request.payload,submissionId}},
   {id:f.policy.id,version:1,contentHash:f.policy.content_hash});
  rows.unshift({...f.row(),cursor_at:f.row().submitted_at.toISOString()});
 }
 const db:any={query:async(sql:string,p:any[])=>{
  if(sql.includes('cursor_at')&&sql.includes('FROM anvil.result_submissions')){
   assert.deepEqual(JSON.parse(p[1]),f.scope.assignmentRef);
   return{rows:rows.filter(r=>p[3]===null||r.id<p[3]).slice(0,21)};
  }
  return f.db.query(sql,p);
 }};
 const codec=new ProjectListCodec(v=>hash('test-key:'+v)),pid=f.scope.projectId,assignment=f.scope.assignmentRef;
 const first=await s.page(db,f.actor,pid,assignment.id,assignment.version,{},codec);
 assert.equal(first.items.length,20);assert.equal(first.selectionState,'NOT_SELECTED');assert(first.nextCursor);
 const next=await s.page(db,f.actor,pid,assignment.id,assignment.version,{cursor:first.nextCursor},codec);
 assert.equal(next.items.length,2);assert.equal(next.nextCursor,null);assert.equal(next.hasMore,false);
 assert.equal(new Set([...first.items,...next.items].map((i:any)=>i.ref.id)).size,22);
 for(const query of [{cursor:first.nextCursor+'x'},{cursor:''},{fallback:true}])await assert.rejects(s.page(db,f.actor,pid,assignment.id,assignment.version,query,codec));
 const other={...f.actor,actorId:id(99)};await assert.rejects(s.page(db,other,pid,assignment.id,assignment.version,{cursor:first.nextCursor},codec),/CURSOR_INVALID/);
 f.now('2026-10-19T09:01:00.000Z');await assert.rejects(s.page(db,f.actor,pid,assignment.id,assignment.version,{cursor:first.nextCursor},codec),/CURSOR_INVALID/);
});
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
test('정확내용확정임무의최근제출목록은원문검증후주장메타데이터만조회한다',async()=>{
 const f=fixture(),s=service();await s.submit(f.db,f.actor,f.request,{id:f.policy.id,version:1,contentHash:f.policy.content_hash});
 assert.equal(typeof s.list,'function','정확 임무 결과 목록 미연결');const value=await s.list(f.db,f.actor,f.scope.projectId,f.scope.assignmentRef.id,f.scope.assignmentRef.version);
 assert.deepEqual(value.assignmentRef,f.scope.assignmentRef);assert.equal(value.projectId,f.scope.projectId);assert.equal(value.hasMore,false);assert.equal(value.items.length,1);assert.deepEqual(value.items[0].ref,{id:f.request.targetId,version:1,contentHash:f.row().content_hash});assert.equal(value.items[0].submissionState,'INCOMPLETE');assert.equal(value.items[0].sourceKind,'WORKER_CLAIM');assert.equal(value.items[0].completionAccepted,false);assert.equal(value.items[0].manifest,undefined);
 f.row().snapshot_json.manifest.rollback='손상';await assert.rejects(s.list(f.db,f.actor,f.scope.projectId,f.scope.assignmentRef.id,1),/RESULT_SUBMISSION_LEDGER_INVALID/);
});
test('목록도멤버회수와다른임무원문을거절한다',async()=>{
 const f=fixture(),s=service();assert.equal(typeof s.list,'function');await s.submit(f.db,f.actor,f.request,{id:f.policy.id,version:1,contentHash:f.policy.content_hash});
 f.member(false);await assert.rejects(s.list(f.db,f.actor,f.scope.projectId,f.scope.assignmentRef.id,1));f.member(true);
 f.row().snapshot_json.scope.assignmentRef.contentHash='f'.repeat(64);await assert.rejects(s.list(f.db,f.actor,f.scope.projectId,f.scope.assignmentRef.id,1));
});

test('원 제출 영수증·명령·감사·manifest를 변조하면 read/list/page 모두 기존 무결성 503이다',async(t)=>{
 for(const mode of ['COMMAND_HASH','COMMAND_MISSING','RESULT_METADATA','RECEIPT_SUBJECT','RECEIPT_SCOPE','RECEIPT_MISSING','AUDIT_MISSING','AUDIT_DUPLICATE','AUDIT_TARGET','AUDIT_TIME','MANIFEST_REHASH','RECEIPT_REF_REHASH'] as const){
  await t.test(mode,async()=>{
   const f=fixture(),s=service(),pid=f.scope.projectId,cursor=new ProjectListCodec(v=>hash('origin-key:'+v));
   await s.submit(f.db,f.actor,f.request,{id:f.policy.id,version:1,contentHash:f.policy.content_hash});
   const row=f.row(),cmd=f.commands.get(row.command_id),receipt=f.receipts.get(cmd.authorization_receipt_id),audit=f.audits[0];
   if(mode==='COMMAND_HASH')cmd.request_hash='f'.repeat(64);
   if(mode==='COMMAND_MISSING')f.commands.delete(cmd.id);
   if(mode==='RESULT_METADATA')cmd.result_ref.data.sourceKind='TEST_ARTIFACT';
   if(mode==='RECEIPT_SUBJECT')receipt.subject_ref.userId=id(99);
   if(mode==='RECEIPT_SCOPE')receipt.scope_digest='e'.repeat(64);
   if(mode==='RECEIPT_MISSING')f.receipts.delete(receipt.id);
   if(mode==='AUDIT_MISSING')f.audits.length=0;
   if(mode==='AUDIT_DUPLICATE')f.audits.push({...audit,event_id:id(99),reason_code:'BAD_DUPLICATE',server_sequence:'2'});
   if(mode==='AUDIT_TARGET')audit.target_ref.contentHash='d'.repeat(64);
   if(mode==='AUDIT_TIME')audit.recorded_at=new Date(row.submitted_at.getTime()+1000);
   if(mode==='MANIFEST_REHASH'){
    row.snapshot_json.manifest.rollback='다른 보관 원문';
    row.manifest_hash=row.snapshot_json.manifestHash=hash(row.snapshot_json.manifest);
    row.manifest_ref={...row.manifest_ref,contentHash:row.manifest_hash};
    row.content_hash=hash(row.snapshot_json);
   }
   if(mode==='RECEIPT_REF_REHASH'){
    row.snapshot_json.authorizationReceiptRef={...row.snapshot_json.authorizationReceiptRef,id:id(99)};
    row.content_hash=hash(row.snapshot_json);
   }
   const reason={message:'RESULT_SUBMISSION_LEDGER_INVALID',statusCode:503};
   await assert.rejects(s.read(f.db,f.actor,pid,row.id),reason);
   await assert.rejects(s.list(f.db,f.actor,pid,f.scope.assignmentRef.id,1),reason);
   await assert.rejects(s.page(f.db,f.actor,pid,f.scope.assignmentRef.id,1,{},cursor),reason);
  });
 }
});

test('다른 현재 회원이 과거 제출을 읽을 때 작성자 자격과 정책 head를 다시 요구하지 않는다',async()=>{
 const f=fixture(),s=service(),pid=f.scope.projectId,assignment=f.scope.assignmentRef;
 await s.submit(f.db,f.actor,f.request,{id:f.policy.id,version:1,contentHash:f.policy.content_hash});
 f.policyHead(null);f.now('2026-10-20T08:30:00.000Z');
 const reader={...f.actor,actorId:id(98),clientId:id(99),credentialGeneration:1,authSession:{id:id(97),idleExpiresAt:'2026-10-20T09:00:00.000Z',absoluteExpiresAt:'2026-10-20T10:00:00.000Z'}};
 const before=f.calls.length,value=await s.read(f.db,reader,pid,f.request.targetId);
 assert.equal(value.snapshot.submittedByRef.id,f.actor.actorId);
 assert.equal(value.snapshot.submittedByRef.version,f.actor.credentialGeneration);
 const list=await s.list(f.db,reader,pid,assignment.id,assignment.version),page=await s.page(f.db,reader,pid,assignment.id,assignment.version,{},new ProjectListCodec(v=>hash('test-key:'+v)));
 assert.deepEqual(list.items,page.items);
 assert.equal(f.calls.slice(before).some(c=>/INSERT |project_control|permission_policies|auth_sessions/.test(c.sql)),false);
});
