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
test('정적: normal 생성 후 원 owner 관측은 빈 Job 대신 정확 singleton을 검산하고 생성 전·legacy 검사는 유지한다',()=>{
 const startup=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceProcessStartupSource.cs',import.meta.url),'utf8');
 const process=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceProcessOwnerSource.cs',import.meta.url),'utf8');
 const job=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceJobFactorySource.cs',import.meta.url),'utf8');
 const host=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceHost.cs',import.meta.url),'utf8');
 assert.match(startup,/public SuspendedStartupObservation ReadCurrent\(int timeoutMs=10000\)\s*\{return ReadCurrentCore\(null,timeoutMs\);\}/);
 assert.match(startup,/private SuspendedStartupObservation ReadCurrentCore\(NormalProcessOwner expected,int timeoutMs\)/);
 assert.match(startup,/if\(expected==null\)Read\(parent\.owner\.job,from,watch,timeoutMs\);\s*else\s*\{\s*if\(!Object\.ReferenceEquals\(normalProcessOwner,expected\)\|\|processOwner!=null\|\|normalWorkerInput==null\|\|workerInput!=null\)throw Unavailable\(\)/);
 assert.match(startup,/ReadNormalSingleton\(parent\.owner\.job,from,watch,timeoutMs\)/);
 const accounting=job.slice(job.indexOf('private static Accounting ReadAccounting('),job.indexOf('private sealed partial class OwnedEmptyJob'));
 assert.match(accounting,/if\(!GetHandleInformation\(job,out flags\)\|\|flags!=0\)throw Unavailable\(\)/);
 assert.match(accounting,/QueryInformationJobObject\(job,1,out value,size,out returned\)\|\|returned!=size/);
 assert.match(accounting,/private static void Read\([^]*ReadAccounting\(job,from,watch,timeoutMs\)[^]*RequireEmptyAccountingSource/);
 const singleton=accounting.slice(accounting.indexOf('private static void ReadNormalSingleton('));
 assert.match(singleton,/ReadAccounting\(job,from,watch,timeoutMs\)/);
 assert.match(singleton,/if\(value\.Total!=1\|\|value\.Active!=1\|\|value\.Terminated!=0\)throw Unavailable\(\)/);
 assert.doesNotMatch(singleton,/value\.(?:User|Kernel|PeriodUser|PeriodKernel|Faults)/,'생성 후 CPU 시간·fault는 0으로 제한하지 않는다');
 for(const guard of ['parent.startup!=this','parent.owner.assignment!=parent','info.Attributes!=parent.list','info.Basic.Flags!=0','info.Basic.Input!=IntPtr.Zero','Marshal.ReadInt16(environment,2)!=0','normalWorkerInput.ReadCurrent(Math.Min(timeoutMs,2000))','Budget(from,watch,timeoutMs)'])assert(startup.includes(guard),guard);
 const at=process.indexOf('private sealed class NormalProcessOwner:'),end=process.indexOf('private static readonly ConditionalWeakTable',at),normal=process.slice(at,end);
 assert(at>0&&end>at);
 const create=normal.slice(normal.indexOf('internal void Create('),normal.indexOf('public NormalProcessOwnerObservation ReadCurrent('));
 assert.match(create,/startup\.ReadCurrent\(cap\)[\s\S]*created=CreateProcessW/,'생성 전에는 빈 Job 검사를 우회하지 않는다');
 const current=normal.slice(normal.indexOf('public NormalProcessOwnerObservation ReadCurrent('),normal.indexOf('public void Dispose('));
 assert.match(current,/startup\.normalProcessOwner!=this\)throw Unavailable\(\)/);
 assert.match(current,/startup\.ReadCurrentCore\(this,cap\)/);assert.doesNotMatch(current,/startup\.ReadCurrent\(/);
 assert.equal((current.match(/ReadRetainedHandleQuerySource\(process,startup\.parent\.owner\.job\)/g)||[]).length,2);
 assert.match(current,/ReadRetainedThreadQuerySource\(thread,process\)/);
 for(const guard of ['first.Pid!=original.Pid','last.Pid!=original.Pid','current.ProcessId!=original.Pid','current.ThreadId!=original.Tid','first.StartTicks!=last.StartTicks','last.StartTicks!=current.ProcessStartTicks','first.ObservedImagePathDigest!=expectedPathDigest','afterImage.AssociationRefJson!=imageCurrent.AssociationRefJson'])assert(current.includes(guard),guard);
 assert.equal((process.match(/startup\.ReadCurrentCore\(this,cap\)/g)||[]).length,1,'원 normal owner만 생성 후 경로를 소비한다');
 assert.match(job,/user!=0\|\|kernel!=0\|\|periodUser!=0\|\|periodKernel!=0\|\|faults!=0\|\|total!=0\|\|active!=0\|\|terminated!=0/);
 assert.match(host,/Marshal\.ReadInt32\(buffer,0\)!=1\|\|Marshal\.ReadInt32\(buffer,4\)!=1/);assert.match(host,/if\(member!=pid\)throw Unavailable\(\)/);
 assert.match(process,/OsOwnershipVerified\{get\{return false;\}\}/); // 판독 경로 변경이 새로운 권위 생산자가 되지 않는다.
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
 const dispose=producer.slice(producer.indexOf('public void Dispose()'));
 const jobAt=dispose.indexOf('job.Dispose()'),processAt=dispose.indexOf('ReadOriginalNormalSuspendedProcessCleanupSource(process)'),flagsAt=dispose.indexOf('startup.LocalEnvironmentReleased'),claimAt=dispose.indexOf('finalClaimCurrent(material)'),clearAt=dispose.indexOf('job=null');
 assert.ok(jobAt>=0&&jobAt<processAt&&processAt<flagsAt&&flagsAt<claimAt&&claimAt<clearAt);
 assert.match(producer,/if\(cleanupAttempted\|\|cleanupUnknown\)throw Invalid\(\)/);assert.match(producer,/catch\{cleanupUnknown=true;throw Invalid\(\);\}/);
 assert.doesNotMatch(dispose,/RecordConfirmedRejected|PREPARED|POST|queue/i);
 assert.match(deployment,/NormalTransferredImageCloseReceipt/);
});

test('정적: normal 원 suspended 최초 관측은 동일 producer에 결박하고 cleanup 모순을 회수 확정으로 승격하지 않는다',()=>{
 const host=readFileSync(new URL('../../../apps/connector/native/DesktopTrustKeyHostSource.cs',import.meta.url),'utf8');
 const producer=host.slice(host.indexOf('internal abstract class NormalStartPreparationProducer'),host.indexOf('readonly NormalStartPreparationProducer'));
 assert.match(producer,/NormalProcessOwnerObservation processObservation/);
 assert.match(producer,/var observed=OwnershipEvidenceJobFactorySource\.ReadOriginalNormalSuspendedProcessSource\(process,Math\.Min\(2000,left\(\)\)\)/);
 for(const exact of [
  'observed.ImageRefJson==Canonical(material.ImageRef,0)',
  'observed.RequestRefJson==Canonical(material.RequestRef,0)',
  'observed.LocalClaimRefJson==Canonical(material.NativeClaimRef,0)',
  'observed.LocalProcessId==localProcessId',
  'observed.LocalProcessGeneration==localProcessGeneration',
  'observed.ExpiresAt==material.ExpiresAt',
  'observed.ObservedAt<observed.ExpiresAt',
 ])assert(producer.includes(exact),exact);
 for(const flag of ['OsOwnershipVerified','ProcessCreated','ThreadCreated','ProcessCreationAuthorized','PreparationAuthorized','ExecutionAuthorized','DispatchPerformed'])assert(producer.includes('observed.'+flag),flag);
 const readAt=producer.indexOf('var observed=OwnershipEvidenceJobFactorySource.ReadOriginalNormalSuspendedProcessSource'),checked=producer.indexOf('if(!ValidProcessObservation(observed))',readAt),retained=producer.indexOf('processObservation=observed',checked),current=producer.indexOf('left();',retained);
 assert.ok(readAt>=0&&readAt<checked&&checked<retained&&retained<current,'관측 검산 성공 후에만 보유·남은 기한 확인');
 assert.match(producer,/bool ProcessObservationMatchesCleanup\(\)\{\s*return processObservation==null\|\|/);
 for(const field of ['ImageRefJson','RequestRefJson','LocalClaimRefJson','LocalProcessId','LocalProcessGeneration','ExpiresAt'])assert(producer.includes('processCleanup.'+field+'==processObservation.'+field),field);
 assert.doesNotMatch(producer,/processObservation==null\|\|!processCleanup\.ProcessExitConfirmed/,'관측 부재는 기존 물리 회수를 차단하지 않음');
 const cleanup=producer.indexOf('processCleanup=OwnershipEvidenceJobFactorySource.ReadOriginalNormalSuspendedProcessCleanupSource(process)'),contradiction=producer.indexOf('!ProcessObservationMatchesCleanup()',cleanup),cleared=producer.indexOf('processObservation=null',contradiction);
 assert.ok(cleanup>=0&&cleanup<contradiction&&contradiction<cleared,'보유한 최초 관측이 있을 때만 cleanup receipt 대조 후 제거');
 assert.doesNotMatch(producer,/(?:internal|public) OwnershipEvidenceJobFactorySource\.NormalProcessOwnerObservation|PREPARED|queue/i);
});

test('정적: 성공 claim은 일반 응답 직전 같은 원 process·durable claim을 재검산하되 최초 관측을 교체하지 않는다',()=>{
 const host=readFileSync(new URL('../../../apps/connector/native/DesktopTrustKeyHostSource.cs',import.meta.url),'utf8');
 const producer=host.slice(host.indexOf('internal abstract class NormalStartPreparationProducer'),host.indexOf('readonly NormalStartPreparationProducer'));
 const handler=host.slice(host.indexOf('if(operation=="CLAIM_NORMAL_START_PREPARATION_REQUEST_V1")'),host.indexOf('if(operation=="SIGN_NORMAL_START_PREPARATION_RESULT_V1")'));
 assert.match(producer,/internal void RecheckOwned\(NormalExecutionSpoolProfileSource\.NormalStartPreparationClaimMaterial consumed,Func<int> remaining,Action current,Action<NormalExecutionSpoolProfileSource\.NormalStartPreparationClaimMaterial> claimCurrent,Func</);
 const recheck=producer.slice(producer.indexOf('internal void RecheckOwned('),producer.indexOf('public void Dispose()'));
 assert.match(recheck,/lock\(gate\)/);assert.match(recheck,/Object\.ReferenceEquals\(consumed,material\)/);
 assert.match(recheck,/var latest=OwnershipEvidenceJobFactorySource\.ReadOriginalNormalSuspendedProcessSource\(process,Math\.Min\(2000,left\(\)\)\)/);
 assert.match(recheck,/ValidProcessObservation\(latest\)/);assert.match(recheck,/SameProcessObservation\(first,latest\)/);
 const same=producer.slice(producer.indexOf('static bool SameProcessObservation('),producer.indexOf('internal void CreateOwned('));
 assert.match(same,/latest\.ObservedAt>=first\.ObservedAt/);
 for(const field of ['ImageRefJson','RequestRefJson','LocalClaimRefJson','LocalProcessId','LocalProcessGeneration','ExpiresAt'])assert(same.includes('latest.'+field+'==first.'+field),field);
 const readAt=recheck.indexOf('var latest=OwnershipEvidenceJobFactorySource.ReadOriginalNormalSuspendedProcessSource'),claimAt=recheck.indexOf('claimCurrent(material)',readAt),lastCurrent=recheck.indexOf('left();',claimAt);
 assert.ok(readAt>=0&&readAt<claimAt&&claimAt<lastCurrent,'재관측 후 같은 call 내 durable claim read·최종 current');
 assert.equal((producer.match(/processObservation=observed/g)||[]).length,1);assert.doesNotMatch(recheck,/processObservation\s*=(?!=)|Dispose\(|cleanupUnknown\s*=(?!=)/);
 const capability=handler.indexOf('if(claim.Capability==null)return claim.Output'),rejected=handler.indexOf('if(rejected!=null)'),created=handler.indexOf('normalStartPreparationProducer.CreateOwned'),released=handler.indexOf('retained=null',created),reobserved=handler.indexOf('normalStartPreparationProducer.RecheckOwned',released),returned=handler.indexOf('return claim.Output',reobserved);
 assert.ok(capability>=0&&capability<rejected&&rejected<created&&created<released&&released<reobserved&&reobserved<returned,'replay·REJECTED 조기 반환 후 성공 owner 이전→재관측→응답');
 assert.match(handler,/RecheckOwned\(material,\(\)=>call\.Remaining\(\),ready,\s*exact=>spoolProfile\.ReadNormalStartPreparationClaimCurrent\(exact,\(\)=>call\.Now,ready\),\s*\(exact,first,latest,processId,generation\)=>spoolProfile\.RecordNormalStartPreparationOwnerTerminal/);
 assert.equal((handler.match(/RecheckOwned\(/g)||[]).length,1);assert.doesNotMatch(handler.slice(created,returned),/Dispose\(|cleanupUnknown\s*=/);
});

test('정적: 같은 원 owner 재관측 terminal은 durable claim 원장에만 단회 기록되고 PREPARED나 권위로 승격하지 않는다',()=>{
 const host=readFileSync(new URL('../../../apps/connector/native/DesktopTrustKeyHostSource.cs',import.meta.url),'utf8');
 const spool=readFileSync(new URL('../../../apps/connector/native/NormalExecutionSpoolProfileSource.cs',import.meta.url),'utf8');
 const producer=host.slice(host.indexOf('internal abstract class NormalStartPreparationProducer'),host.indexOf('readonly NormalStartPreparationProducer'));
 const recheck=producer.slice(producer.indexOf('internal void RecheckOwned('),producer.indexOf('public void Dispose()'));
 const handler=host.slice(host.indexOf('if(operation=="CLAIM_NORMAL_START_PREPARATION_REQUEST_V1")'),host.indexOf('if(operation=="SIGN_NORMAL_START_PREPARATION_RESULT_V1")'));
 assert.match(producer,/NormalStartPreparationOwnerTerminalCandidate ownerTerminal/);
 assert.match(recheck,/Func<NormalExecutionSpoolProfileSource\.NormalStartPreparationClaimMaterial,DateTime,DateTime,string,long,NormalExecutionSpoolProfileSource\.NormalStartPreparationOwnerTerminalCandidate> terminal/);
 const observed=recheck.indexOf('ReadOriginalNormalSuspendedProcessSource'),claimCurrent=recheck.indexOf('claimCurrent(material)',observed),recorded=recheck.indexOf('ownerTerminal=terminal(material,first.ObservedAt,latest.ObservedAt,localProcessId,localProcessGeneration)',claimCurrent);
 assert.ok(observed>=0&&observed<claimCurrent&&claimCurrent<recorded,'원 process 재관측·claim current 후에만 terminal 기록');
 assert.match(handler,/RecordNormalStartPreparationOwnerTerminal\(exact,first,latest,processId,generation,\(\)=>call\.Now,ready\)/);
 assert.match(handler,/normalStartPreparationProducer\.RecheckOwned\([\s\S]*return claim\.Output/);
 assert.doesNotMatch(handler,/PREPARED|POST|queue/);
 assert.match(spool,/const string NormalPreparationOwnerTerminal="NORMAL_START_PREPARATION_OWNER_TERMINAL_V1"/);
 assert.match(spool,/internal abstract class NormalStartPreparationOwnerTerminalCandidate/);
 assert.match(spool,/internal NormalStartPreparationOwnerTerminalCandidate RecordNormalStartPreparationOwnerTerminal\(/);
 const record=spool.slice(spool.indexOf('internal NormalStartPreparationOwnerTerminalCandidate RecordNormalStartPreparationOwnerTerminal('),spool.indexOf('const string RejectedAvailable='));
 assert.match(record,/firstObservedAt<=observedAt/);assert.match(record,/observedAt<=recordedAt/);assert.match(record,/recordedAt<material\.ExpiresAt/);
 assert.match(record,/kind==NormalPreparationOwnerTerminal&&S\(candidate,"key"\)==claimId\)conflict=true/);
 assert.match(record,/Append\(log,rows,row,\(\)=>\{check\(\);appendStarted=true;\}\)/);
 assert.match(record,/if\(appendStarted\)blocked=true/);
 for(const flag of ['osOwnershipVerified','processCreationAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed'])assert.match(record,new RegExp('"'+flag+'",false'));
 assert.doesNotMatch(record,/PREPARED|POST|queue|sourceRef|file/i);
 assert.match(spool,/if\(k==NormalPreparationOwnerTerminal\)[\s\S]*resultStages\.Add\(claim,3\)/);
 assert.match(spool,/ValidateNormalPreparationOwnerTerminals\(rows\)/);
 const dispose=producer.slice(producer.indexOf('public void Dispose()'));
 assert.match(dispose,/ownerTerminal\.CheckCurrent\(\)/);assert.match(dispose,/ownerTerminal=null/);
});

test('정적: owner terminal은 원 claim 후행이며 claim recordedAt 이후의 비후퇴 관측만 수용한다',()=>{
 const spool=readFileSync(new URL('../../../apps/connector/native/NormalExecutionSpoolProfileSource.cs',import.meta.url),'utf8');
 const validate=spool.slice(spool.indexOf('static void ValidateNormalPreparationOwnerTerminals('),spool.indexOf('// 같은 원 등록/요청의 생성 전 단회 소진이다'));
 assert.match(validate,/var sourceRows=new Dictionary<string,Row>\(\),sourceIndexes=new Dictionary<string,int>\(\);var rejectedClaims=new HashSet<string>\(\)/);
 assert.match(validate,/for\(int i=0;i<rows\.Count;i\+\+\)/);
 assert.match(validate,/sourceIndexes\.Add\(S\(row,"id"\),i\)/);
 assert.match(validate,/sourceIndexes\[claimId\]>=terminalIndex/,'전체 rows 어디에나 claim이 있는 것만으로는 부족');
 assert.match(validate,/DateTime sourceRecordedAt=DesktopTrustKeyHostSource\.Time\(source,"recordedAt"\)/);
 assert.match(validate,/sourceRecordedAt>first\|\|first>observed\|\|observed>recorded\|\|recorded>=expires/);
 assert.match(validate,/rejectedClaims\.Contains\(claimId\)/);
 const record=spool.slice(spool.indexOf('internal NormalStartPreparationOwnerTerminalCandidate RecordNormalStartPreparationOwnerTerminal('),spool.indexOf('const string RejectedAvailable='));
 assert.match(record,/DateTime sourceRecordedAt=DesktopTrustKeyHostSource\.Time\(source,"recordedAt"\)/);
 assert.match(record,/sourceRecordedAt>firstObservedAt/);
 assert.match(record,/foreach\(var candidate in rows\)/,'writer도 원 시간·상호배타를 한 scan으로 검산');
});

test('정적: 정착 terminal objectRef는 같은 private candidate에서 원 refs·세대·기한과 실제 process thread current를 함께 재검산한다',()=>{
 const host=readFileSync(new URL('../../../apps/connector/native/DesktopTrustKeyHostSource.cs',import.meta.url),'utf8');
 const spool=readFileSync(new URL('../../../apps/connector/native/NormalExecutionSpoolProfileSource.cs',import.meta.url),'utf8');
 const candidate=spool.slice(spool.indexOf('internal abstract class NormalStartPreparationOwnerTerminalCandidate'),spool.indexOf('static Row C(Row value)'));
 assert.match(candidate,/internal abstract Row ObjectRef\{get;\}/);
 assert.match(candidate,/internal abstract void CheckCurrent\(NormalStartPreparationClaimMaterial material,string localProcessId,long localProcessGeneration,Action ownerCurrent\)/);
 assert.match(candidate,/objectRef=EvidenceRef\(S\(terminal,"localProcessId"\),terminal\)/,'정착 row에서만 결정적 private fullref를 재구성');
 assert.match(candidate,/internal override Row ObjectRef\{get\{return C\(objectRef\);\}\}/);
 for(const invariant of [
  'J(found["nativeClaimRef"])!=J(material.NativeClaimRef)',
  'J(found["requestRef"])!=J(material.RequestRef)',
  'J(found["imageRef"])!=J(material.ImageRef)',
  'S(found,"localProcessId")!=localProcessId',
  'N(found["localProcessGeneration"])!=localProcessGeneration',
  'DesktopTrustKeyHostSource.Time(found,"expiresAt")!=material.ExpiresAt',
  'S(objectRef,"contentHash")!=H(found)',
 ])assert(candidate.includes(invariant),invariant);
 assert.match(candidate,/ownerCurrent\(\);[\s\S]*Verify\(material,localProcessId,localProcessGeneration\)/);
 const producer=host.slice(host.indexOf('internal abstract class NormalStartPreparationProducer'),host.indexOf('readonly NormalStartPreparationProducer'));
 const recheck=producer.slice(producer.indexOf('internal void RecheckOwned('),producer.indexOf('public void Dispose()'));
 const recorded=recheck.indexOf('ownerTerminal=terminal('),objectRef=recheck.indexOf('ownerTerminal.ObjectRef',recorded),candidateCurrent=recheck.indexOf('ownerTerminal.CheckCurrent(material,localProcessId,localProcessGeneration',objectRef),physical=recheck.indexOf('ReadOriginalNormalSuspendedProcessSource(process',candidateCurrent),finalCurrent=recheck.indexOf('left();',physical);
 assert.ok(recorded>=0&&recorded<objectRef&&objectRef<candidateCurrent&&candidateCurrent<physical&&physical<finalCurrent,'정착 readback 뒤 candidate와 같은 원 process/thread를 응답 전에 재검산');
 assert.match(recheck,/ReceiveRef\(terminalObjectRef,true\)/);
 assert.match(recheck,/ValidProcessObservation\(terminalObservation\)/);assert.match(recheck,/SameProcessObservation\(first,terminalObservation\)/);
 assert.match(recheck,/Object\.ReferenceEquals\(process,originalProcess\)/);assert.match(recheck,/Object\.ReferenceEquals\(processObservation,first\)/);
 assert.doesNotMatch(candidate,/sourceRef|osFenceRef|PREPARED|POST|queue/);
});

test('정착: 원 준비 객체 cleanup 확정은 원 refs 해제 전 별도 spool terminal로 1회 정착한다',()=>{
 const host=readFileSync(new URL('../../../apps/connector/native/DesktopTrustKeyHostSource.cs',import.meta.url),'utf8');
 const spool=readFileSync(new URL('../../../apps/connector/native/NormalExecutionSpoolProfileSource.cs',import.meta.url),'utf8');
 const producer=host.slice(host.indexOf('internal abstract class NormalStartPreparationProducer'),host.indexOf('readonly NormalStartPreparationProducer'));
 const dispose=producer.slice(producer.indexOf('public void Dispose()'));
 assert.match(producer,/NormalStartPreparationOwnerCleanupTerminalCandidate ownerCleanupTerminal/);
 assert.match(producer,/Func<NormalExecutionSpoolProfileSource\.NormalStartPreparationClaimMaterial,NormalExecutionSpoolProfileSource\.NormalStartPreparationOwnerTerminalCandidate,ConfirmedOwnerCleanup,string,long,NormalExecutionSpoolProfileSource\.NormalStartPreparationOwnerCleanupTerminalCandidate> cleanupTerminal/);
 const typed=producer.slice(producer.indexOf('internal sealed class ConfirmedOwnerCleanup'),producer.indexOf('// 동기 local 원 소유'));
 assert.match(typed,/private ConfirmedOwnerCleanup\(/,'외부 spool·다른 caller가 cleanup 확정을 조립하지 못한다');
 assert.match(typed,/internal static ConfirmedOwnerCleanup FromOwner\(NormalStartPreparationProducer owner/);
 for(const member of ['processCleanup','startup','assignment','job'])assert.match(typed,new RegExp('Object\\.ReferenceEquals\\([^,]+,owner\\.'+member+'\\)'));
 for(const source of ['startup.LocalEnvironmentReleased','assignment.LocalBuffersReleased','job.LocalHandleCloseConfirmed'])assert.match(typed,new RegExp(source.replace('.', '\\.')));
 const receipt=dispose.indexOf('processCleanup=OwnershipEvidenceJobFactorySource.ReadOriginalNormalSuspendedProcessCleanupSource(process)');
 const physical=dispose.indexOf('startup.LocalEnvironmentReleased',receipt);
 const evidence=dispose.indexOf('var cleanupEvidence=ConfirmedOwnerCleanup.FromOwner(this,processCleanup,startup,assignment,job)',physical);
 const claim=dispose.indexOf('finalClaimCurrent(material)',evidence);
 const owner=dispose.indexOf('ownerTerminal.CheckCurrent()',claim);
 const recorded=dispose.indexOf('ownerCleanupTerminal=ownerCleanupTerminalRecorder(material,ownerTerminal,cleanupEvidence,localProcessId,localProcessGeneration)',owner);
 const readback=dispose.indexOf('ownerCleanupTerminal.CheckCurrent(material,localProcessId,localProcessGeneration)',recorded);
 const released=dispose.indexOf('job=null',readback);
 assert.ok(receipt>=0&&receipt<physical&&physical<evidence&&evidence<claim&&claim<owner&&owner<recorded&&recorded<readback&&readback<released,'확정 cleanup·원 current 후 정착/readback하고 원 참조를 해제');
 for(const evidence of ['!processCleanup.ProcessExitConfirmed','!processCleanup.ThreadExitConfirmed','!processCleanup.ThreadCloseConfirmed','!processCleanup.ProcessCloseConfirmed','!processCleanup.ImageCloseConfirmed','!startup.LocalEnvironmentReleased','!assignment.LocalBuffersReleased','!job.LocalHandleCloseConfirmed'])assert.ok(dispose.indexOf(evidence,receipt)>=receipt&&dispose.indexOf(evidence,receipt)<recorded,evidence+' 유일 caller의 원 확인이 먼저다');
 assert.match(dispose,/if\(ownerCleanupTerminal==null\)throw Invalid\(\)/);
 assert.doesNotMatch(dispose,/ownerCleanupTerminal=null/,'회수 후에도 durable terminal current reader를 유지');
 const record=spool.slice(spool.indexOf('internal NormalStartPreparationOwnerCleanupTerminalCandidate RecordNormalStartPreparationOwnerCleanupTerminal('),spool.indexOf('const string RejectedAvailable='));
 assert.ok(record.length>0);assert.match(record,/NormalStartPreparationProducer\.ConfirmedOwnerCleanup cleanup/);assert.match(record,/var receipt=cleanup\.Receipt/);
 for(const flag of ['ProcessExitConfirmed','ThreadExitConfirmed','ThreadCloseConfirmed','ProcessCloseConfirmed','ImageCloseConfirmed'])assert.match(record,new RegExp('receipt\\.'+flag));
 for(const field of ['ImageRefJson','RequestRefJson','LocalClaimRefJson','LocalProcessId','LocalProcessGeneration','ExpiresAt'])assert.match(record,new RegExp('receipt\\.'+field));
 for(const flag of ['StartupEnvironmentReleased','AssignmentBuffersReleased','JobHandleCloseConfirmed'])assert.match(record,new RegExp('cleanup\\.'+flag));
 assert.doesNotMatch(record,/NormalProcessCleanupReceipt cleanup/,'spool 공개 경계는 raw receipt를 받지 않는다');
 assert.match(record,/ownerTerminal\.CheckCurrent\(material,localProcessId,localProcessGeneration/);
 assert.match(record,/kind==NormalPreparationOwnerCleanupTerminal&&S\(candidate,"key"\)==claimId\)conflict=true/);
 assert.match(record,/Append\(log,rows,row,\(\)=>\{check\(\);appendStarted=true;\}\)/);
 assert.match(record,/if\(appendStarted\)blocked=true/);
 for(const flag of ['formalExecutionStopConfirmed','sourceWriteFenceIssued','writerReleaseVerified','claimReclaimed','resumeAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed'])assert.match(record,new RegExp('"'+flag+'",false'));
 assert.doesNotMatch(record,/reclaimed_at|STOPPED|PREPARED|POST|queue|sourceRef|osFenceRef/i);
});


test('정적: normal owner 관측은 처음 invocation 시각 대신 마지막 보호 입력 뒤 최종 UTC 검산 시각을 반환한다',()=>{
 const source=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceProcessOwnerSource.cs',import.meta.url),'utf8'),start=source.indexOf('private sealed class NormalProcessOwner:'),normal=source.slice(start),read=normal.slice(normal.indexOf('public NormalProcessOwnerObservation ReadCurrent('),normal.indexOf('public void Dispose()'));
 assert(start>0&&read.length>0);assert.match(read,/new NormalProcessOwnerObservation\(afterInput,observedAt\)/);assert.doesNotMatch(read,/new NormalProcessOwnerObservation\(input\)/);
 const first=read.indexOf('var input=startup.normalWorkerInput.ReadCurrent(cap)'),handle=read.indexOf('var first=OwnershipEvidenceHost.ReadRetainedHandleQuerySource'),thread=read.indexOf('var current=OwnershipEvidenceHost.ReadRetainedThreadQuerySource'),last=read.indexOf('var last=OwnershipEvidenceHost.ReadRetainedHandleQuerySource'),image=read.indexOf('var afterImage=NativeWorkerDeploymentSource.ReadTransferredNormalImage'),after=read.indexOf('var afterInput=startup.normalWorkerInput.ReadCurrent(cap)'),result=read.indexOf('new NormalProcessOwnerObservation(afterInput,observedAt)');
 assert(first>=0&&first<handle&&handle<thread&&thread<last&&last<image&&image<after&&after<result);
 const identity=read.indexOf('if(afterInput.ImageRefJson!=input.ImageRefJson'),sample=read.indexOf('DateTime observedAt=DateTime.UtcNow'),guard=read.indexOf('if(input.ExpiresAt!=expiresAt'),finalBudget=read.indexOf('Budget(observedAt,watch,cap)');
 assert(after<identity&&identity<sample&&sample<guard&&guard<finalBudget&&finalBudget<result,'최종 동일성 검산 뒤 UTC 표본·timeline·같은 stopwatch 예산을 마쳐 반환');
 assert.match(read,/originalObservation\.ObservedAt>result\.ObservedAt/);assert.match(read,/Budget\(observedAt,watch,cap\);var result=new NormalProcessOwnerObservation\(afterInput,observedAt\)/);
 assert.match(read,/if\(observed.Kind!=DateTimeKind.Utc\)throw Unavailable\(\)/);
 for(const value of ['from','expiresAt','input.ExpiresAt','afterInput.ExpiresAt','input.ObservedAt','imageCurrent.ObservedFrom','imageCurrent.ObservedAt','first.ObservedFrom','first.ObservedAt','current.ObservedFrom','current.ObservedAt','last.ObservedFrom','last.ObservedAt','afterImage.ObservedFrom','afterImage.ObservedAt','afterInput.ObservedAt'])assert(read.includes(value),value);
 assert.doesNotMatch(read,/ToString\(|AddSeconds|AddMilliseconds|DateTime\.MaxValue/,'관측 내부 tick과 원 절대기한을 바꾸지 않는다');
 assert.match(normal,/timeoutMs<1\|\|timeoutMs>2000/);assert.match(normal,/watch.ElapsedMilliseconds>=timeoutMs/);assert.match(normal,/now<lastWall\|\|now>=expiresAt\|\|lifetime.Elapsed.TotalMilliseconds>=10000/);
 const observation=source.slice(source.indexOf('internal sealed class NormalProcessOwnerObservation'),source.indexOf('internal sealed class NormalProcessCleanupReceipt'));
 assert.match(observation,/ObservedAt=observedAt/);assert.match(observation,/observedAt.Kind!=DateTimeKind.Utc\|\|observedAt<value.ObservedAt\|\|observedAt>=value.ExpiresAt/);for(const flag of ['OsOwnershipVerified','ProcessCreated','ThreadCreated','ProcessCreationAuthorized','PreparationAuthorized','ExecutionAuthorized','DispatchPerformed'])assert(observation.includes(flag+'{get{return false;}}'),flag);
});

test('소스 조건식 RAM: normal owner 관측의 tick 역행·초 경계·원 만료와 마지막 검산 순서를 검증한다',()=>{
 const source=readFileSync(new URL('../../../apps/connector/native/OwnershipEvidenceProcessOwnerSource.cs',import.meta.url),'utf8'),normal=source.slice(source.indexOf('private sealed class NormalProcessOwner:')),read=normal.slice(normal.indexOf('public NormalProcessOwnerObservation ReadCurrent('),normal.indexOf('public void Dispose()'));
 const match=/if\((input\.ExpiresAt!=expiresAt[\s\S]*?)\)throw Unavailable\(\);/.exec(read);assert(match,'생산 코드의 원 시각 관계 조건식 필요');
 // C# 실행이 아니다. 생산 소스의 숫자 비교식만 JS BigInt(100ns tick)로 평가한다.
 assert.match(read,/Budget\(from,watch,cap\);DateTime observedAt=DateTime.UtcNow/);
 const expression=match[1]!;assert(/^[A-Za-z.\s!=<>&|]+$/.test(expression));
 const invalid=new Function('input','imageCurrent','first','current','last','afterImage','afterInput','from','expiresAt','observedAt','return ('+expression+');') as (...args:any[])=>boolean;
 const base=638000000000000000n,make=()=>({from:base,expiresAt:base+20000000n,observedAt:base+13n,input:{ObservedAt:base+1n,ExpiresAt:base+20000000n},imageCurrent:{ObservedFrom:base+2n,ObservedAt:base+3n},first:{ObservedFrom:base+4n,ObservedAt:base+5n},current:{ObservedFrom:base+6n,ObservedAt:base+7n},last:{ObservedFrom:base+8n,ObservedAt:base+9n},afterImage:{ObservedFrom:base+10n,ObservedAt:base+11n},afterInput:{ObservedAt:base+12n,ExpiresAt:base+20000000n}}),check=(v:ReturnType<typeof make>)=>invalid(v.input,v.imageCurrent,v.first,v.current,v.last,v.afterImage,v.afterInput,v.from,v.expiresAt,v.observedAt);
 assert.equal(check(make()),false);const equal=make();equal.observedAt=base;for(const row of [equal.input,equal.imageCurrent,equal.first,equal.current,equal.last,equal.afterImage,equal.afterInput])for(const key of Object.keys(row))if(key.startsWith('Observed'))(row as any)[key]=base;assert.equal(check(equal),false,'같은 tick은 역행 아님');
 for(const field of ['input.ObservedAt','imageCurrent.ObservedFrom','imageCurrent.ObservedAt','first.ObservedFrom','first.ObservedAt','current.ObservedFrom','current.ObservedAt','last.ObservedFrom','last.ObservedAt','afterImage.ObservedFrom','afterImage.ObservedAt','afterInput.ObservedAt']){const v=make(),[name,key]=field.split('.');(v as any)[name!][key!]=base-1n;assert.equal(check(v),true,field+' 1tick 역행');}
 const before=make();before.observedAt=before.afterInput.ObservedAt=before.expiresAt-1n;assert.equal(check(before),false,'원 만료 1tick 전');before.observedAt=before.expiresAt;assert.equal(check(before),true,'만료 exact 거절');
 const backwards=make();backwards.observedAt=backwards.afterInput.ObservedAt-1n;assert.equal(check(backwards),true,'최종 UTC가 마지막 입력보다 1tick 역행');
 const changed=make();changed.afterInput.ExpiresAt++;assert.equal(check(changed),true,'원 기한 교체 거절');
 const budget=/void Budget\(DateTime from,Stopwatch watch,int timeoutMs\)\{if\(([^]*?)\)throw Unavailable\(\);Remaining\(timeoutMs\);\}/.exec(normal);assert(budget,'원 owner Budget 검사 필요');
 const budgetExpression=budget[1]!.replace('DateTime.UtcNow','now');assert(/^[A-Za-z.\s<>=|]+$/.test(budgetExpression));const late=new Function('now','from','watch','timeoutMs','return ('+budgetExpression+');');
 assert.equal(late(base,base,{ElapsedMilliseconds:1999},2000),false);assert.equal(late(base,base,{ElapsedMilliseconds:2000},2000),true,'2초 exact 거절');assert.equal(late(base,base,{ElapsedMilliseconds:1},1),true,'더 짧은 cap도 연장0');assert.equal(late(base-1n,base,{ElapsedMilliseconds:0},2000),true,'최종 UTC 이후 wall 역행 거절');
 const crossing=make();crossing.from=base+9999999n;crossing.input.ObservedAt=base+9999999n;let n=10000000n;for(const row of [crossing.imageCurrent,crossing.first,crossing.current,crossing.last,crossing.afterImage]){row.ObservedFrom=base+n++;row.ObservedAt=base+n++;}crossing.afterInput.ObservedAt=base+n++;crossing.observedAt=base+n;assert.equal(check(crossing),false,'초 경계에서 truncation으로 역행시키지 않는다');
});
