import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeMaterial } from '../../../apps/server/modules/access/project-command.ts';
import { AuthFailure } from '../../../apps/server/modules/access/repository.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';

const pid = '10000000-0000-4000-8000-000000000001';
const uid = '20000000-0000-4000-8000-000000000002';

test('buildTaskContext REQUIRE_APPROVAL 원명령은 명확 APPROVAL_REQUIRED/412를 반환하고 저장하지 않는다', async () => {
 const actor: any = { actorId: uid, clientId: uid };
 const command: any = { schemaVersion: 1, projectId: pid, commandId: uid, clientId: uid, controlGeneration: 1, operation: 'buildTaskContext', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: {} };
 const rules = [{ subjectRef: { kind: 'HUMAN', userId: uid }, targetScopes: [{ kind: 'PROJECT', projectId: pid }], operations: ['buildTaskContext'], disposition: 'REQUIRE_APPROVAL', expiresAt: '2099-01-01T00:00:00.000Z' }];
 let writes = 0;
 const db: any = { query: async (sql: string) => {
  if (!sql.startsWith('SELECT')) { writes++; throw Error('UNEXPECTED_WRITE'); }
  assert.ok(sql.includes('FROM anvil.permission_policies'));
  return { rows: [{ id: uid, head_version: 1, rules_json: rules, reason: '명시 정책', review_refs: [], content_hash: contentHash(canonicalJson({ rules, reason: '명시 정책', reviewRefs: [] })), created_at: new Date('2026-10-27T00:00:00.000Z') }] };
 } };
 await assert.rejects(authorizeMaterial(db, actor, command), (error: unknown) => error instanceof AuthFailure && error.message === 'APPROVAL_REQUIRED' && error.statusCode === 412);
 assert.equal(writes, 0);
});

