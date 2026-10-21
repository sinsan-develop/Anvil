import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { authorizeMaterial, type ProjectCommand } from '../../../apps/server/modules/access/project-command.ts';
import { ProjectApprovals } from '../../../apps/server/modules/approvals/project-approvals.ts';
const ids=Array.from({length:8},(_,i)=>`${i+1}`.repeat(8)+'-'+`${i+1}`.repeat(4)+'-4'+`${i+1}`.repeat(3)+'-8'+`${i+1}`.repeat(3)+'-'+`${i+1}`.repeat(12));
const [pid,uid,requestId,decisionId,key,serverId,consumptionId,documentId]=ids as [string,string,string,string,string,string,string,string];
const at='2026-10-21T00:00:00.000Z', now=new Date(at), hash=(v:unknown)=>contentHash(canonicalJson(v));
const actor={actorId:uid,clientId:uid,serverOwner:false,credentialGeneration:1,reauthUntil:null};
function fixture(options:{stale?:boolean;targetChanged?:boolean;deny?:boolean;expired?:boolean;rejected?:boolean;candidateMissing?:boolean;viewer?:boolean;pending?:boolean}={}) {
 const ref={id:documentId,version:1,contentHash:'a'.repeat(64)},payload={documentRef:ref,designRef:{...ref,id:pid},screenReviewRefs:[],tasks:[],reason:' 원 입력 보존 '};
 const rules=[{ruleId:'SAVE',subjectRef:{kind:'HUMAN',userId:uid},operations:['saveWorkPlanDraft'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:options.deny?'DENY':'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-10-21T00:00:00.000Z'}];
 const policy={rules,reason:'한 초안 저장',reviewRefs:[]},policyRef={id:uid,version:1,contentHash:hash(policy)};
 const scope={operation:'saveWorkPlanDraft',targetRef:null,expectedVersion:0,payloadHash:hash(payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:1};
 const scopeDigest=hash(scope),details={reason:'한 초안',risks:{data:'초안',security:'확인',cost:'없음',interruption:'없음',unverified:'합성'},rollback:{method:'과거 보존',limitations:'삭제 아님',evidenceRefs:[]},expiresAt:options.expired?'2026-10-20T00:00:00.000Z':'2099-10-21T00:00:00.000Z',actionScope:scope,candidateCommandId:key};
 const snapshot={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:uid},policyRef,requestedBy:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:1};
 const requestRef={id:requestId,version:1,contentHash:hash(snapshot)},request={id:requestId,version:1,status:'PENDING',...snapshot,createdAt:at};
 const requestCommand={schemaVersion:1,projectId:pid,commandId:requestId,clientId:uid,controlGeneration:1,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details,candidatePayload:payload}};
 const decision=options.rejected?'REJECT':'APPROVE',body={requestId,requestVersion:1,requestRef,scopeDigest,decision,reason:'사람 확인',decidedBy:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:1,policyRef};
 const decisionRef={id:decisionId,version:1,contentHash:hash(body)},decisionJson={id:decisionId,...body,decidedAt:at};
 const command:ProjectCommand={schemaVersion:1,projectId:pid,commandId:key,clientId:uid,controlGeneration:1,operation:'saveWorkPlanDraft',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:{requestId,decisionId,scopeDigest},payload};
 let used=false,status=options.pending?'PENDING':options.rejected?'REJECTED':'APPROVED',version=options.pending?1:2,targetChanged=!!options.targetChanged;
 const writes:string[]=[],targetReads:string[]=[];
 const db={query:async(sql:string)=>{
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:pid,participation:options.viewer?'VIEWER':'OWNER',archived_at:null}]};
  if(sql.startsWith('SELECT r.*,c.operation'))return{rows:[{id:requestId,command_id:serverId,request_json:request,created_at:now,created_by:uid,client_id:uid,actor_id:uid,command_client:uid,content_hash:requestRef.contentHash,operation:'requestApproval',result_ref:{status:'APPLIED',data:{ref:requestRef,status:'APPROVAL_REQUESTED',request}},policy_ref:policyRef,details_json:details,candidate_command_id:key,action_scope_json:scope,scope_digest:scopeDigest,required_decider_ref:snapshot.requiredDecider,expires_at:new Date(details.expiresAt),status,version}]};
  if(sql.startsWith('SELECT d.*,c.operation'))return{rows:options.pending?[]:[{id:decisionId,decision_json:decisionJson,decided_at:now,request_version:1,scope_digest:scopeDigest,decision,reason:body.reason,decided_by:uid,client_id:uid,actor_id:uid,command_client:uid,control_generation:1,expected_version:1,operation:'decideApproval',content_hash:decisionRef.contentHash,result_ref:{status:'APPLIED',data:{ref:decisionRef,status:'APPROVAL_DECIDED',decision:decisionJson}}}]};
  if(sql.startsWith('SELECT ac.*'))return{rows:used?[{id:consumptionId,scope_digest:scopeDigest,decision_id:decisionId,candidate_command_id:key,request_hash:hash(command),actor_id:uid,client_id:uid,control_generation:1,policy_id:uid,policy_version:1,policy_ref:policyRef,state:'APPLIED',result_ref:{status:'APPLIED'},operation:command.operation,expected_version:0,approval_consumption_id:consumptionId,payload_ref:{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:scope.payloadHash,scopeDigest},approval_decision_ref:decisionId,command_id:serverId,consumed_at:now}]:[]};
  if(sql.includes('FROM anvil.work_plan_approval_candidates'))return{rows:options.candidateMissing?[]:[{project_id:pid,request_id:requestId,request_command_id:serverId,candidate_command_id:key,payload_hash:scope.payloadHash,payload_json:payload,target_ref:null,created_by:uid,client_id:uid,control_generation:1,policy_ref:policyRef,request_key:requestId,request_hash:hash(requestCommand),request_operation:'requestApproval',request_actor:uid,request_client:uid}]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:[{id:uid,head_version:1,rules_json:rules,content_hash:policyRef.contentHash,reason:policy.reason,review_refs:[],created_at:now}]};
  if(sql.startsWith('SELECT actor_id,client_id,generation'))return{rows:[{actor_id:uid,client_id:uid,generation:options.stale?2:1,revoked_at:null}]};
  if(sql.includes('FROM anvil.documents')){targetReads.push(sql);return{rows:[{head_version:targetChanged?2:1,content_hash:ref.contentHash,form_code:sql.includes('form_code')&&targetReads.length%2===1?'AF04':'AF02',artifact_state:'READY'}]};}
  if(sql.includes('clock_timestamp()'))return{rows:[{at:now}]};
  if(sql.startsWith('INSERT INTO anvil.approval_consumptions')){used=true;writes.push(sql);return{rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE anvil.approval_requests')){status='CONSUMED';version=3;writes.push(sql);return{rows:[],rowCount:1};}
  throw Error('UNEXPECTED_SQL');
 }}as unknown as PoolClient;
 return{db,command,policyRef,writes,targetReads,requestCommand,details,advance:()=>{targetChanged=true;}};
}
test('정확 입력의 저장 승인만 기존 consume에 연결하고 소비 후 exact 재송신에는 새 CAS를 요구하지 않는다',async()=>{
 const f=fixture(),repo=new ProjectApprovals();
 await authorizeMaterial(f.db,actor,f.command);assert(f.targetReads.length>0,'새 집행은 원 기준을 검사한다');
 await repo.consume(f.db,actor,f.command,f.policyRef,serverId,consumptionId);assert.equal(f.writes.length,2);
 const n=f.targetReads.length;f.advance();assert.equal((await repo.authorize(f.db,actor,f.command,f.policyRef)).replay,true);assert.equal(f.targetReads.length,n);
 await assert.rejects(repo.consume(f.db,actor,f.command,f.policyRef,serverId,consumptionId),/APPROVAL_ALREADY_CONSUMED/);assert.equal(f.writes.length,2);
});
test('현재 권한·기한·세대·후보 누락·변경 기준은 소비 쓰기 없이 거절한다',async()=>{
 for(const options of [{stale:true},{targetChanged:true},{deny:true},{expired:true},{rejected:true},{candidateMissing:true},{viewer:true}]){
  const f=fixture(options);await assert.rejects(authorizeMaterial(f.db,actor,f.command));assert.equal(f.writes.length,0);
 }
});
test('원문의 이유/명령ID/대상을 바꾸면 같은 승인을 소비할 수 없다',async()=>{
 for(const change of [{payload:{reason:'다른 입력'}},{commandId:requestId},{targetId:pid}]){
  const f=fixture();await assert.rejects(new ProjectApprovals().consume(f.db,actor,{...f.command,...change},f.policyRef,serverId,consumptionId));assert.equal(f.writes.length,0);
 }
});
test('승인 상세는 요청자가 확인할 정확 원입력을 반환한다',async()=>{
 const f=fixture(),view=await new ProjectApprovals().read(f.db,actor,pid,requestId);
 assert.deepEqual((view as unknown as {candidatePlan:unknown}).candidatePlan,{candidateCommandId:key,payloadHash:hash(f.command.payload),payload:f.command.payload});
});
test('요청은 원 payload를 같은 요청명령·정책 영수증에 보관하고 다른 연산에는 추가 필드를 허용하지 않는다',async()=>{
 const f=fixture(),events:{sql:string;args:unknown[]}[]=[];
 const db={query:async(sql:string,args:unknown[]=[])=>{
  if(sql.includes('transaction_timestamp()'))return{rows:[{at:now}]};
  if(sql.startsWith('SELECT 1 FROM anvil.'))return{rows:[],rowCount:0};
  if(sql.startsWith('INSERT INTO anvil.')||sql.includes("set_config('anvil.actor_id'")){events.push({sql,args});return{rows:[],rowCount:1};}
  return f.db.query(sql,args);
 }}as unknown as PoolClient;
 const result=await new ProjectApprovals().request(db,actor,f.requestCommand as ProjectCommand,f.policyRef);
 assert.equal((result.data as Record<string,unknown>).status,'APPROVAL_REQUESTED');
 const request=events.find(e=>e.sql.startsWith('INSERT INTO anvil.approval_requests'))!,candidate=events.find(e=>e.sql.startsWith('INSERT INTO anvil.work_plan_approval_candidates'))!;
 assert.ok(candidate,'승인 요청만 저장하고 원 후보를 빠뜨리면 안 된다');assert.equal(candidate.args[1],request.args[0]);assert.equal(candidate.args[2],request.args[10]);assert.deepEqual(JSON.parse(candidate.args[5] as string),f.command.payload);
 assert.deepEqual(JSON.parse(candidate.args[10] as string),f.policyRef);
 const before=events.length;
 for(const payload of [{details:f.details},{...f.requestCommand.payload,extra:true},{...f.requestCommand.payload,details:{...f.details,actionScope:{...f.details.actionScope,operation:'uploadArtifact'}}}])
  await assert.rejects(new ProjectApprovals().request(db,actor,{...f.requestCommand,payload} as ProjectCommand,f.policyRef),/APPROVAL_INPUT_INVALID/);
 assert.equal(events.length,before);
});
test('별도 결정 메서드는 원후보를 다시 읽고 기준이 진행됐으면 결정 영수증을 쓰지 않는다',async()=>{
 for(const changed of [false,true]){const f=fixture({pending:true,targetChanged:changed}),writes:string[]=[];
  const db={query:async(sql:string,args:unknown[]=[])=>{if(sql.includes('transaction_timestamp()'))return{rows:[{at:now}]};if(sql.startsWith('INSERT INTO anvil.')||sql.startsWith('UPDATE anvil.approval_requests')||sql.includes("set_config('anvil.actor_id'")){writes.push(sql);return{rows:[],rowCount:1};}return f.db.query(sql,args);}}as unknown as PoolClient;
  const c:ProjectCommand={...f.command,commandId:decisionId,operation:'decideApproval',targetId:requestId,expectedVersion:1,approvalRef:null,payload:{requestId,expectedVersion:1,scopeDigest:(f.command.approvalRef as {scopeDigest:string}).scopeDigest,decision:'APPROVE',reason:'전체 입력을 읽고 별도 결정'}};
  if(changed){await assert.rejects(new ProjectApprovals().decide(db,actor,c,f.policyRef),/APPROVAL_TARGET_CHANGED/);assert.equal(writes.length,0);}
  else{const result=await new ProjectApprovals().decide(db,actor,c,f.policyRef);assert.equal((result.data as Record<string,unknown>).status,'APPROVAL_DECIDED');assert(writes.some(s=>s.startsWith('INSERT INTO anvil.approval_decisions')));assert(f.targetReads.length>0);}
 }
});
