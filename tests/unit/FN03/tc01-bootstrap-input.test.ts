import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareTc01BootstrapInput} from '../../../scripts/qa-fn03-tc01-bootstrap-input.ts';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
test('미공급 bootstrap은 고정 오류로 거절한다',()=>{assert.throws(()=>prepareTc01BootstrapInput(undefined as never),/FN03_TC01_BOOTSTRAP_INPUT_UNKNOWN/);});

const graphPath='scripts/qa-fn03-tc01-load-graph.json',entry='scripts/qa-fn03-tc01-linux-runtime.ts';
const appEntry='scripts/qa-fn03-source-content-management-origin-entry.ts',native='scripts/qa-fn03-source-content-management-origin-native.ts';
const attempt='b9000000-0000-4000-8000-000000000001',approvalId='b9000000-0000-4000-8000-000000000002';
const nodeSha='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb';
function fixture(){
 const loadFiles=[entry,appEntry,native,'node_modules/example/index.js'].sort().map(path=>({path,bytes:Buffer.from(path.endsWith('.ts')?'export const fixture=true;':'module.exports=1;')}));
 const graph:any={schemaVersion:1,entry,files:[...loadFiles.map(file=>({path:file.path,kind:'load',format:file.path.endsWith('.ts')?'module-typescript':'commonjs'})),{path:graphPath,kind:'control'},{path:'package-lock.json',kind:'control'},{path:'db/fixture.sql',kind:'nonload'}].sort((a,b)=>a.path<b.path?-1:1),builtins:[],imports:[]};
 const source:any={schemaVersion:1,sourceHead:'a'.repeat(40),sourceRoot:'/home/daon/anvil-fn03-tc01-'+attempt+'-qa',gitSha256:'b'.repeat(64),dockerSha256:'c'.repeat(64),files:[]};
 const lock=hash('synthetic lock'),dependency:any={schemaVersion:1,sourceHead:source.sourceHead,packageLockSha256:lock,files:[]};
 const runtime:any={sourceHead:source.sourceHead,entry:appEntry,nodeSha256:nodeSha,sourceClosureSha256:'',packageLockSha256:lock,installedDependenciesSha256:''};
 const plan:any={schemaVersion:1,purpose:'FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED',profile:'FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1',attemptId:attempt,sourceHead:source.sourceHead,issuedAt:1000,expiresAt:1801000,artifactRoot:'/tmp/fn03-tc01-'+attempt,receiptRoot:'/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+attempt,subnet:'172.18.0.16/28',runtime};
 const approval:any={schemaVersion:1,purpose:plan.purpose+'_RUN_APPROVAL',profile:plan.profile,decision:'ALLOW_ONE_RUN',approvalId,attemptId:attempt,planHash:'',sourceHead:source.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt};
 const binding:any={};
 const input:any={entryInput:{packet:{},isolated:{binding,receiptRoot:plan.receiptRoot,historicalTsv:undefined,legacyBytes:undefined,sources:undefined,passwords:undefined,fixture:undefined},sql:undefined},nativePreparation:{binding,runtime,sourceManifestRaw:'',dependencyManifestRaw:''},graphBytes:Buffer.alloc(0),loadFiles,now:1001};
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
 sealGraph();return{input,source,dependency,runtime,plan,approval,graph,binding,sealPacket,sealGraph};
}
const context=(parentURL?:string)=>({parentURL,conditions:['node','import'],importAttributes:{}}),loadContext={conditions:['node','import'],importAttributes:{},format:undefined};
const never=():never=>{throw Error('NO_FALLBACK');};

test('같은 packet/native/graph의 load bytes만 미등록 private loader로 넘기고 원 SQL/fixture는 읽지 않는다',()=>{
 const f=fixture();let calls=0;const unused=new Proxy({}, {get(){calls++;throw Error('PRIVATE');}});f.input.entryInput.sql=unused;f.input.entryInput.isolated.fixture=unused;
 const result=prepareTc01BootstrapInput(f.input);assert.equal(calls,0);assert(Object.isFrozen(result));assert(Object.isFrozen(result.binding));
 assert.deepEqual(Object.keys(result).sort(),['binding','graphSha256','loader','receiptRoot','runtime','sourceRoot']);assert.equal(result.loader.entryURL,'file://'+f.source.sourceRoot+'/'+entry);
 const expected=Buffer.from(f.input.loadFiles.find((row:any)=>row.path===entry).bytes);f.input.loadFiles.forEach((row:any)=>row.bytes.fill(0));f.input.graphBytes.fill(0);f.runtime.sourceClosureSha256='0'.repeat(64);f.binding.planHash='0'.repeat(64);
 result.loader.resolve(result.loader.entryURL,context(),never);const loaded=result.loader.load(result.loader.entryURL,loadContext,never);assert(Buffer.isBuffer(loaded.source));assert.deepEqual(loaded.source,expected);assert.notEqual(result.runtime.sourceClosureSha256,f.runtime.sourceClosureSha256);assert.notEqual(result.binding.planHash,f.binding.planHash);
 result.loader.assertHealthy();result.loader.revoke();assert.throws(()=>result.loader.assertHealthy());
});

test('plan/approval/native/isolated의 교차와 기한·POSIX/대역·runtime 불일치는 거절한다',()=>{
 const mutations=[
  (f:ReturnType<typeof fixture>)=>{f.input.now=f.plan.expiresAt;},
  (f:ReturnType<typeof fixture>)=>{f.input.now=999;},
  (f:ReturnType<typeof fixture>)=>{f.plan.purpose='FN03_MANAGEMENT_ORIGIN_ISOLATED';f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.plan.profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1';f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.plan.artifactRoot='/tmp/other';f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.plan.receiptRoot='/tmp/receipts';f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.plan.subnet='172.18.0.17/28';f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.plan.expiresAt++;f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.approval.attemptId=approvalId;f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.approval.profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1';f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.input.nativePreparation.binding={...f.binding,planHash:'0'.repeat(64)};},
  (f:ReturnType<typeof fixture>)=>{f.input.entryInput.isolated.binding={...f.binding,approvalId:attempt};},
  (f:ReturnType<typeof fixture>)=>{f.input.entryInput.isolated.receiptRoot+='/extra';},
  (f:ReturnType<typeof fixture>)=>{f.runtime.entry=entry;f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.runtime.nodeSha256='0'.repeat(64);f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.input.nativePreparation.runtime={...f.runtime,sourceHead:'b'.repeat(40)};},
  (f:ReturnType<typeof fixture>)=>{f.input.entryInput.packet.planRaw+=' ';},
  (f:ReturnType<typeof fixture>)=>{f.input.entryInput.packet.approvalHash='0'.repeat(64);},
 ];for(const mutate of mutations){const f=fixture();mutate(f);assert.throws(()=>prepareTc01BootstrapInput(f.input),/^Error: FN03_TC01_BOOTSTRAP_INPUT_UNKNOWN$/);}
});

test('graph의 원 길이/SHA·양 manifest partition·lock·최소 세 load 경계를 검산한다',()=>{
 const mutations=[
  (f:ReturnType<typeof fixture>)=>{f.input.graphBytes[0]^=1;},
  (f:ReturnType<typeof fixture>)=>{f.source.files=f.source.files.filter((r:any)=>r.path!==graphPath);f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.source.files.find((r:any)=>r.path===graphPath).bytes++;f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.source.files.find((r:any)=>r.path===graphPath).sha256='0'.repeat(64);f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.input.nativePreparation.sourceManifestRaw+=' ';},
  (f:ReturnType<typeof fixture>)=>{f.source.sourceRoot=f.source.sourceRoot.replace('tc01','management');f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.dependency.packageLockSha256='0'.repeat(64);f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.source.files.find((r:any)=>r.path==='package-lock.json').sha256='0'.repeat(64);f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.dependency.files.push({...f.source.files[0]});f.sealPacket();},
  (f:ReturnType<typeof fixture>)=>{f.graph.files.pop();f.sealGraph();},
  (f:ReturnType<typeof fixture>)=>{f.graph.files[1]={...f.graph.files[0]};f.sealGraph();},
  (f:ReturnType<typeof fixture>)=>{f.graph.files.find((r:any)=>r.path===graphPath).kind='nonload';f.sealGraph();},
  ...[entry,appEntry,native].map(path=>(f:ReturnType<typeof fixture>)=>{const row=f.graph.files.find((r:any)=>r.path===path);row.kind='nonload';delete row.format;f.sealGraph();}),
  (f:ReturnType<typeof fixture>)=>{f.graph.entry=appEntry;f.sealGraph();},
  (f:ReturnType<typeof fixture>)=>{f.graph.imports=[{parent:entry,specifier:'./unknown.ts',target:'scripts/unknown.ts'}];f.sealGraph();},
  (f:ReturnType<typeof fixture>)=>{f.graph.files.find((r:any)=>r.path===native).format='addon';f.sealGraph();},
 ];for(const mutate of mutations){const f=fixture();mutate(f);assert.throws(()=>prepareTc01BootstrapInput(f.input),/^Error: FN03_TC01_BOOTSTRAP_INPUT_UNKNOWN$/);}
});

test('load 원 바이트 누락/교체·nonload/control 혼입·중복을 거절한다',()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{f.input.loadFiles[0].bytes[0]^=1;},
  (f:ReturnType<typeof fixture>)=>{f.input.loadFiles.pop();},
  (f:ReturnType<typeof fixture>)=>{f.input.loadFiles[1]=f.input.loadFiles[0];},
  (f:ReturnType<typeof fixture>)=>{f.input.loadFiles.push({path:graphPath,bytes:f.input.graphBytes});},
  (f:ReturnType<typeof fixture>)=>{f.input.loadFiles[0]={path:'db/fixture.sql',bytes:Buffer.from('not-loaded')};},
 ]){const f=fixture();mutate(f);assert.throws(()=>prepareTc01BootstrapInput(f.input));}
});

