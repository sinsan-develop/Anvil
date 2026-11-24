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

test('native source 정적: 정착 관리 exact six는 기존 REGISTERED root에서 disabled deployment gate로만 이어진다',()=>{
 const host=read('DesktopTrustKeyHostSource.cs'),deployment=read('NativeWorkerDeploymentSource.cs');
 assert.match(host,/READ_WORKER_INSTALLATION_SETTLEMENT_V1/);assert.match(host,/offerRef,commandId,commandHash,factoryRef,registrationAttemptId,registrationRecordHash/);assert.match(host,/WorkerRecord\(\)/);assert.match(host,/workerDeployment\.ReadManagementSettlement/);
 const start=deployment.indexOf('ReadManagementSettlement('),body=deployment.slice(start,deployment.indexOf('// 새 목적 설치',start));assert.ok(start>=0&&body.length>0);assert.match(body,/storage\.RequireDurability\(\)/);assert.doesNotMatch(body,/Install\(|InstallNormal\(|ReadNormalImage\(/);
});

test('native source 정적: 관리 read는 writer와 같은 canonical selection으로 existing-only marker를 검산한 뒤 close 성공에서만 projection을 낸다',()=>{
 const host=read('DesktopTrustKeyHostSource.cs'),deployment=read('NativeWorkerDeploymentSource.cs'),store=read('NativeWorkerInstallationStoreSource.cs'),root=read('NativeWorkerInstallationRootSource.cs');
 const helper=host.slice(host.indexOf('Dictionary<string,object> ManagementSelection('),host.indexOf('object Dispatch('));assert.match(helper,/NATIVE_WORKER_INSTALLATION_MANAGEMENT_SELECTION_V1/);assert.match(helper,/registrationRootIdentity.*root\.Identity/);assert.match(helper,/registrationRecordHash/);
 const managed=host.slice(host.indexOf('if(operation=="INSTALL_WORKER_MANAGEMENT_V1")'),host.indexOf('if(operation=="READ_WORKER_INSTALLATION_SETTLEMENT_V1")'));
 const reader=host.slice(host.indexOf('if(operation=="READ_WORKER_INSTALLATION_SETTLEMENT_V1")'),host.indexOf('if(operation=="INSTALL_NORMAL_START_WORKER_V1"'));
 assert.match(managed,/ManagementSelection\(record,supplied\)/);assert.match(reader,/ManagementSelection\(record,request\)/);assert.match(reader,/workerDeployment\.ReadManagementSettlement\(selection\)/);
 const path=deployment.slice(deployment.indexOf('ReadManagementSettlement('),deployment.indexOf('// 새 목적 설치'));
 let at=-1;for(const token of ['storage.RequireDurability()','store.ReadManagementSettlement(selection)']){const next=path.indexOf(token,at+1);assert.ok(next>at,token);at=next;}
 const readPath=store.slice(store.indexOf('internal Dictionary<string,object> ReadManagementSettlement('),store.indexOf('internal Dictionary<string,object> InstallManagement('));
 at=-1;for(const token of ['ValidateManagementSelection(selection)','io.RequireDurability()','io.OpenManagementSettlementRead()','Read()','ValidateSettlementCatalogue(marker,container)','io.ReleaseManagementSettlementRead(marker)']){const next=readPath.indexOf(token,at+1);assert.ok(next>at,token);at=next;}
 assert.match(readPath,/ARTIFACT_SETTLED_CURRENTLY_VERIFIED/);assert.match(readPath,/NO_MATCHING_SETTLEMENT/);assert.match(store,/SettlementProjection[\s\S]*"pastRequest","UNKNOWN"/);assert.doesNotMatch(readPath,/CreateWorker|Commit\(|Acquire\(|AppendManagementSettlement|ReleaseManagementSettlement\(\)/);
 assert.match(readPath,/!V\.Same\(row\["factoryRef"\],factory\)/);assert.doesNotMatch(readPath,/registrationRootIdentity"\)!=rootIdentity|foreach\(var candidate[\s\S]*VerifyWorker/);const catalogue=store.slice(store.indexOf('ValidateSettlementCatalogue('),store.indexOf('internal Dictionary<string,object> ReadManagementSettlement('));assert.match(catalogue,/allReserved\.Length!=allInstalled\.Length/);assert.match(catalogue,/allInstalled\.Length!=workerCount[\s\S]*totalWorkerBytes>WorkerMaximum/);
 const kernel=store.slice(store.indexOf('internal sealed class WindowsNativeWorkerInstallationKernel'));
 const open=kernel.slice(kernel.indexOf('OpenManagementSettlementRead('),kernel.indexOf('ReleaseManagementSettlementRead(')),openFile=kernel.slice(kernel.indexOf('OpenManagementReadFile('),kernel.indexOf('OpenManagementWriteFile('));assert.match(open,/RequireDurability\(\)/);assert.match(open,/NativeWorkerInstallationRootSource\.OpenExisting/);assert.match(openFile,/CreateFileW\([^\n]+0x80000000,0,/);assert.match(openFile,/0x00200080/);assert.match(kernel.slice(kernel.indexOf('byte[] ReadManagementBytes('),kernel.indexOf('Dictionary<string,object> Container(')),/ReadFile\(lockFile\.Handle/);assert.doesNotMatch(open+openFile,/CreatePrivateFile|FileMode\.Create|WriteFile|File\.Delete|SetFileInformationByHandle/);
 const close=kernel.slice(kernel.indexOf('ReleaseManagementSettlementRead('),kernel.indexOf('BeginManagementSettlement('));assert.match(close,/ReadManagementBytes/);assert.match(close,/CloseOwnedFile\(lockFile\)/);assert.doesNotMatch(close,/File\.Delete|SetFileInformationByHandle|CreateFileW/);
 const absence=root.slice(root.indexOf('static void RequireExactAbsence('),root.indexOf('static void VerifyExistingAndAbsent('));assert.match(absence,/File\.GetAttributes\(path\)/);assert.match(absence,/catch\(FileNotFoundException\)/);assert.match(absence,/catch\(DirectoryNotFoundException\)/);assert.match(absence,/catch\{throw Invalid\(\);\}/);assert.doesNotMatch(absence,/Directory\.Exists|File\.Exists/);
 assert.match(root,/sealed class MissingExistingRootException/);const existingRoot=root.slice(root.indexOf('OpenExisting('),root.indexOf('// 원 고정 namespace'));assert.match(existingRoot,/lock\(unsettled\)\{if\(blockedHost\)throw Invalid\(\);\}/);assert.match(existingRoot,/new\[\]\{"Anvil","NativeWorkers","v1"\}/);assert.match(existingRoot,/fact\.Link\|\|fact\.Owner!=sid\|\|!fact\.Private\|\|fact\.Path!=paths\[i\]/);assert.match(existingRoot,/facts\[facts\.Count-1\]/);assert.equal((existingRoot.match(/VerifyExistingAndAbsent\(/g)||[]).length,2);assert.match(existingRoot,/kernel\.Close\(handle\)[\s\S]*if\(!closed\)throw Invalid\(\)/);assert.match(existingRoot,/MissingExistingRootException/);assert.doesNotMatch(existingRoot,/CreatePrivateExclusive/);
});

test('native source 정적: 관리 설치는 legacy exact2와 분리해 원 request와 root-bound selection을 store guard까지 전달한다',()=>{
 const host=read('DesktopTrustKeyHostSource.cs'),deployment=read('NativeWorkerDeploymentSource.cs'),store=read('NativeWorkerInstallationStoreSource.cs');
 const legacy=host.slice(host.indexOf('if(operation=="INSTALL_WORKER")'),host.indexOf('if(operation=="INSTALL_WORKER_MANAGEMENT_V1")'));
 assert.match(legacy,/Exact\(value,"attemptId,request"\)/);assert.match(legacy,/workerDeployment\.Install\(request\)/);
 const managed=host.slice(host.indexOf('if(operation=="INSTALL_WORKER_MANAGEMENT_V1")'),host.indexOf('if(operation=="READ_WORKER_INSTALLATION_SETTLEMENT_V1")'));
 assert.match(managed,/Exact\(value,"attemptId,installRequestId,selection,request"\)/);assert.match(managed,/ManagementSelection\(record,supplied\)/);assert.match(host,/NATIVE_WORKER_INSTALLATION_MANAGEMENT_SELECTION_V1/);assert.match(host,/registrationRootIdentity.*root\.Identity/);assert.match(managed,/managementSelectionHash/);assert.match(managed,/workerDeployment\.InstallManagement/);
 const path=deployment.slice(deployment.indexOf('InstallManagement('),deployment.indexOf('ReadManagementSettlement('));assert.match(path,/store\.ValidateManagementInstall\(binding,factory\)/);assert.match(path,/store\.InstallManagement\(bundle,V\.Map\(observed\.Value\["head"\]\),worker,DateTime\.UtcNow,binding,factory\)/);
 const admission=store.slice(store.indexOf('ValidateManagementInstall('),store.indexOf('internal Dictionary<string,object> Install('));assert.match(admission,/managementSelectionHash/);assert.match(admission,/installRequestId/);assert.match(admission,/V\.Same\(selectedFactory,factory\)/);assert.ok(admission.indexOf('ValidateManagementInstall(binding,factory)')<admission.indexOf('InstallCore('));
});

test('native source 정적: 관리 설치는 지원 guard 뒤 실제 관측·worker 검산과 동일 InstallCore에만 연결된다',()=>{
 const deployment=read('NativeWorkerDeploymentSource.cs'),store=read('NativeWorkerInstallationStoreSource.cs');
 const path=deployment.slice(deployment.indexOf('InstallManagement('),deployment.indexOf('ReadManagementSettlement('));
 let at=-1;for(const token of ['ValidateManagementInstall(binding,factory)','storage.RequireDurability()','Observe(factory)','ReadPackagedWorker(','store.InstallManagement(']){const next=path.indexOf(token,at+1);assert.ok(next>at,token);at=next;}
 assert.doesNotMatch(path.slice(0,path.indexOf('storage.RequireDurability()')),/Observe\(|ReadPackagedWorker|File\.|Directory\.|Open\(/);
 assert.match(path,/activeObservation=observed/);assert.match(path,/finally\{activeObservation=null;if\(worker!=null\)Array\.Clear/);
 const managed=store.slice(store.indexOf('internal Dictionary<string,object> InstallManagement('),store.indexOf('internal Dictionary<string,object> Install('));
 assert.match(managed,/ValidateManagementInstall\(binding,factory\)/);assert.match(managed,/InstallCore\(bundle,head,worker,now,null,binding\)/);
});

test('native source 정적: management lock은 같은 owned handle에 ACTIVE와 final을 남기고 legacy delete 경로와 분리된다',()=>{
 const store=read('NativeWorkerInstallationStoreSource.cs');
 assert.match(store,/BeginManagementSettlement\(/);assert.match(store,/AppendManagementSettlement\(/);assert.match(store,/ReleaseManagementSettlement\(/);
 const core=store.slice(store.indexOf('Dictionary<string,object> InstallCore('),store.indexOf('static void ValidateScope('));
 let at=-1;for(const token of ['old=Find(','if(old!=null)','BeginManagementSettlement(','CheckManagementBase(baseHash)','"state","ACTIVE"','AppendManagementSettlement(','Append(before,r)','r["state"]="INSTALLED"','settled["state"]="INSTALLATION_SETTLED"','ReleaseManagementSettlement(']){const next=core.indexOf(token,at+1);assert.ok(next>at,token);at=next;}
 assert.doesNotMatch(core.slice(core.indexOf('if(old!=null)'),core.indexOf('var rows=')),/management/);assert.match(core,/"managementSelectionHash",V\.Text\(management,"managementSelectionHash"\)/);assert.match(core,/new Dictionary<string,object>\(active\)/);assert.doesNotMatch(core,/settled\["managementSelectionHash"\]\s*=/);assert.match(core,/baseContainerHash/);assert.match(core,/installedContainerHash/);assert.match(core,/workerDirectoryIdentity/);assert.match(core,/ManagementHeaderMaximum\+2L\*NativeWorkerInstallationKernel\.ManagementFrameMaximum/);
 const kernel=store.slice(store.indexOf('internal sealed class WindowsNativeWorkerInstallationKernel'));
 const begin=kernel.slice(kernel.indexOf('BeginManagementSettlement('),kernel.indexOf('AppendManagementSettlement('));
 assert.match(begin,/ManagementHeaderMaximum\+2\*ManagementFrameMaximum/);assert.match(begin,/CreatePrivateFile\(Name\("installations\.v1\.lock"\)\)/);assert.match(begin,/WriteAndReadback\(lockFile,ManagementHeader\)/);assert.match(begin,/CheckManagementBase[\s\S]*ReadContainer\("installations\.v1"\)[\s\S]*ReadContainer\("installations\.v1\.previous"\)/);assert.doesNotMatch(begin,/File\.Delete|SetFileInformationByHandle/);
 const append=kernel.slice(kernel.indexOf('AppendManagementSettlement('),kernel.indexOf('ReleaseManagementSettlement('));
 assert.match(append,/AppendManagementFrame/);const sameHandle=kernel.slice(kernel.indexOf('void AppendManagementFrame('),kernel.indexOf('Dictionary<string,object> Container('));assert.match(sameHandle,/WriteFile\(lockFile\.Handle/);assert.match(sameHandle,/ReadFile\(lockFile\.Handle/);assert.doesNotMatch(sameHandle,/ReadPath\(/);
 const metadata=kernel.slice(kernel.indexOf('internal override long MetadataBytes()'),kernel.indexOf('IEnumerable<string> Workers()'));assert.match(metadata,/name=="installations\.v1\.lock"[\s\S]*Identity\(held\)!=lockFile\.Identity[\s\S]*held\.Length/);
 const release=kernel.slice(kernel.indexOf('ReleaseManagementSettlement('),kernel.indexOf('internal override void Release()'));
 assert.match(release,/VerifyWorker[\s\S]*RequireLock\(\)[\s\S]*CloseOwnedFile\(lockFile\)/);const afterClose=release.slice(release.indexOf('CloseOwnedFile(lockFile)'));assert.doesNotMatch(afterClose,/VerifyWorker|ReadContainer|FileInfo|Shape\(/);assert.doesNotMatch(release,/SetFileInformationByHandle|File\.Delete/);
 assert.match(kernel,/internal override void Release\([\s\S]*SetFileInformationByHandle/);
});

test('native source 정적: 완결 marker 반복 설치는 같은 share-0 holder에서 prefix chain을 검산하고 새 pair만 append한다',()=>{
 const store=read('NativeWorkerInstallationStoreSource.cs'),core=store.slice(store.indexOf('Dictionary<string,object> InstallCore('),store.indexOf('static void ValidateScope('));
 let at=-1;for(const token of ['OpenManagementSettlementForInstall(','Read()','ValidateSettlementCatalogue(','old=Find(','ReleaseManagementSettlementUnchanged(','BeginManagementSettlement(','AppendManagementSettlement(','ReleaseManagementSettlement(']){const next=core.indexOf(token,at+1);assert.ok(next>at,token);at=next;}
 assert.match(core,/priorRows\.Length\/2>=512/);assert.match(core,/priorRows\.Any\(x=>V\.Id\(x,"attemptId"\)==V\.Id\(management,"installRequestId"\)\)/);assert.match(core,/"sequence",priorRows\.Length\+1/);assert.match(core,/"previousHash",priorRows\.Length==0\?null:Hash\(priorRows\[priorRows\.Length-1\]\)/);
 const parser=store.slice(store.indexOf('Dictionary<string,object>[] SettlementRows('),store.indexOf('static void ValidateSettlementRow('));assert.match(parser,/marker\.Length>MetadataMaximum/);assert.match(parser,/rows\.Count>=1024/);assert.match(parser,/rows\.Count%2!=0/);
 const catalogue=store.slice(store.indexOf('ValidateSettlementCatalogue('),store.indexOf('internal Dictionary<string,object> ReadManagementSettlement('));
 assert.match(catalogue,/prefixHashes=ContainerPrefixHashes\(container\)/);assert.match(catalogue,/settledCount=finalIndex\+1/);assert.match(catalogue,/prefixHashes\[settledCount\]/);assert.match(catalogue,/prefixHashes\[finalIndex-1\]/);
 assert.match(catalogue,/finalIndex-1!=priorSettledCount/,'coherent rehash로 marker pair 순서를 바꿔도 직전 FINAL 다음 prefix가 아니면 거절한다');assert.match(catalogue,/active\["baseContainerHash"\],priorInstalledHash/,'다음 ACTIVE는 직전 FINAL의 exact installed hash를 base로 이어야 한다');
 assert.match(catalogue,/priorSettledCount!=rows\.Length/,'마지막 FINAL 뒤 unmarked valid ledger tail이 있으면 거절한다');assert.match(catalogue,/priorInstalledHash!=Hash\(container\)/,'마지막 FINAL hash는 현재 전체 ledger와 같아야 한다');assert.match(catalogue,/attempts\.Add/);assert.match(catalogue,/selections\.Add/);assert.match(catalogue,/terminal/);assert.match(catalogue,/io\.VerifyWorker/);
 const kernel=store.slice(store.indexOf('internal sealed class WindowsNativeWorkerInstallationKernel'));
 const open=kernel.slice(kernel.indexOf('OpenManagementSettlementForInstall('),kernel.indexOf('BeginManagementSettlement(')),writeOpen=kernel.slice(kernel.indexOf('OpenManagementWriteFile('),kernel.indexOf('void RequireFileIdentity('));assert.match(open,/OpenManagementWriteFile/);assert.match(writeOpen,/0xC0000000,0/);assert.match(open,/ReadManagementBytes/);assert.match(open,/MetadataBytes\(\)>8388608/);assert.doesNotMatch(open,/MetadataBytes\(\)\+2L\*ManagementFrameMaximum|CreatePrivateFile/);
 const unchanged=kernel.slice(kernel.indexOf('ReleaseManagementSettlementUnchanged('),kernel.indexOf('AppendManagementSettlement('));assert.match(unchanged,/ReadManagementBytes/);assert.match(unchanged,/SequenceEqual\(expected\)/);assert.match(unchanged,/CloseOwnedFile\(lockFile\)/);assert.doesNotMatch(unchanged,/WriteFile|File\.Delete|SetFileInformationByHandle/);
 const append=kernel.slice(kernel.indexOf('AppendManagementSettlement('),kernel.indexOf('ReleaseManagementSettlement('));assert.match(append,/managementAttemptBaseRows/);assert.match(append,/8388608/);
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
 assert.match(owner,/NamespaceRootIdentity=namespaceRootIdentity/);assert.match(owner,/DirectoryIdentity=directoryIdentity/);assert.match(owner,/ReadNormalInstalledSource\(root,image,workerHash,directoryIdentity,fileIdentity,timeoutMs\)/);assert.match(owner,/original\.ReadNormal\(workerHash,directoryIdentity,fileIdentity,timeoutMs\)/);
 assert.match(owner,/age\.ElapsedMilliseconds>=10000/);assert.match(owner,/timeoutMs<1\|\|timeoutMs>1000/);
 const normalOwner=owner.slice(owner.indexOf('private sealed class NormalImageOwner:'),owner.indexOf('internal static NormalImageObservation ReadOriginalNormalSource'));
 assert.match(normalOwner,/bool opened,disposed,closeAttempted,cleanupUnknown/);assert.match(normalOwner,/if\(closeAttempted\|\|cleanupUnknown\)throw Unavailable\(\)/);assert.match(normalOwner,/CloseOriginalNormalSource|CloseConfirmed/);assert.match(owner,/NativeCloseVerified\{get\{return false;\}\}/);
 const retained=deployment.slice(deployment.indexOf('internal sealed class NormalRetainedImageSource'),deployment.indexOf('void Live('));assert.equal((retained.match(/closeAttempted=true;var closing=image;try\{closeReceipt=OwnershipEvidenceImageOwnerSource\.CloseOriginalNormalSource\(closing\)/g)||[]).length,2);assert.equal((retained.match(/catch\{cleanupUnknown=true;throw;\}/g)||[]).length,2);assert.ok(retained.indexOf('owner.ReleaseNormalImage(this)')>retained.indexOf('CloseOriginalNormalSource(closing)'));assert.ok(retained.indexOf('owner.ReleaseTransferredNormalImage(this,original)')>retained.lastIndexOf('CloseOriginalNormalSource(closing)'));
 assert.equal((retained.match(/source\.ReleaseAfterClose\(closing,closeReceipt\)/g)||[]).length,2);assert.match(retained,/internal NormalTransferredImageSource\(/);
 const installed=read('NativeWorkerInstallationStoreSource.cs'),normalSource=installed.slice(installed.indexOf('internal sealed class NormalInstalledImageSource'),installed.indexOf('static Exception Invalid()'));
 assert.match(installed,/NormalInstalledImageSource normalImageSource/);assert.match(normalSource,/INormalRetainedImageCandidate activeImage,unresolvedImage/);assert.match(normalSource,/opened=true/);assert.match(normalSource,/activeImage=unresolvedImage/);assert.match(installed,/if\(normalImageSource!=null\)throw Invalid\(\)/);assert.match(installed,/Check\(\);normalImageSource=null/);assert.doesNotMatch(owner.slice(owner.indexOf('internal static INormalRetainedImageCandidate OpenNormalSourceOnly(')),/owned\.ReadCurrent/);
});

test('normal retained image만 원 raw root/image handle을 단회 native close하고 same-owner receipt 전에는 release하지 않는다',()=>{
 const owner=read('OwnershipEvidenceImageOwnerSource.cs'),store=read('NativeWorkerInstallationStoreSource.cs'),deployment=read('NativeWorkerDeploymentSource.cs');
 const normal=owner.slice(owner.indexOf('private sealed class NormalImageOwner:'),owner.indexOf('internal static NormalImageObservation ReadOriginalNormalSource'));
 assert.match(owner,/EntryPoint="CreateFileW"[\s\S]*IntPtr OpenNormalFileW/);assert.match(owner,/private static extern bool CloseHandle\(IntPtr handle\)/);
 assert.match(normal,/new SafeFileHandle\(rootHandle,false\)/);assert.match(normal,/new SafeFileHandle\(imageHandle,false\)/);assert.match(normal,/new FileStream\(imageAlias,FileAccess\.Read,8192,false\)/);
 assert.match(normal,/OpenNormalFileW\(directory,0x80,3,IntPtr\.Zero,3,0x02200000,IntPtr\.Zero\)/);assert.match(normal,/OpenNormalFileW\(imagePath,0x80000000,1,IntPtr\.Zero,3,0x00200000,IntPtr\.Zero\)/);
 assert.match(normal,/Valid\(IntPtr value\)\{return value!=IntPtr\.Zero&&value!=new IntPtr\(-1\);\}/);assert.match(normal,/if\(!Valid\(rootHandle\)\)[\s\S]*if\(!Valid\(imageHandle\)\|\|rootHandle==imageHandle\)/);
 assert.match(normal,/streamCloseAttempted=true[\s\S]*original\.Dispose\(\)[\s\S]*imageCloseAttempted=true[\s\S]*CloseHandle\(imageHandle\)[\s\S]*rootCloseAttempted=true[\s\S]*CloseHandle\(rootHandle\)/);
 assert.match(normal,/if\(Valid\(rootHandle\)&&Valid\(imageHandle\)&&rootHandle==imageHandle\)\{cleanupUnknown=true;throw Unavailable\(\);\}[\s\S]*streamCloseAttempted=true/);
 assert.match(owner,/internal NormalImageCloseReceipt\(object owner,long root,long image\)/);assert.match(owner,/Object\.ReferenceEquals\(closeReceipt,receipt\)&&receipt\.Matches/);
 assert.match(normal,/if\(!streamCloseSucceeded\|\|!imageCloseSucceeded\|\|!rootCloseSucceeded\|\|!aliasCloseSucceeded\)[\s\S]*cleanupUnknown=true/);
 assert.match(owner,/internal sealed class NormalImageCloseReceipt/);assert.match(owner,/CloseOriginalNormalSource\(/);assert.match(owner,/RequireOriginalNormalCloseReceipt\(/);
 const installed=store.slice(store.indexOf('internal sealed class NormalInstalledImageSource'),store.indexOf('static Exception Invalid()'));
 assert.match(installed,/activeImage/);assert.match(installed,/NormalImageOwnershipUnknownException/);assert.match(owner,/internal NormalImageOwnershipUnknownException\(INormalRetainedImageCandidate value\)/);assert.match(owner,/error\.Owner as NormalImageOwner/);assert.match(installed,/ReadOriginalNormalOwnershipUnknown\(e\)/);assert.match(installed,/ReleaseAfterClose\(OwnershipEvidenceImageOwnerSource\.INormalRetainedImageCandidate image,OwnershipEvidenceImageOwnerSource\.NormalImageCloseReceipt receipt\)/);
 assert.match(installed,/ReferenceEquals\(activeImage,image\)[\s\S]*RequireOriginalNormalCloseReceipt\(image,receipt\)[\s\S]*activeImage=null/);
 const retained=deployment.slice(deployment.indexOf('internal sealed class NormalRetainedImageSource'),deployment.indexOf('void Live('));
 assert.equal((retained.match(/CloseOriginalNormalSource\(closing\)/g)||[]).length,2);assert.equal((retained.match(/source\.ReleaseAfterClose\(closing,closeReceipt\)/g)||[]).length,2);
 assert.equal((retained.match(/catch\{cleanupUnknown=true;throw;\}/g)||[]).length,2);assert.doesNotMatch(retained,/image\.Dispose\(\);image=null;source\.ReleaseAfterClose\(\)/);
 const legacy=owner.slice(owner.indexOf('private sealed class ImageOwner:'),owner.indexOf('// caller 경로'));
 assert.match(legacy,/NativeCloseVerified\{get\{return false;\}\}/);assert.match(legacy,/SafeFileHandle root,imageHandle/);assert.doesNotMatch(legacy,/OpenNormalFileW|NormalImageCloseReceipt/);
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

test('normal 확정 거절은 원 claim의 effect0 회수 증거만 durable slot으로 단회 승격한다',()=>{
 const spool=read('NormalExecutionSpoolProfileSource.cs'),host=read('DesktopTrustKeyHostSource.cs');
 assert.match(host,/internal sealed class ConfirmedRejectedObservation/);
 assert.match(host,/private ConfirmedRejectedObservation\(/);
 assert.match(host,/internal ConfirmedRejectedObservation ReadConfirmedRejected\([^)]*\)\{return null;\}/);
 assert.doesNotMatch(host,/ReadConfirmedRejected\([^)]*(?:bool|string)\s+(?:rejected|error|message)/);
 const claim=host.slice(host.indexOf('if(operation=="CLAIM_NORMAL_START_PREPARATION_REQUEST_V1")'),host.indexOf('if(operation=="SIGN_NORMAL_START_PREPARATION_RESULT_V1")'));
 assert.match(claim,/var material=normalStartPreparationProducer\.ConsumeClaim\(claim\.Capability/);
 assert.ok(claim.indexOf('ReadConfirmedRejected')<claim.indexOf('CreateOwned'));
 assert.match(claim,/RecordConfirmedRejected\(root,record,window,session,request,epoch,material,rejected/);
 assert.doesNotMatch(claim,/catch\([^)]*(?:Exception|TimeoutException)[^)]*\)[\s\S]*RecordConfirmedRejected/);
 assert.match(spool,/NORMAL_START_PREPARATION_REJECTED_AVAILABLE/);
 assert.match(spool,/NORMAL_START_PREPARATION_SIGN_CLAIMED/);
 assert.match(spool,/NORMAL_START_PREPARATION_SIGNED_CONFIRMED/);
 assert.match(spool,/private sealed class DurableNormalStartPreparationResultSlot:DesktopTrustKeyHostSource\.NormalStartPreparationResultSlot/);
 assert.match(spool,/effectState[^\n]*NONE_CONFIRMED/);
 assert.match(spool,/cleanupState[^\n]*CLOSED_CONFIRMED/);
 assert.match(spool,/reasonCode[^\n]*NORMAL_START_PREPARATION_REJECTED/);
 assert.match(spool,/scopeHash[^\n]*RejectionScope\(request\)/);
 assert.doesNotMatch(spool,/"record",C\(record\)/);
 assert.doesNotMatch(spool,/"PREPARED"|preparationBasis",R\(/);
 const durable=spool.slice(spool.indexOf('private sealed class DurableNormalStartPreparationResultSlot'));
 assert.match(durable,/ClaimOnce[\s\S]*Append[\s\S]*SignClaimed/);
 assert.match(durable,/ConfirmSigned[\s\S]*signedPacket[\s\S]*SignedConfirmed/);
 assert.match(durable,/PreserveUnknown[\s\S]*ResultUnknown/);
 assert.match(durable,/Log\(false[\s\S]*J\(saved\["signedPacket"\]\)!=J\(packet\)/);
 const history=spool.slice(spool.indexOf('internal Row ReadConfirmedRejectedPacketHistory('),spool.indexOf('private sealed class DurableNormalStartPreparationResultSlot'));
 assert.match(history,/SignedConfirmed[\s\S]*signedPacket/);assert.doesNotMatch(history,/Append\(|SignNormal|Guid\.NewGuid|Id\(\)/);
});

test('새 normal claim은 결과 3단계 최악 공간을 예약하고 각 durable append가 같은 예약을 소비한다',()=>{
 const spool=read('NormalExecutionSpoolProfileSource.cs');
 assert.match(spool,/NormalResultEntryWorst=MaxEntry\+36L/);
 assert.match(spool,/NormalResultWorst=3\*NormalResultEntryWorst/);
 const validation=spool.slice(spool.indexOf('static void ValidateNormalPreparationClaims('),spool.indexOf('// 같은 원 등록'));
 assert.match(validation,/ContainsKey\("resultReservation"\)/);assert.match(validation,/N\(r\["resultReservation"\]\)!=NormalResultWorst/);
 const claim=spool.slice(spool.indexOf('internal NormalStartPreparationClaimCommit ClaimNormalStartPreparation('),spool.indexOf('const string RejectedAvailable'));
 assert.match(claim,/"resultReservation",NormalResultWorst/);
 assert.ok(claim.indexOf('var back=Log(false')<claim.indexOf('new DurableNormalStartPreparationClaimCapability'));
 const hold=spool.slice(spool.indexOf('long ManagementHold('),spool.indexOf('void Append('));
 assert.match(hold,/resultReservation/);assert.match(hold,/RejectedAvailable/);assert.match(hold,/SignClaimed/);assert.match(hold,/SignedConfirmed/);assert.match(hold,/ResultUnknown/);
 assert.match(hold,/remainingStages\*NormalResultEntryWorst/);
 assert.match(hold,/AdminHold/); // marker 없는 기존 claim의 판독·기존 8KiB hold 보존
});

test('retained image lease는 claim metadata와 opaque owner를 같은 관측에서 결박하고 path·bytes를 노출하지 않는다',()=>{
 const deployment=read('NativeWorkerDeploymentSource.cs'),lease=deployment.slice(deployment.indexOf('internal sealed class NormalRetainedImageSource'),deployment.indexOf('private sealed class NormalTransferredImageSource'));
 assert.match(lease,/readonly Dictionary<string,object> claimImage/);assert.match(lease,/internal Dictionary<string,object> ReadClaimImage\(int timeoutMs=1000\)/);
 assert.match(lease,/ReadCurrent\(timeoutMs\)[\s\S]*associationRef[\s\S]*Clone\(claimImage\)[\s\S]*ReadCurrent\(timeoutMs\)/);
 const acquire=deployment.slice(deployment.indexOf('internal NormalRetainedImageSource AcquireNormalImageForPreparation('));
 assert.match(acquire,/var result=new Dictionary<string,object>\{\{"state","NORMAL_START_WORKER_IMAGE_VERIFIED"\}/);assert.match(acquire,/new NormalRetainedImageSource\(this,installedSource,retained,result\)/);
 assert.doesNotMatch(lease,/Path|Handle|byte\[\]/);
});

test('normal 전체 회수는 typed image close와 원 durable claim을 read-only로 같은 ref에 재결박한다',()=>{
 const deployment=read('NativeWorkerDeploymentSource.cs'),spool=read('NormalExecutionSpoolProfileSource.cs'),host=read('DesktopTrustKeyHostSource.cs');
 const transferred=deployment.slice(deployment.indexOf('private sealed class NormalTransferredImageSource'),deployment.indexOf('void Live('));
 assert.match(deployment,/internal sealed class NormalTransferredImageCloseReceipt/);assert.match(deployment,/ReadTransferredNormalImageCloseReceipt\(/);
 assert.match(transferred,/CloseOriginalNormalSource\(closing\)[\s\S]*ReleaseAfterClose\(closing,closeReceipt\)[\s\S]*ReleaseTransferredNormalImage/);
 assert.match(transferred,/new NormalTransferredImageCloseReceipt\(this,closeReceipt\)/);assert.match(transferred,/Object\.ReferenceEquals\(transferredCloseReceipt,receipt\)/);
 const current=spool.slice(spool.indexOf('internal void ReadNormalStartPreparationClaimCurrent('),spool.indexOf('const string RejectedAvailable'));
 assert.ok(current.length>0);assert.match(current,/Log\(false/);assert.match(current,/NativeClaimRef/);assert.match(current,/RequestRef/);assert.match(current,/ImageRef/);assert.match(current,/ExpiresAt/);
 assert.match(current,/S\(material\.NativeClaimRef,"id"\)/);assert.match(current,/H\(match\)!=S\(material\.NativeClaimRef,"contentHash"\)/);
 assert.match(current,/J\(match\["requestRef"\]\)!=J\(material\.RequestRef\)/);assert.match(current,/J\(match\["imageAssociationRef"\]\)!=J\(material\.ImageRef\)/);
 assert.doesNotMatch(current,/Append\(|RecordConfirmedRejected|RejectedAvailable|PREPARED|POST|queue/i);
 const branch=host.slice(host.indexOf('if(operation=="CLAIM_NORMAL_START_PREPARATION_REQUEST_V1")'),host.indexOf('if(operation=="SIGN_NORMAL_START_PREPARATION_RESULT_V1")'));
 assert.match(branch,/budget\.Slice\(exact\.ExpiresAt,2000\)/);assert.match(branch,/ReadNormalStartPreparationClaimCurrent\(exact/);
});
