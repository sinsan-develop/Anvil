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
 const repository={installationId:'ab140101-0000-4000-8000-000000009999',
  async authenticated<T>(token:string,csrf:string|null,body:(db:PoolClient,actor:any)=>Promise<T>):Promise<T>{authenticated.push({token,csrf});if(token!=='synthetic-current-session')throw new AuthFailure('AUTH_REQUIRED',401);return await body(db,actor);},
  signProjectCursor(_value:string){throw Error('UNSELECTED_CURSOR_SIGNING');},
 };
 const app=buildApp({},undefined,{repository:repository as any,origin});
 return{app,db,queries,authenticated};
}

test('v2 보고 고정GET은 실제 app의 현재 인증 경계에 연결되어 익명을401로 거절한다',async()=>{
 const f=fixture();try{const headers={host:'anvil-synthetic.invalid',cookie:'__Host-anvil.sid=synthetic-current-session'};
 const baseline=await f.app.inject({method:'GET',url:`/api/v1/projects/${pid}/permission-policy`,headers});assert.equal(baseline.statusCode,200,baseline.body);assert.deepEqual(baseline.json(),{configured:false,policy:null});assert.equal(f.queries.length,2);
 const before=f.queries.length,response=await f.app.inject({method:'GET',url:`/api/v1/projects/${pid}/definition-capability-reports/${id(5)}/versions/1`,headers:{host:'anvil-synthetic.invalid'}});
 assert.equal(response.statusCode,401,'기존 보호GET은 미등록404가 아닌 인증401이어야 한다: '+response.body);assert.equal(response.json().code,'AUTH_REQUIRED');assert.equal(f.queries.length,before,'익명 원문SQL0');
 }finally{await f.app.close();assert.equal(f.app.server.listening,false);}
});


test('v2 유한 목록은 새 API 인증 경계에 연결되며 익명 목록SQL은 없다',async()=>{
 const f=fixture();try{const response=await f.app.inject({method:'GET',url:`/api/v1/projects/${pid}/definition-capability-reports?view=REGISTERED_DEFINITION_HUMAN_REPORTS&limit=20`,headers:{host:'anvil-synthetic.invalid'}});assert.equal(response.statusCode,401,response.body);assert.equal(response.json().code,'AUTH_REQUIRED');assert.equal(f.queries.length,0);}finally{await f.app.close();assert.equal(f.app.server.listening,false);}
});

