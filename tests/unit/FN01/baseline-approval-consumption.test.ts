import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { authorizeMaterial, type ProjectCommand } from '../../../apps/server/modules/access/project-command.ts';

const id = (n: number) => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
const actor = baselineActor;

test('기준선 세 연산은 명시 REQUIRE_APPROVAL에서 원명령 승인 필요를 알리고 쓰지 않는다', async () => {
 for (const operation of ['saveBaselineDraft', 'reviewBaselineContent', 'confirmBaseline']) {
  let writes = 0;
  const rules = [{ ruleId: 'BASELINE', subjectRef: { kind: 'HUMAN', userId: actor.actorId }, operations: [operation], targetScopes: [{ kind: 'PROJECT', projectId: id(1) }], disposition: 'REQUIRE_APPROVAL', limitPolicyRef: null, expiresAt: '2099-01-01T00:00:00.000Z' }];
  const db: any = { query: async (sql: string) => {
   if (!sql.startsWith('SELECT')) { writes++; throw Error('UNEXPECTED_WRITE'); }
   assert.ok(sql.includes('FROM anvil.permission_policies p'));
   return { rows: [{ id: id(4), head_version: 1, rules_json: rules, reason: '기준선 별도 승인', review_refs: [], created_at: new Date('2026-10-27T00:00:00.000Z'), content_hash: contentHash(canonicalJson({ rules, reason: '기준선 별도 승인', reviewRefs: [] })) }] };
  } };
  const command: ProjectCommand = { schemaVersion: 1, projectId: id(1), commandId: id(20), clientId: actor.clientId, controlGeneration: 1, operation, targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: {} };
  await assert.rejects(authorizeMaterial(db, actor, command), { message: 'APPROVAL_REQUIRED', statusCode: 412 }, operation);
  assert.equal(writes, 0);
 }
});

import type {PoolClient} from 'pg';
import {ProjectBaselines} from '../../../apps/server/modules/projects/project-baselines.ts';
import {baselineStoreFixture,baselineInput,baselineActor} from './baseline-store-fixture.ts';
import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
const pid=id(1),uid=actor.actorId,cid=actor.clientId,requestId=id(7),decisionId=id(8),serverId=id(9),consumptionId=id(10),at='2026-10-27T00:00:00.000Z',now=new Date(at),hash=(v:unknown)=>contentHash(canonicalJson(v));
function consumptionFixture(operation:string,disposition='REQUIRE_APPROVAL',options:{stale?:boolean;expired?:boolean;rejected?:boolean;payload?:any}={}){
 const target=operation==='saveBaselineDraft'?null:{id:id(40),version:1,contentHash:'a'.repeat(64)};const payload=options.payload??(operation==='saveBaselineDraft'?{baseRef:null,reason:'처음 초안'}:{draftRef:target,reason:'정확 내용'});
 const rules=[{ruleId:'EXPORT',subjectRef:{kind:'HUMAN',userId:uid},operations:[operation],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition,limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],policy={rules,reason:'한 원본 승인',reviewRefs:[]},policyRef={id:uid,version:1,contentHash:hash(policy)};
 const scope={operation,targetRef:target,expectedVersion:target?.version??0,payloadHash:hash(payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1},scopeDigest=hash(scope),details={reason:'한 원본',risks:{data:'보존',security:'확인',cost:'없음',interruption:'없음',unverified:'합성'},rollback:{method:'보존',limitations:'별도',evidenceRefs:[]},expiresAt:options.expired?'2026-10-26T00:00:00.000Z':'2099-01-01T00:00:00.000Z',actionScope:scope,candidateCommandId:id(6)};
 const snapshot={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:uid},policyRef,requestedBy:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1},requestRef={id:requestId,version:1,contentHash:hash(snapshot)},request={id:requestId,version:1,status:'PENDING',...snapshot,createdAt:at};
 const decision=options.rejected?'REJECT':'APPROVE',body={requestId,requestVersion:1,requestRef,scopeDigest,decision,reason:'사람 확인',decidedBy:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1,policyRef},decisionRef={id:decisionId,version:1,contentHash:hash(body)},decisionJson={id:decisionId,...body,decidedAt:at};
 const command:ProjectCommand={schemaVersion:1,projectId:pid,commandId:id(6),clientId:cid,controlGeneration:1,operation,targetId:target?.id??null,expectedVersion:target?.version??0,baselineRefs:[],approvalRef:{requestId,decisionId,scopeDigest},payload};
 let used=false,usedConsumptionId=consumptionId,usedServerId=serverId;const writes:string[]=[];
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM anvil.permission_policies'))return{rows:[{id:uid,head_version:1,rules_json:rules,content_hash:policyRef.contentHash,reason:policy.reason,review_refs:[],created_at:now}]};
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:pid,participation:'OWNER',archived_at:null}]};
  if(sql.startsWith('SELECT r.*,c.operation'))return{rows:[{id:requestId,command_id:serverId,request_json:request,created_at:now,created_by:uid,client_id:cid,actor_id:uid,command_client:cid,content_hash:requestRef.contentHash,operation:'requestApproval',result_ref:{status:'APPLIED',data:{ref:requestRef,status:'APPROVAL_REQUESTED',request}},policy_ref:policyRef,details_json:details,candidate_command_id:command.commandId,action_scope_json:scope,scope_digest:scopeDigest,required_decider_ref:snapshot.requiredDecider,expires_at:new Date(details.expiresAt),status:used?'CONSUMED':options.rejected?'REJECTED':'APPROVED',version:used?3:2}]};
  if(sql.startsWith('SELECT d.*,c.operation'))return{rows:[{id:decisionId,decision_json:decisionJson,decided_at:now,request_version:1,scope_digest:scopeDigest,decision,reason:body.reason,decided_by:uid,client_id:cid,actor_id:uid,command_client:cid,control_generation:1,expected_version:1,operation:'decideApproval',content_hash:decisionRef.contentHash,result_ref:{status:'APPLIED',data:{ref:decisionRef,status:'APPROVAL_DECIDED',decision:decisionJson}}}]};
  if(sql.startsWith('SELECT ac.*'))return{rows:used?[{id:usedConsumptionId,scope_digest:scopeDigest,decision_id:decisionId,candidate_command_id:command.commandId,request_hash:hash(command),actor_id:uid,client_id:cid,control_generation:1,policy_id:uid,policy_version:1,policy_ref:policyRef,state:'APPLIED',result_ref:{status:'APPLIED'},operation,expected_version:command.expectedVersion,approval_consumption_id:usedConsumptionId,payload_ref:{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:scope.payloadHash,scopeDigest},approval_decision_ref:decisionId,command_id:usedServerId,consumed_at:now}]:[]};
  if(sql.startsWith('SELECT actor_id,client_id,generation'))return{rows:[{actor_id:uid,client_id:cid,generation:options.stale?2:1,revoked_at:null}]};
  if(sql.includes('clock_timestamp()'))return{rows:[{at:now}]};
  if(sql.startsWith('INSERT INTO anvil.approval_consumptions')){used=true;usedConsumptionId=args[0];usedServerId=args[3];writes.push(sql);return{rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE anvil.approval_requests')){writes.push(sql);return{rows:[],rowCount:1};}
  throw Error('UNEXPECTED_SQL: '+sql);
 }}as unknown as PoolClient;return{db,command,policyRef,writes,details};
}