test('Proxy/getter와 byte override를 간접 호출하지 않는다',()=>{
 let calls=0;const callback=()=>{calls++;throw Error('PRIVATE');};
 for(const change of [
  (f:ReturnType<typeof fixture>)=>{f.input.entryInput=new Proxy(f.input.entryInput,{ownKeys:callback});},
  (f:ReturnType<typeof fixture>)=>{Object.defineProperty(f.input.nativePreparation,'runtime',{get:callback});},
  (f:ReturnType<typeof fixture>)=>{Object.defineProperty(f.input.entryInput.packet,'planRaw',{get:callback});},
  (f:ReturnType<typeof fixture>)=>{Object.defineProperty(f.input.loadFiles[0],'bytes',{get:callback});},
  (f:ReturnType<typeof fixture>)=>{f.input.graphBytes=new Proxy(f.input.graphBytes,{get:callback});},
  (f:ReturnType<typeof fixture>)=>{f.input.nativePreparation.binding={...f.binding,attemptId:new Proxy({}, {getPrototypeOf:callback})};},
 ]){const f=fixture();change(f);assert.throws(()=>prepareTc01BootstrapInput(f.input));assert.equal(calls,0);}
 const f=fixture();for(const key of ['buffer','byteLength',Symbol.iterator])Object.defineProperty(f.input.loadFiles[0].bytes,key,{get:callback});const result=prepareTc01BootstrapInput(f.input);assert.equal(calls,0);result.loader.revoke();
});

