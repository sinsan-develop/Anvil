import {canonicalJson} from '../../../../contracts/canonical.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectListCodec} from '../projects/service.ts';
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

/** 관측/선택 별도 stream의 유한 페이지. v1 목록/이력 원형은 그대로 둔다. */
export async function readDocumentSourceObservations(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,documentId:string,linkId:string,query:Record<string,unknown>,codec:ProjectListCodec){
 if(!recordV1(query,['version','contentHash',...Object.keys(query).filter(k=>k==='limit'||k==='cursor')])||typeof query.version!=='string'||!(/^[1-9][0-9]{0,14}$/).test(query.version)||!hashV1(query.contentHash)||!uuidV1(linkId)||query.limit!==undefined&&(typeof query.limit!=='string'||!(/^[1-9][0-9]?$/).test(query.limit)||Number(query.limit)>50)||query.cursor!==undefined&&(typeof query.cursor!=='string'||query.cursor.length>4096))throw new AuthFailure('DOCUMENT_SOURCE_LINK_INPUT_INVALID',400);
 const documentRef={id:documentId,version:Number(query.version),contentHash:query.contentHash},member=await projectMember(db,actor,projectId,true),reader=new DocumentSourceLinkRecords();
 await reader.read(db,actor,projectId,documentRef,linkId);
 if(!actor.authSession)throw new AuthFailure('AUTH_REQUIRED',401);await db.query('SELECT anvil.document_source_read_context($1,$2,$3,$4)',[actor.authSession.id,actor.actorId,actor.clientId,projectId]);
 const limit=query.limit===undefined?50:Number(query.limit),filter={query:canonicalJson({view:'DOCUMENT_SOURCE_OBSERVATIONS',projectId,documentRef,linkId,participation:member.participation}),archived:false,limit};let position:{at:string;id:string}|null=null;
 if(query.cursor!==undefined){try{position=codec.read(String(query.cursor),actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
 const rows=(await db.query(`SELECT id,stream_id,version,content_hash,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM anvil.document_source_observation_events WHERE project_id=$1 AND link_id=$2 AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid)) ORDER BY created_at DESC,id DESC LIMIT $5`,[projectId,linkId,position?.at??null,position?.id??null,limit+1])).rows;
 if(!arrayV1(rows,limit+1))throw new AuthFailure('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
 const items=[];let last:{at:string;id:string}|null=null;
 for(const row of rows.slice(0,limit)){
  if(!uuidV1(row.id)||!uuidV1(row.stream_id)||!Number.isSafeInteger(Number(row.version))||Number(row.version)<1||Number(row.version)>10000||typeof row.cursor_at!=='string')throw new AuthFailure('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
  const item=await reader.observation(db,actor,projectId,documentRef,linkId,row.stream_id,Number(row.version));
  if(item.ref.contentHash!==row.content_hash)throw new AuthFailure('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
  if(Buffer.byteLength(canonicalJson({projectId,documentRef,linkId,items:[...items,item],hasMore:true,nextCursor:'x'.repeat(4096)}))>2097152)break;
  items.push(item);last={at:row.cursor_at,id:row.id};
 }
 const hasMore=rows.length>items.length;if(hasMore&&!last)throw new AuthFailure('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
 return{projectId,documentRef,linkId,items,hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,last!):null};
}
