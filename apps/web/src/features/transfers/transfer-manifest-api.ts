import {ApiClient,ApiError} from '../../api/client.ts';
import {validRef} from '../connections/api.ts';
import {browserCanonical as canonical,exact,iso,uuid,wireHash} from '../control-handoff/api.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {preparationKey,readPreparationRecord,type PreparationGet} from './preparation-record-api.ts';

const gaps=['COMPLETED_UNVERIFIED','UNFINISHED_UNVERIFIED','CURRENT_POSITION_UNVERIFIED','DECISIONS_WITH_REASONS_UNVERIFIED'];
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const v1=(v:unknown):v is PlanRef=>validRef(v)&&v.version===1;
const invalid=():never=>{throw new ApiError('TRANSFER_MANIFEST_RESPONSE_INVALID',503);};
const changed=():never=>{throw new ApiError('TRANSFER_MANIFEST_CONTEXT_CHANGED',412);};
const active=(check:()=>boolean)=>{if(!check())changed();};

type ManifestCommand={
 schemaVersion:1;projectId:string;commandId:string;clientId:string;controlGeneration:number;
 operation:'createTransferManifest';targetId:null;expectedVersion:0;baselineRefs:[];approvalRef:null;payload:{preparationRef:PlanRef};
};
export interface TransferManifestBuffer {
 readonly key:string;
 readonly api:ApiClient;
 readonly transport:typeof fetch;
 readonly projectId:string;
 readonly assignmentRef:PlanRef;
 readonly preparationRef:PlanRef;
 readonly ownerUserId:string;
 readonly ownerClientId:string;
 readonly commandId:string;
 readonly body:string;
 readonly ref:PlanRef|null;
}
export interface TransferManifestStorage {
 readonly buffers:Readonly<Record<string,TransferManifestBuffer|undefined>>;
 onChange(expected:TransferManifestBuffer|null,next:TransferManifestBuffer):boolean;
}

export const transferManifestKey=(s:DocumentSession,pid:string,assignmentRef:PlanRef,preparationRef:PlanRef)=>
 canonical([preparationKey(s,pid,assignmentRef),preparationRef]);
const transitions=new WeakMap<TransferManifestBuffer,TransferManifestBuffer|null>();
function issue(expected:TransferManifestBuffer|null,next:TransferManifestBuffer){
 const fixed=Object.freeze(next);
 transitions.set(fixed,expected);
 return fixed;
}
export function mergeTransferManifest(old:TransferManifestBuffer|null,expected:TransferManifestBuffer|null,next:TransferManifestBuffer){
 return old===expected&&transitions.has(next)&&transitions.get(next)===old?next:old;
}
export function transferManifestOwned(b:TransferManifestBuffer,api:ApiClient,s:DocumentSession,pid:string,assignmentRef:PlanRef){
 return b.api===api&&b.transport===api.transport&&b.projectId===pid&&b.ownerUserId===s.user.id&&b.ownerClientId===s.clientId
  &&same(b.assignmentRef,assignmentRef)&&b.key===transferManifestKey(s,pid,assignmentRef,b.preparationRef);
}

/** 첫 명령에만 현재 보호 부모와 제어 세대를 읽는다. 같은 명령 재확인에서는 원 바이트를 유지한다. */
export async function prepareTransferManifest(api:ApiClient,session:DocumentSession,parent:PreparationGet,check:()=>boolean){
 const s=structuredClone(session),pid=parent.projectId,assignmentRef=structuredClone(parent.record.assignmentRef),
  preparationRef=structuredClone(parent.ref),transport=api.transport;
 if(!uuid(s.user.id)||!uuid(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))throw new ApiError('AUTH_REQUIRED',401);
 active(check);
 const current=await readPreparationRecord(api,pid,preparationRef,assignmentRef,check);
 if(!same(current.record,parent.record))return invalid();
 if(current.currentStatus.intentExpired)throw new ApiError('INTENT_EXPIRED',410);
 const generation=await documentControl(api,pid,s);
 active(check);
 if(transport!==api.transport)return changed();
 const command:ManifestCommand={schemaVersion:1,projectId:pid,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:generation,
  operation:'createTransferManifest',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{preparationRef}};
 return issue(null,{key:transferManifestKey(s,pid,assignmentRef,preparationRef),api,transport,projectId:pid,
  assignmentRef:Object.freeze(assignmentRef),preparationRef:Object.freeze(preparationRef),ownerUserId:s.user.id,ownerClientId:s.clientId,
  commandId:command.commandId,body:canonical(command),ref:null});
}

