import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PoolClient} from 'pg';
import type {AccessRepository,AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {inspectArtifact} from '../../../apps/server/storage/sensitive-inspection.ts';
import {collectDocumentBodySnapshot} from '../../../apps/server/modules/backups/full-backup-snapshot-source.ts';
import * as historyVerification from '../../../apps/server/modules/backups/full-backup-history-verification.ts';
import {analyzeWorkPlanCards} from '../../../apps/server/modules/traceability/work-plan-card.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const id=(n:number)=>`b2000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const {verifyDocumentBodyHistory}=historyVerification;
const pinned=(n:number)=>({id:id(n),version:1,contentHash:'b'.repeat(64)});
const hash=(value:unknown)=>contentHash(canonicalJson(value));
const projectId=id(1),documentId=id(2),bodyId=id(3),actorId=id(4),clientId=id(5),sessionId=id(6);
const at='2026-11-28T00:00:00.000Z';
const bytes=Buffer.from('공개 합성 문서');
const bodyRef={artifactId:bodyId,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain'};
const standardRef=pinned(101);
const formItem={itemId:'AF04-01',title:'목적',required:false,valueType:'TEXT',repeated:false,fields:[],authoringRules:[],reviewCriteria:['목적이 명확하다']};
const definition={formCode:'AF04',name:'작업계획서',purpose:'공개 합성 양식',scope:'SYSTEM',authorRole:'작성자',reviewerRole:'검토자',confirmerRole:'사용자',
 requiredInputs:[],items:[formItem],authoringStandardRef:standardRef};
const formRef={id:id(7),version:1,contentHash:hash(definition)};
const systemForm={id:formRef.id,scope:'SYSTEM',owner_user_id:null,project_id:null,form_code:definition.formCode,version:formRef.version,
 definition_json:definition,content_hash:formRef.contentHash,authoring_standard_id:standardRef.id,authoring_standard_version:standardRef.version,
 authoring_standard_hash:standardRef.contentHash,authoring_standard_ref:standardRef,created_by:null,created_at:at};
const standard={id:standardRef.id,version:standardRef.version,content_hash:standardRef.contentHash,created_at:at};
const content={body:bodyRef,attachments:[],sections:[],sourceRefs:[]};
const ref={id:documentId,version:1,contentHash:hash({title:'합성',formRef,stageNodeRef:null,content})};
const designBytes=Buffer.from('합성 AF02 설계 원문');
const designBodyRef={...bodyRef,artifactId:id(315),bytes:designBytes.length,contentHash:contentHash(designBytes)};
const designDefinition={...definition,formCode:'AF02',name:'설계서',items:[{...formItem,itemId:'AF02-01'}]};
const designFormRef={id:id(314),version:1,contentHash:hash(designDefinition)};
const designForm={...systemForm,id:designFormRef.id,form_code:'AF02',definition_json:designDefinition,content_hash:designFormRef.contentHash};
function designSource(body:typeof bodyRef){
 const content={body,attachments:[],sections:[],sourceRefs:[]};
 const source={title:'합성 설계',formRef:designFormRef,stageNodeRef:null,content};
 return {source,ref:{id:id(309),version:1,contentHash:hash(source)}};
}
const {ref:designRef}=designSource(designBodyRef);
const workPlan={documentRef:ref,designRef,screenReviewRefs:[],tasks:[],dependencies:[],reason:'합성 작업계획',
 issues:[{code:'TASKS_MISSING',location:'tasks',message:'업무 카드를 추가해야 합니다.'}],relationalProjection:'STORED'};
const workPlanRef={id:id(310),version:2,contentHash:hash(workPlan)};
const workPlanRow={project_id:projectId,plan_id:workPlanRef.id,version:workPlanRef.version,document_id:ref.id,document_version:ref.version,
 document_hash:ref.contentHash,design_id:designRef.id,design_version:designRef.version,design_hash:designRef.contentHash,screen_review_refs:[],
 content_hash:workPlanRef.contentHash,version_json:{ref:workPlanRef,status:'DRAFT',...workPlan},created_by:actorId,client_id:clientId,command_id:id(311),created_at:at};
const original={project_id:projectId,document_id:documentId,version:1,form_definition_id:formRef.id,form_version:1,form_hash:formRef.contentHash,
 stage_ref_json:null,body_artifact_id:bodyId,title:'합성',content_json:content,source_refs_json:[],content_hash:ref.contentHash,sections_json:[],
 author_ref_json:{kind:'HUMAN',userId:actorId},validation_json:{validForConfirmation:true,issues:[],formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'},reason:'합성',client_id:clientId,command_id:id(8),created_at:at};
const artifact={id:bodyId,project_id:projectId,bytes:bytes.length,content_hash:bodyRef.contentHash,
 media_type:bodyRef.mediaType,state:'READY',inspection_json:inspectArtifact(bytes)};
const request={schemaVersion:1,projectId,commandId:id(81),clientId,controlGeneration:1,operation:'saveDocumentDraft',
 targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,
 payload:{title:original.title,formRef,stageNodeRef:null,content,reason:original.reason,importCandidateRef:null}};
const requestHash=hash(request),policyRef=pinned(82);
const scopeDigest=hash({projectId,actorId,clientId,controlGeneration:1,requestHash,policyRef,targetRef:ref});
const command={id:original.command_id,project_id:projectId,draft_id:null,scope_kind:'PROJECT',scope_id:projectId,
 actor_id:actorId,client_id:clientId,operation:request.operation,command_id:request.commandId,request_hash:requestHash,
 operation_id:id(83),state:'APPLIED',authorization_receipt_id:id(84),approval_consumption_id:null,
 expected_version:0,control_generation:1,policy_ref:policyRef,payload_ref:null,received_at:at,completed_at:at,
 result_ref:{operationId:id(83),commandId:request.commandId,projectId,status:'APPLIED',targetId:ref.id,version:ref.version,
  data:{ref,status:'DRAFT',validation:original.validation_json,stageNodeRef:null,stageBinding:null,importCandidateRef:null,proposalRef:null},
  evidenceRefs:[],warnings:[],serverReceivedAt:at}};
const receipt={id:command.authorization_receipt_id,scope_kind:'PROJECT',scope_id:projectId,command_id:command.id,
 subject_ref:{kind:'HUMAN',userId:actorId,clientId},policy_ref:policyRef,scope_digest:scopeDigest,approval_decision_ref:null,authorized_at:at};
const audit={project_id:projectId,server_sequence:1,event_id:id(85),actor_ref:original.author_ref_json,client_ref:clientId,
 command_id:command.id,operation_id:command.operation_id,target_ref:ref,policy_ref:policyRef,approval_ref:null,
 outcome:'APPLIED',reason_code:'EXPLICIT_DOCUMENT_DRAFT',scope_digest:scopeDigest,recorded_at:at,source_kind:'HUMAN_COMMAND',correction_of:null};
const input={projectId,documentRef:ref,limits:{metadataBytes:65536,inputBytes:65536,fileCount:1,deadlineMs:10000}};
const envelope=(row:unknown)=>({inventory_data:structuredClone(row),row_bytes:Buffer.byteLength(JSON.stringify(row))});
const reviewRef={id:id(201),targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED'};
const earlierReviewRef={...reviewRef,id:id(205)};
const confirmationId=id(202);
const review={id:reviewRef.id,scope_kind:'PROJECT',scope_id:projectId,project_id:projectId,target_kind:'DOCUMENT',
 target_id:ref.id,target_version:ref.version,target_hash:ref.contentHash,criteria_version:1,
 criteria_snapshot_json:{criteriaVersion:1,formRef,items:[{criterionId:formItem.itemId,title:formItem.title,reviewCriteria:formItem.reviewCriteria}]},
 items_json:[{criterionId:formItem.itemId,outcome:'ACCEPTED',evidenceRefs:[],reason:'기준에 맞음'}],outcome:'ACCEPTED',reviewer_user_id:actorId,
 client_id:clientId,reviewer_subject_ref:{kind:'HUMAN',userId:actorId,sameAsTargetRecorder:true},source_kind:'HUMAN_REVIEW',reason:'합성 검토',
 command_id:id(203),created_at:at};
const earlierReview={...review,id:earlierReviewRef.id,command_id:id(206)};
const confirmation={id:confirmationId,project_id:projectId,document_id:ref.id,version:ref.version,target_hash:ref.contentHash,
 form_ref:formRef,review_refs:[reviewRef,earlierReviewRef],validation_json:original.validation_json,confirmed_by:actorId,client_id:clientId,
 command_id:id(204),created_at:at};
function originFor(commandId:string,operation:string,payload:object,data:object,reason:string,n:number){
 const requestHash=hash({...request,commandId:id(n),targetId:ref.id,expectedVersion:ref.version,operation,payload});
 const scopeDigest=hash({projectId,actorId,clientId,controlGeneration:1,requestHash,policyRef,targetRef:ref});
 const originCommand={...command,id:commandId,operation,command_id:id(n),operation_id:id(n+1),authorization_receipt_id:id(n+2),expected_version:ref.version,
  request_hash:requestHash,
  result_ref:{...command.result_ref,commandId:id(n),operationId:id(n+1),data:{ref,...data}}};
 return {command:originCommand,receipt:{...receipt,id:originCommand.authorization_receipt_id,command_id:commandId,scope_digest:scopeDigest},
  audit:{...audit,command_id:commandId,operation_id:id(n+1),event_id:id(n+3),server_sequence:n,reason_code:reason,scope_digest:scopeDigest}};
}
const reviewOrigin=originFor(review.command_id,'recordContentReview',
 {targetKind:'DOCUMENT',targetRef:ref,criteriaVersion:1,items:review.items_json,outcome:review.outcome,reason:review.reason},
 {status:'REVIEW_RECORDED',reviewRef},'EXPLICIT_DOCUMENT_CONTENT_REVIEW',210);
const earlierReviewOrigin=originFor(earlierReview.command_id,'recordContentReview',
 {targetKind:'DOCUMENT',targetRef:ref,criteriaVersion:1,items:earlierReview.items_json,outcome:earlierReview.outcome,reason:earlierReview.reason},
 {status:'REVIEW_RECORDED',reviewRef:earlierReviewRef},'EXPLICIT_DOCUMENT_CONTENT_REVIEW',200);
const confirmationOrigin=originFor(confirmation.command_id,'confirmDocument',{versionRef:ref,formRef,reviewRefs:confirmation.review_refs},
 {status:'CONFIRMED',confirmationId},'EXPLICIT_DOCUMENT_CONFIRMATION',220);

function fixture(mode='valid'){
 const confirmed=mode.startsWith('confirmed');
 const withRelations=mode.startsWith('relations-');
 const withDesign=mode.startsWith('design-')||withRelations;
 const withPlan=mode.startsWith('plan-')||withDesign;
 const trace:string[]=[];
 const designBody=mode==='design-shared'?bodyRef:designBodyRef;
 const {source:designPayload,ref:designVersionRef}=designSource(designBody);
 const expectedDesignRef=mode==='design-plan-mismatch'?{...designVersionRef,contentHash:'e'.repeat(64)}:designVersionRef;
 const task=(taskCode:string)=>({taskCode,type:'FUNCTION',title:taskCode,purpose:'합성 관계',designRefs:[],screenRefs:[],ownerRole:'개발',
  inputs:['입력'],outputs:['출력'],included:['포함'],excluded:['제외'],allowedFileRefs:['one.ts'],startPrerequisites:[],acceptancePrerequisites:[],
  steps:['절차'],testCases:['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT'].map(kind=>({id:kind,kind,steps:['절차'],expected:'기대',environment:'합성'})),
  acceptanceCriteria:['기준'],evidenceRequirements:['근거'],rollback:'되돌리기',recoveryNotes:'복구'});
 const issuesOnly=mode.startsWith('relations-issues');
 const tasks=withRelations?[{...task('Z'),startPrerequisites:issuesOnly?['MISSING']:['A'],acceptancePrerequisites:['A']},task('A')]:[];
 const dependencies=withRelations?[
  ...issuesOnly?[]:[{taskCode:'Z',dependencyTaskCode:'A',phase:'START'}],
  {taskCode:'Z',dependencyTaskCode:'A',phase:'ACCEPTANCE'}
 ]:[];
 const designPlan={...workPlan,designRef:designVersionRef,...withRelations&&{tasks,dependencies,issues:analyzeWorkPlanCards(tasks).issues,relationalProjection:issuesOnly?'ISSUES_ONLY':'STORED'}};
 const rowScope={project_id:projectId,plan_id:workPlanRef.id,plan_version:workPlanRef.version};
 const taskRows=[...tasks].reverse().map(t=>({...rowScope,task_code:t.taskCode,task_type:t.type,card_json:t,card_hash:hash(t),owner_role:t.ownerRole}));
 const dependencyRows=[...dependencies].reverse().map(d=>({...rowScope,task_code:d.taskCode,dependency_task_code:d.dependencyTaskCode,phase:d.phase}));
 const expectedPlanRef=withDesign?{...workPlanRef,contentHash:hash(designPlan)}:workPlanRef;
 const planRow=withDesign?{...workPlanRow,design_hash:designVersionRef.contentHash,content_hash:expectedPlanRef.contentHash,
  version_json:{ref:expectedPlanRef,status:'DRAFT',...designPlan}}:workPlanRow;
 const designVersion={...original,document_id:designVersionRef.id,form_definition_id:designFormRef.id,form_hash:designFormRef.contentHash,
  body_artifact_id:designBody.artifactId,title:designPayload.title,content_json:designPayload.content,content_hash:designVersionRef.contentHash,command_id:id(316)};
 const designRequest={...request,commandId:id(317),
  payload:{...designPayload,reason:designVersion.reason,importCandidateRef:null}};
 const designRequestHash=hash(designRequest);
 const designScopeDigest=hash({projectId,actorId,clientId,controlGeneration:1,requestHash:designRequestHash,policyRef,targetRef:designVersionRef});
 const designCommand={...command,id:designVersion.command_id,command_id:designRequest.commandId,request_hash:designRequestHash,
  operation_id:id(318),authorization_receipt_id:id(319),result_ref:{...command.result_ref,operationId:id(318),
   commandId:designRequest.commandId,targetId:designVersionRef.id,data:{...command.result_ref.data,ref:designVersionRef}}};
 const designReceipt={...receipt,id:designCommand.authorization_receipt_id,command_id:designCommand.id,scope_digest:designScopeDigest};
 const designAudit={...audit,event_id:id(320),server_sequence:2,command_id:designCommand.id,operation_id:designCommand.operation_id,
  target_ref:designVersionRef,scope_digest:designScopeDigest};
 const rowCharges:Record<string,number>={};
 const person:AuthenticatedIdentity={actorId,clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,
  authSession:{id:sessionId,idleExpiresAt:'2026-11-28T00:01:00.000Z',absoluteExpiresAt:'2026-11-28T00:20:00.000Z'}};
 let rc=0,rr=0,obs=0;
 let liveRR=false;
 let metadataBudget=input.limits.metadataBytes;
 function db(scope:string){
  return {async query(sql:string,params:unknown[]=[]){
   assert(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|GRANT)\b/i.test(sql),'정상 운영 표 변경 0');
   if(sql.startsWith('BEGIN')){assert.equal(scope,'RR');assert.match(sql,/REPEATABLE READ READ ONLY/);liveRR=true;trace.push('RR:begin');return {command:'BEGIN',rows:[]};}
   if(sql==='ROLLBACK'){assert(liveRR);liveRR=false;trace.push('RR:rollback');return {command:mode==='rollback-unknown'?'UNKNOWN':'ROLLBACK',rows:[]};}
   if(sql.includes("'statement_timeout'")){assert(Number(params[0])>0&&Number(params[0])<=input.limits.deadlineMs);return {rows:[{ms:params[0]}]};}
   if(sql.includes('pg_current_snapshot')){assert(liveRR);obs++;return {rows:[{snapshot:obs>1&&mode==='snapshot-changed'?'4:15:':'4:14:',at:new Date(at),read_only:'on',isolation:'repeatable read'}]};}
   if(sql.includes('transaction_isolation'))return {rows:[{isolation:'read committed',at:new Date(at)}]};
   if(sql==='SELECT clock_timestamp() AS at')return {rows:[{at:new Date(mode==='relations-expired'&&scope==='RC2'?'2026-11-28T00:00:10.000Z':at)}]};
   if(sql.includes("'anvil.actor_id'")){assert.equal(scope,'RR');assert.deepEqual(params,[actorId,clientId]);trace.push('RR:rls');return {rows:[{actor_id:actorId,client_id:clientId}]};}
   if(sql.includes('FROM anvil.projects p')){assert.deepEqual(params,[projectId,actorId]);assert(scope==='RR'?liveRR:!liveRR);return {rows:[{id:projectId,archived_at:null,participation:scope==='RC2'&&mode==='revoked'?'VIEWER':'OWNER'}]};}
   if(sql.includes('FROM anvil.project_control')){assert.equal(params[0],projectId);return {rows:[{actor_id:actorId,client_id:clientId,generation:1,version:1,revoked_at:null}]};}
   assert((sql.includes('FN16_D2_BODY')||sql.includes('FN16_D2_WORK_PLAN'))
    &&(sql.includes('LIMIT 2')||sql.includes('ORDER BY a.server_sequence DESC LIMIT 1')||sql.includes('LIMIT $4::integer')));
   const table=sql.match(/FROM anvil\.(\w+)/)?.[1];
   if(!['form_definitions','authoring_standard_versions'].includes(table??''))assert.equal(params[0],projectId);
   trace.push(`${scope}:${table}`);
   if(withDesign)assert.equal(params.at(-1),metadataBudget-(rowCharges[scope]??0));
   let row;
   if(table==='plan_tasks'||table==='plan_dependencies'){
    assert(withRelations);
    assert(scope==='RR'?liveRR:!liveRR);
    assert.match(sql,/WHERE project_id=\$1::uuid AND plan_id=\$2::uuid AND plan_version=\$3::bigint ORDER BY/);
    assert.match(sql,/ORDER BY task_code COLLATE "C"/);
    if(table==='plan_dependencies')assert.match(sql,/dependency_task_code COLLATE "C",phase COLLATE "C"/);
    assert.match(sql,/sum\(row_bytes\) OVER \(\)<=\$5::bigint/);
    assert.match(sql,/LIMIT \$4::integer/);
    const planTasks=table==='plan_tasks';
    const expectedRows=planTasks?taskRows:dependencyRows;
    assert.deepEqual(params,[projectId,workPlanRef.id,workPlanRef.version,issuesOnly?1:expectedRows.length+1,metadataBudget-(rowCharges[scope]??0)]);
    let selected:object[]=issuesOnly?[]:expectedRows;
    if(planTasks&&mode==='relations-duplicate-task')selected=[taskRows[0]!,taskRows[0]!];
    if(planTasks&&mode==='relations-cross-task')selected=[{...taskRows[0],plan_version:1},taskRows[1]!];
    if(planTasks&&mode==='relations-wrong-owner')selected=[{...taskRows[0],owner_role:'다른 역할'},taskRows[1]!];
    if(planTasks&&mode==='relations-missing-task')selected=taskRows.slice(1);
    if(planTasks&&mode==='relations-issues-orphan-task')selected=taskRows.slice(0,1);
    if(!planTasks&&mode==='relations-issues-orphan-dependency')selected=dependencyRows;
    if(!planTasks&&(mode==='relations-wrong-phase'||scope==='RC2'&&mode==='relations-rc-drift'))selected=[{...dependencyRows[0],phase:'START'},dependencyRows[1]!];
    if(!planTasks&&mode==='relations-extra-dependency')selected=[...dependencyRows,{...dependencyRows[0],task_code:'A'}];
    if(!planTasks&&mode==='relations-wrong-order')selected=[...dependencyRows].reverse();
    const rows=selected.map(envelope);
    const charged=rows.reduce((sum,item)=>sum+item.row_bytes,0);
    rowCharges[scope]=(rowCharges[scope]??0)+charged;
    return {rows:charged>Number(params[4])?rows.map(row=>({...row,inventory_data:null})):rows};
   }
   const lineage=[reviewOrigin,earlierReviewOrigin,confirmationOrigin].find(origin=>origin.command.id===params[1]||origin.receipt.id===params[1]);
   if(lineage&&['commands','authorization_receipts','audit_events'].includes(table??'')){
    const key=table==='commands'?'command':table==='authorization_receipts'?'receipt':'audit';
    if(key==='receipt')assert.deepEqual(params.slice(1,-1),[lineage.receipt.id,lineage.command.id]);
    if(key==='audit')assert.match(sql,/correction_of IS NULL/);
    row=lineage[key];
    if(mode==='confirmed-review-audit'&&key==='audit'&&lineage===reviewOrigin)row={...row,reason_code:'WRONG_ORIGIN'};
    if(mode==='confirmed-review-approval'&&key==='receipt'&&lineage===reviewOrigin)row={...row,approval_decision_ref:id(307)};
    if(mode==='confirmed-final-proof-drift'&&scope==='RC2'&&key==='audit'&&lineage===reviewOrigin)row={...row,event_id:id(308)};
    return {rows:[envelope(row)]};
   }
   if(withDesign&&table==='document_versions'&&params[1]===designVersionRef.id){
    assert.deepEqual(params.slice(1,-1),[designVersionRef.id,designVersionRef.version,designVersionRef.contentHash]);
    trace.push(`${scope}:AF02`);
    row=mode==='design-cross-project'?{...designVersion,project_id:id(325)}:
     mode==='design-phase'?{...designVersion,stage_ref_json:{applicationId:id(86),nodeId:'PART'}}:designVersion;
   }
   else if(withDesign&&table==='document_artifact_links'&&params[1]===designVersionRef.id){
    assert.deepEqual(params.slice(1,-1),[designVersionRef.id,designVersionRef.version]);
    row={project_id:projectId,document_id:designVersionRef.id,version:designVersionRef.version,kind:'BODY',artifact_id:designBody.artifactId};
   }
   else if(withDesign&&table==='artifacts'&&params[1]===designBodyRef.artifactId){
    assert.match(sql,/draft_id IS NULL.*storage_key=/);
    row={...artifact,id:designBody.artifactId,bytes:designBody.bytes,content_hash:designBody.contentHash,inspection_json:inspectArtifact(designBytes)};
   }
   else if(withDesign&&table==='commands'&&params[1]===designCommand.id){row=designCommand;}
   else if(withDesign&&table==='authorization_receipts'&&params[1]===designReceipt.id){
    assert.deepEqual(params.slice(1,-1),[designReceipt.id,designCommand.id]);row=designReceipt;
   }
   else if(withDesign&&table==='audit_events'&&params[1]===designCommand.id){row=designAudit;}
   else if(withDesign&&table==='form_definitions'&&params[0]===designFormRef.id){
    assert.deepEqual(params.slice(0,-1),[designFormRef.id,designFormRef.version,designFormRef.contentHash]);
    row=mode==='design-rc-drift'&&scope==='RC2'?{...designForm,created_at:'2026-11-28T00:00:01.000Z'}:designForm;
   }
   else if(table==='document_versions'){assert.deepEqual(params.slice(1,-1),[documentId,1,ref.contentHash]);row=mode==='part'?{...original,stage_ref_json:{applicationId:id(86),nodeId:'PART'}}:original;}
   else if(table==='document_artifact_links'){assert.deepEqual(params.slice(1,-1),[documentId,1]);row={project_id:projectId,document_id:documentId,version:1,kind:'BODY',artifact_id:mode==='wrong-link'?id(30):bodyId};}
   else if(table==='artifacts'){assert.equal(params[1],bodyId);assert.match(sql,/draft_id IS NULL.*storage_key=/);row=scope==='RC2'&&mode==='current-artifact-change'?{...artifact,state:'QUARANTINED'}:artifact;}
   else if(table==='commands'){
    assert.deepEqual(params.slice(1,-1),[command.id]);assert.match(sql,/t\.id=\$2::uuid.*scope_kind='PROJECT'.*approval_consumption_id IS NULL/);
    row=mode==='different-command'?{...command,id:id(91)}:mode==='other-operation'?{...command,operation:'confirmDocument'}:
     mode==='draft-scope'?{...command,scope_kind:'DRAFT',draft_id:id(92)}:mode==='approval'?{...command,approval_consumption_id:id(93)}:command;
   }
   else if(table==='authorization_receipts'){
    assert.deepEqual(params.slice(1,-1),[receipt.id,command.id]);
    row=mode==='wrong-receipt'?{...receipt,subject_ref:{kind:'HUMAN',userId:id(94),clientId}}:receipt;
   }
   else if(table==='audit_events'){
    assert.deepEqual(params.slice(1,-1),[command.id]);assert.match(sql,/t\.command_id=\$2::uuid AND t\.correction_of IS NULL/);
    assert.doesNotMatch(sql,/WHERE[^\n]*source_kind\s*=/);
    const correction={...audit,event_id:id(95),correction_of:audit.event_id};
    if(mode==='duplicate-audit')return {rows:[envelope(audit),envelope({...audit,event_id:id(96),source_kind:'SERVER_DENIAL'})]};
    if(mode==='correction-only')return {rows:[]};
    // 같은 command의 나중 정정은 original 범위 밖이다.
    row=(scope==='RC2'&&mode==='origin-drift')?{...audit,event_id:id(97)}:[audit,correction].find(event=>event.correction_of===null)!;
   }
   else if(table==='form_definitions'){
    assert.deepEqual(params.slice(0,-1),[formRef.id,formRef.version,formRef.contentHash]);
    assert.match(sql,/d\.scope='SYSTEM' AND d\.owner_user_id IS NULL AND d\.project_id IS NULL/);
    assert.doesNotMatch(sql,/head_version|origin_ref_json|USER_COMMON/);
    const other={...systemForm,scope:'USER_COMMON',owner_user_id:id(102)};
    const head=scope==='RR'?1:2;
    const forms=mode==='hidden-common'?[{...other,head_version:head}]:
     [{...systemForm,head_version:head},{...systemForm,head_version:head,version:2,content_hash:'e'.repeat(64)}];
    const pinned=forms.find(form=>form.scope==='SYSTEM'&&form.version===params[1]&&form.content_hash===params[2]);
    if(!pinned)return {rows:[]};
    const {head_version,...projection}=pinned;
    assert.equal(head_version,head);
    if(mode==='form-duplicate')return {rows:[envelope(systemForm),envelope(systemForm)]};
    row=mode==='unbounded-source-row'?other:mode==='form-version'?{...systemForm,version:2}:
     mode==='form-hash'?{...systemForm,definition_json:{...definition,name:'변조'}}:
     scope==='RC2'&&mode==='form-projection-drift'?{...systemForm,created_at:'2026-11-28T00:00:01.000Z'}:projection;
   }
   else if(table==='authoring_standard_versions'){
    assert.deepEqual(params.slice(0,-1),[standardRef.id,standardRef.version,standardRef.contentHash]);
    assert.doesNotMatch(sql,/body_utf8|source_approval_json/);
    if(scope==='RC2'&&mode==='standard-missing')return {rows:[]};
    row=mode==='standard-mismatch'?{...standard,content_hash:'c'.repeat(64)}:standard;
   }
   else if(table==='work_plan_versions'){
    assert.deepEqual(params.slice(0,-1),[projectId,expectedPlanRef.id,expectedPlanRef.version,expectedPlanRef.contentHash,ref.id,ref.version,ref.contentHash]);
    assert.equal(params[7],metadataBudget-rowCharges[scope]!);
    assert.doesNotMatch(sql,/head_version|confirmed_version|ORDER BY/);
    assert(scope==='RR'?liveRR:!liveRR);
    if(mode==='plan-missing')return {rows:[]};
    if(mode==='plan-duplicate')return {rows:[envelope(workPlanRow),envelope(workPlanRow)]};
    if(mode==='plan-metadata-limit')return {rows:[{inventory_data:null,row_bytes:Number(params[7])+1}]};
    row=mode==='plan-cross-row'?{...workPlanRow,project_id:id(312)}:mode==='plan-cross-document'?{...workPlanRow,document_hash:'f'.repeat(64)}:
     scope==='RC2'&&mode==='plan-drift'?{...workPlanRow,command_id:id(312)}:planRow;
   }
   else if(table==='document_confirmations'){
    assert.deepEqual(params.slice(0,-1),[projectId,confirmationId,ref.id,ref.version,ref.contentHash]);
    assert.doesNotMatch(sql,/confirmed_version|head_version/);
    const other={...confirmation,id:id(309)};
    const exact=[other,confirmation].find(candidate=>candidate.id===params[1])!;
    if(mode==='confirmed-duplicate-row')return {rows:[envelope(exact),envelope(exact)]};
    row=mode==='confirmed-duplicate-ref'?{...exact,review_refs:[reviewRef,reviewRef]}:
     mode==='confirmed-change-choice'?{...exact,review_refs:[reviewRef]}:exact;
   }
   else if(table==='content_reviews'){
    if(sql.includes('ORDER BY')){
     assert.deepEqual(params.slice(0,-1),[projectId,ref.id,ref.version,ref.contentHash,confirmationOrigin.audit.server_sequence]);
     assert.match(sql,/a\.server_sequence<\$5::bigint\s+ORDER BY a\.server_sequence DESC LIMIT 1/);
     const observed=[{id:earlierReviewRef.id,outcome:'ACCEPTED',server_sequence:earlierReviewOrigin.audit.server_sequence},
      {id:reviewRef.id,outcome:'ACCEPTED',server_sequence:reviewOrigin.audit.server_sequence},
      {id:id(209),outcome:'REWORK',server_sequence:confirmationOrigin.audit.server_sequence+1}];
     const before=observed.filter(candidate=>candidate.server_sequence<Number(params[4])).at(-1)!;
     row=mode==='confirmed-not-selected'?{...before,id:id(207)}:
      mode==='confirmed-latest-correction'?{...before,server_sequence:before.server_sequence+1}:before;
    }else{
     const found=[review,earlierReview].find(candidate=>candidate.id===params[1])!;
     assert.ok(found);
     assert.deepEqual(params.slice(0,-1),[projectId,found.id,ref.id,ref.version,ref.contentHash]);
     if(mode==='confirmed-missing-review')return {rows:[]};
     row=mode==='confirmed-cross-review'?{...found,target_id:id(207)}:found;
    }
   }
   else throw Error('잘못된 조회');
   const projected=envelope(row);
   if(withPlan&&(table!=='work_plan_versions'||withDesign)){
    // PostgreSQL의 행 JSON 투영이 compact canonical JSON보다 많은 바이트를 반환하는 경우.
    projected.row_bytes+=5;
    rowCharges[scope]=(rowCharges[scope]??0)+projected.row_bytes;
   }
   return {rows:[projected.row_bytes>Number(params.at(-1))?{...projected,inventory_data:null}:projected]};
  },release(error?:Error){trace.push(error?'RR:discard':'RR:release');}} as unknown as PoolClient;
 }
 const access:Pick<AccessRepository,'authenticated'|'pool'>={
  async authenticated<T>(_token:string,csrf:string|null,work:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>){
   assert.equal(csrf,'synthetic-csrf');assert(!liveRR);const scope=`RC${++rc}`;
   trace.push(`${scope}:begin`);const value=await work(db(scope),person);trace.push(`${scope}:commit`);return value;
  },
  pool:{async connect(){rr++;assert.equal(rr,1);return db('RR');}} as unknown as AccessRepository['pool']
 };
 const reader={async open(expected:{artifactId:string}){
  assert(!liveRR);
  if(withDesign&&expected.artifactId===designBodyRef.artifactId){
   assert.deepEqual(expected,{projectId,artifactId:designBodyRef.artifactId,bytes:designBytes.length,contentHash:designBodyRef.contentHash});
   trace.push('design-body:open');
   let read=false;
   return {async read(){if(read)return Buffer.alloc(0);read=true;return mode==='design-corrupt-body'?Buffer.alloc(designBytes.length):Buffer.from(designBytes);},
    async close(){trace.push('design-body:close');}};
  }
  assert.deepEqual(expected,{projectId,artifactId:bodyId,bytes:bytes.length,contentHash:bodyRef.contentHash});
  trace.push('body:open');
  let read=false;
  return {async read(){if(read)return Buffer.alloc(0);read=true;return mode==='wrong-body'?Buffer.alloc(bytes.length):Buffer.from(bytes);},
   async close(){trace.push('body:close');if(mode==='close-unknown')throw Error('합성 close 불명');}};
 }};
 const admission={async readCurrent(_db:Pick<PoolClient,'query'>,actor:AuthenticatedIdentity,scope:{projectId:string;documentRef:typeof ref}){
  assert.equal(actor,person);assert.deepEqual(scope,{projectId,documentRef:ref,...confirmed&&{confirmationId},...withPlan&&{workPlanRef:expectedPlanRef},...withDesign&&{designDocumentRef:expectedDesignRef},...withRelations&&{planRelations:true}});assert(!liveRR);
  trace.push(`RC${rc}:admission`);
  if(mode==='policy-denied'||(mode==='policy-revoked'||mode==='design-revoked')&&rc===2)return null;
  return {purpose:withRelations&&mode!=='relations-v6-admission'?'FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_ADMISSION_V7':withDesign&&mode!=='design-v5-purpose'?'FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_ADMISSION_V6':withPlan?'FN16_D2_DOCUMENT_WORK_PLAN_ADMISSION_V5':confirmed?'FN16_D2_DOCUMENT_CONFIRMATION_ADMISSION_V4':mode==='body-only-admission'?'FN16_D2_DOCUMENT_BODY_ADMISSION_V1':mode==='draft-only-admission'?'FN16_D2_DOCUMENT_DRAFT_ADMISSION_V2':'FN16_D2_DOCUMENT_SYSTEM_FORM_ADMISSION_V3',
   projectId,documentRef:ref,actorId,clientId,sessionId,credentialGeneration:1,controlGeneration:1,
   ...confirmed&&{confirmationId:mode==='confirmed-admission-mismatch'?id(207):confirmationId},
   ...withPlan&&mode!=='plan-admission-missing'&&{workPlanRef:mode==='plan-admission-mismatch'?pinned(312):expectedPlanRef},
   ...withDesign&&{designDocumentRef:mode==='design-admission-mismatch'?ref:expectedDesignRef,
    designFormRef:mode==='design-form-mismatch'?formRef:designFormRef},
   ...withRelations&&mode!=='relations-v6-admission'&&{planRelations:true},
   jobRef:pinned(10),reservationRef:pinned(11),policyRef:pinned(mode==='new-policy'&&rc===2?19:12),targetProtectedRef:pinned(13),
   retentionPolicyRef:pinned(14),encryptionKeyRef:pinned(15),verificationPolicyRef:pinned(16),
   formRef:mode==='foreign-admission-form'?pinned(103):formRef,expiresAt:'2026-11-28T00:00:09.000Z'};
 }};
 const run=(limits=input.limits)=>{
  metadataBudget=limits.metadataBytes;
  return collectDocumentBodySnapshot(access,'synthetic-token','synthetic-csrf',
  {...input,limits,...confirmed&&{confirmationId},...withPlan&&{workPlanRef:mode==='plan-raw-invalid'?null:expectedPlanRef},
   ...withDesign&&{designDocumentRef:expectedDesignRef},...withRelations&&{planRelations:true}},
  mode==='unconfigured'?null:admission,reader,new AbortController().signal);
 };
 return {run,trace,expectedPlanRef,designVersionRef,rowCharges};
}

test('고정 작업계획의 저장 업무·의존 행을 AF02와 AF04와 함께 동결한다',async()=>{
 const stored=fixture('relations-valid'),limits={...input.limits,fileCount:2};
 const capture=await stored.run(limits),{snapshot}=capture;
 assert.equal(snapshot.kind,'FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_SNAPSHOT_V7');
 if(snapshot.kind!=='FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_SNAPSHOT_V7')throw Error('작업계획 관계 원행 누락');
 const {workPlanRelations}=snapshot.rows;
 assert.deepEqual(workPlanRelations.tasks.map(row=>row.task_code),['A','Z']);
 assert.deepEqual(workPlanRelations.dependencies.map(row=>row.phase),['ACCEPTANCE','START']);
 assert.deepEqual(stored.trace.filter(item=>/plan_tasks|plan_dependencies|^RR:rollback|body:open|RC2:commit/.test(item)),
  ['RR:plan_tasks','RR:plan_dependencies','RR:rollback','body:open','design-body:open','RC2:plan_tasks','RC2:plan_dependencies','RC2:commit']);
 const expected={projectId,jobRef:snapshot.jobRef,documentRef:ref,workPlanRef:stored.expectedPlanRef,designDocumentRef:stored.designVersionRef,
  planRelations:true as const,snapshot:snapshot.observation.snapshot,snapshotHash:capture.snapshotHash};
 const readback={snapshotBytes:Buffer.from(capture.snapshotBytes),body:Buffer.from(capture.body),designBody:Buffer.from(capture.designBody!)};
 const checked=await historyVerification.verifyDocumentBodyHistoryReadback(expected,limits,async(scope)=>{
  assert.equal(scope.planRelations,true);
  assert.deepEqual(scope.workPlanRef,stored.expectedPlanRef);
  return readback;
 });
 assert.equal(checked.kind,'FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_VERIFICATION_V7');
 if(checked.kind!=='FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_VERIFICATION_V7')throw Error('작업계획 관계 검산 누락');
 assert.equal(checked.taskCount,2);
 assert.equal(checked.dependencyCount,2);
 assert.equal(checked.workPlanRelationsHash,hash(workPlanRelations));
 assert.equal(checked.workPlanHistoryComplete,false);
 assert.equal(checked.workPlanAuthorityVerified,false);
 assert.equal(checked.restorable,false);
 const {planRelations:_,...v6Expectation}=expected;
 await assert.rejects(historyVerification.verifyDocumentBodyHistoryReadback(v6Expectation,limits,async()=>readback),
  /FN16_D2_DOCUMENT_HISTORY_INVALID/);
 const changed=structuredClone(snapshot);
 changed.rows.workPlanRelations.dependencies[0]!.phase='START';
 const changedBytes=Buffer.from(canonicalJson(changed));
 // 분석 원문·두 BODY는 그대로 유지하며, 새 외부 snapshot hash도 맞춘 뒤 관계 판독 자체를 검사한다.
 await assert.rejects(historyVerification.verifyDocumentBodyHistoryReadback({...expected,snapshotHash:contentHash(changedBytes)},limits,
  async()=>({...readback,snapshotBytes:changedBytes})),/FN16_D2_DOCUMENT_HISTORY_INVALID/);
});

test('ISSUES_ONLY는 정확한 두 관계표의 0행만 보존하며 고아 행을 거절한다',async()=>{
 const limits={...input.limits,fileCount:2};
 const f=fixture('relations-issues-valid'),{snapshot}=await f.run(limits);
 if(snapshot.kind!=='FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_SNAPSHOT_V7')throw Error('작업계획 관계 원행 누락');
 assert.deepEqual(snapshot.rows.workPlanRelations,{tasks:[],dependencies:[]});
 assert.deepEqual(f.trace.filter(item=>/RR:plan_tasks|RR:plan_dependencies/.test(item)),['RR:plan_tasks','RR:plan_dependencies']);
 for(const mode of ['relations-issues-orphan-task','relations-issues-orphan-dependency']){
  const suspect=fixture(mode);
  await assert.rejects(suspect.run(limits),/WORK_PLAN_INVENTORY_INTEGRITY_FAILED/);
  assert.equal(suspect.trace.includes('RR:plan_dependencies'),mode.endsWith('dependency'));
  assert.equal(suspect.trace.some(item=>item.endsWith('body:open')),false);
 }
});

test('업무·의존 행의 손상과 초과 예산을 원문 읽기 전에 거절한다',async()=>{
 const limits={...input.limits,fileCount:2};
 for(const mode of ['relations-duplicate-task','relations-cross-task','relations-wrong-owner','relations-missing-task',
  'relations-wrong-phase','relations-extra-dependency','relations-wrong-order']){
  const f=fixture(mode);
  await assert.rejects(f.run(limits),/WORK_PLAN_INVENTORY_INTEGRITY_FAILED/,mode);
  assert.equal(f.trace.includes('RR:plan_dependencies'),!mode.endsWith('task')&&mode!=='relations-wrong-owner',mode);
  assert.equal(f.trace.some(item=>item.endsWith('body:open')),false);
 }
 const ok=fixture('relations-valid');
 await ok.run(limits);
 const smaller=fixture('relations-valid');
 await assert.rejects(smaller.run({...limits,metadataBytes:ok.rowCharges.RR!-1}),/FN16_D2_SNAPSHOT_LIMIT|WORK_PLAN_INVENTORY_LIMIT/);
 assert.equal(smaller.trace.includes('RR:plan_dependencies'),true);
 assert.equal(smaller.trace.some(item=>item.endsWith('body:open')),false);
});

test('별도 관계 입장, 최종 관계 변경과 만료는 부분 결과를 반환하지 않는다',async()=>{
 const limits={...input.limits,fileCount:2};
 const earlier=fixture('relations-v6-admission');
 await assert.rejects(earlier.run(limits),/FN16_D2_SNAPSHOT_ADMISSION_DENIED/);
 assert.equal(earlier.trace.includes('RR:begin'),false);
 for(const [mode,error] of [['relations-rc-drift',/WORK_PLAN_INVENTORY_INTEGRITY_FAILED/],['relations-expired',/FN16_D2_SNAPSHOT_DEADLINE/]] as const){
  const f=fixture(mode);
  await assert.rejects(f.run(limits),error);
  assert.equal(f.trace.includes('body:close'),true);
  assert.equal(f.trace.includes('design-body:close'),true);
  assert.equal(f.trace.includes('RC2:plan_tasks'),mode==='relations-rc-drift');
  assert.equal(f.trace.includes('RC2:commit'),false);
 }
});

test('작업계획의 AF02와 AF04를 같은 RR에서 읽고 독립 보관 바이트로 확인한다',async()=>{
 const primary=fixture('design-valid'),limits={...input.limits,fileCount:2};
 const captured=await primary.run(limits);
 assert.equal(captured.snapshot.kind,'FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_SNAPSHOT_V6');
 assert.deepEqual(captured.body,bytes);
 assert.deepEqual(captured.designBody,designBytes);
 assert.deepEqual(primary.trace.filter(item=>/work_plan_versions|AF02|^RR:rollback|body:open|RC2:commit/.test(item)),
  ['RR:work_plan_versions','RR:AF02','RR:rollback','body:open','design-body:open','RC2:work_plan_versions','RC2:AF02','RC2:commit']);
 const {snapshot}=captured;
 const expected={projectId,jobRef:snapshot.jobRef,documentRef:ref,workPlanRef,designDocumentRef:designRef,
  snapshot:snapshot.observation.snapshot,snapshotHash:captured.snapshotHash};
 const readback={snapshotBytes:Buffer.from(captured.snapshotBytes),body:Buffer.from(captured.body),designBody:Buffer.from(captured.designBody!)};
 const checked=await historyVerification.verifyDocumentBodyHistoryReadback(expected,limits,async(scope)=>{
  assert.deepEqual(scope.designDocumentRef,designRef);
  assert.deepEqual(scope.documentRef,ref);
  return readback;
 });
 assert.equal(checked.kind,'FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_VERIFICATION_V6');
 if(checked.kind!=='FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_VERIFICATION_V6')throw Error('AF02 원 관계 누락');
 assert.deepEqual(checked.designDocumentRef,designRef);
 assert.equal(checked.designArtifact.contentHash,designBodyRef.contentHash);
 assert.equal(checked.designBodyVerified,true);
 assert.equal(checked.designDocumentHistoryComplete,false);
 assert.equal(checked.executionAuthorized,false);
 assert.equal(checked.restorable,false);
 for(const [replayRef,replay] of [[ref,readback],[designRef,{...readback,designBody:readback.body}]] as const){
  await assert.rejects(historyVerification.verifyDocumentBodyHistoryReadback({...expected,designDocumentRef:replayRef},limits,async()=>replay),
   /FN16_D2_DOCUMENT_HISTORY_INVALID/);
 }
 await assert.rejects(historyVerification.verifyDocumentBodyHistoryReadback(expected,{...limits,fileCount:1},async()=>readback),
  /FN16_D2_DOCUMENT_HISTORY_INVALID/);
 await assert.rejects(historyVerification.verifyDocumentBodyHistoryReadback(expected,{...limits,inputBytes:bytes.length+designBytes.length-1},async()=>readback),
  /FN16_D2_DOCUMENT_HISTORY_INVALID/);
});

test('AF02와 AF04가 동일 산출물을 참조하면 원 문서 관계 둘을 검산하고 BODY는 한 번만 읽는다',async()=>{
 const shared=fixture('design-shared');
 const limits={...input.limits,inputBytes:bytes.length};
 const capture=await shared.run(limits);
 assert.equal(capture.designBody,null);
 assert.equal(shared.trace.filter(item=>item==='body:open').length,1);
 const expected={projectId,jobRef:capture.snapshot.jobRef,documentRef:ref,workPlanRef:shared.expectedPlanRef,designDocumentRef:shared.designVersionRef,
  snapshot:capture.snapshot.observation.snapshot,snapshotHash:capture.snapshotHash};
 const readback={snapshotBytes:Buffer.from(capture.snapshotBytes),body:Buffer.from(capture.body),designBody:null};
 const checked=await historyVerification.verifyDocumentBodyHistoryReadback(expected,limits,async()=>readback);
 assert.equal(checked.kind,'FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_VERIFICATION_V6');
 await assert.rejects(historyVerification.verifyDocumentBodyHistoryReadback(expected,limits,async()=>({...readback,designBody:readback.body})),
  /FN16_D2_DOCUMENT_HISTORY_INVALID/);
});

test('AF02 별도 입장·정확 계획 결박·프로젝트/단계·양식·두 BODY의 합산 한도는 보호 원문 열기 전에 거절한다',async()=>{
 const limits={...input.limits,fileCount:2};
 for(const [mode,error] of [
  ['design-v5-purpose',/FN16_D2_SNAPSHOT_ADMISSION_DENIED/],
  ['design-admission-mismatch',/FN16_D2_SNAPSHOT_ADMISSION_DENIED/],
  ['design-plan-mismatch',/WORK_PLAN_INVENTORY/],
  ['design-form-mismatch',/DOCUMENT_INVENTORY/],
  ['design-cross-project',/DOCUMENT_INVENTORY/],
  ['design-phase',/DOCUMENT_INVENTORY/],
 ] as const){
  const candidate=fixture(mode);
  await assert.rejects(candidate.run(limits),error,mode);
  assert.equal(candidate.trace.some(item=>item.endsWith('body:open')),false,mode);
  if(mode==='design-plan-mismatch'||error.source.includes('ADMISSION_DENIED'))assert.equal(candidate.trace.includes('RR:AF02'),false,mode);
 }
 for(const tooSmall of [{...limits,fileCount:1},{...limits,inputBytes:bytes.length+designBytes.length-1}]){
  const candidate=fixture('design-valid');
  await assert.rejects(candidate.run(tooSmall),/FN16_D2_SNAPSHOT_LIMIT/);
  assert.equal(candidate.trace.some(item=>item.endsWith('body:open')),false);
 }
 const complete=fixture('design-valid');
 await complete.run(limits);
 const candidate=fixture('design-valid');
 await assert.rejects(candidate.run({...limits,metadataBytes:complete.rowCharges.RR!-1}),/FN16_D2_SNAPSHOT_LIMIT/);
 assert.equal(candidate.trace.includes('RR:AF02'),true);
 assert.equal(candidate.trace.some(item=>item.endsWith('body:open')),false);
});

test('AF02 두 번째 원문 실패 또는 최종 입장 회수·원행 변경에서는 부분 결과도 반환하지 않는다',async()=>{
 for(const [mode,error] of [
  ['design-corrupt-body',/ARTIFACT_BYTES_/],
  ['design-revoked',/FN16_D2_SNAPSHOT_ADMISSION_DENIED/],
  ['design-rc-drift',/FN16_D2_SNAPSHOT_INVALID/],
 ] as const){
  const candidate=fixture(mode);
  await assert.rejects(candidate.run({...input.limits,fileCount:2}),error,mode);
  assert.equal(candidate.trace.includes('body:close'),true,mode);
  assert.equal(candidate.trace.includes('design-body:close'),true,mode);
  assert.equal(candidate.trace.includes('RC2:commit'),false,mode);
  assert.equal(candidate.trace.includes('RC2:AF02'),mode==='design-rc-drift',mode);
 }
});

test('고정 작업계획 버전의 AF04 원문 관계를 한 RR과 독립 보관 바이트에서 검산한다',async()=>{
 const f=fixture('plan-valid'),capture=await f.run();
 assert.equal(capture.snapshot.kind,'FN16_D2_DOCUMENT_WORK_PLAN_SNAPSHOT_V5');
 const {snapshot}=capture;
 const expected={projectId,jobRef:snapshot.jobRef,documentRef:ref,workPlanRef,snapshot:snapshot.observation.snapshot,snapshotHash:capture.snapshotHash};
 const checked=await historyVerification.verifyDocumentBodyHistoryReadback(expected,input.limits,async(scope)=>{
  assert.deepEqual(scope.workPlanRef,workPlanRef);
  return {snapshotBytes:Buffer.from(capture.snapshotBytes),body:Buffer.from(capture.body)};
 });
 assert.equal(checked.kind,'FN16_D2_DOCUMENT_WORK_PLAN_VERIFICATION_V5');
 if(checked.kind!=='FN16_D2_DOCUMENT_WORK_PLAN_VERIFICATION_V5')throw Error('작업계획 원 관계 누락');
 assert.deepEqual(checked.workPlanRef,workPlanRef);
 assert.equal(checked.workPlanProjectionHash,hash(workPlanRow));
 assert.equal(checked.workPlanHistoryComplete,false);
 assert.equal(checked.workPlanAuthorityVerified,false);
 assert.deepEqual(f.trace.filter(item=>/work_plan_versions|RR:begin|RR:rollback|RC2:commit/.test(item)),
  ['RR:begin','RR:work_plan_versions','RR:rollback','RC2:work_plan_versions','RC2:commit']);
 assert.equal(checked.restorable,false);
 const planSnapshot=structuredClone(snapshot);
 if(planSnapshot.kind!=='FN16_D2_DOCUMENT_WORK_PLAN_SNAPSHOT_V5')throw Error('다른 스냅샷');
 const row=planSnapshot.rows.workPlanVersion;
 const changedDocRef={...ref,contentHash:'c'.repeat(64)};
 const replacement={...workPlan,documentRef:changedDocRef};
 const replacementRef={...workPlanRef,contentHash:hash(replacement)};
 row.document_hash=changedDocRef.contentHash;
 row.content_hash=replacementRef.contentHash;
 row.version_json={ref:replacementRef,status:'DRAFT',...replacement};
 const alteredBytes=Buffer.from(canonicalJson(planSnapshot));
 await assert.rejects(()=>historyVerification.verifyDocumentBodyHistoryReadback(
  {...expected,workPlanRef:replacementRef,snapshotHash:contentHash(alteredBytes)},input.limits,
  async()=>({snapshotBytes:alteredBytes,body:capture.body})),/HISTORY_INVALID/);
 const {workPlanRef:omitted,...noPlan}=expected;
 assert.deepEqual(omitted,workPlanRef);
 await assert.rejects(()=>verifyDocumentBodyHistory(noPlan,async()=>capture),/HISTORY_INVALID/);
});

test('작업계획 입장·원 참조의 누락과 최종 RC 변경은 수집 결과를 만들지 않는다',async()=>{
 const invalid=fixture('plan-raw-invalid');
 await assert.rejects(invalid.run,/INPUT_INVALID/);
 assert.deepEqual(invalid.trace,[]);
 for(const mode of ['plan-admission-missing','plan-admission-mismatch']){
  const f=fixture(mode);
  await assert.rejects(f.run,/SNAPSHOT_ADMISSION_DENIED/);
  assert(!f.trace.includes('RR:begin')&&!f.trace.includes('body:open'),mode);
 }
 for(const mode of ['plan-missing','plan-duplicate','plan-cross-row','plan-cross-document']){
  const f=fixture(mode);
  await assert.rejects(f.run,/WORK_PLAN_INVENTORY_INTEGRITY_FAILED/);
  assert(f.trace.includes('RR:rollback')&&!f.trace.includes('body:open'),mode);
 }
 const limited=fixture('plan-metadata-limit');
 await assert.rejects(limited.run,/WORK_PLAN_INVENTORY_LIMIT/);
 assert(limited.trace.includes('RR:rollback')&&!limited.trace.includes('body:open'));
 const drift=fixture('plan-drift');
 await assert.rejects(drift.run,/FN16_D2_SNAPSHOT_INVALID/);
 assert(drift.trace.includes('body:close')&&drift.trace.includes('RC2:work_plan_versions')&&!drift.trace.includes('RC2:commit'));
});

test('정확한 확정과 당시 선택한 HUMAN 검토를 같은 스냅샷 및 최종 RC에서 검산한다',async()=>{
 const f=fixture('confirmed-valid'),capture=await f.run();
 assert.equal(capture.snapshot.kind,'FN16_D2_DOCUMENT_CONFIRMATION_SNAPSHOT_V4');
 if(capture.snapshot.kind!=='FN16_D2_DOCUMENT_CONFIRMATION_SNAPSHOT_V4')throw Error('원 확정 수집 누락');
 const {snapshot}=capture;
 const expected={projectId,jobRef:snapshot.jobRef,documentRef:ref,
  snapshot:snapshot.observation.snapshot,snapshotHash:capture.snapshotHash,confirmationId};
 const independent=()=>({snapshot:structuredClone(snapshot),body:Buffer.from(capture.body)});
 const verification=await verifyDocumentBodyHistory(expected,async()=>independent());
 assert.equal(verification.kind,'FN16_D2_DOCUMENT_CONFIRMATION_VERIFICATION_V4');
 if(verification.kind!=='FN16_D2_DOCUMENT_CONFIRMATION_VERIFICATION_V4')throw Error('원 확정 검산 누락');
 assert.equal(verification.confirmationId,confirmationId);
 assert.equal(verification.confirmationProjectionHash,hash({row:confirmation,origin:confirmationOrigin}));
 assert.deepEqual(verification.selectedReviewProjections,[
  {id:reviewRef.id,projectionHash:hash({row:review,origin:reviewOrigin})},
  {id:earlierReviewRef.id,projectionHash:hash({row:earlierReview,origin:earlierReviewOrigin})}]);
 assert.ok(f.trace.includes('RR:document_confirmations')&&f.trace.includes('RC2:document_confirmations'));
 assert.equal(f.trace.filter(v=>v==='RR:content_reviews'||v==='RC2:content_reviews').length,6);
 assert.equal(verification.documentHistoryComplete,false);
 assert.equal(verification.restorable,false);
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,confirmationId:id(309)},async()=>independent()),/HISTORY_INVALID/);
 const reordered=independent();
 reordered.snapshot.rows.confirmation.reviews.reverse();
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,snapshotHash:hash(reordered.snapshot)},async()=>reordered),/HISTORY_INVALID/);
 const altered=independent();
 altered.snapshot.rows.confirmation.reviews[0]!.row.reason='원 요청과 다른 합성 이유';
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,snapshotHash:hash(altered.snapshot)},async()=>altered),/HISTORY_INVALID/);
 const resequenced=independent();
 resequenced.snapshot.rows.confirmation.latestBefore.server_sequence=reviewOrigin.audit.server_sequence+1;
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,snapshotHash:hash(resequenced.snapshot)},async()=>resequenced),/HISTORY_INVALID/);
});

