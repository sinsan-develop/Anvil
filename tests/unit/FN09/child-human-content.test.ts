import Fastify from 'fastify';
import {registerProjectRoutes} from '../../../apps/server/modules/projects/routes.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {ProjectAssignmentDrafts} from '../../../apps/server/modules/assignments/project-assignment-drafts.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { readAssignmentDraftInput } from '../../../apps/server/modules/assignments/assignment-input.ts';
const module: any = await import('../../../apps/server/modules/assignments/project-assignment-confirmations.ts').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
const pid = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222';
const actor: any = { actorId: pid, clientId: pid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const ref = { id, version: 1, contentHash: 'a'.repeat(64) }, policyRef = { ...ref, id: pid };
const criteria = ['PURPOSE_SCOPE', 'BASELINE_TASK', 'INPUT_OUTPUT', 'COMPLETION_VERIFICATION', 'BOUNDARIES', 'RECORD_RECOVERY'];

function setup() {
  assert.equal(typeof module.ProjectAssignmentConfirmations, 'function');
  const definition: any = { taskRef: { planRef: ref, taskCode: 'FN01', applicationRef: ref, nodeId: 'N1' }, purpose: '주도권 보존', goal: '기능 구현', baselineRefs: [ref], inputs: ['요구'], outputs: ['결과'], acceptanceCriteria: ['정상 흐름'], verificationRequirements: ['핵심 실패'], included: ['개발'], excluded: ['운영'], allowedScopes: [{ sourceRootRef: ref, mappingRef: null, observationRef: ref, baselineRef: ref, targets: [{ relativePath: 'src/a.ts', kind: 'FILE', access: 'WRITE', recursive: false }] }], environmentRef: null, requiredCapabilities: ['코드 수정'], budgetRef: null, ownerRole: '단계책임자', parentAssignmentRef: null, recordingPolicyRef: null, integrationResponsibility: '검수·통합' };
  const draft: any = { projectId: pid, ref, snapshot: { definition, readinessIssues: readAssignmentDraftInput({ baseRef: null, definition, reason: '준비' }).readinessIssues }, headVersion: 1 };
  const reviews: any[] = [], versions: any[] = [], commands = new Map<string, any>(); let sequence = 0; const receipts:any[]=[],audits:any[]=[]; const stamp='2026-10-18T01:40:00.000Z';
  const db: any = { query: async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT p.id,p.archived_at,m.participation')) return { rows: p[0] === pid ? [{ id: pid, participation: 'OWNER' }] : [] };
    if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ at: new Date('2026-10-18T01:40:00Z') }] };
    if (sql.startsWith('INSERT INTO anvil.commands')) { commands.set(p[0], { id:p[0],scope_kind:'PROJECT',scope_id:p[1],project_id:p[1],actor_id:p[2],client_id:p[3],command_id:p[5],request_hash:p[6],operation_id:p[7],authorization_receipt_id:p[8],approval_consumption_id:p[9],control_generation:p[11],policy_ref:JSON.parse(p[12]),payload_ref:p[13],received_at:stamp,completed_at:stamp,result_ref: JSON.parse(p[14]), operation: p[4], state: 'APPLIED', expected_version: p[10], command_actor: p[2], command_client: p[3] }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.audit_events')) { sequence++; audits.push({project_id:p[0],server_sequence:sequence,event_id:p[1],actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),policy_ref:JSON.parse(p[7]),approval_ref:p[8],outcome:'APPLIED',scope_digest:p[10],source_kind:'HUMAN_COMMAND',recorded_at:stamp}); return {rows:[]}; }
    if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){receipts.push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],command_id:p[2],subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6],authorized_at:stamp});return {rows:[]};}
    if(sql.startsWith('SELECT to_jsonb(c)')){const c=commands.get(p[1]);return {rows:c?[{command:c,receipts:receipts.filter(r=>r.command_id===c.id),audits:audits.filter(r=>r.command_id===c.id)}]:[]};}
    if(sql.startsWith('SELECT set_config'))return {rows:[]};
    if (sql.startsWith('INSERT INTO anvil.assignment_content_reviews')) { reviews.push({ created_at:stamp,project_id: p[0], review_id: p[1], draft_id: p[2], draft_version: p[3], draft_hash: p[4], content_hash: p[5], review_json: JSON.parse(p[6]), created_by: p[7], client_id: p[8], command_id: p[9], server_sequence: sequence }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.assignment_versions')) { versions.push({ created_at:stamp,project_id: p[0], assignment_id: p[1], version: p[2], content_hash: p[3], version_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7], confirmation_id: p[8] }); return { rows: [] }; }
    if(sql.startsWith('SELECT count(*) total')){const raw=reviews.filter(r=>r.project_id===p[0]&&r.draft_id===p[1]&&r.draft_version===p[2]);return {rows:[{total:raw.length,invalid:raw.filter(r=>!commands.has(r.command_id)||receipts.filter(a=>a.command_id===r.command_id).length!==1||audits.filter(a=>a.command_id===r.command_id).length!==1).length}]};}
    if (sql.includes('FROM anvil.assignment_content_reviews r')) return { rows: reviews.filter(r => commands.has(r.command_id)&&audits.some(a=>a.command_id===r.command_id)&& r.project_id === p[0] && (sql.includes('c.command_id=$3') ? commands.get(r.command_id)?.command_id===p[2] && r.created_by===p[1] : sql.includes('r.review_id=$2') ? r.review_id === p[1] : r.draft_id === p[1] && r.draft_version === p[2])).sort((a,b) => b.server_sequence-a.server_sequence).map(r => ({ ...r, draft_author: pid, ...commands.get(r.command_id), command_id:r.command_id })) };
    if (sql.includes('FROM anvil.assignment_versions v')) return { rows: versions.filter(r => r.project_id === p[0] && r.assignment_id === p[1] && r.version === p[2]).map(r => ({ ...r, ...commands.get(r.command_id), command_id:r.command_id })) };
    throw Error('UNEXPECTED_QA_SQL: ' + sql.slice(0, 100));
  } };
  const store = new module.ProjectAssignmentConfirmations({ currentForContent: async (_db: any, _a: any, project: string, requested: any) => { if (project !== pid) throw Error('NOT_FOUND'); if (canonicalJson(requested) !== canonicalJson(ref) || draft.headVersion !== 1) throw Error('VERSION_CONFLICT'); return draft; }, current: async () => { throw Error('ASSIGNMENT_CHILD_DRAFT_ONLY'); }, read: async () => draft });
  const command = (operation: string, payload: any): any => ({ schemaVersion: 1, projectId: pid, commandId: crypto.randomUUID(), clientId: pid, controlGeneration: 1, operation, targetId: id, expectedVersion: 1, baselineRefs: [], approvalRef: null, payload });
  const reviewInput = (outcome = 'ACCEPTED') => ({ draftRef: ref, criteriaVersion: 1, items: criteria.map(criterionId => ({ criterionId, outcome, reason: '사람이 내용 검토', evidenceRefs: [] })), outcome, reason: '내용 검토이고 실행 미승인' });
  return { db, store, draft, reviews, versions, commands, receipts,audits,command, reviewInput };
}
test('HUMAN sibling은 하위 검토·별도 확정·과거 내용을 보관하고 기존 reader는 차단한다', async () => {
  const q=setup(); q.draft.snapshot.definition.parentAssignmentRef=policyRef;
  const review=await q.store.reviewContent(q.db,actor,q.command('reviewAssignmentContent',q.reviewInput()),policyRef);
  assert.equal(review.data.status,'ASSIGNMENT_CONTENT_REVIEWED');
  const result=await q.store.confirmContent(q.db,actor,q.command('confirmAssignment',{draftRef:ref,reviewRefs:[review.data.ref],reason:'내용만 확정',acknowledged:true}),policyRef);
  assert.equal(result.data.snapshot.executionAuthorized,false);
  const read=await q.store.readContent(q.db,actor,pid,id,1); assert.deepEqual(read.ref,result.data.ref);
  await assert.rejects(q.store.read(q.db,actor,pid,id,1),/ASSIGNMENT_CHILD_DRAFT_ONLY/);
});
test('하위 과거 read/replay는 새 head를 적용하지 않고 원 증빙 변조는 각각 거절한다',async()=>{
 for(const kind of ['normal','requestHash','receipt','audit','duplicateAudit','timestamp','snapshot','operation','state','rawRoot','missingRecord']){
  const q=setup();q.draft.snapshot.definition.parentAssignmentRef=policyRef;
  const command=q.command('reviewAssignmentContent',q.reviewInput()), result=await q.store.reviewContent(q.db,actor,command,policyRef);
  q.draft.headVersion=2;
  if(kind==='requestHash')q.commands.values().next().value.request_hash='f'.repeat(64);
  if(kind==='receipt')q.receipts.length=0;
  if(kind==='audit')q.audits.length=0;
  if(kind==='duplicateAudit')q.audits.push(structuredClone(q.audits[0]));
  if(kind==='timestamp')q.commands.values().next().value.result_ref.serverReceivedAt='2026-10-18T01:41:00.000Z';
  if(kind==='operation')q.commands.values().next().value.operation='saveKnowledge';
  if(kind==='state')q.commands.values().next().value.state='FAILED';
  if(kind==='rawRoot')q.commands.values().next().value.result_ref.data.snapshot.draftRef=policyRef;
  if(kind==='missingRecord')q.reviews.length=0;
  if(kind==='snapshot')q.reviews[0].review_json.reason='변조';
  if(kind==='normal')assert.deepEqual(await q.store.replayContent(q.db,actor,command,result),result);
  else await assert.rejects(q.store.replayContent(q.db,actor,command,result),/INTEGRITY_FAILED/);
 }
});
test('기존 root entry 및 클래스 도달 승인 차단을 유지한다',async()=>{
 const q=setup();q.draft.snapshot.definition.parentAssignmentRef=policyRef;
 await assert.rejects(q.store.review(q.db,actor,q.command('reviewAssignmentContent',q.reviewInput()),policyRef),/ASSIGNMENT_CHILD_DRAFT_ONLY/);
 const c=q.command('reviewAssignmentContent',q.reviewInput());c.approvalRef=policyRef;
 await assert.rejects(q.store.reviewContent(q.db,actor,c,policyRef),/ASSIGNMENT_APPROVAL_NOT_CONNECTED/);
 assert.equal(q.commands.size,0);
});

