import {ApiClient,ApiError} from '../../api/client.ts';
import {postDocumentCommand,type DocumentSession,type DocumentWrite} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {ManualResultReportStorage} from './manual-result-report.ts';

type Scope={projectId:string;assignmentRef:PlanRef;executionRef:PlanRef};
export interface ResultSubmissionReceipt {submissionId:string;manifestRef:PlanRef;registeredAt:string;sourceKind:'WORKER_CLAIM';completionAccepted:false;executionAuthorized:false;dispatchPerformed:false}
export interface ResultSubmissionBuffer {
 bindingId:string;submissionId:string;projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;
 assignmentRef:PlanRef;scope:Scope;manifest:Record<string,any>;fileText:string;fileHash:string;
 pending:DocumentWrite|null;result:ResultSubmissionReceipt|null;uncertain:boolean;dirty:boolean;
 failure:{code:string;status:number}|null;executionAuthorized:false;
}
export interface ResultSubmissionBuffers {buffers:Record<string,ResultSubmissionBuffer|null>;onChange:(key:string,change:(value:ResultSubmissionBuffer|null)=>ResultSubmissionBuffer|null)=>void;manual?:ManualResultReportStorage}
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const ref=(v:any):v is PlanRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),fail=(code='RESULT_SUBMISSION_FILE_INVALID'):never=>{throw new ApiError(code);};
const sensitive=(v:string)=>/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9_.~+\/-]{16,}|\b(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*["']?[^\s"']{4,}/i.test(v);
const manifestKeys=['assignmentRef','executionRef','baselineRefs','submissionState','changes','commandResults','testResults','artifactRefs','unexecuted','risks','rollback','checkpointRef'];
const array=(v:any,max=200)=>Array.isArray(v)&&v.length<=max;
const refs=(v:any)=>array(v)&&v.every(ref)&&new Set(v.map(ordered)).size===v.length;
const hash=(v:any)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=(v:any,max=20000)=>typeof v==='string'&&v.length<=max;
const iso=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const optionalRef=(v:any)=>v===null||ref(v),optionalHash=(v:any)=>v===null||hash(v),optionalTime=(v:any)=>v===null||iso(v);
const code=(v:any)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v);
function evidence(v:any){return array(v,20)&&v.every((e:any)=>exact(e,['sourceKind','ref','contentHash','environmentRef','recordedAt'])&&['WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED'].includes(e.sourceKind)&&ref(e.ref)&&hash(e.contentHash)&&ref(e.environmentRef)&&iso(e.recordedAt));}
function details(m:Record<string,any>,scope:Scope){
 if(!refs(m.baselineRefs)||!refs(m.artifactRefs)||!m.risks.every((v:any)=>text(v)))fail();
 for(const c of m.changes)if(!exact(c,['path','kind','diffRef','beforeHash','afterHash'])||!text(c.path,2000)||!c.path.trim()||/^[\\/]|^[A-Za-z]:|[\u0000-\u001f]/.test(c.path)||c.path.replaceAll('\\','/').split('/').some((s:string)=>s==='..'||s==='.'||!s)||!['ADDED','MODIFIED','DELETED'].includes(c.kind)||!optionalRef(c.diffRef)||!optionalHash(c.beforeHash)||!optionalHash(c.afterHash))fail();
 for(const c of m.commandResults){
  if(!exact(c,['profileRef','argv','cwdRef','hostRef','executionRef','startedAt','finishedAt','exitCode','outputRef','evidence'])||!ref(c.profileRef)||!array(c.argv)||!c.argv.every((v:any)=>text(v,2000))||!ref(c.cwdRef)||!ref(c.hostRef)||!same(c.executionRef,scope.executionRef)||!optionalTime(c.startedAt)||!optionalTime(c.finishedAt)||c.exitCode!==null&&(!Number.isSafeInteger(c.exitCode)||c.exitCode<0)||!optionalRef(c.outputRef)||c.startedAt!==null&&c.finishedAt!==null&&Date.parse(c.finishedAt)<Date.parse(c.startedAt)||!evidence(c.evidence))fail();
  if(c.argv.some((v:string)=>/^--?(?:password|passwd|token|access[-_]token|api[-_]key|secret)(?:$|=)/i.test(v)))fail('RESULT_SUBMISSION_SENSITIVE');
 }
 for(const t of m.testResults)if(!exact(t,['criterionId','testId','baselineRefs','expected','actual','status','evidence'])||!code(t.criterionId)||!code(t.testId)||!refs(t.baselineRefs)||!text(t.expected)||!text(t.actual)||!['PASS','FAIL','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE'].includes(t.status)||!evidence(t.evidence))fail();
 for(const u of m.unexecuted)if(!exact(u,['criterionId','testId','reason'])||!code(u.criterionId)||!code(u.testId)||!text(u.reason)||!u.reason.trim())fail();
}
async function digest(bytes:Uint8Array<ArrayBuffer>){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
/** 파일의 중복 key/비정형 값·유한 구조만 검사한다. 실행·증거 진위와 서버의 전체 업무 검증을 대신하지 않는다. */
function parse(text:string,pid:string,assignment:PlanRef):{scope:Scope;manifest:Record<string,any>}{
 const stack:{keys:Set<string>|null;key:boolean}[]=[];let tokens=0;
 try{
  for(const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)){
   const token=match[0];if(++tokens>500000)fail();
   if(token==='{'||token==='['){if(stack.length>=64)fail();stack.push({keys:token==='{'?new Set():null,key:token==='{'});}
   else if(token==='}'||token===']')stack.pop();
   else{const f=stack.at(-1);if(f?.keys){if(token===',')f.key=true;else if(token===':')f.key=false;else if(f.key&&token.startsWith('"')){const key=JSON.parse(token);if(f.keys.has(key))fail();f.keys.add(key);}}}
  }
  const v=JSON.parse(text);
  if(!exact(v,['scope','manifest'])||!exact(v.scope,['projectId','assignmentRef','executionRef'])||v.scope.projectId!==pid||!ref(v.scope.assignmentRef)||!same(v.scope.assignmentRef,assignment)||!ref(v.scope.executionRef)||!exact(v.manifest,manifestKeys)||!same(v.manifest.assignmentRef,assignment)||!same(v.manifest.executionRef,v.scope.executionRef))fail();
  const m=v.manifest;if(!['COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED'].includes(m.submissionState)||!['baselineRefs','changes','commandResults','testResults','artifactRefs','unexecuted','risks'].every(k=>Array.isArray(m[k])&&m[k].length<=(k==='risks'?100:200))||!m.baselineRefs.every(ref)||!m.artifactRefs.every(ref)||m.checkpointRef!==null&&!ref(m.checkpointRef)||typeof m.rollback!=='string'||m.rollback.length>20000)fail();
  details(m,v.scope);
  const walk=(x:any):void=>{if(typeof x==='string'){if(!x.isWellFormed()||sensitive(x))fail('RESULT_SUBMISSION_SENSITIVE');}else if(typeof x==='number'){if(!Number.isSafeInteger(x))fail();}else if(x&&typeof x==='object')for(const child of Object.values(x))walk(child);};walk(v);
  return v;
 }catch(cause){if(cause instanceof ApiError)throw cause;return fail();}
}
function decode(raw:Uint8Array,pid:string,assignment:PlanRef){
 if(!(raw instanceof Uint8Array)||raw.byteLength<1||raw.byteLength>2*1024*1024||!uuid(pid)||!ref(assignment))fail();
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);}catch{return fail();}
 return {text,...parse(text,pid,assignment)};
}
export const resultSubmissionKey=(session:DocumentSession,pid:string,assignment:PlanRef)=>[session.user.id,session.clientId,pid,assignment.id,assignment.version,assignment.contentHash].join(':');
export async function prepareResultSubmissionFile(raw:Uint8Array<ArrayBuffer>,pid:string,assignment:PlanRef,session:DocumentSession,generation:number):Promise<ResultSubmissionBuffer>{
 if(!(raw instanceof Uint8Array)||raw.byteLength<1||raw.byteLength>2*1024*1024)fail();
 const selectedAssignment=structuredClone(assignment),selectedSession=structuredClone(session);
 if(!uuid(selectedSession.user.id)||!uuid(selectedSession.clientId)||!Number.isSafeInteger(generation)||generation<1)fail();
 const bytes=new Uint8Array(raw),v=decode(bytes,pid,selectedAssignment),fileHash=await digest(bytes);
 return {bindingId:crypto.randomUUID(),submissionId:crypto.randomUUID(),projectId:pid,ownerUserId:selectedSession.user.id,ownerClientId:selectedSession.clientId,controlGeneration:generation,assignmentRef:selectedAssignment,scope:v.scope,manifest:v.manifest,fileText:v.text,fileHash,pending:null,result:null,uncertain:false,dirty:true,failure:null,executionAuthorized:false};
}
export async function prepareResultSubmitCommand(raw:ResultSubmissionBuffer,session:DocumentSession,acknowledged:boolean):Promise<DocumentWrite>{
 if(acknowledged!==true)fail('RESULT_SUBMISSION_CONFIRM_REQUIRED');
 const b=structuredClone(raw);
 if(!uuid(b.bindingId)||!uuid(b.submissionId)||b.ownerUserId!==session.user.id||b.ownerClientId!==session.clientId||!uuid(session.user.id)||!uuid(session.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||b.result||b.executionAuthorized!==false)fail('RESULT_SUBMISSION_BINDING_INVALID');
 const bytes=new TextEncoder().encode(b.fileText),v=decode(bytes,b.projectId,b.assignmentRef);
 if(await digest(bytes)!==b.fileHash||!same(v.scope,b.scope)||!same(v.manifest,b.manifest))fail('RESULT_SUBMISSION_INPUT_CHANGED');
 const command:DocumentWrite={schemaVersion:1,projectId:b.projectId,commandId:b.pending?.commandId??crypto.randomUUID(),clientId:b.ownerClientId,controlGeneration:b.controlGeneration,operation:'submitResult',targetId:b.submissionId,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{scope:v.scope,submissionId:b.submissionId,manifest:v.manifest}};
 if(!uuid(command.commandId)||b.pending&&!same(b.pending,command))fail('RESULT_SUBMISSION_PENDING_CHANGED');
 return command;
}
export async function sendResultSubmission(client:ApiClient,buffer:ResultSubmissionBuffer,session:DocumentSession,active:()=>boolean):Promise<ResultSubmissionReceipt>{
 if(!buffer.pending)fail('RESULT_SUBMISSION_PENDING_REQUIRED');const chosen=structuredClone(buffer),selectedSession=structuredClone(session),command=await prepareResultSubmitCommand(chosen,selectedSession,true);
 if(!active())fail('RESULT_SUBMISSION_PAUSED');const receipt=await postDocumentCommand(client,command,selectedSession.csrfToken);if(!active())fail('RESULT_SUBMISSION_PAUSED');
 const d=receipt.data;if(receipt.targetId!==chosen.submissionId||receipt.version!==1||d?.status!=='RESULT_SUBMITTED'||!same(d.manifest,chosen.manifest)||d.sourceKind!=='WORKER_CLAIM'||d.completionAccepted!==false||d.executionAuthorized!==false||d.dispatchPerformed!==false)fail('RESULT_SUBMISSION_RESPONSE_INVALID');
 const manifestRef={id:chosen.submissionId,version:1,contentHash:await digest(new TextEncoder().encode(ordered(chosen.manifest)))};if(!active())fail('RESULT_SUBMISSION_PAUSED');
 return {submissionId:chosen.submissionId,manifestRef,registeredAt:receipt.serverReceivedAt,sourceKind:'WORKER_CLAIM',completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};
}
