import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {NormalUnderstandingReviews,readNormalUnderstandingReviewOptions} from '../../../apps/server/modules/executions/normal-understanding-review.ts';
import {buildApp} from '../../../apps/server/app.ts';
const H=(v:unknown)=>contentHash(canonicalJson(v));
const codes=['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'];
// 기존 승인 RAM 원장의 query 형상을 재사용한다. 아래 목적 RPC는 SQL/실PG가 아닌 보호 메타 근거 대역이다.
const approvalId=(n:number)=>'af090056-0000-4000-8000-'+String(n).padStart(12,'0'),approvalPid=approvalId(1),approvalActor:any={actorId:approvalId(2),clientId:approvalId(3),credentialGeneration:1};
const approvalRef=(n:number)=>({id:approvalId(n),version:1,contentHash:'a'.repeat(64)});
function reviewPayload(){return{bundleRef:approvalRef(10),responseRef:approvalRef(11),subjectBindingRef:approvalRef(12),criteriaVersion:1,items:codes.map(code=>({code,sourceRefs:[approvalRef(40)],responsePartRefs:[approvalRef(42)],judgement:'MATCH',reason:'원문 응답 대조'})),reason:'별도 사람 판단'};}
const reviewCommand=(payload=reviewPayload()):any=>({schemaVersion:1,projectId:approvalPid,commandId:approvalId(30),clientId:approvalActor.clientId,controlGeneration:1,operation:'reviewUnderstanding',targetId:approvalId(70),expectedVersion:3,baselineRefs:[],approvalRef:null,payload});
function reviewRule(disposition='REQUIRE_APPROVAL'){return{ruleId:'review',subjectRef:{kind:'HUMAN',userId:approvalActor.actorId},operations:['reviewUnderstanding','requestApproval','decideApproval'],targetScopes:[{kind:'PROJECT',projectId:approvalPid}],disposition,limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'};}
function approvalFixture(){
 const state={calls:0,driftAt:Infinity,currentUnavailable:false,commitUnknown:false,authRevoked:false,memberRevoked:false,memberRole:'OWNER',revokeAfterHistory:false,historyDelay:0,historyCalls:0,releases:[] as boolean[],trace:[] as string[]};let backup:any,committed=false;
 let data:any={commands:[],receipts:[],audits:[],requests:[],decisions:[],consumptions:[],candidates:[],preparations:[],notifications:[],reviews:[]};
 const at=new Date();let clock=at;const live:any={...approvalActor,authSession:{id:approvalId(80),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
 const input=reviewPayload(),control={actor_id:approvalActor.actorId,client_id:approvalActor.clientId,generation:1,revoked_at:null as Date|null};let failAt='';
 const rules=[{...reviewRule(),operations:['reviewUnderstanding']},{...reviewRule('AUTO'),ruleId:'approval',operations:['requestApproval','decideApproval','readNormalUnderstandingResponse']}],policyRow={id:approvalId(4),head_version:1,rules_json:rules,reason:'현재 합성 정책',review_refs:[],created_at:at,content_hash:H({rules,reason:'현재 합성 정책',reviewRefs:[]})},policyRef={id:policyRow.id,version:1,contentHash:policyRow.content_hash};
 const commandRow=(cid:string)=>data.commands.find((c:any)=>c.id===cid),receiptRow=(cid:string)=>data.receipts.find((a:any)=>a.command_id===cid);
 const db:any={query:async(sql:string,p:any[]=[])=>{
  if(failAt&&sql.startsWith(failAt))throw Error('SYNTHETIC_STORAGE_FAILURE');
  const rows=(v:any[])=>({rows:v,rowCount:v.length});
  state.trace.push(sql);
  if(sql==='BEGIN'){backup=structuredClone(data);committed=false;return{rows:[],command:'BEGIN'};}
  if(sql==='COMMIT'){committed=true;return{rows:[],command:state.commitUnknown?'':'COMMIT'};}
  if(sql==='ROLLBACK'){if(!committed)data=backup;return{rows:[],command:'ROLLBACK'};}
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return rows(state.authRevoked?[]:[{id:live.authSession.id,uid:live.actorId,client_id:live.clientId,current_generation:1,credential_generation:1,user_status:'ACTIVE',user_revoked_at:null,client_revoked_at:null,revoked_at:null,idle_expires_at:new Date(live.authSession.idleExpiresAt),absolute_expires_at:new Date(live.authSession.absoluteExpiresAt),reauth_until:new Date('2099-01-01'),csrf_digest:contentHash('c'.repeat(43)),server_owner:false}]);
  if(sql.startsWith('UPDATE anvil.auth_sessions'))return rows([]);
  if(sql.includes('fn09_normal_understanding_metadata_current')){
   const selection=JSON.parse(p[3]);assert.equal(p[5],'17');
   if(selection.purpose==='NORMAL_REVIEW_HISTORY'){
    state.historyCalls++;assert.equal(p[4],null);assert.deepEqual(Object.keys(selection).sort(),['purpose','projectId','executionId','executionGeneration'].sort());
    if(state.memberRevoked)throw Object.assign(Error('NOT_FOUND'),{code:'P0001'});
    const found=data.reviews.filter((v:any)=>v.project_id===selection.projectId&&v.execution_id===selection.executionId&&v.generation===selection.executionGeneration);
    assert.ok(found.length<=1,'normal history is exactly zero or one');
    const items=found.map((v:any)=>{const h=data.commands.find((h:any)=>h.id===v.command_id),receipt=data.receipts.find((r:any)=>r.command_id===h?.id),audit=data.audits.find((r:any)=>r.command_id===h?.id);assert.ok(h&&receipt&&audit);assert.equal(v.content_hash,H(v.snapshot_json));assert.deepEqual(h.result_ref.data,{status:'NORMAL_UNDERSTANDING_REVIEWED',ref:{id:v.id,version:v.version,contentHash:v.content_hash},snapshot:v.snapshot_json});return {ref:{id:v.id,version:v.version,contentHash:v.content_hash},snapshot:v.snapshot_json};});
    if(state.revokeAfterHistory)state.memberRevoked=true;
    if(state.historyDelay)clock=new Date(clock.getTime()+state.historyDelay);
    return rows([{projection:{transport:'NORMAL_PROTECTED',scope:{projectId:selection.projectId,executionId:selection.executionId,executionGeneration:selection.executionGeneration},items,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false}}]);
   }
   if(selection.purpose==='NORMAL_REVIEW_REPLAY'){const c=data.commands.find((c:any)=>c.command_id===selection.commandId&&c.project_id===selection.projectId&&c.request_hash===selection.requestHash),v=c&&data.reviews.find((v:any)=>v.command_id===c.id);assert.ok(v);assert.equal(v.content_hash,H(v.snapshot_json));return rows([{projection:c.result_ref}]);}
   assert.equal(selection.purpose,'NORMAL_REVIEW_BASIS');assert.deepEqual(selection.responseRef,approvalRef(11));state.calls++;if(state.currentUnavailable)throw Object.assign(Error('UNDERSTANDING_NORMAL_CURRENT_REQUIRED'),{code:'P0001'});
   const ground={bundleRef:approvalRef(10),preparationRef:approvalRef(14),grantRef:approvalRef(15),startCommandRef:approvalRef(16),manifestRef:approvalRef(17),roleBindingRef:approvalRef(12),agentSessionRef:approvalRef(18),roleRef:approvalRef(19),basisRefs:state.calls>=state.driftAt?[approvalRef(40),approvalRef(44)]:[approvalRef(40)],latestInstructionRefs:[],requiredPartRefs:[approvalRef(41)],receivedPartRefs:[approvalRef(41)],deliveryReceiptRefs:[approvalRef(43)],status:'SOURCE_BASIS_ONLY',subjectBindingState:'VERIFIED',subjectBindingRef:approvalRef(12),reviewAvailable:false,scope:{projectId:approvalPid,executionId:approvalId(70),executionGeneration:3},requestRef:approvalRef(20),responseRef:approvalRef(11),responsePartRefs:[approvalRef(42)],checkedAt:clock.toISOString(),expiresAt:new Date(clock.getTime()+20000).toISOString(),executionAuthorized:false,dispatchPerformed:false};
   return rows([{projection:ground}]);
  }
  if(sql.startsWith('SELECT id FROM anvil.understanding_reviews'))return rows(data.reviews.filter((v:any)=>v.project_id===p[0]&&v.execution_id===p[1]&&v.generation===p[2]));

  if(sql.startsWith('SELECT p.id,p.archived_at'))return rows(!state.memberRevoked&&p[0]===approvalPid&&p[1]===live.actorId?[{id:approvalPid,participation:state.memberRole,archived_at:null}]:[]);
  if(sql.includes('FROM anvil.permission_policies p JOIN'))return rows([policyRow]);
  if(sql.startsWith('SELECT * FROM anvil.project_control')||sql.startsWith('SELECT actor_id,client_id,generation'))return rows([control]);
  if(sql.startsWith('SELECT transaction_timestamp'))return rows([{at}]);if(sql.startsWith('SELECT clock_timestamp'))return rows([{at:clock,transaction_id:'17'}]);
  if(sql.startsWith('SELECT set_config')||sql.startsWith('SELECT anvil.assert_approval_notification_capacity'))return rows([]);
  if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return rows(data.commands.filter((c:any)=>c.project_id===p[0]&&c.actor_id===p[1]&&c.command_id===p[2]));
  if(sql.startsWith('SELECT 1 FROM anvil.approval_requests'))return rows(data.requests.filter((r:any)=>r.project_id===p[0]&&r.candidate_command_id===p[1]));
  if(sql.startsWith('SELECT 1 FROM anvil.commands'))return rows(data.commands.filter((c:any)=>c.project_id===p[0]&&c.actor_id===p[1]&&c.command_id===p[2]));
  if(sql.startsWith('INSERT INTO anvil.commands')){data.commands.push({id:p[0],project_id:p[1],actor_id:p[2],client_id:p[3],operation:p[4],command_id:p[5],request_hash:p[6],operation_id:p[7],state:'APPLIED',authorization_receipt_id:p[8],approval_consumption_id:p[9],expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),payload_ref:p[13]===null?null:JSON.parse(p[13]),result_ref:JSON.parse(p[14])});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){data.receipts.push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],command_id:p[2],subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6]});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.audit_events')){if(sql.includes("'DENIED'")){data.audits.push({outcome:'DENIED',reason_code:p[5]});return rows([]);}data.audits.push({project_id:p[0],event_id:p[1],actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),policy_ref:JSON.parse(p[7]),approval_ref:p[8]===null?null:JSON.parse(p[8]),reason_code:p[9],scope_digest:p[10],outcome:'APPLIED'});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.approval_requests')){data.requests.push({id:p[0],project_id:p[1],version:1,candidate_command_id:p[2],action_scope_json:JSON.parse(p[3]),scope_digest:p[4],details_json:JSON.parse(p[5]),required_decider_ref:JSON.parse(p[6]),status:'PENDING',expires_at:new Date(p[7]),created_by:p[8],client_id:p[9],command_id:p[10],policy_ref:JSON.parse(p[11]),content_hash:p[12],request_json:JSON.parse(p[13]),created_at:new Date(p[14])});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.understanding_review_approval_candidates')){data.candidates.push({project_id:p[0],request_id:p[1],request_command_id:p[2],candidate_command_id:p[3],payload_hash:p[4],payload_json:JSON.parse(p[5]),created_by:p[6],client_id:p[7],control_generation:p[8],policy_ref:JSON.parse(p[9]),command_hash:p[10]});return rows([]);}
  if(sql.startsWith('SELECT b.*,c.command_id request_key'))return rows(data.candidates.filter((b:any)=>b.project_id===p[0]&&b.request_id===p[1]).map((b:any)=>{const c=commandRow(b.request_command_id);return{...b,request_key:c.command_id,request_hash:c.request_hash,request_operation:c.operation,request_actor:c.actor_id,request_client:c.client_id};}));
  if(sql.startsWith('SELECT r.*,c.operation'))return rows(data.requests.filter((r:any)=>r.project_id===p[0]&&r.id===p[1]).map((r:any)=>{const c=commandRow(r.command_id);return{...r,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,result_ref:c.result_ref};}));
  if(sql.startsWith('INSERT INTO anvil.approval_decisions')){data.decisions.push({id:p[0],project_id:p[1],request_id:p[2],request_version:p[3],scope_digest:p[4],decision:p[5],reason:p[6],decided_by:p[7],client_id:p[8],control_generation:p[9],decided_at:new Date(p[10]),command_id:p[11],content_hash:p[12],decision_json:JSON.parse(p[13])});return rows([]);}
  if(sql.startsWith('SELECT d.*,c.operation'))return rows(data.decisions.filter((d:any)=>d.project_id===p[0]&&d.request_id===p[1]).map((d:any)=>{const c=commandRow(d.command_id);return{...d,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,expected_version:c.expected_version,result_ref:c.result_ref};}));
  if(sql.startsWith('SELECT ac.*,c.command_id'))return rows(data.consumptions.filter((x:any)=>x.project_id===p[0]&&x.decision_id===p[1]).map((x:any)=>{const c=commandRow(x.command_id),a=receiptRow(x.command_id);return{...x,...c,id:x.id,candidate_command_id:c.command_id,approval_decision_ref:a.approval_decision_ref};}));
  if(sql.startsWith('INSERT INTO anvil.approval_consumptions')){data.consumptions.push({id:p[0],project_id:p[1],decision_id:p[2],command_id:p[3],scope_digest:p[4],policy_id:p[5],policy_version:p[6],consumed_at:at});return rows([]);}
  if(sql.startsWith('UPDATE anvil.approval_requests')){const r=data.requests.find((r:any)=>r.project_id===p[0]&&r.id===p[1]);if(!r)return rows([]);if(sql.includes("status='CONSUMED'")){if(r.version!==2||r.status!=='APPROVED')return rows([]);r.status='CONSUMED';r.version=3;}else{if(r.version!==p[3]||r.status!=='PENDING')return rows([]);r.status=p[2];r.version++;}return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.notifications')){data.notifications.push(p);return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.understanding_reviews')){data.reviews.push({project_id:p[0],execution_id:p[1],generation:p[2],id:p[3],version:p[4],content_hash:p[5],snapshot_json:JSON.parse(p[6]),created_by:p[7],client_id:p[8],command_id:p[9]});return{rows:[],rowCount:1};}
  if(sql.includes('FROM anvil.understanding_reviews v'))return rows(data.reviews.filter((v:any)=>v.project_id===p[0]&&v.execution_id===p[1]&&v.generation===p[2]).map((v:any)=>{const c=commandRow(v.command_id),ar=receiptRow(v.command_id),audit=data.audits.find((a:any)=>a.command_id===c.id),ac=data.consumptions.find((a:any)=>a.id===c.approval_consumption_id),ad=ac&&data.decisions.find((a:any)=>a.id===ac.decision_id),r=ad&&data.requests.find((a:any)=>a.id===ad.request_id),b=r&&data.candidates.find((a:any)=>a.request_id===r.id);return{...v,command_actor:c.actor_id,command_client:c.client_id,command_key:c.command_id,operation:c.operation,state:c.state,request_hash:c.request_hash,policy_ref:c.policy_ref,result_ref:c.result_ref,approval_consumption_id:c.approval_consumption_id,payload_ref:c.payload_ref,approval_decision_ref:ar.approval_decision_ref,audit_approval_ref:audit.approval_ref,approval_consumption_row:ac??null,approval_decision_row:ad??null,approval_request_row:r??null,approval_candidate_row:b??null,approval_request_command:r?commandRow(r.command_id):null,approval_decision_command:ad?commandRow(ad.command_id):null,authorization_subject:ar.subject_ref,authorization_policy:ar.policy_ref,authorization_scope:ar.scope_digest,audit_scope:audit.scope_digest,audit_outcome:audit.outcome,audit_source:'HUMAN_COMMAND'};}));
  throw Error('UNEXPECTED_PREPARE_QA_QUERY '+sql.slice(0,140));
 }};
 const atomic=async(fn:()=>Promise<any>)=>{const before=structuredClone(data);try{return await fn();}catch(e){data=before;throw e;}};
 const access=new AccessRepository({connect:async()=>Object.assign(db,{release:(e?:Error)=>state.releases.push(!!e)})} as any,{installationId:approvalPid,key:randomBytes(32)});
 const policies=new ProjectPolicyRepository(access),approvals=new ProjectApprovals();
 const preparations=new NormalUnderstandingReviews(access);
 const scope={operation:'reviewUnderstanding',targetRef:null,expectedVersion:3,payloadHash:H(input),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:approvalActor.actorId,clientId:approvalActor.clientId},controlGeneration:1};
 const details:any={candidateCommandId:approvalId(30),actionScope:scope,reason:'준비본 내용 검토',risks:{data:'자료 보존',security:'실권한 없음',cost:'호출 없음',interruption:'없음',unverified:'능력 예산 미검증'},rollback:{method:'전부 rollback',limitations:'실행 안함',evidenceRefs:[]},expiresAt:'2098-01-01T00:00:00.000Z'};
 const request:any={...reviewCommand(),commandId:approvalId(31),operation:'requestApproval',targetId:null,expectedVersion:0,payload:{details,candidatePayload:reviewCommand(input)}};
 const run=(c:any,handler:any)=>policies.command('t'.repeat(43),'c'.repeat(43),c,handler);
 const ask=()=>run(request,(d:any,a:any,p:any)=>approvals.request(d,a,request,p));
 const decide=(rid:string,decision='APPROVE')=>{const c:any={...reviewCommand(),commandId:approvalId(32),operation:'decideApproval',targetId:rid,expectedVersion:1,payload:{requestId:rid,expectedVersion:1,scopeDigest:H(scope),decision,reason:'별도 사람 결정'}};return run(c,(d:any,a:any,p:any)=>approvals.decide(d,a,c,p));};
 const store=(c:any)=>preparations.command('t'.repeat(43),'c'.repeat(43),c);
 return{state,access,db,actor:live,input,control,policyRef,policyRow,details,request,approvals,preparations,ask,decide,store,atomic,run,get data(){return data;},advance:(at:Date)=>{clock=at;},fail:(prefix:string)=>{failAt=prefix;}};
}

