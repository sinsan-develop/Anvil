import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { authorizeMaterial, type ProjectCommand } from '../../../apps/server/modules/access/project-command.ts';
import type { AuthenticatedIdentity } from '../../../apps/server/modules/access/repository.ts';

const projectId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const actor: AuthenticatedIdentity = {
  actorId: projectId, clientId, serverOwner: false,
  credentialGeneration: 1, reauthUntil: null,
};

test('한도 신규 저장 REQUIRE_APPROVAL은 미연결 대신 명확 APPROVAL_REQUIRED/412로 별도 승인을 요구한다', async () => {
  const rules = [{
    ruleId: 'limit-policy-requires-one-time-approval',
    subjectRef: { kind: 'HUMAN', userId: actor.actorId },
    operations: ['applyLimitPolicy'],
    targetScopes: [{ kind: 'PROJECT', projectId }],
    disposition: 'REQUIRE_APPROVAL', limitPolicyRef: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
  }];
  const policy = { rules, reason: '합성 한도 정책 저장의 별도 승인', reviewRefs: [] };
  const queries: string[] = [];
  const db = {
    query: async (sql: string, values: unknown[]) => {
      queries.push(sql);
      assert.match(sql, /^SELECT .*FROM anvil\.permission_policies /);
      assert.deepEqual(values, [projectId]);
      return { rows: [{
        id: '33333333-3333-4333-8333-333333333333', head_version: 1,
        rules_json: rules, reason: policy.reason, review_refs: [],
        content_hash: contentHash(canonicalJson(policy)),
        created_at: new Date('2026-10-27T00:00:00.000Z'),
      }] };
    },
  } as unknown as PoolClient;
  const command: ProjectCommand = {
    schemaVersion: 1, projectId,
    commandId: '44444444-4444-4444-8444-444444444444',
    clientId, controlGeneration: 1, operation: 'applyLimitPolicy',
    targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null,
    payload: {
      limits: { maxAttempts: 3, maxElapsedMs: 7200000, maxCalls: 50,
        maxConcurrentAssignments: 1, maxSpoolBytes: 1073741824, maxOfflineMs: 300000 },
      scope: { kind: 'PROJECT', projectId },
      reason: '합성 한도 정책을 신규 저장한다', policyBaseVersion: 0,
    },
  };
  const original = structuredClone(command);

  await assert.rejects(authorizeMaterial(db, actor, command), {
    message: 'APPROVAL_REQUIRED', statusCode: 412,
  });

  assert.deepEqual(command, original, '승인 대기에서 원명령을 바꾸지 않는다');
  assert.equal(queries.length, 1, '승인 없이 자료·소비·영수증을 저장하지 않는다');
});