import {randomUUID} from 'node:crypto';
import {ProjectContexts} from '../../../apps/server/modules/context/project-contexts.ts';
import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {contextSlotCodes} from '../../../apps/server/modules/context/context-input.ts';
import {planContextText} from '../../../apps/server/modules/context/context-text-plan.ts';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import type {PoolClient} from 'pg';
const id=(n:number)=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const actor:any={actorId:uid,clientId:uid,serverOwner:false,credentialGeneration:1,reauthUntil:null},cid=uid,requestId=id(7),decisionId=id(8),serverId=id(9),consumptionId=id(10),at='2026-10-27T00:00:00.000Z',now=new Date(at),hash=(v:unknown)=>contentHash(canonicalJson(v));
function consumptionFixture(operation:string,disposition='REQUIRE_APPROVAL',options:{stale?:boolean;expired?:boolean;rejected?:boolean;payload?:any}={}){
 const target:any=null;const payload=options.payload??(operation==='saveBaselineDraft'?{baseRef:null,reason:'처음 초안'}:{draftRef:target,reason:'정확 내용'});
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

const module={ProjectContexts},ref={id:uid,version:1,contentHash:'a'.repeat(64)};
function contextStoreFixture() {
 assert.equal(typeof module.ProjectContexts, 'function');
 const payload: any = { assignmentRef: ref, budgetRef: null, slots: contextSlotCodes.map(code => ({ code, sources: [], reason: '명시 미선택' })), limits: { maxPartBytes: 4096, maxParts: 200 }, reason: '준비 후보' };
 const prepared: any = { preparationInput: payload, assignmentRef: ref, baselineRefs: [ref], constitutionRef: null, budgetRef: null, bindings: contextSlotCodes.map(itemId => ({ itemId, selection: null, bodyRef: null, sourceState: 'NOT_SELECTED' })), ...planContextText(contextSlotCodes.map(code => ({ itemId: code, category: code, required: true, sourceRef: null, reason: '명시 미선택', state: 'MISSING', bodyRef: null, body: null })), payload.limits), unverified: [] };
 const commands = new Map<string, any>(), bundles: any[] = [], items: any[] = []; let resolveCalls = 0, sourceError: Error | null = null, member = true, generation = 1, disposition = 'AUTO';
 const db: any = { query: async (sql: string, p: any[] = []) => {
  if (sql.startsWith('SELECT p.id,p.archived_at,m.participation')) return { rows: member && p[0] === pid ? [{ id: pid, participation: 'OWNER', archived_at: null }] : [] };
  if (sql.includes('FROM anvil.project_control')) return { rows: [{ actor_id: uid, client_id: uid, generation, revoked_at: null }] };
  if (sql.includes('FROM anvil.permission_policies')) { const rules = [{ ruleId: 'context', subjectRef: { kind: 'HUMAN', userId: uid }, operations: ['buildTaskContext'], targetScopes: [{ kind: 'PROJECT', projectId: pid }], disposition, expiresAt: '2099-01-01T00:00:00.000Z' }]; return { rows: [{ id: uid, head_version: 1, rules_json: rules, reason: '명시 정책', review_refs: [], content_hash: contentHash(canonicalJson({ rules, reason: '명시 정책', reviewRefs: [] })), created_at: new Date() }] }; }
  if (sql.startsWith('SELECT operation,request_hash,result_ref')) return { rows: [...commands.values()].filter(c => c.command_id === p[2]) };
  if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ at: new Date('2026-10-18T07:00:00Z') }] };
  if (sql.startsWith('INSERT INTO anvil.commands')) { commands.set(p[0], { id: p[0], project_id: p[1], command_actor: p[2], command_client: p[3], operation: p[4], command_id: p[5], request_hash: p[6], operation_id: p[7], expected_version: p[10], control_generation: p[11], policy_ref: JSON.parse(p[12]), payload_ref: p[13], result_ref: JSON.parse(p[14]), state: 'APPLIED', approval_consumption_id: p[9], command_scope_kind: 'PROJECT', command_scope_id: p[1] }); return { rows: [] }; }
  if (sql.startsWith('INSERT INTO anvil.authorization_receipts') || sql.startsWith('INSERT INTO anvil.audit_events') || sql.startsWith('SELECT set_config')) return { rows: [] };
  if (sql.startsWith('INSERT INTO anvil.context_bundles')) { bundles.push({ project_id: p[0], id: p[1], version: 1, assignment_id: p[2], assignment_version: p[3], assignment_hash: p[4], assignment_ref: JSON.parse(p[5]), baseline_refs: JSON.parse(p[6]), budget_ref: JSON.parse(p[7]), manifest_json: JSON.parse(p[8]), content_hash: p[9], created_by: p[10], client_id: p[11], command_id: p[12], request_payload: JSON.parse(p[13]) }); return { rows: [] }; }
  if (sql.startsWith('INSERT INTO anvil.context_items')) { items.push(p); return { rows: [] }; }
  if (sql.startsWith('SELECT item_id,category,required,source_ref')) return { rows: items.filter(item => item[0] === p[0] && item[1] === p[1]).map(item => ({ item_id: item[2], category: item[3], required: true, source_ref: JSON.parse(item[4]), source_hash: item[5], included_state: item[6], reason: item[7], delivery_parts: JSON.parse(item[8]), issue: item[9] })) };
  if (sql.startsWith('SELECT id,version FROM anvil.context_bundles')) return { rows: bundles.filter(b => b.project_id === p[0] && b.assignment_id === p[1] && b.assignment_version === p[2] && b.assignment_hash === p[3]).map(b => ({ id: b.id, version: b.version })) };
  if (sql.includes('FROM anvil.context_bundles b')) return { rows: bundles.filter(b => b.project_id === p[0] && b.id === p[1] && b.version === p[2]).map(b => { const c = commands.get(b.command_id); return { ...b, ...c, id: b.id, command_id: b.command_id, command_external_id: c.command_id, authorization_subject_ref: { kind: 'HUMAN', userId: uid, clientId: uid }, authorization_policy_ref: c.policy_ref, audit_scope_digest: contentHash(canonicalJson({ projectId: pid, actorId: uid, clientId: uid, controlGeneration: 1, requestHash: c.request_hash, policyRef: c.policy_ref, targetRef: c.result_ref.data.ref })), audit_outcome: 'APPLIED', audit_source_kind: 'HUMAN_COMMAND' }; }) };
  throw Error('UNEXPECTED_CONTEXT_SQL: ' + sql.slice(0, 90));
 } };
 const sources: any = { resolve: async (_db: any, _actor: any, projectId: string, input: any) => { resolveCalls++; assert.equal(projectId, pid); assert.deepEqual(input, payload); if (sourceError) throw sourceError; return structuredClone(prepared); } };
 const assignments: any = { read: async (_db: any, _actor: any, projectId: string, id: string, version: number) => { if (projectId !== pid || id !== ref.id || version !== 1) throw new AuthFailure('NOT_FOUND', 404); return { projectId, ref }; } };
 const service = new module.ProjectContexts(sources, assignments), access: any = { authenticated: async (_t: string, _csrf: string | null, action: any) => action(db, actor) }, policies = new ProjectPolicyRepository(access);
 const command: any = { schemaVersion: 1, projectId: pid, commandId: randomUUID(), clientId: uid, controlGeneration: 1, operation: 'buildTaskContext', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload };
 const save = (request = command) => policies.command('synthetic', 'synthetic', request, (_db, _actor, policyRef) => service.save(_db, _actor, request, policyRef));
 return { service, save, command, db, bundles, items, commands, prepared, calls: () => resolveCalls, setError: (value: Error | null) => { sourceError = value; }, denyMember: () => { member = false; }, oldControl: () => { generation = 2; }, policy: (value: string) => { disposition = value; } };
}

