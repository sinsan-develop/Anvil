import test from 'node:test';
import assert from 'node:assert/strict';
import moduleApi,{syncBuiltinESMExports} from 'node:module';
import {createHash} from 'node:crypto';
import {createTc01Launcher} from '../../../scripts/qa-fn03-tc01-launcher.ts';
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const success=()=>({status:'CHECKED',stage:'DONE',reason:'JOURNEY_CHECKED',authority:'NOT_ISSUED',appClosed:true,poolClosed:true,resources:'REMOVED',journeys:{fn03:'CHECKED',tc01:'CHECKED',tc01Stage:'DONE'}});
// Synthetic modules expose no real native/provider calls or authority. Unique roots avoid module-cache reuse.
const graphPath='scripts/qa-fn03-tc01-load-graph.json',entry='scripts/qa-fn03-tc01-linux-runtime.ts';
const appEntry='scripts/qa-fn03-source-content-management-origin-entry.ts',native='scripts/qa-fn03-source-content-management-origin-native.ts';
let sequence=0;const approvalId='b9000000-0000-4000-8000-000000000002';
const nodeSha='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb';
function fixture(){
 const attempt='b9000000-0000-4000-8000-'+String(++sequence).padStart(12,'0');
 const key='FN03_LAUNCH_RAM_'+attempt;const trace:string[]=[];let wall=1001,mono=0;
 const harness:any={trace,onImport:()=>{},onNative:()=>{},onRun:async(ports:any,input:any)=>{ports.assertCurrent(input.isolated.binding);await ports.consume(input.isolated.binding);await ports.closePool({},10000);return success();}};
 (globalThis as any)[key]=harness;
 const loadFiles=[entry,appEntry,native,'node_modules/example/index.js'].sort().map(path=>({path,bytes:Buffer.from(path.endsWith('.ts')?'export const fixture=true;':'module.exports=1;')}));
 const code:Record<string,string>={
  [entry]:`export {createManagementOriginTc01NativeProviders} from './qa-fn03-source-content-management-origin-native.ts'; export {createManagementOriginTc01Entry} from './qa-fn03-source-content-management-origin-entry.ts'; globalThis[${JSON.stringify(key)}].onImport();`,
  [native]:`const h=globalThis[${JSON.stringify(key)}];export function createManagementOriginTc01NativeProviders(p){h.trace.push('native');h.preparation=p;h.onNative();return h.native;}`,
  [appEntry]:`const h=globalThis[${JSON.stringify(key)}];export function createManagementOriginTc01Entry(p){h.trace.push('entry');return {async run(i){h.trace.push('run');h.input=i;return h.onRun(p,i);}};}`
 };
 for(const file of loadFiles)if(code[file.path])file.bytes=Buffer.from(code[file.path]!);
 harness.native={now:()=>wall,monotonic:()=>mono,assertCurrent:()=>{trace.push('current');},assertPreparedRuntime:()=>{},consume:async()=>{trace.push('consume');},command:()=>{trace.push('command');return {};},wait:async()=>{},openPool:async()=>({}),closePool:async()=>{trace.push('close');},prepareArtifactRoot:async()=>{}};
 const graph:any={schemaVersion:1,entry,files:[...loadFiles.map(file=>({path:file.path,kind:'load',format:file.path.endsWith('.ts')?'module-typescript':'commonjs'})),{path:graphPath,kind:'control'},{path:'package-lock.json',kind:'control'},{path:'db/fixture.sql',kind:'nonload'}].sort((a,b)=>a.path<b.path?-1:1),builtins:[],imports:[{parent:entry,specifier:'./qa-fn03-source-content-management-origin-entry.ts',target:appEntry},{parent:entry,specifier:'./qa-fn03-source-content-management-origin-native.ts',target:native}]};
 const source:any={schemaVersion:1,sourceHead:'a'.repeat(40),sourceRoot:'/home/daon/anvil-fn03-tc01-'+attempt+'-qa',gitSha256:'b'.repeat(64),dockerSha256:'c'.repeat(64),files:[]};
 const lock=hash('synthetic lock'),dependency:any={schemaVersion:1,sourceHead:source.sourceHead,packageLockSha256:lock,files:[]};
 const runtime:any={sourceHead:source.sourceHead,entry:appEntry,nodeSha256:nodeSha,sourceClosureSha256:'',packageLockSha256:lock,installedDependenciesSha256:''};
 const plan:any={schemaVersion:1,purpose:'FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED',profile:'FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1',attemptId:attempt,sourceHead:source.sourceHead,issuedAt:1000,expiresAt:1801000,artifactRoot:'/tmp/fn03-tc01-'+attempt,receiptRoot:'/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+attempt,subnet:'172.18.0.16/28',runtime};
 const approval:any={schemaVersion:1,purpose:plan.purpose+'_RUN_APPROVAL',profile:plan.profile,decision:'ALLOW_ONE_RUN',approvalId,attemptId:attempt,planHash:'',sourceHead:source.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt};
 const binding:any={};
 const input:any={entryInput:{packet:{},isolated:{binding,receiptRoot:plan.receiptRoot,historicalTsv:'synthetic',legacyBytes:Buffer.from('legacy'),sources:{forms:Buffer.from('forms')},passwords:{app:'synthetic'},fixture:{}},sql:[{id:'synthetic',path:'db/fixture.sql',bytes:Buffer.from('sql-owned')}]},nativePreparation:{binding,runtime,sourceManifestRaw:'',dependencyManifestRaw:''},graphBytes:Buffer.alloc(0),loadFiles};
 function sealPacket(){
  input.nativePreparation.sourceManifestRaw=JSON.stringify(source);input.nativePreparation.dependencyManifestRaw=JSON.stringify(dependency);
  runtime.sourceClosureSha256=hash(input.nativePreparation.sourceManifestRaw);runtime.installedDependenciesSha256=hash(input.nativePreparation.dependencyManifestRaw);
  const planRaw=JSON.stringify(plan),planHash=hash(planRaw);approval.planHash=planHash;const approvalRaw=JSON.stringify(approval),approvalHash=hash(approvalRaw);
  input.entryInput.packet={planRaw,planHash,approvalRaw,approvalHash};
  Object.assign(binding,{attemptId:attempt,approvalId,planHash,approvalHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt,artifactRoot:plan.artifactRoot,subnet:plan.subnet,purpose:plan.purpose,profile:plan.profile});
 }
 function sealGraph(){
  input.graphBytes=Buffer.from(JSON.stringify(graph));
  source.files=[...loadFiles.filter(f=>!f.path.startsWith('node_modules/')).map(f=>({path:f.path,bytes:f.bytes.length,sha256:hash(f.bytes)})),{path:graphPath,bytes:input.graphBytes.length,sha256:hash(input.graphBytes)},{path:'package-lock.json',bytes:14,sha256:lock},{path:'db/fixture.sql',bytes:10,sha256:hash('not-loaded')}].sort((a,b)=>a.path<b.path?-1:1);
  dependency.files=loadFiles.filter(f=>f.path.startsWith('node_modules/')).map(f=>({path:f.path,bytes:f.bytes.length,sha256:hash(f.bytes)}));sealPacket();
 }
 sealGraph();
 const evidence=()=>({binding,runtime,sourceRoot:source.sourceRoot,receiptRoot:plan.receiptRoot,graphSha256:hash(input.graphBytes),expiresAt:plan.expiresAt});
 const ports={now:()=>wall,monotonic:()=>mono,readCurrentEvidence:evidence};
 return{input,source,dependency,runtime,plan,approval,graph,binding,sealPacket,sealGraph,harness,trace,ports,setTime:(w:number,m:number)=>{wall=w;mono=m;},cleanup:()=>{delete (globalThis as any)[key];},setCode:(path:string,text:string)=>{loadFiles.find(f=>f.path===path)!.bytes=Buffer.from(text);sealGraph();}};
}

async function runFixture(f:ReturnType<typeof fixture>){try{return await createTc01Launcher(f.ports).run(f.input);}finally{f.cleanup();}}
test('미공급/위조 evidence와 다른 승인·profile·bytes는 import 전 중단한다',async()=>{
 assert.equal((await createTc01Launcher({now:()=>1,monotonic:()=>0,readCurrentEvidence:()=>undefined}).run(undefined as never)).status,'STOPPED');
 for(const change of [
  (f:ReturnType<typeof fixture>)=>{f.ports.readCurrentEvidence=()=>undefined as never;},
  (f:ReturnType<typeof fixture>)=>{const original=f.ports.readCurrentEvidence;f.ports.readCurrentEvidence=()=>({...original(),binding:{...f.binding,approvalId:'b9000000-0000-4000-8000-999999999999'}});},
  (f:ReturnType<typeof fixture>)=>{const original=f.ports.readCurrentEvidence;f.ports.readCurrentEvidence=()=>({...original(),runtime:{...f.runtime,nodeSha256:'0'.repeat(64)}});},
  (f:ReturnType<typeof fixture>)=>{f.plan.profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1';f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.input.loadFiles[0].bytes[0]^=1;},
  (f:ReturnType<typeof fixture>)=>{f.setTime(f.plan.expiresAt,0);},
 ]){const f=fixture();change(f);assert.equal((await runFixture(f)).status,'STOPPED');assert.deepEqual(f.trace,[]);}
});
test('RAM 고정 bridge 두 export→native→entry의 원 수명, 단회와 바이트 소거',async()=>{
 const f=fixture();const launcher=createTc01Launcher(f.ports);try{
  const out=await launcher.run(f.input);assert.equal(out.status,'CHECKED');assert.equal(out.authority,'NOT_ISSUED');assert.equal(out.resources,'REMOVED');
  assert.deepEqual(f.trace,['native','entry','run','current','consume','close']);assert.equal(f.harness.input.sql[0].bytes.every((b:number)=>b===0),true);assert.equal(f.input.entryInput.sql[0].bytes.toString(),'sql-owned');
  const previous=[...f.trace];assert.equal((await launcher.run(f.input)).status,'STOPPED');assert.deepEqual(f.trace,previous);
  assert.equal(typeof (await import('node:path')).resolve,'function');
 }finally{f.cleanup();}
});
test('다른 export 및 bridge가 삼킨 미등록 import도 factory 이전에 거절하고 hook 회수',async()=>{
 for(const suffix of ['export const extra=true;',"try{await import('node:os');}catch{} try{await import('node:path');}catch{}"]){
  const f=fixture();const row=f.input.loadFiles.find((r:any)=>r.path===entry);f.setCode(entry,row.bytes.toString()+suffix);
  assert.equal((await runFixture(f)).status,'STOPPED');assert.deepEqual(f.trace,[]);assert.equal(typeof (await import('node:path')).resolve,'function');
 }
});
test('현재성 상실은 새 효과를 막지만 원 close를 막지 않으며 늦은 성공은 비공개',async()=>{
 const f=fixture();f.harness.native.consume=async()=>{f.trace.push('consume');f.setTime(f.plan.expiresAt,10);};
 f.harness.onRun=async(p:any,i:any)=>{try{await p.consume(i.isolated.binding);}catch{}finally{await p.closePool({},10000);}return success();};
 const out=await runFixture(f);assert.equal(out.status,'STOPPED');assert.equal(out.fn03,'NOT_CHECKED');assert.equal(out.tc01,'NOT_STARTED');assert.equal(out.resources,'PRESERVED_OR_UNCONFIRMED');assert.deepEqual(f.trace,['native','entry','run','consume','close']);
});
test('openPool 반환 직후 만료되어도 얻은 원 Pool만 회수한다',async()=>{
 const f=fixture(),pool={};let captured:unknown;
 f.harness.native.openPool=async()=>{f.trace.push('open');f.setTime(f.plan.expiresAt,10);return pool;};f.harness.native.closePool=async(p:unknown)=>{captured=p;f.trace.push('close');};
 f.harness.onRun=async(p:any)=>{await p.openPool({});return success();};
 assert.equal((await runFixture(f)).status,'STOPPED');assert.equal(captured,pool);assert.deepEqual(f.trace,['native','entry','run','open','close']);
});
test('서로 다른 factory도 원 run이 반환하기 전에 hook을 겹쳐 등록하지 않는다',async()=>{
 const first=fixture(),second=fixture();let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>entered=r);
 first.harness.onRun=async()=>{entered();await gate;return success();};
 const active=createTc01Launcher(first.ports).run(first.input);await ready;
 try{assert.equal((await runFixture(second)).status,'STOPPED');assert.deepEqual(second.trace,[]);}finally{release();}
 assert.equal((await active).status,'CHECKED');first.cleanup();const third=fixture();assert.equal((await runFixture(third)).status,'CHECKED');
});
test('await 전 packet/native/SQL snapshot을 소유하고 caller mutation과 분리',async()=>{
 const f=fixture();const proof=structuredClone(f.ports.readCurrentEvidence());f.ports.readCurrentEvidence=()=>proof;
 f.harness.onImport=()=>{f.input.entryInput.packet.planRaw='changed';f.input.nativePreparation.sourceManifestRaw='changed';f.binding.planHash='0'.repeat(64);f.input.entryInput.sql[0].bytes.fill(7);};
 f.harness.onRun=async(_p:any,i:any)=>{assert.notEqual(i.packet.planRaw,'changed');assert.notEqual(f.harness.preparation.sourceManifestRaw,'changed');assert.equal(i.sql[0].bytes.toString(),'sql-owned');return success();};
 assert.equal((await runFixture(f)).status,'CHECKED');assert(f.harness.input.sql[0].bytes.every((b:number)=>b===0));
});
test('TC01 실패는 현재 FN03 완료만 보존하고 전체 성공/정리로 승격하지 않는다',async()=>{
 const f=fixture();f.harness.onRun=async()=>({...success(),status:'STOPPED',resources:'PRESERVED_OR_UNCONFIRMED',journeys:{fn03:'CHECKED',tc01:'STARTED',tc01Stage:'READ'}});
 const out=await runFixture(f);assert.equal(out.status,'STOPPED');assert.equal(out.fn03,'CHECKED');assert.equal(out.tc01,'STARTED');assert.equal(out.resources,'PRESERVED_OR_UNCONFIRMED');
 const bad=fixture();bad.harness.onRun=async()=>({...success(),poolClosed:false});assert.equal((await runFixture(bad)).fn03,'NOT_CHECKED');
});
test('먼저 줄어든 wall deadline은 다음 evidence로 연장할 수 없다',async()=>{
 const f=fixture();let expiresAt=1500,calls=0;const original=f.ports.readCurrentEvidence;f.ports.readCurrentEvidence=()=>{calls++;return{...original(),expiresAt};};
 f.harness.onImport=()=>{f.setTime(1600,10);expiresAt=1700;};
 const out=await runFixture(f);assert.equal(out.status,'STOPPED');assert.deepEqual(f.trace,[]);assert(calls>0);
});
test('wall 정지에서도 monotonic 기한과 import 후 현재성을 지킨다',async()=>{
 const f=fixture();f.harness.onImport=()=>{f.setTime(1001,1800000);};assert.equal((await runFixture(f)).status,'STOPPED');assert.deepEqual(f.trace,[]);
});

test('caller Proxy/getter는 평가하지 않고 첫 import 전 거절한다',async()=>{
 const f=fixture();let reads=0;try{
  const proxy=new Proxy(f.input,{get(){reads++;throw Error('raw');}});assert.equal((await createTc01Launcher(f.ports).run(proxy)).status,'STOPPED');
  Object.defineProperty(f.input,'entryInput',{get(){reads++;throw Error('raw');},enumerable:true});assert.equal((await createTc01Launcher(f.ports).run(f.input)).status,'STOPPED');assert.equal(reads,0);assert.deepEqual(f.trace,[]);
 }finally{f.cleanup();}
});
test('revoke 불명에도 임시 bytes를 소거하고 원 module lease를 유지한다',async()=>{
 const f=fixture(),original=moduleApi.registerHooks;
 moduleApi.registerHooks=((options:any)=>{const hooks=original(options);return{deregister(){hooks.deregister();throw Error('PRIVATE_REVOKE_DETAIL');}};}) as typeof original;syncBuiltinESMExports();
 try{
  const out=await runFixture(f);assert.equal(out.status,'STOPPED');assert.equal(out.fn03,'NOT_CHECKED');assert(!JSON.stringify(out).includes('PRIVATE'));assert(f.harness.input.sql[0].bytes.every((b:number)=>b===0));
 }finally{moduleApi.registerHooks=original;syncBuiltinESMExports();}
 const next=fixture();assert.equal((await runFixture(next)).status,'STOPPED');assert.deepEqual(next.trace,[]);
 // The mock really detached its hook before throwing. Production cannot infer that fact:
 // the module lease remains unavailable until its outer process owner terminates it.
 assert.equal(typeof(await import('node:path')).resolve,'function');
});
