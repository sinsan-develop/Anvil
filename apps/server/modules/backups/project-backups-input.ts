import {AuthFailure} from '../access/repository.ts';
import {refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
export interface ExportArtifactRef {artifactId:string;bytes:number;contentHash:string;mediaType:string}
export interface ExportSelection {kind:'DOCUMENT_ARTIFACT';documentRef:VersionRef;artifactRef:ExportArtifactRef}
export const omitted=['PROJECT_DB_SNAPSHOT','PROJECT_SOURCE','OTHER_PROJECT_MATERIALS','EXECUTION_STATE_RESTORE'] as const;
export interface ExportManifest {schemaVersion:1;kind:'SELECTED_DOCUMENT_ARTIFACT_EXPORT';projectId:string;includeSource:false;selection:ExportSelection;files:[{artifactRef:ExportArtifactRef;downloadName:string}];omitted:typeof omitted;createdAt:string;createdBy:{kind:'HUMAN';userId:string}}
export interface ExportJob {ref:VersionRef;manifest:ExportManifest;sourceAvailability:'READY'|'BLOCKED'}
export const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function readExportPayload(v:unknown):{includeSource:false;selection:ExportSelection;reason:string}{
 const fail=():never=>{throw new AuthFailure('EXPORT_INPUT_INVALID',422);};
 if(!exact(v,['includeSource','selection','reason'])||v.includeSource!==false||typeof v.reason!=='string'||!v.reason.trim()||v.reason.length>20000)return fail();
 const s=v.selection;if(!exact(s,['kind','documentRef','artifactRef'])||s.kind!=='DOCUMENT_ARTIFACT'||!exact(s.documentRef,['id','version','contentHash'])||!refV1(s.documentRef))return fail();
 const a=s.artifactRef;if(!exact(a,['artifactId','bytes','contentHash','mediaType'])||!uuidV1(a.artifactId)||!Number.isSafeInteger(a.bytes)||Number(a.bytes)<0||Number(a.bytes)>20*1024*1024||typeof a.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(a.contentHash)||typeof a.mediaType!=='string'||!a.mediaType.length||a.mediaType.length>200)return fail();
 return structuredClone(v) as unknown as {includeSource:false;selection:ExportSelection;reason:string};
}
export function exportQuery(q:Record<string,unknown>){if(Object.keys(q).some(k=>!['view','limit','cursor'].includes(k))||q.view!=='SELECTED_ARTIFACT_EXPORTS'||q.limit!==undefined&&(typeof q.limit!=='string'||!/^[1-9][0-9]?$/.test(q.limit)||Number(q.limit)>50)||q.cursor!==undefined&&(typeof q.cursor!=='string'||!q.cursor||q.cursor.length>4096))throw new AuthFailure('INPUT_INVALID',400);return{limit:q.limit===undefined?50:Number(q.limit),cursor:q.cursor as string|undefined};}
