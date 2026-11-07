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

test('총괄 역할 정의 REQUIRE_APPROVAL은 미연결 대신 APPROVAL_REQUIRED/412로 별도 승인을 요구한다', async () => {
  const rules = [{
    ruleId: 'responsible-role-requires-one-time-approval',
    subjectRef: { kind: 'HUMAN', userId: actor.actorId },
    operations: ['defineProjectRole'],
    targetScopes: [{ kind: 'PROJECT', projectId }],
    disposition: 'REQUIRE_APPROVAL', limitPolicyRef: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
  }];
  const policy = { rules, reason: '합성 총괄 역할 정의의 별도 승인', reviewRefs: [] };
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
    clientId, controlGeneration: 1, operation: 'defineProjectRole',
    targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null,
    payload: { kind: 'COORDINATOR', stageRef: null, parentRoleRef: null, reason: '프로젝트 총괄 역할을 정의한다' },
  };
  const original = structuredClone(command);

  await assert.rejects(authorizeMaterial(db, actor, command), {
    message: 'APPROVAL_REQUIRED', statusCode: 412,
  });

  assert.deepEqual(command, original, '승인 대기에서 원명령을 바꾸지 않는다');
  assert.equal(queries.length, 1, '승인 없이 역할·세션·결박·소비·영수증을 저장하지 않는다');
});

import {ResponsibleSessions} from '../../../apps/server/modules/assignments/responsible-sessions.ts';
import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
const subject:any={ResponsibleSessions};const pid=projectId,ref={id:projectId,version:1,contentHash:'a'.repeat(64)};
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const id=(n:number)=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
function storeFixture() {
  assert.equal(typeof subject.ResponsibleSessions, 'function');
  const roles: any[] = [], bindings: any[] = [], sessions: any[] = [], commands = new Map<string, any>();
  const application: any = { projectId: pid, applicationRef: ref, snapshot: { graph: { nodes: [{ nodeId: 'IMPLEMENT', kind: 'AGENT', role: 'STAGE_OWNER' }] } } };
  const assignment: any = { projectId: pid, ref, snapshot: { draftRef: { ...ref, contentHash: 'b'.repeat(64) }, definition: { taskRef: { applicationRef: ref, nodeId: 'IMPLEMENT' } }, contentConfirmed: true, ready: false, executionAuthorized: false, dispatchPerformed: false } };
  let current = true;
  const connection: any = { ref, expired: false, candidate: { kind: 'CONNECTION_CANDIDATE' }, executionAuthorized: false, headVersion: 1 };
  const db: any = { query: async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT p.id,p.archived_at,m.participation')) return { rows: p[0] === pid ? [{ id: pid, participation: 'OWNER' }] : [] };
    if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ at: new Date('2026-10-19T01:00:00.000Z') }] };
    if (sql.startsWith('SELECT head_version FROM anvil.connection_candidates')) return { rows: [{ head_version: connection.headVersion }] };
    if (sql.startsWith('INSERT INTO anvil.commands')) { commands.set(p[0], { server_command_id:p[0],operation_id:p[7],authorization_receipt_id:p[8],approval_consumption_id:p[9],policy_ref:JSON.parse(p[12]),payload_ref:p[13]===null?null:JSON.parse(p[13]),request_hash:p[6],command_key:p[5],control_generation:p[11],receipt_rows:[],audit_rows:[],approval_rows:[],result_ref: JSON.parse(p[14]), operation: p[4], state: 'APPLIED', expected_version: p[10], command_actor: p[2], command_client: p[3] }); return { rows: [] }; }
    if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){commands.get(p[2]).receipt_rows.push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],command_id:p[2],subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6]});return{rows:[]};}
    if(sql.startsWith('INSERT INTO anvil.audit_events')){commands.get(p[4]).audit_rows.push({project_id:p[0],actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),policy_ref:JSON.parse(p[7]),approval_ref:p[8]===null?null:JSON.parse(p[8]),scope_digest:p[10],outcome:'APPLIED',source_kind:'HUMAN_COMMAND'});return{rows:[]};}
    if (sql.startsWith('SELECT set_config')) return { rows: [] };
    if (sql.startsWith('INSERT INTO anvil.project_roles')) { roles.push({ project_id: p[0], role_id: p[1], version: p[2], content_hash: p[3], snapshot_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7] }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.agent_sessions')) { sessions.push({ project_id: p[0], session_id: p[1], version: p[2], content_hash: p[3], snapshot_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7] }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.role_bindings')) { bindings.push({ project_id: p[0], binding_id: p[1], version: p[2], role_id: p[3], session_id: p[4], content_hash: p[5], snapshot_json: JSON.parse(p[6]), created_by: p[7], client_id: p[8], command_id: p[9] }); return { rows: [] }; }
    if (sql.includes('FROM anvil.project_roles r')) return { rows: roles.filter(r => r.project_id === p[0] && (sql.includes('r.role_id=$2') ? r.role_id === p[1] && (p[2]===undefined||r.version === p[2]) : true)).map(r => ({ ...r, ...commands.get(r.command_id) })) };
    if (sql.includes('FROM anvil.role_bindings b')) return { rows: bindings.filter(r => r.project_id === p[0] && (sql.includes('b.binding_id=$2') ? r.binding_id === p[1] && (p[2]===undefined||r.version === p[2]) : r.role_id === p[1])).sort((a,b) => b.version-a.version).slice(0,1).map(r => ({ ...r, ...commands.get(r.command_id) })) };
    if (sql.includes('FROM anvil.agent_sessions s')) return { rows: sessions.filter(r => r.project_id === p[0] && r.session_id === p[1] && (p[2]===undefined||r.version === p[2])).map(r => ({ ...r, ...commands.get(r.command_id) })) };
    throw Error('UNEXPECTED_QA_SQL: ' + sql.slice(0,100));
  } };
  const store = new subject.ResponsibleSessions({ readApplication: async () => application },
    { read: async (_db: any, _actor: any, project: string, id: string, version: number) => { if (project !== pid || id !== ref.id || version !== ref.version) throw Error('NOT_FOUND'); return assignment; } },
    { current: async (_db: any, _actor: any, project: string, requested: any) => { if (project !== pid || !current || canonicalJson(requested) !== canonicalJson(assignment.snapshot.draftRef)) throw Error('VERSION_CONFLICT'); return { projectId: pid }; } },
    { read: async () => connection });
  const command = (operation: string, payload: any): any => ({ schemaVersion: 1, projectId: pid, commandId: crypto.randomUUID(), clientId: actor.clientId, controlGeneration: 1, operation, targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload });
  const define = async () => {
    const root = await store.define(db, actor, command('defineProjectRole', { kind: 'COORDINATOR', stageRef: null, parentRoleRef: null, reason: '총괄' }), ref);
    return store.define(db, actor, command('defineProjectRole', { kind: 'STAGE_OWNER', stageRef: { applicationRef: ref, nodeId: 'IMPLEMENT' }, parentRoleRef: root.data.ref, reason: '단계 책임' }), ref);
  };
  return { store, db, command, define, roles, bindings, sessions, commands, connection, application, assignment, setStale: () => { current = false; } };
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
 if(sql.includes('clock_timestamp()'))return a.db.query(sql,args);
 if(sql.startsWith('SELECT r.*,c.operation')||sql.startsWith('SELECT d.*,c.operation')||sql.startsWith('SELECT ac.*')||sql.startsWith('SELECT actor_id,client_id,generation')||sql.includes('FROM anvil.permission_policies')||sql.startsWith('UPDATE anvil.approval_requests'))return a.db.query(sql,args);
 if(sql.startsWith('INSERT INTO anvil.approval_consumptions')){const result=await a.db.query(sql,args);f.commands.get(args[3]).approval_rows.push({id:args[0],requestId:(a.command.approvalRef as any).requestId,decisionId:args[2]});return result;}
 return f.db.query(sql,args);
}};}

