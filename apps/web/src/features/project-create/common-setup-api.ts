import {ApiClient,ApiError} from '../../api/client.ts';
import {browserCanonical,wireHash} from '../control-handoff/api.ts';
import {copyCommonSetupData,readCommonSetupDefinition,setupRecord,setupRef,setupText,setupUuid,type CommonSetupKind,type CommonSetupSnapshot,type SetupRef,type SetupSlot,type ProjectSetupCopy} from '../../../../../contracts/runtime/user-common-setup-v1.ts';
export interface CommonSetupSession{user:{id:string};clientId:string;csrfToken:string}
export interface CommonSetupVersion{ref:SetupRef;snapshot:CommonSetupSnapshot;headVersion:number;status:'ACTIVE'|'REVOKED';configurationCurrent:boolean;support:'UNVERIFIED';executionAuthorized:false;observedAt:string}
export interface CommonSetupPage{items:{ref:SetupRef;kind:CommonSetupKind;label:string;status:'ACTIVE'}[];hasMore:boolean;nextCursor:string|null;observedAt:string}
export interface SetupCopyRef extends SetupRef{slot:SetupSlot}
export interface SetupCopyRead{projectId:string;ref:SetupRef;copy:ProjectSetupCopy;observedAt:string;readiness:'UNBOUND';executionAuthorized:false}
export interface CommonSetupCommand{schemaVersion:1;commandId:string;operation:'saveCommonSetupDefinition'|'revokeCommonSetupDefinition';targetId:string|null;expectedVersion:number;clientId:string;payload:Record<string,unknown>}
export interface CommonSetupReceipt{scopeKind:'USER_COMMON';ownerUserId:string;operationId:string;commandId:string;status:'APPLIED';targetId:string;version:number;data:{ref:SetupRef;snapshot:CommonSetupSnapshot;status:'COMMON_SETUP_STORED'|'COMMON_SETUP_REVOKED';validation:{issues:unknown[]}};evidenceRefs:unknown[];warnings:unknown[];serverReceivedAt:string}
const fail=(code='RESPONSE_INVALID',status=0):never=>{throw new ApiError(code,status);};
const same=(a:unknown,b:unknown)=>browserCanonical(a)===browserCanonical(b);
const observed=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const check=(active:()=>boolean)=>{if(!active())fail('COMMON_SETUP_CONTEXT_CHANGED',412);};
export const commonSetupWireHash=wireHash;
export function readSetupCopyRefs(v:unknown):SetupCopyRef[]{
 if(!Array.isArray(v)||v.length>3||v.some(x=>!setupRecord(x,['id','version','contentHash','slot'])||!setupRef({id:x.id,version:x.version,contentHash:x.contentHash})||x.version!==1||!['COORDINATOR_TOOL','CODING_TOOL','ENVIRONMENT'].includes(x.slot))||new Set(v.map(x=>x.id)).size!==v.length||new Set(v.map(x=>x.slot)).size!==v.length)fail();return (v as SetupCopyRef[]).map(x=>({...x}));
}
export async function readCommonSetupList(api:ApiClient,kind:CommonSetupKind,name:string,cursor:string|null,active:()=>boolean=()=>true):Promise<CommonSetupPage>{
 if(!['TOOL','ENVIRONMENT'].includes(kind)||typeof name!=='string'||!name.isWellFormed()||name.length>200||cursor!==null&&(typeof cursor!=='string'||!cursor||cursor.length>4096))fail('CLIENT_PATH_INVALID');check(active);
 const query=new URLSearchParams({kind,name});if(cursor!==null)query.set('cursor',cursor);
 const v=await api.get<any>('/api/v1/user-common/setup-definitions?'+query);check(active);
 if(!setupRecord(v,['items','hasMore','nextCursor','observedAt'])||!Array.isArray(v.items)||v.items.length>20||typeof v.hasMore!=='boolean'||(v.hasMore?typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor.length>4096:v.nextCursor!==null)||!observed(v.observedAt)||v.items.some((x:any,i:number)=>!setupRecord(x,['ref','kind','label','status'])||!setupRef(x.ref)||x.kind!==kind||x.status!=='ACTIVE'||!setupText(x.label,200)||i>0&&v.items[i-1].ref.id>=x.ref.id))fail();return v as unknown as CommonSetupPage;
}
async function snapshot(v:any,owner:string,ref:SetupRef,active:()=>boolean):Promise<CommonSetupSnapshot>{
 if(!setupRecord(v,['id','version','kind','definition','reason','createdBy'])||v.id!==ref.id||v.version!==ref.version||v.createdBy!==owner||!['TOOL','ENVIRONMENT'].includes(v.kind)||!setupText(v.reason,20000))fail();
 try{if(!same(readCommonSetupDefinition(v.kind,v.definition),v.definition))fail();}catch{fail();}
 const hash=await wireHash(v);check(active);if(hash!==ref.contentHash)fail();return v as unknown as CommonSetupSnapshot;
}
export async function readCommonSetupVersion(api:ApiClient,owner:string,ref:SetupRef,active:()=>boolean=()=>true):Promise<CommonSetupVersion>{
 if(!setupUuid(owner)||!setupRef(ref))fail('CLIENT_PATH_INVALID');check(active);const expected={...ref};
 const v=await api.get<any>('/api/v1/user-common/setup-definitions/'+ref.id+'/versions/'+ref.version);check(active);
 if(!setupRecord(v,['ref','snapshot','headVersion','status','configurationCurrent','support','executionAuthorized','observedAt'])||!setupRef(v.ref)||!same(v.ref,expected)||!Number.isSafeInteger(v.headVersion)||v.headVersion<ref.version||!['ACTIVE','REVOKED'].includes(v.status)||v.configurationCurrent!==(v.headVersion===ref.version&&v.status==='ACTIVE')||v.support!=='UNVERIFIED'||v.executionAuthorized!==false||!observed(v.observedAt))fail();await snapshot(v.snapshot,owner,expected,active);check(active);return v as unknown as CommonSetupVersion;
}
export function readCommonSetupRequest(raw:unknown,session:CommonSetupSession):CommonSetupCommand{
 let c:any;try{c=copyCommonSetupData(raw);}catch{return fail('COMMON_SETUP_INPUT_INVALID',422);}
 if(!setupRecord(c,['schemaVersion','commandId','operation','targetId','expectedVersion','clientId','payload'])||c.schemaVersion!==1||!setupUuid(c.commandId)||!setupUuid(c.clientId)||c.clientId!==session.clientId||!setupUuid(session.user.id)||!Number.isSafeInteger(c.expectedVersion)||c.expectedVersion<0||c.expectedVersion>=Number.MAX_SAFE_INTEGER)fail('COMMON_SETUP_INPUT_INVALID',422);
 if(c.operation==='saveCommonSetupDefinition'){
 if(!setupRecord(c.payload,['kind','definition','reason'])||!setupText(c.payload.reason,20000)||c.targetId===null&&c.expectedVersion!==0||c.targetId!==null&&(!setupUuid(c.targetId)||c.expectedVersion<1))fail('COMMON_SETUP_INPUT_INVALID',422);
 try{c.payload.definition=readCommonSetupDefinition(c.payload.kind,c.payload.definition);}catch{return fail('COMMON_SETUP_INPUT_INVALID',422);}
 }else if(c.operation==='revokeCommonSetupDefinition'){
 if(!setupRecord(c.payload,['targetRef','reason'])||!setupRef(c.payload.targetRef)||!setupText(c.payload.reason,20000)||c.targetId!==c.payload.targetRef.id||c.expectedVersion!==c.payload.targetRef.version)fail('COMMON_SETUP_INPUT_INVALID',422);
 }else fail('COMMON_SETUP_INPUT_INVALID',422);
 if(new TextEncoder().encode(browserCanonical(c)).length>2097152)fail('COMMON_SETUP_INPUT_INVALID',422);return c as CommonSetupCommand;
}
export async function writeCommonSetupCommand(api:ApiClient,session:CommonSetupSession,raw:unknown,active:()=>boolean=()=>true):Promise<CommonSetupReceipt>{
 const c=readCommonSetupRequest(raw,session),owner=session.user.id,clientId=session.clientId,csrf=session.csrfToken,transport=api.transport;
 const current=()=>{check(active);if(session.user.id!==owner||session.clientId!==clientId||session.csrfToken!==csrf||api.transport!==transport)fail('COMMON_SETUP_CONTEXT_CHANGED',412);return true;};current();if(!/^[A-Za-z0-9_-]{43}$/.test(csrf))fail('AUTH_REQUIRED',401);
 await wireHash(c);current();
 let response:Response;try{response=await transport.call(globalThis,'/api/v1/user-common/commands',{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':csrf},body:browserCanonical(c)});}catch{throw new ApiError('CONNECTION_LOST');}
 current();let v:any;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();v=await response.json();}catch{return fail('RESPONSE_INVALID',response.status);}current();
 if(!response.ok)fail(typeof v?.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(v.code)?v.code:'REQUEST_FAILED',response.status);
 const expectedVersion=c.operation==='saveCommonSetupDefinition'?c.expectedVersion+1:c.expectedVersion;
 if(!setupRecord(v,['scopeKind','ownerUserId','operationId','commandId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||v.scopeKind!=='USER_COMMON'||v.ownerUserId!==owner||!setupUuid(v.operationId)||v.commandId!==c.commandId||v.status!=='APPLIED'||!setupUuid(v.targetId)||v.version!==expectedVersion||!setupRecord(v.data,['ref','snapshot','status','validation'])||!setupRef(v.data.ref)||v.data.ref.id!==v.targetId||v.data.ref.version!==v.version||c.targetId!==null&&v.targetId!==c.targetId||v.data.status!==(c.operation==='saveCommonSetupDefinition'?'COMMON_SETUP_STORED':'COMMON_SETUP_REVOKED')||!Array.isArray(v.evidenceRefs)||!Array.isArray(v.warnings)||!setupRecord(v.data.validation,['issues'])||!Array.isArray(v.data.validation.issues)||!observed(v.serverReceivedAt))fail();
 await snapshot(v.data.snapshot,owner,v.data.ref,current);
 if(c.operation==='saveCommonSetupDefinition'&&(v.data.snapshot.kind!==c.payload.kind||v.data.snapshot.reason!==c.payload.reason||!same(v.data.snapshot.definition,c.payload.definition))||c.operation==='revokeCommonSetupDefinition'&&!same(v.data.ref,c.payload.targetRef))fail();current();return v as unknown as CommonSetupReceipt;
}
export async function readProjectSetupCopy(api:ApiClient,projectId:string,expected:SetupCopyRef,active:()=>boolean=()=>true):Promise<SetupCopyRead>{
 if(!setupUuid(projectId))fail('CLIENT_PATH_INVALID');readSetupCopyRefs([expected]);check(active);const v=await api.get<any>('/api/v1/projects/'+projectId+'/setup-copies/'+expected.id+'/versions/1');check(active);
 if(!setupRecord(v,['projectId','ref','copy','observedAt','readiness','executionAuthorized'])||v.projectId!==projectId||!setupRef(v.ref)||!same(v.ref,{id:expected.id,version:1,contentHash:expected.contentHash})||!setupRecord(v.copy,['id','projectId','slot','sourceRef','sourceOwnerUserId','definitionSnapshot','status'])||v.copy.id!==expected.id||v.copy.projectId!==projectId||v.copy.slot!==expected.slot||v.copy.status!=='UNBOUND'||!setupRef(v.copy.sourceRef)||!setupUuid(v.copy.sourceOwnerUserId)||v.readiness!=='UNBOUND'||v.executionAuthorized!==false||!observed(v.observedAt))fail();
 try{if(!same(readCommonSetupDefinition(expected.slot==='ENVIRONMENT'?'ENVIRONMENT':'TOOL',v.copy.definitionSnapshot),v.copy.definitionSnapshot))fail();}catch{fail();}if(await wireHash(v.copy)!==expected.contentHash)fail();check(active);return v as unknown as SetupCopyRead;
}
