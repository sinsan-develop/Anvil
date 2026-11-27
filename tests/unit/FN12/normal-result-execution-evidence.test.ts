import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import * as evidence from '../../../contracts/runtime/normal-result-execution-evidence-v1.ts';

const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const ref=(n:number)=>({id:id(n),version:1,contentHash:hash(n)});
const artifactBytes=Buffer.from('sample report','utf8');
const artifactSha=contentHash(artifactBytes);
const artifactRef=(n:number)=>({...ref(n),contentHash:artifactSha});
const invalid={message:'NORMAL_RESULT_EXECUTION_EVIDENCE_INVALID'};
const snapshot=():evidence.NormalResultEvidenceSnapshotV1=>({
 schemaVersion:1,kind:'NORMAL_RESULT_EXECUTION_EVIDENCE_V1',
 binding:{projectId:id(1),executionId:id(2),executionGeneration:3,executorRegistrationRef:ref(4),localAttemptRef:ref(5),
  grantRef:ref(6),dispatchCommandRef:ref(7),dispatchEnvelopeHash:hash('dispatch'),captureRef:ref(8),
  environmentRef:ref(9),environmentFingerprint:hash('measured environment'),commit:{objectFormat:'SHA1',oid:'a'.repeat(40)}},
 command:{argvSha256:hash({kind:'NORMAL_RESULT_ARGV_V1',argv:['node','--test','task.test.ts']}),exitCode:1,
  startedAt:'2026-11-27T00:00:00.000Z',exitedAt:'2026-11-27T00:00:02.000Z'},
 artifacts:[{name:'report-한글.txt',bytes:artifactBytes.length,sha256:artifactSha,artifactRef:artifactRef(10)}],
 observedAt:'2026-11-27T00:00:03.000Z',
});
const seal=(s=snapshot(),evidenceId=id(20))=>({ref:{id:evidenceId,version:1,contentHash:hash(s)},snapshot:s});

test('정상 모형은 불변 원형을 판독하며 종료 실패도 그대로 보존한다',()=>{
 const original=seal(),expected={ref:original.ref,binding:original.snapshot.binding};
 assert.deepEqual(evidence.normalResultExecutionEvidenceRefV1(original.ref.id,original.snapshot),original.ref);
 const value=evidence.matchNormalResultExecutionEvidenceV1(original,expected);
 assert.deepEqual(value,original);assert.equal(value.snapshot.command.exitCode,1);
 assert.notEqual(value,original);assert.notEqual(value.snapshot.binding,original.snapshot.binding);
 assert(!('verified' in value));assert(!('completionAccepted' in value));
 const again=evidence.readNormalResultExecutionEvidenceV1(JSON.parse(canonicalJson(original)));
 assert.deepEqual(again,value);
 value.snapshot.artifacts[0]!.bytes=0;assert.equal(original.snapshot.artifacts[0]!.bytes,artifactBytes.length);
});

test('재해시된 주장도 신뢰 바탕의 정확 ref·등록·실행/세대·요청·시도에 결박되지 않으면 거절한다',()=>{
 const original=seal(),binding=original.snapshot.binding;
 const alternate:Partial<evidence.NormalResultEvidenceBindingV1>[]=[{projectId:id(98)},{executionId:id(98)},{executionGeneration:4},{executorRegistrationRef:ref(98)},
  {localAttemptRef:{...binding.localAttemptRef,contentHash:hash('changed')}},{grantRef:ref(98)},
  {dispatchCommandRef:ref(98)},{dispatchEnvelopeHash:hash('different dispatch')},{captureRef:ref(98)},
  {environmentRef:ref(98)},{environmentFingerprint:hash('measured elsewhere')},{commit:{objectFormat:'SHA1',oid:'c'.repeat(40)}}];
 for(const delta of alternate){
  const changed=seal({...original.snapshot,binding:{...binding,...delta}});
  assert.deepEqual(evidence.readNormalResultExecutionEvidenceV1(changed),changed);
  assert.throws(()=>evidence.matchNormalResultExecutionEvidenceV1(changed,{ref:changed.ref,binding}),invalid);
 }
 const changed=seal({...original.snapshot,command:{...original.snapshot.command,exitCode:0}});
 assert.throws(()=>evidence.matchNormalResultExecutionEvidenceV1(changed,{ref:original.ref,binding}),invalid);
 assert.throws(()=>evidence.readNormalResultExecutionEvidenceV1({...changed,ref:original.ref}),invalid);
 assert.throws(()=>evidence.readNormalResultExecutionEvidenceV1({...original,ref:{...original.ref,version:2}}),invalid);
});

test('동일 상위 명령에서 직접 관측한 개별 invocation 두 건을 구분한다',()=>{
 const first=seal(),second=seal({...snapshot(),binding:{...snapshot().binding,captureRef:ref(11)}},id(21));
 assert.deepEqual(first.snapshot.binding.dispatchCommandRef,second.snapshot.binding.dispatchCommandRef);
 assert.notEqual(first.ref.id,second.ref.id);assert.notEqual(first.ref.contentHash,second.ref.contentHash);
 assert.throws(()=>evidence.matchNormalResultExecutionEvidenceV1(second,{ref:second.ref,binding:first.snapshot.binding}),invalid);
});