const enabled={mode:'NORMAL_PROTECTED',purpose:'FN09_NORMAL_FIRST_REVIEW'} as const;
function auto(f:ReturnType<typeof approvalFixture>){f.policyRow.rules_json[0]!.disposition='AUTO';f.policyRow.content_hash=H({rules:f.policyRow.rules_json,reason:f.policyRow.reason,reviewRefs:f.policyRow.review_refs});}
async function approved(){const f=approvalFixture(),r=await f.ask(),d=await f.decide(r.data.ref.id),c=reviewCommand(f.input);c.approvalRef={requestId:r.data.ref.id,decisionId:d.data.ref.id,scopeDigest:H(f.details.actionScope)};return{f,c};}
test('normal 첫 검토 실제 provider는 현재 메타 근거와 기존 C/A/U·INSERT를 같은 거래로 저장하고 동일 명령은 원 refs를 반환한다 · RAM',async()=>{
 const f=approvalFixture();auto(f);const c=reviewCommand(f.input);c.payload.items[4].judgement='INSUFFICIENT';const r=await f.store(c);
 assert.equal(r.data.status,'NORMAL_UNDERSTANDING_REVIEWED');assert.equal(r.data.snapshot.currentBinding.transport,'NORMAL_PROTECTED');assert.deepEqual(r.data.snapshot.currentBinding.subjectBindingRef,f.input.subjectBindingRef);assert.equal(r.data.snapshot.outcome,'NOT_ACCEPTED');assert.equal(r.data.snapshot.executionAuthorized,false);assert.equal(f.data.reviews.length,1);
 assert.deepEqual(await f.store(c),r);assert.equal(f.data.reviews.length,1);assert.equal(f.data.commands.length,1);assert.equal(f.data.receipts.length,1);assert.equal(f.data.consumptions.length,0);
 assert.ok(f.state.trace.some(s=>s.startsWith('INSERT INTO anvil.understanding_reviews')));assert.ok(!JSON.stringify(r).includes('body_bytes'));
});
test('normal 첫 검토는 실제 기존 승인 요청·결정·정확 일회소비·재확인을 보존한다 · RAM',async()=>{
 const {f,c}=await approved(),r=await f.store(c);assert.equal(r.data.status,'NORMAL_UNDERSTANDING_REVIEWED');assert.equal(f.data.reviews.length,1);assert.equal(f.data.consumptions.length,1);assert.equal(f.data.requests[0].status,'CONSUMED');const calls=f.state.calls;f.state.currentUnavailable=true;f.advance(new Date('2098-01-02'));assert.deepEqual(await f.store(c),r);assert.equal(f.state.calls,calls);assert.equal(f.data.consumptions.length,1);
 for(const patch of [{commandId:approvalId(99)},{payload:{...c.payload,reason:'다른 판단'}}])await assert.rejects(f.store({...c,...patch}));assert.equal(f.data.reviews.length,1);
});
test('normal current drift/INSERT 실패는 기존 승인 소비·C/A/U까지 rollback하고 COMMIT 불명은 동일 명령 외 재시도하지 않는다 · RAM',async()=>{
 for(const mode of ['drift','insert']){const {f,c}=await approved();if(mode==='drift')f.state.driftAt=3;else f.fail('INSERT INTO anvil.understanding_reviews');await assert.rejects(f.store(c));assert.equal(f.data.reviews.length,0);assert.equal(f.data.consumptions.length,0);assert.equal(f.data.requests[0].status,'APPROVED');assert.equal(f.data.commands.filter((c:any)=>c.operation==='reviewUnderstanding').length,0);}
 const f=approvalFixture();auto(f);const c=reviewCommand(f.input);f.state.commitUnknown=true;await assert.rejects(f.store(c),{message:'NORMAL_UNDERSTANDING_REVIEW_UNKNOWN'});assert.equal(f.data.reviews.length,1);assert.equal(f.state.releases.at(-1),true);f.state.commitUnknown=false;const r=await f.store(c);assert.equal(r.data.status,'NORMAL_UNDERSTANDING_REVIEWED');assert.equal(f.data.reviews.length,1);
});
test('normal basis 출처/6기준·현재 권한 실패는 새 저장을 만들지 않는다 · RAM',async()=>{
 for(const mode of ['subject','parts','DENY','expired']){const f=approvalFixture();auto(f);const c=reviewCommand(f.input);if(mode==='subject')c.payload.subjectBindingRef=approvalRef(99);if(mode==='parts')c.payload.items[0].responsePartRefs=[approvalRef(99)];if(mode==='DENY'){f.policyRow.rules_json[0]!.disposition='DENY';f.policyRow.content_hash=H({rules:f.policyRow.rules_json,reason:f.policyRow.reason,reviewRefs:f.policyRow.review_refs});}if(mode==='expired')f.advance(new Date('2100-01-01'));await assert.rejects(f.store(c));assert.equal(f.data.reviews.length,0);assert.equal(f.data.commands.length,0);}
});
function app(f:ReturnType<typeof approvalFixture>,configured=true,synthetic?:any){const args:any[]=[{},undefined,{repository:f.access,origin:'https://normal.invalid',artifactRoot:resolve('RAM-NOT-USED'),exportRoot:resolve('RAM-NOT-USED')}];args[3]=synthetic;if(configured)args[26]=enabled;return buildApp(...args as Parameters<typeof buildApp>);}
test('명시 normal 구성에서만 기존 command HTTP가 실제 정상 provider까지 도달하고 기본·혼합·헤더는 닫힌다 · Fastify RAM',async()=>{
 for(const configured of [false,true]){const f=approvalFixture();auto(f);const a=app(f,configured),c=reviewCommand(f.input);try{const r=await a.inject({method:'POST',url:'/api/v1/projects/'+approvalPid+'/commands',headers:{host:'normal.invalid',origin:'https://normal.invalid',cookie:'__Host-anvil.sid='+'t'.repeat(43),'x-anvil-csrf':'c'.repeat(43),'idempotency-key':c.commandId},payload:c});assert.equal(r.statusCode,configured?200:400,r.body);assert.equal(f.data.reviews.length,configured?1:0);}finally{await a.close();}}
 const f=approvalFixture();assert.throws(()=>app(f,true,{}),/CONFIGURATION_INVALID/);let invoked=0;assert.throws(()=>readNormalUnderstandingReviewOptions(Object.defineProperty({mode:enabled.mode},'purpose',{enumerable:true,get(){invoked++;return enabled.purpose;}}) as any));assert.equal(invoked,0);
 const a=app(f);try{const c=reviewCommand(f.input);const r=await a.inject({method:'POST',url:'/api/v1/projects/'+approvalPid+'/commands?extra=1',headers:{host:'normal.invalid',origin:'https://normal.invalid',cookie:'__Host-anvil.sid='+'t'.repeat(43),'x-anvil-csrf':'c'.repeat(43)},payload:c});assert.equal(r.statusCode,400);assert.equal(f.data.reviews.length,0);
  const bearer=await a.inject({method:'POST',url:'/api/v1/projects/'+approvalPid+'/commands',headers:{host:'normal.invalid',origin:'https://normal.invalid',cookie:'__Host-anvil.sid='+'t'.repeat(43),'x-anvil-csrf':'c'.repeat(43),authorization:'Bearer av3ex1_'+'a'.repeat(43)},payload:c});assert.equal(bearer.statusCode,403);assert.equal(f.data.reviews.length,0);
 }finally{await a.close();}
});

