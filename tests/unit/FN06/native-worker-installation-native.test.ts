import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name:string)=>readFileSync('apps/connector/native/'+name,'utf8');
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
