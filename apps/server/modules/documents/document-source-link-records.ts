import {readDocumentObservation} from './document-source-observation.ts';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,recordV1,refV1,uuidV1,isoV1,cloneV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {readDocumentSourceLinkHistory} from './document-source-link-history.ts';
const same=(a:unknown,b:unknown)=>{try{return canonicalJson(a)===canonicalJson(b);}catch{return false;}};
const invalid=():never=>{throw new AuthFailure('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);};
/** 인증된 서버 transaction 전용 저장 조회 consumer. HTTP/DDL/쓰기 및 actual content verifier는 아직 미연결.
 * document_source_links/events의 후속 미적용 저장 schema를 전제로 한다. 실제 PG 검증 전 사용 불가.
 * 저장 receipt와 hash 일관성은 OS·원문 진위/현재 source 권한의 증명이 아니다. */
export class DocumentSourceLinkRecords{
 /** 고정 과거 사건 조회. 원 v1/현재 참여권한을 검사하며 새 관측/파일 IO를 시작하지 않는다. */
 async observation(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,documentRef:Ref,linkId:string,streamId:string,version:number){
  if(!uuidV1(streamId)||!Number.isSafeInteger(version)||version<1||version>10000)throw new AuthFailure('DOCUMENT_SOURCE_LINK_INPUT_INVALID',400);
  const original=await this.read(db,actor,projectId,documentRef,linkId);
  let rows:any[];try{rows=(await db.query(`SELECT e.*,c.operation,c.state command_state,c.command_id command_key,c.actor_id command_actor,c.client_id command_client,c.expected_version,c.policy_ref,c.result_ref,
   ar.command_id receipt_command_id,ar.subject_ref,ar.policy_ref receipt_policy_ref,origin.content_hash initial_hash,previous.content_hash previous_hash,
   (SELECT count(*) FROM anvil.audit_events a WHERE a.project_id=e.project_id AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest AND a.target_ref=c.result_ref->'data'->'ref') audit_count
   FROM anvil.document_source_observation_events e JOIN anvil.commands c ON c.project_id=e.project_id AND c.id=e.command_id
   JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=e.project_id
   JOIN anvil.document_source_link_events origin ON origin.project_id=e.project_id AND origin.link_id=e.link_id AND origin.link_version=1
   LEFT JOIN anvil.document_source_observation_events previous ON previous.project_id=e.project_id AND previous.link_id=e.link_id AND previous.stream_id=e.stream_id AND previous.version=e.version-1
   WHERE e.project_id=$1 AND e.link_id=$2 AND e.stream_id=$3 AND e.version=$4`,[projectId,linkId,streamId,version])).rows;}catch{throw new AuthFailure('DOCUMENT_SOURCE_LINK_STORAGE_UNAVAILABLE',503);}
  if(!rows.length)throw new AuthFailure('NOT_FOUND',404);if(rows.length!==1)return invalid();
  const row=rows[0],snapshot=row.snapshot_json,ref={id:streamId,version,contentHash:row.content_hash};
  if(row.project_id!==projectId||row.link_id!==linkId||row.stream_id!==streamId||Number(row.version)!==version||!refV1(ref)||!recordV1(snapshot,['projectId','sourceLinkRef','observation','choice','reason','previousRef','proposalId','importId','recordedAt'])||snapshot.projectId!==projectId||!refV1(snapshot.sourceLinkRef)||snapshot.sourceLinkRef.id!==linkId||snapshot.sourceLinkRef.version!==1||snapshot.sourceLinkRef.contentHash!==row.initial_hash||!isoV1(snapshot.recordedAt)||typeof snapshot.reason!=='string'||!snapshot.reason.trim()||snapshot.reason.length>20000||!['KEEP_SERVER','COLLECT_PROPOSAL',null].includes(snapshot.choice)||snapshot.proposalId!==null&&!uuidV1(snapshot.proposalId)||snapshot.importId!==null&&!uuidV1(snapshot.importId)||contentHash(canonicalJson(snapshot))!==ref.contentHash)return invalid();
  if(version===1?snapshot.previousRef!==null:!same(snapshot.previousRef,{id:streamId,version:version-1,contentHash:row.previous_hash}))return invalid();
  const proof=snapshot.observation,scope=proof?.snapshot?.scope;
  if(!scope||scope.projectId!==projectId||!same(scope.documentRef,documentRef)||scope.actorId!==row.command_actor||scope.clientId!==row.command_client||!uuidV1(scope.sourceRootId)||!uuidV1(scope.humanSessionId)||!Number.isSafeInteger(scope.controlGeneration)||scope.controlGeneration<1||typeof scope.relativePath!=='string')return invalid();
  try{readDocumentObservation(proof,scope,proof.snapshot.sourceSnapshotRef);}catch{return invalid();}
  const result=row.result_ref,initial=snapshot.choice===null;
  if(row.command_state!=='APPLIED'||row.operation!==(initial?'linkDocumentSource':'proposeDocumentSourceChange')||Number(row.expected_version)!==(initial?0:1)||!uuidV1(row.command_id)||row.receipt_command_id!==row.command_id||!same(row.subject_ref,{kind:'HUMAN',userId:row.command_actor,clientId:row.command_client})||!refV1(row.policy_ref)||!same(row.policy_ref,row.receipt_policy_ref)||Number(row.audit_count)!==1||result?.status!=='APPLIED'||result.projectId!==projectId||result.commandId!==row.command_key||!same(result.data?.sourceEvent,{ref,snapshot})||result.serverReceivedAt!==snapshot.recordedAt||result.data?.status!==(initial?'DOCUMENT_SOURCE_LINKED':'DOCUMENT_SOURCE_CHANGE_RECORDED'))return invalid();
  if(initial?!same(result.data.ref,snapshot.sourceLinkRef):!same(result.data.ref,ref)||!same(result.data.snapshot,snapshot))return invalid();
  if(snapshot.choice==='KEEP_SERVER'&&(snapshot.proposalId!==null||snapshot.importId!==null)||snapshot.choice==='COLLECT_PROPOSAL'&&(snapshot.proposalId===null||snapshot.importId===null||result.data.proposal?.id!==snapshot.proposalId))return invalid();
  const origin=original.rawAllowed?original.history[0]!.snapshot:null;
  const comparison=origin?(proof.snapshot.blobHash===origin.blobHash?'MATCH':'DRIFT'):'UNVERIFIED';
  const view={projectId,documentRef:cloneV1(documentRef),sourceLinkRef:cloneV1(snapshot.sourceLinkRef),ref,comparison,currentObservationVerified:false as const,rawAllowed:original.rawAllowed};
  return original.rawAllowed?{...view,record:cloneV1({ref,snapshot})}:view;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,documentRef:Ref,linkId:string){
  if(!uuidV1(actor?.actorId)||!uuidV1(projectId)||!refV1(documentRef)||!uuidV1(linkId))throw new AuthFailure('DOCUMENT_SOURCE_LINK_INPUT_INVALID',422);
  const selected=cloneV1(documentRef);
  // 회원 검사와 원문/연결/이력을 한 MVCC statement에서 읽어 이전 회원 조회 결과를 재사용하지 않는다.
  let rows:any[];
  try{rows=(await db.query(`WITH member_scope AS (
   SELECT m.participation FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id
   WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL
  ), target_document AS (
   SELECT content_hash FROM anvil.document_versions WHERE project_id=$1 AND document_id=$3 AND version=$4 AND EXISTS(SELECT 1 FROM member_scope)
  ), target_link AS (
   SELECT id,link_version,state FROM anvil.document_source_links WHERE project_id=$1 AND document_id=$3 AND version=$4 AND id=$5 AND EXISTS(SELECT 1 FROM target_document)
  ) SELECT m.participation,d.content_hash document_hash,l.id link_id,l.link_version head_version,l.state link_state,COALESCE(h.events,'[]'::jsonb) events
  FROM member_scope m LEFT JOIN target_document d ON true LEFT JOIN target_link l ON true
  LEFT JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object(
    'ref',jsonb_build_object('id',e.link_id,'version',e.link_version,'contentHash',e.content_hash),'snapshot',e.snapshot_json,
    'commandId',e.command_id,'commandProjectId',c.project_id,'actorId',c.actor_id,'clientId',c.client_id,'commandKey',c.command_id,
    'operation',c.operation,'commandState',c.state,'expectedVersion',c.expected_version,'policyRef',c.policy_ref,'result',c.result_ref,
    'receipt',jsonb_build_object('commandId',ar.command_id,'scopeKind',ar.scope_kind,'scopeId',ar.scope_id,'subjectRef',ar.subject_ref,'policyRef',ar.policy_ref)
   ) ORDER BY e.link_version) events FROM (
    SELECT * FROM anvil.document_source_link_events WHERE project_id=$1 AND link_id=l.id ORDER BY link_version LIMIT 3
   ) e LEFT JOIN anvil.commands c ON c.project_id=$1 AND c.id=e.command_id
   LEFT JOIN anvil.authorization_receipts ar ON ar.command_id=c.id AND ar.id=c.authorization_receipt_id
  ) h ON true`,[projectId,actor.actorId,selected.id,selected.version,linkId])).rows;
  }catch{throw new AuthFailure('DOCUMENT_SOURCE_LINK_STORAGE_UNAVAILABLE',503);}
  if(!rows.length)throw new AuthFailure('NOT_FOUND',404);
  if(rows.length!==1)return invalid();const row=rows[0];
  if(row.document_hash===null||row.link_id===null)throw new AuthFailure('NOT_FOUND',404);
  if(!['OWNER','VIEWER','HANDOFF_ELIGIBLE'].includes(row.participation)||row.document_hash!==selected.contentHash||row.link_id!==linkId||!arrayV1(row.events,2)||!row.events.length)return invalid();
  const records=[];
  for(const e of row.events){
   if(!recordV1(e,['ref','snapshot','commandId','commandProjectId','actorId','clientId','commandKey','operation','commandState','expectedVersion','policyRef','result','receipt'])||!refV1(e.ref)||!uuidV1(e.commandId)||e.commandProjectId!==projectId||!uuidV1(e.actorId)||!uuidV1(e.clientId)||!uuidV1(e.commandKey)||e.commandState!=='APPLIED'||!refV1(e.policyRef)||!recordV1(e.receipt,['commandId','scopeKind','scopeId','subjectRef','policyRef']))return invalid();
   const r=e.result,a=e.receipt;
   if(e.ref.id!==linkId)return invalid();
   if(e.operation!==(e.ref.version===1?'linkDocumentSource':'detachDocumentSource')||Number(e.expectedVersion)!==e.ref.version-1||a.commandId!==e.commandId||a.scopeKind!=='PROJECT'||a.scopeId!==projectId||!same(a.subjectRef,{kind:'HUMAN',userId:e.actorId,clientId:e.clientId})||!refV1(a.policyRef)||!same(a.policyRef,e.policyRef)||!r||r.commandId!==e.commandKey||!uuidV1(r.operationId)||r.projectId!==projectId||r.status!=='APPLIED'||r.targetId!==linkId||r.version!==e.ref.version||!isoV1(r.serverReceivedAt)||!r.data||r.data.status!==(e.ref.version===1?'DOCUMENT_SOURCE_LINKED':'DOCUMENT_SOURCE_DETACHED')||!same(r.data.ref,e.ref)||!same(r.data.snapshot,e.snapshot))return invalid();
   records.push({ref:e.ref,snapshot:e.snapshot});
  }
  const history=readDocumentSourceLinkHistory({projectId,documentRef:selected},records),latest=history.at(-1)!;
  if(Number(row.head_version)!==latest.ref.version||row.link_state!==latest.snapshot.state)return invalid();
  const shared={projectId,documentRef:cloneV1(selected),ref:latest.ref,state:latest.snapshot.state,comparison:'UNVERIFIED' as const};
  return row.participation==='OWNER'?{...shared,rawAllowed:true as const,history}:{...shared,rawAllowed:false as const};
 }
}