test('입장·원 확정·선택·영수증·감사의 불일치와 최종 RC 변경을 거절한다',async()=>{
 const unauthorized=fixture('confirmed-admission-mismatch');
 await assert.rejects(unauthorized.run,/SNAPSHOT_ADMISSION_DENIED/);
 assert.ok(!unauthorized.trace.includes('RR:begin'));
 for(const mode of ['confirmed-duplicate-row','confirmed-duplicate-ref','confirmed-change-choice','confirmed-missing-review',
  'confirmed-cross-review','confirmed-not-selected','confirmed-latest-correction','confirmed-review-audit','confirmed-review-approval']){
  const f=fixture(mode);
  await assert.rejects(f.run,/DOCUMENT_INVENTORY_INTEGRITY_FAILED/);
  assert.ok(f.trace.includes('RR:rollback')&&!f.trace.includes('body:open'),mode);
 }
 const drift=fixture('confirmed-final-proof-drift');
 await assert.rejects(drift.run,/FN16_D2_SNAPSHOT_INVALID/);
 assert.ok(drift.trace.includes('body:close')&&drift.trace.includes('RC2:content_reviews')&&!drift.trace.includes('RC2:commit'));
});

test('한 RR의 보관 문서·BODY·원 명령 관계와 정확 바이트를 독립 재검산한다',async()=>{
 const f=fixture(),capture=await f.run();
 const tables=['document_versions','document_artifact_links','artifacts','commands','authorization_receipts','audit_events','form_definitions','authoring_standard_versions'];
 assert.deepEqual(f.trace,['RC1:begin','RC1:admission','RC1:commit','RR:begin','RR:rls',...tables.map(v=>'RR:'+v),
  'RR:rollback','RR:release','body:open','body:close','RC2:begin','RC2:admission',...tables.map(v=>'RC2:'+v),'RC2:commit']);
 assert.deepEqual(capture.body,bytes);
 assert.equal(capture.coverage,'DOCUMENT_BODY_DRAFT_ORIGIN_AND_SYSTEM_FORM');
 const expected={projectId,documentRef:ref,jobRef:pinned(10),snapshot:'4:14:',snapshotHash:capture.snapshotHash};
 const independent=()=>({snapshot:JSON.parse(JSON.stringify(capture.snapshot)),body:Buffer.from(capture.body)});
 const result=await verifyDocumentBodyHistory(expected,async()=>independent());
 assert.deepEqual(result.documentRef,ref);
 assert.deepEqual(result.artifact,bodyRef);
 assert.equal(result.bodyVerified,true);
 assert.equal(result.documentHistoryComplete,false);
 assert.equal(result.restorable,false);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.kind,'FN16_D2_DOCUMENT_SYSTEM_FORM_VERIFICATION_V3');
 if(result.kind!=='FN16_D2_DOCUMENT_SYSTEM_FORM_VERIFICATION_V3')throw Error('양식 검산 누락');
 assert.deepEqual(result.commandProjectionRef,{id:original.command_id,version:1,contentHash:hash(command)});
 assert.deepEqual(result.receiptProjectionRef,{id:receipt.id,version:1,contentHash:hash(receipt)});
 assert.notEqual(result.receiptProjectionRef.contentHash,scopeDigest);
 assert.deepEqual(result.auditProjectionRef,{id:audit.event_id,version:1,contentHash:hash(audit)});
 assert.deepEqual(result.formRef,formRef);
 assert.equal(result.formProjectionHash,hash(systemForm));
 assert.deepEqual(result.standardRef,standardRef);
 assert.equal(result.standardProjectionHash,hash(standard));
 assert.equal(result.standardBodyVerified,false);
 assert.equal(result.formAuthorityVerified,false);
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>{const restored=independent();restored.body[0]=restored.body[0]!^1;return restored;}),/HISTORY_INVALID/);
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>{const restored=independent();restored.snapshot.observation.snapshot='4:15:';return restored;}),/HISTORY_INVALID/);
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>{const restored=independent();restored.snapshot.rows.link.artifact_id=id(99);return restored;}),/HISTORY_INVALID/);
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,jobRef:pinned(99)},async()=>independent()),/HISTORY_INVALID/);
 const stored=independent();
 stored.snapshot.rows.origin.receipt.scope_digest='c'.repeat(64);
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,snapshotHash:hash(stored.snapshot)},async()=>stored),/HISTORY_INVALID/);
 const changedStandard=independent();
 changedStandard.snapshot.rows.systemForm.definition.authoring_standard_ref=pinned(104);
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,snapshotHash:hash(changedStandard.snapshot)},async()=>changedStandard),/HISTORY_INVALID/);
});

