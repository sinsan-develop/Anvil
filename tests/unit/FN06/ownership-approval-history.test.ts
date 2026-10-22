import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
const id=(n:number)=>`50000000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash=(v:unknown)=>contentHash(canonicalJson(v));
const actor={actorId:id(1),clientId:id(2),serverOwner:false,credentialGeneration:1,reauthUntil:null},pid=id(3),at='2026-10-23T00:00:00.000Z',now=new Date(at);
function fixture(){
 const rules=[{ruleId:'PREPARE',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['prepareOwnershipAnchor'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2050-01-01T00:00:00.000Z'}],policy={rules,reason:'synthetic',reviewRefs:[]},policyRef={id:id(4),version:1,contentHash:hash(policy)},payload={intent:{purpose:'SYNTHETIC_ORIGINAL_PREPARATION'}},scope={operation:'prepareOwnershipAnchor',targetRef:null,expectedVersion:0,payloadHash:hash(payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:1},scopeDigest=hash(scope);
 const details={reason:'한 준비',risks:{data:'이력',security:'확인',cost:'없음',interruption:'없음',unverified:'합성'},rollback:{method:'이력 보존',limitations:'실행 아님',evidenceRefs:[]},expiresAt:'2050-01-01T00:00:00.000Z',actionScope:scope,candidateCommandId:id(5)},snapshot={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:actor.actorId},policyRef,requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:1},requestRef={id:id(6),version:1,contentHash:hash(snapshot)},request={id:id(6),version:1,status:'PENDING',...snapshot,createdAt:at};
 const body={requestId:id(6),requestVersion:1,requestRef,scopeDigest,decision:'APPROVE',reason:'원 준비만',decidedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:1,policyRef},decisionRef={id:id(7),version:1,contentHash:hash(body)},decision={id:id(7),...body,decidedAt:at};
 const command={schemaVersion:1 as const,projectId:pid,commandId:id(5),clientId:actor.clientId,controlGeneration:1,operation:'prepareOwnershipAnchor',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:{requestId:id(6),decisionId:id(7),scopeDigest},payload};
 const row:any={id:id(6),command_id:id(10),request_json:request,created_at:now,created_by:actor.actorId,client_id:actor.clientId,actor_id:actor.actorId,command_client:actor.clientId,content_hash:requestRef.contentHash,operation:'requestApproval',result_ref:{status:'APPLIED',data:{ref:requestRef,status:'APPROVAL_REQUESTED',request}},policy_ref:policyRef,details_json:details,candidate_command_id:id(5),action_scope_json:scope,scope_digest:scopeDigest,required_decider_ref:snapshot.requiredDecider,expires_at:new Date(details.expiresAt),status:'CONSUMED',version:3};
 const saved:any={id:id(7),decision_json:decision,decided_at:now,request_version:1,scope_digest:scopeDigest,decision:'APPROVE',reason:body.reason,decided_by:actor.actorId,client_id:actor.clientId,actor_id:actor.actorId,command_client:actor.clientId,control_generation:1,expected_version:1,operation:'decideApproval',content_hash:decisionRef.contentHash,result_ref:{status:'APPLIED',data:{ref:decisionRef,status:'APPROVAL_DECIDED',decision}}};
 const used:any={id:id(8),scope_digest:scopeDigest,decision_id:id(7),candidate_command_id:id(5),request_hash:hash(command),actor_id:actor.actorId,client_id:actor.clientId,control_generation:1,policy_id:policyRef.id,policy_version:1,policy_ref:policyRef,state:'APPLIED',result_ref:{status:'APPLIED'},operation:'prepareOwnershipAnchor',expected_version:0,approval_consumption_id:id(8),payload_ref:{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:scope.payloadHash,scopeDigest},approval_decision_ref:id(7),command_id:id(9),consumed_at:now};
 const control={actor_id:actor.actorId,client_id:actor.clientId,generation:1,revoked_at:null},member={id:pid,participation:'OWNER',archived_at:null};let consumed=true,latePolicy=false,clockAt=now;const queries:string[]=[];
 const db={async query(sql:string,args:any[]=[]){queries.push(sql);
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members')){assert.deepEqual(args,[pid,actor.actorId]);return{rows:[member]};}
  if(sql.startsWith('SELECT r.*,c.operation')){assert.deepEqual(args,[pid,id(6)]);return{rows:[row]};}
  if(sql.startsWith('SELECT d.*,c.operation'))return{rows:[saved]};
  if(sql.startsWith('SELECT ac.*'))return{rows:consumed?[used]:[]};
  if(sql.includes('FROM anvil.permission_policies')){if(latePolicy)clockAt=new Date(details.expiresAt);return{rows:[{id:policyRef.id,head_version:1,rules_json:rules,content_hash:policyRef.contentHash,reason:policy.reason,review_refs:[],created_at:now}]};}
  if(sql.startsWith('SELECT actor_id,client_id,generation'))return{rows:[control]};
  if(sql.includes('clock_timestamp()'))return{rows:[{at:clockAt}]};
  throw Error('UNEXPECTED_READ_ONLY_QUERY');
 }} as unknown as PoolClient;
 const read=async()=>{const repo=new ProjectApprovals() as any;assert.equal(typeof repo.readOwnershipPreparationConsumption,'function','별도 준비 소비 이력 읽기가 필요하다');return repo.readOwnershipPreparationConsumption(db,actor,pid,id(6));};
 return{read,db,row,saved,used,control,member,command,requestRef,decisionRef,queries,pending(){consumed=false;row.status='APPROVED';row.version=2;},delayPolicy(){latePolicy=true;},expire(){details.expiresAt=new Date(now.getTime()+1).toISOString();row.expires_at=new Date(details.expiresAt);requestRef.contentHash=hash(snapshot);row.content_hash=requestRef.contentHash;decisionRef.contentHash=hash(body);saved.content_hash=decisionRef.contentHash;clockAt=new Date(now.getTime()+2);}};
}

test('별도 준비 소비 이력은 exact 원 후보/서버 명령/hash와 현재 basis를 읽고 권한을 만들지 않는다',async()=>{
 const f=fixture(),v=await f.read();assert.equal(v.purpose,'OWNERSHIP_PREPARATION_APPROVAL_HISTORY_ONLY');assert.equal(v.executionAuthorized,false);assert.equal(v.preparationAuthorized,false);assert.equal(v.observationRequestAuthorized,false);assert.equal(v.dispatchPerformed,false);assert.deepEqual(v.requestRef,f.requestRef);assert.deepEqual(v.decisionRef,f.decisionRef);assert.deepEqual(v.commandRef,{id:id(9),version:1,contentHash:hash(f.command)});assert.equal(v.consumptionId,id(8));assert.equal(v.candidateCommandId,id(5));assert(f.queries.every(q=>q.startsWith('SELECT')));
});

test('일반 승인 getter/authorize는 prepare operation을 새로 허용하지 않는다',async()=>{
 const f=fixture();await f.read();const repo=new ProjectApprovals();await assert.rejects(repo.read(f.db,actor,pid,id(6)));await assert.rejects(repo.authorize(f.db,actor,f.command,{id:id(4),version:1,contentHash:'a'.repeat(64)}));assert(f.queries.every(q=>q.startsWith('SELECT')));
});

test('미소비·옛 제어·만료·VIEWER·다른 소비 명령과 요청/결정 변조를 거절한다',async()=>{
 for(const change of [(f:any)=>f.pending(),(f:any)=>f.control.generation=2,(f:any)=>f.expire(),(f:any)=>f.member.participation='VIEWER',(f:any)=>f.used.candidate_command_id=id(99),(f:any)=>f.used.approval_consumption_id=id(99),(f:any)=>f.saved.content_hash='a'.repeat(64),(f:any)=>f.row.content_hash='a'.repeat(64),(f:any)=>f.used.operation='queueExecutionCommand']){const f=fixture();change(f);await assert.rejects(f.read(),{message:'OWNERSHIP_APPROVAL_HISTORY_UNAVAILABLE'});}
});

test('첫 시각 뒤 정책 조회 대기 중 기한이 끝나면 소비 이력을 현재로 반환하지 않는다',async()=>{
 const f=fixture();f.delayPolicy();await assert.rejects(f.read(),{message:'OWNERSHIP_APPROVAL_HISTORY_UNAVAILABLE'});
});
