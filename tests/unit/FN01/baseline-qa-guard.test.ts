// 작성만 승인된 후보. 실행/RED→GREEN 증거 없음. OS/PG 시험이 아니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { actualQaAuthority, assertActualQaAuthorized, assertParentChain, assertOwnedContainer, assertOwnedNetwork, assertMigrationManifest, fixedQa, QaWindow, cleanupFileOrder, dependencyArguments, boundedWait, QaWaitTimeout } from '../../../scripts/fn01-baseline-qa-guard.ts';
import { runBaselineQaCandidate } from '../../../scripts/qa-fn01-baseline-isolated.ts';
import type { QaPorts } from '../../../scripts/qa-fn01-baseline-isolated.ts';

// 잡을 결함: env/호출자 주장만으로 실제 실행을 열어 버리는 분기.
test('미발급 실제 권한은 후보 호출 이전에 닫히며 값이나 env로 열리지 않는다', () => {
  assert.equal(actualQaAuthority, null);
  assert.throws(assertActualQaAuthorized, /FN01_ACTUAL_AUTHORIZATION_NOT_ISSUED/);
});
// 잡을 결함: runner가 실제 권한보다 먼저 시계/OS adapter를 조회하는 순서 회귀.
test('runner는 미발급 권한에서 어떤 adapter 속성도 읽기 전에 거절한다',async()=>{
  let observations=0;
  const ports=new Proxy({} as QaPorts,{get(){observations++;throw Error('ADAPTER_MUST_NOT_BE_READ');}});
  await assert.rejects(runBaselineQaCandidate(ports,{head:'a'.repeat(40),issuedAt:1000000,expiresAt:2200000}),/FN01_ACTUAL_AUTHORIZATION_NOT_ISSUED/);
  assert.equal(observations,0);
});
const chain = () => ['/','/home','/home/daon','/home/daon/.local','/home/daon/.local/share','/home/daon/.local/share/anvil-v3-development'].map((path,i) => ({path,realpath:path,uid:i<2?0:1000,mode:i<2?0o755:i===2?0o750:i===3?0o755:0o700,dev:1,ino:i+1,kind:'DIRECTORY' as const,links:1}));
// 잡을 결함: 다른 경로/uid/링크/쓰기 가능 부모를 이름만 맞으면 허용.
test('정확 부모 chain만 인정하고 link·다른 owner·group write·mount 전환을 거절한다', () => {
  assert.doesNotThrow(() => assertParentChain(chain()));
  for (const change of [{realpath:'/elsewhere'},{uid:1001},{mode:0o777},{dev:2},{kind:'LINK'}]) {
    const rows:any[]=chain(); rows[4]={...rows[4],...change};
    assert.throws(() => assertParentChain(rows), /FN01_PATH/);
  }
  assert.throws(()=>assertParentChain(chain().slice(1)),/FN01_PATH/);
});
// 잡을 결함: 단계마다 기한을 재설정하거나 종료 후 새 작업 시작.
test('최초 창은 연장되지 않고 마지막 정리 여유를 소모하는 새 단계는 거절한다', () => {
  const window=new QaWindow(1000000,2200000);
  assert.equal(window.remaining(1000010,60000),60000);
  assert.throws(()=>window.remaining(2180000,60000),/FN01_QA_EXPIRED/);
  assert.throws(()=>new QaWindow(1000000,2200001),/FN01_WINDOW/);
  assert.throws(()=>window.remaining(999999,1000),/FN01_WINDOW/);
});
const nonce='0123456789abcdef0123456789abcdef', cid='a'.repeat(64), nid='b'.repeat(64);
function container():any {return {Id:cid,Name:'/'+fixedQa.container,Image:fixedQa.imageId,Config:{Labels:{'anvil.project':'v3','anvil.owner':fixedQa.owner,'anvil.instance':nonce}},HostConfig:{PublishAllPorts:false,PortBindings:{},Privileged:false,NetworkMode:fixedQa.network,Tmpfs:{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456'}},Mounts:[],NetworkSettings:{Ports:{'5432/tcp':null},Networks:{[fixedQa.network]:{NetworkID:nid,IPAddress:'172.28.19.2'}}}};}
// 잡을 결함: 같은 이름의 남의 컨테이너 삭제/host publish/다른 image 허용.
test('컨테이너는 full ID·nonce·image·단독 network·tmpfs·publish0에 결박한다', () => {
  assert.equal(assertOwnedContainer(container(),cid,nid,nonce),'172.28.19.2');
  for(const alter of [(v:any)=>v.Id='c'.repeat(64),(v:any)=>v.Image='sha256:'+'0'.repeat(64),(v:any)=>v.Config.Labels['anvil.instance']='f'.repeat(32),(v:any)=>v.HostConfig.PortBindings={'5432/tcp':[{}]},(v:any)=>v.Mounts=[{Type:'bind'}],(v:any)=>v.NetworkSettings.Networks.extra={}]) {
    const value=container();alter(value);assert.throws(()=>assertOwnedContainer(value,cid,nid,nonce),/FN01_CONTAINER/);
  }
});
// 잡을 결함: 종료된 창을 이유로 이름만 보고 network를 지우거나 남의 endpoint를 제거.
test('network 회수는 정확 소유 ID와 endpoint0을 요구한다', () => {
  const n={Id:nid,Name:fixedQa.network,Internal:true,Labels:{'anvil.project':'v3','anvil.owner':fixedQa.owner,'anvil.instance':nonce},Containers:{}};
  assert.doesNotThrow(()=>assertOwnedNetwork(n,nid,nonce,true));
  assert.throws(()=>assertOwnedNetwork({...n,Containers:{other:{}}},nid,nonce,true),/FN01_NETWORK/);
  assert.throws(()=>assertOwnedNetwork({...n,Id:cid},nid,nonce,false),/FN01_NETWORK/);
});
// 잡을 결함: 패키지 실행 링크나 감사 업로드를 기본 동작으로 되살림.
test('새 npm 명령은 fixed node·공개 registry·scripts/binlinks/audit OFF만 만든다', () => {
  const args=dependencyArguments();assert.equal(args[0],fixedQa.npm);assert.equal(args[1],'ci');
  assert.ok(args.includes('--ignore-scripts'));assert.ok(args.includes('--bin-links=false'));assert.ok(args.includes('--no-audit'));
  assert.ok(args.includes('--registry=https://registry.npmjs.org'));assert.ok(args.every(x=>!x.includes('/tmp/')&&!x.includes('db-app')));
});
// 잡을 결함: 미지 파일/경로 traversal/링크를 따라가거나 root 밖을 삭제.
test('파일 회수 계획은 exact root 아래 기존 manifest와 같은 항목만 leaf 우선으로 만든다', () => {
  const root=fixedQa.root, files=[{path:root+'/source/a.ts',kind:'FILE' as const,uid:1000,dev:1,ino:20,mode:0o600,links:1,hash:'a'.repeat(64)},{path:root+'/source',kind:'DIRECTORY' as const,uid:1000,dev:1,ino:19,mode:0o700,links:2,hash:null}];
  assert.deepEqual(cleanupFileOrder(files,files).map(x=>x.path),[root+'/source/a.ts',root+'/source']);
  assert.throws(()=>cleanupFileOrder(files,[...files,{...files[0]!,path:root+'/unknown'}]),/FN01_CLEANUP/);
  assert.throws(()=>cleanupFileOrder(files,[{...files[0]!,ino:999},files[1]!]),/FN01_CLEANUP/);
  assert.throws(()=>cleanupFileOrder([{...files[0]!,path:root+'/../elsewhere'}],[{...files[0]!,path:root+'/../elsewhere'}]),/FN01_CLEANUP/);
});
// 잡을 결함: count만 맞고 중복/다른 source/불필요 SQL을 섞은 manifest 수용.
test('검증할 49 SQL은 source·순서 aggregate가 없거나 다른 manifest이면 거절한다', () => {
  assert.throws(()=>assertMigrationManifest({count:49,ordered:Array(49).fill({id:'0014_context_preparation',sha256:'a'.repeat(64)})}),/FN01_MANIFEST/);
  assert.throws(()=>assertMigrationManifest({}),/FN01_MANIFEST/);
});
// 잡을 결함: 종료 무응답이 무한 대기하거나 timeout을 작업 취소 성공으로 승격.
test('무응답 대기는 유한 UNKNOWN으로 종결하며 원 작업의 취소 성공을 반환하지 않는다',async()=>{
  let signal:AbortSignal|undefined;
  await assert.rejects(boundedWait(5,async s=>{signal=s;return new Promise<never>(()=>{});}),e=>e instanceof QaWaitTimeout);
  assert.equal(signal?.aborted,true);
  assert.equal(await boundedWait(100,async()=>7),7);
});