test('보호 재조회에서만 수거한 정규 스냅샷과 BODY 바이트를 고정 기대값으로 검산한다',async()=>{
 const capture=await fixture('confirmed-valid').run();
 assert.equal(typeof historyVerification.verifyDocumentBodyHistoryReadback,'function');
 const snapshotBytes=Buffer.from(capture.snapshotBytes),archivedBody=Buffer.from(capture.body);
 const {jobRef,documentRef,observation}=capture.snapshot;
 const scope={projectId,jobRef,documentRef,snapshot:observation.snapshot,confirmationId};
 const expected={...scope,snapshotHash:capture.snapshotHash};
 assert.equal(snapshotBytes.toString('utf8'),canonicalJson(capture.snapshot));
 assert.equal(contentHash(snapshotBytes),expected.snapshotHash);
 capture.body.fill(0);
 capture.snapshotBytes.fill(0);
 const mutable=capture.snapshot.rows.version;
 mutable.title='작성 중 메모리 값';
 let reads=0;
 const result=await historyVerification.verifyDocumentBodyHistoryReadback(expected,input.limits,async(wanted,limits)=>{
  assert.deepEqual(wanted,scope);
  assert.deepEqual(limits,input.limits);
  reads++;
  return {snapshotBytes:Uint8Array.from(snapshotBytes),body:Uint8Array.from(archivedBody)};
 });
 assert.equal(reads,1);
 assert.equal(result.kind,'FN16_D2_DOCUMENT_CONFIRMATION_VERIFICATION_V4');
 assert.equal(result.bodyVerified,true);
 assert.equal(result.restorable,false);
});

