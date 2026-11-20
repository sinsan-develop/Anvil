import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {prepareSourceContentManagementOriginInput} from '../../../apps/server/modules/documents/source-content-policy-management-origin-input.ts';
const modulePath='../../../apps/server/modules/documents/source-content-policy-management-storage.ts';
const api=await import(modulePath).catch((e:unknown)=>{if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`8a000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const at='2026-11-20T00:00:00.000Z',now=Date.parse(at)+5000;
const p27=(v:string)=>v.slice(0,-1)+'000Z';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=(f:()=>unknown)=>assert.throws(f,{message:'SOURCE_CONTENT_MANAGEMENT_STORAGE_INVALID'});
function input(){return {
 originalRequest:{schemaVersion:1,projectId:id(1),commandId:id(6),clientId:id(3),controlGeneration:3,operation:'defineSourceContentPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:id(2),disposition:'AUTO',expiresAt:'2027-11-20T00:00:00.000Z',allowedOperations:['requestSourceContentHash'],sourceRootRef:ref(20),connectorRef:ref(21),registrationRef:ref(22),observerRef:ref(23),targets:[{relativePath:'src/a.ts',documentRef:ref(24),documentBlobRef:{artifactId:id(25),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'합성 정산'}},
 context:{operation:'defineSourceContentPolicy',projectId:id(1),actorId:id(2),clientId:id(3),authSessionId:id(4),credentialGeneration:2,controlGeneration:3,permissionPolicyRef:ref(5),transactionId:'9007199254740993',authorizedUntil:'2026-11-20T00:00:10.000Z'},
 ids:{serverCommandId:id(10),operationId:id(11),authorizationReceiptId:id(12),auditEventId:id(13),policyEventId:id(14),originId:id(15)},
 eventValues:{sequence:1,recordedAt:at},coverageGeneration:'7',receivedAt:'2026-11-19T23:59:59.999123Z'};}
// SQL cost_projection의 정규화된 물리행만 비용으로 센 독립 fixture. 원 JSON 중첩 값은 그대로다.
function cost(row:Record<string,unknown>){const v={...row};for(const key of Object.keys(v)){if(typeof v[key]==='number'&&/^(version|generation|.*_version|.*_generation|server_sequence|reserved_bytes|settled_bytes|start_fence)$/.test(key))v[key]=String(v[key]);}return Buffer.byteLength(canonicalJson(v));}
function rows(f=input()){
 const v=prepareSourceContentManagementOriginInput(f.originalRequest,f.context,f.ids,f.eventValues,now),q=f.originalRequest,c=f.context,i=f.ids,S=v.policySnapshot,er=v.policyEventRef;
 const done='2026-11-20T00:00:02.001234Z',donePublic='2026-11-20T00:00:02.001Z';
 const digest=hash({projectId:c.projectId,actorId:c.actorId,clientId:c.clientId,controlGeneration:c.controlGeneration,requestHash:v.requestHash,policyRef:c.permissionPolicyRef,targetRef:er});
 return {
 O:{project_id:c.projectId,id:i.originId,version:1,management_command_id:i.serverCommandId,policy_event_ref:er,request_json:q,request_hash:v.requestHash,recorded_at:p27(v.originSnapshot.recordedAt),content_hash:v.originRef.contentHash},
  E:{project_id:c.projectId,id:i.policyEventId,version:1,sequence:1,subject_user_id:c.actorId,disposition:'AUTO',snapshot_json:S,content_hash:er.contentHash,previous_ref:null,management_command_id:i.serverCommandId,recorded_at:p27(at),expires_at:p27(q.payload.definition.expiresAt),previous_id:null,previous_version:null,previous_hash:null},
 C:{id:i.serverCommandId,scope_kind:'PROJECT',scope_id:c.projectId,project_id:c.projectId,draft_id:null,actor_id:c.actorId,client_id:c.clientId,operation:q.operation,command_id:q.commandId,request_hash:v.requestHash,operation_id:i.operationId,state:'APPLIED',authorization_receipt_id:i.authorizationReceiptId,approval_consumption_id:null,expected_version:0,control_generation:3,policy_ref:c.permissionPolicyRef,payload_ref:null,result_ref:{operationId:i.operationId,commandId:q.commandId,projectId:c.projectId,status:'APPLIED',targetId:er.id,version:1,data:{ref:er,status:'CONTENT_POLICY_EVENT_RECORDED',policyRef:er,previousPolicyRef:null,sequence:1,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false},evidenceRefs:[],warnings:[],serverReceivedAt:donePublic},received_at:f.receivedAt,completed_at:done},
 A:{id:i.authorizationReceiptId,scope_kind:'PROJECT',scope_id:c.projectId,command_id:i.serverCommandId,subject_ref:{kind:'HUMAN',userId:c.actorId,clientId:c.clientId},policy_ref:c.permissionPolicyRef,scope_digest:digest,approval_decision_ref:null,authorized_at:done},
 U:{project_id:c.projectId,server_sequence:'19',event_id:i.auditEventId,actor_ref:{kind:'HUMAN',userId:c.actorId},client_ref:c.clientId,command_id:i.serverCommandId,operation_id:i.operationId,target_ref:er,policy_ref:c.permissionPolicyRef,approval_ref:null,outcome:'APPLIED',reason_code:'SOURCE_CONTENT_POLICY_EVENT_RECORDED',scope_digest:digest,recorded_at:done,source_kind:'HUMAN_COMMAND',correction_of:null}
 };}
function settled(f=input()){
 const seal=api.prepareSourceContentManagementStorage(f,now),five=rows(f),i=f.ids,c=f.context;
 const R={id:i.serverCommandId,project_id:c.projectId,actor_id:c.actorId,client_id:c.clientId,external_command_id:f.originalRequest.commandId,operation:'defineSourceContentPolicy',command_hash:hash(f.originalRequest),part_key:'management_origin',part_kind:'SOURCE_CONTENT_POLICY_MANAGEMENT',plan_json:seal.plan,plan_hash:seal.planHash,reserved_bytes:Number(seal.reservedBytes),settled_bytes:0,phase:'SETTLED',start_fence:1,authorized_until:p27(c.authorizedUntil),server_command_id:i.serverCommandId,authorization_receipt_id:i.authorizationReceiptId,scope_digest:five.A.scope_digest,created_at:'2026-11-20T00:00:00.000111Z',started_at:'2026-11-20T00:00:01.000222Z',settled_at:'2026-11-20T00:00:03.000333Z'};
 const B=Object.values(five).reduce((sum,row)=>sum+cost(row),0);let s=B;
 for(let k=0;k<64;k++){R.settled_bytes=s;const next=B+cost(R);if(next===s)break;s=next;}
 return {seal,actual:{...five,R},B,s};
}
test('봉인 PLAN의 exact19/단일 part와 물리5행+R 정산의 유한 고정점',()=>{
 const f=input(),{seal,actual,B,s}=settled(f),before=canonicalJson(seal);
 assert.equal(Object.keys(seal.plan).length,19);assert.equal(seal.planHash,hash(seal.plan));assert.ok(Object.isFrozen(seal.plan.parts[0]));
 assert.equal(seal.plan.parts[0].bytes,seal.reservedBytes);assert.equal(seal.plan.parts[0].settledBytes,seal.reservedBytes);
 const result=api.inspectSourceContentManagementSettlement(f,seal,actual,now);
 assert.equal(result.actualBytes,String(B));assert.equal(result.settledBytes,String(s));assert.ok(s<=Number(seal.reservedBytes));assert.ok(B<=Number(seal.maximumBytes));
 assert.equal(result.status,'UNVERIFIED');assert.equal(result.storageMutationPerformed,false);assert.equal(canonicalJson(seal),before);
 const previous={...actual.R,settled_bytes:s-1};assert.ok(B+cost(previous)>s-1);
 assert.deepEqual(Object.values(actual).map(r=>Object.keys(r).length),[9,15,21,9,16,22]);
});

test('같은 ms의 수신 micro는 E보다 뒤여도 done 이전이면 정상이며 E/O 원시각과 비용을 각각 보존한다',()=>{
 const f:any=input();f.eventValues.originRecordedAt='2026-11-20T00:00:00.001Z';f.receivedAt='2026-11-20T00:00:00.000123Z';
 const {seal,actual,B,s}=settled(f);actual.R.created_at='2026-11-20T00:00:00.002111Z';
 const result=api.inspectSourceContentManagementSettlement(f,seal,actual,now);
 assert.equal(actual.E.recorded_at,p27(at));assert.equal(actual.O.recorded_at,p27(f.eventValues.originRecordedAt));
 assert.equal(result.actualBytes,String(B));assert.equal(result.settledBytes,String(s));assert.equal(result.planHash,seal.planHash);
 for(const mutate of [(x:any)=>x.O.recorded_at=x.E.recorded_at,(x:any)=>x.O.content_hash=x.E.content_hash,(x:any)=>x.R.created_at=x.E.recorded_at,(x:any)=>x.R.started_at=x.E.recorded_at,(x:any)=>x.R.settled_at=x.R.started_at]){
  const changed=structuredClone(actual);mutate(changed);fail(()=>api.inspectSourceContentManagementSettlement(f,seal,changed,now));
 }
 const late={...f,receivedAt:'2026-11-20T00:00:02.001235Z'},lateRows=settled(late);lateRows.actual.R.created_at=actual.R.created_at;
 fail(()=>api.inspectSourceContentManagementSettlement(late,lateRows.seal,lateRows.actual,now));
 const reversed={...f,eventValues:{...f.eventValues,originRecordedAt:'2026-11-19T23:59:59.999Z'}};fail(()=>api.prepareSourceContentManagementStorage(reversed,now));
});
test('물리 정규화는 최상위만 적용하고 원문/결과/plan 실복제 및 null 키를 각각 센다',()=>{
 const {actual,B}=settled();const inspected=api.inspectSourceContentManagementSettlement(input(),api.prepareSourceContentManagementStorage(input(),now),actual,now);
 assert.equal(Number(inspected.actualBytes),B);assert.equal(typeof actual.O.request_json.controlGeneration,'number');assert.equal(typeof actual.E.snapshot_json.sequence,'number');
 for(const kind of ['O','E','C','A','U','R'] as const){const changed=structuredClone(actual);delete (changed[kind] as Record<string,unknown>)[Object.keys(changed[kind])[0]!];fail(()=>api.inspectSourceContentManagementSettlement(input(),api.prepareSourceContentManagementStorage(input(),now),changed,now));}
 const extra={...actual,duplicateAudit:actual.U};fail(()=>api.inspectSourceContentManagementSettlement(input(),api.prepareSourceContentManagementStorage(input(),now),extra,now));
});
test('봉인 hash/part/r/coverage와 다른 scope·새 비용열·물리시각 오염 거절',()=>{
 const f=input(),{seal,actual}=settled(f);
 for(const mutate of [(x:any)=>x.plan.parts[0].settledBytes=actual.R.settled_bytes.toString(),(x:any)=>x.plan.coverageGeneration='8',(x:any)=>x.reservedBytes='0',(x:any)=>x.planHash='0'.repeat(64)]){const x=structuredClone(seal);mutate(x);fail(()=>api.inspectSourceContentManagementSettlement(f,x,actual,now));}
 for(const mutate of [(x:any)=>x.R.plan_hash='0'.repeat(64),(x:any)=>x.R.plan_json.parts[0].bytes='0',(x:any)=>x.U.command_id=id(99),(x:any)=>x.C.request_canonical='extra',(x:any)=>x.C.completed_at='2026-11-20T00:00:02.001Z',(x:any)=>x.E.previous_id=id(99),(x:any)=>x.R.settled_bytes++]){const x=structuredClone(actual);mutate(x);fail(()=>api.inspectSourceContentManagementSettlement(f,seal,x,now));}
});
test('raw micro 시각 순서/기한과 bigint projection의 유한 범위를 보존',()=>{
 const f=input(),{seal,actual}=settled(f);
 for(const mutate of [(x:any)=>x.R.started_at=x.R.settled_at,(x:any)=>x.A.authorized_at='2026-11-20T00:00:02.001235Z',(x:any)=>x.R.settled_at='2026-11-20T00:00:10.000000Z',(x:any)=>x.R.settled_at='2026-11-20T00:00:06.000000Z',(x:any)=>x.U.server_sequence='9007199254740992',(x:any)=>x.U.server_sequence='019']){const x=structuredClone(actual);mutate(x);fail(()=>api.inspectSourceContentManagementSettlement(f,seal,x,now));}
 fail(()=>api.inspectSourceContentManagementSettlement(f,seal,actual,Date.parse(f.context.authorizedUntil)));
 for(const coverageGeneration of [7,'0','07','9007199254740992'])fail(()=>api.prepareSourceContentManagementStorage({...f,coverageGeneration},now));
});
test('10GiB U/H/O6 식은 관리비용을 한 번만 계상하고 초과·held 부족·숫자강제변환을 거절',()=>{
 const CAP=10737418240n;
 assert.deepEqual(api.sourceContentManagementQuotaTransition({usedBytes:'100',heldBytes:'50',otherBytes:'20'},'RESERVE','30','0'),{usedBytes:'100',heldBytes:'80',otherBytes:'20',totalBytes:'200'});
 assert.deepEqual(api.sourceContentManagementQuotaTransition({usedBytes:'100',heldBytes:'80',otherBytes:'20'},'SETTLE','30','25'),{usedBytes:'125',heldBytes:'50',otherBytes:'20',totalBytes:'195'});
 assert.equal(api.sourceContentManagementQuotaTransition({usedBytes:String(CAP-1n),heldBytes:'0',otherBytes:'0'},'RESERVE','1','0').totalBytes,String(CAP));
 for(const values of [{usedBytes:String(CAP),heldBytes:'0',otherBytes:'0'},{usedBytes:0,heldBytes:'0',otherBytes:'0'},{usedBytes:'00',heldBytes:'0',otherBytes:'0'}])fail(()=>api.sourceContentManagementQuotaTransition(values,'RESERVE','1','0'));
 fail(()=>api.sourceContentManagementQuotaTransition({usedBytes:'0',heldBytes:'29',otherBytes:'0'},'SETTLE','30','25'));
 fail(()=>api.sourceContentManagementQuotaTransition({usedBytes:'0',heldBytes:'30',otherBytes:'0'},'SETTLE','30','31'));
});
test('Proxy/getter 평가0 및 await 뒤 원 입력 변경·재정산 plan 바꿔치기 거절',async()=>{
 let calls=0;fail(()=>api.prepareSourceContentManagementStorage(new Proxy(input(),{ownKeys(){calls++;return [];}}),now));
 fail(()=>api.prepareSourceContentManagementStorage({...input(),get coverageGeneration(){calls++;return '7';}},now));assert.equal(calls,0);
 const f=input(),{seal,actual}=settled(f),before=canonicalJson(seal);await Promise.resolve();f.originalRequest.payload.reason='변경';
 assert.equal(canonicalJson(seal),before);fail(()=>api.inspectSourceContentManagementSettlement(f,seal,actual,now));
});
test('예약 r는 세 phase 최대 자기비용의 최소고정점이며 Unicode/큰 sequence/이전 ref 분기에도 봉인한다',()=>{
 for(const n of [1,2,9007199254740991]){
  const f:any=input();f.eventValues.sequence=n;
  if(n>1)f.originalRequest.payload.previousPolicyRef=ref(30);
  f.originalRequest.payload.reason='한글 "\\ 경계'.repeat(n===1?1:400);
  const seal=api.prepareSourceContentManagementStorage(f,now),v=prepareSourceContentManagementOriginInput(f.originalRequest,f.context,f.ids,f.eventValues,now);
  const template:any=rows();template.O={...template.O,request_json:f.originalRequest,request_hash:v.requestHash,content_hash:v.originRef.contentHash,policy_event_ref:v.policyEventRef};
  template.E={...template.E,sequence:n,snapshot_json:v.policySnapshot,content_hash:v.policyEventRef.contentHash,previous_ref:v.previousPolicyRef,previous_id:v.previousPolicyRef?.id??null,previous_version:v.previousPolicyRef?.version??null,previous_hash:v.previousPolicyRef?.contentHash??null};
  template.C.request_hash=v.requestHash;template.C.result_ref.targetId=v.policyEventRef.id;template.C.result_ref.data={...template.C.result_ref.data,ref:v.policyEventRef,policyRef:v.policyEventRef,previousPolicyRef:v.previousPolicyRef,sequence:n};
  template.C.completed_at=template.A.authorized_at=template.U.recorded_at='2000-01-01T00:00:00.000000Z';template.C.result_ref.serverReceivedAt='2000-01-01T00:00:00.000Z';template.U.server_sequence='9223372036854775807';template.U.target_ref=v.policyEventRef;
  const M=Object.values(template).reduce<number>((sum,row)=>sum+cost(row as Record<string,unknown>),0);assert.equal(seal.maximumBytes,String(M));
  const R:any=settled().actual.R;R.plan_json=structuredClone(seal.plan);R.plan_hash='0'.repeat(64);R.command_hash=v.requestHash;
  const maximum=(r:number)=>{
   for(const key of ['bytes','reservedBytes','settledBytes'])R.plan_json.parts[0][key]=String(r);
   return Math.max(...['RESERVED','IO_STARTED','SETTLED'].map(phase=>cost({...R,reserved_bytes:r,settled_bytes:phase==='SETTLED'?r:0,phase,start_fence:phase==='RESERVED'?0:1,started_at:phase==='RESERVED'?null:R.started_at,settled_at:phase==='SETTLED'?R.settled_at:null,server_command_id:phase==='SETTLED'?R.id:null,authorization_receipt_id:phase==='SETTLED'?R.authorization_receipt_id:null,scope_digest:phase==='SETTLED'?R.scope_digest:null})));
  };
  const r=Number(seal.reservedBytes);assert.equal(M+maximum(r),r);assert.ok(M+maximum(r-1)>r-1);
 }
});
