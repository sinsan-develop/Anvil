import {canonicalJson} from '../canonical.ts';
import {arrayV1,recordV1,refV1,hashV1,isoV1,type RuntimeRefV1} from './validation-v1.ts';
import {isRelativeSourceFileV1} from './source-scope-v1.ts';

export interface SourceContentBlobRefV1 {artifactId:string;bytes:number;contentHash:string;mediaType:string}
export interface SourceContentTargetV1 {relativePath:string;documentRef:RuntimeRefV1;documentBlobRef:SourceContentBlobRefV1}
export interface SourceContentLimitsV1 {maxFiles:number;maxFileBytes:number;maxTotalBytes:number;maxObservationMs:number;maxReportBytes:number}
export interface SourceContentRequestV1 {
 sourceRootRef:RuntimeRefV1;connectorRef:RuntimeRefV1;registrationRef:RuntimeRefV1;observerRef:RuntimeRefV1;
 targets:SourceContentTargetV1[];limits:SourceContentLimitsV1;expiresAt:string;reason:string;
}
const caps:SourceContentLimitsV1={maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576};
const invalid=():never=>{throw Error('SOURCE_CONTENT_INPUT_INVALID');};
/** 순수 입력 검사만 수행한다. DB/현재 권한/원본·OS 관측/서명을 증명하지 않고 route에도 등록하지 않는다. */
export function readSourceContentRequestV1(value:unknown,nowMs:number):SourceContentRequestV1 {
 try {
  // 값 조회 전에 getter를 거절하고 반환값을 호출자 객체와 분리한다.
  const raw=canonicalJson(value);
  if(Buffer.byteLength(raw,'utf8')>1048576||!Number.isSafeInteger(nowMs))return invalid();
  const v:unknown=JSON.parse(raw);
  if(!recordV1(v,['sourceRootRef','connectorRef','registrationRef','observerRef','targets','limits','expiresAt','reason'])||
   !['sourceRootRef','connectorRef','registrationRef','observerRef'].every(k=>refV1(v[k]))||
   !isoV1(v.expiresAt)||typeof v.reason!=='string'||!v.reason.trim()||v.reason.length>20000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v.reason)||
   !recordV1(v.limits,Object.keys(caps))||!arrayV1(v.targets,200)||!v.targets.length)return invalid();
  const ttl=Date.parse(v.expiresAt)-nowMs;
  if(ttl<=0||ttl>600000)return invalid();
  const limits=v.limits;
  for(const key of Object.keys(caps) as (keyof SourceContentLimitsV1)[])if(!Number.isSafeInteger(limits[key])||limits[key]<=0||limits[key]>caps[key])return invalid();
  if(v.targets.length>limits.maxFiles)return invalid();
  const paths=new Set<string>(),documents=new Set<string>();let total=0;
  for(const target of v.targets){
   if(!recordV1(target,['relativePath','documentRef','documentBlobRef'])||!isRelativeSourceFileV1(target.relativePath)||!refV1(target.documentRef)||paths.has(target.relativePath.toUpperCase())||documents.has(target.documentRef.id))return invalid();
   paths.add(target.relativePath.toUpperCase());documents.add(target.documentRef.id);
   const blob=target.documentBlobRef;
   if(!recordV1(blob,['artifactId','bytes','contentHash','mediaType'])||typeof blob.artifactId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(blob.artifactId)||
    !Number.isSafeInteger(blob.bytes)||blob.bytes<0||blob.bytes>limits.maxFileBytes||!hashV1(blob.contentHash)||typeof blob.mediaType!=='string'||!blob.mediaType.trim()||blob.mediaType.length>200||/[\u0000-\u001f\u007f]/.test(blob.mediaType))return invalid();
   total+=blob.bytes;if(total>limits.maxTotalBytes)return invalid();
  }
  return v as unknown as SourceContentRequestV1;
 }catch{return invalid();}
}