test('바이트 재조회는 외부 기대값과 한도를 먼저 고정하고 잘못된 보관본을 거절한다',async()=>{
 const capture=await fixture().run();
 const {jobRef,documentRef,observation}=capture.snapshot;
 const expected={projectId,jobRef,documentRef,snapshot:observation.snapshot,snapshotHash:capture.snapshotHash};
 const original={snapshotBytes:capture.snapshotBytes,body:capture.body};
 const readback=historyVerification.verifyDocumentBodyHistoryReadback;
 const canonical=capture.snapshotBytes.toString('utf8');
 const malformedUtf8=Buffer.from(capture.snapshotBytes);
 const nonAscii=malformedUtf8.findIndex(byte=>byte>=128);
 assert.ok(nonAscii>=0);
 malformedUtf8[nonAscii]=255;
 const malformed=[
  malformedUtf8,
  Buffer.concat([Buffer.from([239,187,191]),capture.snapshotBytes]),
  Buffer.from(` ${canonical}`),
  Buffer.from(canonical.replace(`"projectId":"${projectId}"`,`"project\\u0049d":"${projectId}","projectId":"${projectId}"`)),
 ];
 assert.notEqual(malformed[3]!.toString('utf8'),canonical);
 for(const snapshotBytes of malformed){
  // 잘못된 바이트 자체로 기대 지문을 재계산해도 형식 검산에서 거절한다.
  await assert.rejects(()=>readback({...expected,snapshotHash:contentHash(snapshotBytes)},input.limits,
   async()=>({...original,snapshotBytes})),/HISTORY_INVALID/);
 }
 const reread=async()=>original;
 await assert.rejects(()=>readback({...expected,jobRef:pinned(307)},input.limits,reread),/HISTORY_INVALID/);
 await assert.rejects(()=>readback({...expected,snapshotHash:'0'.repeat(64)},input.limits,reread),/HISTORY_INVALID/);
 await assert.rejects(()=>readback(expected,{...input.limits,metadataBytes:capture.snapshotBytes.length-1},reread),/HISTORY_INVALID/);
 await assert.rejects(()=>readback(expected,{...input.limits,inputBytes:capture.body.length-1},reread),/HISTORY_INVALID/);
 await assert.rejects(()=>readback(expected,input.limits,async()=>({...original,body:Buffer.alloc(capture.body.length)})),/HISTORY_INVALID/);
 await assert.rejects(()=>readback(expected,input.limits,async()=>capture),/HISTORY_INVALID/);
 await assert.rejects(()=>readback(expected,input.limits,async()=>({snapshotBytes:capture.snapshot,body:capture.body})),/HISTORY_INVALID/);
 await assert.rejects(()=>readback(expected,input.limits,async()=>{throw Error('독립 재조회 실패');}),/HISTORY_INVALID/);
 let attempted=false;
 await assert.rejects(()=>readback({...expected,projectId:'invalid'},input.limits,async()=>{attempted=true;return original;}),/HISTORY_INVALID/);
 assert.equal(attempted,false);
 const changeable={...expected,jobRef:{...expected.jobRef}},limit={...input.limits};
 const verified=await readback(changeable,limit,async(scope,bounds)=>{
  assert.ok(Object.isFrozen(scope)&&Object.isFrozen(scope.jobRef)&&Object.isFrozen(bounds));
  assert.ok(!Object.hasOwn(scope,'snapshotHash'));
  changeable.jobRef.id=id(310);
  changeable.snapshotHash='0'.repeat(64);
  limit.metadataBytes=1;
  return original;
 });
 assert.equal(verified.kind,'FN16_D2_DOCUMENT_SYSTEM_FORM_VERIFICATION_V3');
 assert.deepEqual(verified.jobRef,expected.jobRef);
 assert.deepEqual(original.snapshotBytes,Buffer.from(canonical));
 assert.deepEqual(original.body,bytes);
 const bounded=fixture();
 await assert.rejects(()=>bounded.run({...input.limits,metadataBytes:capture.snapshotBytes.length-1}),/FN16_D2_SNAPSHOT_LIMIT/);
 assert.ok(bounded.trace.includes('RR:rollback')&&!bounded.trace.includes('body:open'));
});