test('실행 미관측·환경/commit 오류·과대 자료·개인정보 및 모호한 산출물 경로의 형상을 닫는다',()=>{
 const good=snapshot(),artifact=good.artifacts[0]!;
 const invalidBodies=[{...good,kind:'PROVIDER_CLAIM_ONLY'},{...good,verified:true},
  {...good,binding:{...good.binding,dispatchCommandRef:good.binding.captureRef}},
  {...good,binding:{...good.binding,executionGeneration:0}},{...good,binding:{...good.binding,environmentFingerprint:'unknown'}},
  {...good,binding:{...good.binding,environmentVariables:{PATH:'private'}}},
  {...good,binding:{...good.binding,commit:{objectFormat:'SHA1',oid:'b'.repeat(64)}}},
  {...good,binding:{...good.binding,commit:{objectFormat:'SHA256',oid:'0'.repeat(64)}}},
  {...good,command:{...good.command,exitCode:null}},{...good,command:{...good.command,exitCode:-1}},
  {...good,command:{...good.command,exitCode:2**32}},{...good,command:{...good.command,exitCode:-0}},
  {...good,command:{...good.command,argv:['private token']}},{...good,command:{...good.command,exitedAt:good.command.startedAt.replace('27','26')}},
  {...good,observedAt:good.command.startedAt},{...good,artifacts:[{...artifact,name:'../outside'}]},
  {...good,artifacts:[{...artifact,name:'C:\\private.txt'}]},{...good,artifacts:[{...artifact,name:'é'.normalize('NFD')}]},
  {...good,artifacts:[{...artifact,bytes:-0}]},{...good,artifacts:[artifact,{...artifact,artifactRef:artifactRef(11)}]},
  {...good,artifacts:[artifact,{...artifact,name:'report-next.txt'}]},
  {...good,artifacts:[{...artifact,name:'z.txt'}, {...artifact,name:'a.txt',artifactRef:artifactRef(11)}]},
  {...good,artifacts:Array.from({length:201},(_,i)=>({...artifact,name:id(100+i),artifactRef:artifactRef(100+i)}))},
  {...good,artifacts:Array.from({length:200},(_,i)=>({...artifact,name:id(100+i)+'q'.repeat(215),artifactRef:artifactRef(100+i)}))},
 ];
 for(const body of invalidBodies)assert.throws(()=>evidence.normalResultExecutionEvidenceRefV1(id(20),body),invalid);
 assert.throws(()=>evidence.normalResultExecutionEvidenceRefV1(good.binding.captureRef.id,good),invalid);
 const empty:evidence.NormalResultEvidenceSnapshotV1={...good,artifacts:[],binding:{...good.binding,commit:{objectFormat:'SHA256',oid:'b'.repeat(64)}},command:{...good.command,exitCode:0xffffffff}};
 assert.deepEqual(evidence.normalResultExecutionEvidenceRefV1(id(20),empty),seal(empty).ref);
});
test('산출물 보호 참조와 달라진 유효 바이트 해시를 함께 재해시해도 거절한다',()=>{
 const original=seal(),artifact=original.snapshot.artifacts[0]!;
 const changed=seal({...original.snapshot,artifacts:[{...artifact,sha256:contentHash(Buffer.from('different bytes'))}]});
 assert.throws(()=>evidence.readNormalResultExecutionEvidenceV1(changed),invalid);
 assert.throws(()=>evidence.matchNormalResultExecutionEvidenceV1(changed,{ref:changed.ref,binding:changed.snapshot.binding}),invalid);
 const otherVersion=seal({...original.snapshot,artifacts:[{...artifact,artifactRef:{...artifact.artifactRef,version:2}}]});
 assert.throws(()=>evidence.readNormalResultExecutionEvidenceV1(otherVersion),invalid);
});

test('중첩 proxy·getter와 희소 배열은 트랩이나 getter를 소비하지 않는다',()=>{
 const good=snapshot();let calls=0;
 const trap=()=>{calls++;throw Error('TRAP');};
 const getter=Object.defineProperty({...good.command},'exitCode',{enumerable:true,get:trap});
 const proxy=new Proxy(good.binding.commit,{get:trap,ownKeys:trap,getPrototypeOf:trap});
 const artifactProxy=new Proxy(good.artifacts,{get:trap,ownKeys:trap,getPrototypeOf:trap});
 for(const body of [{...good,command:getter},{...good,binding:{...good.binding,commit:proxy}},
  {...good,artifacts:artifactProxy},{...good,artifacts:Array(1)}, {...good,artifacts:[new Proxy(good.artifacts[0]!,{get:trap,ownKeys:trap,getPrototypeOf:trap})]}]){
  assert.throws(()=>evidence.normalResultExecutionEvidenceRefV1(id(20),body),invalid);
 }
 const original=seal(),expected={ref:original.ref,binding:{...good.binding,captureRef:new Proxy(good.binding.captureRef,{get:trap,ownKeys:trap,getPrototypeOf:trap})}};
 assert.throws(()=>evidence.matchNormalResultExecutionEvidenceV1(original,expected),invalid);assert.equal(calls,0);
});
