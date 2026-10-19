import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {CheckpointInput} from '../../../../server/modules/checkpoints/checkpoint-input.ts';
import type {ProjectCheckpointPreparation} from '../../../../server/modules/checkpoints/project-checkpoint-preparation.ts';
export type CheckpointRecordDraft=Awaited<ReturnType<ProjectCheckpointPreparation['prepare']>>;
export type {CheckpointInput};
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
