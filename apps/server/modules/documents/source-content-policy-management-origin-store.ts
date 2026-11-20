import {types} from 'node:util';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentManagementOriginSelection} from './source-content-policy-management-origin-input.ts';
import {prepareSourceContentManagementStorage,inspectSourceContentManagementSettlement} from './source-content-policy-management-storage.ts';
import {inspectSourceContentPolicyManagementWireCandidate} from './source-content-policy-management-wire.ts';

type Purpose='defineSourceContentPolicy'|'readSourceContentPolicyManagementOrigin';
export interface SourceContentManagementRpcCall {
 readonly name:'fn03_source_content_management_commit'|'fn03_source_content_management_read';
 readonly args:readonly unknown[];
}
/** 검산 전용 포트. 실제 Access/query/XID/현재 인가는 업무C의 원 callback이 공급해야 한다.
 * 기본 구현·Pool/SQL 실행기는 없으며, 포트 반환을 인증 또는 COMMIT 증명으로 발급하지 않는다. */
export interface SourceContentManagementStorePorts {
 now:()=>number;
 assertCurrent:(scope:Readonly<{context:unknown;call:SourceContentManagementRpcCall}>)=>Promise<void>;
 invoke:(call:SourceContentManagementRpcCall)=>Promise<unknown>;
}
const invalid=():never=>{throw Error('SOURCE_CONTENT_MANAGEMENT_STORE_INVALID');};
const unknown=():never=>{throw Error('SOURCE_CONTENT_MANAGEMENT_STORE_OUTCOME_UNKNOWN');};
const contextKeys=['operation','projectId','actorId','clientId','authSessionId','credentialGeneration','controlGeneration','permissionPolicyRef','transactionId','authorizedUntil'];
const idsKeys=['serverCommandId','operationId','authorizationReceiptId','auditEventId','policyEventId','originId'];
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function freeze<T>(v:T):T{if(v!==null&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
function copy(value:unknown,limit:number):unknown{
 const seen=new Set<object>();let nodes=0;
 const visit=(v:unknown,depth:number):void=>{
  if(++nodes>200000||depth>64)return invalid();if(v===null||typeof v!=='object')return;
  if(types.isProxy(v)||seen.has(v)||![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(v)))return invalid();seen.add(v);
  for(const key of Reflect.ownKeys(v)){const d=Object.getOwnPropertyDescriptor(v,key);if(typeof key!=='string'||!d||!('value'in d))return invalid();visit(d.value,depth+1);}seen.delete(v);
 };
 visit(value,0);const raw=canonicalJson(value);if(Buffer.byteLength(raw)>limit)return invalid();return freeze(JSON.parse(raw));
}
function context(raw:unknown,purpose:Purpose){
 const c=copy(raw,4096);
 if(!recordV1(c,contextKeys)||c.operation!==purpose||![c.projectId,c.actorId,c.clientId,c.authSessionId].every(uuidV1)||!refV1(c.permissionPolicyRef)||
  !Number.isSafeInteger(c.credentialGeneration)||c.credentialGeneration<1||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||!isoV1(c.authorizedUntil)||
  typeof c.transactionId!=='string'||!/^[1-9][0-9]{0,19}$/.test(c.transactionId)||BigInt(c.transactionId)>18446744073709551615n)return invalid();
 return c;
}
function physical(value:unknown):value is string{return typeof value==='string'&&value.length===27&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value)&&isoV1(value.slice(0,23)+'Z');}
const iso=(v:string)=>v.slice(0,23)+'Z';
function eventView(e:Record<string,any>){
 if(!physical(e.recorded_at)||!physical(e.expires_at))return invalid();
 return {project_id:e.project_id,id:e.id,version:e.version,sequence:e.sequence,subject_user_id:e.subject_user_id,disposition:e.disposition,recorded_at:iso(e.recorded_at),expires_at:iso(e.expires_at),snapshot_json:e.snapshot_json,content_hash:e.content_hash,previous_ref:e.previous_ref,management_command_id:e.management_command_id};
}
function inspectRows(value:Record<string,any>){
 const rows=value.rows;
 if(!recordV1(rows,['O','E','C','A','U','R']))return invalid();
 for(const row of Object.values(rows))if(!row||typeof row!=='object'||Array.isArray(row))return invalid();
 const {O,E,C,A,U,R}=rows,plan=R.plan_json;
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||!physical(R.settled_at)||!physical(C.received_at)||!physical(C.completed_at)||!physical(E.recorded_at)||!physical(O.recorded_at)||!physical(U.recorded_at))return invalid();
 // 실제 현재 시각으로 과거 기한을 다시 판정하지 않는다. 검산된 원 정착 시각은 불변 비용 검산에만 사용한다.
 // 물리행 순서/원 수명/plan 전체와 hash는 아래 기존 A/B에서 다시 검산한다.
 const historyTime=Date.parse(iso(R.settled_at));
 const historicalContext={operation:'defineSourceContentPolicy',projectId:plan.projectId,actorId:plan.actorId,clientId:plan.clientId,authSessionId:plan.authSessionId,credentialGeneration:plan.credentialGeneration,controlGeneration:plan.controlGeneration,permissionPolicyRef:plan.permissionPolicyRef,transactionId:plan.transactionId,authorizedUntil:plan.authorizedUntil};
 const input={originalRequest:O.request_json,context:historicalContext,ids:plan.ids,eventValues:{sequence:E.sequence,recordedAt:iso(E.recorded_at),originRecordedAt:iso(O.recorded_at)},coverageGeneration:plan.coverageGeneration,receivedAt:C.received_at};
 const sealed=prepareSourceContentManagementStorage(input,historyTime);
 inspectSourceContentManagementSettlement(input,sealed,rows,historyTime);
 // E/O 각각의 원 ms 시각·hash를 보존한다. 원 물리행의 비-ms 부분은 A/B exact 행 대조에서 거절한다.
 const policyEvent=eventView(E),command={id:C.id,scopeKind:C.scope_kind,scopeId:C.scope_id,projectId:C.project_id,actorId:C.actor_id,clientId:C.client_id,operation:C.operation,commandId:C.command_id,requestHash:C.request_hash,operationId:C.operation_id,state:C.state,authorizationReceiptId:C.authorization_receipt_id,approvalConsumptionId:C.approval_consumption_id,expectedVersion:C.expected_version,controlGeneration:C.control_generation,policyRef:C.policy_ref,payloadRef:C.payload_ref,resultRef:C.result_ref,completedAt:iso(C.completed_at)};
 const receipt={id:A.id,scopeKind:A.scope_kind,scopeId:A.scope_id,commandId:A.command_id,subjectRef:A.subject_ref,policyRef:A.policy_ref,scopeDigest:A.scope_digest,approvalDecisionRef:A.approval_decision_ref};
 const audit={projectId:U.project_id,serverSequence:Number(U.server_sequence),eventId:U.event_id,actorRef:U.actor_ref,clientRef:U.client_ref,commandId:U.command_id,operationId:U.operation_id,targetRef:U.target_ref,policyRef:U.policy_ref,approvalRef:U.approval_ref,outcome:U.outcome,reasonCode:U.reason_code,scopeDigest:U.scope_digest,sourceKind:U.source_kind,correctionOf:U.correction_of,recordedAt:iso(U.recorded_at)};
 const evidence={previousEvent:value.previousEvent,policyEvent,originalRequest:O.request_json,command,receipt,audit};
 const expected={projectId:C.project_id,policyRef:plan.policyEventRef,previousPolicyRef:E.previous_ref,managementCommandId:C.id,actorId:C.actor_id,clientId:C.client_id,controlGeneration:C.control_generation,basePolicyRef:C.policy_ref};
 inspectSourceContentPolicyManagementWireCandidate(canonicalJson(evidence),expected);
 return {rows,plan,historicalContext,selection:{originRef:plan.originRef,policyEventRef:plan.policyEventRef,managementCommandId:C.id}};
}

