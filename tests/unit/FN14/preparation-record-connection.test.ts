import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {buildApp} from '../../../apps/server/app.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {ProjectTransferPreparationRecords} from '../../../apps/server/modules/transfers/preparation-records.ts';

const id=(n:number)=>`ab140101-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),origin='https://anvil-synthetic.invalid';
/** 메모리 인증/PoolClient만 사용한다. Pool/소켓/파일/실DB를 만들지 않는다. */
function fixture(){
 const queries:{sql:string;values:unknown[]}[]=[],authenticated:{token:string;csrf:string|null}[]=[];
 const actor={actorId:uid,clientId:cid,credentialGeneration:1,authSession:{id:id(4),idleExpiresAt:'2098-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
 const db={async query(sql:string,values:unknown[]=[]){queries.push({sql,values});
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members m')){assert.deepEqual(values,[pid,uid]);return{rows:[{id:pid,archived_at:null,participation:'OWNER'}],rowCount:1};}
  if(sql.includes('FROM anvil.permission_policies p JOIN anvil.permission_policy_versions')){assert.deepEqual(values,[pid]);return{rows:[],rowCount:0};}
  throw Error('UNMODELED_SYNTHETIC_SQL');
 }} as unknown as PoolClient;
 const repository={
  async authenticated<T>(token:string,csrf:string|null,body:(db:PoolClient,actor:any)=>Promise<T>):Promise<T>{authenticated.push({token,csrf});if(token!=='synthetic-current-session')throw new AuthFailure('AUTH_REQUIRED',401);return await body(db,actor);},
  signProjectCursor(_value:string){throw Error('UNSELECTED_CURSOR_SIGNING');},
 };
 const app=buildApp({},undefined,{repository:repository as any,origin});
 return{app,db,queries,authenticated};
}

test('preparationConnection 실제 앱 고정GET은 기존 인증 경계에 연결되어 익명을 거절한다',async()=>{
 const f=fixture();try{
  // 실제 ProjectPolicyRepository.read까지 같은 메모리 인증/PoolClient로 도달한다.
  const baseline=await f.app.inject({method:'GET',url:`/api/v1/projects/${pid}/permission-policy`,headers:{host:'anvil-synthetic.invalid',cookie:'__Host-anvil.sid=synthetic-current-session'}});
  assert.equal(baseline.statusCode,200,baseline.body);assert.deepEqual(baseline.json(),{configured:false,policy:null});assert.equal(f.authenticated.length,1);assert.equal(f.queries.length,2);
  await assert.rejects(new ProjectTransferPreparationRecords().read('',pid,id(5),1),{message:'SOURCE_VERIFIER_NOT_CONNECTED',statusCode:412},'기본 미연결 공급자를 성공으로 바꾸지 않는다');
  const before=f.queries.length,path=`/api/v1/projects/${pid}/transfer-preparations/${id(5)}/versions/1`;
  const response=await f.app.inject({method:'GET',url:path,headers:{host:'anvil-synthetic.invalid'}});
  assert.equal(response.statusCode,401,'채택된 고정GET은 router의 미등록404가 아니라 현재 인증거절401이어야 한다: '+response.body);
  assert.equal(response.json().code,'AUTH_REQUIRED');assert.equal(f.queries.length,before,'익명 요청은 source/저장SQL0');assert.equal(response.headers['cache-control'],'no-store');
 }finally{await f.app.close();assert.equal(f.app.server.listening,false,'실listener 미생성/회수');}
});

import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {transferFixture} from '../UI09/transfer-fixture.ts';
import {ProjectAssignmentDrafts} from '../../../apps/server/modules/assignments/project-assignment-drafts.ts';
import {ProjectAssignmentConfirmations} from '../../../apps/server/modules/assignments/project-assignment-confirmations.ts';
import {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';
import {ProjectKnowledge} from '../../../apps/server/modules/knowledge/knowledge.ts';
import {ProjectConversations} from '../../../apps/server/modules/knowledge/conversations.ts';
import {ProjectContextSources} from '../../../apps/server/modules/context/context-sources.ts';
import {ProjectContexts} from '../../../apps/server/modules/context/project-contexts.ts';
import {ResponsibleSessions} from '../../../apps/server/modules/assignments/responsible-sessions.ts';
import {PreparationRecordSourceAdapter} from '../../../apps/server/modules/transfers/preparation-record-source-adapter.ts';
import {PreparationRecordVerifiers} from '../../../apps/server/modules/transfers/preparation-record-verifiers.ts';
import {preparationHash,readPreparationReceipt,type PreparationCommand} from '../../../apps/server/modules/transfers/preparation-record-input.ts';
const at='2026-10-31T02:00:00.000Z',hash=(v:unknown)=>contentHash(canonicalJson(v));type Row=Record<string,any>;
async function connectedFixture(artifactRoot?:string){
 const source=transferFixture(),tables={records:[] as Row[],versions:[] as Row[],commands:[] as Row[],receipts:[] as Row[],audits:[] as Row[]},trace:string[]=[];const draftsRows:Row[]=[],heads:Row[]=[],reviews:Row[]=[],confirmed:Row[]=[];const queries:{sql:string;p:any[]}[]=[];const bundles:Row[]=[],items:Row[]=[],roles:Row[]=[],bindings:Row[]=[],sessionsRows:Row[]=[],artifacts:Row[]=[],docsRows:Row[]=[],knowledgeRows:Row[]=[],knowledgeEvents:Row[]=[],messages:Row[]=[],conversationHeads:Row[]=[];const form={name:'합성 양식',items:[]};
 const control={now:new Date(at),transactionAt:new Date(at),member:true,owner:true,actorId:uid,clientId:cid,heldActorId:uid,heldClientId:cid,generation:1,auth:true,expires:'2099-01-01T00:00:00.000Z',write:'AUTO',read:'AUTO',sourceDenied:false,assignmentHead:source.confirmed.snapshot.draftRef,afterSourceLock:null as null|(()=>void),failure:'',commitLost:false,policyExpires:'2099-01-01T00:00:00.000Z',onPolicyRead:null as null|(()=>void),usageCount:null as string|null,usageBytes:null as string|null,onAssignmentRead:null as null|((n:number)=>void)};
 function rules(){return(['createTransferPreparationRecord','readTransferPreparationRecord'] as const).map((op,i)=>({ruleId:'R'+i,subjectRef:{kind:'HUMAN',userId:uid},operations:[op],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:i?control.read:control.write,limitPolicyRef:null,expiresAt:control.policyExpires}));}
 function policy(){const r=rules();return{id:id(3),head_version:1,rules_json:r,reason:'명시 합성 정책',review_refs:[],content_hash:hash({rules:r,reason:'명시 합성 정책',reviewRefs:[]}),created_at:new Date(at)};}
 const json=(v:unknown)=>JSON.parse(JSON.stringify(v));
 const db={query:async(sql:string,p:any[]=[])=>{queries.push({sql,p});trace.push(sql.split(/\s/).slice(0,4).join(' '));if(control.failure&&sql.includes(control.failure))throw Error('SYNTHETIC_FAILURE');


 const joined=(r:Row)=>{const c=tables.commands.find(c=>c.id===r.command_id)!;return {...r,result_ref:c.result_ref,operation:c.operation,state:c.state,expected_version:c.expected_version,command_actor:c.actor_id,command_client:c.client_id,command_key:c.command_id,command_external_id:c.command_id,server_command_id:c.id,request_hash:c.request_hash,control_generation:c.control_generation,operation_id:c.operation_id,authorization_receipt_id:c.authorization_receipt_id,approval_consumption_id:c.approval_consumption_id,policy_ref:c.policy_ref,payload_ref:c.payload_ref,receipt_rows:tables.receipts.filter(a=>a.command_id===c.id),audit_rows:tables.audits.filter(a=>a.command_id===c.id),approval_rows:[]};};
 if(sql.startsWith('SELECT application_version,application_hash,entry_id,version FROM anvil.project_constitutions'))return{rows:[]};
 if(sql.startsWith('INSERT INTO anvil.context_bundles')){bundles.push({project_id:p[0],id:p[1],version:1,assignment_id:p[2],assignment_version:p[3],assignment_hash:p[4],assignment_ref:JSON.parse(p[5]),baseline_refs:JSON.parse(p[6]),budget_ref:JSON.parse(p[7]),manifest_json:JSON.parse(p[8]),content_hash:p[9],created_by:p[10],client_id:p[11],command_id:p[12],request_payload:JSON.parse(p[13])});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.context_items')){items.push({project_id:p[0],bundle_id:p[1],item_id:p[2],category:p[3],required:true,source_ref:JSON.parse(p[4]),source_hash:p[5],included_state:p[6],reason:p[7],delivery_parts:JSON.parse(p[8]),issue:p[9]});return{rows:[]};}
 if(sql.startsWith('SELECT manifest_json,content_hash FROM anvil.context_bundles')||sql.startsWith('SELECT id FROM anvil.context_bundles'))return{rows:bundles.filter(r=>r.project_id===p[0]&&r.id===p[1]&&(p[2]===undefined||r.version===p[2]))};
 if(sql.includes('FROM anvil.context_bundles b JOIN anvil.commands'))return{rows:bundles.filter(r=>r.project_id===p[0]&&r.id===p[1]&&r.version===p[2]).map(r=>{const row=joined(r),ar=row.receipt_rows[0]!,a=row.audit_rows[0]!;return{...row,command_scope_kind:'PROJECT',command_scope_id:pid,authorization_subject_ref:ar.subject_ref,authorization_policy_ref:ar.policy_ref,authorization_approval_decision:ar.approval_decision_ref,audit_scope_digest:a.scope_digest,audit_outcome:a.outcome,audit_source_kind:a.source_kind,audit_approval_ref:a.approval_ref};})};
 if(sql.startsWith('SELECT item_id,category'))return{rows:items.filter(r=>r.project_id===p[0]&&r.bundle_id===p[1])};
 if(sql.startsWith('INSERT INTO anvil.project_roles')){roles.push({project_id:p[0],role_id:p[1],version:p[2],content_hash:p[3],snapshot_json:JSON.parse(p[4]),created_by:p[5],client_id:p[6],command_id:p[7]});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.agent_sessions')){sessionsRows.push({project_id:p[0],session_id:p[1],version:p[2],content_hash:p[3],snapshot_json:JSON.parse(p[4]),created_by:p[5],client_id:p[6],command_id:p[7]});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.role_bindings')){bindings.push({project_id:p[0],binding_id:p[1],version:p[2],role_id:p[3],session_id:p[4],content_hash:p[5],snapshot_json:JSON.parse(p[6]),created_by:p[7],client_id:p[8],command_id:p[9]});return{rows:[]};}
 if(sql.includes('FROM anvil.project_roles r'))return{rows:roles.filter(r=>r.project_id===p[0]&&(p[1]===undefined||r.role_id===p[1]&&r.version===p[2])).map(joined)};
 if(sql.startsWith('SELECT role_id FROM anvil.project_roles'))return{rows:roles.filter(r=>r.project_id===p[0]&&r.role_id===p[1])};
 if(sql.startsWith('SELECT binding_id,version,content_hash FROM anvil.role_bindings'))return{rows:bindings.filter(r=>r.project_id===p[0]&&r.role_id===p[1]&&canonicalJson(r.snapshot_json.assignmentRef)===p[2]&&canonicalJson(r.snapshot_json.roleRef)===p[3]).slice(0,1)};
 if(sql.startsWith('SELECT binding_id FROM anvil.role_bindings')){assert(sql.includes('version=$3'));assert(Number.isSafeInteger(p[2]));return{rows:bindings.filter(r=>r.project_id===p[0]&&r.binding_id===p[1]&&r.version===p[2])};}
 if(sql.includes('FROM anvil.role_bindings b LEFT'))return{rows:bindings.filter(r=>r.project_id===p[0]&&(sql.includes('b.binding_id=$2')?r.binding_id===p[1]&&r.version===p[2]:r.role_id===p[1])).sort((a,b)=>b.version-a.version).slice(0,1).map(joined)};
 if(sql.includes('FROM anvil.agent_sessions s LEFT'))return{rows:sessionsRows.filter(r=>r.project_id===p[0]&&r.session_id===p[1]&&r.version===p[2]).map(joined)};
 if(sql.startsWith('SELECT head_version FROM anvil.connection_candidates'))return{rows:[{head_version:1}]};
 if(sql.startsWith('SELECT * FROM anvil.artifacts'))return{rows:artifacts.filter(r=>r.id===p[0]&&r.project_id===p[1]&&r.content_hash===p[2]&&r.bytes===p[3]&&r.media_type===p[4])};
 if(sql.includes('FROM anvil.document_versions v JOIN anvil.documents'))return{rows:docsRows.filter(r=>r.project_id===p[0]&&r.document_id===p[1]&&r.version===p[2])};
 if(sql.startsWith('SELECT content_hash FROM anvil.document_versions'))return{rows:docsRows.filter(r=>r.project_id===p[0]&&r.document_id===p[1]&&r.version===p[2])};
 if(sql.startsWith('SELECT m.content_hash,m.kind,m.conversation_id'))return{rows:messages.filter(r=>r.project_id===p[0]&&r.id===p[1]&&r.conversation_id===p[2]).map(r=>({...r,superseded:false}))};
 if(sql.startsWith('SELECT definition_json FROM anvil.form_versions'))return{rows:p[2]===hash(form)?[{definition_json:form}]:[]};
 if(sql.includes('FROM anvil.document_content_reviews')||sql.includes('FROM anvil.document_version_events')||sql.includes('FROM anvil.document_import_selections')||sql.includes('FROM anvil.document_proposals'))return{rows:[]};
 if(sql.startsWith('SELECT id FROM anvil.documents'))return{rows:docsRows.filter(r=>r.project_id===p[0]&&r.document_id===p[1]).map(r=>({id:r.document_id}))};
 if(sql.includes('FROM anvil.knowledge_versions v JOIN anvil.knowledge_entries'))return{rows:knowledgeRows.filter(r=>r.project_id===p[0]&&r.entry_id===p[1]&&r.version===p[2])};
 if(sql.includes('FROM anvil.knowledge_events e JOIN'))return{rows:knowledgeEvents.filter(r=>r.project_id===p[0]&&r.entry_id===p[1]&&r.version===p[2])};
 if(sql.includes('FROM anvil.content_reviews'))return{rows:[]};
 if(sql.startsWith('SELECT id FROM anvil.knowledge_entries'))return{rows:knowledgeRows.filter(r=>r.project_id===p[0]&&r.entry_id===p[1]).map(r=>({id:r.entry_id}))};
 if(sql.startsWith('SELECT * FROM anvil.conversation_messages'))return{rows:messages.filter(r=>r.project_id===p[0]&&r.conversation_id===p[1]&&r.id===p[2])};
 if(sql.startsWith('SELECT id FROM anvil.conversation_messages'))return{rows:messages.filter(r=>r.project_id===p[0]&&r.id===p[1])};
 if(sql.startsWith('SELECT id FROM anvil.conversations'))return{rows:conversationHeads.filter(r=>r.project_id===p[0]&&r.id===p[1])};
 if(sql.startsWith('INSERT INTO anvil.assignment_drafts')){heads.push({project_id:p[0],id:p[1],head_version:1});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.assignment_draft_versions')){draftsRows.push({project_id:p[0],draft_id:p[1],version:p[2],content_hash:p[3],version_json:JSON.parse(p[4]),created_by:p[5],client_id:p[6],command_id:p[7]});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.assignment_content_reviews')){reviews.push({project_id:p[0],review_id:p[1],draft_id:p[2],draft_version:p[3],draft_hash:p[4],content_hash:p[5],review_json:JSON.parse(p[6]),created_by:p[7],client_id:p[8],command_id:p[9]});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.assignment_versions')){confirmed.push({project_id:p[0],assignment_id:p[1],version:p[2],content_hash:p[3],version_json:JSON.parse(p[4]),created_by:p[5],client_id:p[6],command_id:p[7],confirmation_id:p[8]});return{rows:[]};}
 if(sql.includes('FROM anvil.assignment_draft_versions v'))return{rows:draftsRows.filter(r=>r.project_id===p[0]&&r.draft_id===p[1]&&r.version===p[2]).map(r=>{const c=tables.commands.find(c=>c.id===r.command_id)!;return{...r,head_version:heads.find(h=>h.id===r.draft_id)?.head_version,result_ref:c.result_ref,operation:c.operation,state:c.state,expected_version:c.expected_version,command_actor:c.actor_id,command_client:c.client_id};})};
 if(sql.includes('FROM anvil.assignment_versions v'))return{rows:confirmed.filter(r=>r.project_id===p[0]&&r.assignment_id===p[1]&&r.version===p[2]).map(r=>{const c=tables.commands.find(c=>c.id===r.command_id)!;return{...r,result_ref:c.result_ref,operation:c.operation,state:c.state,expected_version:c.expected_version,command_actor:c.actor_id,command_client:c.client_id};})};
 if(sql.includes('FROM anvil.assignment_content_reviews r'))return{rows:reviews.filter(r=>r.project_id===p[0]&&(sql.includes('r.review_id=$2')?r.review_id===p[1]:r.draft_id===p[1]&&r.draft_version===p[2])).map(r=>{const c=tables.commands.find(c=>c.id===r.command_id)!,audit=tables.audits.find(a=>a.command_id===c.id)!;return{...r,draft_author:uid,result_ref:c.result_ref,operation:c.operation,state:c.state,expected_version:c.expected_version,command_actor:c.actor_id,command_client:c.client_id,server_sequence:audit.server_sequence};}).sort((a,b)=>b.server_sequence-a.server_sequence)};
 if(sql.startsWith('SELECT head_version FROM anvil.assignment_drafts'))return{rows:heads.filter(h=>h.project_id===p[0]&&h.id===p[1]).map(h=>({head_version:h.head_version}))};
 if(sql.startsWith('SELECT id FROM anvil.assignment_drafts')){control.afterSourceLock?.();return{rows:heads.filter(h=>h.project_id===p[0]&&h.id===p[1])};}
 if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date(control.now)}]};if(sql==='SELECT transaction_timestamp() AS at')return{rows:[{at:new Date(control.transactionAt)}]};
 if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:control.member?[{id:pid,archived_at:null,participation:control.owner?'OWNER':'VIEWER'}]:[]};
 if(sql.includes('FROM anvil.project_control'))return{rows:[{actor_id:control.heldActorId,client_id:control.heldClientId,generation:control.generation,revoked_at:null}]};
 if(sql.includes('FROM anvil.permission_policies')){control.onPolicyRead?.();return{rows:[policy()]};}
 if(sql.includes('FN14_COMMAND_KEY'))return{rows:tables.commands.filter(c=>c.project_id===p[0]&&c.actor_id===p[1]&&c.command_id===p[2])};
 if(sql.includes('FN14_RECORD_USAGE'))return{rows:[{record_count:control.usageCount??String(tables.records.length),version_count:control.usageCount??String(tables.versions.length),snapshot_bytes:control.usageBytes??String(tables.versions.reduce((n,v)=>n+Buffer.byteLength(canonicalJson(v.snapshot_json)),0))}]};
 if(sql.startsWith('INSERT INTO anvil.transfer_preparation_records')){tables.records.push({id:p[0],project_id:p[1],creator_user_id:p[2],creator_client_id:p[3],version:1,created_at:new Date(p[4])});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.commands')){tables.commands.push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],project_id:p[1],actor_id:p[2],client_id:p[3],operation:p[4],command_id:p[5],request_hash:p[6],operation_id:p[7],state:'APPLIED',authorization_receipt_id:p[8],approval_consumption_id:p[9],expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),payload_ref:p[13]===null?null:JSON.parse(p[13]),result_ref:JSON.parse(p[14]),received_at:new Date(control.transactionAt),completed_at:new Date(control.transactionAt)});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){tables.receipts.push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],command_id:p[2],subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6],authorized_at:new Date(control.transactionAt)});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.audit_events')){tables.audits.push({project_id:p[0],server_sequence:tables.audits.length+1,event_id:p[1],actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),policy_ref:JSON.parse(p[7]),approval_ref:p[8]===null?null:JSON.parse(p[8]),outcome:'APPLIED',reason_code:p[9],scope_digest:p[10],source_kind:'HUMAN_COMMAND',recorded_at:new Date(control.transactionAt)});return{rows:[]};}
 if(sql.startsWith('SELECT set_config('))return{rows:[]};
 if(sql.startsWith('INSERT INTO anvil.transfer_preparation_record_versions')){tables.versions.push({record_id:p[0],project_id:p[1],version:1,snapshot_json:JSON.parse(p[2]),content_hash:p[3],command_id:p[4],policy_ref_json:JSON.parse(p[5]),created_at:new Date(p[6])});return{rows:[]};}
 if(sql.includes('FN14_RECORD_READ'))return{rows:tables.records.filter(r=>r.project_id===p[0]&&r.id===p[1]&&r.creator_user_id===p[2]).map(r=>{const v=tables.versions.find(v=>v.record_id===r.id),c=tables.commands.find(c=>c.id===v?.command_id);return{...r,stored_version:v?.version,snapshot_json:v?.snapshot_json,content_hash:v?.content_hash,command_id:v?.command_id,policy_ref_json:v?.policy_ref_json,version_created_at:v?.created_at,command_row:json(c??null),receipt_rows:json(tables.receipts.filter(a=>a.command_id===v?.command_id)),audit_rows:json(tables.audits.filter(a=>a.command_id===v?.command_id))};})};
 throw Error('UNMODELED_SYNTHETIC_SQL');}} as unknown as PoolClient;
 const actor=():AuthenticatedIdentity=>({actorId:control.actorId,clientId:control.clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:id(4),idleExpiresAt:control.expires,absoluteExpiresAt:control.expires}});
 let commits=0,rollbacks=0;const access={authenticated:async<T>(token:string,csrf:string|null,work:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>):Promise<T>=>{if(!control.auth||token!=='SYNTHETIC'||csrf!==null&&csrf!=='SYNTHETIC_CSRF')throw new AuthFailure('AUTH_REQUIRED',401);trace.push('AUTH_PREFIX_LOCK');const before=structuredClone(tables);try{const result=await work(db,actor());for(const c of tables.commands.filter(c=>c.operation==='createTransferPreparationRecord')){const versions=tables.versions.filter(v=>v.command_id===c.id);assert.equal(versions.length,1);const v=versions[0]!,r=tables.records.find(r=>r.id===v.record_id);assert(r);assert.notEqual(c.id,c.command_id);assert.equal(tables.receipts.filter(a=>a.command_id===c.id).length,1);assert.equal(tables.audits.filter(a=>a.command_id===c.id).length,1);readPreparationReceipt(c.result_ref);assert.equal(preparationHash(v.snapshot_json),v.content_hash);}assert.equal(tables.records.length,tables.versions.length);for(const v of tables.versions){const c=tables.commands.find(c=>c.id===v.command_id),r=tables.records.find(r=>r.id===v.record_id);assert(c&&r);assert.equal(c.operation,'createTransferPreparationRecord');assert.equal(c.project_id,r.project_id);assert.equal(v.project_id,r.project_id);assert.equal(r.creator_user_id,c.actor_id);assert.equal(r.creator_client_id,c.client_id);assert.deepEqual(v.policy_ref_json,c.policy_ref);assert.equal(v.snapshot_json.id,r.id);assert.equal(v.snapshot_json.projectId,r.project_id);assert.equal(v.snapshot_json.version,1);assert.equal(v.content_hash,c.result_ref.data.ref.contentHash);}commits++;trace.push('COMMIT_CONFIRMED');if(control.commitLost)throw Object.assign(Error('SYNTHETIC_COMMIT_LOST'),{committed:true});return result;}catch(e){if(!(e as any).committed){Object.assign(tables,before);rollbacks++;trace.push('ROLLBACK');}throw e;}}};

 const basis=source.draft.snapshot.definition.taskRef,card={taskCode:basis.taskCode},designRef=basis.planRef;
 const plans={read:async()=>({ref:basis.planRef,relationalProjection:'STORED',designRef,tasks:[card]}),decision:async()=>({currentConfirmationValid:true})} as any;
 const methods={readApplication:async()=>({applicationRef:basis.applicationRef,snapshot:{graph:{nodes:[{nodeId:basis.nodeId,role:'STAGE_OWNER'}]}}})} as any;
 const drafts=new ProjectAssignmentDrafts(plans,methods),assignments=new ProjectAssignmentConfirmations(drafts),documents=new ProjectDocuments(artifactRoot);
 const knowledge=new ProjectKnowledge(documents),conversations=new ProjectConversations(documents),contexts=new ProjectContexts(new ProjectContextSources({confirmations:assignments,drafts,documents,knowledge,conversations}),assignments);
 const sessions=new ResponsibleSessions(methods,assignments,drafts,{read:async(_db:unknown,_actor:unknown,_pid:string,id:string,version:number)=>({ref:{id,version,contentHash:'c'.repeat(64)},expired:false,candidate:{kind:'CONNECTION_CANDIDATE'}})} as any);
 const adapter=new PreparationRecordSourceAdapter({assignments,drafts,contexts,sessions,documents,knowledge,conversations}),verifiers=new PreparationRecordVerifiers(adapter);
 const policyRef={id:id(3),version:1,contentHash:policy().content_hash},producer=(operation:string,payload:any,targetId:string|null=null,expectedVersion=0):any=>({schemaVersion:1,projectId:pid,commandId:crypto.randomUUID(),clientId:cid,controlGeneration:1,operation,targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload});
 const definition:any=structuredClone(source.draft.snapshot.definition);definition.baselineRefs=[designRef];definition.requiredCapabilities=['CODE'];definition.allowedScopes=[{sourceRootRef:designRef,mappingRef:null,observationRef:designRef,baselineRef:designRef,targets:[{relativePath:'src/unit.ts',kind:'FILE',access:'WRITE',recursive:false}]}] as any;
 const draft:any=await drafts.save(db,actor(),producer('prepareAssignment',{baseRef:null,definition,reason:'실제 임무 producer'}),policyRef);
 const draftRef=draft.data.ref;
 const review:any=await assignments.review(db,actor(),producer('reviewAssignmentContent',{draftRef,criteriaVersion:1,items:['PURPOSE_SCOPE','BASELINE_TASK','INPUT_OUTPUT','COMPLETION_VERIFICATION','BOUNDARIES','RECORD_RECOVERY'].map(criterionId=>({criterionId,outcome:'ACCEPTED',reason:'내용 확인',evidenceRefs:[]})),outcome:'ACCEPTED',reason:'실제 검토 producer'},draftRef.id,1),policyRef);
 const confirmation:any=await assignments.confirm(db,actor(),producer('confirmAssignment',{draftRef,reviewRefs:[review.data.ref],reason:'실제 확정 producer',acknowledged:true},draftRef.id,1),policyRef);
 Object.assign(source.confirmed,{projectId:pid,ref:confirmation.data.ref,snapshot:confirmation.data.snapshot,observedAt:at});
 control.assignmentHead=draftRef;
 const service=new ProjectTransferPreparationRecords({transport:'PROTECTED_SOURCE',access,verifiers});
 const command=():PreparationCommand=>({schemaVersion:1,projectId:pid,commandId:crypto.randomUUID(),clientId:cid,controlGeneration:1,operation:'createTransferPreparationRecord',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{assignmentRef:structuredClone(source.confirmed.ref),contextRef:null,roleRef:null,oldBindingRef:null,targetConnectionRef:null,intentExpiresAt:'2026-10-31T02:30:00.000Z',reason:'합성 보관'}});
 return{service,adapter,verifiers,access,db,actor,source,control,tables,trace,queries,heads,confirmed,draftsRows,bundles,items,roles,bindings,sessionsRows,artifacts,docsRows,knowledgeRows,knowledgeEvents,messages,conversationHeads,form,contexts,sessions,documents,knowledge,conversations,producer,policyRef,command,commits:()=>commits,rollbacks:()=>rollbacks,save:(c=command())=>service.command('SYNTHETIC','SYNTHETIC_CSRF',c)};
}
test('preparationConnection 실제 임무 생산→adapter 보호읽기→저장/GET/replay는 같은 db와 원증빙을 소비한다',async()=>{
 const f=await connectedFixture(),c=f.command(),r=await f.save(c);assert.equal(r.status,'APPLIED');assert.equal(f.tables.records.length,1);assert.equal(f.tables.versions.length,1);
 const read=await f.service.read('SYNTHETIC',pid,r.targetId);assert.deepEqual(read.record,r.data.record);assert.equal(read.currentStatus.usableForTransfer,false);
 const before=structuredClone(f.tables);assert.deepEqual(await f.save(c),r);assert.deepEqual(f.tables,before);assert.equal(f.commits(),3);
 assert(f.queries.some(q=>q.sql.includes('FROM anvil.assignment_versions v')));assert(f.queries.some(q=>q.sql.includes('FOR UPDATE OF p,m')));assert(f.queries.some(q=>q.sql==='SELECT id FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE'));
});

test('preparationConnection fresh만 현재 draft를 요구하고 역사/replay는 head·intent 진행 뒤에도 원증빙을 재검산한다',async()=>{
 const f=await connectedFixture(),c=f.command(),r=await f.save(c);f.heads[0]!.head_version=2;f.control.now=new Date('2026-11-01T02:00:00.000Z');
 const view=await f.service.read('SYNTHETIC',pid,r.targetId);assert.equal(view.currentStatus.intentExpired,true);assert.deepEqual(await f.save(c),r);
 await assert.rejects(f.save(f.command()),{message:'VERSION_CONFLICT',statusCode:409});assert.equal(f.tables.records.length,1);
 f.tables.commands.find(c=>c.operation==='confirmAssignment')!.result_ref.data.snapshot.reason='변조';await assert.rejects(f.service.read('SYNTHETIC',pid,r.targetId),{message:'PREPARATION_INTEGRITY_FAILED',statusCode:503});
});
test('preparationConnection 실제 맥락 producer의 불변 발견→선택잠금→보호 재읽기와 관계 불일치를 검사한다',async()=>{
 const f=await connectedFixture();const input={...f.source.context.manifest.preparationInput,assignmentRef:f.source.confirmed.ref};
 const context:any=await f.contexts.save(f.db,f.actor(),f.producer('buildTaskContext',input),f.policyRef),c=f.command();c.payload.contextRef=context.data.ref;
 const r=await f.save(c);assert.equal(r.data.record.contextRef.contentHash,context.data.ref.contentHash);assert.equal(r.data.record.sourceRefs.length,0);
 const discovery=f.queries.findIndex(q=>q.sql.startsWith('SELECT manifest_json')),locked=f.queries.findIndex((q,i)=>i>discovery&&q.sql.startsWith('SELECT id FROM anvil.context_bundles')),protectedRead=f.queries.findIndex((q,i)=>i>locked&&q.sql.includes('FROM anvil.context_bundles b JOIN'));
 assert(discovery>=0&&locked>discovery&&protectedRead>locked);f.bundles[0]!.content_hash='f'.repeat(64);await assert.rejects(f.service.read('SYNTHETIC',pid,r.targetId),{message:'PREPARATION_INTEGRITY_FAILED',statusCode:503});
});
test('preparationConnection 총괄 역할만으로 임무관계를 발명하지 않고 실제 보관 binding을 검산한다',async()=>{
 const f=await connectedFixture(),role:any=await f.sessions.define(f.db,f.actor(),f.producer('defineProjectRole',{kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'총괄 정의'}),f.policyRef),c=f.command();c.payload.roleRef=role.data.ref;
 await assert.rejects(f.save(c),{message:'SOURCE_VERIFIER_NOT_CONNECTED',statusCode:412});assert.equal(f.tables.records.length,0);
 const binding:any=await f.sessions.bind(f.db,f.actor(),f.producer('bindResponsibleSession',{assignmentRef:f.source.confirmed.ref,roleRef:role.data.ref,connectionRef:{id:id(55),version:1,contentHash:'c'.repeat(64)},existingSessionBindingRef:null,reason:'합성 후보 예약'}),f.policyRef);
 const r=await f.save(c);assert.deepEqual(r.data.record.roleRef,role.data.ref);const second=f.command();second.payload.roleRef=role.data.ref;second.payload.oldBindingRef=binding.data.ref;assert.equal((await f.save(second)).status,'APPLIED');
 f.sessionsRows[0]!.content_hash='f'.repeat(64);await assert.rejects(f.service.read('SYNTHETIC',pid,r.targetId),{message:'PREPARATION_INTEGRITY_FAILED',statusCode:503});
});
test('preparationConnection target는 후보/host alias 없이412이며 선택잠금 후 회수와 정책·COMMIT 불명은 저장성공으로 반환하지 않는다',async()=>{
 const f=await connectedFixture(),c=f.command();c.payload.targetConnectionRef={id:id(77),version:1,contentHash:'d'.repeat(64)};await assert.rejects(f.save(c),{message:'SOURCE_VERIFIER_NOT_CONNECTED',statusCode:412});assert.equal(f.tables.records.length,0);
 f.control.afterSourceLock=()=>{f.heads.length=0;};await assert.rejects(f.save(),{message:'NOT_FOUND',statusCode:404});assert.equal(f.tables.records.length,0);
 const g=await connectedFixture();g.control.commitLost=true;await assert.rejects(g.save(),{message:'PREPARATION_INTEGRITY_FAILED',statusCode:503});assert.equal(g.tables.records.length,1,'합성 COMMIT 뒤 응답유실은 새명령 자동전송/rollback성공으로 오인하지 않는다');
});

// 별도 사전등록한 합성 blob만 읽는 선택 실행이다. 기본 메모리 묶음은 이 QA를 실행/합격으로 세지 않는다.
const registeredQaRoot=process.env.ANVIL_FN14_SYNTHETIC_QA_ROOT;
if(registeredQaRoot!==undefined)test('preparationConnection 등록 원문3종 실제 ArtifactStore 보호읽기와 context 저장/격리거절',async()=>{
 const root='D:\\tmp\\anvil-v3-fn14-source-qa-20261101-01';assert.equal(registeredQaRoot,root);
 const {readFile,lstat,realpath}=await import('node:fs/promises');const {join}=await import('node:path');
 const expire=Date.parse('2026-10-31T16:48:42.1274710Z');assert(Date.now()<expire,'등록수명 만료시 읽기 실행0');
 const marker=await readFile(join(root,'owner.json'));assert.equal(contentHash(marker),'38b2eefaa722f2b236794f7646f631c509dd86d4de2cfe6c49f99c529ebaf99d');assert.equal((await lstat(root)).isSymbolicLink(),false);assert.equal(await realpath(root),root);
 const f=await connectedFixture(root),texts=['합성 문서 원문 — FN14 보호 조회 시험\n','합성 지식 원문 — FN14 보호 조회 시험\n','합성 사용자 지시 — FN14 보호 조회 시험\n'];
 const bodyRefs=[];for(const [i,text]of texts.entries()){const artifactId=id(90+i),bytes=Buffer.from(text),path=join(root,'blobs',pid,artifactId),stat=await lstat(path);assert(!stat.isSymbolicLink()&&stat.isFile());assert.equal(await realpath(path),path);assert.deepEqual(await readFile(path),bytes);const ref={artifactId,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain;charset=utf-8'};bodyRefs.push(ref);f.artifacts.push({id:artifactId,project_id:pid,bytes:ref.bytes,content_hash:ref.contentHash,media_type:ref.mediaType,storage_key:`blobs/${pid}/${artifactId}`,state:'READY'});}
 // 합성 DB 저장원형이며 실제 producer 이력으로 가장하지 않는다. 각 실제 보호 reader의 hash/본문/관계 검산을 소비한다.
 const formRef={id:id(80),version:1,contentHash:hash(f.form)},content={body:bodyRefs[0]!,attachments:[],sections:[],sourceRefs:[]},documentRef={id:id(81),version:1,contentHash:hash({title:'합성 문서',formRef,stageNodeRef:null,content})};
 f.docsRows.push({project_id:pid,document_id:documentRef.id,version:1,title:'합성 문서',form_definition_id:formRef.id,form_version:1,form_hash:formRef.contentHash,content_json:content,content_hash:documentRef.contentHash,stage_ref_json:null,confirmed_version:null,source_refs_json:[],author_ref_json:{kind:'HUMAN',userId:uid},created_at:new Date(at),validation_json:{validForConfirmation:false,issues:[]}});
 const entry={kind:'FACT',title:'합성 지식',contentRef:bodyRefs[1]!,sourceRefs:[],reason:'원문 보호 읽기',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]},knowledgeRef={id:id(82),version:1,contentHash:hash(entry)},knowledgeResult={status:'APPLIED',projectId:pid,targetId:knowledgeRef.id,version:1,data:{ref:knowledgeRef,status:'PROPOSED',entry}};
 f.knowledgeRows.push({project_id:pid,entry_id:knowledgeRef.id,version:1,title:entry.title,kind:entry.kind,head_version:1,entry_json:entry,content_hash:knowledgeRef.contentHash,content_artifact_id:entry.contentRef.artifactId,source_refs:[],reason:entry.reason,scope_json:entry.scope,related_refs:[],created_by:uid});
 f.knowledgeEvents.push({project_id:pid,entry_id:knowledgeRef.id,version:1,id:id(83),kind:'PROPOSED',reason:entry.reason,actor_ref:{kind:'HUMAN',userId:uid},recorded_at:new Date(at),base_ref:null,change_sources:null,review_refs:null,command_actor_id:uid,command_operation:'saveKnowledge',command_result:knowledgeResult});
 const conversationId=id(84),message={kind:'USER_INSTRUCTION',bodyRef:bodyRefs[2]!,attachmentRefs:[],replyTo:null,supersedesInstructionRef:null,effectiveScope:{projectId:pid,stageRefs:[],taskRefs:[]}},snapshot={conversationId,targetRoleRef:null,message,sourceRefs:[],serverSequence:1,authorRef:{kind:'HUMAN',userId:uid}},messageRef={kind:'CONVERSATION' as const,id:id(85),contentHash:hash(snapshot)};
 f.messages.push({project_id:pid,conversation_id:conversationId,id:messageRef.id,sequence:1,message_json:snapshot,author_ref:snapshot.authorRef,kind:'USER_INSTRUCTION',body_artifact_id:bodyRefs[2]!.artifactId,reply_to:null,supersedes_instruction_id:null,effective_scope:message.effectiveScope,source_refs:[],content_hash:messageRef.contentHash,redaction_state:'NOT_REDACTED',recorded_at:new Date(at)});f.conversationHeads.push({project_id:pid,id:conversationId});
 const sources=[{kind:'DOCUMENT_VERSION' as const,ref:documentRef,conversationId:null},{kind:'KNOWLEDGE_VERSION' as const,ref:knowledgeRef,conversationId:null},{kind:'USER_INSTRUCTION' as const,ref:messageRef,conversationId}];
 for(const source of sources)assert.deepEqual(await f.adapter.source({db:f.db,actor:f.actor(),projectId:pid},source),{projectId:pid,source});
 const input=structuredClone(f.source.context.manifest.preparationInput);input.assignmentRef=f.source.confirmed.ref;input.slots.find(s=>s.code==='CURRENT_POSITION')!.sources=[{kind:'DOCUMENT_VERSION',versionRef:documentRef},{kind:'KNOWLEDGE_VERSION',versionRef:knowledgeRef}];input.slots.find(s=>s.code==='LATEST_INSTRUCTIONS')!.sources=[{kind:'USER_INSTRUCTION',messageRef,conversationId}];
 const context:any=await f.contexts.save(f.db,f.actor(),f.producer('buildTaskContext',input),f.policyRef),c=f.command();c.payload.contextRef=context.data.ref;const saved=await f.save(c);assert.deepEqual(saved.data.record.sourceRefs,[sources[2],sources[0],sources[1]]);assert.equal(saved.data.record.executionAuthorized,false);
 f.artifacts[0]!.state='QUARANTINED';await assert.rejects(f.service.read('SYNTHETIC',pid,saved.targetId),{message:'NOT_FOUND',statusCode:404});assert.equal(f.tables.records.length,1);assert(Date.now()<expire);assert.equal(contentHash(await readFile(join(root,'owner.json'))),contentHash(marker));
});

test('preparationConnection 현재 보호의 새 client 역사GET·OWNER/작성자/기한·AUTO 한정과429 rollback을 보존한다',async()=>{
 const f=await connectedFixture(),r=await f.save();f.control.clientId=id(44);assert.equal((await f.service.read('SYNTHETIC',pid,r.targetId)).ref.contentHash,r.data.ref.contentHash);
 f.control.owner=false;await assert.rejects(f.service.read('SYNTHETIC',pid,r.targetId),{message:'NOT_FOUND',statusCode:404});f.control.owner=true;
 f.control.actorId=id(45);await assert.rejects(f.service.read('SYNTHETIC',pid,r.targetId),{message:'PROJECT_OPERATION_DENIED',statusCode:403});f.control.actorId=uid;
 f.control.expires=at;await assert.rejects(f.service.read('SYNTHETIC',pid,r.targetId),{message:'AUTH_REQUIRED',statusCode:401});
 for(const disposition of ['DENY','REQUIRE_APPROVAL']){const g=await connectedFixture();g.control.write=disposition;await assert.rejects(g.save(),{message:disposition==='DENY'?'PROJECT_OPERATION_DENIED':'PREPARATION_APPROVAL_NOT_CONNECTED',statusCode:disposition==='DENY'?403:412});assert.equal(g.tables.records.length,0);}
 for(const cap of ['rows','bytes']){const g=await connectedFixture();if(cap==='rows')g.control.usageCount='10000';else g.control.usageBytes='1073741824';const before=structuredClone(g.tables);await assert.rejects(g.save(),{message:'TRANSFER_PREPARATION_STORAGE_LIMIT',statusCode:429});assert.deepEqual(g.tables,before);assert.equal(g.rollbacks(),1);}
});
test('preparationConnection 실제 앱 fixedGET 정상·raw query거절·POST route는 기존인증Tx를한번만소비한다',async()=>{
 const f=await connectedFixture(),r=await f.save(),seen:string[]=[];
 const access={...f.access,signProjectCursor:()=>{throw Error('UNSELECTED_SIGNER');},authenticated:async<T>(t:string,csrf:string|null,fn:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>)=>{seen.push(t);return f.access.authenticated(t,csrf,fn);}};
 const app=buildApp({},undefined,{repository:access as any,origin});try{
  const url=`/api/v1/projects/${pid}/transfer-preparations/${r.targetId}/versions/1`,headers={host:'anvil-synthetic.invalid',cookie:'__Host-anvil.sid=SYNTHETIC'};
  const view=await app.inject({method:'GET',url,headers});assert.equal(view.statusCode,200,view.body);assert.equal(view.json().ref.contentHash,r.data.ref.contentHash);assert.equal(seen.length,1);
  for(const query of ['?cursor=x','?x=1&x=2']){const n:number=seen.length,result=await app.inject({method:'GET',url:url+query,headers});assert.equal(result.statusCode,400);assert.equal(seen.length,n);}
  const n:number=seen.length,response=await app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{host:'anvil-synthetic.invalid',origin,'content-type':'application/json','x-anvil-csrf':'s'.repeat(43)},payload:f.command()});assert.equal(response.statusCode,401,response.body);assert.equal(seen.length,n+1);assert.equal(f.tables.records.length,1);
 }finally{await app.close();assert.equal(app.server.listening,false);}
});

test('preparationConnection 단계 역할도 실제 총괄부모/단계정의/임무 binding 증빙을 거쳐 저장한다',async()=>{
 const f=await connectedFixture(),parent:any=await f.sessions.define(f.db,f.actor(),f.producer('defineProjectRole',{kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'총괄 원정의'}),f.policyRef);
 const task=f.source.confirmed.snapshot.definition.taskRef,role:any=await f.sessions.define(f.db,f.actor(),f.producer('defineProjectRole',{kind:'STAGE_OWNER',stageRef:{applicationRef:task.applicationRef,nodeId:task.nodeId},parentRoleRef:parent.data.ref,reason:'실제 단계 정의'}),f.policyRef);
 const binding:any=await f.sessions.bind(f.db,f.actor(),f.producer('bindResponsibleSession',{assignmentRef:f.source.confirmed.ref,roleRef:role.data.ref,connectionRef:{id:id(55),version:1,contentHash:'c'.repeat(64)},existingSessionBindingRef:null,reason:'단계 예약'}),f.policyRef);
 const c=f.command();c.payload.roleRef=role.data.ref;c.payload.oldBindingRef=binding.data.ref;const stored=await f.save(c);assert.deepEqual(stored.data.record.roleRef,role.data.ref);assert.deepEqual(stored.data.record.oldBindingRef,binding.data.ref);assert.equal(stored.data.record.resumeAuthorized,false);
 f.tables.audits.splice(f.tables.audits.findIndex(a=>a.command_id===f.bindings[0]!.command_id),1);await assert.rejects(f.service.read('SYNTHETIC',pid,stored.targetId),{message:'PREPARATION_INTEGRITY_FAILED',statusCode:503});
});