test('R9 optional marker는 고정 값만 기존 private loader로 전달한다',()=>{
 const build=()=>{const f=fixture(),parent='scripts/qa-fn03-source-content-management-origin-isolated-ports.ts',body=Buffer.from('export const unused=true;');
  f.input.loadFiles.push({path:parent,bytes:body});f.input.loadFiles.sort((a:any,b:any)=>a.path<b.path?-1:1);f.graph.files.push({path:parent,kind:'load',format:'module-typescript'});f.graph.files.sort((a:any,b:any)=>a.path<b.path?-1:1);
  f.graph.builtins=['node:child_process','node:crypto','node:fs','node:fs/promises','node:url'];
  f.graph.legacyR9={parent,originSha256:'b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733',bytes:33478,sha256:'1ee090f4e5e46c096cec8e5f4e82c35d09c3604893a68367181cc85cdec20f1b'};f.sealGraph();return f;};
 const good=build(),result=prepareTc01BootstrapInput(good.input);result.loader.assertHealthy();result.loader.revoke();
 for(const change of [(m:any)=>{m.sha256='0'.repeat(64);},(m:any)=>{m.parent=entry;},(m:any)=>{m.bytes--;},(m:any)=>{m.callback='not-allowed';}]){const f=build();change(f.graph.legacyR9);f.sealGraph();assert.throws(()=>prepareTc01BootstrapInput(f.input));}
 const self=fixture();self.graph.sha256='0'.repeat(64);self.sealGraph();assert.throws(()=>prepareTc01BootstrapInput(self.input));
});
