import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {persistProjectReceipt,type ProjectCommand} from '../access/project-command.ts';
import {DocumentSourceLinkRecords} from './document-source-link-records.ts';
import {prepareDocumentSourceDetach,readDocumentSourceLinkInput} from './document-source-link-history.ts';
import {readApprovalRef} from '../approvals/approval-input.ts';

/** ProjectPolicyRepository.command의 현재 인증·제어·정책·replay 검사 이후, 같은 transaction에서만 호출한다.
 * 초기 LINKED 생성·source 관측 권위·문서/파일 수정은 제공하지 않는다. 0032 적용 전 실제 사용 불가. */
export class ProjectDocumentSourceLinks{
 async detach(db:PoolClient,actor:AuthenticatedIdentity,input:ProjectCommand,policyRef:VersionRef){
  const request=cloneV1(input),payload=readDocumentSourceLinkInput('detachDocumentSource',request.payload);
  if(request.approvalRef!==null)readApprovalRef(request.approvalRef);
  if(!uuidV1(actor.actorId)||!uuidV1(actor.clientId)||!refV1(policyRef)||!uuidV1(request.projectId)||!uuidV1(request.commandId)
   ||request.operation!=='detachDocumentSource'||request.clientId!==actor.clientId||request.targetId!==payload.sourceLinkRef.id
   ||request.expectedVersion!==payload.sourceLinkRef.version||request.baselineRefs.length)throw new AuthFailure('DOCUMENT_SOURCE_LINK_INPUT_INVALID',422);
  try{
   const rows=(await db.query(`SELECT l.document_id,l.version,l.current_event_id,v.content_hash document_hash FROM anvil.document_source_links l
    JOIN anvil.document_versions v ON v.project_id=l.project_id AND v.document_id=l.document_id AND v.version=l.version
    WHERE l.project_id=$1 AND l.id=$2 FOR UPDATE OF l`,[request.projectId,request.targetId])).rows;
   if(!rows.length)throw new AuthFailure('NOT_FOUND',404);
   if(rows.length!==1)throw new AuthFailure('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
   const row=rows[0],documentRef={id:row.document_id,version:Number(row.version),contentHash:row.document_hash};
   const stored=await new DocumentSourceLinkRecords().read(db,actor,request.projectId,documentRef,payload.sourceLinkRef.id);
   if(!stored.rawAllowed)throw new AuthFailure('PROJECT_WRITE_DENIED',403);
   const at=(await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
   const snapshot=prepareDocumentSourceDetach({projectId:request.projectId,documentRef},stored.history,payload,at);
   const ref={id:payload.sourceLinkRef.id,version:2,contentHash:contentHash(canonicalJson(snapshot))},eventId=randomUUID();
   const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'DOCUMENT_SOURCE_DETACHED',snapshot},policyRef,'EXPLICIT_DOCUMENT_SOURCE_DETACH');
   await db.query('INSERT INTO anvil.document_source_link_events(id,project_id,link_id,link_version,content_hash,snapshot_json,command_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[eventId,request.projectId,ref.id,ref.version,ref.contentHash,JSON.stringify(snapshot),receipt.id,at]);
   const updated=await db.query("UPDATE anvil.document_source_links SET link_version=$3,state='DETACHED',current_event_id=$4,updated_at=$5 WHERE project_id=$1 AND id=$2 AND link_version=$6 AND state='ACTIVE' AND current_event_id IS NOT DISTINCT FROM $7",[request.projectId,ref.id,ref.version,eventId,at,payload.sourceLinkRef.version,row.current_event_id??null]);
   if(updated.rowCount!==1)throw new AuthFailure('DOCUMENT_SOURCE_LINK_VERSION_CONFLICT',409);
   return receipt.result;
  }catch(error){if(error instanceof AuthFailure)throw error;throw new AuthFailure('DOCUMENT_SOURCE_LINK_STORAGE_UNAVAILABLE',503);}
 }
}
