import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {hashV1,isoV1,recordV1,refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {checkDocumentBodyHistoryRows,checkDocumentDraftHistoryRows,type DocumentBodyHistoryRows,type DocumentDraftHistoryRows} from './document-inventory.ts';

const digest=(value:unknown)=>contentHash(canonicalJson(value));
const invalid=():never=>{throw Error('FN16_D2_DOCUMENT_HISTORY_INVALID');};

export interface DocumentBodySnapshot {
 kind:'FN16_D2_DOCUMENT_BODY_SNAPSHOT_V1';
 projectId:string;
 jobRef:RuntimeRefV1;
 documentRef:RuntimeRefV1;
 observation:{snapshot:string;startedAt:string;finishedAt:string};
 rows:DocumentBodyHistoryRows;
}
export interface DocumentDraftSnapshot extends Omit<DocumentBodySnapshot,'kind'|'rows'> {
 kind:'FN16_D2_DOCUMENT_DRAFT_SNAPSHOT_V2';
 rows:DocumentDraftHistoryRows;
}

export interface DocumentBodyHistoryExpectation {
 projectId:string;
 jobRef:RuntimeRefV1;
 documentRef:RuntimeRefV1;
 snapshot:string;
 snapshotHash:string;
}

/** 독립 보관본에서 다시 읽은 바이트를 원 수집의 고정 기대값과 검산한다. */
export async function verifyDocumentBodyHistory(expected:Readonly<DocumentBodyHistoryExpectation>,
 read:()=>Promise<{snapshot:unknown;body:Uint8Array}>){
 try{
  if(!recordV1(expected,['projectId','documentRef','jobRef','snapshot','snapshotHash'])
   ||!refV1(expected.documentRef)||!refV1(expected.jobRef)||!hashV1(expected.snapshotHash))return invalid();
  const wanted={...expected,documentRef:{...expected.documentRef},jobRef:{...expected.jobRef}};
  const {snapshot,body}=await read();
  if(!recordV1(snapshot,['kind','projectId','jobRef','documentRef','observation','rows'])
   ||!['FN16_D2_DOCUMENT_BODY_SNAPSHOT_V1','FN16_D2_DOCUMENT_DRAFT_SNAPSHOT_V2'].includes(snapshot.kind)
   ||snapshot.projectId!==wanted.projectId||!refV1(snapshot.documentRef)
   ||!refV1(snapshot.jobRef)||canonicalJson(snapshot.jobRef)!==canonicalJson(wanted.jobRef)
   ||canonicalJson(snapshot.documentRef)!==canonicalJson(wanted.documentRef)
   ||!recordV1(snapshot.observation,['snapshot','startedAt','finishedAt'])||snapshot.observation.snapshot!==wanted.snapshot
   ||typeof wanted.snapshot!=='string'||wanted.snapshot.length>128*1024||!/^\d+:\d+:[\d,]*$/.test(wanted.snapshot)
   ||!isoV1(snapshot.observation.startedAt)||!isoV1(snapshot.observation.finishedAt)||snapshot.observation.finishedAt<snapshot.observation.startedAt
   ||digest(snapshot)!==wanted.snapshotHash)return invalid();
  const origin=snapshot.kind==='FN16_D2_DOCUMENT_DRAFT_SNAPSHOT_V2'?checkDocumentDraftHistoryRows(wanted.projectId,wanted.documentRef,snapshot.rows):null;
  const artifact=origin?.body??checkDocumentBodyHistoryRows(wanted.projectId,wanted.documentRef,snapshot.rows);
  if(!(body instanceof Uint8Array)||body.byteLength!==artifact.bytes)return invalid();
  const bytes=Buffer.from(body);
  try{
   if(contentHash(bytes)!==artifact.contentHash||inspectArtifact(bytes).state!=='NO_KNOWN_MARKER')return invalid();
  }finally{bytes.fill(0);}
  const result={projectId:wanted.projectId,
   jobRef:wanted.jobRef,documentRef:wanted.documentRef,snapshotHash:wanted.snapshotHash,artifact,
   bodyVerified:true as const,documentHistoryComplete:false as const,restorable:false as const,executionAuthorized:false as const};
  if(!origin)return {kind:'FN16_D2_DOCUMENT_BODY_VERIFICATION_V1' as const,...result};
  return {kind:'FN16_D2_DOCUMENT_DRAFT_VERIFICATION_V2' as const,...result,
   commandProjectionRef:origin.commandProjectionRef,receiptProjectionRef:origin.receiptProjectionRef,auditProjectionRef:origin.auditProjectionRef};
 }catch{return invalid();}
}
