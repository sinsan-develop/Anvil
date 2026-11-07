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
 const repository={installationId:id(90),
  async authenticated<T>(token:string,csrf:string|null,body:(db:PoolClient,actor:any)=>Promise<T>):Promise<T>{authenticated.push({token,csrf});if(token!=='synthetic-current-session')throw new AuthFailure('AUTH_REQUIRED',401);return await body(db,actor);},
  signProjectCursor(_value:string){throw Error('UNSELECTED_CURSOR_SIGNING');},
 };
 const app=buildApp({},undefined,{repository:repository as any,origin});
 return{app,db,queries,authenticated};
}

test('정의 고정GET은 기존 현재 인증 경계에 연결되어 익명을401로 거절한다',async()=>{
 const f=fixture();try{const headers={host:'anvil-synthetic.invalid',cookie:'__Host-anvil.sid=synthetic-current-session'};
 const baseline=await f.app.inject({method:'GET',url:`/api/v1/projects/${pid}/permission-policy`,headers});assert.equal(baseline.statusCode,200,baseline.body);assert.deepEqual(baseline.json(),{configured:false,policy:null});assert.equal(f.queries.length,2);
 const before=f.queries.length,response=await f.app.inject({method:'GET',url:`/api/v1/projects/${pid}/connections/${id(5)}/versions/1`,headers:{host:'anvil-synthetic.invalid'}});
 assert.equal(response.statusCode,401,'기존 보호GET은 미등록404가 아닌 인증401이어야 한다: '+response.body);assert.equal(response.json().code,'AUTH_REQUIRED');assert.equal(f.queries.length,before,'익명 원문SQL0');
 }finally{await f.app.close();assert.equal(f.app.server.listening,false);}
});