test('정확 맥락 승인만 1회 소비하며 기한·거절·제어변경·다른명령과 재사용을 거절한다',async()=>{
 const repo=new ProjectApprovals(),store=contextStoreFixture(),f=consumptionFixture('buildTaskContext','REQUIRE_APPROVAL',{payload:store.command.payload});
 await authorizeMaterial(f.db,actor,f.command);await repo.consume(f.db,actor,f.command,f.policyRef,serverId,consumptionId);assert.equal(f.writes.length,2);assert.equal((await repo.authorize(f.db,actor,f.command,f.policyRef)).replay,true);
 await assert.rejects(repo.consume(f.db,actor,f.command,f.policyRef,serverId,consumptionId),/APPROVAL_ALREADY_CONSUMED/);
 for(const changed of [{...f.command,commandId:id(99)},{...f.command,clientId:id(98)},{...f.command,payload:{...f.command.payload,reason:'다른 입력'}},{...f.command,targetId:uid,expectedVersion:1}])await assert.rejects(repo.authorize(f.db,actor,changed,f.policyRef));
 for(const options of [{stale:true},{expired:true},{rejected:true}]){const x=consumptionFixture('buildTaskContext','REQUIRE_APPROVAL',{...options,payload:store.command.payload});await assert.rejects(repo.consume(x.db,actor,x.command,x.policyRef,serverId,consumptionId));assert.equal(x.writes.length,0);}
});
test('원 역순payload 승인→실제 context repository 저장/재조회는 현재 합법정책·제어변경과 역사위조를 구분한다',async()=>{
 const f=contextStoreFixture(),payload={...f.command.payload,slots:[...f.command.payload.slots].reverse()},options={stale:false,payload},approval=consumptionFixture('buildTaskContext','REQUIRE_APPROVAL',options);
 let historical=false,historyCurrentQueries=0,tamper=false;
 const db:any={query:async(sql:string,args:any[]=[])=>{
  if(historical&&(sql.includes('FROM anvil.permission_policies')||sql.startsWith('SELECT actor_id,client_id,generation')))historyCurrentQueries++;
  if(sql.startsWith('SELECT r.*,c.operation')||sql.startsWith('SELECT d.*,c.operation')||sql.startsWith('SELECT ac.*')||sql.includes('FROM anvil.permission_policies')||sql.startsWith('SELECT actor_id,client_id,generation')||sql.includes('clock_timestamp()')||sql.startsWith('INSERT INTO anvil.approval_consumptions')||sql.startsWith('UPDATE anvil.approval_requests'))return approval.db.query(sql,args);
  const result=await f.db.query(sql,args);
  if(sql.startsWith('INSERT INTO anvil.commands'))f.commands.get(args[0]).payload_ref=JSON.parse(args[13]);
  if(sql.includes('FROM anvil.context_bundles b'))for(const row of result.rows)Object.assign(row,{authorization_approval_decision:decisionId,audit_approval_ref:tamper?{...approval.command.approvalRef as any,decisionId:id(99)}:approval.command.approvalRef});return result;
 }};
 await authorizeMaterial(db,actor,approval.command);const saved:any=await f.service.save(db,actor,approval.command,approval.policyRef),savedRef=saved.data.ref;
 assert.equal(f.bundles.length,1);assert.equal(approval.writes.length,2);assert.deepEqual(f.bundles[0].request_payload,payload);assert.equal(f.bundles[0].request_payload.slots[0].code,'NEXT_ACTION');assert.equal(f.bundles[0].manifest_json.preparationInput.slots[0].code,'PURPOSE_REASON');
 historical=true;options.stale=true;const history=await new ProjectApprovals().readContextConsumption(db,actor,pid,requestId);assert.equal(history.consumption!.serverCommandId,f.bundles[0].command_id);assert.equal(history.consumption!.requestHash,hash(approval.command));assert.deepEqual((await f.service.read(db,actor,pid,savedRef.id,1)).ref,savedRef);assert.equal(historyCurrentQueries,0);assert.equal(approval.writes.length,2);
 f.setError(new AuthFailure('PROJECT_WRITE_DENIED',403));await assert.rejects(f.service.read(db,actor,pid,savedRef.id,1),{message:'PROJECT_WRITE_DENIED',statusCode:403});f.setError(null);
 tamper=true;await assert.rejects(f.service.read(db,actor,pid,savedRef.id,1),{message:'CONTEXT_INTEGRITY_FAILED',statusCode:503});assert.equal(f.bundles.length,1);
});

