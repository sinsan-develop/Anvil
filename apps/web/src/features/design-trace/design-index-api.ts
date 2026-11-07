import { ApiClient,ApiError } from '../../api/client.ts';
import { postDocumentCommand,type DocumentBuffer,type DocumentSession,type DocumentWrite } from './editor-api.ts';
type Ref={id:string;version:number;contentHash:string};
type Artifact={artifactId:string;bytes:number;contentHash:string;mediaType:string};
export interface DesignItem {id:string;documentRef:Ref;localCode:string;title:string;anchor:string;itemHash:string}
export interface ScreenRegion {id:string;designItemId:string;screenCode:string;documentRef:Ref;artifactRef:Artifact;anchor:string;regionHash:string}
export interface DesignIndexView {documentRef:Ref;items:DesignItem[];screenRegions:ScreenRegion[];status:'INDEXED'|'NOT_INDEXED';observedAt:string}
export interface DesignIndexInput {items:{localCode:string;title:string;anchor:string}[];screens:{designLocalCode:string;screenCode:string;documentRef:Ref;anchor:string}[];reason:string}
export interface DesignIndexBuffer {bindingId:string;documentRef:Ref;input:DesignIndexInput;pending:DocumentWrite|null;result:DesignIndexView|null;failure:{code:string;status:number}|null;uncertain:boolean;screenDraft:{documentId:string;version:string;designLocalCode:string;screenCode:string;line:string;preview:{documentRef:Ref;title:string;body:string}|null}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
const ref=(r:Ref)=>r&&uuid.test(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&hash.test(r.contentHash);
const same=(a:Ref,b:Ref)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
const code=(c:string)=>typeof c==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(c),anchor=(a:string)=>typeof a==='string'&&/^line:[1-9][0-9]{0,7}$/.test(a);
const artifact=(a:Artifact)=>a&&uuid.test(a.artifactId)&&Number.isSafeInteger(a.bytes)&&a.bytes>=0&&a.bytes<=2*1024*1024&&hash.test(a.contentHash)&&['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(a.mediaType);
async function digest(value:unknown) {
  const normalize=(v:any):any=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;
  const bytes=new TextEncoder().encode(JSON.stringify(normalize(value)));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function readDesignIndex(client:ApiClient,projectId:string,documentRef:Ref):Promise<DesignIndexView> {
  if(!uuid.test(projectId)||!ref(documentRef)) throw new ApiError('CLIENT_PATH_INVALID');
  const value=await client.get<DesignIndexView>(`/api/v1/projects/${projectId}/design-index?documentId=${documentRef.id}&version=${documentRef.version}`);
  return validateDesignIndexView(value,documentRef);
}
async function validateDesignIndexView(value:DesignIndexView,documentRef:Ref):Promise<DesignIndexView> {
  if(!value||!ref(value.documentRef)||!same(value.documentRef,documentRef)||!Array.isArray(value.items)||value.items.length>200||!Array.isArray(value.screenRegions)||value.screenRegions.length>200||value.status!==(value.items.length?'INDEXED':'NOT_INDEXED')||!Number.isFinite(Date.parse(value.observedAt))) throw new ApiError('RESPONSE_INVALID');
  const ids=new Set<string>(),codes=new Set<string>();
  for(const item of value.items) {
    if(!item||!uuid.test(item.id)||ids.has(item.id)||!ref(item.documentRef)||!same(item.documentRef,documentRef)||!code(item.localCode)||codes.has(item.localCode)||typeof item.title!=='string'||!item.title.trim()||item.title.length>200||!anchor(item.anchor)||!hash.test(item.itemHash)) throw new ApiError('RESPONSE_INVALID');
    const data={documentRef,localCode:item.localCode,title:item.title,anchor:item.anchor}; if(await digest(data)!==item.itemHash) throw new ApiError('DESIGN_INDEX_INTEGRITY_FAILED');
    ids.add(item.id);codes.add(item.localCode);
  }
  const regions=new Set<string>();
  for(const s of value.screenRegions) {
    if(!s||!uuid.test(s.id)||regions.has(s.id)||!ids.has(s.designItemId)||!code(s.screenCode)||!ref(s.documentRef)||!artifact(s.artifactRef)||!anchor(s.anchor)||!hash.test(s.regionHash)) throw new ApiError('RESPONSE_INVALID');
    const data={designItemId:s.designItemId,screenCode:s.screenCode,documentRef:s.documentRef,artifactRef:s.artifactRef,anchor:s.anchor}; if(await digest(data)!==s.regionHash) throw new ApiError('DESIGN_INDEX_INTEGRITY_FAILED'); regions.add(s.id);
  }
  return value;
}
export function newDesignIndex(buffer:DocumentBuffer):DesignIndexBuffer {
  if(!buffer.documentId||!buffer.baseHash||!ref({id:buffer.documentId,version:buffer.baseVersion,contentHash:buffer.baseHash})) throw new ApiError('DESIGN_INDEX_INPUT_INVALID');
  return {bindingId:crypto.randomUUID(),documentRef:{id:buffer.documentId,version:buffer.baseVersion,contentHash:buffer.baseHash},input:{items:[{localCode:'',title:'',anchor:'line:1'}],screens:[],reason:''},pending:null,result:null,failure:null,uncertain:false,screenDraft:{documentId:'',version:'1',designLocalCode:'',screenCode:'',line:'1',preview:null}};
}
function validateIndexWork(buffer:DocumentBuffer,session:DocumentSession) {
  const state=buffer.designIndexState;
  if(!state||buffer.workPlanState||buffer.pending||buffer.proposalState||buffer.importState||buffer.importPreparationId||buffer.ownerUserId!==session.user.id||!uuid.test(state.bindingId)||!uuid.test(buffer.projectId)||!uuid.test(session.clientId)||!ref(state.documentRef)||buffer.documentId!==state.documentRef.id||buffer.baseVersion!==state.documentRef.version||buffer.baseHash!==state.documentRef.contentHash||!Number.isSafeInteger(buffer.controlGeneration)||buffer.controlGeneration<1||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken)) throw new ApiError('DESIGN_INDEX_INPUT_INVALID');
  const p=state.input;
  if(!p.items.length||p.items.length>200||p.screens.length>200||new Set(p.items.map(i=>i.localCode)).size!==p.items.length||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20_000||p.items.some(i=>!code(i.localCode)||typeof i.title!=='string'||!i.title.trim()||i.title.length>200||!anchor(i.anchor))||p.screens.some(s=>!code(s.designLocalCode)||!p.items.some(i=>i.localCode===s.designLocalCode)||!code(s.screenCode)||!ref(s.documentRef)||!anchor(s.anchor))) throw new ApiError('DESIGN_INDEX_INPUT_INVALID');
  return state;
}
export function prepareDesignIndex(buffer:DocumentBuffer,session:DocumentSession):DocumentWrite {
  const state=validateIndexWork(buffer,session);
  if(state.pending||state.result) throw new ApiError('DESIGN_INDEX_PENDING_RESULT');
  const command:DocumentWrite={schemaVersion:1,projectId:buffer.projectId,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration:buffer.controlGeneration,operation:'indexDesignDocument',targetId:state.documentRef.id,expectedVersion:state.documentRef.version,baselineRefs:[],approvalRef:null,payload:{documentRef:{...state.documentRef},...structuredClone(state.input)}};
  if(new TextEncoder().encode(JSON.stringify(command)).length>2*1024*1024) throw new ApiError('DESIGN_INDEX_INPUT_TOO_LARGE');
  return command;
}
export async function sendDesignIndex(client:ApiClient,buffer:DocumentBuffer,session:DocumentSession,active:()=>boolean):Promise<DesignIndexView> {
  const state=validateIndexWork(buffer,session),c=state.pending;
  if(!c||!uuid.test(c.commandId)||c.schemaVersion!==1||c.projectId!==buffer.projectId||c.operation!=='indexDesignDocument'||c.clientId!==session.clientId||c.controlGeneration!==buffer.controlGeneration||c.targetId!==state.documentRef.id||c.expectedVersion!==state.documentRef.version||c.baselineRefs.length||c.approvalRef!==null||JSON.stringify(c.payload)!==JSON.stringify({documentRef:state.documentRef,...state.input})) throw new ApiError('DESIGN_INDEX_INPUT_INVALID');
  if(!active()) throw new ApiError('DESIGN_INDEX_CONTINUATION_PAUSED');
  const result=await postDocumentCommand(client,c,session.csrfToken);
  if(result.targetId!==state.documentRef.id||result.version!==state.documentRef.version||result.data?.status!=='DESIGN_INDEXED') throw new ApiError('RESPONSE_INVALID');
  const view=await validateDesignIndexView({documentRef:result.data.ref,items:result.data.designItems,screenRegions:result.data.screenRegions,status:'INDEXED',observedAt:result.serverReceivedAt},state.documentRef);
  if(view.items.length!==state.input.items.length||view.screenRegions.length!==state.input.screens.length||view.items.some(i=>!state.input.items.some(w=>w.localCode===i.localCode&&w.title===i.title&&w.anchor===i.anchor))||view.screenRegions.some(s=>!state.input.screens.some(w=>w.screenCode===s.screenCode&&w.anchor===s.anchor&&same(w.documentRef,s.documentRef)&&view.items.some(i=>i.id===s.designItemId&&i.localCode===w.designLocalCode)))) throw new ApiError('RESPONSE_INVALID');
  return view;
}
