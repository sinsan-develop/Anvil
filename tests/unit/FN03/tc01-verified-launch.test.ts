import test from 'node:test';
import assert from 'node:assert/strict';
import {posix} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {readManagementOriginSchemaManifest} from '../../integration/FN03/source-content-management-origin-schema.ts';
import type {Tc01PreloadFilesPort} from '../../../scripts/qa-fn03-tc01-preload-files.ts';
import {createHash} from 'node:crypto';
import {createTc01VerifiedLaunch,createTc01LocalVerifiedLaunch} from '../../../scripts/qa-fn03-tc01-verified-launch.ts';
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const success=()=>({status:'CHECKED',stage:'DONE',reason:'JOURNEY_CHECKED',authority:'NOT_ISSUED',appClosed:true,poolClosed:true,resources:'REMOVED',journeys:{fn03:'CHECKED',tc01:'CHECKED',tc01Stage:'DONE'}});
// Synthetic modules expose no real native/provider calls or authority. Unique roots avoid module-cache reuse.
const graphPath='scripts/qa-fn03-tc01-load-graph.json',entry='scripts/qa-fn03-tc01-linux-runtime.ts';
const appEntry='scripts/qa-fn03-source-content-management-origin-entry.ts',native='scripts/qa-fn03-source-content-management-origin-native.ts';
let sequence=0;const approvalId='ba000000-0000-4000-8000-000000000002';
const nodeSha='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb';
function fixture(){
 const attempt='ba000000-0000-4000-8000-'+String(++sequence).padStart(12,'0');
 const key='FN03_VERIFIED_RAM_'+attempt;const trace:string[]=[];let wall=1001,mono=0;
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

// 저장소/OS를 읽지 않는 승인 입력 모형. 원 파일 포트가 받은 실제 Buffer를 추적한다.
function filesFixture(f:ReturnType<typeof fixture>,extra:readonly {path:string;bytes:Buffer}[]=[]){
 const root=f.source.sourceRoot as string;
 const contents=new Map<string,Buffer>([...extra.map(r=>[r.path,Buffer.from(r.bytes)]),...f.input.loadFiles.map((r:any)=>[r.path,Buffer.from(r.bytes)]),[graphPath,Buffer.from(f.input.graphBytes)],['package-lock.json',Buffer.from('synthetic lock')],['db/fixture.sql',Buffer.from('not-loaded')]] as [string,Buffer][]);
 let inode=1,fd=10;const nodes=new Map<string,any>(),handles=new Map<number,string>(),trace:{op:string;path?:string;fd?:number}[]=[],buffers:Buffer[]=[];
 const metadata=(dir:boolean,size=0)=>({dev:1,ino:inode++,uid:1000,gid:1000,mode:dir?0o040755:0o100644,size,mtimeMs:1,ctimeMs:1,nlink:dir?2:1});
 for(const [relative,data]of contents){const path=root+'/'+relative;let parent=posix.dirname(path);while(parent!=='/'){if(!nodes.has(parent))nodes.set(parent,{...metadata(true),uid:['/home','/home/daon'].includes(parent)?0:1000});parent=posix.dirname(parent);}nodes.set(path,metadata(false,data.length));}nodes.get(root).mode=0o040700;
 const hooks={before:(_op:string,_path:string)=>{},afterRead:(_path:string)=>{},current:()=>{},close:()=>{}};
 const access=(op:string,path:string)=>{trace.push({op,path});hooks.before(op,path);const stat=nodes.get(path);if(!stat)throw Error('PRIVATE_MISSING');return stat;};
 const io:Tc01PreloadFilesPort={context:()=>({platform:'linux',uid:1000}),lstat:path=>({...access('lstat',path)}),fstat:n=>{const path=handles.get(n);if(!path)throw Error('PRIVATE_FD');return{...access('fstat',path)};},realpath:path=>{access('realpath',path);return path;},
  open:path=>{access('open',path);const n=fd++;handles.set(n,path);return n;},read:(n,b,o,len,p)=>{const path=handles.get(n)!;access('read',path);if(!buffers.includes(b))buffers.push(b);const data=contents.get(path.slice(root.length+1))!,count=Math.min(len,Math.max(0,data.length-p));data.copy(b,o,p,p+count);hooks.afterRead(path);return count;},close:n=>{trace.push({op:'close',fd:n});assert(handles.has(n));handles.delete(n);hooks.close();},readdir:path=>{access('readdir',path);return [...nodes.keys()].filter(p=>posix.dirname(p)===path).map(p=>posix.basename(p));}};
 const binding=structuredClone(f.binding),runtime=structuredClone(f.runtime);
 const supervisor={...f.ports,assertCurrent:(b:Readonly<Record<string,unknown>>,r:Readonly<Record<string,unknown>>)=>{assert.deepEqual({...b},binding);assert.deepEqual({...r},runtime);hooks.current();}};
 const input={entryInput:f.input.entryInput,nativePreparation:f.input.nativePreparation,retainPaths:[graphPath,...f.input.loadFiles.map((r:any)=>r.path)].sort()};
 return{root,contents,nodes,handles,trace,buffers,hooks,io,supervisor,input};
}
const cleared=(d:ReturnType<typeof filesFixture>)=>{assert.equal(d.handles.size,0);assert(d.buffers.every(b=>b.every(x=>x===0)));assert.equal(d.trace.filter(t=>t.op==='open').length,d.trace.filter(t=>t.op==='close').length);};
async function run(f:ReturnType<typeof fixture>,d:ReturnType<typeof filesFixture>){try{return await createTc01VerifiedLaunch(d.supervisor,d.io).run(d.input);}finally{f.cleanup();cleared(d);}}

test('미공급 입력·파일 포트는 기본 native 포트 없이 중단한다',async()=>{
 assert.equal((await createTc01VerifiedLaunch({} as never,{} as never).run(undefined as never)).status,'STOPPED');
 const f=fixture(),d=filesFixture(f);try{assert.equal((await createTc01VerifiedLaunch(d.supervisor,undefined as never).run(d.input)).status,'STOPPED');assert.equal(d.trace.length,0);assert.deepEqual(f.trace,[]);}finally{f.cleanup();}
});
test('같은 RAM preload 원 바이트→실제 hook→bridge→기존 launcher, 단회·원 Buffer 소거',async()=>{
 const f=fixture(),d=filesFixture(f),launcher=createTc01VerifiedLaunch(d.supervisor,d.io);assert.equal(d.trace.length,0);
 f.harness.onRun=async(p:any,i:any)=>{const before=d.trace.length;for(let n=0;n<3;n++)p.assertCurrent(i.isolated.binding);await p.consume(i.isolated.binding);await p.closePool({},10000);assert.equal(d.trace.length,before,'실행 중 전체 파일 재검사0');return success();};
 try{const out=await launcher.run(d.input);assert.equal(out.status,'CHECKED');assert.equal(out.authority,'NOT_ISSUED');assert.equal(out.fn03,'CHECKED');assert.equal(out.tc01,'CHECKED');assert.equal(out.resources,'REMOVED');
  assert.deepEqual(f.trace,['native','entry','run','current','current','current','consume','close']);cleared(d);
  assert.equal(d.trace.filter(x=>x.op==='open').length,d.contents.size,'행당 최초 read 1회');
  assert.equal(d.trace.filter(x=>x.op==='readdir'&&x.path===d.root+'/node_modules').length,4,'최초/최초완료/복사직전/성공직전만 재검산');
  assert(f.harness.input.sql[0].bytes.every((b:number)=>b===0));assert.equal(f.input.entryInput.sql[0].bytes.toString(),'sql-owned');assert(d.contents.get(graphPath)!.some(x=>x!==0));
  const calls=d.trace.length;assert.equal((await launcher.run(d.input)).status,'STOPPED');assert.equal(d.trace.length,calls);assert.equal(typeof (await import('node:path')).resolve,'function');
 }finally{f.cleanup();}
});
test('미보유 graph/load·오염 승인 graph는 import 전 거절하고 원 bytes 소거',async()=>{
 for(const change of [
  (f:ReturnType<typeof fixture>)=>{},
  (f:ReturnType<typeof fixture>)=>{f.graph.files.find((r:any)=>r.path===appEntry).kind='nonload';delete f.graph.files.find((r:any)=>r.path===appEntry).format;f.sealGraph();},
 ]){const f=fixture();change(f);const d=filesFixture(f);if(f.graph.files.find((r:any)=>r.path===appEntry).kind==='load')d.input.retainPaths=d.input.retainPaths.filter((p:string)=>p!==native);assert.equal((await run(f,d)).status,'STOPPED');assert.deepEqual(f.trace,[]);}
 const f=fixture(),d=filesFixture(f);d.input.retainPaths=d.input.retainPaths.filter((p:string)=>p!==graphPath);assert.equal((await run(f,d)).status,'STOPPED');assert.deepEqual(f.trace,[]);
});
test('파일 변조·원 close 불명·현재성 상실은 뒤 import0·소거',async()=>{
 for(const mode of ['bytes','close','current'] as const){const f=fixture(),d=filesFixture(f);
  if(mode==='bytes')d.contents.get(graphPath)![0]=d.contents.get(graphPath)![0]!^1;
  if(mode==='close')d.hooks.close=()=>{throw Error('PRIVATE_CLOSE');};
  if(mode==='current')d.hooks.current=()=>{throw Error('PRIVATE_AUTH');};
  const out=await run(f,d);assert.equal(out.status,'STOPPED');assert.deepEqual(f.trace,[]);assert(!JSON.stringify(out).includes('PRIVATE'));if(mode==='current')assert.equal(d.trace.length,0);
 }
});
test('마지막 설치 변경은 성공을 숨기되 이미 원 close된 연결을 다시 사용하지 않는다',async()=>{
 const f=fixture(),d=filesFixture(f);f.harness.onRun=async(p:any)=>{await p.closePool({},10000);d.nodes.get(d.root+'/'+native).ino++;return success();};
 const out=await run(f,d);assert.equal(out.status,'STOPPED');assert.equal(out.resources,'PRESERVED_OR_UNCONFIRMED');assert.equal(out.fn03,'NOT_CHECKED');assert.equal(f.trace.filter(t=>t==='close').length,1);
});
test('실행 중 만료에도 원 close를 회수하고 늦은 성공은 공개하지 않는다',async()=>{
 const f=fixture(),d=filesFixture(f);f.harness.onRun=async(p:any,i:any)=>{f.setTime(f.plan.expiresAt,2);try{await p.consume(i.isolated.binding);}catch{}finally{await p.closePool({},10000);}return success();};
 const out=await run(f,d);assert.equal(out.status,'STOPPED');assert.equal(out.fn03,'NOT_CHECKED');assert.equal(out.tc01,'NOT_STARTED');assert.equal(f.trace.includes('consume'),false);assert.equal(f.trace.filter(t=>t==='close').length,1);
});
test('기존 STOPPED의 FN03 완료 근거는 보존하고 실패 후 전체 파일 추가조회0',async()=>{
 const f=fixture(),d=filesFixture(f);let count=0;f.harness.onRun=async(p:any)=>{await p.closePool({},10000);count=d.trace.length;return{...success(),status:'STOPPED',stage:'JOURNEY',reason:'JOURNEY_UNKNOWN',resources:'PRESERVED_OR_UNCONFIRMED',journeys:{fn03:'CHECKED',tc01:'STARTED',tc01Stage:'READ'}};};
 const out=await run(f,d);assert.equal(out.status,'STOPPED');assert.equal(out.fn03,'CHECKED');assert.equal(d.trace.length,count);
});
test('preload callback 이전 소유 입력 snapshot과 caller mutation 분리·getter 실행0',async()=>{
 const f=fixture(),d=filesFixture(f),proof=structuredClone(d.supervisor.readCurrentEvidence());d.supervisor.readCurrentEvidence=()=>proof;
 let changed=false;d.hooks.afterRead=()=>{if(changed)return;changed=true;f.input.entryInput.packet.planRaw='changed';f.input.nativePreparation.sourceManifestRaw='changed';f.input.entryInput.sql[0].bytes.fill(7);};
 f.harness.onRun=async(_p:any,i:any)=>{assert.notEqual(i.packet.planRaw,'changed');assert.equal(i.sql[0].bytes.toString(),'sql-owned');return success();};assert.equal((await run(f,d)).status,'CHECKED');
 const g=fixture(),e=filesFixture(g);let getters=0;Object.defineProperty(e.input.entryInput,'packet',{enumerable:true,get(){getters++;throw Error('PRIVATE');}});assert.equal((await run(g,e)).status,'STOPPED');assert.equal(getters,0);assert.equal(e.trace.length,0);
});

test('명시 local 입력 생산 진입은 미공급 입력에서 효과0',async()=>{assert.equal((await createTc01LocalVerifiedLaunch({} as never,{} as never).run(undefined as never)).status,'STOPPED');});

function originals(){
 const cwd=fileURLToPath(new URL('../../../',import.meta.url)),git=(args:string[],input?:string)=>execFileSync('git',args,{cwd,input,windowsHide:true,maxBuffer:32*1024*1024});
 const tsv=git(['cat-file','blob','e1dbd8b8:'+currentProfile.manifest]),rows=readManagementOriginSchemaManifest(tsv);
 const paths=[currentProfile.manifest,currentProfile.legacy,currentProfile.forms,currentProfile.standard,currentProfile.methods,...rows.map(r=>r.path)],batch=git(['cat-file','--batch'],paths.map(p=>'e1dbd8b8:'+p).join('\n')+'\n');let cursor=0;
 const files=paths.map(path=>{const end=batch.indexOf(10,cursor),match=/^[a-f0-9]{40} blob ([1-9][0-9]*)$/.exec(batch.subarray(cursor,end).toString('ascii'));assert(match);const start=end+1;cursor=start+Number(match[1]);assert.equal(batch[cursor++],10);return{path,bytes:Buffer.from(batch.subarray(start,cursor-1))};});assert.equal(cursor,batch.length);return{files,rows};
}
let localOriginals:ReturnType<typeof originals>|undefined;

function localFixture(){
 const f=fixture(),original=localOriginals??=originals();
 for(const row of original.files)f.graph.files.push({path:row.path,kind:'nonload'});f.graph.files.sort((a:any,b:any)=>a.path<b.path?-1:1);f.sealGraph();
 f.source.files.push(...original.files.map(r=>({path:r.path,bytes:r.bytes.length,sha256:hash(r.bytes)})));f.source.files.sort((a:any,b:any)=>a.path<b.path?-1:1);f.sealPacket();
 const d=filesFixture(f,original.files),entropy:Uint8Array[]=[];const hooks={entropy:()=>{}};
 const supervisor={...d.supervisor,fillSyntheticEntropy(target:Uint8Array){entropy.push(target);for(let i=0;i<target.length;i++)target[i]=(i*13+7)%256;hooks.entropy();}};
 const input={packet:f.input.entryInput.packet,nativePreparation:f.input.nativePreparation,retainPaths:[...d.input.retainPaths,...original.files.map(r=>r.path)].sort()};
 return{f,d,supervisor,input,entropy,hooks,rows:original.rows};
}
function localCleared(h:ReturnType<typeof localFixture>){cleared(h.d);assert(h.entropy.every(b=>b.every(x=>x===0)));if(h.f.harness.input){const input=h.f.harness.input;assert(input.isolated.fixture.access.key.every((b:number)=>b===0));assert(input.sql.every((r:any)=>r.bytes.every((b:number)=>b===0)));assert(Object.values(input.isolated.sources).every((b:any)=>b.every((x:number)=>x===0)));}}
async function runLocal(h:ReturnType<typeof localFixture>){try{return await createTc01LocalVerifiedLaunch(h.supervisor,h.d.io).run(h.input);}finally{h.f.cleanup();localCleared(h);}}
test('단회 preload→원 132/공식3문서 local producer→실제 RAM hook launcher 및 전체 소거',async()=>{
 const h=localFixture(),{f,d}=h,runner=createTc01LocalVerifiedLaunch(h.supervisor,d.io);assert.equal(d.trace.length,0);assert.equal(h.entropy.length,0);
 f.harness.onRun=async(p:any,i:any)=>{const ioBefore=d.trace.length;assert.equal(i.sql.length,132);assert.deepEqual(i.sql.map((r:any)=>({id:r.id,path:r.path,bytes:r.bytes.length,sha256:hash(r.bytes)})),h.rows);assert.equal(hash(i.isolated.sources.forms),hash(d.contents.get(currentProfile.forms)!));assert.equal(hash(i.isolated.sources.standard),hash(d.contents.get(currentProfile.standard)!));assert.equal(hash(i.isolated.sources.methods),hash(d.contents.get(currentProfile.methods)!));assert.equal(i.isolated.fixture.methodologyRef.version,2);assert.equal(i.isolated.fixture.credentialGeneration,1);assert.equal(i.isolated.fixture.origin,'https://anvil.invalid');assert.equal(Object.keys(i.isolated.passwords).length,3);p.assertCurrent(i.isolated.binding);await p.consume(i.isolated.binding);await p.closePool({},10000);assert.equal(d.trace.length,ioBefore,'실행 중 파일 재읽기/전체 재검사0');return success();};
 try{const out=await runner.run(h.input);assert.equal(out.status,'CHECKED');assert.equal(out.authority,'NOT_ISSUED');assert.deepEqual(Object.keys(out).sort(),['status','stage','code','authority','fn03','tc01','appClosed','poolClosed','resources'].sort());assert.equal(h.entropy.length,1);assert.equal(d.trace.filter(t=>t.op==='open').length,d.contents.size);assert.equal(d.trace.filter(t=>t.op==='readdir'&&t.path===d.root+'/node_modules').length,5);assert(!JSON.stringify(out).includes('fixture'));assert(!JSON.stringify(out).includes('anvil.invalid'));localCleared(h);const calls=d.trace.length;assert.equal((await runner.run(h.input)).status,'STOPPED');assert.equal(d.trace.length,calls);assert.equal(h.entropy.length,1);}finally{f.cleanup();}
});
test('local 원 자료 미보유/오염·raw fixture 혼입은 fallback 없이 import0',async()=>{
 for(const mode of ['retain','bytes','raw','port'] as const){const h=localFixture();
  if(mode==='retain')h.input.retainPaths=h.input.retainPaths.filter((p:string)=>p!==h.rows[131]!.path);
  if(mode==='bytes')h.d.contents.get(currentProfile.methods)!.fill(0);
  if(mode==='raw')(h.input as any).entryInput=h.f.input.entryInput;
  if(mode==='port')delete (h.supervisor as any).fillSyntheticEntropy;
  const out=await runLocal(h);assert.equal(out.status,'STOPPED');assert.deepEqual(h.f.trace,[]);assert.equal(h.entropy.length,0);
 }
});
test('local entropy 실패·만료/교체에서는 import0, 재시도0·원 seed 소거',async()=>{
 for(const mode of ['failure','late','replace'] as const){const h=localFixture();h.hooks.entropy=()=>{if(mode==='failure')throw Error('PRIVATE_ENTROPY');if(mode==='late')h.f.setTime(h.f.plan.expiresAt,0);if(mode==='replace')h.supervisor.fillSyntheticEntropy=()=>{};};const out=await runLocal(h);assert.equal(out.status,'STOPPED');assert.deepEqual(h.f.trace,[]);assert.equal(h.entropy.length,1);assert(!JSON.stringify(out).includes('PRIVATE'));}
});
test('local 실행 실패/늦은 성공·최종 파일 변경에도 원 close와 소거를 유지',async()=>{
 for(const mode of ['stopped','late','changed'] as const){const h=localFixture();h.f.harness.onRun=async(p:any)=>{await p.closePool({},10000);if(mode==='late')h.f.setTime(h.f.plan.expiresAt,0);if(mode==='changed')h.d.nodes.get(h.d.root+'/'+currentProfile.forms).ino++;return mode==='stopped'?{...success(),status:'STOPPED',resources:'PRESERVED_OR_UNCONFIRMED',journeys:{fn03:'CHECKED',tc01:'STARTED',tc01Stage:'READ'}}:success();};const out=await runLocal(h);assert.equal(out.status,'STOPPED');assert.equal(out.fn03,mode==='stopped'?'CHECKED':'NOT_CHECKED');assert.equal(out.resources,'PRESERVED_OR_UNCONFIRMED');assert.equal(h.f.trace.filter(t=>t==='close').length,1);}
});
