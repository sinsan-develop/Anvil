import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name:string)=>readFileSync('apps/connector/native/'+name,'utf8');

test('Windows 설치 kernel의 준비 구현은 원 handle·CAS publication·parent 정착을 보유하고 지원 guard를 유지한다',()=>{
 const s=read('NativeWorkerInstallationStoreSource.cs'),start=s.indexOf('internal sealed class WindowsNativeWorkerInstallationKernel'),body=s.slice(start);
 assert.ok(start>=0);assert.match(body,/RequireDurability\(\)\{throw new InvalidOperationException\("NATIVE_WORKER_INSTALLATION_UNSUPPORTED"\)/);
 assert.match(body,/FlushFileBuffers/);assert.match(body,/SetFileInformationByHandle/);assert.match(body,/CloseHandle/);
 assert.match(body,/File\.Replace\(next,target,previous,false\)/);assert.match(body,/File\.Move\(next,target\)/);
 assert.match(body,/RequireCommittedContainer\(/);assert.match(body,/CloseOwnedFile\(/);assert.match(body,/KeepUnknown\(/);
 assert.match(body,/SettleDirectory\(/);assert.match(body,/CreatePrivateFile\(/);assert.match(body,/RequireReservedWorker\(/);
 assert.doesNotMatch(body,/FileOptions\.DeleteOnClose|File\.Delete|Directory\.Delete/);
});

test('Windows 설치 root의 실패한 close는 원 owner를 보존하고 생성한 고정 부모의 정착만 위임한다',()=>{
 const s=read('NativeWorkerInstallationRootSource.cs');
 assert.match(s,/unsettled/);assert.match(s,/if\(!owner\.CleanupSettled\)/);assert.match(s,/SettleCreated\(/);assert.match(s,/WithPinnedMetadata\(/);
 assert.match(s,/CleanupSettled=closed/);assert.doesNotMatch(s,/File\.Delete|Directory\.Delete|Environment\.GetEnvironmentVariable/);
});

test('Windows 설치 준비 source의 실제 메서드 순서는 예약·publication·원 close 전제와 불명 보존을 닫는다',()=>{
 const s=read('NativeWorkerInstallationStoreSource.cs'),base=s.slice(s.indexOf('internal sealed class WindowsNativeWorkerInstallationKernel'));
 const between=(from:string,to:string)=>{const a=base.indexOf(from),b=base.indexOf(to,a+from.length);assert.ok(a>=0&&b>a);return base.slice(a,b);};
 const ordered=(body:string,parts:string[])=>{let at=-1;for(const part of parts){const next=body.indexOf(part,at+1);assert.ok(next>at,part);at=next;}};
 ordered(between('internal override void Acquire()','internal override void Commit('),['RequireDurability()','CreatePrivateFile(','FlushFileBuffers','SettleDirectory(']);
 ordered(between('internal override void Commit(','internal override string CreateWorker('),['RequireLock()','ReadContainer("installations.v1")','Container(cipher)','CreatePrivateFile(next)','WriteAndReadback','CloseOwnedFile(staged)','File.Replace(next,target,previous,false)','SettleDirectory(','committedHash=expectedNext']);
 ordered(between('internal override string CreateWorker(','internal override string VerifyWorker('),['RequireReservedWorker','CreatePrivateExclusive','CreatePrivateFile','WriteAndReadback','CloseOwnedFile(file)','VerifyWorker','return identity']);
 const release=between('internal override void Release()','internal override void Abandon()');
 ordered(release,['RequireCommittedContainer','VerifyWorker','SettleDirectory(root.PathValue)','CloseOwnedFile(lockFile)','lockFile.CloseSettled','SetFileInformationByHandle','CloseOwnedFile(removal)']);
 assert.match(release,/지속 근거는 아직 없다/);assert.match(base,/lock\(unsettled\)\{if\(blockedHost\)throw Invalid\(\);\}/);
 assert.match(base,/cleanupSettled\).*unsettled.Remove\(this\)/);assert.match(base,/if\(disposeAttempted\)/);
 const write=between('void WriteAndReadback(','Dictionary<string,object> Container(');assert.match(write,/WriteFile\(file.Handle/);assert.match(write,/ReadFile\(file.Handle/);assert.doesNotMatch(write,/\.Stream\.Write|\.Stream\.Flush/);
 assert.match(base,/EntryPoint="CreateFileW"/);assert.match(base,/ExactSpelling=true/);assert.match(base,/\(uint\)FileMode.CreateNew/);assert.match(base,/Inherit=0/);
});
test('worker 설치 root는 Trust source와 분리된 KnownFolder sibling 및 원 handle을 사용한다',()=>{const s=read('NativeWorkerInstallationRootSource.cs');assert.match(s,/"Anvil","NativeWorkers","v1"/);assert.doesNotMatch(s,/DesktopTrustKeyRootSource\.Open|Environment\.GetEnvironmentVariable/);assert.match(s,/kernel\.KnownFolder\(\)/);assert.match(s,/kernel\.CurrentSid\(\)/);assert.match(s,/kernel\.Observe/);assert.match(s,/\.Private/);});
test('worker Windows 저장은 내구성 미지원시 첫 mutation 전에 닫고 원장/예약 총량을 검산한다',()=>{const s=read('NativeWorkerInstallationStoreSource.cs');assert.match(s,/NATIVE_WORKER_INSTALLATION_UNSUPPORTED/);assert.match(s,/8388608/);assert.match(s,/1073741824/);assert.match(s,/20971520/);assert.match(s,/512/);assert.match(s,/64/);assert.match(s,/DataProtectionScope\.CurrentUser/);assert.match(s,/Anvil\.NativeWorkers\.Installation\.v1/);assert.match(s,/FileMode\.CreateNew/);assert.match(s,/Links!=1/);assert.doesNotMatch(s,/File\.Delete|Directory\.Delete/);});
test('native worker deployment는 원 설치와 온라인 관측 없이 provenance를 발급하지 않는다',()=>{const s=read('NativeWorkerDeploymentSource.cs');assert.match(s,/NativePreparationWorkerProvenanceSource\.ProtectedDeployment/);assert.match(s,/ReadPackagedWorker/);assert.match(s,/originals/);assert.match(s,/REVOKED|ACTIVE/);assert.match(s,/1000/);assert.match(s,/SYSTEM_CHAIN_AND_HOSTNAME|Tls12/);});

test('native source 정적: root 생성 경합 및 packages 중간 부모·예상 밖 잔여를 닫는다',()=>{
 const root=read('NativeWorkerInstallationRootSource.cs');
 assert.match(root,/cursor==location&&missing&&f!=null&&f.Exists\)throw Invalid\(\)/);
 assert.match(root,/CreatePrivateExclusive\(cursor,sid\)[\s\S]*owner.Created=true/);
 const store=read('NativeWorkerInstallationStoreSource.cs');
 assert.match(store,/void RetainDirectory\(string path\)/);
 assert.match(store,/RetainDirectory\(packages\)/);
 assert.match(store,/RetainDirectory\(directory\)/);
 assert.match(store,/roots.Observe\(item.Item1\)/);
 assert.match(store,/roots.Inspect\(item.Item2.Path\)/);
 assert.match(store,/ValidateRootEntries\(\)/);
 assert.match(store,/Directory.GetFileSystemEntries\(directory\)/);
 assert.match(store,/entries.Length!=1/);
 assert.match(store,/state.*RESERVED/);
});

test('native source 정적: 원 REGISTERED binding에서 typed INSTALL_WORKER와 provenance 소비를 조립한다',()=>{
 const host=read('DesktopTrustKeyHostSource.cs');assert.match(host,/operation=="INSTALL_WORKER"/);assert.match(host,/new NativeWorkerDeploymentSource/);assert.match(host,/WorkerRecord\(\)/);assert.match(host,/workerDeployment.Install/);assert.match(host,/peer.HelperHash;},workerDeployment/);
 const deployment=read('NativeWorkerDeploymentSource.cs');assert.doesNotMatch(deployment,/ServerCertificateValidationCallback|ServicePointManager/);assert.match(deployment,/storage.RequireDurability\(\);/);assert.match(deployment,/request.Abort\(\)/);assert.match(deployment,/originals.TryGetValue/);
});

test('native 관측 source 정적: 요청 1초 closure가 원 worker 읽기와 첫 저장까지 이어진다',()=>{const s=read('NativeWorkerDeploymentSource.cs');assert.match(s,/sealed class Observation/);assert.match(s,/new NativeWorkerInstallationStoreSource\(storage,Bound\)/);assert.match(s,/ReadPackagedWorker\(V.Text\(d,"workerHash"\),Bound\)/);assert.match(s,/observed.Check\(\);[\s\S]*store.Install/);assert.match(s,/activeObservation=null/);});

test('normal image 결박은 기존 설치 행과 분리되고 원 등록 host에서만 생성·정확 재조회된다',()=>{
 const s=read('NativeWorkerInstallationStoreSource.cs'),d=read('NativeWorkerDeploymentSource.cs'),h=read('DesktopTrustKeyHostSource.cs');
 assert.match(s,/NORMAL_START_WORKER_INSTALLATION_BINDING_V1/);assert.match(s,/InstallNormal\(/);assert.match(s,/ReadNormalBinding\(/);assert.match(s,/matches.Length!=1/);
 assert.match(s,/registrationAttemptId/);assert.match(s,/registrationRootIdentity/);assert.match(s,/registrationRecordHash/);assert.match(s,/rows.Length\+needed>512/);
 assert.match(d,/InstallNormal\(/);assert.match(d,/ReadNormalImage\(/);assert.match(h,/INSTALL_NORMAL_START_WORKER_V1/);assert.match(h,/READ_NORMAL_START_WORKER_IMAGE_V1/);
 assert.match(h,/NormalWorkerScope\(/);assert.match(h,/root.Identity/);assert.match(d,/NATIVE_WORKER_INSTALLATION_UNSUPPORTED|storage.RequireDurability/);
});

test('명시 normal 설치는 기존 INSTALLED를 바꾸지 않고 새 검산 결박만 CAS 안에 한 번 정착한다',()=>{
 const s=read('NativeWorkerInstallationStoreSource.cs'),d=read('NativeWorkerDeploymentSource.cs');
 const start=s.indexOf('Dictionary<string,object> BindExisting('),end=s.indexOf('static Dictionary<string,object> Result(',start);assert.ok(start>=0&&end>start);const body=s.slice(start,end);
 assert.match(body,/existing.Length>1/);assert.match(body,/existing.Length==1/);assert.match(body,/installationRef.*RowRef\(installed\)/);assert.match(body,/rows.Length\+1>512/);assert.match(body,/future>MetadataMaximum/);
 assert.ok(body.indexOf('future>MetadataMaximum')<body.indexOf('io.Acquire()'));assert.match(body,/io.Acquire\(\);[\s\S]*V.Same\(before,locked\)/);assert.match(body,/io.VerifyWorker[\s\S]*Append\(locked,binding\)[\s\S]*io.Release\(\)/);
 assert.doesNotMatch(body,/CreateWorker|\["state"\]\s*=/);assert.match(body,/unknown=true;io.Abandon\(\)/);
 const core=s.slice(s.indexOf('Dictionary<string,object> InstallCore('),s.indexOf('static void ValidateScope('));assert.match(core,/ownerBindings.Length>1/);assert.match(core,/ownerBindings\[0\]\["factoryRef"\]/);assert.ok(core.indexOf('ownerBindings.Length>1')<core.indexOf('io.Acquire()'));assert.match(s,/NATIVE_WORKER_INSTALLATION"&&V.Same\(r\["factoryRef"\]/);
 const normal=d.slice(d.indexOf('internal Dictionary<string,object> InstallNormal('),d.indexOf('internal Dictionary<string,object> ReadNormalImage('));assert.match(normal,/Parent\(bundle\)[\s\S]*ReadPackagedWorker[\s\S]*store.InstallNormal/);
});

test('native 원 pinned peer 입력은 동일 등록을 검산하고 physical producer 부재에서 claim/image/OS0이다',()=>{
 const h=read('DesktopTrustKeyHostSource.cs'),start=h.indexOf('if(operation=="CLAIM_NORMAL_START_PREPARATION_REQUEST_V1")'),end=h.indexOf('if(operation=="SIGN_NORMAL_START_PREPARATION_RESULT_V1")',start);assert(start>=0&&end>start);const body=h.slice(start,end);
 assert.match(body,/attemptId,window,session,request,contextEpoch/);assert.match(body,/NormalRecord\(\)/);assert.match(body,/SOURCE_UNAVAILABLE/);
 assert.ok(body.indexOf('normalStartPreparationProducer==null')<body.indexOf('AcquireNormalImageForPreparation'));assert.match(body,/NormalStartRequest\(record,window,session,request,budget\.Now\)/);assert.match(body,/ClaimNormalStartPreparation\(record,request,image/);
 assert.match(body,/consumerStarted=false/);assert.match(body,/catch\(NativeWorkerDeploymentSource.NormalImageNotStartedException\)/);assert.match(body,/if\(!consumerStarted\)return/);
 assert.doesNotMatch(body,/ClaimOnce|ReservePreparation|\.Append\(|SignNormal|ServerCertificateValidationCallback/);
 const image=read('NativeWorkerDeploymentSource.cs');assert.match(image,/storage.GetType\(\)==typeof\(WindowsNativeWorkerInstallationKernel\)/);assert.match(image,/var value=consume\(result,Bound\);Bound\(\)/);
});

test('normal 설치 원행은 path나 bytes를 노출하지 않는 단회 retained image owner로 전달된다',()=>{
 const store=read('NativeWorkerInstallationStoreSource.cs'),deployment=read('NativeWorkerDeploymentSource.cs');
 assert.match(store,/internal sealed class NormalInstalledImageSource/);assert.match(store,/private readonly string directory/);assert.match(store,/internal NormalInstalledImageSource ReadNormalInstalledImageSource\(/);
 assert.match(store,/V\.Canonical\(NormalBindingRef\(binding\),0\)/);assert.match(store,/V\.Text\(installed,"workerHash"\)/);assert.match(store,/V\.Text\(installed,"fileIdentity"\)/);assert.match(store,/io\.RootIdentity/);assert.match(store,/io\.WorkerDirectoryIdentity\(/);
 assert.match(store,/OwnershipEvidenceImageOwnerSource\.OpenNormalSourceOnly\(directory/);assert.doesNotMatch(store,/internal string (?:Path|Directory)\{get/);
 assert.match(deployment,/internal sealed class NormalRetainedImageSource/);assert.match(deployment,/internal NormalRetainedImageSource AcquireNormalImageForPreparation\(/);assert.match(deployment,/ReadNormalInstalledImageSource\(scope\)/);
 const acquire=deployment.slice(deployment.indexOf('internal NormalRetainedImageSource AcquireNormalImageForPreparation('));assert.ok(acquire.indexOf('storage.RequireDurability()')<acquire.indexOf('OpenRetainedImageSource('));assert.match(acquire,/ReadPackagedWorker\(V\.Text\(binding,"workerHash"\),Bound\)/);
 assert.match(deployment,/internal OwnershipEvidenceImageOwnerSource\.INormalRetainedImageCandidate TransferToFactory\(/);assert.match(deployment,/ReadCurrent\(timeoutMs\)[\s\S]*TransferNormalImage\(this,source,image\)[\s\S]*image=null;transferred=true/);
 assert.match(deployment,/private sealed class NormalTransferredImageSource:OwnershipEvidenceImageOwnerSource\.INormalRetainedImageCandidate/);assert.match(deployment,/readonly Observation original/);assert.match(deployment,/ReferenceEquals\(activeObservation,original\)/);assert.match(deployment,/source\.CheckCurrent\(\)[\s\S]*ReadOriginalNormalSource\(image,timeoutMs\)[\s\S]*source\.CheckCurrent\(\)/);
 assert.match(deployment,/ReadTransferredNormalImage\(OwnershipEvidenceImageOwnerSource\.INormalRetainedImageCandidate candidate/);assert.match(deployment,/candidate as NormalTransferredImageSource/);
 assert.doesNotMatch(deployment,/public .*Path|public .*Handle|public byte\[\]/);
});

test('normal retained image current는 namespace와 descriptor directory를 구분해 hash·fileId·1초를 대조한다',()=>{
 const binding=read('OwnershipEvidenceImageBindingSource.cs'),owner=read('OwnershipEvidenceImageOwnerSource.cs'),deployment=read('NativeWorkerDeploymentSource.cs');
 assert.match(binding,/ReadNormalInstalledSource\(/);assert.match(binding,/timeoutMs<1\|\|timeoutMs>1000/);assert.match(binding,/bytes\.ContentHash!=workerHash/);assert.match(binding,/SameNativeIdentity\(fileIdentity,bytes\.FileIdentityHint\)/);assert.match(binding,/SameNativeIdentity\(directoryIdentity,first\.RootIdentityHint\)/);
 assert.doesNotMatch(binding,/first\.RootIdentityHint!=namespaceRootIdentity/);
 assert.match(binding,/NumberStyles\.None,CultureInfo\.InvariantCulture/);assert.match(binding,/decimalCanonical!=installed/);assert.match(binding,/ToString\("x8",CultureInfo\.InvariantCulture\)/);assert.match(binding,/\[0-9a-f\]\{8\}:\[0-9a-f\]\{16\}/);
 assert.match(owner,/internal interface INormalRetainedImageCandidate:IDisposable/);assert.match(owner,/internal static INormalRetainedImageCandidate OpenNormalSourceOnly\(/);assert.match(owner,/internal static NormalImageObservation ReadOriginalNormalSource\(/);
 const normal=owner.slice(owner.indexOf('internal sealed class NormalImageObservation'));assert.doesNotMatch(normal,/WorkerInputCandidate|permit|authority|RESERVED/);
 for(const flag of ['OsOwnershipVerified','PreparationAuthorized','ExecutionAuthorized','DispatchPerformed'])assert.match(normal,new RegExp(flag+'\\{get\\{return false;\\}\\}'));
 assert.match(owner,/NamespaceRootIdentity=namespaceRootIdentity/);assert.match(owner,/DirectoryIdentity=directoryIdentity/);assert.match(owner,/original\.ReadNormal\(workerHash,directoryIdentity,fileIdentity,timeoutMs\)/);
 assert.match(owner,/age\.ElapsedMilliseconds>=10000/);assert.match(owner,/timeoutMs<1\|\|timeoutMs>1000/);
 const normalOwner=owner.slice(owner.indexOf('private sealed class NormalImageOwner:'),owner.indexOf('internal static NormalImageObservation ReadOriginalNormalSource'));
 assert.match(normalOwner,/bool disposed,closeAttempted,cleanupUnknown/);assert.match(normalOwner,/if\(closeAttempted\|\|cleanupUnknown\)throw Unavailable\(\)/);assert.match(normalOwner,/closeAttempted=true;try\{original\.Dispose\(\);disposed=true;\}catch\{cleanupUnknown=true;throw Unavailable\(\);\}/);assert.match(owner,/NativeCloseVerified\{get\{return false;\}\}/);
 const retained=deployment.slice(deployment.indexOf('internal sealed class NormalRetainedImageSource'),deployment.indexOf('void Live('));assert.equal((retained.match(/closeAttempted=true;try\{image\.Dispose\(\);image=null;/g)||[]).length,2);assert.equal((retained.match(/catch\{cleanupUnknown=true;throw;\}/g)||[]).length,2);assert.ok(retained.indexOf('owner.ReleaseNormalImage(this)')>retained.indexOf('image.Dispose()'));assert.ok(retained.indexOf('owner.ReleaseTransferredNormalImage(this,original)')>retained.lastIndexOf('image.Dispose()'));
 assert.equal((retained.match(/source\.ReleaseAfterClose\(\)/g)||[]).length,2);assert.match(retained,/internal NormalTransferredImageSource\(/);
 const installed=read('NativeWorkerInstallationStoreSource.cs'),normalSource=installed.slice(installed.indexOf('internal sealed class NormalInstalledImageSource'),installed.indexOf('static Exception Invalid()'));
 assert.match(installed,/NormalInstalledImageSource normalImageSource/);assert.match(normalSource,/INormalRetainedImageCandidate unresolvedImage/);assert.match(normalSource,/opened=true/);assert.match(normalSource,/catch\{unresolvedImage=result;throw;\}/);assert.match(installed,/if\(normalImageSource!=null\)throw Invalid\(\)/);assert.match(installed,/Check\(\);normalImageSource=null/);assert.doesNotMatch(owner.slice(owner.indexOf('internal static INormalRetainedImageCandidate OpenNormalSourceOnly(')),/owned\.ReadCurrent/);
});

test('normal durable FIRST readback만 비직렬 단회 capability를 발급하고 replay와 UNKNOWN은 조립 권위를 얻지 않는다',()=>{
 const spool=read('NormalExecutionSpoolProfileSource.cs'),host=read('DesktopTrustKeyHostSource.cs'),peer=read('DesktopTrustKeyPeerSource.cs');
 const begin=spool.indexOf('internal NormalStartPreparationClaimCommit ClaimNormalStartPreparation('),claim=spool.slice(begin,spool.indexOf('static Row EvidenceRef(',begin));
 assert(begin>0&&claim.length>0);assert.match(spool,/internal abstract class NormalStartPreparationClaimCapability/);assert.match(spool,/private sealed class DurableNormalStartPreparationClaimCapability/);assert.match(spool,/var exact=this as DurableNormalStartPreparationClaimCapability/);assert.match(spool,/lock\(gate\)\{if\(consumed\)throw Invalid\(\);consumed=true;\}/);assert.match(spool,/internal sealed class NormalStartPreparationClaimCommit/);
 assert.match(claim,/var back=Log\(false/);assert.ok(claim.indexOf('var back=Log(false')<claim.indexOf('new DurableNormalStartPreparationClaimCapability'));
 assert.match(claim,/first\?new DurableNormalStartPreparationClaimCapability/);assert.match(claim,/new NormalStartPreparationClaimCommit\(output,capability\)/);
 assert.match(claim,/catch\(SpoolCapacityException\)[\s\S]*NormalStartPreparationClaimCommit\.Unavailable/);assert.doesNotMatch(claim,/CreateEmptyJobSource|PrepareAtomicJobAssignmentSource|CreateNormalSuspendedProcessSource/);
 const branch=host.slice(host.indexOf('if(operation=="CLAIM_NORMAL_START_PREPARATION_REQUEST_V1")'),host.indexOf('if(operation=="SIGN_NORMAL_START_PREPARATION_RESULT_V1")'));
 assert.match(branch,/var claim=spoolProfile\.ClaimNormalStartPreparation/);assert.match(branch,/if\(claim\.Capability==null\)return claim\.Output/);
 assert.ok(branch.indexOf('ClaimNormalStartPreparation')<branch.indexOf('normalStartPreparationProducer.CreateOwned'));
 assert.match(branch,/catch\{unknown=true;throw;\}/);assert.doesNotMatch(branch,/PREPARED|queue|executionAuthorized",true|dispatchPerformed",true/);
 assert.match(peer,/internal DesktopTrustKeyBudget Slice\(DateTime end,int suppliedRemaining\)/);assert.match(peer,/DesktopTrustKeyBudget\(DesktopTrustKeyBudget parent\)[^{]*\{[^}]*deadline=parent\.deadline/);assert.match(peer,/new DesktopTrustKeyBudget\(this\)/);assert.doesNotMatch(peer.slice(peer.indexOf('internal DesktopTrustKeyBudget Slice'),peer.indexOf('// Check가 검산한')),/new DesktopTrustKeyBudget\(wall,mono\)/);
 assert.match(branch,/var call=budget\.Slice\(end,2000\)/);assert.doesNotMatch(branch,/budget\.Tighten\(end,2000\)/);assert.match(branch,/normalStartResultSource==null/);
 const resultBranch=host.slice(host.indexOf('if(operation=="SIGN_NORMAL_START_PREPARATION_RESULT_V1")'),host.indexOf('if(operation=="SIGN_NATIVE_FIRST_RECEIVE_PROOF")'));
 assert.match(resultBranch,/var call=budget\.Slice\([^;]+,2000\)/);assert.doesNotMatch(resultBranch,/budget\.Tighten\(/);assert.match(resultBranch,/call\.Remaining\(\)/);
});

test('retained image lease는 claim metadata와 opaque owner를 같은 관측에서 결박하고 path·bytes를 노출하지 않는다',()=>{
 const deployment=read('NativeWorkerDeploymentSource.cs'),lease=deployment.slice(deployment.indexOf('internal sealed class NormalRetainedImageSource'),deployment.indexOf('private sealed class NormalTransferredImageSource'));
 assert.match(lease,/readonly Dictionary<string,object> claimImage/);assert.match(lease,/internal Dictionary<string,object> ReadClaimImage\(int timeoutMs=1000\)/);
 assert.match(lease,/ReadCurrent\(timeoutMs\)[\s\S]*associationRef[\s\S]*Clone\(claimImage\)[\s\S]*ReadCurrent\(timeoutMs\)/);
 const acquire=deployment.slice(deployment.indexOf('internal NormalRetainedImageSource AcquireNormalImageForPreparation('));
 assert.match(acquire,/var result=new Dictionary<string,object>\{\{"state","NORMAL_START_WORKER_IMAGE_VERIFIED"\}/);assert.match(acquire,/new NormalRetainedImageSource\(this,installedSource,retained,result\)/);
 assert.doesNotMatch(lease,/Path|Handle|byte\[\]/);
});