test('무응답 바이트 reader는 기한에 한 번 취소하고 늦은 응답과 오류를 폐기한다',{timeout:2000},async()=>{
 const capture=await fixture().run();
 const expected={projectId,jobRef:capture.snapshot.jobRef,documentRef:ref,
  snapshot:capture.snapshot.observation.snapshot,snapshotHash:capture.snapshotHash};
 const limits={...input.limits,deadlineMs:60};
 for(const settle of ['NONE','RESOLVE','REJECT']){
  const port=Promise.withResolvers<unknown>();
  let reads=0,aborts=0;
  await assert.rejects(()=>historyVerification.verifyDocumentBodyHistoryReadback(expected,limits,async(_scope,_limits,signal)=>{
   reads++;
   signal.addEventListener('abort',()=>{aborts++;});
   return port.promise;
  }),/HISTORY_INVALID/);
  assert.equal(reads,1);
  assert.equal(aborts,1);
  if(settle==='RESOLVE')port.resolve({snapshotBytes:capture.snapshotBytes,body:capture.body});
  if(settle==='REJECT')port.reject(Error('기한 뒤 reader 오류'));
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(reads,1);
  assert.equal(aborts,1);
 }
 let completedSignal:AbortSignal|undefined;
 const normal=await historyVerification.verifyDocumentBodyHistoryReadback(expected,limits,async(_scope,_bounds,signal)=>{
  completedSignal=signal;
  assert.equal(signal.aborted,false);
  return {snapshotBytes:capture.snapshotBytes,body:capture.body};
 });
 assert.equal(normal.bodyVerified,true);
 await new Promise<void>(resolve=>setTimeout(resolve,limits.deadlineMs+10));
 assert.ok(completedSignal);
 assert.equal(completedSignal.aborted,false);
});

