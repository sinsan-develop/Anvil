import {types} from 'node:util';
import {canonicalJson,contentHash} from '../canonical.ts';
import type {NormalResultEvidenceBindingV1} from './normal-result-execution-evidence-v1.ts';
import {hashV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from './validation-v1.ts';

/** 후보 A의 합성 비교 입력이다. 요청·승인·권한·실행·저장 경로와 연결되지 않는다. */
export interface RegisteredTestCaptureBindingModelV1 {
 schemaVersion:1;
 kind:'REGISTERED_TEST_COMMAND_CAPTURE_MODEL_V1';
 selection:{assignmentRef:Ref;planRef:Ref;af05Ref:Ref;taskCode:string;testCaseId:string;testCaseHash:string};
 profile:{profileRef:Ref;executorRegistrationRef:Ref;executableRef:Ref;argvSha256:string;environmentRef:Ref;
  commit:NormalResultEvidenceBindingV1['commit'];sourceReadScopeRef:Ref;outputScopeRef:Ref};
 execution:{mode:'WORK'|'CONTEXT_REVIEW';projectId:string;executionId:string;executionGeneration:number;assignmentRef:Ref;executorRegistrationRef:Ref;
  credentialGeneration:number;grantRef:Ref;localAttemptRef:Ref;parentDispatchRef:Ref;parentEnvelopeHash:string;environmentRef:Ref};
 source:{scopeRef:Ref;observationRef:Ref;fenceRef:Ref;writerHeadRef:Ref;writerLeaseId:string;authorityEpoch:number};
}

type Comparison = {state:'MODEL_MATCHED';bindingHash:string} | {state:'NOT_READY';reason:
 'EXPECTED_BINDING_UNAVAILABLE'|'WORK_REQUIRED'|'SOURCE_OR_WRITER_NOT_CURRENT'|'BINDING_MISMATCH'};

const invalid=():never=>{throw Error('REGISTERED_TEST_COMMAND_CAPTURE_MODEL_INVALID');};
const record=(v:unknown,keys:readonly string[]):v is Record<string,any>=>!types.isProxy(v)&&recordV1(v,keys);
const ref=(v:unknown)=>!types.isProxy(v)&&refV1(v);
const positive=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
const same=(a:Ref,b:Ref)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;

function binding(raw:unknown):RegisteredTestCaptureBindingModelV1 {
 if(!record(raw,['schemaVersion','kind','selection','profile','execution','source'])||raw.schemaVersion!==1||raw.kind!=='REGISTERED_TEST_COMMAND_CAPTURE_MODEL_V1')return invalid();
 const {selection,profile,execution,source}=raw;
 if(!record(selection,['assignmentRef','planRef','af05Ref','taskCode','testCaseId','testCaseHash'])||
  ![selection.assignmentRef,selection.planRef,selection.af05Ref].every(ref)||!code(selection.taskCode)||!code(selection.testCaseId)||!hashV1(selection.testCaseHash))return invalid();
 if(!record(profile,['profileRef','executorRegistrationRef','executableRef','argvSha256','environmentRef','commit','sourceReadScopeRef','outputScopeRef'])||
  ![profile.profileRef,profile.executorRegistrationRef,profile.executableRef,profile.environmentRef,profile.sourceReadScopeRef,profile.outputScopeRef].every(ref)||
  !hashV1(profile.argvSha256)||!record(profile.commit,['objectFormat','oid']))return invalid();
 const {objectFormat,oid}=profile.commit;
 if(typeof oid!=='string'||!(objectFormat==='SHA1'&&/^[a-f0-9]{40}$/.test(oid)||objectFormat==='SHA256'&&hashV1(oid))||/^0+$/.test(oid))return invalid();
 if(!record(execution,['mode','projectId','executionId','executionGeneration','assignmentRef','executorRegistrationRef','credentialGeneration','grantRef','localAttemptRef','parentDispatchRef','parentEnvelopeHash','environmentRef'])||
  !['WORK','CONTEXT_REVIEW'].includes(execution.mode)||!uuidV1(execution.projectId)||!uuidV1(execution.executionId)||
  !positive(execution.executionGeneration)||!positive(execution.credentialGeneration)||!hashV1(execution.parentEnvelopeHash)||
  ![execution.assignmentRef,execution.executorRegistrationRef,execution.grantRef,execution.localAttemptRef,execution.parentDispatchRef,execution.environmentRef].every(ref))return invalid();
 if(!record(source,['scopeRef','observationRef','fenceRef','writerHeadRef','writerLeaseId','authorityEpoch'])||
  ![source.scopeRef,source.observationRef,source.fenceRef,source.writerHeadRef].every(ref)||!uuidV1(source.writerLeaseId)||!positive(source.authorityEpoch))return invalid();
 return raw as unknown as RegisteredTestCaptureBindingModelV1;
}

/** 별도 합성 기대값과 자료를 비교한다. 상태와 참조의 실제 발급 권위·현재성·실행 효과는 검증 범위 밖이다. */
export function matchRegisteredTestCommandCaptureModelV1(raw:unknown,independent:unknown):Comparison {
 const value=binding(raw);
 if(independent===null)return {state:'NOT_READY',reason:'EXPECTED_BINDING_UNAVAILABLE'};
 if(!record(independent,['binding','sourceState','writerState'])||
  !['VERIFIED_CURRENT','UNVERIFIED','STALE','CONFLICT','UNSUPPORTED','NOT_REQUIRED'].includes(independent.sourceState)||
  !['NONE','OWNED','UNKNOWN','CONFLICT'].includes(independent.writerState))return invalid();
 const expected=binding(independent.binding);
 if(value.execution.mode!=='WORK'||expected.execution.mode!=='WORK')return {state:'NOT_READY',reason:'WORK_REQUIRED'};
 if(independent.sourceState!=='VERIFIED_CURRENT'||independent.writerState!=='OWNED')return {state:'NOT_READY',reason:'SOURCE_OR_WRITER_NOT_CURRENT'};
 const encoded=canonicalJson(value);
 if(!same(value.selection.assignmentRef,value.execution.assignmentRef)||
  !same(value.profile.executorRegistrationRef,value.execution.executorRegistrationRef)||!same(value.profile.environmentRef,value.execution.environmentRef)||
  !same(value.profile.sourceReadScopeRef,value.source.scopeRef)||encoded!==canonicalJson(expected))return {state:'NOT_READY',reason:'BINDING_MISMATCH'};
 return {state:'MODEL_MATCHED',bindingHash:contentHash(encoded)};
}
