import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,recordV1,refV1,uuidV1,hashV1,isoV1,cloneV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {isRelativeSourceFileV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';

interface LinkInput{documentRef:Ref;sourceRootId:string;relativePath:string;sourceSnapshotRef:Ref;blobHash:string;reason:string}
interface DetachInput{sourceLinkRef:Ref;reason:string}
interface Scope{projectId:string;documentRef:Ref}
interface Snapshot extends LinkInput{projectId:string;kind:'LINKED'|'DETACHED';state:'ACTIVE'|'DETACHED';previousRef:Ref|null;recordedAt:string}
export interface DocumentSourceLinkRecord{ref:Ref;snapshot:Snapshot}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(code='DOCUMENT_SOURCE_LINK_INPUT_INVALID',status=422):never=>{throw new AuthFailure(code,status);};
function reason(value:unknown){if(typeof value!=='string'||!value.trim()||!value.isWellFormed()||value.length>20000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail();}
function link(value:unknown):value is LinkInput{
 if(!recordV1(value,['documentRef','sourceRootId','relativePath','sourceSnapshotRef','blobHash','reason'])||!refV1(value.documentRef)||!uuidV1(value.sourceRootId)||!isRelativeSourceFileV1(value.relativePath)||!refV1(value.sourceSnapshotRef)||!hashV1(value.blobHash))return false;
 reason(value.reason);return true;
}
/** 문법만 검사한다. 원문/OS/서명/현재 권한의 검증이나 연결 생성 허가가 아니다. */
export function readDocumentSourceLinkInput(operation:'linkDocumentSource',value:unknown):LinkInput;
export function readDocumentSourceLinkInput(operation:'detachDocumentSource',value:unknown):DetachInput;
export function readDocumentSourceLinkInput(operation:string,value:unknown):LinkInput|DetachInput;
export function readDocumentSourceLinkInput(operation:string,value:unknown):LinkInput|DetachInput{
 if(operation==='linkDocumentSource'){if(!link(value))return fail();}
 else if(operation==='detachDocumentSource'){if(!recordV1(value,['sourceLinkRef','reason'])||!refV1(value.sourceLinkRef))return fail();reason(value.reason);}
 else return fail();
 if(inspectArtifact(Buffer.from(canonicalJson(value),'utf8')).state==='SUSPECTED')return fail('DOCUMENT_SOURCE_LINK_SENSITIVE_CONTENT_SUSPECTED',412);
 return cloneV1(value) as LinkInput|DetachInput;
}
/** LINKED→DETACHED 부분 계약의 내부 이력 검사. 해시 일치는 출처/관측의 진위·자료 접근 허가가 아니다.
 * 저장 receipt/audit·same-project root/실제 content proof는 후속 서버 transaction에서 별도로 확인해야 한다.
 * OBSERVED/KEEP_SERVER/PROPOSAL_CREATED는 아직 이 부분 계약에서 지원하지 않는다. */
export function readDocumentSourceLinkHistory(scope:Scope,value:unknown):DocumentSourceLinkRecord[]{
 if(!recordV1(scope,['projectId','documentRef'])||!uuidV1(scope.projectId)||!refV1(scope.documentRef)||!arrayV1(value,2))return fail('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
 let previous:DocumentSourceLinkRecord|null=null;
 for(const entry of value){
  if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||!recordV1(entry.snapshot,['projectId','documentRef','sourceRootId','relativePath','sourceSnapshotRef','blobHash','reason','kind','state','previousRef','recordedAt']))return fail('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
  const s=entry.snapshot,{projectId,kind,state,previousRef,recordedAt,...input}=s;
  if(previousRef!==null&&!refV1(previousRef))return fail('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
  try{readDocumentSourceLinkInput('linkDocumentSource',input);}catch{return fail('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);}
  if(projectId!==scope.projectId||!same(input.documentRef,scope.documentRef)||!isoV1(recordedAt)||entry.ref.version!==(previous?2:1)||contentHash(canonicalJson(s))!==entry.ref.contentHash)return fail('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
  if(!previous){if(kind!=='LINKED'||state!=='ACTIVE'||previousRef!==null)return fail('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);}
  else{
   const old=previous.snapshot;
   if(kind!=='DETACHED'||state!=='DETACHED'||old.state!=='ACTIVE'||entry.ref.id!==previous.ref.id||!same(previousRef,previous.ref)||Date.parse(recordedAt)<Date.parse(old.recordedAt)||!same([input.documentRef,input.sourceRootId,input.relativePath,input.sourceSnapshotRef,input.blobHash],[old.documentRef,old.sourceRootId,old.relativePath,old.sourceSnapshotRef,old.blobHash]))return fail('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
  }
  previous=entry as DocumentSourceLinkRecord;
 }
 return cloneV1(value) as DocumentSourceLinkRecord[];
}
/** 분리 snapshot 준비만. DB/파일 변경·명령 replay/허가·실제 detach 성공을 수행하지 않는다. */
export function prepareDocumentSourceDetach(scope:Scope,history:unknown,payload:unknown,recordedAt:string):Snapshot{
 const entries=readDocumentSourceLinkHistory(scope,history),input=readDocumentSourceLinkInput('detachDocumentSource',payload),latest=entries.at(-1);
 if(!latest||latest.snapshot.state!=='ACTIVE'||!same(latest.ref,input.sourceLinkRef))return fail('DOCUMENT_SOURCE_LINK_VERSION_CONFLICT',409);
 if(!isoV1(recordedAt)||Date.parse(recordedAt)<Date.parse(latest.snapshot.recordedAt))return fail();
 return {...cloneV1(latest.snapshot),kind:'DETACHED',state:'DETACHED',previousRef:cloneV1(latest.ref),reason:input.reason,recordedAt};
}