test('기존 BODY v1과 초안 원 명령 v2는 각각 이전 검산 범위로 읽힌다',async()=>{
 const capture=await fixture().run();
 const {version,link,artifact}=capture.snapshot.rows;
 const legacy={...capture.snapshot,kind:'FN16_D2_DOCUMENT_BODY_SNAPSHOT_V1',rows:{version,link,artifact}};
 const expected={projectId,documentRef:ref,jobRef:pinned(10),snapshot:'4:14:',snapshotHash:hash(legacy)};
 const result=await verifyDocumentBodyHistory(expected,async()=>({snapshot:legacy,body:Buffer.from(capture.body)}));
 assert.equal(result.kind,'FN16_D2_DOCUMENT_BODY_VERIFICATION_V1');
 assert.equal(result.bodyVerified,true);
 assert(!Object.hasOwn(result,'receiptProjectionRef'));
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>({snapshot:{...legacy,rows:capture.snapshot.rows},body:bytes})),/HISTORY_INVALID/);
 const v2={...legacy,kind:'FN16_D2_DOCUMENT_DRAFT_SNAPSHOT_V2',rows:{...legacy.rows,origin:capture.snapshot.rows.origin}};
 const draft=await verifyDocumentBodyHistory({...expected,snapshotHash:hash(v2)},async()=>({snapshot:v2,body:bytes}));
 assert.equal(draft.kind,'FN16_D2_DOCUMENT_DRAFT_VERIFICATION_V2');
 assert(Object.hasOwn(draft,'receiptProjectionRef')&&!Object.hasOwn(draft,'formProjectionHash'));
 for(const [snapshot,previous]of [[legacy,result],[v2,draft]]as const){
  const snapshotBytes=Buffer.from(canonicalJson(snapshot));
  const reread=await historyVerification.verifyDocumentBodyHistoryReadback({...expected,snapshotHash:contentHash(snapshotBytes)},
   input.limits,async()=>({snapshotBytes,body:bytes}));
  assert.deepEqual(reread,previous);
 }
});