for(const operation of ['COORDINATOR','STAGE_OWNER','FIRST_BIND','FOLLOWUP_BIND'])test(operation+' 각 원명령의 별도 승인 소비·정확 원장 조회와 실행false를 보존한다',async()=>{
 const f=storeFixture();let command:any,previous:any=null;
 if(operation==='COORDINATOR')command=f.command('defineProjectRole',{kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'총괄 정의 승인'});
 else if(operation==='STAGE_OWNER'){
  const root=await f.store.define(f.db,actor,f.command('defineProjectRole',{kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'총괄'}),ref);
  command=f.command('defineProjectRole',{kind:'STAGE_OWNER',stageRef:{applicationRef:ref,nodeId:'IMPLEMENT'},parentRoleRef:root.data.ref,reason:'단계 정의 승인'});
 }else{
  const role=await f.define(),payload={assignmentRef:ref,roleRef:role.data.ref,connectionRef:ref,existingSessionBindingRef:null,reason:'책임 세션 예약 승인'};
  if(operation==='FOLLOWUP_BIND')previous=(await f.store.bind(f.db,actor,f.command('bindResponsibleSession',payload),ref)).data;
  command=f.command('bindResponsibleSession',{...payload,existingSessionBindingRef:previous?.ref??null});command.targetId=previous?.ref.id??null;command.expectedVersion=previous?.ref.version??0;
 }
 const a=approvalFixture(command,actor,{targetRef:previous?.ref??null}),db:any=combined(f,a),before=f.sessions.length;
 await authorizeMaterial(db,actor,a.command);
 const result=a.command.operation==='defineProjectRole'?await f.store.define(db,actor,a.command,a.policyRef):await f.store.bind(db,actor,a.command,a.policyRef);
 assert.equal(a.writes.length,2);const row=f.commands.get([...f.commands.keys()].at(-1)!);assert.equal(row.approval_rows.length,1);
 const view=a.command.operation==='defineProjectRole'?await f.store.readRole(db,actor,pid,result.data.ref.id,1):await f.store.readBinding(db,actor,pid,result.data.ref.id,result.data.ref.version);
 assert.deepEqual(view.ref,result.data.ref);
 if(a.command.operation==='bindResponsibleSession'){assert.equal(view.snapshot.executionAuthorized,false);assert.equal(view.snapshot.dispatchPerformed,false);assert.equal(view.snapshot.externalSessionHandleRef,null);assert.equal(view.snapshot.connectionReadiness,'CANDIDATE_ONLY');if(previous){assert.deepEqual(view.snapshot.sessionRef,previous.snapshot.sessionRef);assert.equal(f.sessions.length,before);}else assert.equal(f.sessions.length,before+1);}
 for(const change of [(r:any)=>r.request_hash='0'.repeat(64),(r:any)=>r.audit_rows.push(structuredClone(r.audit_rows[0])),(r:any)=>r.receipt_rows[0].command_id=pid,(r:any)=>r.approval_rows.push(structuredClone(r.approval_rows[0]))]){
  const saved=structuredClone(row);change(row);await assert.rejects(a.command.operation==='defineProjectRole'?f.store.readRole(db,actor,pid,result.data.ref.id,1):f.store.readBinding(db,actor,pid,result.data.ref.id,result.data.ref.version),/INTEGRITY_FAILED/);Object.assign(row,saved);
 }
});