/** 서버가 부모와 함께 고정한 전체 투영을 대조하고 현재 사실을 추론하지 않는다. */
async function parseManifest(value:unknown,ref:PlanRef,parent:PreparationGet,check:()=>boolean){
 if(!value||typeof value!=='object'||!('observedAt'in value)||!iso(value.observedAt)
  ||value.observedAt<parent.record.observedAt||value.observedAt>=parent.record.intentExpiresAt)return invalid();
 const s=parent.record;
 const expected={schemaVersion:1,id:ref.id,projectId:parent.projectId,version:1,kind:'TRANSFER_MANIFEST',preparationRef:parent.ref,
  assignmentRef:s.assignmentRef,contextRef:s.contextRef,roleRef:s.roleRef,oldBindingRef:s.oldBindingRef,targetRef:s.targetConnectionRef,
  baselineRefs:s.baselineRefs,budgetRef:s.budgetRef,sourceRefs:s.sourceRefs,requiredContext:s.requiredContext,gaps:[...s.gaps,...gaps],
  completed:[],unfinished:[],currentPosition:null,decisionsWithReasons:[],sourceDiffs:[],recoveryState:'UNVERIFIED',
  capabilities:'UNVERIFIED',understandingState:'NOT_REVIEWED',intentExpiresAt:s.intentExpiresAt,observedAt:value.observedAt,
  manifestStored:true,bindingFrozen:false,ready:false,transferConfirmed:false,resumeAuthorized:false,executionAuthorized:false,dispatchPerformed:false};
 if(!same(value,expected)||await wireHash(expected)!==ref.contentHash)return invalid();
 active(check);
 return expected;
}

export async function sendTransferManifest(api:ApiClient,s:DocumentSession,parent:PreparationGet,b:TransferManifestBuffer,check:()=>boolean){
 active(check);
 if(b.ref||!transitions.has(b)||!same(b.preparationRef,parent.ref)||!transferManifestOwned(b,api,s,parent.projectId,parent.record.assignmentRef))return changed();
 if(!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken))throw new ApiError('AUTH_REQUIRED',401);
 let response:Response;
 try{
  response=await b.transport.call(globalThis,`/api/v1/projects/${b.projectId}/commands`,{
   method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':s.csrfToken,'Idempotency-Key':b.commandId},
   body:b.body
  });
 }catch{throw new ApiError('CONNECTION_LOST');}
 active(check);
 let result:any;
 try{
  if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))return invalid();
  result=await response.json();
 }catch{return invalid();}
 active(check);
 if(!response.ok)throw new ApiError(typeof result?.code==='string'&&/^[A-Z_]{1,80}$/.test(result.code)?result.code:'REQUEST_FAILED',response.status);
 if(response.status!==200||!exact(result,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])
  ||!uuid(result.operationId)||result.commandId!==b.commandId||result.projectId!==b.projectId||result.status!=='APPLIED'||result.version!==1
  ||!exact(result.data,['ref','manifest','manifestStored'])||!v1(result.data.ref)||result.targetId!==result.data.ref.id||result.data.manifestStored!==true
  ||!iso(result.serverReceivedAt)||!same(result.evidenceRefs,[])||!same(result.warnings,[]))return invalid();
 const manifest=await parseManifest(result.data.manifest,result.data.ref,parent,check);
 if(manifest.observedAt!==result.serverReceivedAt)return invalid();
 return issue(b,{...b,ref:Object.freeze({...result.data.ref})});
}

export async function readTransferManifest(api:ApiClient,parent:PreparationGet,ref:PlanRef,check:()=>boolean){
 if(!uuid(parent.projectId)||!v1(ref))return invalid();
 active(check);
 const value:any=await api.get(`/api/v1/projects/${parent.projectId}/transfers/${ref.id}/manifest?version=1&contentHash=${ref.contentHash}`);
 active(check);
 if(!exact(value,['projectId','ref','manifest','observedAt','currentStatus'])||value.projectId!==parent.projectId||!same(value.ref,ref)
  ||!iso(value.observedAt)||!exact(value.currentStatus,['intentExpired','usableForTransfer','sourceCurrentness'])
  ||value.currentStatus.usableForTransfer!==false||value.currentStatus.sourceCurrentness!=='NOT_REVALIDATED'
  ||!value.manifest||typeof value.manifest!=='object'||!('contentHash'in value.manifest)||value.manifest.contentHash!==ref.contentHash)return invalid();
 const {contentHash,...snapshot}=value.manifest;
 const manifest=await parseManifest(snapshot,ref,parent,check);
 if(value.observedAt<manifest.observedAt||value.currentStatus.intentExpired!==(manifest.intentExpiresAt<=value.observedAt))return invalid();
 return {manifest,observedAt:value.observedAt,intentExpired:value.currentStatus.intentExpired as boolean};
}