test('SYSTEM 양식이나 표준의 교차·변조·중복과 최신 RC 변경을 거절한다',async()=>{
 for(const mode of ['hidden-common','unbounded-source-row','form-version','form-hash','form-duplicate','standard-mismatch','foreign-admission-form']){
  const f=fixture(mode);
  await assert.rejects(f.run,/DOCUMENT_INVENTORY_INTEGRITY_FAILED/);
  assert(!f.trace.includes('body:open'),mode);
  if(mode==='foreign-admission-form')assert(!f.trace.includes('RR:form_definitions'));
 }
 for(const mode of ['standard-missing','form-projection-drift']){
  const f=fixture(mode);
  await assert.rejects(f.run);
  assert(f.trace.includes('RC2:form_definitions')&&!f.trace.includes('RC2:commit'),mode);
 }
});

test('원 명령 참조·범위·인가·원 감사의 부적격은 BODY IO 전에 닫는다',async()=>{
 for(const mode of ['part','draft-scope','other-operation','approval','different-command','wrong-receipt','duplicate-audit','correction-only']){
  const f=fixture(mode);
  await assert.rejects(f.run,/DOCUMENT_INVENTORY_INTEGRITY_FAILED/);
  assert(!f.trace.includes('body:open'),mode);
  assert.equal(f.trace.filter(s=>s==='RR:rollback').length,1,mode);
 }
 const drift=fixture('origin-drift');
 await assert.rejects(drift.run,/FN16_D2_SNAPSHOT_INVALID/);
 assert(drift.trace.includes('RC2:audit_events')&&!drift.trace.includes('RC2:commit'));
});