import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ProjectConnectionDefinitions} from '../../../apps/server/modules/connections/project-connection-definitions.ts';
import {definitionHash} from '../../../apps/server/modules/connections/connection-definition-input.ts';
import {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';
import {ProjectDefinitionCapabilityReports} from '../../../apps/server/modules/connections/project-definition-capability-reports.ts';
import {readDefinitionCapabilityReportClaim} from '../../../apps/server/modules/connections/definition-capability-report-input.ts';
const H=(v:unknown)=>contentHash(canonicalJson(v));
function storeFixture(){
 const approvals:any[]=[],decisions:any[]=[],consumptions:any[]=[],notifications:any[]=[];
 const rows:any[]=[],heads:any[]=[],commands:any[]=[],receipts:any[]=[],audits:any[]=[],queries:{sql:string;p:any[]}[]=[];
 const actor:any={actorId:uid,clientId:cid,reauthUntil:new Date('2099-01-01T00:00:00.000Z'),authSession:{id:id(4),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
 const mode={member:true,owner:true,held:true,write:'AUTO',read:'AUTO',coverage:'VERIFIED',used:'0',heldBytes:'0',commitLost:false},at=new Date();
 function policy(){const rules=['registerConnection','readConnectionDefinition','requestApproval','decideApproval','recordCapabilityReport'].map((op,n)=>({ruleId:'R'+n,subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:[op],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:['registerConnection','recordCapabilityReport'].includes(op)?mode.write:mode.read,limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}));return{id:id(9),head_version:1,rules_json:rules,content_hash:definitionHash({rules,reason:'정의 정책',reviewRefs:[]}),reason:'정의 정책',review_refs:[],created_at:at};}
 const db:any={async query(sql:string,p:any[]=[]){queries.push({sql,p});
 if(sql.includes('FROM anvil.projects p JOIN anvil.project_members m'))return{rows:mode.member&&p[0]===pid?[{id:pid,archived_at:null,participation:mode.owner?'OWNER':'VIEWER'}]:[]};
 if(sql==='SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE')return{rows:mode.held?[{actor_id:uid,client_id:cid,generation:1,revoked_at:null}]:[]};
 if(sql.includes('FROM anvil.permission_policies p JOIN anvil.permission_policy_versions'))return{rows:[policy()]};
 if(sql==='SELECT clock_timestamp() AS at'||sql==='SELECT clock_timestamp() at')return{rows:[{at:new Date()}]};if(sql==='SELECT transaction_timestamp() AS at'||sql==='SELECT transaction_timestamp() at')return{rows:[{at}]};
 if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return{rows:commands.filter(r=>r.project_id===p[0]&&r.actor_id===p[1]&&r.command_id===p[2])};
 if(sql==='SELECT * FROM anvil.environment_configuration_account($1,$2,$3,$4)'){assert.deepEqual(p,[actor.authSession.id,actor.actorId,actor.clientId,pid]);return{rows:[{coverage_state:mode.coverage,generation:'1',used_bytes:mode.used,held_bytes:mode.heldBytes,complete:false,environment_heads:'0',environment_versions:'0',environment_bytes:'0',definition_bytes:String(rows.reduce((n,r)=>n+BigInt(r.canonical_bytes),0n)),report_bytes:'0',approval_candidates:'0',approval_bytes:'0'}]};} // 환경0의 기존 writer가 자신의 원형/원장을 계속 검산한다.
 if(sql.startsWith('SELECT * FROM anvil.quota_account'))return{rows:[{coverage_state:mode.coverage,used_bytes:mode.used,held_bytes:mode.heldBytes}]};
 if(sql==='SELECT id FROM anvil.agent_connections WHERE project_id=$1 AND id=$2')return{rows:heads.filter(r=>r.project_id===p[0]&&r.id===p[1])};
 if(sql.startsWith('SELECT v.definition_json'))return{rows:rows.filter(r=>r.project_id===p[0]).map(r=>({...r,head_id:r.connection_id,head_version:1}))};
 if(sql.startsWith('INSERT INTO anvil.commands')){commands.push({scope_kind:'PROJECT',scope_id:p[1],id:p[0],project_id:p[1],actor_id:p[2],client_id:p[3],operation:p[4],command_id:p[5],request_hash:p[6],operation_id:p[7],authorization_receipt_id:p[8],approval_consumption_id:p[9],expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),payload_ref:p[13]?JSON.parse(p[13]):null,result_ref:JSON.parse(p[14]),state:'APPLIED'});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){receipts.push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],command_id:p[2],subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6]});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.audit_events')){audits.push({project_id:p[0],event_id:p[1],actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),policy_ref:JSON.parse(p[7]),approval_ref:p[8]?JSON.parse(p[8]):null,outcome:'APPLIED',reason_code:p[9],scope_digest:p[10],source_kind:'HUMAN_COMMAND'});return{rows:[]};}
 if(sql.startsWith('SELECT set_config'))return{rows:[]};
 if(sql.startsWith('INSERT INTO anvil.agent_connections')){heads.push({id:p[0],project_id:p[1],head_version:1,created_by:p[2]});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.connection_definition_versions')){rows.push({project_id:p[0],connection_id:p[1],version:1,definition_json:JSON.parse(p[2]),canonical_json:p[3],content_hash:p[4],canonical_bytes:p[5],created_by:p[6],client_id:p[7],command_id:p[8],request_json:JSON.parse(p[9])});return{rows:[]};}
 if(sql.startsWith('SELECT v.*'))return{rows:rows.filter(r=>r.project_id===p[0]&&r.connection_id===p[1]&&r.version===p[2]).map(r=>{const c=commands.find(c=>c.id===r.command_id);return{...r,head_version:1,...c,command_id:r.command_id,command_actor:c.actor_id,command_client:c.client_id,external_command_id:c.command_id,command_operation_id:c.operation_id};})};
 if(sql.startsWith('SELECT * FROM anvil.authorization_receipts'))return{rows:receipts.filter(r=>r.command_id===p[0])};
 if(sql.startsWith('SELECT * FROM anvil.audit_events'))return{rows:audits.filter(r=>r.project_id===p[0]&&r.command_id===p[1])};
 if(sql==='SELECT actor_id,client_id,generation,revoked_at FROM anvil.project_control WHERE project_id=$1')return{rows:[{actor_id:uid,client_id:cid,generation:1,revoked_at:null}]};
 if(sql.startsWith('SELECT 1 FROM anvil.approval_requests')){const a=approvals.filter(r=>r.project_id===p[0]&&r.candidate_command_id===p[1]);return{rows:a,rowCount:a.length};}
 if(sql.startsWith('SELECT 1 FROM anvil.commands')){const a=commands.filter(r=>r.project_id===p[0]&&r.actor_id===p[1]&&r.command_id===p[2]);return{rows:a,rowCount:a.length};}
 if(sql.startsWith('INSERT INTO anvil.approval_requests')){approvals.push({id:p[0],project_id:p[1],version:1,candidate_command_id:p[2],action_scope_json:JSON.parse(p[3]),scope_digest:p[4],details_json:JSON.parse(p[5]),required_decider_ref:JSON.parse(p[6]),status:'PENDING',expires_at:new Date(p[7]),created_by:p[8],client_id:p[9],command_id:p[10],policy_ref:JSON.parse(p[11]),content_hash:p[12],request_json:JSON.parse(p[13]),created_at:new Date(p[14])});return{rows:[],rowCount:1};}
 if(sql.startsWith('SELECT r.*,c.operation'))return{rows:approvals.filter(r=>r.project_id===p[0]&&r.id===p[1]).map(r=>{const c=commands.find(c=>c.id===r.command_id);return{...r,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,result_ref:c.result_ref};})};
 if(sql.startsWith('SELECT d.*,c.operation'))return{rows:decisions.filter(r=>r.project_id===p[0]&&r.request_id===p[1]).map(r=>{const c=commands.find(c=>c.id===r.command_id);return{...r,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,expected_version:c.expected_version,result_ref:c.result_ref};})};
 if(sql.startsWith('SELECT ac.*,c.command_id'))return{rows:consumptions.filter(r=>r.project_id===p[0]&&r.decision_id===p[1]).map(r=>{const c=commands.find(c=>c.id===r.command_id),ar=receipts.find(a=>a.command_id===c.id);return{...r,candidate_command_id:c.command_id,request_hash:c.request_hash,actor_id:c.actor_id,client_id:c.client_id,control_generation:c.control_generation,policy_ref:c.policy_ref,payload_ref:c.payload_ref,state:c.state,result_ref:c.result_ref,operation:c.operation,expected_version:c.expected_version,approval_consumption_id:c.approval_consumption_id,approval_decision_ref:ar.approval_decision_ref};})};
 if(sql.startsWith('INSERT INTO anvil.approval_decisions')){decisions.push({id:p[0],project_id:p[1],request_id:p[2],request_version:p[3],scope_digest:p[4],decision:p[5],reason:p[6],decided_by:p[7],client_id:p[8],control_generation:p[9],decided_at:new Date(p[10]),command_id:p[11],content_hash:p[12],decision_json:JSON.parse(p[13])});return{rows:[],rowCount:1};}
 if(sql.startsWith('INSERT INTO anvil.approval_consumptions')){consumptions.push({id:p[0],project_id:p[1],decision_id:p[2],command_id:p[3],scope_digest:p[4],policy_id:p[5],policy_version:p[6],consumed_at:new Date()});return{rows:[],rowCount:1};}
 if(sql.startsWith('UPDATE anvil.approval_requests SET status=')){const r=approvals.find(r=>r.project_id===p[0]&&r.id===p[1]);if(!r)return{rows:[],rowCount:0};if(sql.includes("version=3")){assert.equal(r.version,2);assert.equal(r.status,'APPROVED');r.status='CONSUMED';r.version=3;}else{assert.equal(r.version,p[3]);assert.equal(r.status,'PENDING');r.status=p[2];r.version++;}return{rows:[],rowCount:1};}
 if(sql==='SELECT anvil.assert_approval_notification_capacity($1)'){assert.deepEqual(p,[pid]);return{rows:[{assert_approval_notification_capacity:null}]};}
 if(sql.startsWith('INSERT INTO anvil.notifications')){notifications.push(p);return{rows:[],rowCount:1};}
 throw Error('미모델 SQL '+sql);
 }};
 const access:any={async authenticated(_token:string,_csrf:string|null,fn:any){const lengths=[rows.length,heads.length,commands.length,receipts.length,audits.length];try{const result=await fn(db,actor);if(mode.commitLost){mode.commitLost=false;throw new Error('SYNTHETIC_COMMIT_UNKNOWN');}return result;}catch(e){if(!(e instanceof Error&&e.message==='SYNTHETIC_COMMIT_UNKNOWN'))[rows,heads,commands,receipts,audits].forEach((a,i)=>a.length=lengths[i]!);throw e;}}};
 function payload(){const pv=policy();return{definition:{label:'명시 연결',toolProduct:'Claude',toolVersion:'2.1.224',adapterKind:'SDK_OBJECT',connectorId:null,accountRef:null,modelOptions:{model:'auto'},environmentRef:null,policyRef:{id:pv.id,version:1,contentHash:pv.content_hash},capabilityReportRef:null},reason:'미확인 설정 저장'};}
 function command(n=50):any{return{schemaVersion:1,projectId:pid,commandId:id(n),clientId:cid,controlGeneration:1,operation:'registerConnection',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:payload()};}
 return{access,store:new ProjectConnectionDefinitions(access),mode,actor,db,rows,heads,commands,receipts,audits,queries,payload,command,approvals,decisions,consumptions,notifications,policy};
}
async function reportFixture(artifactRoot?:string){
 const f=storeFixture(),reports:any[]=[],evidence:any[]=[],artifacts:any[]=[],sqls:string[]=[];const original=f.db.query.bind(f.db),denials:any[]=[];
 f.db.query=async(sql:string,p:any[]=[])=>{sqls.push(sql);
  if(sql==='SELECT * FROM anvil.environment_configuration_account($1,$2,$3,$4)'){const value=await original(sql,p);value.rows[0].report_bytes=String(reports.reduce((n,r)=>n+BigInt(r.canonical_bytes),0n));return value;}
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")){assert.equal(p.length,6);assert.equal(p[0],pid);denials.push({reason:p[5],actor:JSON.parse(p[2]),client:p[3]});return{rows:[]};}
  if(sql==='SELECT canonical_bytes FROM anvil.definition_capability_reports WHERE project_id=$1 ORDER BY id')return{rows:reports.map(r=>({canonical_bytes:r.canonical_bytes}))};
  if(sql==='SELECT id,canonical_bytes FROM anvil.definition_capability_reports WHERE project_id=$1 ORDER BY id')return{rows:reports.map(r=>({id:r.id,canonical_bytes:r.canonical_bytes}))};
  if(sql==='SELECT connection_id,version,canonical_bytes FROM anvil.connection_definition_versions WHERE project_id=$1 ORDER BY connection_id,version')return{rows:f.rows.map(r=>({connection_id:r.connection_id,version:r.version,canonical_bytes:r.canonical_bytes}))};
  if(sql==='SELECT head_version FROM anvil.agent_connections WHERE project_id=$1 AND id=$2')return{rows:f.heads.filter(r=>r.project_id===p[0]&&r.id===p[1]).map(r=>({head_version:r.head_version}))};
  if(sql.startsWith('SELECT * FROM anvil.definition_capability_reports'))return{rows:reports.filter(r=>r.project_id===p[0]&&r.id===p[1])};
  if(sql.startsWith('SELECT *,to_char(created_at')){const selected=p[1];return{rows:reports.filter(r=>r.project_id===p[0]&&(!selected||r.connection_id===selected&&r.connection_version===p[2]&&r.connection_hash===p[3])).sort((a,b)=>b.created_at.getTime()-a.created_at.getTime()||b.id.localeCompare(a.id)).filter(r=>!p[4]||r.created_at.toISOString()<p[4]||r.created_at.toISOString()===p[4]&&r.id<p[5]).slice(0,21).map(r=>({...r,cursor_at:r.created_at.toISOString().replace('Z','000Z')}))};}
  if(sql.startsWith('SELECT project_id,report_id'))return{rows:evidence.filter(r=>r.project_id===p[0]&&r.report_id===p[1])};
  if(sql==='SELECT * FROM anvil.commands WHERE project_id=$1 AND id=$2')return{rows:f.commands.filter(r=>r.project_id===p[0]&&r.id===p[1])};
  if(sql==='SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2 AND content_hash=$3 AND bytes=$4 AND media_type=$5')return{rows:artifacts.filter(r=>r.id===p[0]&&r.project_id===p[1]&&r.content_hash===p[2]&&r.bytes===p[3]&&r.media_type===p[4])};
  if(sql.startsWith('SELECT id,project_id,state'))return{rows:artifacts.filter(r=>r.project_id===p[0]&&r.id===p[1])};
  if(sql.startsWith('INSERT INTO anvil.definition_capability_reports')){reports.push({id:p[0],project_id:p[1],version:1,connection_id:p[2],connection_version:p[3],connection_hash:p[4],environment_id:p[5],environment_version:p[6],environment_hash:p[7],claim_json:JSON.parse(p[8]),claim_hash:p[9],snapshot_json:JSON.parse(p[10]),content_hash:p[11],supersedes_id:p[12],supersedes_version:p[13],supersedes_hash:p[14],created_by:p[15],client_id:p[16],command_id:p[17],created_at:p[18],request_json:JSON.parse(p[19]),canonical_bytes:p[20]});return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.definition_capability_report_evidence')){evidence.push({project_id:p[0],report_id:p[1],report_version:1,capability_code:p[2],artifact_id:p[3],artifact_hash:p[4],bytes:p[5],media_type:p[6]});return{rows:[]};}
  return original(sql,p);
 };
 const definition:any=await f.store.command('token','csrf',f.command());
 const codes=['INSTRUCTION_SESSION','STATE_ORIGINAL','RESULT_EVIDENCE','TOOL_APPROVAL','STOP_RECLAIM','PATH_WRITE_CONTROL'];
 const claim={schemaVersion:2,connectionRef:definition.data.ref,environmentRef:null,tool:{product:'Claude',version:'2.1.224',adapterVersion:'human-version'},observedAt:null,expiresAt:new Date(Date.now()+600000).toISOString(),supersedesRef:null,capabilities:codes.map(code=>({code,documentation:null,submittedMeasurementState:'VERIFIED',requestedControlLevel:'DIRECT',evidenceRefs:[],limitations:'사람의 주장만 보존'})),reason:'명시 정의 보고'};
 const request:any={schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:cid,controlGeneration:1,operation:'recordCapabilityReport',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:claim};
 const access:any={authenticated:async(t:string,c:string|null,body:any)=>{const before=[reports.length,evidence.length];try{return await f.access.authenticated(t,c,body);}catch(e){reports.length=before[0]!;evidence.length=before[1]!;throw e;}}};
 const store=new ProjectDefinitionCapabilityReports(access,f.store,new ProjectDocuments(artifactRoot));
 return{...f,reports,evidence,artifacts,sqls,definition,request,claim,store,definitionStore:f.store};
}
test('실제 정의 producer/보호reader→v2 저장→고정GET→exact replay는 설정 원형과 false 권위를 보존한다',async()=>{
 const f=await reportFixture(),original=canonicalJson(f.definition.data.definition),r:any=await f.store.command('t','c',f.request);assert.equal(r.status,'APPLIED');assert.equal(r.data.snapshot.schemaVersion,2);assert.equal(r.data.snapshot.bindingKind,'REGISTERED_DEFINITION_ONLY');assert.equal(r.data.snapshot.claim.environmentRef,null);assert(r.data.snapshot.capabilities.every((c:any)=>c.measurement.state==='UNVERIFIED'&&c.controlLevel==='UNVERIFIED'));assert.equal(r.data.effectiveForExecution,false);assert.equal(r.data.dispatchPerformed,false);
 const view=await f.store.read(f.db,f.actor,pid,r.data.ref.id,1);assert.deepEqual(view.currentnessIssues.map(i=>i.code),['REGISTERED_DEFINITION_ONLY','HUMAN_CLAIM_UNVERIFIED','ENVIRONMENT_NOT_DEFINED']);assert.deepEqual(await f.store.command('t','c',f.request),r);assert.equal(f.reports.length,1);assert.equal(canonicalJson(f.definition.data.definition),original);assert.equal(f.rows[0].definition_json.capabilityReportRef,null);assert(f.sqls.some(s=>s.startsWith('SELECT v.*')),'실제 정의 reader의 원command/receipt/audit 검산');
});
test('v2 누락 환경/도구 불일치·승인정책·잘못원증빙은 저장이나 고정 원문 성공이 아니다',async()=>{
 const f=await reportFixture();for(const payload of [{...f.claim,environmentRef:undefined},{...f.claim,tool:{...f.claim.tool,version:'다른 버전'}}]){const req={...f.request,payload};await assert.rejects(f.store.command('t','c',req));assert.equal(f.reports.length,0);}
 for(const disposition of ['DENY','REQUIRE_APPROVAL']){f.mode.write=disposition;await assert.rejects(f.store.command('t','c',f.request),{statusCode:disposition==='DENY'?403:412});}f.mode.write='AUTO';const r:any=await f.store.command('t','c',f.request);f.audits.splice(f.audits.findIndex(a=>a.command_id===f.reports[0].command_id),1);await assert.rejects(f.store.read(f.db,f.actor,pid,r.data.ref.id,1),{statusCode:503});
});

// Main 사전등록 합성 QA 전용. 평상시 순수 묶음에는 이 실파일 조건을 포함하지 않는다.
if(process.env.FN06_REGISTERED_EVIDENCE_QA==='1')test('등록57byte 합성 근거는 실제 ProjectDocuments/ArtifactStore 읽기→v2 저장/고정GET을 통과하고 격리는 읽기전에 닫힌다',async()=>{
 assert(Date.now()<Date.parse('2026-11-01T08:53:41.963Z'),'등록 QA 만료 — 재사용/재생성0');console.log('QA_PROCESS',JSON.stringify({pid:process.pid,startedAt:new Date().toISOString(),registeredRoot:'D:/tmp/anvil-v3-fn06-report-evidence-20261101-01'}));
 const f=await reportFixture('D:\\tmp\\anvil-v3-fn06-report-evidence-20261101-01'),a={artifactId:id(90),bytes:57,contentHash:'70dc71efa078b23f06cce3bc6b108d6f7ac0cb14b3dcc8ffea4dbea151d48210',mediaType:'text/plain;charset=utf-8'};
 f.claim.capabilities[0]!.evidenceRefs=[a] as any;f.artifacts.push({id:a.artifactId,project_id:pid,state:'READY',content_hash:a.contentHash,bytes:a.bytes,media_type:a.mediaType,storage_key:['blobs',pid,a.artifactId].join('/'),inspection_json:null});
 const r:any=await f.store.command('t','c',f.request),v=await f.store.read(f.db,f.actor,pid,r.data.ref.id,1);assert.equal(f.evidence.length,1);assert(!v.currentnessIssues.some(i=>i.code.startsWith('EVIDENCE_')||i.code==='CURRENTNESS_UNAVAILABLE'));assert.equal(v.effectiveForExecution,false);
 f.artifacts[0].state='QUARANTINED';const q=await f.store.read(f.db,f.actor,pid,r.data.ref.id,1);assert(q.currentnessIssues.some(i=>i.code==='EVIDENCE_QUARANTINED'));console.log('QA_READ_COMPLETE',{pid:process.pid,artifactStoreReadsAwaited:true,ownedOpenFileHandles:0});
});

import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {newDefinitionReportFor,prepareDefinitionCapabilityReport,sendDefinitionCapabilityReport,readDefinitionCapabilityReport} from '../../../apps/web/src/features/connections/definition-capability-report-api.ts';
import {ProjectListCodec} from '../../../apps/server/modules/projects/service.ts';
test('실제 Web prepare→기존 recordCapabilityReport route→저장 receipt→전용 고정GET은 envelope1/payload2 hash를 함께 소비한다',async()=>{
 const f=await reportFixture();f.access.signProjectCursor=(text:string)=>H(text);f.access.installationId='ab140101-0000-4000-8000-000000009999';const app=buildApp({},undefined,{repository:f.access,origin});const calls:{method:string;body?:string}[]=[];
 const session={user:{id:uid},clientId:cid,csrfToken:'c'.repeat(43)};
 const client=new ApiClient(async(url:any,init:any)=>{const method=init?.method??'GET';calls.push({method,body:init?.body});if(String(url)===`/api/v1/projects/${pid}`)return Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}});const response=await app.inject({method,url:String(url),payload:init?.body,headers:{...Object.fromEntries(new Headers(init?.headers).entries()),host:'anvil-synthetic.invalid',origin,cookie:'__Host-anvil.sid=synthetic-session'}});return new Response(response.body,{status:response.statusCode,headers:{'content-type':String(response.headers['content-type']??'')}});});
 try{let b=newDefinitionReportFor(f.definition.data,pid,session);b.draft!.tool.adapterVersion='독립 보고 버전';b.draft!.reason='실제 wire 소비';for(const cap of b.draft!.capabilities)cap.limitations='실측 없음';b=await prepareDefinitionCapabilityReport(client,b,session);assert.equal(b.pending!.schemaVersion,1);assert.equal(b.pending!.payload.schemaVersion,2);assert.equal(b.pending!.operation,'recordCapabilityReport');const expected=b.body;b=await sendDefinitionCapabilityReport(client,b,session);assert(b.receipt);const v=await readDefinitionCapabilityReport(client,pid,b.result!);assert.equal(v.snapshot.schemaVersion,2);assert.equal(v.snapshot.claimHash,H(b.draft));assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.equal(calls.find(c=>c.method==='POST')!.body,expected);assert.equal(f.reports.length,1);}finally{await app.close();assert.equal(app.server.listening,false);}
});
test('실제 유한 목록 codec은 project/정의filter/actor와 microsecond 위치를 결박하고 명시 고정조회와 구분한다',async()=>{const f=await reportFixture(),r:any=await f.store.command('t','c',f.request),codec=new ProjectListCodec(text=>H(text));const q={view:'REGISTERED_DEFINITION_HUMAN_REPORTS',limit:'20'};const page=await f.store.list(f.db,f.actor,pid,q,codec);assert.equal(page.items.length,1);assert.equal(page.items[0]!.integrity,'NOT_RECHECKED');assert.deepEqual(page.items[0]!.ref,r.data.ref);assert.equal(page.effectiveForExecution,false);for(const query of [{...q,view:'CANDIDATES_ONLY'},{...q,limit:'21'},{...q,extra:'x'},{...q,connectionRef:JSON.stringify({...r.data.ref,extra:true})}])await assert.rejects(f.store.list(f.db,f.actor,pid,query,codec),{statusCode:400});
 const filter={query:canonicalJson({projectId:pid,view:q.view,connectionRef:null,order:'created_at,id DESC'}),archived:false,limit:20},position={at:'2026-11-01T00:00:00.123456Z',id:id(88)},cursor=codec.create(uid,filter,position);assert.deepEqual(codec.read(cursor,uid,filter),position);assert.throws(()=>codec.read(cursor,id(99),filter));assert.throws(()=>codec.read(cursor,uid,{...filter,query:'다른 정의'}));assert.throws(()=>codec.read(cursor,uid,filter,new Date(Date.now()+31*60000)));await assert.rejects(f.store.list(f.db,f.actor,pid,{...q,cursor:'tampered'},codec),{message:'CURSOR_INVALID'});
});
test('fresh 합산cap은 실제 원장 used/held와 보고 canonical을 더하고 초과 때 명령·보고를 rollback한다',async()=>{const f=await reportFixture();f.mode.heldBytes='10737418239';const before=f.commands.length;await assert.rejects(f.store.command('t','c',f.request),{message:'CAPABILITY_REPORT_STORAGE_LIMIT_REACHED',statusCode:429});assert.equal(f.reports.length,0);assert.equal(f.commands.length,before);f.mode.heldBytes='0';f.mode.coverage='UNVERIFIED';await assert.rejects(f.store.command('t','c',f.request),{message:'PROJECT_STORAGE_QUOTA_UNVERIFIED',statusCode:412});assert.equal(f.reports.length,0);});

