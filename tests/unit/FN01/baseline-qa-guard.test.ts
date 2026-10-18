// 승인된 순수 최대14개만. 실제 native/OS/PG 동작의 시험은 아니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { actualQaAuthority, assertActualQaAuthorized, assertParentChain, assertOwnedContainer, assertOwnedNetwork, assertMigrationManifest, fixedQa, QaWindow, cleanupFileOrder, dependencyArguments, boundedWait, QaWaitTimeout } from '../../../scripts/fn01-baseline-qa-guard.ts';
import { runBaselineQaCandidate, runNativeBaselineQaCandidate } from '../../../scripts/qa-fn01-baseline-isolated.ts';
import type { QaPorts } from '../../../scripts/qa-fn01-baseline-isolated.ts';
import { createHash } from 'node:crypto';
import { validateBootstrapReceipt, QaWorkAdmission } from '../../../scripts/fn01-baseline-qa-guard.ts';
import * as actualB from '../../../scripts/fn01-baseline-qa-guard.ts';
import * as runnerChecks from '../../../scripts/qa-fn01-baseline-isolated.ts';

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
  await assert.rejects(runNativeBaselineQaCandidate(),/FN01_ACTUAL_AUTHORIZATION_NOT_ISSUED/);
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
  // I1: timeout 뒤 늦은 작업이 회수 창으로 새 child/SQL을 시작하지 못해야 한다.
  const gate=new QaWorkAdmission();let release!:()=>void,started=0;
  const paused=new Promise<void>(r=>{release=r;});
  const late=(async()=>{await paused;gate.assertWork();started++;})();
  gate.stop();gate.stop();release();
  await assert.rejects(late,/FN01_WORK_STOPPED/);assert.equal(started,0);
});
function bootstrapFixture(){
  const root={path:fixedQa.root,realpath:fixedQa.root,uid:1000,mode:0o700,dev:1,ino:700,kind:'DIRECTORY',links:2};
  const inventory=[{path:fixedQa.root+'/source/package-lock.json',kind:'FILE',uid:1000,mode:0o644,dev:1,ino:901,links:1,hash:fixedQa.lockHash}];
  const inventoryHash=createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
  const expectation={nonce:'0123456789abcdef0123456789abcdef',head:'c'.repeat(40),issuedAt:1000000,expiresAt:2200000,rootCreatedAt:1000001,root,parents:chain(),inventoryHash,toolchainManifestHash:'d'.repeat(64),toolchainDecisionRef:'B-TOOLCHAIN-UNISSUED-FIXTURE',pathRiskDecisionRef:'B-PATH-UNISSUED-FIXTURE'};
  const receipt={schemaVersion:1,kind:'FN01_BASELINE_BOOTSTRAP',phase:'DEPENDENCIES_READY',owner:fixedQa.owner,...structuredClone(expectation),remote:'git@github-sinsan-develop:sinsan-develop/Anvil.git',productSource:fixedQa.source,paths:{root:fixedQa.root,source:fixedQa.root+'/source',cache:fixedQa.root+'/npm-cache',artifacts:fixedQa.root+'/artifacts'},migrationAggregate:fixedQa.migrationAggregate,lockHash:fixedQa.lockHash,dependencyAggregate:fixedQa.dependencyAggregate,inventory};
  return{receipt,expectation};
}
// R1 잡을 결함: 관측 receipt 일치만으로 실제 실행 권한을 만들어 냄.
test('R1 일치하는 bootstrap metadata도 실제 실행 권한을 부여하지 않는다',()=>{
  const {receipt,expectation}=bootstrapFixture(),r=validateBootstrapReceipt(receipt,expectation,1100000);
  assert.equal(r.metadataMatched,true);assert.equal(r.executionAuthorized,false);
  assert.throws(assertActualQaAuthorized,/FN01_ACTUAL_AUTHORIZATION_NOT_ISSUED/);
});
// R2 잡을 결함: 다른 root/nonce/H 또는 바뀐 부모를 이번 bootstrap으로 채택.
test('R2 root·nonce·H·parent 식별이 다르면 bootstrap metadata를 거절한다',()=>{
  for(const alter of [(r:any)=>r.paths.root='/tmp/other',(r:any)=>r.nonce='e'.repeat(32),(r:any)=>r.head='a'.repeat(40),(r:any)=>r.root.ino=999,(r:any)=>r.parents[4].mode=0o777]){
    const {receipt,expectation}=bootstrapFixture();alter(receipt);assert.throws(()=>validateBootstrapReceipt(receipt,expectation,1100000),/FN01_BOOTSTRAP/);
  }
});
// R3 잡을 결함: 2단계 진입 때 최초 창을 새 창으로 대체해 만료를 연장.
test('R3 최초 창 만료와 두번째 단계의 시간창 재설정을 거절한다',()=>{
  const {receipt,expectation}=bootstrapFixture();assert.throws(()=>validateBootstrapReceipt(receipt,expectation,2200000),/FN01_BOOTSTRAP/);
  assert.throws(()=>validateBootstrapReceipt({...receipt,issuedAt:1100000,expiresAt:2300000},expectation,1100000),/FN01_BOOTSTRAP/);
  assert.throws(()=>validateBootstrapReceipt({...receipt,rootCreatedAt:1100000},expectation,1100000),/FN01_BOOTSTRAP/);
});
// R4 잡을 결함: 이전/미소유/불명확 단계의 파일을 회수 소유 목록으로 승계.
test('R4 이전·미소유·불명확 단계의 회수 범위 승계를 거절한다',()=>{
  for(const alter of [(r:any)=>r.phase='PARTIAL_UNKNOWN',(r:any)=>r.owner='OTHER_OWNER',(r:any)=>r.inventory[0].uid=1001,(r:any)=>r.inventory.push({...r.inventory[0],path:fixedQa.root+'/../elsewhere'}),(r:any)=>r.inventory[0].kind='LINK']){
    const {receipt,expectation}=bootstrapFixture();alter(receipt);assert.throws(()=>validateBootstrapReceipt(receipt,expectation,1100000),/FN01_BOOTSTRAP/);
  }
  // hash 불일치 음성과 별개: 정확한 새 hash를 줘도 의미상 미소유/탈출/LINK는 거절.
  for(const alter of [(r:any)=>r.inventory[0].uid=1001,(r:any)=>r.inventory[0].path=fixedQa.root+'/../elsewhere',(r:any)=>r.inventory[0].kind='LINK']){
    const {receipt,expectation}=bootstrapFixture();alter(receipt);const digest=createHash('sha256').update(JSON.stringify(receipt.inventory)).digest('hex');receipt.inventoryHash=digest;expectation.inventoryHash=digest;
    assert.throws(()=>validateBootstrapReceipt(receipt,expectation,1100000),/FN01_BOOTSTRAP/);
  }
});

