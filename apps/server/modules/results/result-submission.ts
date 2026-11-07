import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const states=['COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED'];
const sources=['WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED'];
const code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v);
const text=(v:unknown,max=20000)=>typeof v==='string'&&v.length<=max;
const refs=(v:unknown)=>arrayV1(v,200)&&v.every(refV1)&&new Set(v.map(r=>canonicalJson(r))).size===v.length;
const optionalRef=(v:unknown)=>v===null||refV1(v);
const optionalHash=(v:unknown)=>v===null||hashV1(v);
const optionalTime=(v:unknown)=>v===null||isoV1(v);
function fail(code='RESULT_MANIFEST_INVALID'):never {throw new Error(code);}
function evidence(raw:unknown,declared:Set<string>){
 if(!arrayV1(raw,20))fail();
 for(const e of raw){
  if(!recordV1(e,['sourceKind','ref','contentHash','environmentRef','recordedAt'])||!sources.includes(e.sourceKind)||!refV1(e.ref)||!hashV1(e.contentHash)||!refV1(e.environmentRef)||!isoV1(e.recordedAt))fail();
  declared.add(e.sourceKind);
 }
}
function checkText(value:unknown){
 if(typeof value==='string'){try{assertKnowledgeTextSafe(value);}catch{fail('RESULT_MANIFEST_SENSITIVE');}}
 else if(value&&typeof value==='object')for(const child of Object.values(value))checkText(child);
}

/** FN12 내부 제출 원문 준비. JSON의 정규화 표현을 보존하며 원본 wire/file 바이트 보존은 아니다.
 * 선언된 sourceKind를 지우거나 진짜 출처로 승격하지 않는다. 별도 등록 증거 조회/인증이 필요하다.
 * 참조의 존재·현재 권한/실행·baseline 진위·산출물 bytes를 확인하거나 파일/DB/HTTP를 쓰지 않는다.
 * 알려진 비밀 표식만 거절하며 완전한 탐지/안전 판정이 아니다. 보호 원문 격리·실제 저장은 미연결이다. */
export function prepareSubmittedResult(rawScope:unknown,rawManifest:unknown){
 try{
  if(!recordV1(rawScope,['projectId','assignmentRef','executionRef'])||!uuidV1(rawScope.projectId)||!refV1(rawScope.assignmentRef)||!refV1(rawScope.executionRef))fail();
  if(!recordV1(rawManifest,['assignmentRef','executionRef','baselineRefs','submissionState','changes','commandResults','testResults','artifactRefs','unexecuted','risks','rollback','checkpointRef'])||!same(rawManifest.assignmentRef,rawScope.assignmentRef)||!same(rawManifest.executionRef,rawScope.executionRef)||!refs(rawManifest.baselineRefs)||!states.includes(rawManifest.submissionState)||!arrayV1(rawManifest.changes,200)||!arrayV1(rawManifest.commandResults,200)||!arrayV1(rawManifest.testResults,200)||!refs(rawManifest.artifactRefs)||!arrayV1(rawManifest.unexecuted,200)||!arrayV1(rawManifest.risks,100)||!rawManifest.risks.every(v=>text(v))||!text(rawManifest.rollback)||!optionalRef(rawManifest.checkpointRef))fail();
  const manifestCanonical=canonicalJson(rawManifest);if(Buffer.byteLength(manifestCanonical)>2*1024*1024)fail();const manifest=cloneV1(rawManifest),declared=new Set<string>();
  for(const change of manifest.changes){
   if(!recordV1(change,['path','kind','diffRef','beforeHash','afterHash'])||!text(change.path,2000)||!change.path.trim()||/^[\\/]|^[A-Za-z]:|[\u0000-\u001f]/.test(change.path)||change.path.replaceAll('\\','/').split('/').some((s:string)=>s==='..'||s==='.'||!s)||!['ADDED','MODIFIED','DELETED'].includes(change.kind)||!optionalRef(change.diffRef)||!optionalHash(change.beforeHash)||!optionalHash(change.afterHash))fail();
  }
  for(const command of manifest.commandResults){
   if(!recordV1(command,['profileRef','argv','cwdRef','hostRef','executionRef','startedAt','finishedAt','exitCode','outputRef','evidence'])||!refV1(command.profileRef)||!arrayV1(command.argv,200)||!command.argv.every((v:unknown)=>text(v,2000))||!refV1(command.cwdRef)||!refV1(command.hostRef)||!same(command.executionRef,rawScope.executionRef)||!optionalTime(command.startedAt)||!optionalTime(command.finishedAt)||command.exitCode!==null&&(!Number.isSafeInteger(command.exitCode)||command.exitCode<0)||!optionalRef(command.outputRef)||command.startedAt!==null&&command.finishedAt!==null&&Date.parse(command.finishedAt)<Date.parse(command.startedAt))fail();
   if(command.argv.some((v:string)=>/^--?(?:password|passwd|token|access[-_]token|api[-_]key|secret)(?:$|=)/i.test(v)))fail('RESULT_MANIFEST_SENSITIVE');
   evidence(command.evidence,declared);
  }
  for(const test of manifest.testResults){
   if(!recordV1(test,['criterionId','testId','baselineRefs','expected','actual','status','evidence'])||!code(test.criterionId)||!code(test.testId)||!refs(test.baselineRefs)||!text(test.expected)||!text(test.actual)||!['PASS','FAIL','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE'].includes(test.status))fail();
   evidence(test.evidence,declared);
  }
  for(const u of manifest.unexecuted)if(!recordV1(u,['criterionId','testId','reason'])||!code(u.criterionId)||!code(u.testId)||!text(u.reason)||!u.reason.trim())fail();
  checkText(manifest);
  return{transport:'SYNTHETIC_ONLY' as const,scope:cloneV1(rawScope),manifest,manifestCanonical,contentHash:contentHash(manifestCanonical),sourceKind:'WORKER_CLAIM' as const,declaredEvidenceSourceKinds:[...declared],evidenceProvenanceVerified:false as const,persisted:false as const,completionAccepted:false as const,formalFailureCounted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch(error){if(error instanceof Error&&/^RESULT_MANIFEST_(INVALID|SENSITIVE)$/.test(error.message))throw error;return fail();}
}
