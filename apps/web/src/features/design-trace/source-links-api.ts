import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSourceLinkRecord} from '../../../../server/modules/documents/document-source-link-history.ts';
type Ref={id:string;version:number;contentHash:string};
export interface SourceLinkView{projectId:string;documentRef:Ref;ref:Ref;state:'ACTIVE'|'DETACHED';comparison:'UNVERIFIED';rawAllowed:boolean;history?:DocumentSourceLinkRecord[]}
export interface SourceLinksView{projectId:string;documentRef:Ref;items:SourceLinkView[];hasMore:boolean;observedAt:string}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const ref=(v:any):v is Ref=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash(v.contentHash);
const same=(a:Ref,b:Ref)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
const iso=(v:any)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v));
function ordered(v:any):any{return Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;}
const canonical=(v:any)=>JSON.stringify(ordered(v));
async function digest(v:any){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function fail():never{throw new ApiError('DOCUMENT_SOURCE_LINK_RESPONSE_INVALID');}

export async function readSourceLinks(client:ApiClient,projectId:string,requested:Ref,active:()=>boolean=()=>true):Promise<SourceLinksView>{
 const check=()=>{if(!active())throw new ApiError('DOCUMENT_SOURCE_READ_PAUSED');};check();
 if(!uuid(projectId)||!ref(requested))throw new ApiError('CLIENT_PATH_INVALID');const documentRef={...requested};
 const value=await client.get<SourceLinksView>(`/api/v1/projects/${projectId}/documents/${documentRef.id}/source-links?version=${documentRef.version}&contentHash=${documentRef.contentHash}`);check();
 if(!exact(value,['projectId','documentRef','items','hasMore','observedAt'])||value.projectId!==projectId||!ref(value.documentRef)||!same(value.documentRef,documentRef)||!Array.isArray(value.items)||value.items.length>20||typeof value.hasMore!=='boolean'||value.hasMore&&value.items.length!==20||!iso(value.observedAt))fail();
 const ids=new Set<string>();
 for(const item of value.items){
  if(!exact(item,['projectId','documentRef','ref','state','comparison','rawAllowed',...(item?.rawAllowed===true?['history']:[])])||item.projectId!==projectId||!ref(item.documentRef)||!same(item.documentRef,documentRef)||!ref(item.ref)||ids.has(item.ref.id)||item.comparison!=='UNVERIFIED'||typeof item.rawAllowed!=='boolean'||!['ACTIVE','DETACHED'].includes(item.state)||item.ref.version!==(item.state==='ACTIVE'?1:2))fail();ids.add(item.ref.id);
  if(!item.rawAllowed)continue;
  const history=item.history;if(!Array.isArray(history)||history.length!==item.ref.version)fail();
  let previous:DocumentSourceLinkRecord|undefined;
  for(const [index,entry] of history.entries()){
   if(!exact(entry,['ref','snapshot'])||!ref(entry.ref)||entry.ref.id!==item.ref.id||entry.ref.version!==index+1)fail();const s=entry.snapshot;
   if(!exact(s,['projectId','documentRef','sourceRootId','relativePath','sourceSnapshotRef','blobHash','reason','kind','state','previousRef','recordedAt'])||s.projectId!==projectId||!ref(s.documentRef)||!same(s.documentRef,documentRef)||!uuid(s.sourceRootId)||!ref(s.sourceSnapshotRef)||!hash(s.blobHash)||typeof s.relativePath!=='string'||!s.relativePath.length||s.relativePath.length>4096||typeof s.reason!=='string'||!s.reason.trim()||s.reason.length>20000||!iso(s.recordedAt))fail();
   if(!previous){if(s.kind!=='LINKED'||s.state!=='ACTIVE'||s.previousRef!==null)fail();}
   else{if(s.kind!=='DETACHED'||s.state!=='DETACHED'||!ref(s.previousRef)||!same(s.previousRef,previous.ref)||Date.parse(s.recordedAt)<Date.parse(previous.snapshot.recordedAt)||canonical([s.documentRef,s.sourceRootId,s.relativePath,s.sourceSnapshotRef,s.blobHash])!==canonical([previous.snapshot.documentRef,previous.snapshot.sourceRootId,previous.snapshot.relativePath,previous.snapshot.sourceSnapshotRef,previous.snapshot.blobHash]))fail();}
   if(await digest(s)!==entry.ref.contentHash)fail();check();previous=entry;
  }
  if(!previous||!same(previous.ref,item.ref)||previous.snapshot.state!==item.state)fail();
 }
 check();return structuredClone(value);
}