import {ProjectConnectionDefinitions} from '../../../apps/server/modules/connections/project-connection-definitions.ts';
import {readDefinitionInput,readDefinitionPayload,definitionHash} from '../../../apps/server/modules/connections/connection-definition-input.ts';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
function storeFixture(){
 const approvals:any[]=[],decisions:any[]=[],consumptions:any[]=[],notifications:any[]=[];
 const rows:any[]=[],heads:any[]=[],commands:any[]=[],receipts:any[]=[],audits:any[]=[],queries:{sql:string;p:any[]}[]=[];
 const actor:any={actorId:uid,clientId:cid,reauthUntil:new Date('2099-01-01T00:00:00.000Z'),authSession:{id:id(4),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
 const mode={member:true,owner:true,held:true,write:'AUTO',read:'AUTO',coverage:'VERIFIED',used:'0',heldBytes:'0',commitLost:false},at=new Date();
 function policy(){const rules=['registerConnection','readConnectionDefinition','requestApproval','decideApproval'].map((op,n)=>({ruleId:'R'+n,subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:[op],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:op==='registerConnection'?mode.write:mode.read,limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}));return{id:id(9),head_version:1,rules_json:rules,content_hash:definitionHash({rules,reason:'정의 정책',reviewRefs:[]}),reason:'정의 정책',review_refs:[],created_at:at};}
 const db:any={async query(sql:string,p:any[]=[]){queries.push({sql,p});
 if(sql.includes('FROM anvil.projects p JOIN anvil.project_members m'))return{rows:mode.member&&p[0]===pid?[{id:pid,archived_at:null,participation:mode.owner?'OWNER':'VIEWER'}]:[]};
 if(sql==='SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE')return{rows:mode.held?[{actor_id:uid,client_id:cid,generation:1,revoked_at:null}]:[]};
 if(sql.includes('FROM anvil.permission_policies p JOIN anvil.permission_policy_versions'))return{rows:[policy()]};
 if(sql==='SELECT clock_timestamp() AS at'||sql==='SELECT clock_timestamp() at')return{rows:[{at:new Date()}]};if(sql==='SELECT transaction_timestamp() AS at'||sql==='SELECT transaction_timestamp() at')return{rows:[{at}]};
 if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return{rows:commands.filter(r=>r.project_id===p[0]&&r.actor_id===p[1]&&r.command_id===p[2])};
 if(sql==='SELECT * FROM anvil.environment_configuration_account($1,$2,$3,$4)'){assert.deepEqual(p,[actor.authSession.id,actor.actorId,actor.clientId,pid]);return{rows:[{coverage_state:mode.coverage,generation:'1',used_bytes:mode.used,held_bytes:mode.heldBytes,complete:false,environment_heads:'0',environment_versions:'0',environment_bytes:'0',definition_bytes:String(rows.reduce((n,r)=>n+BigInt(r.canonical_bytes),0n)),report_bytes:'0',approval_candidates:'0',approval_bytes:'0'}]};} // 환경0의 기존 writer가 자신의 원형/원장을 계속 검산한다.
 if(sql.startsWith('SELECT * FROM anvil.quota_account'))return{rows:[{coverage_state:mode.coverage,used_bytes:mode.used,held_bytes:mode.heldBytes}]};
 if(sql==='SELECT id FROM anvil.agent_connections WHERE project_id=$1 AND id=$2')return{rows:heads.filter(r=>r.project_id===p[0]&&r.id===p[1])};
 if(sql==='SELECT canonical_bytes FROM anvil.definition_capability_reports WHERE project_id=$1 ORDER BY id'){assert.deepEqual(p,[pid]);return{rows:[]};}
 if(sql.startsWith('SELECT v.definition_json'))return{rows:rows.filter(r=>r.project_id===p[0]).map(r=>({...r,head_id:r.connection_id,head_version:1}))};
 if(sql.startsWith('INSERT INTO anvil.commands')){commands.push({id:p[0],project_id:p[1],actor_id:p[2],client_id:p[3],operation:p[4],command_id:p[5],request_hash:p[6],operation_id:p[7],authorization_receipt_id:p[8],approval_consumption_id:p[9],expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),payload_ref:p[13]?JSON.parse(p[13]):null,result_ref:JSON.parse(p[14]),state:'APPLIED'});return{rows:[]};}
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
 return{store:new ProjectConnectionDefinitions(access),mode,actor,db,rows,heads,commands,receipts,audits,queries,payload,command,approvals,decisions,consumptions,notifications,policy};
}
test('실제 정의 producer→같은db 원명령/영수증/감사→고정reader는 null과 auto 원값을 보존하고 replay 추가0',async()=>{
 const f=storeFixture(),c=f.command(),result:any=await f.store.command('synthetic','csrf',c);assert.equal(result.data.status,'CONNECTION_DEFINITION_STORED');assert.equal(f.queries.find(q=>q.sql.startsWith('INSERT INTO anvil.audit_events'))!.p[8],null,'실제 AUTO producer SQL 매개값은 SQL NULL이다');assert.equal(f.rows.length,1);assert.equal(f.commands.length,1);assert.equal(result.data.definition.modelOptions.model,'auto');assert.equal(result.data.definition.status,'NOT_READY');const read=await f.store.read(f.db,f.actor,pid,result.data.ref.id,1);assert.deepEqual(read.definition,result.data.definition);assert.equal(read.currentStatus.support,'UNVERIFIED');assert.equal(read.currentStatus.executionAuthorized,false);const count=f.queries.filter(q=>q.sql.includes('quota_account')).length;assert.deepEqual(await f.store.command('synthetic','csrf',c),result);assert.equal(f.rows.length,1);assert.equal(f.queries.filter(q=>q.sql.includes('quota_account')).length,count,'replay 예약/산입0');assert(f.queries.find(q=>q.sql.includes('FOR UPDATE OF p,m')));assert(f.queries.every(q=>!q.sql.includes('UPDATE anvil.project_storage_accounts')));
});
test('입력 exact10/null·비밀·주입과 실제 비null 보호provider 부재는 명시 거절한다',async()=>{
 const f=storeFixture(),p=f.payload();assert.deepEqual(readDefinitionPayload(p),p);for(const mutate of[(v:any)=>delete v.definition.accountRef,(v:any)=>v.definition.status='READY',(v:any)=>v.definition.modelOptions={password:'raw-password'},(v:any)=>v.kind='CONNECTION_CANDIDATE',(v:any)=>v.definition.label=String.fromCharCode(0xd800)]){const v=structuredClone(p);mutate(v);assert.throws(()=>readDefinitionPayload(v));}
 const c=f.command();c.payload.definition.accountRef={id:id(99),version:1,contentHash:'a'.repeat(64)};await assert.rejects(f.store.command('s','c',c),{message:'SOURCE_VERIFIER_NOT_CONNECTED',statusCode:412});assert.equal(f.rows.length,0);assert.equal(f.commands.length,0);
});
test('원장 미확인/합산cap·현재권한/정책/제어·REQUIRE 미소비 입력은 쓰기 전 닫힌다',async()=>{
 for(const mode of ['coverage','cap','member','owner','held','policy','approval']){const f=storeFixture(),c=f.command();if(mode==='coverage')f.mode.coverage='UNVERIFIED';if(mode==='cap')f.mode.used='10737418240';if(mode==='member')f.mode.member=false;if(mode==='owner')f.mode.owner=false;if(mode==='held')f.mode.held=false;if(mode==='policy')c.payload.definition.policyRef.contentHash='f'.repeat(64);if(mode==='approval')f.mode.write='REQUIRE_APPROVAL';await assert.rejects(f.store.command('s','c',c));assert.equal(f.rows.length,0,mode);assert.equal(f.commands.length,0,mode);}
});
test('원작성client/제어 없는 현재 member 읽기는 허용하고 다른project·hash/감사 변조는 거절한다',async()=>{
 const f=storeFixture(),r:any=await f.store.command('s','c',f.command());f.actor.clientId=id(22);f.mode.held=false;f.mode.owner=false;assert.equal((await f.store.read(f.db,f.actor,pid,r.data.ref.id,1)).ref.contentHash,r.data.ref.contentHash);await assert.rejects(f.store.read(f.db,f.actor,id(88),r.data.ref.id,1));f.audits[0].scope_digest='f'.repeat(64);await assert.rejects(f.store.read(f.db,f.actor,pid,r.data.ref.id,1),{message:'CONNECTION_DEFINITION_INTEGRITY_FAILED'});
});

test('기존 실제 승인 요청→별도 결정→정의 저장은 원payloadHash 일회소비/replay0·재사용거절을 유지한다',async()=>{
 const f=storeFixture();f.mode.write='REQUIRE_APPROVAL';const c=f.command(),policyRef=c.payload.definition.policyRef,scope={operation:'registerConnection',targetRef:null,expectedVersion:0,payloadHash:definitionHash(c.payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1},details={reason:'한 번 별도 승인',risks:{data:'자료',security:'보안',cost:'비용',interruption:'중단',unverified:'미검증'},rollback:{method:'원형 보존',limitations:'실행 없음',evidenceRefs:[]},expiresAt:new Date(Date.now()+600000).toISOString(),actionScope:scope,candidateCommandId:c.commandId};
 const approvals=new ProjectApprovals(),requestCommand={...c,commandId:id(60),operation:'requestApproval',payload:{details}},requested:any=await approvals.request(f.db,f.actor,requestCommand,policyRef);assert.equal(f.approvals.length,1);assert.equal(f.notifications.length,1);const r=requested.data.request;
 const decisionCommand={...c,commandId:id(61),operation:'decideApproval',targetId:r.id,expectedVersion:1,payload:{requestId:r.id,expectedVersion:1,scopeDigest:r.scopeDigest,decision:'APPROVE',reason:'명시 결정'}},decided:any=await approvals.decide(f.db,f.actor,decisionCommand,policyRef);
 c.approvalRef={requestId:r.id,decisionId:decided.data.decision.id,scopeDigest:r.scopeDigest};const result=await f.store.command('s','c',c);assert.deepEqual(JSON.parse(f.queries.filter(q=>q.sql.startsWith('INSERT INTO anvil.audit_events')).at(-1)!.p[8]),c.approvalRef,'실제 승인 producer는 JSON approval object를 저장한다');assert.equal(f.consumptions.length,1);assert.equal(f.approvals[0].status,'CONSUMED');assert.equal(f.rows.length,1);assert.deepEqual(await f.store.command('s','c',c),result);assert.equal(f.consumptions.length,1);const other={...c,commandId:id(62)};await assert.rejects(f.store.command('s','c',other));assert.equal(f.rows.length,1);
});

import {PreparationRecordSourceAdapter} from '../../../apps/server/modules/transfers/preparation-record-source-adapter.ts';
import {ProjectAssignmentDrafts} from '../../../apps/server/modules/assignments/project-assignment-drafts.ts';
import {ProjectAssignmentConfirmations} from '../../../apps/server/modules/assignments/project-assignment-confirmations.ts';
import {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';
import {ProjectKnowledge} from '../../../apps/server/modules/knowledge/knowledge.ts';
import {ProjectConversations} from '../../../apps/server/modules/knowledge/conversations.ts';
import {ProjectContextSources} from '../../../apps/server/modules/context/context-sources.ts';
import {ProjectContexts} from '../../../apps/server/modules/context/project-contexts.ts';
import {ResponsibleSessions} from '../../../apps/server/modules/assignments/responsible-sessions.ts';

test('FN14 실제 source adapter는 같은 PoolClient/주체의 정의 reader만 소비하고 후보 alias/위조ref를 거절한다',async()=>{
 const f=storeFixture(),saved:any=await f.store.command('s','c',f.command());const unavailable={read:async()=>{throw Error('미선택 producer');},readApplication:async()=>{throw Error('미선택 방법론');},decision:async()=>{throw Error('미선택 결정');}} as any;
 const drafts=new ProjectAssignmentDrafts(unavailable,unavailable),assignments=new ProjectAssignmentConfirmations(drafts),documents=new ProjectDocuments(),knowledge=new ProjectKnowledge(documents),conversations=new ProjectConversations(documents),contexts=new ProjectContexts(new ProjectContextSources({confirmations:assignments,drafts,documents,knowledge,conversations}),assignments),sessions=new ResponsibleSessions(unavailable,assignments,drafts,unavailable);
 const readers={drafts,assignments,documents,knowledge,conversations,contexts,sessions},adapter=new PreparationRecordSourceAdapter({...readers,connections:f.store}),scope={db:f.db,actor:f.actor,projectId:pid};
 await adapter.commandLock(scope,id(90));await adapter.lock(scope,[{kind:'targetConnectionRef',id:saved.data.ref.id,version:1}]);const target=await adapter.target(scope,saved.data.ref);assert.deepEqual(target,{projectId:pid,ref:saved.data.ref,kind:'REGISTERED_CONNECTION',support:'UNVERIFIED'});assert(!f.queries.some(q=>q.sql.includes('agent_connections')&&q.sql.includes('FOR SHARE')),'app UPDATE 권한을 추가하지 않는다');
 await assert.rejects(adapter.target(scope,{...saved.data.ref,contentHash:'f'.repeat(64)}),{statusCode:409});await assert.rejects(adapter.target({...scope,projectId:id(99)},saved.data.ref));await assert.rejects(new PreparationRecordSourceAdapter(readers).target(scope,saved.data.ref),{message:'SOURCE_VERIFIER_NOT_CONNECTED',statusCode:412});
});
test('같은 project 합산 cap의 정확마지막byte는 허용하고 초과1byte는 모든신규행0으로 거절한다',async()=>{
 for(const delta of [0,1]){const f=storeFixture(),c=f.command(),n=Buffer.byteLength(canonicalJson({id:id(90),version:1,status:'NOT_READY',...c.payload.definition}));f.mode.used=String(10737418240n-BigInt(n)+BigInt(delta));if(delta){await assert.rejects(f.store.command('s','c',c),{message:'CONNECTION_STORAGE_LIMIT_REACHED',statusCode:429});assert.equal(f.rows.length,0);assert.equal(f.commands.length,0);}else{await f.store.command('s','c',c);assert.equal(f.rows.length,1);}}
});
test('기존 정의1000head 경계와 canonical 변조는 신규명령 전에 거절한다',async()=>{
 const f=storeFixture(),first:any=await f.store.command('s','c',f.command()),seed=f.rows[0];for(let n=1;n<1000;n++){const key=id(1000+n),definition={...first.data.definition,id:key},raw=canonicalJson(definition);f.rows.push({...seed,connection_id:key,definition_json:definition,canonical_json:raw,canonical_bytes:String(Buffer.byteLength(raw)),content_hash:definitionHash(definition)});}await assert.rejects(f.store.command('s','c',f.command(51)),{message:'CONNECTION_STORAGE_LIMIT_REACHED',statusCode:429});assert.equal(f.commands.length,1);f.rows[0].canonical_bytes='0';await assert.rejects(f.store.command('s','c',f.command(52)),{message:'CONNECTION_DEFINITION_INTEGRITY_FAILED',statusCode:503});
});
test('COMMIT응답 유실은 UNKNOWN이며 남은 원행을 동일명령으로만 재확인한다',async()=>{
 const f=storeFixture(),c=f.command();f.mode.commitLost=true;await assert.rejects(f.store.command('s','c',c),{message:'CONNECTION_OUTCOME_UNKNOWN',statusCode:503});assert.equal(f.rows.length,1,'실제 COMMIT 여부는 이 메모리 모델에서만 고정');const result:any=await f.store.command('s','c',c);assert.equal(result.data.ref.id,f.rows[0].connection_id);assert.equal(f.rows.length,1);assert.equal(f.commands.length,1);
});
test('감사 누락·중복·operation/주체/policy/target/hash변조는 실제 보관reader에서 거절한다',async()=>{
 for(const mode of ['MISSING','DUPLICATE','OPERATION','ACTOR','POLICY','TARGET','DIGEST']){const f=storeFixture(),r:any=await f.store.command('s','c',f.command());const audit=f.audits[0];if(mode==='MISSING')f.audits.length=0;if(mode==='DUPLICATE')f.audits.push({...audit});if(mode==='OPERATION')audit.operation_id=id(99);if(mode==='ACTOR')audit.actor_ref={kind:'HUMAN',userId:id(99)};if(mode==='POLICY')audit.policy_ref={...audit.policy_ref,contentHash:'f'.repeat(64)};if(mode==='TARGET')audit.target_ref={...r.data.ref,id:id(99)};if(mode==='DIGEST')audit.scope_digest='f'.repeat(64);await assert.rejects(f.store.read(f.db,f.actor,pid,r.data.ref.id,1),{message:'CONNECTION_DEFINITION_INTEGRITY_FAILED',statusCode:503},mode);}
});
