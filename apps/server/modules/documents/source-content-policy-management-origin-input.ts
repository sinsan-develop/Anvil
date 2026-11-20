import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {buildSourceContentPolicySnapshotCandidate} from './source-content-policy-definition.ts';

const invalid=():never=>{throw Error('SOURCE_CONTENT_MANAGEMENT_ORIGIN_INPUT_INVALID');};
const requestKeys=['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'];
const contextKeys=['operation','projectId','actorId','clientId','authSessionId','credentialGeneration','controlGeneration','permissionPolicyRef','transactionId','authorizedUntil'];
const idKeys=['serverCommandId','operationId','authorizationReceiptId','auditEventId','policyEventId','originId'];
const unverified={status:'UNVERIFIED' as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const};

// canonicalJson/recordV1보다 먼저 Proxy와 accessor를 거절한다. 사용자 getter/trap을 평가하지 않는다.
function plainInput(value:unknown){
 const seen=new Set<object>();let nodes=0;
 function visit(v:unknown,depth:number):void{
  if(++nodes>100000||depth>64)return invalid();
  if(v===null||typeof v!=='object')return;
  if(types.isProxy(v)||seen.has(v))return invalid();
  const proto=Object.getPrototypeOf(v);
  if(proto!==Object.prototype&&proto!==Array.prototype&&proto!==null)return invalid();
  seen.add(v);
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string')return invalid();
   const descriptor=Object.getOwnPropertyDescriptor(v,key);
   if(!descriptor||!('value' in descriptor))return invalid();
   visit(descriptor.value,depth+1);
  }
  seen.delete(v);
 }
 visit(value,0);
}
function copy(value:unknown,limit:number):unknown{
 if(typeof value==='string'){
  if(Buffer.byteLength(value,'utf8')>limit)return invalid();
  value=parseWireJson(value);
 }
 plainInput(value);
 const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>limit)return invalid();
 return JSON.parse(raw);
}
function freeze<T>(value:T):T{
 if(value!==null&&typeof value==='object'){
  for(const child of Object.values(value))freeze(child);
  Object.freeze(value);
 }
 return value;
}
function contextInput(value:unknown,operation:string,nowMs:number){
 const c=copy(value,4096);
 if(!recordV1(c,contextKeys)||c.operation!==operation||![c.projectId,c.actorId,c.clientId,c.authSessionId].every(uuidV1)||
  !Number.isSafeInteger(c.credentialGeneration)||c.credentialGeneration<1||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||
  !refV1(c.permissionPolicyRef)||typeof c.transactionId!=='string'||!/^[1-9][0-9]{0,19}$/.test(c.transactionId)||
  BigInt(c.transactionId)>18446744073709551615n||!isoV1(c.authorizedUntil)||!Number.isSafeInteger(nowMs)||nowMs<0||nowMs>=Date.parse(c.authorizedUntil))return invalid();
 return c;
}

/** 업무A의 순수 입력 검산. 문맥/시각은 공급 자료이며 실제 접근 허가·같은 DB 거래·잠금 후 clock을 증명하지 않는다. */
export function prepareSourceContentManagementOriginInput(originalRequest:unknown,context:unknown,ids:unknown,eventValues:unknown,nowMs:number){
 try{
  const q=copy(originalRequest,1048576),c=contextInput(context,'defineSourceContentPolicy',nowMs),i=copy(ids,4096),e=copy(eventValues,4096);
  if(!recordV1(q,requestKeys)||q.schemaVersion!==1||q.operation!=='defineSourceContentPolicy'||q.projectId!==c.projectId||q.clientId!==c.clientId||q.controlGeneration!==c.controlGeneration||
   !uuidV1(q.commandId)||q.targetId!==null||q.expectedVersion!==0||!Array.isArray(q.baselineRefs)||q.baselineRefs.length!==0||q.approvalRef!==null||
   !recordV1(i,idKeys)||!Object.values(i).every(uuidV1)||new Set(Object.values(i)).size!==6||
   !recordV1(e,['sequence','recordedAt'])||!isoV1(e.recordedAt)||Date.parse(e.recordedAt)>nowMs)return invalid();
  const candidate=buildSourceContentPolicySnapshotCandidate(q.payload,{projectId:c.projectId,actorId:c.actorId,sequence:e.sequence,recordedAt:e.recordedAt});
  const requestHash=contentHash(canonicalJson(q));
  const policyEventRef={id:i.policyEventId,version:1,contentHash:candidate.contentHash};
  const originSnapshot={schemaVersion:1,purpose:'SOURCE_CONTENT_POLICY_MANAGEMENT_ORIGIN',id:i.originId,version:1,projectId:c.projectId,managementCommandId:i.serverCommandId,policyEventRef,originalRequest:q,requestHash,recordedAt:e.recordedAt};
  const originRaw=canonicalJson(originSnapshot);if(Buffer.byteLength(originRaw,'utf8')>2097152)return invalid();
  return freeze({...unverified,originalRequest:q,context:c,ids:i,policySnapshot:candidate.snapshot,previousPolicyRef:candidate.previousPolicyRef,policyEventRef,requestHash,originSnapshot,originRef:{id:i.originId,version:1,contentHash:contentHash(originRaw)}});
 }catch{return invalid();}
}

/** 내부 exact3 선택의 형식/읽기 목적만 검산한다. ref의 실제 프로젝트 귀속은 후속 보호 저장 판독이 검산한다. */
export function readSourceContentManagementOriginSelection(selection:unknown,context:unknown,nowMs:number){
 try{
  const s=copy(selection,4096),c=contextInput(context,'readSourceContentPolicyManagementOrigin',nowMs);
  if(!recordV1(s,['originRef','policyEventRef','managementCommandId'])||!refV1(s.originRef)||s.originRef.version!==1||!refV1(s.policyEventRef)||s.policyEventRef.version!==1||!uuidV1(s.managementCommandId))return invalid();
  return freeze({...unverified,selection:s,context:c});
 }catch{return invalid();}
}