test('최신 REWORK 감사 누락을 INNER JOIN이 숨겨도 과거 ACCEPTED로 확정하지 않는다',async()=>{
 const q=setup();q.draft.snapshot.definition.parentAssignmentRef=policyRef;
 const accepted=await q.store.reviewContent(q.db,actor,q.command('reviewAssignmentContent',q.reviewInput()),policyRef);
 await q.store.reviewContent(q.db,actor,q.command('reviewAssignmentContent',q.reviewInput('REWORK')),policyRef);
 q.audits.pop();
 await assert.rejects(q.store.confirmContent(q.db,actor,q.command('confirmAssignment',{draftRef:ref,reviewRefs:[accepted.data.ref],reason:'최신 손상 거절',acknowledged:true}),policyRef),/INTEGRITY_FAILED/);
 assert.equal(q.versions.length,0);
});

function protectedCommandFixture(){
 const q=setup();q.draft.snapshot.definition.parentAssignmentRef=policyRef;
 const state={clock:new Date(),expires:'2027-10-31T00:00:00.000Z',disposition:'AUTO',control:1};
 const identity:any={...actor,authSession:{id:pid,idleExpiresAt:'2027-10-31T00:00:00.000Z',absoluteExpiresAt:'2027-10-31T00:00:00.000Z'}};
 const inner=q.db.query;q.db.query=async(sql:string,p:any[]=[])=>{
  if(sql.startsWith('SELECT clock_timestamp'))return{rows:[{at:state.clock}]};
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return{rows:[{actor_id:pid,client_id:pid,generation:state.control,revoked_at:null}]};
  if(sql.startsWith('SELECT p.id,p.head_version,v.rules_json')){const rules=[{ruleId:'content',subjectRef:{kind:'HUMAN',userId:pid},operations:['reviewAssignmentContent','confirmAssignment'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:state.disposition,limitPolicyRef:null,expiresAt:state.expires}],reason='내용 전용';return{rows:[{id:pid,head_version:1,rules_json:rules,reason,review_refs:[],content_hash:contentHash(canonicalJson({rules,reason,reviewRefs:[]})),created_at:new Date()}]};}
  if(sql.startsWith('SELECT operation,request_hash,result_ref'))return{rows:[...q.commands.values()].filter(c=>c.command_id===p[2]).map(c=>({operation:c.operation,request_hash:c.request_hash,result_ref:c.result_ref}))};
  if(sql.includes("'DENIED'"))return{rows:[]};
  return inner(sql,p);
 };
 const access:any={authenticated:async(_t:any,_csrf:any,fn:any)=>{const before=structuredClone({commands:[...q.commands],reviews:q.reviews,versions:q.versions,receipts:q.receipts,audits:q.audits});try{return await fn(q.db,identity);}catch(e){q.commands.clear();for(const[k,v]of before.commands)q.commands.set(k,v);for(const name of ['reviews','versions','receipts','audits'] as const)q[name].splice(0,q[name].length,...before[name]);throw e;}}};
 return{...q,state,identity,policies:new ProjectPolicyRepository(access)};
}
test('두 내용 sibling은 실제 정책·제어/세션을 먼저 검사하고 대기 중 만료는 전체 rollback한다',async()=>{
 for(const kind of ['NORMAL','REQUIRE','APPROVAL','CONTROL','SESSION_WAIT','POLICY_WAIT']){
 const q=protectedCommandFixture(),c=q.command('reviewAssignmentContent',q.reviewInput());
 if(kind==='REQUIRE')q.state.disposition='REQUIRE_APPROVAL';if(kind==='APPROVAL')c.approvalRef=policyRef;if(kind==='CONTROL')q.state.control=2;
 if(kind.endsWith('_WAIT')){const original=q.store.drafts.currentForContent;q.store.drafts.currentForContent=async(...a:any[])=>{const v=await original(...a);if(kind==='SESSION_WAIT')q.identity.authSession.idleExpiresAt=new Date(q.state.clock.getTime()-1).toISOString();else {q.identity.authSession.idleExpiresAt='2030-01-01T00:00:00.000Z';q.identity.authSession.absoluteExpiresAt='2030-01-01T00:00:00.000Z';q.state.clock=new Date('2028-01-01T00:00:00.000Z');}return v;};}
 const run=()=>q.policies.assignmentContentCommand('synthetic','synthetic',c,q.store);
 if(kind==='NORMAL'){const result:any=await run();assert.equal(result.data.status,'ASSIGNMENT_CONTENT_REVIEWED');q.draft.headVersion=2;assert.deepEqual(await run(),result);assert.equal(q.commands.size,1);}
 else{const code:Record<string,string>={REQUIRE:'APPROVAL_REQUIRED',APPROVAL:'APPROVAL_NOT_REQUIRED',CONTROL:'CONTROL_GENERATION_CONFLICT',SESSION_WAIT:'AUTH_REQUIRED',POLICY_WAIT:'PROJECT_OPERATION_DENIED'};await assert.rejects(run(),(e:any)=>e.message===code[kind]);assert.equal(q.commands.size,0);}
 }
});
test('root 정상 replay는 원 JSON을 그대로 반환하고 child 분류 손상은 root fallback하지 않는다',async()=>{
 const q=protectedCommandFixture(),c=q.command('reviewAssignmentContent',q.reviewInput()),result=await q.policies.assignmentContentCommand('x','x',c,q.store);
 q.store.drafts.read=async()=>{throw Error('원형 손상');};await assert.rejects(q.policies.assignmentContentCommand('x','x',c,q.store),/원형 손상/);
 const r=protectedCommandFixture();r.draft.snapshot.definition.parentAssignmentRef=null;const rc=r.command('reviewAssignmentContent',r.reviewInput()),raw={original:true};r.commands.set(pid,{operation:rc.operation,command_id:rc.commandId,request_hash:contentHash(canonicalJson(rc)),result_ref:raw});assert.deepEqual(await r.policies.assignmentContentCommand('x','x',rc,r.store),raw);
});

async function realParentFixture(){
const pid = '11111111-1111-4111-8111-111111111111', actor = { actorId: pid, clientId: pid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const ref = { id: pid, version: 1, contentHash: 'a'.repeat(64) }, applicationRef = { ...ref, id: '22222222-2222-4222-8222-222222222222' }, designRef = { ...ref, id: '33333333-3333-4333-8333-333333333333' };
const input = (): any => ({ baseRef: null, reason: '임무 준비', definition: { taskRef: { planRef: { ...ref }, taskCode: 'FN01', applicationRef: { ...applicationRef }, nodeId: 'N1' }, purpose: '사용자가 개발 주도권 소유', goal: '명시 업무 구현', baselineRefs: [ref, applicationRef, designRef], inputs: ['요구'], outputs: ['코드'], acceptanceCriteria: ['핵심 동작'], verificationRequirements: ['실패 조건'], included: ['구현'], excluded: ['운영'], allowedScopes: [], environmentRef: null, requiredCapabilities: [], budgetRef: null, ownerRole: '책임자', parentAssignmentRef: null, recordingPolicyRef: null, integrationResponsibility: '통합 검수' } });
const command = (payload = input()): any => ({ schemaVersion: 1, projectId: pid, commandId: '44444444-4444-4444-8444-444444444444', clientId: pid, controlGeneration: 1, operation: 'prepareAssignment', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload });
function setup() {
  assert.equal(typeof ProjectAssignmentDrafts, 'function');
  const heads = new Map<string, number>(), versions = new Map<string, any>(), receipts = new Map<string, any>(), writes: string[] = [];
  const plan: any = { ref, designRef, tasks: [{ taskCode: 'FN01', title: '기능 구현', allowedFileRefs: ['src/a.ts'] }], relationalProjection: 'STORED' };
  const decision: any = { currentConfirmationValid: true };
  const methods: any = { projectId: pid, applicationRef, snapshot: { graph: { nodes: [{ nodeId: 'N1' }] } } };
  const db: any = { query: async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT p.id,p.archived_at,m.participation')) return { rows: p[0] === pid ? [{ id: pid, participation: 'OWNER' }] : [] };
    if (sql.startsWith('SELECT head_version FROM anvil.assignment_drafts')) return { rows: heads.has(p[1]) ? [{ head_version: heads.get(p[1]) }] : [] };
    if (sql.startsWith('SELECT transaction_timestamp')) return { rows: [{ at: new Date('2026-10-17T22:45:00Z') }] };
    if (sql.startsWith('INSERT INTO anvil.commands')) { receipts.set(p[0], JSON.parse(p[14])); writes.push(sql); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.assignment_drafts')) { heads.set(p[1], 1); writes.push(sql); return { rows: [] }; }
    if (sql.startsWith('UPDATE anvil.assignment_drafts')) { heads.set(p[1], p[2]); writes.push(sql); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.assignment_draft_versions')) { versions.set(p[1] + ':' + p[2], { project_id: p[0], draft_id: p[1], version: p[2], content_hash: p[3], version_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7] }); writes.push(sql); return { rows: [] }; }
    if (sql.startsWith('SELECT v.*,d.head_version')) { const row = versions.get(p[1] + ':' + p[2]); return { rows: row && row.project_id === p[0] ? [{ ...row, head_version: heads.get(p[1]), result_ref: receipts.get(row.command_id), command_actor: pid, command_client: pid, operation: 'prepareAssignment', state: 'APPLIED', expected_version: p[2] - 1 }] : [] }; }
    if (sql.startsWith('INSERT INTO anvil.authorization_receipts') || sql.startsWith('INSERT INTO anvil.audit_events') || sql.startsWith("SELECT set_config('anvil.actor_id'")) return { rows: [] };
    throw Error('UNEXPECTED_QA_SQL');
  } };
  const parentState: any = { confirmed: null, decision: null };
  const store = new ProjectAssignmentDrafts({ read: async () => plan, decision: async () => decision }, { readApplication: async () => methods }, {
    read: async (_db: any, _actor: any, project: string, id: string, version: number) => {
      if (project !== parentState.confirmed?.projectId || id !== parentState.confirmed?.ref.id || version !== parentState.confirmed?.ref.version) throw Error('NOT_FOUND');
      return parentState.confirmed;
    },
    decision: async () => parentState.decision,
  });
  return { store, db, plan, decision, methods, heads, versions, receipts, writes, parentState };
}

async function parentSetup() {
  const q = setup(), payload = input();
  payload.definition.allowedScopes = [{ sourceRootRef: ref, mappingRef: null, observationRef: ref, baselineRef: ref, targets: [{relativePath:'src/a.ts', kind:'FILE',access:'WRITE',recursive:false},{relativePath:'src/b.ts',kind:'FILE',access:'READ',recursive:false}] }];
  payload.definition.requiredCapabilities = ['FILE_READ','FILE_WRITE'];
  const parent:any = await q.store.save(q.db, actor, command(payload), ref);
  const confirmedRef = {...parent.data.ref, contentHash:'c'.repeat(64)};
  q.parentState.confirmed = {projectId:pid,ref:confirmedRef,snapshot:{draftRef:parent.data.ref,definition:structuredClone(payload.definition),contentConfirmed:true,ready:false,executionAuthorized:false,dispatchPerformed:false}};
  q.parentState.decision = {draftRef:parent.data.ref,confirmedRef,latestReviewAccepted:true,currentIssue:null};
  q.plan.tasks.push({...q.plan.tasks[0],taskCode:'FN02'});
  const child = input(); child.definition.parentAssignmentRef=confirmedRef; child.definition.taskRef.taskCode='FN02';
  child.definition.allowedScopes=[{...structuredClone(payload.definition.allowedScopes[0]),targets:[structuredClone(payload.definition.allowedScopes[0].targets[0])]}];
  child.definition.requiredCapabilities=['FILE_WRITE'];
  return {...q,child,parent};
}


return parentSetup();
}

test('실제 draft save/currentForContent는 부모→child 잠금과 매 쓰기 부모 head/범위/현재기준을 대조한다',async()=>{
 for(const kind of ['NORMAL','HEAD','REVIEW','BASIS','SCOPE','NESTED']){
 const q=await realParentFixture(),c:any={schemaVersion:1,projectId:pid,commandId:crypto.randomUUID(),clientId:pid,controlGeneration:1,operation:'prepareAssignment',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:q.child};
 const saved:any=await q.store.save(q.db,actor,c,policyRef),locks:string[]=[];const query=q.db.query;q.db.query=async(sql:string,p:any[]=[])=>{if(sql.startsWith('INSERT INTO anvil.assignment_content_reviews')){q.writes.push(sql);return {rows:[]};}if(sql.startsWith('SELECT head_version'))locks.push(p[1]);return query(sql,p);};
 if(kind==='HEAD')q.heads.set(q.parent.data.ref.id,2);if(kind==='REVIEW')q.parentState.decision.latestReviewAccepted=false;if(kind==='BASIS')q.decision.currentConfirmationValid=false;
 if(kind==='SCOPE')q.parentState.confirmed.snapshot.definition.allowedScopes=[];if(kind==='NESTED')q.parentState.confirmed.snapshot.definition.parentAssignmentRef=policyRef;
 const current=()=>q.store.currentForContent(q.db,actor,pid,saved.data.ref);
 if(kind==='NORMAL'){assert.deepEqual((await current()).ref,saved.data.ref);assert.equal(locks[0],q.parent.data.ref.id);assert.equal(locks.at(-1),saved.data.ref.id);const contents=new module.ProjectAssignmentConfirmations(q.store);const review:any=await contents.reviewContent(q.db,actor,{...c,commandId:crypto.randomUUID(),operation:'reviewAssignmentContent',targetId:saved.data.ref.id,expectedVersion:1,payload:{...setup().reviewInput(),draftRef:saved.data.ref}},policyRef);assert.equal(review.data.status,'ASSIGNMENT_CONTENT_REVIEWED');}
 else await assert.rejects(current());
 }
});

test('기존 GET2/POST2 실제 route는 HUMAN sibling만 명시 선택하며 일반 reader 주입을 바꾸지 않는다',async()=>{
 const calls:string[]=[],proto=module.ProjectAssignmentConfirmations.prototype,policies=ProjectPolicyRepository.prototype;
 const oldRead=proto.readContent,oldDecision=proto.decisionContent,oldCommand=policies.assignmentContentCommand;
 const app=Fastify(),repository:any={signProjectCursor:()=> 'synthetic',authenticated:async(_t:any,_c:any,fn:any)=>fn({},actor)};
 try{
 proto.readContent=async()=>{calls.push('readContent');return{marker:'readContent'};};proto.decisionContent=async()=>{calls.push('decisionContent');return{marker:'decisionContent'};};policies.assignmentContentCommand=async(_t:any,_c:any,c:any)=>{calls.push(c.operation);return{marker:c.operation};};
 registerProjectRoutes(app,{repository,origin:'https://anvil-synthetic.invalid'});
 const headers={host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+'S'.repeat(43),'x-anvil-csrf':'C'.repeat(43)};
 for(const [path,expected]of [[`/api/v1/projects/${pid}/assignment-drafts/${id}/versions/1/decision`,'decisionContent'],[`/api/v1/projects/${pid}/assignments/${id}/versions/1`,'readContent']]){const result=await app.inject({method:'GET',url:path!,headers});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().marker,expected);}
 for(const operation of ['reviewAssignmentContent','confirmAssignment']){const c=setup().command(operation,setup().reviewInput());const result=await app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers,payload:c});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().marker,operation);}
 assert.deepEqual(calls,['decisionContent','readContent','reviewAssignmentContent','confirmAssignment']);
 }finally{proto.readContent=oldRead;proto.decisionContent=oldDecision;policies.assignmentContentCommand=oldCommand;await app.close();}
});
