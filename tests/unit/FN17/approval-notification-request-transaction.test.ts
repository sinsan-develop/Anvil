import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture as notificationFixture,actor,pid,uid,cid,id,at,sign} from './notification-fixture.ts';
import {fixture as activationFixture} from '../FN04/baseline-activation-fixture.ts';
import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {AuthFailure,type AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {DesignActivationApprovalCandidates} from '../../../apps/server/modules/approvals/design-activation-approval-candidate.ts';
import {WorkPlanApprovalCandidates} from '../../../apps/server/modules/approvals/work-plan-approval-candidate.ts';
import {membershipMigration,membershipChecksum} from '../../../apps/server/modules/projects/project-memberships.ts';
import {readMembershipCandidate} from '../../../contracts/runtime/project-membership-v1.ts';
import {understandingCodes} from '../../../apps/server/modules/executions/execution-understanding.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),error=(code:string,status:number)=>(e:unknown)=>e instanceof AuthFailure&&e.message===code&&e.statusCode===status;
function request(operation='uploadArtifact',key=id(41)):any{const original=notificationFixture().source.request_json.details,details=structuredClone(original),ref={id:id(80),version:1,contentHash:'c'.repeat(64)},payload=operation==='activateDesignChange'?activationFixture().input:operation==='saveWorkPlanDraft'?{documentRef:ref,designRef:{...ref,id:id(81)},screenReviewRefs:[],tasks:[],reason:'보관할 계획'}:null;details.candidateCommandId=id(Number(key.slice(-2))+100);details.actionScope.operation=operation;details.actionScope.targetRef=operation==='activateDesignChange'?(payload as any).changeRef:null;details.actionScope.expectedVersion=details.actionScope.targetRef?.version??0;if(payload)details.actionScope.payloadHash=hash(payload);return{schemaVersion:1,projectId:pid,commandId:key,clientId:cid,controlGeneration:1,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{details,...(payload?{candidatePayload:payload}:{})}};}
function understandingRequest(key=id(46)){
 const c=request('reviewUnderstanding',key),details=c.payload.details;
 const ref=(n:number)=>({id:id(n),version:1,contentHash:'c'.repeat(64)});
 const payload={bundleRef:ref(81),responseRef:ref(82),subjectBindingRef:ref(83),criteriaVersion:1,items:understandingCodes.map(code=>({code,sourceRefs:[ref(84)],responsePartRefs:[ref(85)],judgement:'MATCH',reason:'합성 대조'})),reason:'합성 판단'};
 const candidatePayload={schemaVersion:1,projectId:pid,commandId:details.candidateCommandId,clientId:cid,controlGeneration:1,operation:'reviewUnderstanding',targetId:id(86),expectedVersion:1,baselineRefs:[],approvalRef:null,payload};
 details.actionScope.expectedVersion=candidatePayload.expectedVersion;
 details.actionScope.payloadHash=hash(payload);
 c.payload.candidatePayload=candidatePayload;
 return c;
}
function backupPolicyRequest(key=id(48),previousRef=null as null|{id:string;version:number;contentHash:string}){
 const c=request('saveBackupPolicy',key),scope=c.payload.details.actionScope;
 const ref=(n:number)=>({id:id(n),version:1,contentHash:'d'.repeat(64)});
 const policy={targetProtectedRef:ref(90),encryptionKeyRef:ref(91),retentionPolicyRef:ref(92),verificationPolicyRef:ref(93),include:{documents:true,conversations:false,knowledge:false,decisions:false,plans:false,results:false,artifacts:false,sourceSelection:{kind:'NONE'}},schedule:'MANUAL',maxBytes:1024};
 const candidatePayload={policy,previousRef,reason:'수동 백업 정책의 합성 검토'};
 scope.targetRef=previousRef;
 scope.expectedVersion=previousRef?.version??0;
 scope.payloadHash=hash(candidatePayload);
 c.payload.candidatePayload=candidatePayload;
 return c;
}
const membershipTarget=id(95);
function membershipVersion(version:number,participation:'VIEWER'|'HANDOFF_ELIGIBLE'='VIEWER'){
 const snapshot={schemaVersion:1,projectId:pid,userId:membershipTarget,version,participation,revokedAt:null,reason:'합성 관측 당시 관계',sourceKind:'LEGACY_OBSERVED',previousRef:null,commandId:null,createdBy:null,clientId:null,recordedAt:at};
 return{project_id:pid,user_id:membershipTarget,version,content_hash:hash(snapshot),snapshot_json:snapshot,created_at:new Date(at),command_id:null,event_id:id(180+version)};
}
function membershipRequest(base:ReturnType<typeof membershipVersion>|null=null,key=id(51)){
 const c=request('saveProjectMembership',key),scope=c.payload.details.actionScope;
 c.payload.candidatePayload={targetUserRef:{kind:'HUMAN',userId:membershipTarget},participation:'OWNER',reason:'참여자 역할 변경의 합성 검토'};
 scope.targetRef=base?{id:base.user_id,version:base.version,contentHash:base.content_hash}:null;
 scope.expectedVersion=base?.version??0;
 scope.payloadHash=hash(c.payload.candidatePayload);
 return c;
}
function inserted(sql:string,args:any[]){const match=/INSERT INTO anvil\.[a-z_]+\(([^)]+)\)\s*VALUES\(([^)]+)\)/.exec(sql);assert.ok(match,'관측 INSERT는 명시 column/value 계약이어야 한다');const names=match[1]!.split(',').map(v=>v.trim()),values=match[2]!.split(',').map(v=>v.trim());assert.equal(names.length,values.length);return Object.fromEntries(names.map((name,i)=>{const token=values[i]!;if(/^\$\d+$/.test(token))return[name,args[Number(token.slice(1))-1]];if(/^'.*'$/.test(token))return[name,token.slice(1,-1)];if(/^\d+$/.test(token))return[name,Number(token)];throw Error('UNEXPECTED_INSERT_VALUE:'+token);}));}
function transactionFixture(originModel:'BEFORE'|'BEFORE_BACKUP'|'BEFORE_MEMBERSHIP'|'AFTER'='AFTER'){
 const f=notificationFixture(),stored={requests:[] as any[],notifications:[] as any[],captures:[] as any[]},events:string[]=[],unexpected:string[]=[],priorRows={count:0},fault={mode:''},identity={value:structuredClone(actor) as Omit<typeof actor,'reauthUntil'>&{reauthUntil:Date|null}},raw=f.db.query.bind(f.db);let queue=Promise.resolve();
 f.rules.splice(0,f.rules.length,{...structuredClone(f.rules[0]!),ruleId:'request',operations:['requestApproval'],disposition:'AUTO'},{...structuredClone(f.rules[0]!),ruleId:'candidate',operations:['uploadArtifact','saveWorkPlanDraft','activateDesignChange','reviewUnderstanding','saveBackupPolicy','saveProjectMembership'],disposition:'REQUIRE_APPROVAL'});
 let sourceId:string|undefined;
 const auditSources:string[]=[];
 const membershipVersions:ReturnType<typeof membershipVersion>[]=[];
 const membershipHead={version:0};
 identity.value.reauthUntil=new Date('2099-01-01T00:00:00.000Z');
 function verifiedMembership(requestRow:any,project:string,source:string,recipient:string,commandRow:any):unknown{
  const q=JSON.parse(requestRow.request_json),scope=q.details.actionScope;
  if(originModel==='BEFORE_MEMBERSHIP'||fault.mode==='MISSING_MEMBERSHIP_CANDIDATE')return null;
  const raw=q.membershipCandidate;
  if(fault.mode==='TAMPERED_MEMBERSHIP_CANDIDATE')raw.command.payload.reason='변조된 이유';
  if(fault.mode==='OTHER_MEMBERSHIP_ROLE')raw.baseMembership.participation='OWNER';
  if(fault.mode==='OTHER_MEMBERSHIP_CLIENT')raw.command.clientId=id(97);
  if(fault.mode==='SELF_MEMBERSHIP_COMMAND')raw.command.commandId=commandRow.command_id;
  if(fault.mode==='STALE_MEMBERSHIP_REF')raw.baseMembership.ref.version++;
  let candidate;
  try{candidate=readMembershipCandidate(raw);}catch{return null;}
  const {command,baseMembership:base}=candidate;
  if(project!==requestRow.project_id||source!==requestRow.command_id||recipient!==requestRow.created_by||command.projectId!==project||command.commandId!==requestRow.candidate_command_id||command.commandId===commandRow.command_id||command.clientId!==commandRow.client_id||command.controlGeneration!==commandRow.control_generation||scope.expectedVersion!==command.expectedVersion||scope.payloadHash!==hash(command.payload))return null;
  if(base.kind==='NEW')return scope.targetRef===null?command.payload:null;
  if(hash(base.ref)!==hash(scope.targetRef))return null;
  const version=membershipVersions.find(v=>v.project_id===project&&v.user_id===base.ref.id&&v.version===base.ref.version);
  if(!version||fault.mode==='MISSING_MEMBERSHIP_VERSION'||fault.mode==='OTHER_MEMBERSHIP_PROJECT')return null;
  const snapshot=structuredClone(version.snapshot_json);
  if(fault.mode==='TAMPERED_MEMBERSHIP_VERSION')snapshot.reason='변조된 과거 원문';
  return version.content_hash===base.ref.contentHash&&hash(snapshot)===base.ref.contentHash&&snapshot.participation===base.participation&&snapshot.revokedAt===null?command.payload:null;
 }
 function verifyCandidateOrigin(row:any,r:any,c:any,phase:'CAP'|'INSERT'|'HISTORY'){
  // 실제 후보 INSERT의 바이트를 검산하는 합성 대역이다.
   const {version,status,details}=JSON.parse(r.request_json);
   const understanding=details.actionScope.operation==='reviewUnderstanding',backupPolicy=details.actionScope.operation==='saveBackupPolicy',membership=details.actionScope.operation==='saveProjectMembership';
   if(understanding||backupPolicy||membership){
    const project=phase==='INSERT'&&fault.mode==='OTHER_PROJECT'?id(96):row.project_id;
    const source=phase==='INSERT'&&fault.mode==='OTHER_SOURCE'?id(97):row.source_command_id,recipient=phase==='INSERT'&&fault.mode==='OTHER_RECIPIENT'?id(98):row.recipient_user_id;
    const captures=stored.captures.filter(b=>b.table===(understanding?'UNDERSTANDING':'BACKUP_POLICY')&&b.project_id===project&&b.request_id===r.id);
    const b=captures[0],candidate=membership?verifiedMembership(r,project,source,recipient,c):b&&fault.mode!=='MISSING_CANDIDATE'?JSON.parse(b.payload_json):null;
    const content=understanding?candidate?.payload:candidate;
    if(content&&fault.mode==='TAMPERED_CANDIDATE')content.reason='변조된 이유';
    const exact=candidate&&captures.length===1&&b.request_command_id===source&&b.created_by===recipient&&b.client_id===c.client_id&&b.control_generation===c.control_generation&&b.candidate_command_id===details.candidateCommandId&&hash(JSON.parse(b.policy_ref))===hash(c.policy_ref)&&b.payload_hash===hash(content)&&b.payload_hash===details.actionScope.payloadHash;
    const projection=exact&&backupPolicy?{projectId:project,requestId:r.id,requestCommandId:source,candidateCommandId:b.candidate_command_id,payloadHash:b.payload_hash,payload:candidate,createdBy:recipient,clientId:c.client_id,controlGeneration:c.control_generation,policyRef:c.policy_ref}:null;
    const verified=membership?candidate!==null:exact&&(understanding?b.command_hash===hash(candidate):fault.mode!=='OTHER_PROJECTION'&&hash(JSON.parse(b.projection_json))===hash(projection)&&hash(candidate.previousRef)===hash(details.actionScope.targetRef));
    const detailsOnly=originModel==='BEFORE'||backupPolicy&&originModel==='BEFORE_BACKUP';
    const payload=detailsOnly?{details}:{details,candidatePayload:candidate};
    const original={schemaVersion:1,projectId:row.project_id,commandId:c.command_id,clientId:c.client_id,controlGeneration:c.control_generation,operation:'requestApproval',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload};
    const originalAuditCount=auditSources.filter(commandId=>commandId===source).length+(fault.mode==='OTHER_ORIGINAL_AUDIT'?1:0);
    if(version!==1||status!=='PENDING'||!verified||originalAuditCount!==1||hash(original)!==c.request_hash)throw Object.assign(Error('SYNTHETIC_CANDIDATE_ORIGIN_REJECTED'),{code:phase==='CAP'?'42501':'23514'});
   }
 }
 const db={query:async(sql:string,args:any[]=[])=>{events.push(sql);
  if(sql.startsWith('SELECT set_config(')&&sql.includes("set_config('anvil.command_id',$3,true)"))sourceId=args[2];
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'APPLIED'"))auditSources.push(args[4]);
  if(sql==='SELECT id,checksum FROM anvil.schema_migrations WHERE id=$1'){
   assert.deepEqual(args,[membershipMigration]);
   return{rows:[{id:membershipMigration,checksum:membershipChecksum}],rowCount:1};
  }
  if(sql==='SELECT * FROM anvil.project_members WHERE project_id=$1 ORDER BY user_id FOR UPDATE'){
   const target=membershipVersions.find(v=>v.version===membershipHead.version);
   const rows=[{project_id:pid,user_id:uid,participation:'OWNER',version:1,revoked_at:null},...(target?[{project_id:pid,user_id:membershipTarget,participation:target.snapshot_json.participation,version:target.version,revoked_at:null}]:[])];
   assert.deepEqual(args,[pid]);
   return{rows,rowCount:rows.length};
  }
  if(sql==='SELECT id,status,revoked_at FROM anvil.users WHERE id=$1'){
   assert.deepEqual(args,[membershipTarget]);
   return{rows:[{id:membershipTarget,status:'ACTIVE',revoked_at:null}],rowCount:1};
  }
  if(sql.includes('FROM anvil.project_membership_versions v LEFT JOIN')){
   const rows=membershipVersions.filter(v=>v.project_id===args[0]&&v.user_id===args[1]&&v.version===args[2]);
   return{rows,rowCount:rows.length};
  }
  if(sql==='SELECT 1 FROM anvil.approval_requests WHERE project_id=$1 AND candidate_command_id=$2')return{rows:stored.requests.filter(r=>r.project_id===args[0]&&r.candidate_command_id===args[1]),rowCount:stored.requests.filter(r=>r.project_id===args[0]&&r.candidate_command_id===args[1]).length};
  if(sql.startsWith('INSERT INTO anvil.approval_requests')){stored.requests.push(inserted(sql,args));return{rows:[],rowCount:1};}
  if(sql==='SELECT id FROM anvil.projects WHERE id=$1::uuid FOR UPDATE'){assert.deepEqual(args,[pid]);return{rows:[{id:pid}],rowCount:1};}
  if(sql.startsWith('SELECT count(*)::bigint AS rows,COALESCE(sum(octet_length(anvil.execution_authority_canonical(projection)))')){
   assert.deepEqual(args,[pid]);
   const projections=stored.captures.filter(b=>b.table==='BACKUP_POLICY').map(b=>b.projection_json as string);
   return{rows:[{rows:projections.length,bytes:projections.reduce((n,projection)=>n+Buffer.byteLength(projection),0)}],rowCount:1};
  }
  if(sql.startsWith('INSERT INTO anvil.backup_policy_approval_candidates')){stored.captures.push({table:'BACKUP_POLICY',...inserted(sql,args)});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.work_plan_approval_candidates')||sql.startsWith('INSERT INTO anvil.design_activation_approval_candidates')||sql.startsWith('INSERT INTO anvil.understanding_review_approval_candidates')){stored.captures.push({table:sql.includes('work_plan_')?'PLAN':sql.includes('design_activation_')?'ACTIVATION':'UNDERSTANDING',...inserted(sql,args)});return{rows:[],rowCount:1};}
  if(sql.startsWith('SELECT anvil.assert_approval_notification_capacity(')){assert.deepEqual(args,[pid]);assert.ok(events.some(q=>q.includes('FOR UPDATE OF p,m')),'원project/member잠금을선행한다');assert.ok(events.some(q=>q.includes('FROM anvil.project_control')));
   const r=stored.requests.find(r=>r.project_id===pid&&r.command_id===sourceId),c=f.commands.find(c=>c.id===sourceId);
   assert.ok(r&&c,'cap은 현재 합성 거래의 원 요청과 명령을 사용한다');
   verifyCandidateOrigin({project_id:r.project_id,source_command_id:r.command_id,recipient_user_id:r.created_by},r,c,'CAP');
   if(priorRows.count+stored.notifications.length>=10000)throw Object.assign(Error('NOTIFICATION_CAPACITY_EXCEEDED'),{code:'P0001'});if(fault.mode==='CAP_WAIT')f.clock=new Date(Date.parse(at)+20);return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.notifications')){if(fault.mode==='INSERT_WAIT')await new Promise(r=>setTimeout(r,30));if(fault.mode==='INSERT')throw Object.assign(Error('SYNTHETIC_PRIVATE_SQL'),{code:'42501'});if(fault.mode==='GUARD')throw Object.assign(Error('SYNTHETIC_PRIVATE_GUARD'),{code:'23514'});const row=inserted(sql,args),r=stored.requests.find(r=>r.id===row.approval_request_id),c=f.commands.find(c=>c.id===row.source_command_id);assert.ok(r&&c);
   verifyCandidateOrigin(row,r,c,'INSERT');
   if(fault.mode==='DUPLICATE_SOURCE'||stored.notifications.some(n=>n.project_id===row.project_id&&n.source_command_id===row.source_command_id))throw Object.assign(Error('SYNTHETIC_NOTIFICATION_SOURCE_DUPLICATE'),{code:'23505'});
   assert.equal(row.source_command_id,r.command_id);assert.notEqual(row.source_command_id,c.command_id);assert.equal(row.recipient_user_id,uid);assert.equal(row.project_id,pid);assert.equal(Number(row.request_version),1);assert.equal(row.request_content_hash,r.content_hash);assert.equal(new Date(row.created_at).toISOString(),at);assert.ok(events.some(q=>q.startsWith('SELECT anvil.assert_approval_notification_capacity(')));stored.notifications.push(row);return{rows:[],rowCount:1};}
  if(sql.startsWith('SELECT r.*')&&sql.includes('FROM anvil.approval_requests r JOIN anvil.commands')){const r=stored.requests.find(r=>r.project_id===args[0]&&r.id===args[1]);if(!r)return{rows:[],rowCount:0};const c=f.commands.find(c=>c.id===r.command_id);return{rows:[{...r,request_json:JSON.parse(r.request_json),result_ref:c.result_ref,created_at:new Date(r.created_at),actor_id:c.actor_id,command_client:c.client_id,source_control_generation:c.control_generation,caller_command_id:c.command_id,scope_kind:'PROJECT',state:'APPLIED',command_project:pid,operation:'requestApproval'}],rowCount:1};}
  try{return await raw(sql,args);}catch(e){unexpected.push(sql);throw e;}
 }};
 const access={signProjectCursor:sign,signMethodCursor:sign,authenticated:async(_token:string,_csrf:any,body:any)=>{let unlock:()=>void=()=>{};const beforeQueue=queue;queue=new Promise<void>(r=>{unlock=r;});await beforeQueue;sourceId=undefined;const auditLength=auditSources.length,before=structuredClone({commands:f.commands,reads:f.reads,audits:f.audits,receipts:f.receipts,...stored});try{return await body(db,identity.value);}catch(e){auditSources.length=auditLength;f.commands=before.commands;f.reads=before.reads;f.audits=before.audits;f.receipts=before.receipts;stored.requests=before.requests;stored.notifications=before.notifications;stored.captures=before.captures;throw e;}finally{unlock();}}} as unknown as AccessRepository;
 const service=new ProjectApprovals(),repo=new ProjectPolicyRepository(access);let callbacks=0;
 return{f,stored,events,unexpected,priorRows,fault,identity,membershipVersions,membershipHead,verifyStoredCandidateNotification(row:any){
  const r=stored.requests.find(r=>r.project_id===row.project_id&&r.id===row.approval_request_id),c=f.commands.find(c=>c.id===row.source_command_id);
  assert.ok(r&&c);
  verifyCandidateOrigin(row,r,c,'HISTORY');
 },get callbacks(){return callbacks;},send:(c:any)=>repo.command('t','c',c,(d,a,p)=>{callbacks++;return service.request(d,a,c,p);})};
}
function empty(f:ReturnType<typeof transactionFixture>){assert.equal(f.f.commands.length,0);assert.equal(f.f.audits,0);assert.equal(f.f.receipts,0);assert.deepEqual(f.stored,{requests:[],notifications:[],captures:[]});assert.deepEqual(f.unexpected,[]);}
test('실제표준request transaction은 원receipt/request뒤알림1,동일replay/응답유실재확인은추가생산0이다',async()=>{const f=transactionFixture(),c=request(),result:any=await f.send(c);assert.equal(result.data.status,'APPROVAL_REQUESTED');assert.equal(f.stored.notifications.length,1);assert.equal(f.stored.requests.length,1);assert.equal(f.f.commands.length,1);assert.equal(f.callbacks,1);assert.deepEqual(await f.send(c),result);assert.equal(f.callbacks,1);assert.equal(f.stored.notifications.length,1);assert.deepEqual(f.unexpected,[]);assert.equal(f.events.some(q=>/\bCOMMIT\b/.test(q)),false,'domain은 별도COMMIT하지않는다');});
test('전체projectcap9999→10000은허용·10000뒤새request429이며replay는보존한다',async()=>{const f=transactionFixture();f.priorRows.count=9999;const c=request(),first=await f.send(c);assert.equal(f.stored.notifications.length,1);await assert.rejects(f.send(request('uploadArtifact',id(42))),error('NOTIFICATION_CAPACITY_EXCEEDED',429));assert.equal(f.f.commands.length,1);assert.equal(f.stored.requests.length,1);assert.equal(f.stored.notifications.length,1);assert.deepEqual(await f.send(c),first);assert.equal(f.callbacks,2,'cap거절신규1외replaycallback0');assert.deepEqual(f.unexpected,[]);});
test('저장/guard/cap실패는실제영수증·원요청·감사를모두rollback하고민감오류를내보내지않는다',async()=>{for(const mode of ['INSERT','GUARD','CAP']){const f=transactionFixture();f.fault.mode=mode;if(mode==='CAP')f.priorRows.count=10000;await assert.rejects(f.send(request()),error(mode==='CAP'?'NOTIFICATION_CAPACITY_EXCEEDED':'NOTIFICATION_STORAGE_FAILED',mode==='CAP'?429:503));empty(f);}});
test('기존PLAN/ACTIVATION 실제capture이후알림실패는capture도같이rollback한다',async t=>{t.mock.method(WorkPlanApprovalCandidates.prototype,'assertCurrent',async()=>{});t.mock.method(DesignActivationApprovalCandidates.prototype,'assertCurrent',async()=>{});for(const operation of ['saveWorkPlanDraft','activateDesignChange']){const f=transactionFixture();f.fault.mode='INSERT';await assert.rejects(f.send(request(operation)),error('NOTIFICATION_STORAGE_FAILED',503));assert.ok(f.events.some(q=>q.startsWith('INSERT INTO anvil.'+(operation==='saveWorkPlanDraft'?'work_plan':'design_activation')+'_approval_candidates')),'기존capture실제INSERT를먼저관측한다');empty(f);}});
test('합성project잠금직렬화의cap경계에서동시신규2는1commit1rollback이다',async()=>{const f=transactionFixture();f.priorRows.count=9999;const result=await Promise.allSettled([f.send(request('uploadArtifact',id(43))),f.send(request('uploadArtifact',id(44)))]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);const rejected=result.find(r=>r.status==='rejected');assert.ok(rejected&&rejected.status==='rejected'&&error('NOTIFICATION_CAPACITY_EXCEEDED',429)(rejected.reason));assert.equal(f.stored.notifications.length,1);assert.equal(f.stored.requests.length,1);assert.equal(f.f.commands.length,1);assert.deepEqual(f.unexpected,[]);});
test('명확한원정책거절/다른payload의같은key는알림을만들지않는다',async()=>{const f=transactionFixture();f.f.rules[0]!.disposition='DENY';await assert.rejects(f.send(request()),error('PROJECT_OPERATION_DENIED',403));empty(f);const g=transactionFixture(),c=request();await g.send(c);await assert.rejects(g.send({...c,payload:{...c.payload,details:{...c.payload.details,reason:'다른 이유'}}}),error('IDEMPOTENCY_CONFLICT',409));assert.equal(g.stored.notifications.length,1);assert.deepEqual(g.unexpected,[]);});

test('cap대기후현재인증session/원request기한만료는원requestreceipt와감사를rollback한다',async()=>{for(const kind of ['SESSION','REQUEST']){const f=transactionFixture(),c=request();f.fault.mode='CAP_WAIT';if(kind==='SESSION')f.identity.value.authSession.idleExpiresAt='2026-10-27T00:00:00.010Z';else c.payload.details.expiresAt='2026-10-27T00:00:00.010Z';await assert.rejects(f.send(c),error(kind==='SESSION'?'AUTH_REQUIRED':'APPROVAL_INPUT_INVALID',kind==='SESSION'?401:422));assert.ok(f.events.some(q=>q.startsWith('SELECT anvil.assert_approval_notification_capacity(')));assert.equal(f.events.some(q=>q.startsWith('INSERT INTO anvil.notifications')),false);empty(f);}});

test('원requestApproval AUTO최단기한은cap/INSERT지연뒤긴AUTO로연장되지않고전부rollback한다',async t=>{t.mock.timers.enable({apis:['Date'],now:Date.parse(at)});for(const mode of ['CAP_WAIT','INSERT_WAIT']){const f=transactionFixture();f.f.rules.push({...structuredClone(f.f.rules[0]!),ruleId:'short-request',expiresAt:new Date(Date.parse(at)+10).toISOString()});f.fault.mode=mode;await assert.rejects(f.send(request()),error('PROJECT_OPERATION_DENIED',403));assert.ok(f.events.some(q=>q.startsWith('SELECT anvil.assert_approval_notification_capacity(')));assert.equal(f.events.some(q=>q.startsWith('INSERT INTO anvil.notifications')),mode==='INSERT_WAIT');empty(f);}});

test('이해 검토 전체 후보를 원 승인 요청에 결박해 cap 경계에서도 동일 재확인은 추가 저장이 없다',async()=>{
 const c=understandingRequest(),legacy=transactionFixture('BEFORE');
 await assert.rejects(legacy.send(c),error('NOTIFICATION_STORAGE_FAILED',503));
 assert.ok(legacy.events.some(q=>q.startsWith('INSERT INTO anvil.understanding_review_approval_candidates')));
 empty(legacy);

 const f=transactionFixture();
 f.priorRows.count=9999;
 const first=await f.send(c);
 const [captured]=f.stored.captures,[stored]=f.stored.requests,[notice]=f.stored.notifications;
 assert.deepEqual(JSON.parse(captured.payload_json),c.payload.candidatePayload);
 assert.equal(captured.payload_hash,hash(c.payload.candidatePayload.payload));
 assert.equal(captured.command_hash,hash(c.payload.candidatePayload));
 assert.notEqual(captured.payload_hash,captured.command_hash);
 assert.equal(f.f.commands[0].request_hash,hash(c));
 assert.equal(notice.source_command_id,stored.command_id);
 assert.equal(notice.recipient_user_id,captured.created_by);
 await assert.rejects(f.send(understandingRequest(id(47))),error('NOTIFICATION_CAPACITY_EXCEEDED',429));
 assert.deepEqual(await f.send(c),first);
 assert.equal(f.callbacks,2);
 assert.equal(f.stored.captures.length,1);
 assert.equal(f.stored.notifications.length,1);
 assert.deepEqual(f.unexpected,[]);
});

test('이해 검토 후보 누락·변조, 다른 수신자/원 명령과 추가 원감사는 거래 전체를 되돌린다',async()=>{
 for(const fault of ['MISSING_CANDIDATE','TAMPERED_CANDIDATE','OTHER_SOURCE','OTHER_RECIPIENT','OTHER_ORIGINAL_AUDIT']){
  const f=transactionFixture();
  f.fault.mode=fault;
  await assert.rejects(f.send(understandingRequest()),error('NOTIFICATION_STORAGE_FAILED',503),fault);
  assert.ok(f.events.some(q=>q.startsWith('SELECT anvil.assert_approval_notification_capacity(')),fault);
  assert.equal(f.events.some(q=>q.startsWith('INSERT INTO anvil.notifications')),['OTHER_PROJECT','OTHER_SOURCE','OTHER_RECIPIENT','DUPLICATE_SOURCE'].includes(fault),fault);
  empty(f);
 }
});

test('수동 백업 정책의 평면 후보는 전체 해시로 검산하고 cap 경계와 원 승인 재확인을 보존한다',async()=>{
 const previousRef={id:id(94),version:2,contentHash:'e'.repeat(64)};
 const c=backupPolicyRequest(id(48),previousRef),legacy=transactionFixture('BEFORE_BACKUP');
 await assert.rejects(legacy.send(c),error('NOTIFICATION_STORAGE_FAILED',503));
 assert.ok(legacy.events.some(q=>q.startsWith('INSERT INTO anvil.backup_policy_approval_candidates')));
 assert.ok(legacy.events.some(q=>q.startsWith('SELECT anvil.assert_approval_notification_capacity(')));
 assert.equal(legacy.events.some(q=>q.startsWith('INSERT INTO anvil.notifications')),false);
 empty(legacy);

 const f=transactionFixture();
 f.priorRows.count=9999;
 const first=await f.send(c);
 const [capture]=f.stored.captures,[r]=f.stored.requests,[notice]=f.stored.notifications;
 assert.deepEqual(JSON.parse(capture.payload_json),c.payload.candidatePayload);
 assert.equal(capture.payload_hash,hash(c.payload.candidatePayload));
 assert.equal(capture.payload_hash,c.payload.details.actionScope.payloadHash);
 assert.deepEqual(JSON.parse(capture.payload_json).previousRef,previousRef);
 assert.equal(notice.source_command_id,r.command_id);
 assert.equal(notice.recipient_user_id,r.created_by);
 assert.equal(f.f.commands[0].request_hash,hash(c));
 await assert.rejects(f.send(backupPolicyRequest(id(49))),error('NOTIFICATION_CAPACITY_EXCEEDED',429));
 // 현재 결정은 앞으로 진행해도 알림과 원 요청은 불변 v1을 보존한다.
 r.version=3;r.status='CONSUMED';
 assert.equal(JSON.parse(r.request_json).version,1);
 assert.equal(notice.request_version,1);
 f.verifyStoredCandidateNotification(notice);
 assert.deepEqual(await f.send(c),first);
 assert.equal(f.callbacks,2);
 assert.equal(f.stored.captures.length,1);
 assert.equal(f.stored.notifications.length,1);
 assert.deepEqual(f.unexpected,[]);
});

test('백업 정책 후보 누락·변조·교차 결박 또는 중복 원 알림은 요청 전체를 rollback한다',async()=>{
 for(const fault of ['MISSING_CANDIDATE','TAMPERED_CANDIDATE','OTHER_PROJECTION','OTHER_PROJECT','OTHER_SOURCE','OTHER_RECIPIENT','OTHER_ORIGINAL_AUDIT','DUPLICATE_SOURCE']){
  const f=transactionFixture();
  f.fault.mode=fault;
  await assert.rejects(f.send(backupPolicyRequest()),error('NOTIFICATION_STORAGE_FAILED',503),fault);
  assert.ok(f.events.some(q=>q.startsWith('SELECT anvil.assert_approval_notification_capacity(')),fault);
  assert.equal(f.events.some(q=>q.startsWith('INSERT INTO anvil.notifications')),['OTHER_PROJECT','OTHER_SOURCE','OTHER_RECIPIENT','DUPLICATE_SOURCE'].includes(fault),fault);
  empty(f);
 }
});

test('참여자 등록과 역할 변경이 후보의 상세 원문을 저장하고 당시 원 승인으로 재확인된다',async()=>{
 const base=membershipVersion(2),legacy=transactionFixture('BEFORE_MEMBERSHIP');
 legacy.membershipVersions.push(base);legacy.membershipHead.version=base.version;
 const change=membershipRequest(base);
 await assert.rejects(legacy.send(change),error('NOTIFICATION_STORAGE_FAILED',503));
 assert.ok(legacy.events.some(q=>q.startsWith('INSERT INTO anvil.approval_requests')));
 assert.ok(legacy.events.some(q=>q.startsWith('SELECT anvil.assert_approval_notification_capacity(')));
 assert.equal(legacy.events.some(q=>q.startsWith('INSERT INTO anvil.notifications')),false);
 empty(legacy);
 for(const originalBase of [null,base]){
  const f=transactionFixture(),c=membershipRequest(originalBase);
  if(originalBase){f.membershipVersions.push(originalBase);f.membershipHead.version=originalBase.version;}
  f.priorRows.count=9999;
  const first=await f.send(c),[stored]=f.stored.requests,[notice]=f.stored.notifications;
  const original=JSON.parse(stored.request_json),candidate=original.membershipCandidate;
  assert.deepEqual(candidate.command.payload,c.payload.candidatePayload);
  assert.equal(candidate.command.projectId,pid);
  assert.equal(candidate.command.commandId,c.payload.details.candidateCommandId);
  assert.deepEqual(candidate.baseMembership,originalBase?{kind:'EXISTING',ref:c.payload.details.actionScope.targetRef,participation:'VIEWER'}:{kind:'NEW'});
  const {id:_id,version:_version,status:_status,createdAt:_at,...snapshot}=original;
  assert.equal(stored.content_hash,hash(snapshot));
  assert.equal(f.f.commands[0].request_hash,hash(c));
  assert.equal(f.stored.captures.length,0);
  await assert.rejects(f.send(membershipRequest(originalBase,id(52))),error('NOTIFICATION_CAPACITY_EXCEEDED',429));
  const advanced=membershipVersion(3,'HANDOFF_ELIGIBLE');f.membershipVersions.push(advanced);f.membershipHead.version=advanced.version;
  stored.status='CONSUMED';stored.version=3;
  f.verifyStoredCandidateNotification(notice);
  assert.deepEqual(await f.send(c),first);
  assert.equal(f.callbacks,2);
  assert.equal(f.stored.notifications.length,1);
  assert.deepEqual(f.unexpected,[]);
 }
});

test('참여자 후보 또는 과거 버전 손상·교차 결박은 알림과 신청 전체를 되돌린다',async()=>{
 for(const mode of ['MISSING_MEMBERSHIP_CANDIDATE','TAMPERED_MEMBERSHIP_CANDIDATE','OTHER_MEMBERSHIP_CLIENT','SELF_MEMBERSHIP_COMMAND','OTHER_MEMBERSHIP_ROLE','STALE_MEMBERSHIP_REF','MISSING_MEMBERSHIP_VERSION','OTHER_MEMBERSHIP_PROJECT','TAMPERED_MEMBERSHIP_VERSION','OTHER_RECIPIENT','OTHER_SOURCE','OTHER_ORIGINAL_AUDIT','DUPLICATE_SOURCE']){
  const base=membershipVersion(2),f=transactionFixture();
  f.membershipVersions.push(base);f.membershipHead.version=base.version;f.fault.mode=mode;
  await assert.rejects(f.send(membershipRequest(base)),error('NOTIFICATION_STORAGE_FAILED',503),mode);
  assert.ok(f.events.some(q=>q.startsWith('SELECT anvil.assert_approval_notification_capacity(')),mode);
  assert.equal(f.events.some(q=>q.startsWith('INSERT INTO anvil.notifications')),['OTHER_RECIPIENT','OTHER_SOURCE','DUPLICATE_SOURCE'].includes(mode),mode);
  empty(f);
 }
});
