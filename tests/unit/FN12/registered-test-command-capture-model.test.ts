import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {matchRegisteredTestCommandCaptureModelV1,type RegisteredTestCaptureBindingModelV1} from '../../../contracts/runtime/registered-test-command-capture-model-v1.ts';

const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const hash=(value:unknown)=>contentHash(canonicalJson(value));
const ref=(n:number)=>({id:id(n),version:1,contentHash:hash(n)});
const request=():RegisteredTestCaptureBindingModelV1=>({
 schemaVersion:1,kind:'REGISTERED_TEST_COMMAND_CAPTURE_MODEL_V1',
 selection:{assignmentRef:ref(1),planRef:ref(2),af05Ref:ref(3),taskCode:'FN12',testCaseId:'TC09',testCaseHash:hash('고정 시험')},
 profile:{profileRef:ref(4),executorRegistrationRef:ref(5),executableRef:ref(6),argvSha256:hash('고정 인자'),
  environmentRef:ref(7),commit:{objectFormat:'SHA1',oid:'a'.repeat(40)},sourceReadScopeRef:ref(8),outputScopeRef:ref(9)},
 execution:{mode:'WORK',projectId:id(10),executionId:id(11),executionGeneration:2,assignmentRef:ref(1),executorRegistrationRef:ref(5),
  credentialGeneration:3,grantRef:ref(12),localAttemptRef:ref(13),parentDispatchRef:ref(14),parentEnvelopeHash:hash('원 봉투'),environmentRef:ref(7)},
 source:{scopeRef:ref(8),observationRef:ref(15),fenceRef:ref(16),writerHeadRef:ref(17),writerLeaseId:id(18),authorityEpoch:4},
});
const expectation=(binding=request())=>({binding,sourceState:'VERIFIED_CURRENT',writerState:'OWNED'});
const mismatch={state:'NOT_READY',reason:'BINDING_MISMATCH'};

test('독립 기대값과 같은 확정 TC·등록 프로필은 모델 비교 결과와 결박 해시만 반환한다',()=>{
 const raw=request(),independent=expectation(),before=structuredClone({raw,independent});
 const reordered=Object.fromEntries(Object.entries(raw).reverse());
 assert.deepEqual(matchRegisteredTestCommandCaptureModelV1(reordered,independent),{state:'MODEL_MATCHED',bindingHash:hash(raw)});
 assert.deepEqual({raw,independent},before);
});

test('같은 업무·TC ID라도 원문 버전·해시나 정확 프로필과 환경이 달라지면 보류한다',()=>{
 const raw=request(),expected=expectation();
 for(const change of [
  {...raw,selection:{...raw.selection,assignmentRef:ref(91)}},
  {...raw,selection:{...raw.selection,planRef:{...raw.selection.planRef,version:2}}},
  {...raw,selection:{...raw.selection,af05Ref:{...raw.selection.af05Ref,contentHash:hash('교체 AF05')}}},
  {...raw,selection:{...raw.selection,taskCode:'FN13'}},
  {...raw,selection:{...raw.selection,testCaseId:'TC10'}},
  {...raw,selection:{...raw.selection,testCaseHash:hash('다른 TC 원문')}},
  {...raw,profile:{...raw.profile,profileRef:{...raw.profile.profileRef,contentHash:hash('같은 프로필 ID 다른 원문')}}},
  {...raw,profile:{...raw.profile,executableRef:ref(92)}},
  {...raw,profile:{...raw.profile,argvSha256:hash('다른 인자')}},
  {...raw,profile:{...raw.profile,outputScopeRef:ref(93)}},
  {...raw,profile:{...raw.profile,commit:{objectFormat:'SHA1',oid:'b'.repeat(40)}}},
  {...raw,profile:{...raw.profile,environmentRef:ref(94)},execution:{...raw.execution,environmentRef:ref(94)}},
 ])assert.deepEqual(matchRegisteredTestCommandCaptureModelV1(change,expected),mismatch);
});

