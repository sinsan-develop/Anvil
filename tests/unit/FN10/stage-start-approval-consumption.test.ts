import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { authorizeMaterial, type ProjectCommand } from '../../../apps/server/modules/access/project-command.ts';
import { criteriaId as id, criteriaRef as ref } from '../FN12/result-criteria-fixture.ts';

const hash = (value: unknown) => contentHash(canonicalJson(value));

test('명시 startStage 승인 정책은 미연결 오류 대신 원명령의 APPROVAL_REQUIRED/412를 반환하고 저장하지 않는다', async () => {
  const projectId = id(1), userId = id(2), clientId = id(3);
  const actor = { actorId: userId, clientId, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
  const applicationRef = ref(5);
  const request: ProjectCommand = {
    schemaVersion: 1, projectId, commandId: id(9), clientId, controlGeneration: 1,
    operation: 'startStage', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null,
    payload: {
      stageRef: { applicationRef, nodeId: 'N1' }, methodologyApplicationRef: applicationRef,
      mode: 'CASE_BY_CASE', startNodeRef: { applicationRef, nodeId: 'N1' },
      endBoundaryRef: { applicationRef, nodeId: 'N1' }, baselineRefs: [ref(7)],
      budgetRef: ref(8), reason: '선택 단계 대기요청 저장',
    },
  };
  const rules = [{
    ruleId: 'QUEUE', subjectRef: { kind: 'HUMAN', userId }, operations: ['startStage'],
    targetScopes: [{ kind: 'PROJECT', projectId }], disposition: 'REQUIRE_APPROVAL',
    limitPolicyRef: null, expiresAt: '2099-01-01T00:00:00.000Z',
  }];
  const policy = { rules, reason: '대기요청 원명령만 일회 승인', reviewRefs: [] };
  const calls: string[] = [];
  const db = { query: async (sql: string) => {
    calls.push(sql);
    if (sql.includes('FROM anvil.permission_policies')) return { rows: [{
      id: id(10), head_version: 1, rules_json: rules, content_hash: hash(policy),
      reason: policy.reason, review_refs: policy.reviewRefs, created_at: new Date('2026-10-27T00:00:00.000Z'),
    }] };
    throw new Error(`UNEXPECTED_QUERY:${sql}`);
  } } as unknown as PoolClient;
  const original = structuredClone(request);
  await assert.rejects(authorizeMaterial(db, actor, request), { message: 'APPROVAL_REQUIRED', statusCode: 412 });
  assert.deepEqual(request, original, '승인 필요 응답은 원명령과 전체 payload를 변경하지 않는다');
  assert.equal(calls.length, 1);
  assert.ok(calls.every(sql => sql.startsWith('SELECT ')), '승인 필요 판정에서 저장·소비·예약을 수행하지 않는다');
});

import {ProjectStageQueue} from '../../../apps/server/modules/scheduling/stage-queue.ts';
import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
const m:any={ProjectStageQueue};
function stageFixture(){
 const pid=id(1),at='2026-10-21T14:00:00.000Z',actor:any={actorId:id(2),clientId:id(3),credentialGeneration:1,authSession:{id:id(4),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}},appRef=ref(5),node={nodeId:'N1',name:'설계',purpose:'작업',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['설계'],excluded:[]},completionCriteria:['검수'],approvalBoundary:['사람확인'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['현황']},graph={nodes:[node],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']},snapshot={name:'절차',purpose:'작업',graph,sourceRef:{...ref(6),contentHash:hash(graph)}};appRef.contentHash=hash(snapshot);
 const input={stageRef:{applicationRef:appRef,nodeId:'N1'},methodologyApplicationRef:appRef,mode:'CASE_BY_CASE',startNodeRef:{applicationRef:appRef,nodeId:'N1'},endBoundaryRef:{applicationRef:appRef,nodeId:'N1'},baselineRefs:[ref(7)],budgetRef:ref(8),reason:'선택 단계 시작 요청'};
 const request:any={schemaVersion:1,projectId:pid,commandId:id(9),clientId:actor.clientId,controlGeneration:1,operation:'startStage',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:input};
 const rule={ruleId:'QUEUE',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['startStage','cancelQueuedRequest'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'},policy={created_at:new Date(at),id:id(10),head_version:1,rules_json:[rule],reason:'대기요청만',review_refs:[],content_hash:hash({rules:[rule],reason:'대기요청만',reviewRefs:[]})},policyRef={id:policy.id,version:1,contentHash:policy.content_hash};
 const rows:any[]=[],commands=new Map<string,any>(),calls:string[]=[];let allowed=true,controlled=true,failAudit=false;
 const db:any={query:async(sql:string,p:any[]=[])=>{calls.push(sql);if(sql.includes('JOIN anvil.project_members'))return{rows:allowed?[{id:pid,participation:'OWNER',archived_at:null}]:[]};if(sql.includes('FROM anvil.project_control'))return{rows:controlled?[{actor_id:actor.actorId,client_id:actor.clientId,generation:1,revoked_at:null}]:[]};if(sql.includes('FROM anvil.permission_policies'))return{rows:[policy]};if(sql.includes('clock_timestamp()')||sql.includes('transaction_timestamp()'))return{rows:[{at:new Date(at)}]};if(sql.includes('COALESCE(MAX(sequence)'))return{rows:[{sequence:rows.filter(r=>r.version===1).length+1}]};if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return{rows:[...commands.values()].filter(c=>c.actor_id===p[1]&&c.command_key===p[2])};if(sql.startsWith('INSERT INTO anvil.commands')){commands.set(p[0],{operation:p[4],operation_id:p[7],request_hash:p[6],command_key:p[5],actor_id:p[2],client_id:p[3],expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),payload_ref:p[13]?JSON.parse(p[13]):null,approval_consumption_id:p[9],result_ref:JSON.parse(p[14])});return{rows:[]};}if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){Object.assign(commands.get(p[2]),{authorization_subject_ref:JSON.parse(p[3]),authorization_policy_ref:JSON.parse(p[4]),authorization_scope_digest:p[5],authorization_approval_decision:p[6]});return{rows:[]};}if(sql.startsWith('SELECT set_config'))return{rows:[]};if(sql.startsWith('INSERT INTO anvil.audit_events')){if(failAudit)throw Error('AUDIT_FAILED');if(p.length<11)return{rows:[]};Object.assign(commands.get(p[4]),{audit_scope_digest:p[10],audit_count:1,audit_outcome:'APPLIED',audit_source_kind:'HUMAN_COMMAND',audit_actor_ref:JSON.parse(p[2]),audit_client_ref:p[3],audit_target_ref:JSON.parse(p[6]),audit_policy_ref:JSON.parse(p[7]),audit_approval_ref:p[8]?JSON.parse(p[8]):null});return{rows:[]};}if(sql.startsWith('INSERT INTO anvil.stage_runs'))return{rows:[]};if(sql.startsWith('INSERT INTO anvil.queue_requests')){rows.push({project_id:p[0],request_id:p[1],version:p[2],sequence:p[3],content_hash:p[4],snapshot_json:JSON.parse(p[5]),command_id:p[6]});return{rows:[],rowCount:1};}if(sql.includes('FROM anvil.queue_requests')){const selected=rows.filter(r=>r.project_id===p[0]&&(p[1]===undefined||r.request_id===p[1])).sort((a,b)=>b.version-a.version),heads=[...new Map(selected.map(r=>[r.request_id,selected.find(x=>x.request_id===r.request_id)])).values()].filter(r=>p[1]!==undefined||r.snapshot_json.state==='WAITING');return{rows:heads.map(r=>({...structuredClone(r),...structuredClone(commands.get(r.command_id)),command_id:r.command_id,command_external_id:commands.get(r.command_id).command_key,command_operation_id:commands.get(r.command_id).operation_id,command_actor:commands.get(r.command_id).actor_id,command_client:commands.get(r.command_id).client_id,state:commands.get(r.command_id).state??'APPLIED',command_scope_kind:'PROJECT',command_scope_id:pid}))};}throw Error('UNEXPECTED_QUERY:'+sql);}};
 const ports={applications:{readApplication:async()=>({projectId:pid,applicationRef:structuredClone(appRef),snapshot:structuredClone(snapshot),executionState:'NOT_CONNECTED'})},budgets:{resolveCurrent:async()=>({ref:ref(8),snapshot:{state:'APPLIED',expiresAt:'2099-01-01T00:00:00.000Z'}})}};
 assert.equal(typeof m.ProjectStageQueue,'function');const service=new m.ProjectStageQueue(ports);return{pid,at,actor,request,policy,policyRef,rows,commands,calls,service,db,ports,member:(v:boolean)=>allowed=v,control:(v:boolean)=>controlled=v,auditFailure:()=>failAudit=true};
}

function approvalFixture(command:ProjectCommand,actor:any,options:any={}){
 const pid=command.projectId,uid=actor.actorId,key=command.commandId,requestId=id(51),decisionId=id(52),serverId=id(53),consumptionId=id(54),documentId=id(55),at='2026-10-21T14:00:00.000Z',now=new Date(at);
function approved(options:{stale?:boolean;targetChanged?:boolean;deny?:boolean;expired?:boolean;rejected?:boolean;candidateMissing?:boolean;viewer?:boolean;pending?:boolean}={}) {
 const ref={id:documentId,version:1,contentHash:'a'.repeat(64)},payload=structuredClone(command.payload);
 const rules=[{ruleId:'SAVE',subjectRef:{kind:'HUMAN',userId:uid},operations:['startStage'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:options.deny?'DENY':'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-10-21T00:00:00.000Z'}];
 const policy={rules,reason:'한 초안 저장',reviewRefs:[]},policyRef={id:uid,version:1,contentHash:hash(policy)};
 const scope={operation:'startStage',targetRef:null,expectedVersion:0,payloadHash:hash(payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:actor.clientId},controlGeneration:1};
 const scopeDigest=hash(scope),details={reason:'한 초안',risks:{data:'초안',security:'확인',cost:'없음',interruption:'없음',unverified:'합성'},rollback:{method:'과거 보존',limitations:'삭제 아님',evidenceRefs:[]},expiresAt:options.expired?'2026-10-20T00:00:00.000Z':'2099-10-21T00:00:00.000Z',actionScope:scope,candidateCommandId:key};
 const snapshot={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:uid},policyRef,requestedBy:{kind:'HUMAN',userId:uid,clientId:actor.clientId},controlGeneration:1};
 const requestRef={id:requestId,version:1,contentHash:hash(snapshot)},request={id:requestId,version:1,status:'PENDING',...snapshot,createdAt:at};
 const requestCommand={schemaVersion:1,projectId:pid,commandId:requestId,clientId:actor.clientId,controlGeneration:1,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details,candidatePayload:payload}};
 const decision=options.rejected?'REJECT':'APPROVE',body={requestId,requestVersion:1,requestRef,scopeDigest,decision,reason:'사람 확인',decidedBy:{kind:'HUMAN',userId:uid,clientId:actor.clientId},controlGeneration:1,policyRef};
 const decisionRef={id:decisionId,version:1,contentHash:hash(body)},decisionJson={id:decisionId,...body,decidedAt:at};
 const candidate:ProjectCommand={...structuredClone(command),approvalRef:{requestId,decisionId,scopeDigest}};
 let actualServer=serverId,actualConsumption=consumptionId;let used=false,status=options.pending?'PENDING':options.rejected?'REJECTED':'APPROVED',version=options.pending?1:2,targetChanged=!!options.targetChanged;
 const writes:string[]=[],targetReads:string[]=[];
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:pid,participation:options.viewer?'VIEWER':'OWNER',archived_at:null}]};
  if(sql.startsWith('SELECT r.*,c.operation'))return{rows:[{id:requestId,command_id:serverId,request_json:request,created_at:now,created_by:uid,client_id:actor.clientId,actor_id:uid,command_client:actor.clientId,content_hash:requestRef.contentHash,operation:'requestApproval',result_ref:{status:'APPLIED',data:{ref:requestRef,status:'APPROVAL_REQUESTED',request}},policy_ref:policyRef,details_json:details,candidate_command_id:key,action_scope_json:scope,scope_digest:scopeDigest,required_decider_ref:snapshot.requiredDecider,expires_at:new Date(details.expiresAt),status,version}]};
  if(sql.startsWith('SELECT d.*,c.operation'))return{rows:options.pending?[]:[{id:decisionId,decision_json:decisionJson,decided_at:now,request_version:1,scope_digest:scopeDigest,decision,reason:body.reason,decided_by:uid,client_id:actor.clientId,actor_id:uid,command_client:actor.clientId,control_generation:1,expected_version:1,operation:'decideApproval',content_hash:decisionRef.contentHash,result_ref:{status:'APPLIED',data:{ref:decisionRef,status:'APPROVAL_DECIDED',decision:decisionJson}}}]};
  if(sql.startsWith('SELECT ac.*'))return{rows:used?[{id:actualConsumption,scope_digest:scopeDigest,decision_id:decisionId,candidate_command_id:key,request_hash:hash(candidate),actor_id:uid,client_id:actor.clientId,control_generation:1,policy_id:uid,policy_version:1,policy_ref:policyRef,state:'APPLIED',result_ref:{status:'APPLIED'},operation:candidate.operation,expected_version:0,approval_consumption_id:actualConsumption,payload_ref:{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:scope.payloadHash,scopeDigest},approval_decision_ref:decisionId,command_id:actualServer,consumed_at:now}]:[]};
  if(sql.includes('FROM anvil.work_plan_approval_candidates'))return{rows:options.candidateMissing?[]:[{project_id:pid,request_id:requestId,request_command_id:serverId,candidate_command_id:key,payload_hash:scope.payloadHash,payload_json:payload,target_ref:null,created_by:uid,client_id:actor.clientId,control_generation:1,policy_ref:policyRef,request_key:requestId,request_hash:hash(requestCommand),request_operation:'requestApproval',request_actor:uid,request_client:uid}]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:[{id:uid,head_version:1,rules_json:rules,content_hash:policyRef.contentHash,reason:policy.reason,review_refs:[],created_at:now}]};
  if(sql.startsWith('SELECT actor_id,client_id,generation'))return{rows:[{actor_id:uid,client_id:actor.clientId,generation:options.stale?2:1,revoked_at:null}]};
  if(sql.includes('FROM anvil.documents')){targetReads.push(sql);return{rows:[{head_version:targetChanged?2:1,content_hash:ref.contentHash,form_code:sql.includes('form_code')&&targetReads.length%2===1?'AF04':'AF02',artifact_state:'READY'}]};}
  if(sql.includes('clock_timestamp()'))return{rows:[{at:now}]};
  if(sql.startsWith('INSERT INTO anvil.approval_consumptions')){used=true;actualConsumption=args[0];actualServer=args[3];writes.push(sql);return{rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE anvil.approval_requests')){status='CONSUMED';version=3;writes.push(sql);return{rows:[],rowCount:1};}
  throw Error('UNEXPECTED_SQL');
 }}as unknown as PoolClient;
 return{db,command:candidate,policyRef,writes,targetReads,requestCommand,details,advance:()=>{targetChanged=true;}};
}
return approved(options);
}

