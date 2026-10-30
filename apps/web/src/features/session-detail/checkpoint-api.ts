import {documentControl} from '../design-trace/editor-api.ts';
import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {CheckpointInput} from '../../../../server/modules/checkpoints/checkpoint-input.ts';
import type {ProjectCheckpointPreparation} from '../../../../server/modules/checkpoints/project-checkpoint-preparation.ts';
export type CheckpointRecordDraft=Awaited<ReturnType<ProjectCheckpointPreparation['prepare']>>;
export type {CheckpointInput};
/** 선택 파일의 원바이트를 기존 준비 API로 명시 대조한다. 출처 인증·저장·재개는 하지 않는다. */
export async function inspectCheckpointFile(client:ApiClient,assignment:ConfirmedAssignmentView,rawBytes:Uint8Array,session:DocumentSession,active:()=>boolean){
 if(!active())return null;if(!(rawBytes instanceof Uint8Array)||rawBytes.byteLength>2*1024*1024)throw new ApiError('CHECKPOINT_FILE_INVALID');
 const bytes=new Uint8Array(rawBytes),prefix='# Anvil 작업현황 · 기록 초안\n\n이 기록은 수행자 선언이며 실제 파일/중지/회수·완료/재개를 인증하지 않습니다.\n\n';let text:string,snapshot:any;
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);if(!text.startsWith(prefix))throw Error();snapshot=JSON.parse(text.slice(prefix.length));if(!snapshot||snapshot.schemaVersion!==1||snapshot.projectId!==assignment.projectId||snapshot.sourceAssurance!=='CALLER_DECLARED_STATE_NOT_VERIFIED'||!same(snapshot.input?.state?.assignmentRef,assignment.ref)||Object.keys(flags).some(k=>snapshot[k]!==false))throw Error();}catch{throw new ApiError('CHECKPOINT_FILE_INVALID');}
 const prepared=await prepareCheckpointRecord(client,assignment,snapshot.input,session,active);if(!active()||!prepared)return null;
 if(text!==prepared.recordText||bytes.byteLength!==prepared.recordFile.bytes||await digest(text)!==prepared.recordFile.contentHash)throw new ApiError('CHECKPOINT_FILE_MISMATCH');
 return active()?{fileSource:'USER_SELECTED_BYTES_ONLY' as const,authenticityVerified:false as const,prepared}:null;
}
export function checkpointBufferKey(session:DocumentSession,projectId:string,ref:ConfirmedAssignmentView['ref']){
 const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
 if(![session?.user?.id,session?.clientId,projectId,ref?.id].every(uuid)||!Number.isSafeInteger(ref?.version)||ref.version<1||!/^[0-9a-f]{64}$/.test(ref?.contentHash))throw new ApiError('CHECKPOINT_INPUT_INVALID');
 return[session.user.id,session.clientId,projectId,ref.id,ref.version,ref.contentHash].join(':');
}
/** 사용자 클릭으로 전달할 바이트만 구성한다. 실제 로컬 저장 완료를 주장하지 않는다. */
export async function checkpointDownloadFile(raw:CheckpointRecordDraft){
 const v=structuredClone(raw),r=v?.assignmentRef,bytes=new TextEncoder().encode(v?.recordText),prefix='# Anvil 작업현황 · 기록 초안\n\n이 기록은 수행자 선언이며 실제 파일/중지/회수·완료/재개를 인증하지 않습니다.\n\n';
 if(!r||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.id)||!Number.isSafeInteger(r.version)||r.version<1||!same(r,v.snapshot?.input?.state?.assignmentRef)||Object.keys(flags).some(k=>(v as any)[k]!==false||(v.snapshot as any)?.[k]!==false)||bytes.byteLength!==v.recordFile?.bytes||await digest(v.recordText)!==v.recordFile.contentHash||await digest(ordered(v.snapshot))!==v.contentHash||!v.recordText.startsWith(prefix))fail();
 try{if(!same(JSON.parse(v.recordText.slice(prefix.length)),v.snapshot))fail();}catch{fail();}return{name:`anvil-checkpoint-${r.id}-v${r.version}.md`,bytes};
}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),flags={checkpointStored:false,recordFileStored:false,currentFactsVerified:false,writerReleaseVerified:false,resumeAuthorized:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};
function fail():never{throw new ApiError('CHECKPOINT_RESPONSE_INVALID');}
async function digest(text:string){const b=new TextEncoder().encode(text);if(b.length>2*1024*1024)fail();return[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');}
/** 기록 초안만 준비하며 파일/DB 저장·현재 실행/중지·재개를 인증하지 않는다. */
export async function prepareCheckpointRecord(client:ApiClient,rawAssignment:ConfirmedAssignmentView,rawInput:CheckpointInput,rawSession:DocumentSession,active:()=>boolean):Promise<CheckpointRecordDraft|null>{
 const a=structuredClone(rawAssignment),input:CheckpointInput=JSON.parse(ordered(rawInput)),session=structuredClone(rawSession),s=input?.state;
 if(!active())return null;
 if(!/^[0-9a-f-]{36}$/.test(a.projectId)||!s||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken)||!same(a.ref,s.assignmentRef)||!same(a.snapshot.definition.taskRef,s.currentPosition?.taskRef)||!same(a.snapshot.definition.baselineRefs,s.baselineRefs)||await digest(ordered(a.snapshot))!==a.ref.contentHash)throw new ApiError('CHECKPOINT_INPUT_INVALID');
 const body=JSON.stringify({assignmentRef:a.ref,input});if(new TextEncoder().encode(body).length>2*1024*1024)throw new ApiError('CHECKPOINT_INPUT_TOO_LARGE');if(!active())return null;
 let response:Response;try{response=await client.transport.call(globalThis,`/api/v1/projects/${a.projectId}/checkpoints/prepare`,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':session.csrfToken},body});}catch{throw new ApiError('CONNECTION_LOST');}if(!active())return null;
 let value:any;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))fail();value=await response.json();}catch{fail();}if(!response.ok)throw new ApiError(typeof value?.code==='string'&&/^[A-Z_]{1,80}$/.test(value.code)?value.code:'REQUEST_FAILED',response.status);
 const gaps=['CURRENT_SERVER_AND_OS_FACTS_NOT_VERIFIED',...(s.completedItems.length?['COMPLETED_ITEM_EVIDENCE_UNVERIFIED']:[]),...(s.lastLocalSequence===null?['LOCAL_SEQUENCE_UNVERIFIED']:[]),...(s.lastServerAck===null?['SERVER_ACK_UNVERIFIED']:[]),...(s.lastLocalSequence!==null&&s.lastServerAck!==null&&s.lastLocalSequence>s.lastServerAck.sequence?['LOCAL_EVENTS_NOT_ACKNOWLEDGED']:[]),...(s.recordFileRef===null?['RECORD_FILE_UNBOUND']:['RECORD_FILE_CONTENT_NOT_RECONCILED']),...(s.errorFingerprints.some(f=>!s.attemptCounts.some(c=>c.fingerprint===f))?['ATTEMPT_COUNTS_INCOMPLETE']:[]),...(!s.forbiddenActions.length?['FORBIDDEN_ACTIONS_UNSPECIFIED']:[])];
 const snapshot={schemaVersion:1,projectId:a.projectId,input,sourceAssurance:'CALLER_DECLARED_STATE_NOT_VERIFIED',gaps,...flags},recordText='# Anvil 작업현황 · 기록 초안\n\n이 기록은 수행자 선언이며 실제 파일/중지/회수·완료/재개를 인증하지 않습니다.\n\n'+JSON.stringify(snapshot,null,2)+'\n';
 const expected={projectId:a.projectId,assignmentRef:a.ref,sourceState:'FIXED_ASSIGNMENT_REFERENCE_ONLY',input,snapshot,contentHash:await digest(ordered(snapshot)),gaps,recordText,recordFile:{bytes:new TextEncoder().encode(recordText).length,contentHash:await digest(recordText),mediaType:'text/plain;charset=utf-8'},...flags};
 if(!same(value,expected))fail();await digest(ordered(value));return active()?structuredClone(value):null;
}


