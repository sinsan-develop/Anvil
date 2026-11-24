import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {ownershipPreparationReceiptFixture} from './ownership-preparation-receipt-fixture.ts';
import {readOwnershipNativePreparationProfile} from '../../../apps/server/modules/executions/ownership-native-preparation-profile.ts';
const m=await import(new URL('../../../apps/connector/runtime/ownership-preparation-input-source.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){
 const now=Date.now(),selection:Record<string,string>={};
 for(const key of ['installationId','projectId','executionId','userId','clientId','humanSessionId','rootId','runId','preparationId','authorizationReceiptId','policyId','registrationId','observerId'])selection[key]='70000000-0000-4000-8000-000000000001';
 for(const key of ['executionGeneration','controlGeneration','credentialGeneration','processGeneration','preparationVersion','authorizationReceiptVersion','policyVersion','registrationVersion','observerVersion'])selection[key]='1';
 for(const key of ['preparationHash','authorizationReceiptHash','policyHash','registrationHash','observerHash','publicKeyFingerprint','hostHash','workerHash'])selection[key]='a'.repeat(64);
 selection.issuedAt=new Date(now-1000).toISOString();selection.expiresAt=new Date(now+60000).toISOString();
 return{purpose:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_BASIS_ONLY',selection,policyDisposition:'AUTO',registrationScope:'REGISTRATION_STATUS_ONLY',grants:[],checkedAt:new Date(now-100).toISOString(),expiresAt:new Date(now+30000).toISOString(),processCreationAuthorized:false,preparationAuthorized:false,executionAuthorized:false,dispatchPerformed:false,missingEvidence:['AUTHENTICATED_NATIVE_CHANNEL','RETAINED_PROCESS_JOB_FACTORY','OBSERVATION_SIGNER']};
}
function read(profile:unknown,expected:unknown){assert.equal(typeof m.readOwnershipPreparationInputSource,'function','기존 server profile의 실행기 SOURCE 입력 대조가 필요하다');return m.readOwnershipPreparationInputSource(profile,expected);}
const rejected=(profile:unknown,expected:unknown)=>assert.throws(()=>read(profile,expected),{message:'OWNERSHIP_PREPARATION_INPUT_SOURCE_UNAVAILABLE'});
test('원profile의선택/짧은기한을불변입력으로옮기되인증과권한은false',()=>{
 const p=fixture(),v=read(p,p.selection);
 assert.equal(v.purpose,'OWNERSHIP_NATIVE_PREPARATION_INPUT_SOURCE_ONLY');assert.equal(v.selection.rootId,'70000000-0000-4000-8000-000000000001');assert.equal(v.selection.workerHash,'a'.repeat(64));assert.equal(v.expiresAt,p.expiresAt);
 assert.deepEqual(v.grants,[]);for(const k of ['serverAuthenticated','processCreationAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed'])assert.equal(v[k],false);
 p.selection.workerHash='b'.repeat(64);p.missingEvidence.length=0;
 assert.equal(v.selection.workerHash,'a'.repeat(64));assert(v.missingEvidence.includes('AUTHENTICATED_NATIVE_CHANNEL'));
 assert(Object.isFrozen(v));assert(Object.isFrozen(v.selection));assert(Object.isFrozen(v.grants));assert(Object.isFrozen(v.missingEvidence));
});
test('별도프로젝트/세대/hash·추가키와모양변조를거절',()=>{
 for(const key of ['projectId','credentialGeneration','workerHash']){const p=fixture(),expected=structuredClone(p.selection);expected[key]=key==='projectId'?'70000000-0000-4000-8000-000000000002':key==='workerHash'?'b'.repeat(64):'2';rejected(p,expected);}
 for(const key of ['projectId','processGeneration','hostHash','issuedAt']){const p=fixture();p.selection[key]='invalid';rejected(p,p.selection);}
 for(const bad of ['0','01','9007199254740992']){const p=fixture();p.selection.processGeneration=bad;rejected(p,p.selection);}
 const extra=fixture();rejected({...extra,extra:true},extra.selection);rejected(extra,{...extra.selection,extra:'x'});
 const missing=fixture();delete missing.selection.hostHash;rejected(missing,missing.selection);
});
test('권한승격·등록scope확대·grants·미확인삭제를거절',()=>{
 for(const key of ['processCreationAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed']){const p=fixture();rejected({...p,[key]:true},p.selection);}
 for(const delta of [{purpose:'OTHER'},{policyDisposition:'REQUIRE_APPROVAL'},{registrationScope:'EXECUTE'},{grants:['EXECUTE']},{missingEvidence:[]},{missingEvidence:['AUTHENTICATED_NATIVE_CHANNEL']},{missingEvidence:['AUTHENTICATED_NATIVE_CHANNEL','RETAINED_PROCESS_JOB_FACTORY','OBSERVATION_SIGNER','BAD\nCODE']}]){const p=fixture();rejected({...p,...delta},p.selection);}
});
test('만료·미래/오래된관측·원기한확장·최대수명을거절',()=>{
 for(const delta of [{checkedAt:new Date(Date.now()+10000).toISOString()},{checkedAt:new Date(Date.now()-20000).toISOString()},{expiresAt:new Date(Date.now()-1).toISOString()},{expiresAt:new Date(Date.now()+90000).toISOString()}]){const p=fixture();rejected({...p,...delta},p.selection);}
 const p=fixture();p.selection.expiresAt=new Date(Date.now()+121000).toISOString();rejected(p,p.selection);
 const future=fixture();future.selection.issuedAt=new Date(Date.now()+10000).toISOString();rejected(future,future.selection);
});
test('getter/symbol입력을실행하지않고거절',()=>{
 const p=fixture();let called=0;const accessor={...p};Object.defineProperty(accessor,'selection',{enumerable:true,get(){called++;return p.selection;}});rejected(accessor,p.selection);assert.equal(called,0);
 rejected({...p,[Symbol('hidden')]:1},p.selection);const selected={...p.selection};Object.defineProperty(selected,'rootId',{enumerable:true,get(){called++;return p.selection.rootId;}});rejected(p,selected);assert.equal(called,0);
});
test('미확인배열의prototype getter/iterator를실행하지않고검사한index만복사',()=>{
 for(const key of ['every','includes',Symbol.iterator]){
  const p=fixture();let called=0;const prototype=Object.create(Array.prototype);
  Object.defineProperty(prototype,key,{get(){called++;throw Error('UNTRUSTED_ARRAY_CALLBACK');}});
  Object.setPrototypeOf(p.missingEvidence,prototype);
  const v=read(p,p.selection);assert.equal(called,0);assert.deepEqual(v.missingEvidence,['AUTHENTICATED_NATIVE_CHANNEL','RETAINED_PROCESS_JOB_FACTORY','OBSERVATION_SIGNER']);
 }
});
test('기존server원기록투영을source입력으로소비하되실채널로승격하지않음',async(t)=>{
 const f=await ownershipPreparationReceiptFixture();
 // 기존 원기록 fixture는 2026-10-23T00:00:00.010Z 고정시계다. 소비측의 현재도 시험 안에서만 맞춘다.
 t.mock.timers.enable({apis:['Date'],now:f.now.getTime()});
 const p=await readOwnershipNativePreparationProfile(f.db,f.access,f.token,f.csrf,f.prep.snapshot.scope,f.prep.ref),v=read(p,p.selection);
 assert.equal(v.selection.preparationId,f.prep.ref.id);assert.equal(v.selection.authorizationReceiptHash,f.prep.snapshot.authorizationReceiptRef.contentHash);assert.equal(v.serverAuthenticated,false);assert.equal(v.dispatchPerformed,false);
 t.mock.timers.tick(60001);rejected(p,p.selection);
});
test('정적: normal local worker 입력은 legacy plan과 분리된 exact 불변 source다',()=>{
 const source=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceWorkerInputSource.cs',import.meta.url),'utf8');
 const start=source.indexOf('internal sealed class NormalStartWorkerInvocationCandidate'),end=source.indexOf('internal static WorkerInputCandidate BuildSource(',start),body=source.slice(start,end);
 assert(start>0&&end>start);assert.match(body,/NORMAL_START_LOCAL_WORKER_INVOCATION_SOURCE_ONLY/);
 for(const value of ['imageRefJson','requestRefJson','localClaimRefJson','localProcessId','localProcessGeneration','ExpiresAt'])assert.match(body,new RegExp('\\b'+value+'\\b'));
 assert.match(body,/arguments=new\[\]\{localProcessId,localProcessGeneration\.ToString\(CultureInfo\.InvariantCulture\),end\.ToString\("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo\.InvariantCulture\)\}/);
 for(const forbidden of ['runId','authorizationReceipt','permit','RESERVED','OwnershipEvidencePreparationPlan'])assert.doesNotMatch(body,new RegExp(forbidden));
 for(const flag of ['ProcessCreationAuthorized','PreparationAuthorized','ExecutionAuthorized','DispatchPerformed'])assert.match(body,new RegExp(flag+'\\{get\\{return false;\\}\\}'));
 assert.match(body,/ReadCurrent\(int timeoutMs=2000\)/);assert.match(body,/timeoutMs<1\|\|timeoutMs>2000/);
 assert.match(body,/private NormalStartWorkerInvocationCandidate\(/);assert.doesNotMatch(body,/internal NormalStartWorkerInvocationCandidate\(/);
 assert.match(body,/V\.Ref\(imageRef,true\)/);assert.match(body,/V\.Ref\(requestRef,true\)/);assert.match(body,/V\.Ref\(localClaimRef,true\)/);
 assert.match(body,/new\[\]\{imageId,requestId,claimId,localProcessId\}\.Distinct\(\)\.Count\(\)!=4/);
 assert.match(body,/DateTime end=Time\(expiresAt\.ToString\("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo\.InvariantCulture\)\)/);assert.match(body,/end<=now\|\|\(end-now\)\.TotalMilliseconds>10000/);
 assert.match(source,/internal static NormalStartWorkerInvocationCandidate BuildNormalStartSource\(/);assert.match(source,/return NormalStartWorkerInvocationCandidate\.Create\(/);
});
test('정적: normal 입력은 legacy WorkerInputBound를 바꾸지 않고 private bind/current만 사용한다',()=>{
 const source=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceProcessStartupSource.cs',import.meta.url),'utf8');
 assert.match(source,/private OwnershipEvidenceWorkerInputSource\.NormalStartWorkerInvocationCandidate normalWorkerInput;/);
 assert.match(source,/internal static void BindNormalStartWorkerInvocationSource\(/);assert.match(source,/internal static OwnershipEvidenceWorkerInputSource\.NormalStartWorkerInvocationObservation ReadNormalStartWorkerInvocationSource\(/);
 assert.match(source,/return new SuspendedStartupObservation\(from,DateTime\.UtcNow,workerInput!=null\)/,'legacy WorkerInputBound 의미는 old 입력에만 결박한다');
 assert.match(source,/public SuspendedStartupObservation ReadCurrent\(int timeoutMs=10000\)/);assert.match(source,/normalWorkerInput\.ReadCurrent\(Math\.Min\(timeoutMs,2000\)\)/);
 assert.match(source,/if\(workerInput!=null\|\|normalWorkerInput!=null\)throw Unavailable\(\)/);
 assert.match(source,/normalWorkerInput=input;/);assert.match(source,/normalWorkerInput=null;/);
 assert.match(source,/BindNormalStartWorkerInvocationSource\([^)]*int timeoutMs=2000\)/);assert.match(source,/ReadNormalStartWorkerInvocationSource\([^)]*int timeoutMs=2000\)/);
 assert.equal((source.match(/if\(timeoutMs>2000\)throw Unavailable\(\)/g)||[]).length,2);
 for(const invariant of ['private const uint SuspendedCreationFlags=0x08080404','InheritHandles=false,EmptyUnicodeEnvironment=true','Marshal.AllocHGlobal(4)','Marshal.WriteInt16(environment,0,0);Marshal.WriteInt16(environment,2,0)'])assert(source.includes(invariant),invariant);
});
test('정적: exact normal image와 bound startup만 suspended process를 단회 생성하고 UNKNOWN owner를 보존한다',()=>{
 const owner=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceImageOwnerSource.cs',import.meta.url),'utf8');
 const deployment=readFileSync(new URL('../../../apps/connector/native/NativeWorkerDeploymentSource.cs',import.meta.url),'utf8');
 const process=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceProcessOwnerSource.cs',import.meta.url),'utf8');
 const host=readFileSync(new URL('../../../apps/connector/native/DesktopTrustKeyHostSource.cs',import.meta.url),'utf8');
 assert.match(owner,/internal static T WithOriginalNormalLaunchSource<T>\(INormalRetainedImageCandidate candidate,int timeoutMs,Func<string,string,T> launch\)/);
 assert.match(owner,/candidate as NormalImageOwner/);assert.match(owner,/original\.WithNormalLaunch\(workerHash,directoryIdentity,fileIdentity,timeoutMs,launch\)/);
 assert.match(deployment,/internal static T WithTransferredNormalImageLaunch<T>\(OwnershipEvidenceImageOwnerSource\.INormalRetainedImageCandidate candidate,int timeoutMs,Func<string,string,T> launch\)/);
 assert.match(deployment,/candidate as NormalTransferredImageSource/);assert.match(deployment,/source\.CheckCurrent\(\)[\s\S]*WithOriginalNormalLaunchSource\(image,timeoutMs,launch\)[\s\S]*source\.CheckCurrent\(\)/);
 assert.match(process,/internal interface INormalSuspendedProcessCandidate:IDisposable/);assert.match(process,/internal static INormalSuspendedProcessCandidate CreateNormalSuspendedProcessSource\(ISuspendedStartupCandidate startup,OwnershipEvidenceImageOwnerSource\.INormalRetainedImageCandidate image,int timeoutMs=2000\)/);
 assert.match(process,/var original=candidate as ProcessStartup/);assert.match(process,/return original\.CreateNormalSource\(image,timeoutMs\)/);
 const normal=process.slice(process.indexOf('private sealed class NormalProcessOwner:'),process.indexOf('private static readonly ConditionalWeakTable',process.indexOf('private sealed class NormalProcessOwner:')));assert(normal.length>0);
 assert.match(normal,/startup\.normalWorkerInput\.Arguments/);assert.match(normal,/var input=startup\.normalWorkerInput\.ReadCurrent\(cap\)/);assert.match(normal,/var retained=NativeWorkerDeploymentSource\.ReadTransferredNormalImage\(image,Math\.Min\(cap,1000\)\)/);assert.match(normal,/input\.ImageRefJson!=retained\.AssociationRefJson/);assert.match(normal,/retained\.AssociationRefJson\)throw Unavailable\(\);Remaining\(cap\);\s*created=CreateProcessW\(path,command,IntPtr\.Zero,IntPtr\.Zero,false,SuspendedCreationFlags,startup\.environment,directory,ref startup\.info,out original\)/);
 assert.match(normal,/NativeWorkerDeploymentSource\.ReadTransferredNormalImage/);assert.match(normal,/input\.ImageRefJson!=imageCurrent\.AssociationRefJson/);assert.match(normal,/timeoutMs<1\|\|timeoutMs>2000/);
 assert.doesNotMatch(normal,/ReadPreparedFactsSource|OwnershipEvidencePreparationPlan|WorkerInputCandidate|IImageOwnerCandidate|ProcessId=value|ThreadId=value|OpenProcess|GetProcessById|while\s*\(|for\s*\(/);
 const observation=process.slice(process.indexOf('internal sealed class NormalProcessOwnerObservation'),process.indexOf('private sealed partial class OwnedEmptyJob'));
 for(const flag of ['OsOwnershipVerified','ProcessCreated','ThreadCreated','ProcessCreationAuthorized','PreparationAuthorized','ExecutionAuthorized','DispatchPerformed'])assert.match(observation,new RegExp(flag+'\\{get\\{return false;\\}\\}'));
 assert.match(normal,/bool attempted,created,exitConfirmed,closed,cleanupAttempted,cleanupUnknown/);assert.match(normal,/original\.Process==original\.Thread\|\|original\.Pid==0\|\|original\.Tid==0\)\{cleanupUnknown=true;throw CleanupUnknown\(\);\}/);assert.match(normal,/if\(cleanupAttempted\|\|cleanupUnknown\)throw CleanupUnknown\(\)/);assert.match(normal,/if\(state==258\)\{wait=Remaining\(wait\);if\(!TerminateProcess/);assert.match(normal,/closingImage\.Dispose\(\);imageCloseReceipt=NativeWorkerDeploymentSource\.ReadTransferredNormalImageCloseReceipt\(closingImage\);image=null;Remaining\(2000\)/);assert.equal((normal.match(/TerminateProcess\(/g)||[]).length,1);assert.equal((normal.match(/WaitForSingleObject\(/g)||[]).length,3);
 assert.match(process,/NormalProcessOwner attempted=null/);assert.match(process,/normalProcessOwner=attempted=new NormalProcessOwner\(this,image\)/);assert.match(process,/if\(attempted!=null\)attempted\.Dispose\(\)/);assert.ok(process.indexOf('normalProcessOwner=attempted=new NormalProcessOwner(this,image)')<process.indexOf('WithTransferredNormalImageLaunch(image,Math.Min(timeoutMs,1000)'));
 assert.match(process,/if\(processOwner!=null\|\|normalProcessOwner!=null\|\|workerInput==null\|\|normalWorkerInput!=null\)throw Unavailable\(\)/);
 assert.match(process,/if\(normalProcessOwner!=null\|\|processOwner!=null\|\|normalWorkerInput==null\|\|workerInput!=null\)throw Unavailable\(\)/);
 const producer=host.slice(host.indexOf('internal abstract class NormalStartPreparationProducer'),host.indexOf('readonly NormalStartPreparationProducer'));
 assert.match(producer,/BuildNormalStartSource/);assert.match(producer,/CreateEmptyJobSource/);assert.match(producer,/PrepareAtomicJobAssignmentSource/);assert.match(producer,/PrepareSuspendedStartupSource/);assert.match(producer,/BindNormalStartWorkerInvocationSource/);assert.match(producer,/CreateNormalSuspendedProcessSource/);
 assert.match(producer,/if\(used\|\|cleanupUnknown\|\|disposed\)throw Invalid\(\)/);assert.match(producer,/used=true/);assert.match(producer,/job\.Dispose\(\)/);assert.match(producer,/if\(cleanupAttempted\|\|cleanupUnknown\)throw Invalid\(\)/);
 assert.match(producer,/claim\.Consume\(record,request,imageMaterial,current\)/);assert.match(producer,/retained\.TransferToFactory\(Math\.Min\(1000,left\(\)\)\)/);
 assert.match(producer,/process=OwnershipEvidenceJobFactorySource\.CreateNormalSuspendedProcessSource[^;]+;processOwnerStarted=true;image=null/);assert.match(producer,/job\.Dispose\(\);if\(processOwnerStarted\)[\s\S]*else if\(image!=null\)image\.Dispose\(\)/);
 assert.match(host,/normalStartPreparationProducer\.Dispose\(\)/);assert.ok(host.indexOf('normalStartPreparationProducer.Dispose()')<host.indexOf('workerDeployment.Dispose()'));
 assert.match(host,/normalStartPreparationCleanupUnknown/);assert.match(host,/normalStartPreparationUnknownOwners\.Add\(this\)/);
});

test('정적: same-request 회수는 process/thread/image와 startup·assignment·Job 뒤 원 claim만 최종 판독한다',()=>{
 const deployment=readFileSync(new URL('../../../apps/connector/native/NativeWorkerDeploymentSource.cs',import.meta.url),'utf8');
 const process=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceProcessOwnerSource.cs',import.meta.url),'utf8');
 const host=readFileSync(new URL('../../../apps/connector/native/DesktopTrustKeyHostSource.cs',import.meta.url),'utf8');
 const cleanup=process.slice(process.indexOf('internal sealed class NormalProcessCleanupReceipt'),process.indexOf('private sealed partial class OwnedEmptyJob'));
 assert.ok(cleanup.length>0);for(const field of ['ImageRefJson','RequestRefJson','LocalClaimRefJson','LocalProcessId','LocalProcessGeneration','ExpiresAt'])assert.match(cleanup,new RegExp(field));
 for(const flag of ['ProcessExitConfirmed','ThreadCloseConfirmed','ProcessCloseConfirmed','ImageCloseConfirmed'])assert.match(cleanup,new RegExp(flag+'\\{get\\{return true;\\}\\}'));
 assert.doesNotMatch(cleanup,/\bProcessId\b|\bThreadId\b|IntPtr|Handle|Authorized\{get\{return true/);
 const normal=process.slice(process.indexOf('private sealed class NormalProcessOwner:'),process.indexOf('private static readonly ConditionalWeakTable',process.indexOf('private sealed class NormalProcessOwner:')));
 assert.match(normal,/originalObservation/);assert.match(normal,/var closingImage=image;closingImage\.Dispose\(\);imageCloseReceipt=NativeWorkerDeploymentSource\.ReadTransferredNormalImageCloseReceipt\(closingImage\)/);
 assert.match(normal,/exitConfirmed=true[\s\S]*threadCloseSucceeded[\s\S]*processCloseSucceeded[\s\S]*imageCloseReceipt/);
 assert.match(process,/ReadOriginalNormalSuspendedProcessCleanupSource\(/);assert.match(process,/normalReturnOwners\.TryGetValue\(candidate,out marker\)/);
 const producer=host.slice(host.indexOf('internal abstract class NormalStartPreparationProducer'),host.indexOf('readonly NormalStartPreparationProducer'));
 assert.match(producer,/ReadOriginalNormalSuspendedProcessCleanupSource\(process\)/);
 assert.match(producer,/startup\.LocalEnvironmentReleased/);assert.match(producer,/assignment\.LocalBuffersReleased/);assert.match(producer,/job\.LocalHandleCloseConfirmed/);
 assert.match(producer,/Canonical\(material\.ImageRef,0\)/);assert.match(producer,/Canonical\(material\.RequestRef,0\)/);assert.match(producer,/Canonical\(material\.NativeClaimRef,0\)/);
 const jobAt=producer.indexOf('job.Dispose()'),processAt=producer.indexOf('ReadOriginalNormalSuspendedProcessCleanupSource(process)'),flagsAt=producer.indexOf('startup.LocalEnvironmentReleased'),claimAt=producer.indexOf('finalClaimCurrent(material)'),clearAt=producer.indexOf('job=null');
 assert.ok(jobAt>=0&&jobAt<processAt&&processAt<flagsAt&&flagsAt<claimAt&&claimAt<clearAt);
 assert.match(producer,/if\(cleanupAttempted\|\|cleanupUnknown\)throw Invalid\(\)/);assert.match(producer,/catch\{cleanupUnknown=true;throw Invalid\(\);\}/);
 const dispose=producer.slice(producer.indexOf('public void Dispose()'));assert.doesNotMatch(dispose,/RecordConfirmedRejected|PREPARED|POST|queue/i);
 assert.match(deployment,/NormalTransferredImageCloseReceipt/);
});