test('정확 일회 승인 소비와 WAITING 저장·역사 조회는 원 payload와 false flags를 보존한다',async()=>{
 const f=stageFixture(),a=approvalFixture(f.request,f.actor),db:any={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('SELECT r.*,c.operation')||sql.startsWith('SELECT d.*,c.operation')||sql.startsWith('SELECT ac.*')||sql.startsWith('SELECT actor_id,client_id,generation')||sql.startsWith('INSERT INTO anvil.approval_consumptions')||sql.startsWith('UPDATE anvil.approval_requests'))return a.db.query(sql,args);
  if(sql.includes('FROM anvil.permission_policies'))return a.db.query(sql,args);
  return f.db.query(sql,args);
 }};
 const policy=await authorizeMaterial(db,f.actor,a.command);const r:any=await f.service.start(db,f.actor,a.command,policy.ref);assert.equal(r.data.queueState,'WAITING');assert.equal(a.writes.length,2);assert.equal(f.rows.length,1);assert.deepEqual(f.rows[0].snapshot_json.input,a.command.payload);
 const q=await f.service.read(db,f.actor,f.pid);assert.equal(q.items.length,1);assert.deepEqual(q.items[0].requestRef,r.data.ref);
 const repo=new ProjectPolicyRepository({authenticated:async(_token:string,_csrf:string,cb:any)=>cb(db,f.actor)} as any);assert.deepEqual(await repo.command('synthetic','synthetic',a.command,()=>{throw Error('REPLAY_MUST_NOT_WRITE');}),r);assert.equal(f.rows.length,1);assert.equal(a.writes.length,2);
 const originalReads=f.calls.length;f.control(false);await assert.rejects(repo.command('synthetic','synthetic',a.command,()=>{throw Error('REPLAY_MUST_NOT_WRITE');}),{message:'PROJECT_CONTROL_REQUIRED',statusCode:403});assert.equal((await f.service.read(db,f.actor,f.pid)).items.length,1,'현재 제어 진행은 당시 소비 역사를 위조로 만들지 않는다');assert.ok(f.calls.length>originalReads);
 f.rows[0].snapshot_json.executionAuthorized=true;await assert.rejects(f.service.read(db,f.actor,f.pid),{message:'STAGE_QUEUE_LEDGER_INVALID',statusCode:503});
});

