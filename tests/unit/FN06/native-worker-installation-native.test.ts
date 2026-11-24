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
 assert.ok(body.indexOf('normalStartPreparationProducer==null')<body.indexOf('WithNormalImageForPreparation'));assert.match(body,/NormalStartRequest\(record,window,session,request,wall\(\)\)/);assert.match(body,/ClaimNormalStartPreparation\(record,request,image/);
 assert.match(body,/consumerStarted=false/);assert.match(body,/catch\(NativeWorkerDeploymentSource.NormalImageNotStartedException\)/);assert.match(body,/if\(!consumerStarted\)return/);
 assert.doesNotMatch(body,/ClaimOnce|ReservePreparation|\.Append\(|CreateSuspended|SignNormal|ServerCertificateValidationCallback/);
 const image=read('NativeWorkerDeploymentSource.cs');assert.match(image,/storage.GetType\(\)==typeof\(WindowsNativeWorkerInstallationKernel\)/);assert.match(image,/var value=consume\(result,Bound\);Bound\(\)/);
});