for(const operation of ['saveBaselineDraft','reviewBaselineContent','confirmBaseline']) {
 test(operation+' 정확 승인만 1회 소비하고 같은 원명령 replay를 허용한다',async()=>{
  const f=consumptionFixture(operation),repo=new ProjectApprovals();await authorizeMaterial(f.db,actor,f.command);
  await repo.consume(f.db,actor,f.command,f.policyRef,serverId,consumptionId);assert.equal(f.writes.length,2);
  assert.equal((await repo.authorize(f.db,actor,f.command,f.policyRef)).replay,true);
  await assert.rejects(repo.consume(f.db,actor,f.command,f.policyRef,serverId,consumptionId),/APPROVAL_ALREADY_CONSUMED/);
  for(const changed of [{...f.command,commandId:id(99)},{...f.command,payload:{...f.command.payload,reason:'다른 이유'}},{...f.command,operation:operation==='confirmBaseline'?'reviewBaselineContent':'confirmBaseline'}])await assert.rejects(repo.authorize(f.db,actor,changed,f.policyRef));
  assert.equal(f.writes.length,2);
 });
 test(operation+' 만료·거절·현재 제어 변경은 소비하지 않으며 합법 과거소비 이력은 읽는다',async()=>{
  for(const options of [{stale:true},{expired:true},{rejected:true}]){const f=consumptionFixture(operation,'REQUIRE_APPROVAL',options);await assert.rejects(new ProjectApprovals().consume(f.db,actor,f.command,f.policyRef,serverId,consumptionId));assert.equal(f.writes.length,0);}
  const options={stale:false},f=consumptionFixture(operation,'REQUIRE_APPROVAL',options),repo=new ProjectApprovals();await repo.consume(f.db,actor,f.command,f.policyRef,serverId,consumptionId);options.stale=true;
  const old=await repo.read(f.db,actor,pid,requestId);assert.equal(old.storedStatus,'CONSUMED');assert.equal(old.basisCurrent,false);assert.equal(old.consumption!.commandId,f.command.commandId);
 });
}

test('승인 초안은 실제 baseline repository 저장·정확 재조회로 소비 receipt를 재구성하고 현재 제어 변경 뒤에도 불변 이력을 읽는다',async()=>{
 const options={payload:baselineInput(),stale:false},approval=consumptionFixture('saveBaselineDraft','REQUIRE_APPROVAL',options),f=baselineStoreFixture();
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('SELECT r.*,c.operation')||sql.startsWith('SELECT d.*,c.operation')||sql.startsWith('SELECT ac.*')||sql.includes('FROM anvil.permission_policies')||sql.startsWith('SELECT actor_id,client_id,generation')||sql.includes('clock_timestamp()')||sql.startsWith('INSERT INTO anvil.approval_consumptions')||sql.startsWith('UPDATE anvil.approval_requests'))return approval.db.query(sql,args);
  const result=await f.db.query(sql,args);
  if(sql.startsWith('INSERT INTO anvil.commands'))Object.assign(f.commands.get(args[0]),{approval_consumption_id:args[9],payload_ref:JSON.parse(args[13])});
  if(sql.includes('FROM anvil.baseline_draft_versions v'))for(const row of result.rows)Object.assign(row,{baseline_request_id:requestId,baseline_decision_id:decisionId,approval_decision_ref:decisionId,audit_approval_ref:approval.command.approvalRef});
  return result;
 }} as unknown as PoolClient;
 const store=new ProjectBaselines(f.sources,f.documents),saved=await store.save(db,actor,approval.command,approval.policyRef),ref=(saved.data as any).ref;
 assert.equal(approval.writes.length,2);assert.equal(f.versions.size,1);
 assert.deepEqual((await store.readDraft(db,actor,pid,ref.id,ref.version)).ref,ref);
 options.stale=true;assert.deepEqual((await store.readDraft(db,actor,pid,ref.id,ref.version)).ref,ref);
 assert.equal(f.versions.size,1);assert.equal(approval.writes.length,2);
});