test('다른 프로젝트·실행/세대·등록·허가·시도·소스·writer 근거를 정확 입력으로 바꾸지 않는다',()=>{
 const raw=request(),expected=expectation();
 for(const change of [
  {...raw,execution:{...raw.execution,projectId:id(90)}},
  {...raw,execution:{...raw.execution,executionId:id(91)}},
  {...raw,execution:{...raw.execution,executionGeneration:3}},
  {...raw,execution:{...raw.execution,credentialGeneration:4}},
  {...raw,execution:{...raw.execution,grantRef:ref(92)}},
  {...raw,execution:{...raw.execution,localAttemptRef:ref(93)}},
  {...raw,execution:{...raw.execution,parentDispatchRef:ref(94)}},
  {...raw,execution:{...raw.execution,parentEnvelopeHash:hash('다른 봉투')}},
  {...raw,profile:{...raw.profile,executorRegistrationRef:ref(95)},execution:{...raw.execution,executorRegistrationRef:ref(95)}},
  {...raw,source:{...raw.source,observationRef:ref(96)}},
  {...raw,source:{...raw.source,fenceRef:ref(97)}},
  {...raw,source:{...raw.source,writerHeadRef:{...raw.source.writerHeadRef,version:2}}},
  {...raw,source:{...raw.source,writerLeaseId:id(98)}},
  {...raw,source:{...raw.source,authorityEpoch:5}},
 ])assert.deepEqual(matchRegisteredTestCommandCaptureModelV1(change,expected),mismatch);
});

test('일치하는 입력도 WORK·소스·writer 조건이 없거나 내부 범위가 엇갈리면 명시 보류한다',()=>{
 const raw=request(),expected=expectation();
 assert.deepEqual(matchRegisteredTestCommandCaptureModelV1(raw,null),{state:'NOT_READY',reason:'EXPECTED_BINDING_UNAVAILABLE'});
 for(const sourceState of ['UNVERIFIED','STALE','CONFLICT','UNSUPPORTED','NOT_REQUIRED']){
  assert.deepEqual(matchRegisteredTestCommandCaptureModelV1(raw,{...expected,sourceState}),{state:'NOT_READY',reason:'SOURCE_OR_WRITER_NOT_CURRENT'});
 }
 for(const writerState of ['NONE','UNKNOWN','CONFLICT']){
  assert.deepEqual(matchRegisteredTestCommandCaptureModelV1(raw,{...expected,writerState}),{state:'NOT_READY',reason:'SOURCE_OR_WRITER_NOT_CURRENT'});
 }
 const review:RegisteredTestCaptureBindingModelV1={...raw,execution:{...raw.execution,mode:'CONTEXT_REVIEW'}};
 assert.deepEqual(matchRegisteredTestCommandCaptureModelV1(review,expectation(structuredClone(review))),{state:'NOT_READY',reason:'WORK_REQUIRED'});
 for(const change of [
  {...raw,selection:{...raw.selection,assignmentRef:{...raw.selection.assignmentRef,version:2}}},
  {...raw,profile:{...raw.profile,executorRegistrationRef:ref(90)}},
  {...raw,profile:{...raw.profile,environmentRef:ref(91)}},
  {...raw,profile:{...raw.profile,sourceReadScopeRef:ref(92)}},
 ])assert.deepEqual(matchRegisteredTestCommandCaptureModelV1(change,expectation(structuredClone(change))),mismatch);
});

test('형상 밖 명령·권한 표식·접근자·Proxy는 직접 읽거나 canonical 해시하기 전에 거절한다',()=>{
 const raw=request(),expected=expectation(),invalid={message:'REGISTERED_TEST_COMMAND_CAPTURE_MODEL_INVALID'};
 let reads=0;const trap=()=>{reads++;throw Error('fixture trap');};
 const access=Object.defineProperty({...raw.selection},'testCaseHash',{enumerable:true,get:trap});
 for(const malformed of [
  {...raw,executionAuthorized:true},{...raw,profile:{...raw.profile,argv:['some','args']}},
  {...raw,selection:{...raw.selection,testCaseId:'../TC09'}},{...raw,execution:{...raw.execution,executionGeneration:-1}},
  {...raw,profile:{...raw.profile,commit:{objectFormat:'SHA256',oid:'b'.repeat(40)}}},
  {...raw,selection:access},{...raw,profile:new Proxy(raw.profile,{get:trap,ownKeys:trap,getPrototypeOf:trap})},
  {...raw,source:{...raw.source,writerHeadRef:new Proxy(raw.source.writerHeadRef,{get:trap,ownKeys:trap})}},
 ])assert.throws(()=>matchRegisteredTestCommandCaptureModelV1(malformed,expected),invalid);
 assert.throws(()=>matchRegisteredTestCommandCaptureModelV1(raw,Object.defineProperty(expected,'binding',{enumerable:true,get:trap})),invalid);
 assert.equal(reads,0);
});
