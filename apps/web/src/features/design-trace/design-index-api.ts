import { ApiClient,ApiError } from '../../api/client.ts';
type Ref={id:string;version:number;contentHash:string};
type Artifact={artifactId:string;bytes:number;contentHash:string;mediaType:string};
export interface DesignItem {id:string;documentRef:Ref;localCode:string;title:string;anchor:string;itemHash:string}
export interface ScreenRegion {id:string;designItemId:string;screenCode:string;documentRef:Ref;artifactRef:Artifact;anchor:string;regionHash:string}
export interface DesignIndexView {documentRef:Ref;items:DesignItem[];screenRegions:ScreenRegion[];status:'INDEXED'|'NOT_INDEXED';observedAt:string}
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