// G1~G6: 실제 효과 없이 새 결박의 실패 조건만 검사. 기존14 기대값은 유지한다.
const feature=()=>actualB as unknown as Record<string,any>;
function controllerFixture(){const b=bootstrapFixture();const issuedAt=1792322464000+60000;Object.assign(b.expectation,{issuedAt,expiresAt:issuedAt+1200000,rootCreatedAt:issuedAt,toolchainDecisionRef:'FN01_ACTUAL_B_20261018T112104Z',pathRiskDecisionRef:'FN01_ACTUAL_B_20261018T112104Z'});return {b,c:{schemaVersion:1,decisionRef:'FN01_ACTUAL_B_20261018T112104Z',contractGit:'cb3400381e267d5460267b3c8d01319bfde78b06',contractHash:'ee88c4ea4aa5507ef26e711542788c1bfc8b6240bdb5debc094d5c7bb5fc9ebd',scopeHash:feature().actualBScopeHash,head:b.expectation.head,nonce:b.expectation.nonce,issuedAt,expiresAt:issuedAt+1200000,rootCreatedAt:issuedAt,root:b.expectation.root,parents:b.expectation.parents,codeHashes:Object.fromEntries(['scripts/fn01-baseline-qa-guard.ts','scripts/qa-fn01-baseline-isolated.ts','tests/integration/FN01/baseline-isolated.test.ts','tests/unit/FN01/baseline-qa-guard.test.ts'].map(p=>[p,'a'.repeat(64)]))}};}
test('G1 B metadata는 permit가 아니며 위조 object는 효과 전에 거절한다',async()=>{
  assert.equal(typeof feature().validateActualBController,'function');const {c}=controllerFixture();
  const metadata=feature().validateActualBController(c,c.issuedAt+1);assert.equal(metadata.executionAuthorized,false);
  assert.throws(()=>assertActualQaAuthorized(metadata as never),/FN01_ACTUAL_AUTHORIZATION_NOT_ISSUED/);
  assert.throws(()=>assertActualQaAuthorized({approved:true} as never),/FN01_ACTUAL_AUTHORIZATION_NOT_ISSUED/);
  let reads=0;const unopened=new Proxy({},{get(){reads++;throw Error('MUST_NOT_READ_CONSUMED_FACTS');}});
  await assert.rejects(feature().runApprovedBaselineQa(unopened),/FN01_B_ALREADY_CONSUMED/);assert.equal(reads,0);
});
test('G2 B·contract·scope·H·동일 bootstrap 결박 불일치를 거절한다',()=>{
  assert.equal(typeof feature().assertActualBBinding,'function');const {c,b}=controllerFixture();
  assert.doesNotThrow(()=>feature().assertActualBBinding(c,b.expectation,c.issuedAt+1));
  for(const patch of [{decisionRef:'OTHER'},{contractGit:'a'.repeat(40)},{contractHash:'b'.repeat(64)},{scopeHash:'b'.repeat(64)},{head:'not-a-sha'}])assert.throws(()=>feature().assertActualBBinding({...c,...patch},b.expectation,c.issuedAt+1),/FN01_B_/);
  assert.throws(()=>feature().assertActualBBinding({...c,head:'d'.repeat(40)},b.expectation,c.issuedAt+1),/FN01_B_/);
});
test('G3 raw tuple와 canonical proof·socket을 구분하고 다른 경로와 LINK를 거절한다',()=>{
  assert.equal(typeof feature().canonicalizeActualBTools,'function');
  const row=[fixedQa.node,'FILE',1001,1001,0o755,2112,724935,1,fixedQa.nodeHash,fixedQa.node];
  const socket=['/var/run/docker.sock','SOCKET',0,1001,0o660,97,867,1,null,'/run/docker.sock'];
  const r=feature().canonicalizeActualBTools([row,socket]);assert.equal(r.files.length,1);assert.equal(r.socket.ino,867);assert.notEqual(r.canonicalHash,createHash('sha256').update(JSON.stringify([row,socket])).digest('hex'));
  for(const patch of [{0:'/opt/elsewhere'},{1:'LINK'},{2:1002},{4:0o777}]){const changed=[...row];Object.assign(changed,patch);assert.throws(()=>feature().canonicalizeActualBTools([changed,socket]),/FN01_B_TOOLS/);}
  assert.throws(()=>feature().canonicalizeActualBTools([row,{...socket,6:999}]),/FN01_B_TOOLS/);
});
test('G4 단일 결정 소비는 새 nonce나 새 창으로 재발급되지 않는다',()=>{
  assert.equal(typeof feature().consumeActualBDecision,'function');const {c}=controllerFixture(),used=new Set<string>();
  feature().consumeActualBDecision(c,used,c.issuedAt+1);assert.equal(used.size,1);
  assert.throws(()=>feature().consumeActualBDecision({...c,nonce:'e'.repeat(32),issuedAt:c.issuedAt+10,rootCreatedAt:c.issuedAt+10,expiresAt:c.expiresAt+10},used,c.issuedAt+11),/FN01_B_ALREADY_CONSUMED/);
});
test('G5 승인24시간·최초20분 만료와 stop 뒤 새 작업을 거절한다',async()=>{
  assert.equal(typeof feature().validateActualBController,'function');const {c}=controllerFixture();
  assert.throws(()=>feature().validateActualBController(c,c.expiresAt),/FN01_B_/);
  assert.throws(()=>feature().validateActualBController({...c,issuedAt:c.issuedAt+86400000,expiresAt:c.expiresAt+86400000},c.issuedAt+86400001),/FN01_B_/);
  assert.throws(()=>feature().validateActualBController({...c,expiresAt:c.expiresAt+1},c.issuedAt+1),/FN01_B_/);
  const gate=new QaWorkAdmission();gate.stop();assert.throws(()=>gate.assertWork(),/FN01_WORK_STOPPED/);
  // I1: await 준비가 끝난 시점에 중단/기한을 다시 검사해야 새 파일 효과가 없다.
  assert.equal(typeof feature().assertQaEffectBoundary,'function');const active=new QaWorkAdmission(),window=new QaWindow(c.issuedAt,c.expiresAt);
  assert.doesNotThrow(()=>feature().assertQaEffectBoundary(active,window,c.issuedAt+1,'WORK',0));
  active.stop();assert.throws(()=>feature().assertQaEffectBoundary(active,window,c.issuedAt+1,'WORK',0),/FN01_WORK_STOPPED/);
  assert.throws(()=>feature().assertQaEffectBoundary(active,window,c.issuedAt+10,'CLEANUP',c.issuedAt+10),/FN01_CLEANUP_EXPIRED/);
  // 동시 읽기는8개를 넘지 않고 입력/결과 순서·전체 항목을 유지해야 한다.
  assert.equal(typeof feature().boundedReadMap,'function');const held=Array.from({length:12},()=>Promise.withResolvers<void>());
  let inFlight=0,peak=0;const started:number[]=[];
  const read=feature().boundedReadMap([0,1,2,3,4,5,6,7,8,9,10,11],()=>{},async(n:number)=>{started.push(n);inFlight++;peak=Math.max(peak,inFlight);await held[n]!.promise;inFlight--;return n*2;});
  assert.equal(started.length,8);for(let n=11;n>=0;n--)held[n]!.resolve();
  assert.deepEqual(await read,[0,2,4,6,8,10,12,14,16,18,20,22]);assert.equal(peak,8);assert.equal(started.length,12);
  const stopGate=new QaWorkAdmission(),waiting=Array.from({length:10},()=>Promise.withResolvers<void>()),stopStarted:number[]=[];
  const stopping=feature().boundedReadMap([0,1,2,3,4,5,6,7,8,9],()=>stopGate.assertWork(),async(n:number)=>{stopStarted.push(n);await waiting[n]!.promise;return n;});
  stopGate.stop();for(const w of waiting)w.resolve();await assert.rejects(stopping,/FN01_WORK_STOPPED/);assert.equal(stopStarted.length,8);
  // 첫 실패 뒤 다른 in-flight 항목은 수거하고,9번째 새 항목을 열지 않는다.
  const pending=Array.from({length:10},()=>Promise.withResolvers<void>()),failedStarted:number[]=[];let settled=false;
  const failed=feature().boundedReadMap([0,1,2,3,4,5,6,7,8,9],()=>{},async(n:number)=>{failedStarted.push(n);await pending[n]!.promise;if(n===0)throw Error('READ_FAILED');return n;});
  const failure=assert.rejects(failed,/READ_FAILED/).then(()=>{settled=true;});pending[0]!.resolve();await Promise.resolve();await Promise.resolve();assert.equal(settled,false);
  for(const w of pending)w.resolve();await failure;assert.equal(failedStarted.length,8);
});
test('G6 시작영수증 parent·hash·owner 결박 및 회수 후 부모 nlink 1감소만 허용한다',async()=>{
  assert.equal(typeof feature().assertActualBStarted,'function');assert.equal(typeof feature().assertParentsAfterRootRemoval,'function');
  const {c}=controllerFixture(),r={decisionRef:c.decisionRef,head:c.head,nonce:c.nonce,issuedAt:c.issuedAt,expiresAt:c.expiresAt,controllerHash:'a'.repeat(64),bootstrapHash:'b'.repeat(64),parentPid:100,owner:fixedQa.owner,phase:'CLAIMED'};
  assert.doesNotThrow(()=>feature().assertActualBStarted(r,c,'a'.repeat(64),'b'.repeat(64),100));
  for(const patch of [{parentPid:101},{nonce:'f'.repeat(32)},{owner:'OTHER'},{phase:'PARTIAL'},{bootstrapHash:'c'.repeat(64)}])assert.throws(()=>feature().assertActualBStarted({...r,...patch},c,'a'.repeat(64),'b'.repeat(64),100),/FN01_B_STARTED/);
  const before=chain();before[5]!.links=3;const after=structuredClone(before);after[5]!.links=2;
  assert.doesNotThrow(()=>feature().assertParentsAfterRootRemoval(before,after));after[4]!.links=2;
  assert.throws(()=>feature().assertParentsAfterRootRemoval(before,after),/FN01_PATH/);
  // I2: 성공 TAP/diagnostic이어도 실제 child nonzero/signal은 PASS가 아니다.
  const checks=runnerChecks as unknown as Record<string,any>;assert.equal(typeof checks.assertWorkflow,'function');
  const done={phase:'DONE',cases:[...runnerChecks.requiredCases],closeFailures:0,failure:null,testCount:1,passCount:1,failCount:0,skipCount:0,cancelCount:0,exitCode:0,signal:null};
  assert.doesNotThrow(()=>checks.assertWorkflow(done));
  assert.throws(()=>checks.assertWorkflow({...done,exitCode:1}),/FN01_WORKFLOW_INCOMPLETE/);
  assert.throws(()=>checks.assertWorkflow({...done,signal:'SIGTERM'}),/FN01_WORKFLOW_INCOMPLETE/);
  // 내부 Error/stack/본문은 버리고 고정 코드·구간 소요만 남기되 최초 실패는 보존한다.
  assert.equal(typeof feature().qaSafeFailureCode,'function');assert.equal(typeof feature().QaReadTrace,'function');
  assert.equal(feature().qaSafeFailureCode(new QaWaitTimeout()),'FN01_WAIT_TIMEOUT_UNKNOWN');
  assert.equal(feature().qaSafeFailureCode(Error('FN01_NATIVE_BOOTSTRAP_BYTES')),'FN01_NATIVE_BOOTSTRAP_BYTES');
  assert.equal(feature().qaSafeFailureCode({code:'EACCES',message:'password=not-real'}),'FN01_OS_EACCES');
  const secret=Error('password=not-real postgresql://private.invalid');assert.equal(feature().qaSafeFailureCode(secret),'FN01_UNCLASSIFIED_ERROR');
  assert.equal(feature().qaSafeFailureCode(Error('FN01_NATIVE_password_not_real')),'FN01_UNCLASSIFIED_ERROR');
  const changing=Error();let messageReads=0;Object.defineProperty(changing,'message',{get(){messageReads++;return messageReads===1?'FN01_NATIVE_TOOL_HASH':'password=not-real';}});
  assert.equal(feature().qaSafeFailureCode(changing),'FN01_UNCLASSIFIED_ERROR');assert.equal(messageReads,0);
  let clock=100;const trace=new(feature().QaReadTrace)(()=>clock),first=new QaWaitTimeout();
  await assert.rejects(trace.run('PREFLIGHT',async()=>{clock=130;throw first;}),e=>e===first);
  await assert.rejects(trace.run('INVENTORY',async()=>{clock=160;throw secret;}),e=>e===secret);
  const snapshot=trace.snapshot();assert.equal(trace.firstFailureCode,'FN01_WAIT_TIMEOUT_UNKNOWN');
  assert.deepEqual(snapshot.map((x:any)=>({section:x.section,outcome:x.outcome,elapsedMs:x.elapsedMs,code:x.code})),[{section:'PREFLIGHT',outcome:'FAIL',elapsedMs:30,code:'FN01_WAIT_TIMEOUT_UNKNOWN'},{section:'INVENTORY',outcome:'FAIL',elapsedMs:30,code:'FN01_UNCLASSIFIED_ERROR'}]);
  assert.ok(!JSON.stringify(snapshot).includes('password'));snapshot[0].code='MUTATED';assert.equal(trace.snapshot()[0].code,'FN01_WAIT_TIMEOUT_UNKNOWN');
});
