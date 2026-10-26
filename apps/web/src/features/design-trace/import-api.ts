import { ApiClient, ApiError } from '../../api/client.ts';
import { postDocumentCommand, type DocumentBuffer, type DocumentSession, type DocumentWrite } from './editor-api.ts';
import type { ImportCandidate } from '../../../../server/modules/documents/project-imports.ts';
import {readCreatedOriginal} from './created-original-import.ts';
import type {CreatedOriginalSelection} from '../../shell/routes.ts';
type AttachmentTarget={id:string;version:number;contentHash:string};
interface ImportBufferCommon { ownerUserId: string; name: string; bytes: Uint8Array<ArrayBuffer>; recordCommandId: string; attempted: boolean; uncertain: boolean; candidate: ImportCandidate | null; failure: { code: string; status: number; quarantinedArtifactId?:string } | null; attachmentTarget?:AttachmentTarget; attemptId?:string }
export interface UploadDocumentImportBuffer extends ImportBufferCommon {source?:'UPLOAD';upload:DocumentWrite;record:DocumentWrite|null}
export interface CreatedOriginalImportBuffer extends ImportBufferCommon {source:'CREATED_ORIGINAL';original:CreatedOriginalSelection;upload:null;record:DocumentWrite;attachmentTarget?:undefined}
export type DocumentImportBuffer=UploadDocumentImportBuffer|CreatedOriginalImportBuffer;
export function rejectedDocumentImport(state: DocumentImportBuffer): boolean {
  // 유효한 JSON 거절을 받은 경우만 명시 해제할 수 있다. 단절/HTML/5xx는 결과 미확인이다.
  return !state.uncertain && !!state.failure && [400,401,403,404,409,412,413,415,422].includes(state.failure.status) && state.failure.code !== 'RESPONSE_INVALID';
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,value]) => [k,normalize(value)])) : v;
const equal = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
async function digest(bytes: Uint8Array<ArrayBuffer>) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join(''); }
export async function prepareDocumentImport(buffer: DocumentBuffer, session: DocumentSession, file: { name: string; bytes: Uint8Array<ArrayBuffer> }): Promise<UploadDocumentImportBuffer> {
  if(buffer.documentId!==null)throw new ApiError('IMPORT_INPUT_INVALID');
  return prepareImport(buffer,session,file);
}
/** 브라우저 편집 대상 고정일 뿐 서버 권한/새 데이터 계약이 아니다. */
export function matchesDocumentImportTarget(buffer:DocumentBuffer,state:Pick<DocumentImportBuffer,'attachmentTarget'>):boolean{
 const t=state.attachmentTarget;
 return t===undefined?buffer.documentId===null&&buffer.baseVersion===0:!!t&&uuid.test(t.id)&&Number.isSafeInteger(t.version)&&t.version>0&&/^[a-f0-9]{64}$/.test(t.contentHash)&&buffer.documentId===t.id&&buffer.baseVersion===t.version&&buffer.baseHash===t.contentHash;
}
export async function preparePngAttachmentImport(buffer:DocumentBuffer,session:DocumentSession,file:{name:string;bytes:Uint8Array<ArrayBuffer>}):Promise<UploadDocumentImportBuffer>{
 const attachmentTarget={id:buffer.documentId??'',version:buffer.baseVersion,contentHash:buffer.baseHash??''};
 if(!matchesDocumentImportTarget(buffer,{attachmentTarget})||!file.name.toLowerCase().endsWith('.png')||file.bytes.byteLength<57||file.bytes.byteLength>2097152||buffer.proposalState||buffer.designIndexState||buffer.workPlanState)throw new ApiError('IMPORT_INPUT_INVALID');
 return prepareImport(buffer,session,file,attachmentTarget);
}
async function prepareImport(buffer:DocumentBuffer,session:DocumentSession,file:{name:string;bytes:Uint8Array<ArrayBuffer>},attachmentTarget?:AttachmentTarget):Promise<UploadDocumentImportBuffer>{
  if (!matchesDocumentImportTarget(buffer,{attachmentTarget}) || buffer.pending || buffer.importState || buffer.importCandidateRef || buffer.ownerUserId !== session.user.id || !uuid.test(buffer.projectId) || !uuid.test(session.clientId) || !Number.isSafeInteger(buffer.controlGeneration) || buffer.controlGeneration < 1 || file.bytes.byteLength > 20 * 1024 * 1024 || !file.name || file.name.length > 255) throw new ApiError('IMPORT_INPUT_INVALID');
  const bytes = new Uint8Array(file.bytes), name = file.name;
  const mediaType = /\.md$/i.test(name) ? 'text/markdown;charset=utf-8' : /\.txt$/i.test(name) ? 'text/plain;charset=utf-8' : /\.png$/i.test(name) ? 'image/png' : 'application/octet-stream';
  return { ownerUserId: session.user.id, name, bytes, upload: { schemaVersion: 1, projectId: buffer.projectId, commandId: crypto.randomUUID(), clientId: session.clientId, controlGeneration: buffer.controlGeneration, operation: 'uploadArtifact', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: { mediaType, bytes: bytes.length, contentHash: await digest(bytes) } }, record: null, recordCommandId: crypto.randomUUID(), attempted: false, uncertain: false, candidate: null, failure: null,...(attachmentTarget?{attachmentTarget:{...attachmentTarget}}:{}) };
}
function validCandidate(candidate: ImportCandidate, state: DocumentImportBuffer) {
  return candidate && uuid.test(candidate.id) && equal(candidate.originalRef, state.record?.payload.fileRef) && equal(candidate.intendedFormRef, state.record?.payload.intendedFormRef) && ['READY','FAILED','UNSUPPORTED'].includes(candidate.status) && Array.isArray(candidate.losses) && candidate.losses.length === 0 && Array.isArray(candidate.issues) && candidate.issues.length <= 200 && candidate.issues.every(i => i && typeof i.code === 'string' && typeof i.message === 'string') && (candidate.status === 'READY' ? candidate.parserVersion === 'UTF8_IDENTITY_1' && equal(candidate.extractedContentRef, candidate.originalRef) && candidate.originalRef.bytes <= 2 * 1024 * 1024 && ['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(candidate.originalRef.mediaType) : candidate.extractedContentRef === null);
}
export async function prepareCreatedOriginalImport(client:ApiClient,buffer:DocumentBuffer,session:DocumentSession,hint:CreatedOriginalSelection,active:()=>boolean):Promise<CreatedOriginalImportBuffer>{
 if(buffer.documentId!==null||buffer.baseVersion!==0||buffer.pending||buffer.importState||buffer.importPreparationId||buffer.importCandidateRef||buffer.proposalState||buffer.designIndexState||buffer.workPlanState||buffer.designDependencyState||buffer.formEntry||buffer.ownerUserId!==session.user.id||!uuid.test(session.user.id)||!uuid.test(session.clientId)||!validImportFormRef(buffer.formRef)||!Number.isSafeInteger(buffer.controlGeneration)||buffer.controlGeneration<1||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken))throw new ApiError('IMPORT_INPUT_INVALID');
 const original=structuredClone(hint),value=await readCreatedOriginal(client,buffer.projectId,original,active),commandId=crypto.randomUUID();
 return{source:'CREATED_ORIGINAL',original,ownerUserId:session.user.id,name:'프로젝트 생성 자료',bytes:value.bytes,upload:null,record:{schemaVersion:1,projectId:buffer.projectId,commandId,clientId:session.clientId,controlGeneration:buffer.controlGeneration,operation:'importDocument',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{fileRef:value.ref,intendedFormRef:structuredClone(buffer.formRef),sourceRefs:[]}},recordCommandId:commandId,attempted:false,uncertain:false,candidate:null,failure:null};
}
function validImportFormRef(ref:DocumentBuffer['formRef']):boolean{return!!ref&&Object.keys(ref).sort().join(',')==='contentHash,id,version'&&uuid.test(ref.id)&&Number.isSafeInteger(ref.version)&&ref.version>0&&/^[a-f0-9]{64}$/.test(ref.contentHash);}
/** 옛 bytes/후보는 표시 권한이 아니다. 현재 보호 조회에 성공한 화면만 사용한다. */
export async function refreshCreatedOriginalImport(client:ApiClient,state:CreatedOriginalImportBuffer,formRef:DocumentBuffer['formRef'],session:DocumentSession,active:()=>boolean):Promise<void>{
 const r=state.record,a=r?.payload.fileRef as ImportCandidate['originalRef'];
 if(state.source!=='CREATED_ORIGINAL'||state.upload!==null||state.ownerUserId!==session.user.id||r?.clientId!==session.clientId||!uuid.test(r.projectId)||!uuid.test(r.commandId)||r.commandId!==state.recordCommandId||r.operation!=='importDocument'||r.schemaVersion!==1||r.targetId!==null||r.expectedVersion!==0||r.approvalRef!==null||r.baselineRefs.length||!Number.isSafeInteger(r.controlGeneration)||r.controlGeneration<1||!validImportFormRef(formRef)||!equal(r.payload.intendedFormRef,formRef)||!equal(r.payload.sourceRefs,[])||Object.keys(r.payload).sort().join(',')!=='fileRef,intendedFormRef,sourceRefs'||!a||a.artifactId!==state.original.artifactId||!uuid.test(a.artifactId)||a.bytes!==state.bytes.length||a.contentHash!==await digest(state.bytes)||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken))throw new ApiError('IMPORT_INPUT_INVALID');
 await readCreatedOriginal(client,r.projectId,state.original,active,a);
 if(state.candidate){const c=await client.get<ImportCandidate>(`/api/v1/projects/${r.projectId}/imports/${state.candidate.id}`);if(!active())throw new ApiError('IMPORT_SOURCE_READ_PAUSED');if(!validCandidate(c,state)||!equal(c,state.candidate)){
   // GET 응답의 사용 이력 등 추가 metadata는 후보의 불변 필드와 별개다.
   if(!validCandidate(c,state)||c.id!==state.candidate.id||!equal({id:c.id,originalRef:c.originalRef,extractedContentRef:c.extractedContentRef,intendedFormRef:c.intendedFormRef,parserVersion:c.parserVersion,status:c.status,issues:c.issues,losses:c.losses},state.candidate))throw new ApiError('IMPORT_INTEGRITY_FAILED');
 }}
}
export async function continueDocumentImport<T extends DocumentImportBuffer>(client: ApiClient, state: T, formRef: DocumentBuffer['formRef'], session: DocumentSession, checkpoint: (state: T) => void, active: () => boolean): Promise<T> {
  if(state.source==='CREATED_ORIGINAL'){
    await refreshCreatedOriginalImport(client,state,formRef,session,active);if(!active())throw new ApiError('SAVE_CONTINUATION_PAUSED');
    const next={...state,attempted:true,uncertain:true};checkpoint(next);
    const response=await postDocumentCommand(client,state.record,session.csrfToken),candidate=response.data?.candidate as ImportCandidate;
    if(!active())throw new ApiError('SAVE_CONTINUATION_PAUSED');
    if(!validCandidate(candidate,next)||response.targetId!==candidate.originalRef.artifactId||response.version!==null||response.data.status!=='IMPORT_CANDIDATE')throw new ApiError('RESPONSE_INVALID');
    return{...next,uncertain:false,candidate,failure:null};
  }
  const u = state.upload;
  if (state.ownerUserId !== session.user.id || u.clientId !== session.clientId || !uuid.test(u.projectId) || !uuid.test(u.commandId) || !uuid.test(state.recordCommandId) || !uuid.test(session.clientId) || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) || u.operation !== 'uploadArtifact' || u.targetId !== null || u.expectedVersion !== 0 || u.schemaVersion !== 1 || u.baselineRefs.length || u.approvalRef !== null || !Number.isSafeInteger(u.controlGeneration) || u.controlGeneration < 1 || u.payload.bytes !== state.bytes.byteLength || state.bytes.byteLength > 20 * 1024 * 1024 || u.payload.contentHash !== await digest(state.bytes) || !['text/plain;charset=utf-8','text/markdown;charset=utf-8','application/octet-stream','image/png'].includes(String(u.payload.mediaType))) throw new ApiError('IMPORT_INPUT_INVALID');
  let next = state;
  if (!active()) throw new ApiError('SAVE_CONTINUATION_PAUSED');
  if (!next.record) {
    const response = await postDocumentCommand(client, u, session.csrfToken, state.bytes), a = response.data?.artifactRef;
    if (!a || !uuid.test(a.artifactId) || a.bytes !== u.payload.bytes || a.contentHash !== u.payload.contentHash || a.mediaType !== u.payload.mediaType || response.targetId !== a.artifactId || response.version !== null || response.data.status !== 'ARTIFACT_READY') throw new ApiError('RESPONSE_INVALID');
    // 같은 업로드의 정상 receipt를 확인한 시점에만 업로드 단계의 미확인을 해소한다.
    next = { ...next, uncertain: false, record: { ...u, commandId: state.recordCommandId, operation: 'importDocument', payload: { fileRef: a, intendedFormRef: { ...formRef }, sourceRefs: [] } } }; checkpoint(next);
  }
  const record = next.record!;
  const a = record.payload.fileRef as ImportCandidate['originalRef'];
  if (!a || !uuid.test(a.artifactId) || a.bytes !== u.payload.bytes || a.contentHash !== u.payload.contentHash || a.mediaType !== u.payload.mediaType || record.commandId !== state.recordCommandId || record.projectId !== u.projectId || record.clientId !== u.clientId || record.controlGeneration !== u.controlGeneration || record.operation !== 'importDocument' || record.targetId !== null || record.expectedVersion !== 0 || record.schemaVersion !== 1 || record.approvalRef !== null || record.baselineRefs.length || !equal(record.payload.intendedFormRef, formRef) || !equal(record.payload.sourceRefs, [])) throw new ApiError('IMPORT_INPUT_INVALID');
  if (!active()) throw new ApiError('SAVE_CONTINUATION_PAUSED');
  // 업로드 receipt는 가져오기 명령까지 해소하지 않는다. 재진입 전에 전송 중 상태를 보존한다.
  next={...next,uncertain:true};checkpoint(next);
  const response = await postDocumentCommand(client, record, session.csrfToken), candidate = response.data?.candidate as ImportCandidate;
  if (!validCandidate(candidate, next) || response.targetId !== candidate.originalRef.artifactId || response.version !== null || response.data.status !== 'IMPORT_CANDIDATE') throw new ApiError('RESPONSE_INVALID');
  return { ...next, uncertain: false, candidate, failure: null };
}
export async function adoptDocumentImport(client: ApiClient, buffer: DocumentBuffer, session: DocumentSession,active:()=>boolean=()=>true): Promise<DocumentBuffer> {
  const state = buffer.importState;
  if(state?.source==='CREATED_ORIGINAL'){
    if(buffer.documentId!==null||buffer.baseVersion!==0||buffer.pending||buffer.ownerUserId!==session.user.id||buffer.controlGeneration!==state.record.controlGeneration||buffer.projectId!==state.record.projectId||state.uncertain||state.failure||state.candidate?.status!=='READY'||!validCandidate(state.candidate,state))throw new ApiError('IMPORT_SELECTION_REQUIRED');
    await refreshCreatedOriginalImport(client,state,buffer.formRef,session,active);if(!active())throw new ApiError('IMPORT_SOURCE_READ_PAUSED');
    let body:string;try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(state.bytes);}catch{throw new ApiError('DOCUMENT_UTF8_INVALID');}
    return{...buffer,body,mediaType:state.candidate.originalRef.mediaType,title:buffer.title||state.name,content:{attachments:[state.candidate.originalRef],sections:[],sourceRefs:[]},importCandidateRef:state.candidate.id,importState:null,dirty:true,savedRef:null,failure:null};
  }
  if (!state?.candidate || buffer.documentId !== null || buffer.pending || state.ownerUserId !== session.user.id || buffer.ownerUserId !== session.user.id || state.upload.clientId !== session.clientId || state.upload.projectId !== buffer.projectId || !validCandidate(state.candidate, state) || state.candidate.status !== 'READY') throw new ApiError('IMPORT_SELECTION_REQUIRED');
  const candidate = await client.get<ImportCandidate>(`/api/v1/projects/${buffer.projectId}/imports/${state.candidate.id}`);
  if (!validCandidate(candidate, state) || candidate.id !== state.candidate.id || candidate.status !== 'READY' || await digest(state.bytes) !== candidate.originalRef.contentHash || state.bytes.length !== candidate.originalRef.bytes || !equal(candidate.intendedFormRef, buffer.formRef)) throw new ApiError('IMPORT_INTEGRITY_FAILED');
  let body: string; try { body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(state.bytes); } catch { throw new ApiError('DOCUMENT_UTF8_INVALID'); }
  return { ...buffer, body, mediaType: candidate.originalRef.mediaType, title: buffer.title || state.name, content: { attachments: [candidate.originalRef], sections: [], sourceRefs: [] }, importCandidateRef: candidate.id, importState: null, dirty: true, savedRef: null, failure: null };
}
