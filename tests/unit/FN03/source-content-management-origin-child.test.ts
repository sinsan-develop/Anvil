import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {prepareSourceContentManagementOriginInput} from '../../../apps/server/modules/documents/source-content-policy-management-origin-input.ts';
import {prepareSourceContentManagementStorage} from '../../../apps/server/modules/documents/source-content-policy-management-storage.ts';
import {createManagementOriginChild} from '../../integration/FN03/source-content-management-origin-child.ts';
import {managementOriginInspectionSql} from '../../integration/FN03/source-content-management-origin-journey.ts';
// 기존 service 시험의 봉인 물리행 fixture. 실제 SQL/정착 권위를 발급하지 않는다.
const id=(n:number)=>`8b000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const epoch=Date.parse('2026-11-20T00:00:00.000Z'),at=(n:number)=>new Date(epoch+n).toISOString(),p27=(v:string)=>v.slice(0,-1)+'000Z';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const cost=(row:any)=>Buffer.byteLength(canonicalJson(Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='number'&&/^(version|generation|.*_version|.*_generation|server_sequence|reserved_bytes|settled_bytes|start_fence)$/.test(k)?String(v):v]))));
function fixture(originMs=0,receivedAt=p27(at(-1)),overrides:any={}):any{
 const context={operation:'defineSourceContentPolicy',projectId:id(1),actorId:id(2),clientId:id(3),authSessionId:id(4),credentialGeneration:2,controlGeneration:3,permissionPolicyRef:ref(5),transactionId:'9007199254740993',authorizedUntil:at(10000),...overrides.context};
 const ids={serverCommandId:id(10),operationId:id(11),authorizationReceiptId:id(12),auditEventId:id(13),policyEventId:id(14),originId:id(15),...overrides.ids};
 const request={schemaVersion:1,projectId:id(1),commandId:id(6),clientId:id(3),controlGeneration:3,operation:'defineSourceContentPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:id(2),disposition:'AUTO',expiresAt:at(86400000),allowedOperations:['requestSourceContentHash'],sourceRootRef:ref(20),connectorRef:ref(21),registrationRef:ref(22),observerRef:ref(23),targets:[{relativePath:'src/private-fixture.ts',documentRef:ref(24),documentBlobRef:{artifactId:id(25),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'출력 금지 합성 원문'}};
 const input={originalRequest:request,context,ids,eventValues:{sequence:1,recordedAt:at(0),...(originMs===0?{}:{originRecordedAt:at(originMs)})},coverageGeneration:'7',receivedAt};
 const v=prepareSourceContentManagementOriginInput(request,context,ids,input.eventValues,epoch+5000),seal=prepareSourceContentManagementStorage(input,epoch+5000),er=v.policyEventRef,S:any=v.policySnapshot;
 const digest=hash({projectId:context.projectId,actorId:context.actorId,clientId:context.clientId,controlGeneration:3,requestHash:v.requestHash,policyRef:context.permissionPolicyRef,targetRef:er});
 const result={operationId:ids.operationId,commandId:request.commandId,projectId:id(1),status:'APPLIED',targetId:er.id,version:1,data:{ref:er,status:'CONTENT_POLICY_EVENT_RECORDED',policyRef:er,previousPolicyRef:null,sequence:1,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false},evidenceRefs:[],warnings:[],serverReceivedAt:at(2000)};
 const rows:any={
 O:{project_id:id(1),id:ids.originId,version:1,management_command_id:ids.serverCommandId,policy_event_ref:er,request_json:request,request_hash:v.requestHash,recorded_at:p27(at(originMs)),content_hash:v.originRef.contentHash},
 E:{project_id:id(1),id:ids.policyEventId,version:1,sequence:1,subject_user_id:id(2),disposition:'AUTO',snapshot_json:S,content_hash:er.contentHash,previous_ref:null,management_command_id:ids.serverCommandId,recorded_at:p27(at(0)),expires_at:p27(S.expiresAt),previous_id:null,previous_version:null,previous_hash:null},
 C:{id:ids.serverCommandId,scope_kind:'PROJECT',scope_id:id(1),project_id:id(1),draft_id:null,actor_id:id(2),client_id:id(3),operation:request.operation,command_id:request.commandId,request_hash:v.requestHash,operation_id:ids.operationId,state:'APPLIED',authorization_receipt_id:ids.authorizationReceiptId,approval_consumption_id:null,expected_version:0,control_generation:3,policy_ref:context.permissionPolicyRef,payload_ref:null,result_ref:result,received_at:input.receivedAt,completed_at:p27(at(2000))},
 A:{id:ids.authorizationReceiptId,scope_kind:'PROJECT',scope_id:id(1),command_id:ids.serverCommandId,subject_ref:{kind:'HUMAN',userId:id(2),clientId:id(3)},policy_ref:context.permissionPolicyRef,scope_digest:digest,approval_decision_ref:null,authorized_at:p27(at(2000))},
 U:{project_id:id(1),server_sequence:'19',event_id:ids.auditEventId,actor_ref:{kind:'HUMAN',userId:id(2)},client_ref:id(3),command_id:ids.serverCommandId,operation_id:ids.operationId,target_ref:er,policy_ref:context.permissionPolicyRef,approval_ref:null,outcome:'APPLIED',reason_code:'SOURCE_CONTENT_POLICY_EVENT_RECORDED',scope_digest:digest,recorded_at:p27(at(2000)),source_kind:'HUMAN_COMMAND',correction_of:null}
 };
 const B=Object.values(rows).reduce<number>((sum,r)=>sum+cost(r),0);
 const R:any={id:ids.serverCommandId,project_id:id(1),actor_id:id(2),client_id:id(3),external_command_id:request.commandId,operation:request.operation,command_hash:v.requestHash,part_key:'management_origin',part_kind:'SOURCE_CONTENT_POLICY_MANAGEMENT',plan_json:seal.plan,plan_hash:seal.planHash,reserved_bytes:Number(seal.reservedBytes),settled_bytes:0,phase:'SETTLED',start_fence:1,authorized_until:p27(context.authorizedUntil),server_command_id:ids.serverCommandId,authorization_receipt_id:ids.authorizationReceiptId,scope_digest:digest,created_at:p27(at(100)),started_at:p27(at(1000)),settled_at:p27(at(3000))};
 let s=B;for(let i=0;i<64;i++){R.settled_bytes=s;const next=B+cost(R);if(next===s)break;s=next;}rows.R=R;
 return {context,ids,request,result,rows,selection:{originRef:v.originRef,policyEventRef:er,managementCommandId:ids.serverCommandId},response:{status:'RECORDED',transactionId:context.transactionId,previousEvent:null,rows}};
}
function harness(mode:'normal'|'denied'|'unknown'|'stale'='normal'){
 const token='t'.repeat(43),csrf='c'.repeat(43),deniedToken='d'.repeat(43),deniedCsrf='e'.repeat(43),until='2050-01-01T00:00:00.000Z';
 const request=fixture().request,denied={...request,commandId:id(80),clientId:id(81)},trace:string[]=[],queries:string[]=[];
 let active=true,deniedActor=false,stored:any,staged:any,releases=0,ends=0,observations=0,connects=0;
 const policy={rules:[{ruleId:id(60),subjectRef:{kind:'HUMAN',userId:id(2)},operations:['defineSourceContentPolicy','readSourceContentPolicyManagementOrigin'],targetScopes:[{kind:'PROJECT',projectId:id(1)}],disposition:'AUTO',limitPolicyRef:null,expiresAt:until}],reason:'합성 정책',reviewRefs:[]};
 const client={release(){releases++;},async query(sql:string,args:any[]=[]):Promise<any>{
  queries.push(sql);
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)){
   trace.push(sql);if(sql==='BEGIN')staged=undefined;
   if(sql==='COMMIT'){if(mode==='unknown')throw Error('PRIVATE_COMMIT');if(staged)stored=staged;}
   if(sql==='ROLLBACK')staged=undefined;
   return{command:sql,rows:[]};
  }
  if(sql.startsWith('SELECT s.*')){deniedActor=args[0]===createHash('sha256').update(deniedToken).digest('hex');return{rows:[{id:id(deniedActor?82:4),uid:id(deniedActor?83:2),client_id:id(deniedActor?81:3),server_owner:false,user_status:'ACTIVE',revoked_at:null,user_revoked_at:null,client_revoked_at:null,credential_generation:2,current_generation:2,idle_expires_at:new Date(until),absolute_expires_at:new Date(until),reauth_until:new Date(until),csrf_digest:createHash('sha256').update(deniedActor?deniedCsrf:csrf).digest('hex')}]};}
  if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:id(1),archived_at:null,participation:deniedActor||mode==='denied'?'MEMBER':'OWNER'}]};
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return{rows:[{actor_id:id(2),client_id:id(3),generation:3,revoked_at:null}]};
  if(sql.startsWith('SELECT p.id,p.head_version'))return{rows:[{id:id(5),head_version:1,rules_json:policy.rules,reason:policy.reason,review_refs:[],content_hash:hash(policy),created_at:new Date(epoch)}]};
  if(sql.includes('clock_timestamp()'))return{rows:[{at:new Date(epoch+5000),transaction_id:'9007199254740993'}]};
  if(sql.startsWith('SELECT operation,request_hash,result_ref'))return{rows:stored?[{operation:request.operation,request_hash:hash(request),result_ref:stored.result}]:[]};
  if(sql.startsWith('SELECT anvil.fn03_source_content_management_')){
   trace.push(sql.includes('_read(')?'READ_RPC':args[6]===null?'REPLAY_RPC':'WRITE_RPC');
   if(mode==='stale')active=false;
   if(sql.includes('_read('))return{rows:[{bundle:{...stored.response,status:'FOUND',transactionId:args[7]}}]};
   if(args[6]===null)return{rows:[{bundle:{...stored.response,status:'REPLAYED',transactionId:args[7]}}]};
   staged=fixture(0,p27(at(-1)),{context:{authSessionId:args[0],actorId:args[1],clientId:args[2],projectId:args[3],permissionPolicyRef:args[5],transactionId:args[7],authorizedUntil:args[8]},ids:args[6]});
   return{rows:[{bundle:staged.response}]};
  }
  throw Error('UNEXPECTED_FIXTURE_SQL');
 }};
 const pool={async connect(){connects++;return client;},async end(){ends++;}} as unknown as Pool;
 const input={pool,assertCurrent(){if(!active)throw Error('PRIVATE_SCOPE');},access:{installationId:id(90),key:Buffer.alloc(32)},
  journey:{origin:'https://anvil.invalid',session:{token,csrfToken:csrf},deniedSession:{token:deniedToken,csrfToken:deniedCsrf},deniedCode:'PROJECT_WRITE_DENIED' as const,request,deniedRequest:denied,readCommandId:id(84)},
  async inspect(sql:string,args:readonly string[]){
   observations++;trace.push('OBSERVE');assert.equal(sql,managementOriginInspectionSql);assert.deepEqual(args,[id(1),request.commandId,denied.commandId]);
   const selected=stored?{...stored.selection,requestHash:hash(request),phase:'SETTLED',reserved:String(stored.rows.R.reserved_bytes),settled:String(stored.rows.R.settled_bytes)}:null;
   return{rows:[{snapshot:{rows:Object.fromEntries(['O','E','C','A','U','R'].map(name=>[name,{count:stored?1:0,digest:hash(stored?stored.rows[name]:[])}])),account:{used:String(100+(stored?stored.rows.R.settled_bytes:0)),held:'0',digest:hash({used:stored?stored.rows.R.settled_bytes:0})},selected,deniedCount:0}}]};
  }};
 return{input,trace,queries,expire(){active=false;},get observations(){return observations;},get releases(){return releases;},get connects(){return connects;},get ends(){return ends;}};
}
test('원 Fastify inject/Access/내부 read를 기존 여정에 연결하고 원 Pool은 외부 소유로 보존한다',async t=>{
 t.mock.method(Date,'now',()=>epoch+5000);const h=harness(),child=createManagementOriginChild(h.input);
 assert.equal(h.connects,0);assert.equal(h.observations,0);
 const result=await child.run();assert.equal(result.status,'CHECKED');assert.equal(result.authority,'NOT_ISSUED');
 assert.deepEqual(child.settlements(),['COMMIT','COMMIT','COMMIT','ROLLBACK']);assert.deepEqual(child.releases(),['RELEASED','RELEASED','RELEASED','RELEASED']);
 assert.equal(h.connects,4);assert.equal(h.releases,4);assert.equal(h.ends,0);assert.equal(h.observations,5);
 assert.deepEqual(h.trace.filter(x=>x.endsWith('_RPC')),['WRITE_RPC','READ_RPC','REPLAY_RPC']);
 const count=h.queries.length;assert.equal((await child.run()).status,'STOPPED');assert.equal(h.queries.length,count);assert.equal(h.observations,5);
});
test('첫 write의 실제 403 또는 COMMIT UNKNOWN 뒤 observer/read/replay는 시작하지 않는다',async t=>{
 t.mock.method(Date,'now',()=>epoch+5000);
 for(const mode of ['denied','unknown'] as const){const h=harness(mode),child=createManagementOriginChild(h.input),result=await child.run();
  assert.equal(result.status,'STOPPED');assert.equal(h.observations,1);assert.equal(h.connects,1);assert.equal(h.releases,1);assert.equal(h.ends,0);
  assert.deepEqual(child.settlements(),[mode==='denied'?'ROLLBACK':'UNKNOWN']);assert.equal(h.trace.includes('READ_RPC'),false);assert.equal(h.trace.includes('REPLAY_RPC'),false);
 }
});
test('원 소유권 소실 전후와 observer 실패에는 새 업무 IO0, 원 rollback/release만 수거한다',async t=>{
 t.mock.method(Date,'now',()=>epoch+5000);
 const before=harness(),a=createManagementOriginChild(before.input);before.expire();assert.equal((await a.run()).status,'STOPPED');assert.equal(before.connects,0);assert.equal(before.observations,0);
 const pending=harness('stale'),b=createManagementOriginChild(pending.input);assert.equal((await b.run()).status,'STOPPED');assert.equal(pending.observations,1);assert.equal(pending.connects,1);assert.equal(pending.releases,1);assert.deepEqual(b.settlements(),['UNKNOWN']);
 const observer=harness();observer.input.inspect=async()=>{throw Error('PRIVATE_OBSERVER');};const c=createManagementOriginChild(observer.input),result=await c.run();assert.equal(result.status,'STOPPED');assert.equal(observer.connects,0);assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
 const late=harness(),original=late.input.inspect;late.input.inspect=async(sql,args)=>{const value=await original(sql,args);late.expire();return value;};
 assert.equal((await createManagementOriginChild(late.input).run()).status,'STOPPED');assert.equal(late.connects,0);assert.equal(late.observations,1);
});