const historyScope={projectId:approvalPid,executionId:approvalId(70),executionGeneration:3};
const historyUrl='/api/v1/projects/'+approvalPid+'/executions/'+approvalId(70)+'/understanding-reviews?generation=3';
const historyHeaders={host:'normal.invalid',origin:'https://normal.invalid',cookie:'__Host-anvil.sid='+'t'.repeat(43)};
test('normal history HTTP는 회원의 새 조회만 검산하고 과거 승인·grant·수송 만료 뒤에도 원 판단만 반환한다 · RAM',async()=>{
 const {f,c}=await approved(),stored=await f.store(c),writes=[f.data.commands.length,f.data.receipts.length,f.data.audits.length,f.data.consumptions.length];
 f.state.currentUnavailable=true;f.advance(new Date('2098-02-01'));f.actor.actorId=approvalId(90);f.actor.clientId=approvalId(91);f.state.memberRole='VIEWER';
 const a=app(f);try{const r=await a.inject({method:'GET',url:historyUrl,headers:historyHeaders});assert.equal(r.statusCode,200,r.body);assert.equal(r.headers['cache-control'],'no-store');const v=r.json();assert.equal(v.transport,'NORMAL_PROTECTED');assert.equal(v.currentness,'NOT_RECHECKED');assert.deepEqual(v.items,[{ref:stored.data.ref,snapshot:stored.data.snapshot}]);assert.equal(v.executionAuthorized,false);assert.equal(v.dispatchPerformed,false);assert.equal(f.state.calls,3);assert.deepEqual([f.data.commands.length,f.data.receipts.length,f.data.audits.length,f.data.consumptions.length],writes);
  const {validateNormalUnderstandingHistory,readNormalUnderstandingHistory}=await import('../../../apps/web/src/features/session-detail/understanding-history-api.ts');
  assert.deepEqual(await validateNormalUnderstandingHistory(v,historyScope),v);
  const {ApiClient}=await import('../../../apps/web/src/api/client.ts');let calls=0;const client=new ApiClient(async(path,options)=>{calls++;assert.equal(path,historyUrl);assert.equal(options?.credentials,'same-origin');assert.equal(options?.cache,'no-store');return new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});});
  assert.deepEqual(await readNormalUnderstandingHistory(client,historyScope,()=>true),v);assert.equal(calls,1);
  for(const mutate of [(x:any)=>x.items.push(x.items[0]),(x:any)=>x.items[0].snapshot.currentBinding.transport='SYNTHETIC_ONLY',(x:any)=>x.items[0].snapshot.input.reason='변조',(x:any)=>x.scope.executionGeneration=4]){const bad=structuredClone(v);mutate(bad);await assert.rejects(validateNormalUnderstandingHistory(bad,historyScope));if(bad.items.length===1){bad.items[0].ref.contentHash=H(bad.items[0].snapshot);await assert.rejects(validateNormalUnderstandingHistory(bad,historyScope));}}
 }finally{await a.close();}
});
test('normal history EMPTY·default off와 혼입/손상/회원 폐기/새 조회 만료를 구분하며 효과를 추가하지 않는다 · RAM',async()=>{
 for(const mode of ['empty','default','duplicate','synthetic','corrupt','member','late-member','expired','unknown']){const f=approvalFixture();auto(f);if(!['empty','default'].includes(mode))await f.store(reviewCommand(f.input));if(mode==='duplicate')f.data.reviews.push(structuredClone(f.data.reviews[0]));if(mode==='synthetic')f.data.reviews[0].snapshot_json.currentBinding.transport='SYNTHETIC_ONLY';if(mode==='corrupt')f.data.reviews[0].content_hash='0'.repeat(64);if(mode==='member')f.state.memberRevoked=true;if(mode==='late-member')f.state.revokeAfterHistory=true;if(mode==='expired')f.state.historyDelay=31000;if(mode==='unknown')f.state.commitUnknown=true;
  const a=app(f,mode!=='default');try{const r=await a.inject({method:'GET',url:historyUrl,headers:historyHeaders});assert.equal(r.statusCode,mode==='empty'?200:['member','late-member'].includes(mode)?404:mode==='expired'?401:503,mode+': '+r.body);if(mode==='empty')assert.deepEqual(r.json().items,[]);assert.equal(r.headers['cache-control'],'no-store');assert.equal(f.data.commands.length,mode==='empty'||mode==='default'?0:1);}finally{await a.close();}
 }
 const f=approvalFixture(),a=app(f);try{for(const headers of [{...historyHeaders,authorization:'Bearer no'},{...historyHeaders,host:'other.invalid'},{...historyHeaders,origin:'https://other.invalid'}])assert.equal((await a.inject({method:'GET',url:historyUrl,headers})).statusCode,403);assert.equal((await a.inject({method:'GET',url:historyUrl+'&extra=1',headers:historyHeaders})).statusCode,400);assert.equal(f.state.historyCalls,0);}finally{await a.close();}
});