test('원 승인 백업 입장이 없거나 최종 정책이 바뀌면 수집 권위를 만들지 않는다',async()=>{
 for(const mode of ['unconfigured','policy-denied','policy-revoked','new-policy','body-only-admission','draft-only-admission']){
  const f=fixture(mode);
  await assert.rejects(f.run,/SNAPSHOT_(ADMISSION_|AUTH_CHANGED)/);
  assert(!f.trace.includes('RC2:document_versions'),mode);
  if(['unconfigured','policy-denied','body-only-admission','draft-only-admission'].includes(mode))assert(!f.trace.includes('RR:begin'),mode);
 }
});

test('교차 관계·스냅샷·회수 불명·권한 변경에서 수집 결과를 반환하지 않는다',async()=>{
 for(const mode of ['wrong-link','snapshot-changed','rollback-unknown','wrong-body','close-unknown','revoked','current-artifact-change']){
  const f=fixture(mode);
  await assert.rejects(f.run);
  assert.equal(f.trace.includes('RC2:commit'),false,mode);
  assert.equal(f.trace.filter(s=>s==='RR:rollback').length,1,mode);
  if(mode==='rollback-unknown')assert(f.trace.includes('RR:discard'));
  if(['wrong-link','snapshot-changed','rollback-unknown'].includes(mode))assert(!f.trace.includes('body:open'),mode);
  else assert.equal(f.trace.filter(s=>s==='body:close').length,1,mode);
 }
});
