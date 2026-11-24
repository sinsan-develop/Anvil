import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from './result-api.ts';
import {checkpointDownloadFile,validateStoredCheckpointView,type inspectCheckpointFile,type readStoredCheckpoint} from './checkpoint-api.ts';
import {readStoredObservations} from './observation-journal-api.ts';
export type CheckpointFileInspection=NonNullable<Awaited<ReturnType<typeof inspectCheckpointFile>>>;
export type CheckpointStoredInspection=NonNullable<Awaited<ReturnType<typeof readStoredCheckpoint>>>;
export type CheckpointStoredSource={source:'SERVER_STORED_CHECKPOINT';value:CheckpointStoredInspection};
export type CheckpointComparisonSource=CheckpointFileInspection|CheckpointStoredSource;
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),integer=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0,ref=(r:any)=>r&&typeof r.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.id)&&integer(r.version)&&r.version>0&&typeof r.contentHash==='string'&&/^[0-9a-f]{64}$/.test(r.contentHash);
function fail():never{throw new ApiError('CHECKPOINT_JOURNAL_SCOPE_INVALID');}
async function hash(v:unknown){const bytes=new TextEncoder().encode(ordered(v));if(bytes.length>2*1024*1024)fail();return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function normalizeSource(raw:CheckpointComparisonSource){
 const source=structuredClone(raw) as any;
 if(source?.source!=='SERVER_STORED_CHECKPOINT'){
  const p=source?.prepared,s=p?.snapshot?.input?.state;
  if(source?.fileSource!=='USER_SELECTED_BYTES_ONLY'||source.authenticityVerified!==false||p?.sourceState!=='FIXED_ASSIGNMENT_REFERENCE_ONLY'||!s||!same(p.input,p.snapshot.input)||p.projectId!==p.snapshot.projectId||!same(p.assignmentRef,s.assignmentRef))fail();
  await checkpointDownloadFile(p);
  return{kind:'LOCAL_SELECTED_FILE' as const,projectId:p.projectId,input:p.input,state:s,localFileHash:p.recordFile.contentHash,recordBodyHash:null,declarationHash:p.contentHash,checkpointRef:null,sourceState:'DECLARED_FILE_VS_STORED_SYNTHETIC_LEDGER_ONLY' as const,checkpointStored:false as const,recordFileStored:false as const,gaps:['FILE_SOURCE_AUTHENTICITY_UNVERIFIED','CURRENT_FILES_AND_PROCESSES_NOT_COMPARED','WRITER_OWNERSHIP_UNKNOWN','CHECKPOINT_NOT_STORED']};
 }
 if(Object.keys(source).sort().join(',')!=='source,value')fail();const rawValue=source.value,state=rawValue?.snapshot?.input?.state;if(!state||!ref(rawValue?.ref)||rawValue.ref.version!==1)fail();
 const v=await validateStoredCheckpointView({projectId:rawValue.projectId,ref:state.assignmentRef},rawValue.ref,rawValue),snapshot=v.snapshot,input=snapshot.input;
 return{kind:'SERVER_STORED_CHECKPOINT' as const,projectId:v.projectId,input,state:input.state,localFileHash:null,recordBodyHash:snapshot.recordFile.contentHash,declarationHash:snapshot.preparedHash,checkpointRef:structuredClone(v.ref),sourceState:'STORED_CHECKPOINT_VS_STORED_SYNTHETIC_LEDGER_ONLY' as const,checkpointStored:true as const,recordFileStored:false as const,gaps:['LOCAL_FILE_BYTES_NOT_VERIFIED','CURRENT_FILES_AND_PROCESSES_NOT_COMPARED','WRITER_OWNERSHIP_UNKNOWN']};
}
function changes(file:any[],result:any[]){
 if(!Array.isArray(file)||!Array.isArray(result)||file.length>200||result.length>200)fail();
 const path=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>2000||/^[\\/]|^[A-Za-z]:|[\u0000-\u001f]/.test(v)||v.replaceAll('\\','/').split('/').some(s=>!s||s==='.'||s==='..'))fail();return v.replaceAll('\\','/');};
 const digest=(v:unknown)=>v===null||typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 for(const e of [...file,...result])if(!e||!['ADDED','MODIFIED','DELETED'].includes(e.kind)||!digest(e.beforeHash)||!digest(e.afterHash)||e.diffRef!==null&&!ref(e.diffRef))fail();
 const keys=[...new Set([...file.map(e=>path(e.relativePath)),...result.map(e=>path(e.path))])].sort();
 const rows=keys.map(p=>{const a=file.filter(e=>path(e.relativePath)===p),b=result.filter(e=>path(e.path)===p),different:string[]=[];let state:'AMBIGUOUS_PATH'|'FILE_ONLY'|'RESULT_ONLY'|'RECORDS_DIFFER'|'HASH_UNKNOWN'|'REFERENCE_UNKNOWN'|'DECLARED_FIELDS_EQUAL';
  if(a.length>1||b.length>1)state='AMBIGUOUS_PATH';else if(!b.length)state='FILE_ONLY';else if(!a.length)state='RESULT_ONLY';else{const x=a[0],y=b[0];if(x.kind!==y.kind)different.push('kind');for(const key of ['beforeHash','afterHash','diffRef'])if(x[key]!==null&&y[key]!==null&&!same(x[key],y[key]))different.push(key);const missingHash=[x,y].some(e=>e.kind!=='ADDED'&&e.beforeHash===null||e.kind!=='DELETED'&&e.afterHash===null);state=different.length?'RECORDS_DIFFER':missingHash?'HASH_UNKNOWN':(x.diffRef===null)!==(y.diffRef===null)?'REFERENCE_UNKNOWN':'DECLARED_FIELDS_EQUAL';}
  return{path:p,state,different,fileEntries:structuredClone(a),resultEntries:structuredClone(b)};
 });return{sourceState:'DECLARED_RECORDS_ONLY' as const,sourceRootVerified:false as const,currentFilesObserved:false as const,rows};
}
/** 선택한 로컬/서버 현황 기록의 선언과 보관 합성 ACK만 비교하며 실제 재개를 승인하지 않는다. */
export async function compareCheckpointJournal(client:ApiClient,rawSource:CheckpointComparisonSource,rawResult:SubmittedResultView,active:()=>boolean){
 if(!active())return null;const source=await normalizeSource(rawSource);if(!active())return null;const r=structuredClone(rawResult),s=source.state,scope=r?.snapshot?.scope;
 if(source.projectId!==scope?.projectId||!same(s.assignmentRef,scope.assignmentRef)||!ref(s.assignmentRef)||!ref(scope.executionRef)||!ref(r.ref)||await hash(r.snapshot)!==r.ref.contentHash||!Array.isArray(s.executionRefs)||s.executionRefs.length>200||!s.executionRefs.every(ref)||s.lastLocalSequence!==null&&!integer(s.lastLocalSequence)||s.lastServerAck!==null&&(!integer(s.lastServerAck.sequence)||s.lastServerAck.batchRef!==null&&!ref(s.lastServerAck.batchRef)||s.lastServerAck.sequence>0&&s.lastServerAck.batchRef===null||s.lastLocalSequence!==null&&s.lastServerAck.sequence>s.lastLocalSequence))fail();
 const executionMatched=s.executionRefs.some((e:any)=>same(e,scope.executionRef)),manifestCheckpointRef=r.snapshot.manifest.checkpointRef,checkpointReferenceComparison=source.kind==='LOCAL_SELECTED_FILE'?'NOT_APPLICABLE_LOCAL_FILE' as const:manifestCheckpointRef===null?'RESULT_CHECKPOINT_NOT_REFERENCED' as const:same(manifestCheckpointRef,source.checkpointRef)?'SAME_STORED_REF' as const:'DIFFERENT_STORED_REF' as const,base={fileHash:source.localFileHash,localFileHash:source.localFileHash,recordBodyHash:source.recordBodyHash,fileDeclarationHash:source.declarationHash,checkpointRef:source.checkpointRef,checkpointReferenceComparison,resultRef:structuredClone(r.ref),executionRef:structuredClone(scope.executionRef),sourceState:source.sourceState,executionMatched,declaredLocalSequence:s.lastLocalSequence,declaredAckSequence:s.lastServerAck?.sequence??null,serverHighestContiguous:null as number|null,serverMaxSequence:null as number|null,serverGaps:[] as {from:number;to:number}[],ackReferenceComparison:'NOT_COMPARED' as 'NOT_COMPARED'|'SERVER_ACK_NOT_RECORDED'|'FILE_ACK_UNKNOWN'|'SAME_REF_AND_SEQUENCE'|'DIFFERENT_REF_OR_SEQUENCE',localComparison:'NOT_COMPARED' as 'NOT_COMPARED'|'LOCAL_SEQUENCE_UNKNOWN'|'SERVER_ACK_NOT_RECORDED'|'DECLARED_LOCAL_AHEAD'|'DECLARED_LOCAL_BEHIND_STORED_MAX'|'DECLARED_RANGE_EQUAL',declaredContiguousAckDistance:null as number|null,serverRead:false,observedAt:null as string|null,gaps:source.gaps,currentFactsVerified:false as const,checkpointStored:source.checkpointStored,recordFileStored:source.recordFileStored,writerReleaseVerified:false as const,readyForResume:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 if(source.kind==='SERVER_STORED_CHECKPOINT'&&checkpointReferenceComparison!=='SAME_STORED_REF')return active()?{...base,changeComparison:null,gaps:[...base.gaps,'RESULT_CHECKPOINT_REFERENCE_MISMATCH']}:null;
 if(!executionMatched)return active()?{...base,changeComparison:null,gaps:[...base.gaps,'EXECUTION_NOT_DECLARED_IN_FILE']}:null;
 const journal=await readStoredObservations(client,r,active);if(!active()||!journal)return null;const ack=journal.ack,q=ack?.snapshot;return{...base,serverRead:true,observedAt:journal.observedAt,serverHighestContiguous:q?.highestContiguous??null,serverMaxSequence:q?.maxSequence??null,serverGaps:structuredClone(q?.gaps??[]),
 ackReferenceComparison:!ack?'SERVER_ACK_NOT_RECORDED':s.lastServerAck===null?'FILE_ACK_UNKNOWN':same(s.lastServerAck.batchRef,ack.ref)&&s.lastServerAck.sequence===ack.snapshot.highestContiguous?'SAME_REF_AND_SEQUENCE':'DIFFERENT_REF_OR_SEQUENCE',
 localComparison:s.lastLocalSequence===null?'LOCAL_SEQUENCE_UNKNOWN':!q?'SERVER_ACK_NOT_RECORDED':s.lastLocalSequence>q.highestContiguous?'DECLARED_LOCAL_AHEAD':s.lastLocalSequence<q.maxSequence?'DECLARED_LOCAL_BEHIND_STORED_MAX':'DECLARED_RANGE_EQUAL',
 declaredContiguousAckDistance:s.lastLocalSequence===null||!q?null:Math.max(0,s.lastLocalSequence-q.highestContiguous),changeComparison:changes(s.changedFiles,r.snapshot.manifest.changes),gaps:[...base.gaps,...(s.lastLocalSequence===null?['LOCAL_SEQUENCE_UNKNOWN']:[]),...(!q?['SERVER_ACK_NOT_RECORDED']:[])]};
}
