import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name:string)=>readFileSync(new URL('../../../apps/connector/native/'+name,import.meta.url),'utf8');

test('정적: host 기본 retained 경로는 제한 조립기를 호출하고 원 객체와 부모 정리 수명을 보유한다',()=>{
 const host=read('DesktopTrustKeyHostSource.cs');
 assert.match(host,/retainedFactory\.Create\(/);
 assert.match(host,/retainedFactory\.Dispose\(\)/);
 const factory=read('NativePreparationRetainedFactorySource.cs');
 const calls=['CreateEmptyJobSource','PrepareAtomicJobAssignmentSource','PrepareSuspendedStartupSource','BindWorkerPlanSource','CreateSuspendedProcessSource'];
 let at=-1;for(const call of calls){const next=factory.indexOf(call+'(');assert.ok(next>at,call);at=next;}
 assert.match(factory,/return process;/);
 assert.doesNotMatch(factory,/class .*:.*IOriginalSuspendedProcessCandidate|CreateProcessW|ResumeThread/);
});

test('정적: 보호입력 부재·교체·원 context 변경은 생성 전 거절하고 최소 기한은 재설정하지 않는다',()=>{
 const s=read('NativePreparationRetainedFactorySource.cs');
 assert.match(s,/if\(source==null\)throw Invalid\(\)/);
 assert.match(s,/Interlocked\.CompareExchange\(ref attempted,1,0\)/);
 assert.match(s,/contextJson!=V\.Canonical\(originalContext,0\)/);
 assert.match(s,/Math\.Min\(deadline/);
 assert.match(s,/source\.Check\(binding\)/);
 assert.match(s,/Snapshot\(context\["authority"\]\)/);
 assert.match(s,/Equal\(p\["consumeReceiptRef"\],receipt\["ref"\]\)/);
 assert.match(s,/Equal\(p\["consumeRecordRef"\],context\["consumeRecordRef"\]\)/);
});

test('정적: normal selection은 원 scope/subject/parent에서 파생하고 부족한 보호 mapping을 JSON에서 만들지 않는다',()=>{
 const s=read('NativePreparationRetainedFactorySource.cs');
 for(const key of ['installationId','projectId','executionId','userId','clientId','humanSessionId','executionGeneration','controlGeneration','credentialGeneration'])assert.ok(s.includes('"'+key+'"'),key);
 assert.match(s,/AddRef\(selection,"authorizationReceipt",parent\["authorizationReceiptRef"\]\)/);
 assert.match(s,/AddRef\(selection,"registration",scope\["registrationRef"\]\)/);
 assert.match(s,/AddRef\(selection,"observer",binding\.ObserverRef\)/);
 assert.match(s,/OwnershipEvidenceWorkerInputSource\.BuildSource\(plan\)/);
 assert.match(s,/OwnershipEvidenceImageOwnerSource\.ReadOriginalSource\(binding\.Image,input\)/);
 assert.doesNotMatch(s,/PREPARATION_GRANTED|Environment\.GetEnvironmentVariable|DesktopTrustKeyRootSource\.Open/);
});

test('정적: 생성 전 authority/receipt/permit 검산은 기존 제한 signer의 exact 검산 본문과 같다',()=>{
 const previous=read('NativePreparationOwnershipReturnSource.cs'),next=read('NativePreparationRetainedFactorySource.cs');
 const body=(s:string,start:string)=>{const from=s.indexOf(start);assert.ok(from>=0);const a=s.indexOf('V.Exact(a,',from),b=s.indexOf('return a;',a);assert.ok(a>from&&b>a);return s.slice(a,b+9).replace(/\s+/g,'');};
 assert.equal(body(next,'Dictionary<string,object> Authority()'),body(previous,'Dictionary<string,object> ValidateContext()'));
});

test('정적: source가 생산하는32 selection 키는 기존 worker exact형상이며 원 부모마다 값을 읽는다',()=>{
 const s=read('NativePreparationRetainedFactorySource.cs'),from=s.indexOf('static OwnershipEvidencePreparationPlan Selection('),end=s.indexOf('internal OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate Create(',from),body=s.slice(from,end);
 const keys=[...body.matchAll(/selection\.Add\("([^"]+)"/g)].map(v=>v[1]!);
 for(const m of body.matchAll(/foreach\(string k in new\[\]\{([^}]+)\}\)selection\.Add\(k,/g))keys.push(...[...m[1]!.matchAll(/"([^"]+)"/g)].map(v=>v[1]!));
 for(const m of body.matchAll(/AddRef\(selection,"([^"]+)",/g))keys.push(...['Id','Version','Hash'].map(v=>m[1]+v));
 const worker=read('OwnershipEvidenceWorkerInputSource.cs'),expected=['issuedAt','expiresAt'];
 for(const group of ['Ids','Numbers','Hashes']){const part=worker.match(new RegExp(group+'=\\{([^}]+)\\}'));assert.ok(part);expected.push(...[...part[1]!.matchAll(/"([^"]+)"/g)].map(v=>v[1]!));}
 assert.equal(keys.length,32);assert.equal(new Set(keys).size,32);assert.deepEqual(keys.sort(),expected.sort());
 assert.match(body,/selection\.Add\("publicKeyFingerprint",V\.Text\(scope,"hostPublicKeyFingerprint"\)\)/);
 assert.match(body,/selection\.Add\("workerHash",binding\.WorkerHash\)/);
 assert.match(body,/selection\.Add\("runId",binding\.RunId\)/);
});

test('정적: 다른 authority/consume/factory/등록/scope·host image는 재해시만으로 교차할 수 없다',()=>{
 const s=read('NativePreparationRetainedFactorySource.cs');
 for(const comparison of ['Equal(m["authorityRef"],V.Map(original["authority"])["ref"])','Equal(m["consumeReceiptRef"],V.Map(original["receipt"])["ref"])','Equal(m["nativeFactoryRef"],scope["nativeFactoryRef"])','Equal(m["registrationRef"],scope["registrationRef"])','Equal(m["sourceScopeHash"],scope["sourceScopeHash"])'])assert.ok(s.includes(comparison),comparison);
 assert.match(s,/if\(HostHash!=hostHash\)throw Invalid\(\)/);
 assert.ok(s.indexOf('if(source==null)throw Invalid()')<s.indexOf('ReadOriginalSource(binding.Image,input)'));
 assert.match(s,/ReadOriginalSource\(binding\.Image,input\);/);
 assert.ok(read('OwnershipEvidenceImageBindingSource.cs').includes('bytes.ContentHash!=input.Selection["workerHash"]'));
});

test('정적: 같은 원 image를 복제한 입력이나 다른 host 조립기는 재소유하지 못한다',()=>{
 const s=read('NativePreparationRetainedFactorySource.cs');
 assert.match(s,/ConditionalWeakTable<OwnershipEvidenceImageOwnerSource\.IImageOwnerCandidate,object>/);
 const validate=s.indexOf('ReadOriginalSource(binding.Image,input);'),claim=s.indexOf('imageOwners.Add(binding.Image,this);'),retain=s.indexOf('image=binding.Image;');
 assert.ok(validate>=0&&claim>validate&&retain>claim);
 assert.doesNotMatch(s,/imageOwners\.Remove/);
});

test('정적: 모든 primitive 뒤 current검산·필드보유가 먼저이며 UNKNOWN 정리는 부모/image를 보존한다',()=>{
 const s=read('NativePreparationRetainedFactorySource.cs'),host=read('DesktopTrustKeyHostSource.cs');
 for(const line of ['job=OwnershipEvidenceJobFactorySource.CreateEmptyJobSource(left());check();','assignment=OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job,left());check();','startup=OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment,left());check();','startup.BindWorkerPlanSource(plan,left());check();','process=OwnershipEvidenceJobFactorySource.CreateSuspendedProcessSource(startup,image,left());check();'])assert.ok(s.includes(line),line);
 assert.match(s,/job\.Dispose\(\);job=null;assignment=null;startup=null;process=null/);
 assert.ok(s.indexOf('job.Dispose();job=null')<s.indexOf('image.Dispose();image=null'));
 assert.match(s,/catch\{try\{Dispose\(\);\}catch\{throw new InvalidOperationException\("NATIVE_RETAINED_FACTORY_CLEANUP_UNKNOWN"\)/);
 assert.match(host,/if\(retainedFromFactory\)\{try\{retainedFactory\.Dispose\(\);retainedReturn=null;\}catch\{unknown=true;exit=1;\}\}else if\(retainedReturn!=null\)/);
});

// 다음 두 시험은 C# 실행이 아닌 RAM 소유권 모형이다. 정적 검산과 합쳐 정리 설계를 확인한다.
function ownershipModel(failAt=-1,cleanupUnknown=false){
 const events:string[]=[];let used=false,job=false,image=false,returned=false,closed=false;
 const dispose=()=>{if(closed)return;if(job){events.push('job.dispose');if(cleanupUnknown)throw Error('UNKNOWN');job=false;}if(image){events.push('image.dispose');image=false;}closed=true;};
 return {events,dispose,state:()=>({job,image,returned,closed}),create:()=>{if(used)throw Error('USED');used=true;image=true;try{for(const [index,step] of ['job','assignment','startup','bind','process','validate'].entries()){events.push(step);if(step==='job')job=true;if(index===failAt)throw Error('FAIL');}returned=true;return 'ORIGINAL_PROCESS';}catch{dispose();throw Error('FAIL');}},settle:()=>{cleanupUnknown=false;}};
}
test('RAM 모형: 부분 생성 각단계실패는 정리·단발을 보존하고 정상 반환은 즉시 부모를 닫지 않는다',()=>{
 for(let at=0;at<6;at++){const f=ownershipModel(at);assert.throws(f.create);assert.deepEqual(f.state(),{job:false,image:false,returned:false,closed:true});const before=[...f.events];assert.throws(f.create,/USED/);assert.deepEqual(f.events,before);}
 const f=ownershipModel();assert.equal(f.create(),'ORIGINAL_PROCESS');assert.deepEqual(f.state(),{job:true,image:true,returned:true,closed:false});assert.throws(f.create,/USED/);f.dispose();assert.deepEqual(f.events.slice(-2),['job.dispose','image.dispose']);
});
test('RAM 모형: process 정리 UNKNOWN은 Job/Image 보유·새 생성0, 후속 명시 Dispose만 가능하다',()=>{
 const f=ownershipModel(5,true);assert.throws(f.create,/UNKNOWN/);assert.deepEqual(f.state(),{job:true,image:true,returned:false,closed:false});assert.equal(f.events.includes('image.dispose'),false);const count=f.events.length;assert.throws(f.create,/USED/);assert.equal(f.events.length,count);f.settle();f.dispose();assert.deepEqual(f.state(),{job:false,image:false,returned:false,closed:true});
});