test('현재 보호 뒤 replay는 과거만료/head/원장변경을 fresh 조건으로 재적용하지 않고 fresh 새명령은 거절한다',async()=>{const f=await reportFixture(),r:any=await f.store.command('t','c',f.request),originalNow=Date.now;f.heads[0].head_version=2;f.mode.coverage='UNVERIFIED';try{Date.now=()=>originalNow()+3600000;assert.deepEqual(await f.store.command('t','c',f.request),r);const view=await f.store.read(f.db,f.actor,pid,r.data.ref.id,1);assert(view.currentnessIssues.some(i=>i.code==='REPORT_EXPIRED'));assert(view.currentnessIssues.some(i=>i.code==='CONNECTION_HEAD_CHANGED'));assert.deepEqual(view.ref,r.data.ref);}finally{Date.now=originalNow;}assert.equal(f.reports.length,1);f.mode.coverage='VERIFIED';await assert.rejects(f.store.command('t','c',{...f.request,commandId:randomUUID()}),{message:'CAPABILITY_REPORT_BINDING_CONFLICT',statusCode:409});assert.equal(f.reports.length,1);f.mode.write='DENY';await assert.rejects(f.store.command('t','c',f.request),{statusCode:403});});
test('보고가 생긴 뒤 기존 정의 writer도 실제 보고 합계로 10GiB 초과를 거절한다',async()=>{const f=await reportFixture();await f.store.command('t','c',f.request);f.mode.heldBytes=String(10737418240n-BigInt(f.rows[0].canonical_bytes)-BigInt(f.reports[0].canonical_bytes));const before=f.rows.length;await assert.rejects(f.definitionStore.command('t','c',f.command(91)),{message:'CONNECTION_STORAGE_LIMIT_REACHED',statusCode:429});assert.equal(f.rows.length,before);assert.equal(f.reports.length,1);});