import {readFileSync} from 'node:fs';
test('0046 정적 반례: command 승인열을 NULL로 감춰도 receipt/소비/감사 관계가 deferred 완결검사에 진입한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0046_context_one_time_approval.sql.pending',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const body=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn05_context_approval_complete()'),sql.indexOf('CREATE CONSTRAINT TRIGGER fn05_context_commands_complete'));
 const entry=body.slice(body.indexOf('approved='),body.indexOf('IF approved THEN'));
 assert.match(entry,/EXISTS\(SELECT 1 FROM anvil\.authorization_receipts[\s\S]*approval_decision_ref IS NOT NULL/,'receipt 단독 승인관계도 완결검사에 진입해야 한다');
 assert.match(entry,/EXISTS\(SELECT 1 FROM anvil\.approval_consumptions/,'소비 단독 관계도 완결검사에 진입해야 한다');
 assert.match(entry,/EXISTS\(SELECT 1 FROM anvil\.audit_events[\s\S]*approval_ref IS NOT NULL/,'감사 단독 승인관계도 완결검사에 진입해야 한다');
 assert.match(body,/did IS NULL OR b\.id IS NULL/);assert.match(body,/fn05_context_approval_execution_valid\(pid,cid,did,true\) IS DISTINCT FROM true/);
});

function contextApprovalSql(){return readFileSync(new URL('../../../db/migrations/0046_context_one_time_approval.sql.pending',import.meta.url),'utf8').replace(/\r\n/g,'\n');}
test('0046 정적 반례: 승인흔적 전부NULL인 APPLIED context도 bundle/items와 현재AUTO 또는 정확소비를 반드시 완결한다',()=>{
 const sql=contextApprovalSql(),body=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn05_context_approval_complete()'),sql.indexOf('CREATE CONSTRAINT TRIGGER fn05_context_commands_complete'));
 assert.match(body,/IF anvil\.fn05_context_command_related\(pid,cid,c\.command_id,c\.operation\) THEN/);
 assert.match(body,/c\.operation IS DISTINCT FROM 'buildTaskContext'/);assert.match(body,/b\.id IS NULL/);assert.match(body,/context_items/);
 assert.match(body,/context_preparation_authorized_before_approval\(pid\) IS DISTINCT FROM true/,'승인열이 NULL이어도 REQUIRE/DENY는 AUTO로 완결할 수 없다');
});
test('0046 정적 반례: 다른operation이어도 원명령후보/승인scope/receipt/소비/감사/맥락자료 중 한쪽이 context면 완결검사 대상이다',()=>{
 const sql=contextApprovalSql(),related=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn05_context_command_related('),sql.indexOf('CREATE FUNCTION anvil.fn05_context_approval_complete()'));
 assert.match(related,/candidate_command_id=externalid/);assert.match(related,/action_scope_json->>'operation'='buildTaskContext'/);
 for(const table of ['context_bundles','authorization_receipts','approval_consumptions','audit_events'])assert.ok(related.includes('anvil.'+table),table);
});
test('0046 정적 반례: 승인흔적이나operation을 UPDATE/DELETE로 지워도 OLD/NEW 관계 guard가 완결대상을 보존한다',()=>{
 const sql=contextApprovalSql(),command=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn05_context_approval_command_immutable()'),sql.indexOf('CREATE TRIGGER fn05_context_approval_command_immutable'));
 assert.match(command,/fn05_context_command_related\(OLD\.project_id,OLD\.id,OLD\.command_id,OLD\.operation\)/);assert.match(command,/fn05_context_command_related\(NEW\.project_id,NEW\.id,NEW\.command_id,NEW\.operation\)/);
 const links=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn05_context_approval_link_immutable()'));assert.match(links,/c\.id IN\(old_command,new_command\)/);assert.match(links,/fn05_context_command_related\(c\.project_id,c\.id,c\.command_id,c\.operation\)/);
});
