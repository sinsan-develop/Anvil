import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {recordV1,uuidV1,hashV1,arrayV1} from '../../../../contracts/runtime/validation-v1.ts';
import {DocumentSourceLinkRecords} from './document-source-link-records.ts';

/** 0032 적용 후 인증 transaction에서 사용한다. 원문 관측/링크 생성·전체 목록 완료를 인증하지 않는다. */
export async function readDocumentSourceLinks(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,documentId:string,query:unknown){
 if(!uuidV1(actor.actorId)||!uuidV1(projectId)||!uuidV1(documentId)||!recordV1(query,['version','contentHash'])
  ||typeof query.version!=='string'||!(/^[1-9][0-9]{0,14}$/).test(query.version)||!hashV1(query.contentHash))throw new AuthFailure('DOCUMENT_SOURCE_LINK_INPUT_INVALID',400);
 const documentRef={id:documentId,version:Number(query.version),contentHash:query.contentHash};
 try{
  // 목록 전체를 조립하는 동안 회원/프로젝트 회수와 역할 변경이 교차하지 않도록 같은 transaction에서 잠근다.
  const rows=(await db.query(`WITH member_scope AS (
   SELECT p.id FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id
   WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL FOR SHARE OF p,m
  ), source_link_ids AS (
   SELECT id FROM anvil.document_source_links WHERE project_id IN(SELECT id FROM member_scope) AND document_id=$3 AND version=$4 ORDER BY id LIMIT 21
  ) SELECT v.content_hash document_hash,COALESCE((SELECT array_agg(id ORDER BY id) FROM source_link_ids),'{}'::uuid[]) ids
   FROM anvil.document_versions v WHERE v.project_id IN(SELECT id FROM member_scope) AND v.document_id=$3 AND v.version=$4`,[projectId,actor.actorId,documentId,documentRef.version])).rows;
  if(!rows.length)throw new AuthFailure('NOT_FOUND',404);
  if(rows.length!==1||!arrayV1(rows[0].ids,21)||!rows[0].ids.every(uuidV1)||new Set(rows[0].ids).size!==rows[0].ids.length)throw new AuthFailure('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
  if(rows[0].document_hash!==documentRef.contentHash)throw new AuthFailure('DOCUMENT_SOURCE_REFERENCE_CHANGED',409);
  const items=[],reader=new DocumentSourceLinkRecords();
  for(const id of rows[0].ids.slice(0,20))items.push(await reader.read(db,actor,projectId,documentRef,id));
  return{projectId,documentRef,items,hasMore:rows[0].ids.length>20,observedAt:new Date().toISOString()};
 }catch(error){if(error instanceof AuthFailure)throw error;throw new AuthFailure('DOCUMENT_SOURCE_LINK_STORAGE_UNAVAILABLE',503);}
}