test('scope 전용 history는 stalled stream을 새 30초에 취소하고 원 transport의 오래된 성공/401을 폐기한다 · RAM',async(t)=>{
 const {readNormalUnderstandingHistory,validateUnderstandingHistory}=await import('../../../apps/web/src/features/session-detail/understanding-history-api.ts'),{ApiClient,ApiError}=await import('../../../apps/web/src/api/client.ts');
 const f=approvalFixture();auto(f);await f.store(reviewCommand(f.input));const v=await f.preparations.list('t'.repeat(43),historyScope);
 await assert.rejects(validateUnderstandingHistory(v,historyScope));
 let cancelled=0,ready!:()=>void;const pending=new Promise<void>(resolve=>{ready=resolve;});
 t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});
 try{const client=new ApiClient(async()=>new Response(new ReadableStream({pull(){ready();},cancel(){cancelled++;}},{highWaterMark:0}),{headers:{'content-type':'application/json'}})),result=readNormalUnderstandingHistory(client,historyScope,()=>true);await pending;t.mock.timers.tick(30000);await assert.rejects(result,(e:any)=>e instanceof ApiError&&e.status===503);assert.equal(cancelled,1);}finally{t.mock.timers.reset();}
 for(const status of [200,401]){let reply!:(r:Response)=>void,started!:()=>void;const began=new Promise<void>(r=>{started=r;}),response=new Promise<Response>(r=>{reply=r;}),client=new ApiClient(async()=>{started();return response;}),result=readNormalUnderstandingHistory(client,historyScope,()=>true);await began;client.transport=async()=>{throw Error('new transport not called');};reply(new Response(JSON.stringify(status===200?v:{code:'AUTH_REQUIRED'}),{status,headers:{'content-type':'application/json'}}));assert.equal(await result,null);}
 const denied=new ApiClient(async()=>new Response(JSON.stringify({code:'AUTH_REQUIRED'}),{status:401,headers:{'content-type':'application/json'}}));await assert.rejects(readNormalUnderstandingHistory(denied,historyScope,()=>true),(e:any)=>e instanceof ApiError&&e.code==='AUTH_REQUIRED'&&e.status===401);
 let called=0;const unused=new ApiClient(async()=>{called++;throw Error('not reached');});assert.equal(await readNormalUnderstandingHistory(unused,historyScope,()=>false),null);assert.equal(called,0);
});