export interface CheckpointStoredRef{id:string;version:number;contentHash:string}
export interface CheckpointPending{command:{schemaVersion:1;projectId:string;commandId:string;clientId:string;controlGeneration:number;operation:'saveCheckpoint';targetId:string;expectedVersion:number;baselineRefs:[];approvalRef:null;payload:CheckpointInput};commandHash:string;ownerKey:string}
export interface CheckpointServerWork{pending:CheckpointPending|null;uncertain:boolean;rejected:{command:CheckpointPending;code:string}|null;storedRef:CheckpointStoredRef|null;baseRef?:CheckpointStoredRef|null;history?:{command:CheckpointPending;code:string}[]}
const uuidStorage=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function storageRef(v:any):v is CheckpointStoredRef{return v&&Object.keys(v).sort().join(',')==='contentHash,id,version'&&uuidStorage(v.id)&&Number.isSafeInteger(v.version)&&v.version===1&&typeof v.contentHash==='string'&&/^[0-9a-f]{64}$/.test(v.contentHash);}
const checkpointPrefix='# Anvil 작업현황 · 기록 초안\n\n이 기록은 수행자 선언이며 실제 파일/중지/회수·완료/재개를 인증하지 않습니다.\n\n';
function gapsFor(s:CheckpointInput['state']){return['CURRENT_SERVER_AND_OS_FACTS_NOT_VERIFIED',...(s.completedItems.length?['COMPLETED_ITEM_EVIDENCE_UNVERIFIED']:[]),...(s.lastLocalSequence===null?['LOCAL_SEQUENCE_UNVERIFIED']:[]),...(s.lastServerAck===null?['SERVER_ACK_UNVERIFIED']:[]),...(s.lastLocalSequence!==null&&s.lastServerAck!==null&&s.lastLocalSequence>s.lastServerAck.sequence?['LOCAL_EVENTS_NOT_ACKNOWLEDGED']:[]),...(s.recordFileRef===null?['RECORD_FILE_UNBOUND']:['RECORD_FILE_CONTENT_NOT_RECONCILED']),...(s.errorFingerprints.some(f=>!s.attemptCounts.some(c=>c.fingerprint===f))?['ATTEMPT_COUNTS_INCOMPLETE']:[]),...(!s.forbiddenActions.length?['FORBIDDEN_ACTIONS_UNSPECIFIED']:[])];}
export async function freezeCheckpointSave(client:ApiClient,rawAssignment:ConfirmedAssignmentView,rawInput:CheckpointInput,rawSession:DocumentSession,active:()=>boolean):Promise<CheckpointPending|null>{
 const assignment=structuredClone(rawAssignment),input=structuredClone(rawInput),session=structuredClone(rawSession),ownerKey=checkpointBufferKey(session,assignment.projectId,assignment.ref);if(!active())return null;
 if(!same(input.state.assignmentRef,assignment.ref)||!same(input.state.currentPosition.taskRef,assignment.snapshot.definition.taskRef)||!same(input.state.baselineRefs,assignment.snapshot.definition.baselineRefs)||await digest(ordered(assignment.snapshot))!==assignment.ref.contentHash)throw new ApiError('CHECKPOINT_INPUT_INVALID');if(!active())return null;
 const controlGeneration=await documentControl(client,assignment.projectId,session);if(!active())return null;
 const command={schemaVersion:1 as const,projectId:assignment.projectId,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration,operation:'saveCheckpoint' as const,targetId:assignment.ref.id,expectedVersion:assignment.ref.version,baselineRefs:[] as [],approvalRef:null,payload:input},commandHash=await digest(ordered(command));return active()?{command,commandHash,ownerKey}:null;
}
export async function sendCheckpointSave(client:ApiClient,raw:CheckpointPending,rawSession:DocumentSession,active:()=>boolean){
 const pending=structuredClone(raw),session=structuredClone(rawSession),c=pending.command;if(!active())return null;
 if(c.operation!=='saveCheckpoint'||c.approvalRef!==null||c.baselineRefs.length||pending.ownerKey!==checkpointBufferKey(session,c.projectId,c.payload.state.assignmentRef)||c.clientId!==session.clientId||c.targetId!==c.payload.state.assignmentRef.id||c.expectedVersion!==c.payload.state.assignmentRef.version||!uuidStorage(c.commandId)||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||pending.commandHash!==await digest(ordered(c)))throw new ApiError('CHECKPOINT_COMMAND_INVALID');if(!active())return null;
 let response:Response;try{response=await client.transport.call(globalThis,`/api/v1/projects/${c.projectId}/commands`,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':session.csrfToken,'Idempotency-Key':c.commandId},body:JSON.stringify(c)});}catch{throw new ApiError('CONNECTION_LOST');}if(!active())return null;
 let v:any;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))fail();v=await response.json();}catch{throw new ApiError('RESPONSE_INVALID',response.status);}if(!active())return null;
 if(!response.ok)throw new ApiError(typeof v?.code==='string'&&/^[A-Z_]{1,80}$/.test(v.code)?v.code:'REQUEST_FAILED',response.status);
 if(v?.status!=='APPLIED'||v.commandId!==c.commandId||v.projectId!==c.projectId||!uuidStorage(v.operationId)||!storageRef(v.data?.ref)||v.targetId!==v.data.ref.id||v.version!==1||!Array.isArray(v.evidenceRefs)||!Array.isArray(v.warnings)||v.data.status!=='CHECKPOINT_RECORDED'||v.serverReceivedAt!==v.data.snapshot?.recordedAt||!same(v.data.snapshot?.recordedBy,{kind:'HUMAN',userId:session.user.id,clientId:session.clientId})||!same(v.data.snapshot?.input,c.payload))fail();
 if(v.data.checkpointStored!==true||Object.keys(flags).filter(k=>k!=='checkpointStored').some(k=>v.data[k]!==false))fail();await validateCheckpointSnapshot({projectId:c.projectId,ref:c.payload.state.assignmentRef},v.data.ref,v.data.snapshot);return active()?structuredClone(v.data.ref) as CheckpointStoredRef:null;
}
export function checkpointKnownRejection(error:unknown){return error instanceof ApiError&&[400,403,404,409,412,422,429].includes(error.status)&&!['RESPONSE_INVALID','REQUEST_FAILED','CONNECTION_LOST'].includes(error.code)&&/^[A-Z_]{1,80}$/.test(error.code);}
async function validateCheckpointSnapshot(a:{projectId:string;ref:any;snapshot?:any},ref:CheckpointStoredRef,s:any){
 try{const input=s.input,gaps=gapsFor(input.state),preparedSnapshot={schemaVersion:1,projectId:a.projectId,input,sourceAssurance:'CALLER_DECLARED_STATE_NOT_VERIFIED',gaps,...flags},recordText=checkpointPrefix+JSON.stringify(preparedSnapshot,null,2)+'\n',recordFile={bytes:new TextEncoder().encode(recordText).length,contentHash:await digest(recordText),mediaType:'text/plain;charset=utf-8'},preparedHash=await digest(ordered(preparedSnapshot)),expected={schemaVersion:1,projectId:a.projectId,input,preparedHash,recordFile,recordedBy:s.recordedBy,recordedAt:s.recordedAt,sourceAssurance:'HUMAN_RECORDED_CLAIMS_NOT_VERIFIED',gaps,...flags,checkpointStored:true};
 if(!storageRef(ref)||!same(s,expected)||!same(input.state.assignmentRef,a.ref)||s.recordedBy?.kind!=='HUMAN'||!uuidStorage(s.recordedBy.userId)||!uuidStorage(s.recordedBy.clientId)||typeof s.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s.recordedAt)||!Number.isFinite(Date.parse(s.recordedAt))||await digest(ordered(s))!==ref.contentHash||new TextEncoder().encode(ordered(s)).length+recordFile.bytes>2*1024*1024)fail();if(a.snapshot&&(!same(input.state.currentPosition.taskRef,a.snapshot.definition.taskRef)||!same(input.state.baselineRefs,a.snapshot.definition.baselineRefs)||await digest(ordered(a.snapshot))!==a.ref.contentHash))fail();return recordText;
 }catch{fail();}
}
export async function readStoredCheckpoint(client:ApiClient,rawAssignment:ConfirmedAssignmentView,rawRef:CheckpointStoredRef,active:()=>boolean){
 const a=structuredClone(rawAssignment),ref=structuredClone(rawRef);if(!storageRef(ref)||!active())return null;const v:any=await client.get(`/api/v1/projects/${a.projectId}/checkpoints/${ref.id}`);if(!active())return null;
 const recordText=await validateCheckpointSnapshot(a,ref,v.snapshot);if(!active())return null;if(!same(v.ref,ref)||v.projectId!==a.projectId||v.recordText!==recordText||!Number.isFinite(Date.parse(v.observedAt))||Date.parse(v.snapshot.recordedAt)>Date.parse(v.observedAt)||!Number.isSafeInteger(v.serverSequence)||v.serverSequence<1)fail();await digest(ordered(v));return active()?structuredClone(v):null;
}
export async function listStoredCheckpoints(client:ApiClient,rawAssignment:ConfirmedAssignmentView,cursor:string|null,active:()=>boolean){
 const a=structuredClone(rawAssignment),q=new URLSearchParams({assignmentId:a.ref.id,assignmentVersion:String(a.ref.version),assignmentHash:a.ref.contentHash,limit:'20'});if(cursor!==null)q.set('cursor',cursor);if(!active())return null;const v:any=await client.get(`/api/v1/projects/${a.projectId}/checkpoints?${q}`);if(!active())return null;
 if(!v||Object.keys(v).sort().join(',')!=='hasMore,items,nextCursor,observedAt'||!Array.isArray(v.items)||v.items.length>20||typeof v.hasMore!=='boolean'||(v.hasMore?(typeof v.nextCursor!=='string'||v.nextCursor.length>4096):v.nextCursor!==null))fail();let last=Infinity;for(const item of v.items){if(Object.keys(item).sort().join(',')!=='assignmentRef,previousRef,recordedAt,ref,serverSequence'||!storageRef(item.ref)||!same(item.assignmentRef,a.ref)||item.previousRef!==null&&!storageRef(item.previousRef)||!Number.isSafeInteger(item.serverSequence)||item.serverSequence<1||item.serverSequence>=last||!Number.isFinite(Date.parse(item.recordedAt)))fail();last=item.serverSequence;}if(!Number.isFinite(Date.parse(v.observedAt))||v.items.some((i:any)=>Date.parse(i.recordedAt)>Date.parse(v.observedAt)))fail();await digest(ordered(v));return active()?structuredClone(v):null;
}
