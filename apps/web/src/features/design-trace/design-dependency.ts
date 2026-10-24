import {ApiClient,ApiError} from '../../api/client.ts';
import {postDocumentCommand,type DocumentSession,type DocumentWrite} from './editor-api.ts';
import type {DesignItem} from './design-index-api.ts';
import type {TraceEdge} from './trace-api.ts';
import {documentMutationUncertain} from './mutation-result.ts';
export interface DependencyContext {ownerUserId:string;projectId:string;documentId:string|null;baseVersion:number;baseHash?:string;controlGeneration:number;items:DesignItem[]}
export interface DesignDependency {bindingId:string;context:DependencyContext;fromId:string;toId:string;reason:string;pending:DocumentWrite|null;result:TraceEdge|null;failure:{code:string;status:number}|null;uncertain:boolean}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const normalized=(v:any):any=>Array.isArray(v)?v.map(normalized):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalized(v[k])])):v;
const same=(a:unknown,b:unknown)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
export function newDesignDependency(context:DependencyContext):DesignDependency{return {bindingId:crypto.randomUUID(),context:structuredClone(context),fromId:'',toId:'',reason:'',pending:null,result:null,failure:null,uncertain:false};}
export function keepDependencyFailure(state:DesignDependency,commandId:string|undefined,error:{code:string;status:number}):DesignDependency{
 if(state.result||state.pending?.commandId!==commandId)return state;
 return {...state,failure:{code:error.code,status:error.status},uncertain:commandId?documentMutationUncertain(state.uncertain,new ApiError(error.code,error.status)):state.uncertain};
}
function payload(b:DependencyContext,s:DesignDependency,session:DocumentSession){
 if(b.ownerUserId!==session.user.id||!uuid.test(b.projectId)||!uuid.test(session.clientId)||!uuid.test(b.documentId??'')||!Number.isSafeInteger(b.baseVersion)||b.baseVersion<1||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||!/^[a-f0-9]{64}$/.test(b.baseHash??'')||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken)||!same(b,s.context)||s.fromId===s.toId||typeof s.reason!=='string'||!s.reason.trim()||s.reason.length>20_000||!s.reason.isWellFormed())throw new ApiError('TRACE_INPUT_INVALID');
 const select=(id:string)=>{const items=b.items.filter(i=>i.id===id);if(items.length!==1)throw new ApiError('TRACE_INPUT_INVALID');const i=items[0]!;if(!uuid.test(i.id)||!same(i.documentRef,{id:b.documentId,version:b.baseVersion,contentHash:b.baseHash})||!/^line:[1-9][0-9]{0,7}$/.test(i.anchor)||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(i.localCode))throw new ApiError('TRACE_INPUT_INVALID');return {kind:'DESIGN_ITEM' as const,id:i.id,versionRef:{...i.documentRef},localCode:i.localCode,anchor:i.anchor};};
 return {from:select(s.fromId),to:select(s.toId),relation:'DEPENDS_ON' as const,reason:s.reason};
}
export function prepareDesignDependency(b:DependencyContext,s:DesignDependency,session:DocumentSession):DocumentWrite{
 const p=payload(b,s,session);if(s.pending||s.result)throw new ApiError('TRACE_PENDING_RESULT');return {schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration:b.controlGeneration,operation:'linkTrace',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:p};
}
export async function sendDesignDependency(client:ApiClient,b:DependencyContext,s:DesignDependency,session:DocumentSession,active:()=>boolean):Promise<TraceEdge>{
 const input=structuredClone(payload(b,s,session)),c=structuredClone(s.pending);if(!c||!uuid.test(c.commandId)||c.schemaVersion!==1||c.projectId!==b.projectId||c.clientId!==session.clientId||c.controlGeneration!==b.controlGeneration||c.operation!=='linkTrace'||c.targetId!==null||c.expectedVersion!==0||c.baselineRefs.length||c.approvalRef!==null||!same(c.payload,input))throw new ApiError('TRACE_INPUT_INVALID');
 const check=()=>{if(!active())throw new ApiError('TRACE_LINK_CONTINUATION_PAUSED');};check();const r=await postDocumentCommand(client,c,session.csrfToken);check();const e=r.data?.edge;
 if(r.data?.status!=='TRACE_LINKED'||!e||Object.keys(e).sort().join(',')!==['id','from','to','relation','reason','designRefs','edgeHash','createdAt'].sort().join(',')||!uuid.test(e.id)||r.targetId!==e.id||r.version!==1||!same(r.data.ref,{id:e.id,version:1,contentHash:e.edgeHash})||!same(e.from,input.from)||!same(e.to,input.to)||e.relation!==input.relation||e.reason!==input.reason||!same(e.designRefs,[input.from.versionRef])||!Number.isFinite(Date.parse(e.createdAt)))throw new ApiError('RESPONSE_INVALID');
 const {id,edgeHash,createdAt,...data}=e,hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalized(data)))))].map(n=>n.toString(16).padStart(2,'0')).join('');check();if(hash!==edgeHash)throw new ApiError('TRACE_INTEGRITY_FAILED');return e;
}
