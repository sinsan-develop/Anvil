import type{PoolClient}from'pg';
import{AuthFailure,type AuthenticatedIdentity}from'../access/repository.ts';
import{refV1,uuidV1,type RuntimeRefV1}from'../../../../contracts/runtime/validation-v1.ts';
import{DocumentSourceLinkRecords}from'../documents/document-source-link-records.ts';
/** 인증/현재 정책 command transaction 내부에서만 호출한다. 현재 source 내용의 증명이 아니다. */
export async function assertSourceDetachApprovalTarget(db:PoolClient,actor:AuthenticatedIdentity,pid:string,reference:RuntimeRefV1){
 if(!uuidV1(pid)||!uuidV1(actor?.actorId)||!refV1(reference)||reference.version!==1)throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
 const selected=structuredClone(reference);let rows:any[];
 try{rows=(await db.query(`SELECT l.document_id,l.version,v.content_hash document_hash,l.link_version,l.state,e.content_hash link_hash
 FROM anvil.document_source_links l JOIN anvil.document_versions v ON v.project_id=l.project_id AND v.document_id=l.document_id AND v.version=l.version
 JOIN anvil.document_source_link_events e ON e.project_id=l.project_id AND e.link_id=l.id AND e.id=l.current_event_id AND e.link_version=l.link_version
 WHERE l.project_id=$1 AND l.id=$2 FOR SHARE OF l`,[pid,selected.id])).rows;}catch{throw new AuthFailure('DOCUMENT_SOURCE_LINK_STORAGE_UNAVAILABLE',503);}
 if(!rows.length)throw new AuthFailure('NOT_FOUND',404);
 if(rows.length!==1)throw new AuthFailure('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
 const row=rows[0];if(Number(row.link_version)!==1||row.state!=='ACTIVE'||row.link_hash!==selected.contentHash)throw new AuthFailure('APPROVAL_TARGET_CHANGED',409);
 const stored=await new DocumentSourceLinkRecords().read(db,actor,pid,{id:row.document_id,version:Number(row.version),contentHash:row.document_hash},selected.id);
 if(!stored.rawAllowed)throw new AuthFailure('PROJECT_WRITE_DENIED',403);
 if(stored.state!=='ACTIVE'||stored.ref.id!==selected.id||stored.ref.version!==1||stored.ref.contentHash!==selected.contentHash)throw new AuthFailure('APPROVAL_TARGET_CHANGED',409);
}
