import {types} from 'node:util';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {prepareSourceContentManagementOriginInput} from './source-content-policy-management-origin-input.ts';

const CAP=10737418240;
const STAMP='2000-01-01T00:00:00.000000Z';
const ZERO='0'.repeat(64),MAX_SEQUENCE='9223372036854775807';
const invalid=():never=>{throw Error('SOURCE_CONTENT_MANAGEMENT_STORAGE_INVALID');};
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
type Row=Record<string,unknown>;
type Five={O:Row;E:Row;C:Row;A:Row;U:Row};
function freeze<T>(v:T):T{if(v!==null&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
function copy(v:unknown,limit=8388608):unknown{
 const seen=new Set<object>();let count=0;
 function walk(x:unknown,depth:number):void{
  if(++count>200000||depth>64)return invalid();
  if(x===null||typeof x!=='object')return;
  if(types.isProxy(x)||seen.has(x)||![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(x)))return invalid();
  seen.add(x);for(const key of Reflect.ownKeys(x)){
   const d=Object.getOwnPropertyDescriptor(x,key);if(typeof key!=='string'||!d||!('value'in d))return invalid();walk(d.value,depth+1);
  }seen.delete(x);
 }
 walk(v,0);const raw=canonicalJson(v);if(Buffer.byteLength(raw)>limit)return invalid();return JSON.parse(raw);
}
function decimal(value:unknown,max=CAP,positive=false):number{
 if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(value)||BigInt(value)>BigInt(max)||(positive&&value==='0'))return invalid();return Number(value);
}
function physical(v:unknown):v is string{
 return typeof v==='string'&&v.length===27&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(v)&&isoV1(v.slice(0,23)+'Z');
}
const p27=(v:string)=>v.slice(0,-1)+'000Z';
const publicTime=(v:string)=>v.slice(0,23)+'Z';
function preparedInput(raw:unknown,nowMs:number){
 const f=copy(raw,2097152);
 if(!recordV1(f,['originalRequest','context','ids','eventValues','coverageGeneration','receivedAt'])||!physical(f.receivedAt))return invalid();
 decimal(f.coverageGeneration,Number.MAX_SAFE_INTEGER,true);
 const origin=prepareSourceContentManagementOriginInput(f.originalRequest,f.context,f.ids,f.eventValues,nowMs);
 // 수신은 원 Tx의 micro 시각이다. E의 ms 절삭값과 비교하지 않고 실제 done이 주어진 정산에서 검산한다.
 return {origin,coverageGeneration:f.coverageGeneration as string,receivedAt:f.receivedAt};
}
type Input=ReturnType<typeof preparedInput>;

// 입력 collector 경계: 시각은 UTC27자, U.server_sequence는 정확 십진문자열,
// 나머지 물리 정수는 safe 숫자다. SQL 원행을 JS에서 임의 parse/시간 변환하지 않는다.
// 최상위 수치 열만 문자열화하고 snapshot/request/result/plan 내부에는 재귀 적용하지 않는다.
function cost(row:Row){
 const result:Row={...row};
 for(const [key,value] of Object.entries(result)){
  if(typeof value==='number'&&/^(version|generation|.*_version|.*_generation|server_sequence|reserved_bytes|settled_bytes|start_fence)$/.test(key)){
   if(!Number.isSafeInteger(value))return invalid();result[key]=String(value);
  }else if(value!==null&&/(_at|_until)$/.test(key)&&!physical(value))return invalid();
 }
 // 이 exact 물리집합에 canonical 보조열이 없으므로 fn75_cost의 fields=0 분기와 같다.
 return Buffer.byteLength(canonicalJson(result));
}
function fiveRows(input:Input,done:string,auditSequence:string):Five{
 const v=input.origin,q=v.originalRequest,c=v.context,i=v.ids,S=v.policySnapshot,er=v.policyEventRef,previous=v.previousPolicyRef;
 const digest=hash({projectId:c.projectId,actorId:c.actorId,clientId:c.clientId,controlGeneration:c.controlGeneration,requestHash:v.requestHash,policyRef:c.permissionPolicyRef,targetRef:er});
 return {
  O:{project_id:c.projectId,id:i.originId,version:1,management_command_id:i.serverCommandId,policy_event_ref:er,request_json:q,request_hash:v.requestHash,recorded_at:p27(v.originSnapshot.recordedAt),content_hash:v.originRef.contentHash},
  E:{project_id:c.projectId,id:i.policyEventId,version:1,sequence:S.sequence,subject_user_id:c.actorId,disposition:q.payload.definition.disposition,snapshot_json:S,content_hash:er.contentHash,previous_ref:previous,management_command_id:i.serverCommandId,recorded_at:p27(S.recordedAt),expires_at:p27(q.payload.definition.expiresAt),previous_id:previous?.id??null,previous_version:previous?.version??null,previous_hash:previous?.contentHash??null},
  C:{id:i.serverCommandId,scope_kind:'PROJECT',scope_id:c.projectId,project_id:c.projectId,draft_id:null,actor_id:c.actorId,client_id:c.clientId,operation:'defineSourceContentPolicy',command_id:q.commandId,request_hash:v.requestHash,operation_id:i.operationId,state:'APPLIED',authorization_receipt_id:i.authorizationReceiptId,approval_consumption_id:null,expected_version:0,control_generation:c.controlGeneration,policy_ref:c.permissionPolicyRef,payload_ref:null,result_ref:{operationId:i.operationId,commandId:q.commandId,projectId:c.projectId,status:'APPLIED',targetId:er.id,version:1,data:{ref:er,status:'CONTENT_POLICY_EVENT_RECORDED',policyRef:er,previousPolicyRef:previous,sequence:S.sequence,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false},evidenceRefs:[],warnings:[],serverReceivedAt:publicTime(done)},received_at:input.receivedAt,completed_at:done},
  A:{id:i.authorizationReceiptId,scope_kind:'PROJECT',scope_id:c.projectId,command_id:i.serverCommandId,subject_ref:{kind:'HUMAN',userId:c.actorId,clientId:c.clientId},policy_ref:c.permissionPolicyRef,scope_digest:digest,approval_decision_ref:null,authorized_at:done},
  U:{project_id:c.projectId,server_sequence:auditSequence,event_id:i.auditEventId,actor_ref:{kind:'HUMAN',userId:c.actorId},client_ref:c.clientId,command_id:i.serverCommandId,operation_id:i.operationId,target_ref:er,policy_ref:c.permissionPolicyRef,approval_ref:null,outcome:'APPLIED',reason_code:'SOURCE_CONTENT_POLICY_EVENT_RECORDED',scope_digest:digest,recorded_at:done,source_kind:'HUMAN_COMMAND',correction_of:null}
 };
}
function planFor(input:Input,r:number){
 const v=input.origin,c=v.context;
 return {schemaVersion:1,purpose:'SOURCE_CONTENT_POLICY_MANAGEMENT_STORAGE',projectId:c.projectId,actorId:c.actorId,clientId:c.clientId,authSessionId:c.authSessionId,credentialGeneration:c.credentialGeneration,controlGeneration:c.controlGeneration,operation:'defineSourceContentPolicy',externalCommandId:v.originalRequest.commandId,requestHash:v.requestHash,permissionPolicyRef:c.permissionPolicyRef,originRef:v.originRef,policyEventRef:v.policyEventRef,ids:v.ids,coverageGeneration:input.coverageGeneration,authorizedUntil:c.authorizedUntil,transactionId:c.transactionId,parts:[{key:'management_origin',kind:'SOURCE_CONTENT_POLICY_MANAGEMENT',id:v.originRef.id,contentHash:v.originRef.contentHash,bytes:String(r),reservedBytes:String(r),settledBytes:String(r)}]};
}
type Plan=ReturnType<typeof planFor>;
type Phase='RESERVED'|'IO_STARTED'|'SETTLED';
function reservation(input:Input,plan:Plan,planHash:string,phase:Phase,r:number,s:number,createdAt=STAMP,startedAt=STAMP,settledAt=STAMP):Row{
 const v=input.origin,c=v.context,i=v.ids;
 const digest=hash({projectId:c.projectId,actorId:c.actorId,clientId:c.clientId,controlGeneration:c.controlGeneration,requestHash:v.requestHash,policyRef:c.permissionPolicyRef,targetRef:v.policyEventRef});
 return {id:i.serverCommandId,project_id:c.projectId,actor_id:c.actorId,client_id:c.clientId,external_command_id:v.originalRequest.commandId,operation:'defineSourceContentPolicy',command_hash:v.requestHash,part_key:'management_origin',part_kind:'SOURCE_CONTENT_POLICY_MANAGEMENT',plan_json:plan,plan_hash:planHash,reserved_bytes:r,settled_bytes:phase==='SETTLED'?s:0,phase,start_fence:phase==='RESERVED'?0:1,authorized_until:p27(c.authorizedUntil),server_command_id:phase==='SETTLED'?i.serverCommandId:null,authorization_receipt_id:phase==='SETTLED'?i.authorizationReceiptId:null,scope_digest:phase==='SETTLED'?digest:null,created_at:createdAt,started_at:phase==='RESERVED'?null:startedAt,settled_at:phase==='SETTLED'?settledAt:null};
}
function baseCost(rows:Five){return Object.values(rows).reduce((total,row)=>total+cost(row),0);}
function fixedPoint(base:number,input:Input,sealed?:{plan:Plan;planHash:string;r:number}){
 if(!Number.isSafeInteger(base)||base<0||base>CAP)return invalid();
 let value=base;
 // 금액은 최대11자리. 반복 중 비용 변화는 decimal 길이뿐이며 64회 내 미수렴은 거절한다.
 for(let iteration=0;iteration<64;iteration++){
  if(value>CAP||(sealed&&value>sealed.r))return invalid();
  let own:number;
  if(sealed)own=cost(reservation(input,sealed.plan,sealed.planHash,'SETTLED',sealed.r,value));
  else{
   const plan=planFor(input,value);
   own=Math.max(cost(reservation(input,plan,ZERO,'RESERVED',value,0)),cost(reservation(input,plan,ZERO,'IO_STARTED',value,0)),cost(reservation(input,plan,ZERO,'SETTLED',value,value)));
  }
  const next=Math.max(value,base+own);
  if(next>CAP||(sealed&&next>sealed.r))return invalid();
  if(next===value)return value;value=next;
 }
 return invalid();
}
function seal(input:Input){
 const maximumBytes=baseCost(fiveRows(input,STAMP,MAX_SEQUENCE));
 const r=fixedPoint(maximumBytes,input),plan=planFor(input,r);
 return freeze({status:'UNVERIFIED' as const,plan,planHash:hash(plan),maximumBytes:String(maximumBytes),reservedBytes:String(r),storageMutationPerformed:false as const});
}

/** 순수 PLAN 형상·비용 계산. 공급된 잠금 후 sequence는 확정값, U 순번만 19자리 상계다. 저장/예약 권한을 발급하지 않는다. */
export function prepareSourceContentManagementStorage(input:unknown,nowMs:number){
 try{return seal(preparedInput(input,nowMs));}catch{return invalid();}
}

/** exact 물리6행의 고정 투영을 대조한다. DB 수집·COMMIT·coverage 진위는 증명하지 않는다. */
export function inspectSourceContentManagementSettlement(input:unknown,sealedInput:unknown,actualInput:unknown,nowMs:number){
 try{
  const f=preparedInput(input,nowMs),expectedSeal=seal(f),given=copy(sealedInput),actual=copy(actualInput);
  if(!same(given,expectedSeal)||!recordV1(actual,['O','E','C','A','U','R'])||!recordV1(actual.C,Object.keys(fiveRows(f,STAMP,MAX_SEQUENCE).C))||!recordV1(actual.U,Object.keys(fiveRows(f,STAMP,MAX_SEQUENCE).U))||!recordV1(actual.R,Object.keys(reservation(f,expectedSeal.plan,expectedSeal.planHash,'SETTLED',0,0))))return invalid();
  const done=actual.C.completed_at,R=actual.R;
  if(!physical(done)||!physical(R.created_at)||!physical(R.started_at)||!physical(R.settled_at))return invalid();
  decimal(actual.U.server_sequence,Number.MAX_SAFE_INTEGER,true);
  const first=p27(f.origin.originSnapshot.recordedAt),until=p27(f.origin.context.authorizedUntil);
  if(f.receivedAt>done||first>R.created_at||R.created_at>R.started_at||R.started_at>done||done>R.settled_at||R.settled_at>=until||Date.parse(R.settled_at)>nowMs)return invalid();
  const expectedFive=fiveRows(f,done,actual.U.server_sequence);
  for(const kind of ['O','E','C','A','U'] as const)if(!same(actual[kind],expectedFive[kind]))return invalid();
  const B=baseCost(expectedFive),M=Number(expectedSeal.maximumBytes),r=Number(expectedSeal.reservedBytes);
  if(B>M)return invalid();
  const s=fixedPoint(B,f,{plan:expectedSeal.plan,planHash:expectedSeal.planHash,r});
  const expectedR=reservation(f,expectedSeal.plan,expectedSeal.planHash,'SETTLED',r,s,R.created_at,R.started_at,R.settled_at);
  if(!same(R,expectedR)||B+cost(expectedR)!==s)return invalid();
  return freeze({status:'UNVERIFIED' as const,maximumBytes:String(M),actualBytes:String(B),reservedBytes:String(r),settledBytes:String(s),planHash:expectedSeal.planHash,storageMutationPerformed:false as const});
 }catch{return invalid();}
}

/** U/H/O6는 기존 collector 공급값이다. 새 관리 actual을 U에 이중 가산하지 않는다. */
export function sourceContentManagementQuotaTransition(account:unknown,phase:'RESERVE'|'SETTLE',reservedBytes:unknown,settledBytes:unknown){
 try{
  const a=copy(account,4096);if(!recordV1(a,['usedBytes','heldBytes','otherBytes']))return invalid();
  let used=decimal(a.usedBytes),held=decimal(a.heldBytes);const other=decimal(a.otherBytes),r=decimal(reservedBytes),s=decimal(settledBytes);
  if(used+held+other>CAP||s>r)return invalid();
  if(phase==='RESERVE'){if(s!==0)return invalid();held+=r;}
  else if(phase==='SETTLE'){if(held<r)return invalid();used+=s;held-=r;}
  else return invalid();
  const total=used+held+other;if(total>CAP)return invalid();
  return freeze({usedBytes:String(used),heldBytes:String(held),otherBytes:String(other),totalBytes:String(total)});
 }catch{return invalid();}
}