/** 내부 목적 호출 1회용 수명. 실패·불명 뒤 재조회/재시도/정리를 자동 수행하지 않는다. */
export function createSourceContentManagementOriginStore(ports:SourceContentManagementStorePorts){
 if(types.isProxy(ports)||!recordV1(ports,['now','assertCurrent','invoke'])||![ports.now,ports.assertCurrent,ports.invoke].every(f=>typeof f==='function'))return invalid();
 const now=ports.now,assertCurrent=ports.assertCurrent,invoke=ports.invoke;let spent=false,lastTime=-1;
 function clock(c:Record<string,any>){
  if(!recordV1(ports,['now','assertCurrent','invoke'])||ports.now!==now||ports.assertCurrent!==assertCurrent||ports.invoke!==invoke)return invalid();
  const t=now();if(!Number.isSafeInteger(t)||t<0||t<lastTime||t>=Date.parse(c.authorizedUntil))return invalid();lastTime=t;return t;
 }
 async function run(purpose:Purpose,raw:unknown,rawContext:unknown,rawIds?:unknown){
  if(spent)return invalid();spent=true;let invoked=false;
  try{
   const c=context(rawContext,purpose),t=clock(c),isCommit=purpose==='defineSourceContentPolicy';
   const v=copy(raw,isCommit?1048576:4096);let ids:Record<string,any>|undefined;
   if(isCommit){
    const i=copy(rawIds,4096);if(!recordV1(i,idsKeys)||!Object.values(i).every(uuidV1)||new Set(Object.values(i)).size!==6)return invalid();ids=i;
    if(!recordV1(v,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||v.schemaVersion!==1||v.projectId!==c.projectId||v.clientId!==c.clientId||v.controlGeneration!==c.controlGeneration||v.operation!==purpose||!uuidV1(v.commandId)||v.targetId!==null||v.expectedVersion!==0||!same(v.baselineRefs,[])||v.approvalRef!==null||!recordV1(v.payload,['previousPolicyRef','definition','reason']))return invalid();
   }else readSourceContentManagementOriginSelection(v,c,t);
   const call:SourceContentManagementRpcCall=freeze(isCommit?{name:'fn03_source_content_management_commit',args:[c.authSessionId,c.actorId,c.clientId,c.projectId,v,c.permissionPolicyRef,ids,c.transactionId,c.authorizedUntil]}:{name:'fn03_source_content_management_read',args:[c.authSessionId,c.actorId,c.clientId,c.projectId,c.controlGeneration,c.permissionPolicyRef,v,c.transactionId]});
   const scope=freeze({context:c,call});
   if(await assertCurrent(scope)!==undefined)return invalid();clock(c);
   invoked=true;const response=copy(await invoke(call),8388608);clock(c);
   // 반환값을 검사하기 전에도 원 Access/Tx current가 유지되어야 한다. boolean VERIFIED는 받지 않는다.
   if(await assertCurrent(scope)!==undefined)return invalid();clock(c);
   if(!isCommit&&recordV1(response,['status','transactionId'])&&response.status==='ORIGIN_ABSENT'&&response.transactionId===c.transactionId)return freeze({kind:'ORIGIN_ABSENT' as const});
   if(!recordV1(response,['status','transactionId','previousEvent','rows'])||response.transactionId!==c.transactionId||response.status!==(isCommit?'RECORDED':'FOUND'))return invalid();
   const inspected=inspectRows(response);
   if(inspected.plan.projectId!==c.projectId||Date.parse(iso(inspected.rows.R.settled_at))>clock(c))return invalid();
   if(isCommit){
    const original=inspected.historicalContext;
    if(!same(inspected.rows.O.request_json,v)||!same(inspected.plan.ids,ids)||!same({...original,authorizedUntil:c.authorizedUntil},c)||Date.parse(original.authorizedUntil)>Date.parse(c.authorizedUntil))return invalid();
    if(clock(c)>=Date.parse(original.authorizedUntil))return invalid();
    return freeze({kind:'RECORDED' as const,result:inspected.rows.C.result_ref});
   }
   if(!same(inspected.selection,v))return invalid();clock(c);
   return freeze({kind:'FOUND' as const,value:{...inspected.selection,requestHash:inspected.rows.O.request_hash,authority:'UNVERIFIED' as const}});
  }catch{if(invoked)return unknown();return invalid();}
 }
 return Object.freeze({commit:(request:unknown,c:unknown,ids:unknown)=>run('defineSourceContentPolicy',request,c,ids),read:(selection:unknown,c:unknown)=>run('readSourceContentPolicyManagementOrigin',selection,c)});
}