import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
import {ProjectLimitPolicies} from '../../../apps/server/modules/executions/runtime-policy.ts';
const runtime={ProjectLimitPolicies},pid=projectId,client=clientId;
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const id=(n:number)=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const policyRef={id:pid,version:1,contentHash:'b'.repeat(64)};
const limits=()=>({maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1073741824,maxOfflineMs:300000});
const input=()=>({limits:limits(),scope:{kind:'PROJECT',projectId:pid},reason:'합성 한도',policyBaseVersion:0});
function fixture() {
  assert.equal(typeof runtime.ProjectLimitPolicies, 'function');
  const rows: any[] = [], receipts = new Map<string, any>(); let member = true, archived = false, now = new Date('2026-10-19T02:00:00.000Z');
  const trace: string[] = [];
  const db: any = { query: async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT p.id,p.archived_at')) { trace.push(sql.includes('FOR UPDATE') ? 'LOCK' : 'MEMBER'); return { rows: member ? [{ id: pid, participation: 'OWNER', archived_at: archived ? now : null }] : [] }; }
    if (sql.startsWith('SELECT clock_timestamp()')) return { rows: [{ at: now }] };
    if (sql.startsWith('SELECT transaction_timestamp()')) return { rows: [{ at: now }] };
    if (sql.includes('FROM anvil.limit_policy_versions v')) {
      const found = rows.filter(r => r.project_id === p[0] && (sql.includes('v.scope_json=$2') ? canonicalJson(r.snapshot_json.scope) === canonicalJson(JSON.parse(p[1])) : r.policy_id === p[1] && r.version === p[2]));
      return { rows: (sql.includes('ORDER BY') ? found.sort((a,b) => b.version - a.version).slice(0,1) : found).map(r => ({ ...r, ...receipts.get(r.command_id) })) };
    }
    if (sql.startsWith('INSERT INTO anvil.commands')) { trace.push('COMMAND'); receipts.set(p[0], { server_command_id:p[0],operation_id:p[7],authorization_receipt_id:p[8],approval_consumption_id:p[9],expected_version:p[10],policy_ref:JSON.parse(p[12]),payload_ref:p[13]===null?null:JSON.parse(p[13]),receipt_rows:[],audit_rows:[],approval_rows:[],result_ref: JSON.parse(p[14]), operation: p[4], state: 'APPLIED', command_actor: p[2], command_client: p[3], request_hash: p[6], command_key: p[5], control_generation: p[11] }); return { rows: [] }; }
    if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){receipts.get(p[2]).receipt_rows.push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],command_id:p[2],subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6]});return{rows:[]};}
    if(sql.startsWith('INSERT INTO anvil.audit_events')){receipts.get(p[4]).audit_rows.push({project_id:p[0],actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),policy_ref:JSON.parse(p[7]),approval_ref:p[8]===null?null:JSON.parse(p[8]),scope_digest:p[10],outcome:'APPLIED',source_kind:'HUMAN_COMMAND'});return{rows:[]};}
    if(sql.startsWith('SELECT set_config'))return{rows:[]};
    if (sql.startsWith('INSERT INTO anvil.limit_policy_versions')) { trace.push('POLICY'); rows.push({ project_id: p[0], policy_id: p[1], version: p[2], content_hash: p[3], snapshot_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7] }); return { rows: [] }; }
    throw Error('UNEXPECTED_SQL ' + sql.slice(0,120));
  }};
  const command = (payload = input(), previous: any = null, operation = 'applyLimitPolicy'): any => ({ schemaVersion: 1, projectId: pid, commandId: crypto.randomUUID(), clientId: client, controlGeneration: 1, operation, targetId: previous?.id ?? null, expectedVersion: previous?.version ?? 0, baselineRefs: [], approvalRef: null, payload });
  return { store: new runtime.ProjectLimitPolicies() as any, db, command, rows, receipts, trace, deny: () => { member = false; }, archive: () => { archived = true; }, advance: () => { now = new Date(now.getTime() + 7200000); } };
}
function approvalFixture(command:ProjectCommand,actor:any,options:any={}){
 const pid=command.projectId,uid=actor.actorId,key=command.commandId,requestId=id(51),decisionId=id(52),serverId=id(53),consumptionId=id(54),documentId=id(55),at='2026-10-21T14:00:00.000Z',now=new Date(at);
function approved(options:{targetRef?:any;stale?:boolean;targetChanged?:boolean;deny?:boolean;expired?:boolean;rejected?:boolean;candidateMissing?:boolean;viewer?:boolean;pending?:boolean}={}) {
 const ref={id:documentId,version:1,contentHash:'a'.repeat(64)},payload=structuredClone(command.payload);
 const rules=[{ruleId:'SAVE',subjectRef:{kind:'HUMAN',userId:uid},operations:[command.operation],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:options.deny?'DENY':'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-10-21T00:00:00.000Z'}];
 const policy={rules,reason:'한 초안 저장',reviewRefs:[]},policyRef={id:uid,version:1,contentHash:hash(policy)};
 const scope={operation:command.operation,targetRef:options.targetRef??null,expectedVersion:command.expectedVersion,payloadHash:hash(payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:actor.clientId},controlGeneration:1};
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
  if(sql.startsWith('SELECT ac.*'))return{rows:used?[{id:actualConsumption,scope_digest:scopeDigest,decision_id:decisionId,candidate_command_id:key,request_hash:hash(candidate),actor_id:uid,client_id:actor.clientId,control_generation:1,policy_id:uid,policy_version:1,policy_ref:policyRef,state:'APPLIED',result_ref:{status:'APPLIED'},operation:candidate.operation,expected_version:command.expectedVersion,approval_consumption_id:actualConsumption,payload_ref:{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:scope.payloadHash,scopeDigest},approval_decision_ref:decisionId,command_id:actualServer,consumed_at:now}]:[]};
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


function combined(f:any,a:any){return{query:async(sql:string,args:any[]=[])=>{
 if(sql.startsWith('SELECT r.*,c.operation')||sql.startsWith('SELECT d.*,c.operation')||sql.startsWith('SELECT ac.*')||sql.startsWith('SELECT actor_id,client_id,generation')||sql.includes('FROM anvil.permission_policies')||sql.startsWith('UPDATE anvil.approval_requests'))return a.db.query(sql,args);
 if(sql.startsWith('INSERT INTO anvil.approval_consumptions')){const result=await a.db.query(sql,args);f.receipts.get(args[3]).approval_rows.push({id:args[0],requestId:(a.command.approvalRef as any).requestId,decisionId:args[2]});return result;}
 return f.db.query(sql,args);
}};}
for(const mode of ['NEW','REVISE','REVOKE'])test(mode+' 각 원명령의 별도 승인 소비·불변 버전과 역사 조회를 연결한다',async()=>{
 const f=fixture();let base:any=null;
 if(mode!=='NEW')base=(await f.store.apply(f.db,actor,f.command(),policyRef)).data.ref;
 const command=mode==='REVOKE'?f.command({scope:input().scope,reason:'회수',policyBaseVersion:1} as any,base,'revokeLimitPolicy'):f.command({...input(),policyBaseVersion:base?.version??0},base);
 const a=approvalFixture(command,actor,{targetRef:base}),db:any=combined(f,a);
 await authorizeMaterial(db,actor,a.command);
 const result=mode==='REVOKE'?await f.store.revoke(db,actor,a.command,a.policyRef):await f.store.apply(db,actor,a.command,a.policyRef);
 assert.equal(a.writes.length,2);assert.deepEqual(result.data.snapshot.previousRef,base);assert.equal(result.data.snapshot.executionAuthorized,false);
 const before=canonicalJson(result);assert.deepEqual((await f.store.read(db,actor,pid,result.data.ref.id,result.data.ref.version)).ref,result.data.ref);
 assert.equal(canonicalJson(result),before);
 // 역사 read는 현재 policy/control의 재인가 resolver를 호출하지 않는다.
 const historical:any={query:async(sql:string,args:any[])=>{if(sql.includes('FROM anvil.permission_policies')||sql.startsWith('SELECT actor_id,client_id,generation'))throw Error('HISTORY_MUST_NOT_REAUTHORIZE');return db.query(sql,args);}};
 assert.deepEqual((await f.store.read(historical,actor,pid,result.data.ref.id,result.data.ref.version)).ref,result.data.ref);
 const stored=f.receipts.get(f.rows.at(-1).command_id),original=structuredClone(stored);
 for(const mutate of [(x:any)=>x.result_ref.commandId=id(90),(x:any)=>x.result_ref.operationId=id(90),(x:any)=>x.receipt_rows=[],(x:any)=>x.audit_rows.push(structuredClone(x.audit_rows[0])),(x:any)=>x.approval_rows=[],(x:any)=>x.payload_ref.payloadHash='0'.repeat(64)]){
  Object.assign(stored,structuredClone(original));mutate(stored);await assert.rejects(f.store.read(db,actor,pid,result.data.ref.id,result.data.ref.version),/LIMIT_POLICY_INTEGRITY_FAILED/);
 }
});
test('현재 head fullref의 hash/버전/연산 혼합과 원명령 변경을 소비 전 거절한다',async()=>{
 const f=fixture(),base=(await f.store.apply(f.db,actor,f.command(),policyRef)).data.ref,c=f.command({...input(),policyBaseVersion:1},base);
 for(const targetRef of [{...base,contentHash:'0'.repeat(64)},null]){const a=approvalFixture(c,actor,{targetRef}),db:any=combined(f,a);await assert.rejects(authorizeMaterial(db,actor,a.command));assert.equal(a.writes.length,0);}
 for(const change of [(c:any)=>c.commandId=id(90),(c:any)=>c.payload.reason='다른 원문',(c:any)=>c.operation='revokeLimitPolicy']){const a=approvalFixture(c,actor,{targetRef:base});change(a.command);await assert.rejects(authorizeMaterial(combined(f,a) as any,actor,a.command));assert.equal(a.writes.length,0);}
});
test('AUTO/null 원장도 누락·중복 감사와 receipt command/operation 식별자 변조를 거절한다',async()=>{
 const f=fixture(),result=await f.store.apply(f.db,actor,f.command(),policyRef),stored=[...f.receipts.values()][0],original=structuredClone(stored);
 for(const change of [(c:any)=>c.result_ref.commandId=id(90),(c:any)=>c.result_ref.operationId=id(90),(c:any)=>c.receipt_rows=[],(c:any)=>c.audit_rows=[],(c:any)=>c.audit_rows[0].actor_ref.userId=id(90),(c:any)=>c.audit_rows[0].target_ref.contentHash='0'.repeat(64),(c:any)=>c.audit_rows.push(structuredClone(c.audit_rows[0]))]){
  Object.assign(stored,structuredClone(original));change(stored);await assert.rejects(f.store.read(f.db,actor,pid,result.data.ref.id,1),/LIMIT_POLICY_INTEGRITY_FAILED/);
 }
});
import {readFileSync} from 'node:fs';
test('0048 정적 계약: AUTO/승인 분기 전에 receipt와 audit의 전체 주체·대상·정책·scope를 공통 검사한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0048_limit_policy_one_time_approval.sql.pending',import.meta.url),'utf8');
 const common=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn10_limit_policy_approval_complete()'),sql.indexOf('  approved=c.approval_consumption_id'));
 for(const field of ['a.actor_ref','a.client_ref','a.target_ref','a.policy_ref','a.operation_id','a.outcome','a.source_kind','a.scope_digest','ar.subject_ref','ar.policy_ref','ar.scope_digest'])assert.ok(common.includes(field),field+'는 승인 여부와 무관하게 검증해야 한다');
 assert.ok(common.includes("'requestHash',c.request_hash"),'scope digest는 command 원열을 재구성한다');
});