test('현재 정책/제어·기한·결정·원명령 변경은 일회소비 쓰기 없이 거절한다',async()=>{
 for(const options of [{stale:true},{deny:true},{expired:true},{rejected:true}]){const f=stageFixture(),a=approvalFixture(f.request,f.actor,options);await assert.rejects(authorizeMaterial(a.db,f.actor,a.command));assert.equal(a.writes.length,0);}
 for(const mutate of [(c:any)=>c.commandId=id(90),(c:any)=>c.clientId=id(90),(c:any)=>c.payload.reason='다른 사유',(c:any)=>c.payload.budgetRef=ref(90)]){const f=stageFixture(),a=approvalFixture(f.request,f.actor);mutate(a.command);await assert.rejects(authorizeMaterial(a.db,f.actor,a.command));assert.equal(a.writes.length,0);}
});
import {readFileSync} from 'node:fs';
test('0047 정적 반례: command 승인열을 NULL로 감춰도 receipt/소비/감사 관계가 deferred 완결검사에 진입한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0047_stage_start_one_time_approval.sql.pending',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const body=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn10_stage_start_approval_complete()'),sql.indexOf('CREATE CONSTRAINT TRIGGER fn10_stage_start_commands_complete'));
 const entry=body.slice(body.indexOf('approved='),body.indexOf('IF approved THEN'));
 assert.match(entry,/EXISTS\(SELECT 1 FROM anvil\.authorization_receipts[\s\S]*approval_decision_ref IS NOT NULL/,'receipt 단독 승인관계도 완결검사에 진입해야 한다');
 assert.match(entry,/EXISTS\(SELECT 1 FROM anvil\.approval_consumptions/,'소비 단독 관계도 완결검사에 진입해야 한다');
 assert.match(entry,/EXISTS\(SELECT 1 FROM anvil\.audit_events[\s\S]*approval_ref IS NOT NULL/,'감사 단독 승인관계도 완결검사에 진입해야 한다');
 assert.match(body,/did IS NULL OR b\.id IS NULL/);assert.match(body,/fn10_stage_start_approval_execution_valid\(pid,cid,did,true\) IS DISTINCT FROM true/);
});

function stageApprovalSql(){return readFileSync(new URL('../../../db/migrations/0047_stage_start_one_time_approval.sql.pending',import.meta.url),'utf8').replace(/\r\n/g,'\n');}
test('0047 정적 반례: 승인흔적 전부NULL인 APPLIED startStage도 stage_runs/queue_requests와 현재AUTO 또는 정확소비를 반드시 완결한다',()=>{
 const sql=stageApprovalSql(),body=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn10_stage_start_approval_complete()'),sql.indexOf('CREATE CONSTRAINT TRIGGER fn10_stage_start_commands_complete'));
 assert.match(body,/IF anvil\.fn10_stage_start_command_related\(pid,cid,c\.command_id,c\.operation\) THEN/);
 assert.match(body,/c\.operation IS DISTINCT FROM 'startStage'/);assert.match(body,/b\.id IS NULL/);assert.match(body,/queue_requests/);
 assert.match(body,/stage_queue_authorized_before_approval\(pid,'startStage'\) IS DISTINCT FROM true/,'승인열이 NULL이어도 REQUIRE/DENY는 AUTO로 완결할 수 없다');
});
test('0047 정적 반례: 다른operation이어도 원명령후보/승인scope/receipt/소비/감사/단계자료 중 한쪽이 startStage면 완결검사 대상이다',()=>{
 const sql=stageApprovalSql(),related=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn10_stage_start_command_related('),sql.indexOf('CREATE FUNCTION anvil.fn10_stage_start_approval_complete()'));
 assert.match(related,/candidate_command_id=externalid/);assert.match(related,/action_scope_json->>'operation'='startStage'/);
 for(const table of ['stage_runs','authorization_receipts','approval_consumptions','audit_events'])assert.ok(related.includes('anvil.'+table),table);
});
test('0047 정적 반례: 승인흔적이나operation을 UPDATE/DELETE로 지워도 OLD/NEW 관계 guard가 완결대상을 보존한다',()=>{
 const sql=stageApprovalSql(),command=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn10_stage_start_approval_command_immutable()'),sql.indexOf('CREATE TRIGGER fn10_stage_start_approval_command_immutable'));
 assert.match(command,/fn10_stage_start_command_related\(OLD\.project_id,OLD\.id,OLD\.command_id,OLD\.operation\)/);assert.match(command,/fn10_stage_start_command_related\(NEW\.project_id,NEW\.id,NEW\.command_id,NEW\.operation\)/);
 const links=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn10_stage_start_approval_link_immutable()'));assert.match(links,/c\.id IN\(old_command,new_command\)/);assert.match(links,/fn10_stage_start_command_related\(c\.project_id,c\.id,c\.command_id,c\.operation\)/);
});

test('승인 요청 저장만으로 queue/소비를 쓰지 않고 별도 요청명령의 정확 scope를 보존한다',async()=>{
 const f=stageFixture(),a=approvalFixture(f.request,f.actor),stored:any[]=[],db:any={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('SELECT 1 FROM anvil.'))return{rows:[],rowCount:0};
  if(sql.includes('FROM anvil.permission_policies'))return a.db.query(sql,args);
  if(sql.startsWith('INSERT INTO anvil.approval_requests')){stored.push(args);return{rows:[],rowCount:1};}
  return f.db.query(sql,args);
 }};
 const c={...a.requestCommand,payload:{details:a.details}} as ProjectCommand,result:any=await new ProjectApprovals().request(db,f.actor,c,a.policyRef);
 assert.equal(result.data.status,'APPROVAL_REQUESTED');assert.equal(stored.length,1);assert.equal(f.rows.length,0);assert.equal(a.writes.length,0);assert.equal(result.data.request.details.candidateCommandId,f.request.commandId);assert.equal(result.data.request.details.actionScope.payloadHash,hash(f.request.payload));
 assert.equal(result.data.request.details.actionScope.targetRef,null);assert.equal(result.data.request.details.actionScope.limitsRef,null);assert.deepEqual(f.request.payload,a.command.payload);
});

test('AUTO 원장도 receipt/audit 누락·복수감사·주체/command/hash 혼합을 보호조회에서 거절한다',async()=>{
 for(const change of [(c:any)=>c.authorization_subject_ref=null,(c:any)=>c.audit_count=0,(c:any)=>c.audit_count=2,(c:any)=>c.audit_actor_ref={kind:'HUMAN',userId:id(90)},(c:any)=>c.command_key=id(90),(c:any)=>c.payload_ref={kind:'ONE_TIME_APPROVAL_SCOPE'},(c:any)=>c.audit_approval_ref={requestId:id(90)},(c:any)=>c.state='UNKNOWN']){
  const f=stageFixture();await f.service.start(f.db,f.actor,f.request,f.policyRef);change([...f.commands.values()][0]);await assert.rejects(f.service.read(f.db,f.actor,f.pid),{message:'STAGE_QUEUE_LEDGER_INVALID',statusCode:503});assert.equal(f.rows.length,1);
 }
});

for(const field of ['commandId','operationId'] as const)test('영수증 식별자 불일치 '+field+'만 변조해도 정확 원명령 원장 조회를 거절한다',async()=>{
 const f=stageFixture();await f.service.start(f.db,f.actor,f.request,f.policyRef);const command=[...f.commands.values()][0];
 assert.equal((await f.service.read(f.db,f.actor,f.pid)).items.length,1,'정상 원장 선행 조회');
 const original=structuredClone(command.result_ref);command.result_ref[field]=id(91);
 assert.equal(command.command_key,f.request.commandId);assert.equal(command.operation_id,original.operationId);assert.deepEqual({...command.result_ref,[field]:original[field]},original,'영수증의 한 식별자만 변경한다');
 await assert.rejects(f.service.read(f.db,f.actor,f.pid),{message:'STAGE_QUEUE_LEDGER_INVALID',statusCode:503});assert.equal(f.rows.length,1);
});
