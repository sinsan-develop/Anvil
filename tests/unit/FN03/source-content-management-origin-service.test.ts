import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {prepareSourceContentManagementOriginInput} from '../../../apps/server/modules/documents/source-content-policy-management-origin-input.ts';
import {prepareSourceContentManagementStorage} from '../../../apps/server/modules/documents/source-content-policy-management-storage.ts';
const modulePath='../../../apps/server/modules/documents/source-content-policy-management-origin-store.ts';
const api=await import(modulePath).catch((e:unknown)=>{if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`8b000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const epoch=Date.parse('2026-11-20T00:00:00.000Z'),at=(n:number)=>new Date(epoch+n).toISOString(),p27=(v:string)=>v.slice(0,-1)+'000Z';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const cost=(row:any)=>Buffer.byteLength(canonicalJson(Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='number'&&/^(version|generation|.*_version|.*_generation|server_sequence|reserved_bytes|settled_bytes|start_fence)$/.test(k)?String(v):v]))));
function fixture():any{
 const context={operation:'defineSourceContentPolicy',projectId:id(1),actorId:id(2),clientId:id(3),authSessionId:id(4),credentialGeneration:2,controlGeneration:3,permissionPolicyRef:ref(5),transactionId:'9007199254740993',authorizedUntil:at(10000)};
 const ids={serverCommandId:id(10),operationId:id(11),authorizationReceiptId:id(12),auditEventId:id(13),policyEventId:id(14),originId:id(15)};
 const request={schemaVersion:1,projectId:id(1),commandId:id(6),clientId:id(3),controlGeneration:3,operation:'defineSourceContentPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:id(2),disposition:'AUTO',expiresAt:at(86400000),allowedOperations:['requestSourceContentHash'],sourceRootRef:ref(20),connectorRef:ref(21),registrationRef:ref(22),observerRef:ref(23),targets:[{relativePath:'src/private-fixture.ts',documentRef:ref(24),documentBlobRef:{artifactId:id(25),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'출력 금지 합성 원문'}};
 const input={originalRequest:request,context,ids,eventValues:{sequence:1,recordedAt:at(0)},coverageGeneration:'7',receivedAt:p27(at(-1))};
 const v=prepareSourceContentManagementOriginInput(request,context,ids,input.eventValues,epoch+5000),seal=prepareSourceContentManagementStorage(input,epoch+5000),er=v.policyEventRef,S:any=v.policySnapshot;
 const digest=hash({projectId:context.projectId,actorId:context.actorId,clientId:context.clientId,controlGeneration:3,requestHash:v.requestHash,policyRef:context.permissionPolicyRef,targetRef:er});
 const result={operationId:ids.operationId,commandId:request.commandId,projectId:id(1),status:'APPLIED',targetId:er.id,version:1,data:{ref:er,status:'CONTENT_POLICY_EVENT_RECORDED',policyRef:er,previousPolicyRef:null,sequence:1,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false},evidenceRefs:[],warnings:[],serverReceivedAt:at(2000)};
 const rows:any={
 O:{project_id:id(1),id:ids.originId,version:1,management_command_id:ids.serverCommandId,policy_event_ref:er,request_json:request,request_hash:v.requestHash,recorded_at:p27(at(0)),content_hash:v.originRef.contentHash},
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
function harness(f=fixture(),invoke?:(call:any)=>Promise<unknown>){const calls:any[]=[],checks:any[]=[];let time=epoch+5000;const ports={now:()=>time,assertCurrent:async(scope:any)=>{checks.push(scope);},invoke:async(call:any)=>{calls.push(call);return invoke?invoke(call):structuredClone(f.response);}};return {store:api.createSourceContentManagementOriginStore(ports),ports,calls,checks,setTime:(t:number)=>{time=t;}};}
const invalid=/^Error: SOURCE_CONTENT_MANAGEMENT_STORE_INVALID$/;
const unknown=/^Error: SOURCE_CONTENT_MANAGEMENT_STORE_OUTCOME_UNKNOWN$/;
test('commit은 고정9인자 purpose 포트1회와 전후 현재성 검산 뒤 기존 CM 결과만 반환',async()=>{
 const f=fixture(),h=harness(f),out=await h.store.commit(f.request,f.context,f.ids);
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'fn03_source_content_management_commit');assert.equal(h.calls[0].args.length,9);assert.deepEqual(h.calls[0].args.slice(0,4),[id(4),id(2),id(3),id(1)]);
 assert.equal(h.calls[0].args[7],f.context.transactionId);assert.ok(Object.isFrozen(h.calls[0].args[4]));assert.equal(h.checks.length,2);
 assert.deepEqual(out,{kind:'RECORDED',result:f.result});assert.equal(JSON.stringify(out).includes('private-fixture'),false);assert.equal(JSON.stringify(out).includes('출력 금지'),false);
 await assert.rejects(h.store.commit(f.request,f.context,f.ids),invalid);assert.equal(h.calls.length,1);
});
test('현재 read는 만료된 역사 원 정착 범위와 분리하고 exact5 UNVERIFIED만 반환',async()=>{
 const f=fixture(),current={...f.context,operation:'readSourceContentPolicyManagementOrigin',actorId:id(40),clientId:id(41),authSessionId:id(42),permissionPolicyRef:ref(43),transactionId:'9007199254740994',authorizedUntil:at(100000)};
 f.response.status='FOUND';f.response.transactionId=current.transactionId;const h=harness(f);h.setTime(epoch+90000);
 const out=await h.store.read(f.selection,current);assert.equal(h.calls[0].args.length,8);assert.equal(h.calls[0].name,'fn03_source_content_management_read');assert.deepEqual(h.calls[0].args[6],f.selection);
 assert.deepEqual(out,{kind:'FOUND',value:{...f.selection,requestHash:hash(f.request),authority:'UNVERIFIED'}});assert.equal(Object.keys(out.value).length,5);assert.equal(JSON.stringify(out).includes('request_json'),false);
});
test('ORIGIN_ABSENT는 read의 exact 상태로만 구분하며 commit/오염 부재는 불명',async()=>{
 const f=fixture(),readContext={...f.context,operation:'readSourceContentPolicyManagementOrigin'};
 let h=harness(f,async()=>({status:'ORIGIN_ABSENT',transactionId:f.context.transactionId}));assert.deepEqual(await h.store.read(f.selection,readContext),{kind:'ORIGIN_ABSENT'});
 h=harness(f,async()=>({status:'ORIGIN_ABSENT',transactionId:f.context.transactionId}));await assert.rejects(h.store.commit(f.request,f.context,f.ids),unknown);
 h=harness(f,async()=>({status:'ORIGIN_ABSENT',transactionId:f.context.transactionId,rows:f.rows}));await assert.rejects(h.store.read(f.selection,readContext),unknown);
});
test('정착/해시/원문/다른 Tx·선택 오염과 별도 E/O 시각은 성공으로 승격하지 않는다',async()=>{
 for(const mutate of [(v:any)=>v.transactionId='2',(v:any)=>v.rows.O.request_json.payload.reason='변경',(v:any)=>v.rows.A.scope_digest='f'.repeat(64),(v:any)=>v.rows.R.settled_bytes++,(v:any)=>v.rows.R.plan_hash='0'.repeat(64),(v:any)=>v.rows.R.settled_at=p27(at(9000)),(v:any)=>v.rows.O.recorded_at=p27(at(1)),(v:any)=>delete v.rows.U]){const f=fixture(),h=harness(f,async()=>{const response=structuredClone(f.response);mutate(response);return response;});await assert.rejects(h.store.commit(f.request,f.context,f.ids),unknown);assert.equal(h.calls.length,1);}
 const f=fixture();f.response.status='FOUND';const h=harness(f);await assert.rejects(h.store.read({...f.selection,originRef:ref(99)},{...f.context,operation:'readSourceContentPolicyManagementOrigin'}),unknown);
});
test('현재성 사전 거절/boolean·query 교체는 호출0, 늦은 취소/기한은 후속0·원 오류 숨김',async()=>{
 let f=fixture(),h=harness(f);h.ports.assertCurrent=async()=>{throw Error('raw secret');};await assert.rejects(h.store.commit(f.request,f.context,f.ids),invalid);assert.equal(h.calls.length,0);
 f=fixture();h=harness(f);h.ports.invoke=async()=>f.response;await assert.rejects(h.store.commit(f.request,f.context,f.ids),invalid);assert.equal(h.calls.length,0);
 const bool=api.createSourceContentManagementOriginStore({now:()=>epoch+5000,assertCurrent:async()=>true,invoke:async()=>{throw Error('must not run');}});await assert.rejects(bool.commit(f.request,f.context,f.ids),invalid);
 let currentChecks=0,rpcCalls=0;const cancelled=api.createSourceContentManagementOriginStore({now:()=>epoch+5000,assertCurrent:async()=>{if(++currentChecks===2)throw Error('raw auth cancellation');},invoke:async()=>{rpcCalls++;return f.response;}});await assert.rejects(cancelled.commit(f.request,f.context,f.ids),unknown);assert.equal(rpcCalls,1);await assert.rejects(cancelled.read(f.selection,{...f.context,operation:'readSourceContentPolicyManagementOrigin'}),invalid);assert.equal(rpcCalls,1);
 let release!:(v:unknown)=>void;h=harness(f,()=>new Promise(resolve=>{release=resolve;}));const pending=h.store.commit(f.request,f.context,f.ids);await new Promise(resolve=>setImmediate(resolve));h.setTime(epoch+10000);release(f.response);await assert.rejects(pending,unknown);assert.equal(h.calls.length,1);await assert.rejects(h.store.commit(f.request,f.context,f.ids),invalid);
});
test('await 중 caller 변경은 원 사본 유지, 동시 호출/재시도0, getter·raw 예외 유출0',async()=>{
 const f=fixture();let release!:(v:unknown)=>void;const h=harness(f,()=>new Promise(resolve=>{release=resolve;}));const pending=h.store.commit(f.request,f.context,f.ids);await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(h.store.read(f.selection,{...f.context,operation:'readSourceContentPolicyManagementOrigin'}),invalid);f.request.payload.reason='변경';assert.notEqual(h.calls[0].args[4].payload.reason,'변경');release({...f.response,rows:structuredClone(f.rows)});await assert.rejects(pending,unknown);
 const other=fixture(),bad=harness(other,async()=>{throw Error('private-fixture secret');});await assert.rejects(bad.store.commit(other.request,other.context,other.ids),unknown);assert.equal(bad.calls.length,1);
 let gets=0;const g=harness(other);Object.defineProperty(other.context,'actorId',{get(){gets++;return id(2);},enumerable:true});await assert.rejects(g.store.commit(other.request,other.context,other.ids),invalid);assert.equal(gets,0);assert.equal(g.calls.length,0);
});
test('포트 반환은 후행 current await 전에 복사하고 정상 원 응답·caller 사본을 보존한다',async()=>{
 const f=fixture(),response=structuredClone(f.response);let checks=0;let release!:(v:unknown)=>void;
 const store=api.createSourceContentManagementOriginStore({now:()=>epoch+5000,assertCurrent:async()=>{if(++checks===2){response.rows.O.request_json.payload.reason='후행 변이';await Promise.resolve();}},invoke:()=>new Promise(resolve=>{release=resolve;})});
 const pending=store.commit(f.request,f.context,f.ids);await new Promise(resolve=>setImmediate(resolve));f.request.payload.reason='호출자 변이';release(response);
 assert.deepEqual(await pending,{kind:'RECORDED',result:f.result});
});
test('RPC의 더 짧은 원 봉인 기한은 새 commit에서 현재 상한이며 역사 read만 별도다',async()=>{
 const f=fixture();f.context.authorizedUntil=at(4000);
 // 정상 봉인/정산 값까지 다시 도출한 단축 원자료다. 임의 plan hash만 바꿔 맞추지 않는다.
 const input={originalRequest:f.request,context:f.context,ids:f.ids,eventValues:{sequence:1,recordedAt:at(0)},coverageGeneration:'7',receivedAt:f.rows.C.received_at};
 const seal=prepareSourceContentManagementStorage(input,epoch+3000);f.rows.R.plan_json=seal.plan;f.rows.R.plan_hash=seal.planHash;f.rows.R.reserved_bytes=Number(seal.reservedBytes);f.rows.R.authorized_until=p27(at(4000));
 const B=['O','E','C','A','U'].reduce((sum,k)=>sum+cost(f.rows[k]),0);let s=B;for(let i=0;i<64;i++){f.rows.R.settled_bytes=s;const next=B+cost(f.rows.R);if(next===s)break;s=next;}
 const current={...f.context,authorizedUntil:at(10000)},h=harness(f);await assert.rejects(h.store.commit(f.request,current,f.ids),unknown);
});
