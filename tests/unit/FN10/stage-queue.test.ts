import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {criteriaId as id,criteriaRef as ref} from '../FN12/result-criteria-fixture.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
const m:any=await import('../../../apps/server/modules/scheduling/stage-queue.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(){
 const pid=id(1),at='2026-10-21T14:00:00.000Z',actor:any={actorId:id(2),clientId:id(3),credentialGeneration:1,authSession:{id:id(4),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}},appRef=ref(5),node={nodeId:'N1',name:'설계',purpose:'작업',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['설계'],excluded:[]},completionCriteria:['검수'],approvalBoundary:['사람확인'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['현황']},graph={nodes:[node],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']},snapshot={name:'절차',purpose:'작업',graph,sourceRef:{...ref(6),contentHash:hash(graph)}};appRef.contentHash=hash(snapshot);
 const input={stageRef:{applicationRef:appRef,nodeId:'N1'},methodologyApplicationRef:appRef,mode:'CASE_BY_CASE',startNodeRef:{applicationRef:appRef,nodeId:'N1'},endBoundaryRef:{applicationRef:appRef,nodeId:'N1'},baselineRefs:[ref(7)],budgetRef:ref(8),reason:'선택 단계 시작 요청'};
 const request:any={schemaVersion:1,projectId:pid,commandId:id(9),clientId:actor.clientId,controlGeneration:1,operation:'startStage',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:input};
 const rule={ruleId:'QUEUE',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['startStage','cancelQueuedRequest'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'},policy={created_at:new Date(at),id:id(10),head_version:1,rules_json:[rule],reason:'대기요청만',review_refs:[],content_hash:hash({rules:[rule],reason:'대기요청만',reviewRefs:[]})},policyRef={id:policy.id,version:1,contentHash:policy.content_hash};
 const rows:any[]=[],commands=new Map<string,any>(),calls:string[]=[];let allowed=true,controlled=true,failAudit=false;
 const db:any={query:async(sql:string,p:any[]=[])=>{calls.push(sql);if(sql.includes('JOIN anvil.project_members'))return{rows:allowed?[{id:pid,participation:'OWNER',archived_at:null}]:[]};if(sql.includes('FROM anvil.project_control'))return{rows:controlled?[{actor_id:actor.actorId,client_id:actor.clientId,generation:1,revoked_at:null}]:[]};if(sql.includes('FROM anvil.permission_policies'))return{rows:[policy]};if(sql.includes('clock_timestamp()')||sql.includes('transaction_timestamp()'))return{rows:[{at:new Date(at)}]};if(sql.includes('COALESCE(MAX(sequence)'))return{rows:[{sequence:rows.filter(r=>r.version===1).length+1}]};if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return{rows:[...commands.values()].filter(c=>c.actor_id===p[1]&&c.command_key===p[2])};if(sql.startsWith('INSERT INTO anvil.commands')){commands.set(p[0],{operation:p[4],operation_id:p[7],request_hash:p[6],command_key:p[5],actor_id:p[2],client_id:p[3],expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),payload_ref:p[13]?JSON.parse(p[13]):null,approval_consumption_id:p[9],result_ref:JSON.parse(p[14]),command_received_at:new Date(at)});return{rows:[]};}if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){Object.assign(commands.get(p[2]),{authorization_subject_ref:JSON.parse(p[3]),authorization_policy_ref:JSON.parse(p[4]),authorization_scope_digest:p[5],authorization_approval_decision:p[6]});return{rows:[]};}if(sql.startsWith('SELECT set_config'))return{rows:[]};if(sql.startsWith('INSERT INTO anvil.audit_events')){if(failAudit)throw Error('AUDIT_FAILED');if(p.length<11)return{rows:[]};Object.assign(commands.get(p[4]),{audit_scope_digest:p[10],audit_count:1,audit_outcome:'APPLIED',audit_source_kind:'HUMAN_COMMAND',audit_actor_ref:JSON.parse(p[2]),audit_client_ref:p[3],audit_target_ref:JSON.parse(p[6]),audit_policy_ref:JSON.parse(p[7]),audit_approval_ref:p[8]?JSON.parse(p[8]):null});return{rows:[]};}if(sql.startsWith('INSERT INTO anvil.stage_runs'))return{rows:[]};if(sql.startsWith('INSERT INTO anvil.queue_requests')){rows.push({project_id:p[0],request_id:p[1],version:p[2],sequence:p[3],content_hash:p[4],snapshot_json:JSON.parse(p[5]),command_id:p[6]});return{rows:[],rowCount:1};}if(sql.includes('FROM anvil.queue_requests')){const selected=rows.filter(r=>r.project_id===p[0]&&(p[1]===undefined||r.request_id===p[1])&&(p[2]===undefined||r.version===p[2])).sort((a,b)=>b.version-a.version),heads=p[2]!==undefined?selected:[...new Map(selected.map(r=>[r.request_id,selected.find(x=>x.request_id===r.request_id)])).values()].filter(r=>p[1]!==undefined||r.snapshot_json.state==='WAITING');return{rows:heads.map(r=>({...structuredClone(r),...structuredClone(commands.get(r.command_id)),command_id:r.command_id,command_external_id:commands.get(r.command_id).command_key,command_operation_id:commands.get(r.command_id).operation_id,command_actor:commands.get(r.command_id).actor_id,command_client:commands.get(r.command_id).client_id,state:'APPLIED',command_scope_kind:'PROJECT',command_scope_id:pid}))};}throw Error('UNEXPECTED_QUERY:'+sql);}};
 const ports={applications:{readApplication:async()=>({projectId:pid,applicationRef:structuredClone(appRef),snapshot:structuredClone(snapshot),executionState:'NOT_CONNECTED'})},budgets:{resolveCurrent:async()=>({ref:ref(8),snapshot:{state:'APPLIED',expiresAt:'2099-01-01T00:00:00.000Z'}})}};
 assert.equal(typeof m.ProjectStageQueue,'function');const service=new m.ProjectStageQueue(ports);return{pid,at,actor,request,policy,policyRef,rows,calls,service,db,ports,member:(v:boolean)=>allowed=v,control:(v:boolean)=>controlled=v,auditFailure:()=>failAudit=true};
}
test('명시 시작 요청은 WAITING·단조순번으로 저장/조회하고 예약·수행을 만들지 않는다',async()=>{const f=fixture(),r=await f.service.start(f.db,f.actor,f.request,f.policyRef);assert.equal(r.data.queueState,'WAITING');assert.equal(r.data.snapshot.executionAuthorized,false);assert.equal(r.data.snapshot.assignmentRef,null);assert(r.data.snapshot.readinessIssues.includes('ASSIGNMENT_BINDING_UNVERIFIED'));const q=await f.service.read(f.db,f.actor,f.pid);assert.equal(q.items.length,1);assert.equal(q.items[0].state,'WAITING');assert.equal(q.items[0].sequence,1);assert.equal(q.writerReservationPerformed,false);assert(!f.calls.some(s=>/INSERT INTO anvil.(usage_reservations|execution_outbox)/.test(s)));});
test('정확 WAITING ref만 취소하며 과거 버전·다른 hash는 취소하지 않는다',async()=>{const f=fixture(),r=await f.service.start(f.db,f.actor,f.request,f.policyRef),c={...f.request,commandId:id(11),operation:'cancelQueuedRequest',targetId:r.data.ref.id,expectedVersion:1,payload:{requestRef:r.data.ref,reason:'아직 시작 전 취소'}};const done=await f.service.cancel(f.db,f.actor,c,f.policyRef);assert.equal(done.data.queueState,'CANCELLED');assert.equal(done.data.snapshot.dispatchPerformed,false);assert.equal(done.data.snapshot.writerReservationPerformed,false);assert.equal((await f.service.read(f.db,f.actor,f.pid)).items.length,0);await assert.rejects(f.service.cancel(f.db,f.actor,{...c,commandId:id(12)},f.policyRef));assert.equal(f.rows.length,2);});
test('현재권한·제어·기준 및 예산 불일치를 대기 성공으로 치환하지 않는다',async()=>{for(const mode of ['MEMBER','CONTROL','APP','BUDGET','AUTO','APPROVAL']){const f=fixture();if(mode==='MEMBER')f.member(false);if(mode==='CONTROL')f.control(false);if(mode==='APP')f.request.payload.methodologyApplicationRef=ref(80);if(mode==='BUDGET')f.ports.budgets.resolveCurrent=async()=>{throw Error('LIMIT_POLICY_EXPIRED');};if(mode==='AUTO')f.request.payload.mode='AUTO';if(mode==='APPROVAL')f.request.approvalRef=ref(80);await assert.rejects(f.service.start(f.db,f.actor,f.request,f.policyRef));assert.equal(f.rows.length,0);}});
test('감사 실패면 queue 행을 쓰지 않고 읽기에서 변조된 snapshot을 거절한다',async()=>{const f=fixture();f.auditFailure();await assert.rejects(f.service.start(f.db,f.actor,f.request,f.policyRef),/AUDIT_FAILED/);assert.equal(f.rows.length,0);const g=fixture();await g.service.start(g.db,g.actor,g.request,g.policyRef);g.rows[0].snapshot_json.executionAuthorized=true;await assert.rejects(g.service.read(g.db,g.actor,g.pid),/STAGE_QUEUE_LEDGER_INVALID/);});
test('실제 공통 명령 계층의 exact replay는 추가 저장하지 않고 제어 회수 뒤 노출하지 않는다',async()=>{const f=fixture(),access:any={authenticated:async(_token:string,_csrf:string,cb:any)=>cb(f.db,f.actor)},policies=new ProjectPolicyRepository(access),send=(request:any=f.request)=>policies.command('synthetic','synthetic',request,(db,actor,p)=>f.service.start(db,actor,request,p),(db,actor,command,result)=>f.service.verifyReplay(db,actor,command,result));const first=await send(),second=await send();assert.deepEqual(second,first);assert.equal(f.rows.length,1);await assert.rejects(send({...f.request,payload:{...f.request.payload,reason:'내용 변경'}}),/IDEMPOTENCY_CONFLICT/);assert.equal(f.rows.length,1);f.control(false);await assert.rejects(send(),/PROJECT_CONTROL_REQUIRED/);assert.equal(f.rows.length,1);});
test('비밀 사유·다른 노드 참조·추가 허가 flag를 새 요청으로 저장하지 않는다',async()=>{for(const mode of ['SECRET','NODE','EXTRA']){const f=fixture();if(mode==='SECRET')f.request.payload.reason='api_key=synthetic-invalid-marker';if(mode==='NODE')f.request.payload.startNodeRef.nodeId='OTHER';if(mode==='EXTRA')f.request.payload.executionAuthorized=true;await assert.rejects(f.service.start(f.db,f.actor,f.request,f.policyRef),/STAGE_/);assert.equal(f.rows.length,0);}});

async function cancelledFixture(){
 const f=fixture(),waiting=(await f.service.start(f.db,f.actor,f.request,f.policyRef)).data;
 const command={...f.request,commandId:id(11),operation:'cancelQueuedRequest',targetId:waiting.ref.id,expectedVersion:1,
  payload:{requestRef:waiting.ref,reason:'아직 시작 전 취소'}};
 const cancelled=(await f.service.cancel(f.db,f.actor,command,f.policyRef)).data;
 return {...f,waiting,cancelled};
}

// snapshot·command·receipt·audit가 각 행 안에서는 일치하는 반례를 만든다.
function resealQueueView(row:any,update:(snapshot:any)=>void){
 const next=structuredClone(row),s=next.snapshot_json;
 update(s);
 const ref={id:next.request_id,version:Number(next.version),contentHash:hash(s)};
 const payload=s.state==='WAITING'?s.input:{requestRef:s.previousRef,reason:s.cancellationReason};
 const command={schemaVersion:1,projectId:next.project_id,commandId:next.command_external_id,clientId:next.command_client,
  controlGeneration:Number(next.control_generation),operation:next.operation,targetId:s.state==='WAITING'?null:ref.id,
  expectedVersion:ref.version-1,baselineRefs:[],approvalRef:null,payload};
 const requestHash=hash(command),digest=hash({projectId:next.project_id,actorId:next.command_actor,clientId:next.command_client,
  controlGeneration:Number(next.control_generation),requestHash,policyRef:next.policy_ref,targetRef:ref});
 Object.assign(next,{sequence:s.sequence,content_hash:ref.contentHash,request_hash:requestHash,authorization_scope_digest:digest,
  audit_scope_digest:digest,audit_target_ref:ref,result_ref:{...next.result_ref,data:{...next.result_ref.data,ref,snapshot:s}}});
 return next;
}

test('고정 대기 요청은 취소 뒤에도 역사 WAITING과 현재 CANCELLED를 구분한다',async()=>{
 const f=await cancelledFixture();
 const waiting=await f.service.readRequest(f.db,f.actor,f.pid,f.waiting.ref);
 assert.deepEqual(waiting.ref,f.waiting.ref);assert.deepEqual(waiting.currentRef,f.cancelled.ref);
 assert.equal(waiting.snapshot.state,'WAITING');assert.equal(waiting.currentState,'CANCELLED');
 const cancelled=await f.service.readRequest(f.db,f.actor,f.pid,f.cancelled.ref);
 assert.deepEqual(cancelled.ref,f.cancelled.ref);assert.deepEqual(cancelled.currentRef,f.cancelled.ref);
 assert.equal(cancelled.snapshot.state,'CANCELLED');assert.equal(cancelled.currentState,'CANCELLED');
 await assert.rejects(f.service.readRequest(f.db,f.actor,f.pid,ref(90)),{message:'NOT_FOUND',statusCode:404});
 await assert.rejects(f.service.readRequest(f.db,f.actor,f.pid,{...f.waiting.ref,contentHash:'d'.repeat(64)}),{message:'VERSION_CONFLICT',statusCode:409});
});

for(const mode of ['previousHash','input','sequence','requester','queuedAt'] as const)test('취소 원장 · 각 원장/영수증을 재검산해도 '+mode+'가 원 대기와 다르면 거절한다',async()=>{
 const f=await cancelledFixture(),query=f.db.query;
 const {rows}=await query('SELECT * FROM anvil.queue_requests WHERE q.project_id=$1 AND q.request_id=$2 AND q.version=$3',[f.pid,f.cancelled.ref.id,2]);
 const changed=resealQueueView(rows[0],s=>{
  if(mode==='previousHash')s.previousRef.contentHash='b'.repeat(64);
  else if(mode==='input')s.input.reason='다른 대기 요청 이유';
  else if(mode==='sequence')s.sequence++;
  else if(mode==='requester')s.requestedBy.userId=id(19);
  else s.queuedAt='2026-10-21T13:59:59.000Z';
 });
 f.db.query=async(sql:string,args:any[])=>{
  const result=await query(sql,args);
  return sql.includes('FROM anvil.queue_requests')&&result.rows[0]?.version===2?{rows:[changed]}:result;
 };
 for(const requested of [f.waiting.ref,changed.result_ref.data.ref])await assert.rejects(
  f.service.readRequest(f.db,f.actor,f.pid,requested),{message:'STAGE_QUEUE_LEDGER_INVALID',statusCode:503});
});

for(const mode of ['missing','duplicate','receipt'] as const)test('취소 원장 · 원 대기의 '+mode+'는 취소 단독 원문을 반환하지 않는다',async()=>{
 const f=await cancelledFixture(),query=f.db.query;
 f.db.query=async(sql:string,args:any[])=>{
  const result=await query(sql,args);
  if(!sql.includes('FROM anvil.queue_requests')||args[2]!==1)return result;
  const row=result.rows[0];
  return {rows:mode==='missing'?[]:mode==='duplicate'?[row,row]:[{...row,authorization_scope_digest:null}]};
 };
 await assert.rejects(f.service.readRequest(f.db,f.actor,f.pid,f.cancelled.ref),{message:'STAGE_QUEUE_LEDGER_INVALID',statusCode:503});
});

test('같은 세대의 재해시한 다른 head와 요청보다 뒤처진 head는 원장 오류다',async()=>{
 const f=await cancelledFixture(),query=f.db.query;
 const old=(await query('SELECT * FROM anvil.queue_requests WHERE q.project_id=$1 AND q.request_id=$2 AND q.version=$3',[f.pid,f.waiting.ref.id,1])).rows[0];
 const other=resealQueueView(old,s=>{s.input.reason='같은 버전의 다른 보관 대기';});
 for(const head of [old,other]){
  f.db.query=async(sql:string,args:any[])=>sql.includes('FROM anvil.queue_requests')&&sql.includes('ORDER BY q.version DESC LIMIT 1')?{rows:[head]}:query(sql,args);
  await assert.rejects(f.service.readRequest(f.db,f.actor,f.pid,head===old?f.cancelled.ref:f.waiting.ref),{message:'STAGE_QUEUE_LEDGER_INVALID',statusCode:503});
 }
});
