import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,recordV1,refV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentRequestV1} from '../../../../contracts/runtime/source-content-request-v1.ts';

const definitionKeys=['protocolVersion','namespace','subjectUserId','disposition','expiresAt','allowedOperations','sourceRootRef','connectorRef','registrationRef','observerRef','targets','limits'];
const operationOrder=['linkDocumentSource','requestSourceContentHash','revokeSourceContentHash'];
const invalid=():never=>{throw Error('SOURCE_CONTENT_POLICY_DEFINITION_INVALID');};
/** 승인된 CM01~04의 순수 형식 후보다. 서버 문맥 진위·최신 head/CAS·관리 허가와 저장을 제공하지 않는다. */
export function buildSourceContentPolicySnapshotCandidate(payload:unknown,serverValues:unknown){
 try {
  const raw=canonicalJson(payload),contextRaw=canonicalJson(serverValues);
  if(Buffer.byteLength(raw,'utf8')>1048576||Buffer.byteLength(contextRaw,'utf8')>4096)return invalid();
  const p:unknown=JSON.parse(raw),c:unknown=JSON.parse(contextRaw);
  if(!recordV1(p,['previousPolicyRef','definition','reason'])||!recordV1(p.definition,definitionKeys)||!recordV1(c,['projectId','actorId','sequence','recordedAt']))return invalid();
  const d=p.definition;
  if(!uuidV1(c.projectId)||!uuidV1(c.actorId)||!Number.isSafeInteger(c.sequence)||c.sequence<1||!isoV1(c.recordedAt)||
   d.protocolVersion!==1||d.namespace!=='SOURCE_DOCUMENT_CONTENT_HASH_V1'||d.subjectUserId!==c.actorId||!['AUTO','DENY','REVOKED'].includes(d.disposition)||!isoV1(d.expiresAt)||Date.parse(d.expiresAt)<=Date.parse(c.recordedAt))return invalid();
  if(c.sequence===1?p.previousPolicyRef!==null:!refV1(p.previousPolicyRef)||p.previousPolicyRef.version!==1)return invalid();
  if(!arrayV1(d.allowedOperations,3))return invalid();
  const ordered=operationOrder.filter(k=>d.allowedOperations.includes(k));
  if(canonicalJson(ordered)!==canonicalJson(d.allowedOperations)||(d.disposition==='AUTO'?ordered.length===0:ordered.length!==0))return invalid();
  // 기존 요청 codec의 refs/targets/limits/reason 규칙만 재사용한다.
  // 검사 전용 0→1ms는 정책 recordedAt/expiresAt을 대체하거나 정책 TTL을 제한하지 않는다.
  readSourceContentRequestV1({sourceRootRef:d.sourceRootRef,connectorRef:d.connectorRef,registrationRef:d.registrationRef,observerRef:d.observerRef,targets:d.targets,limits:d.limits,expiresAt:'1970-01-01T00:00:00.001Z',reason:p.reason},0);
  const snapshot={...d,projectId:c.projectId,sequence:c.sequence,recordedAt:c.recordedAt,reason:p.reason};
  const snapshotRaw=canonicalJson(snapshot);if(Buffer.byteLength(snapshotRaw,'utf8')>1048576)return invalid();
  return {status:'UNVERIFIED' as const,reason:'POLICY_DEFINITION_SHAPE_ONLY' as const,snapshot,contentHash:contentHash(snapshotRaw),previousPolicyRef:p.previousPolicyRef,
   managementEvidenceVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
 }catch{return invalid();}
}
