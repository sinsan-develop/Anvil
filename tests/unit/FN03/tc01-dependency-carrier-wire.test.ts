import test,{mock} from 'node:test';
import * as canonical from '../../../contracts/canonical.ts';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readTc01DependencyCarrierInput,readTc01DependencyCarrierResult} from '../../../scripts/qa-fn03-tc01-dependency-carrier-wire.ts';
const wire=(v:unknown)=>Buffer.from(canonicalJson(v)+'\n');
function fixture(){
 const binding={purpose:'TC01_DEPENDENCY_PREPARATION',attemptId:'b1000000-0000-4000-8000-000000000001',sourceHead:'a'.repeat(40),packageLockSha256:'b'.repeat(64),source:{entry:'scripts/qa-fn03-tc01-dependency-intake.ts',sha256:'c'.repeat(64),closureSha256:'d'.repeat(64)},recipe:'TC01_DEPENDENCY_RECIPE_CANDIDATE_V1',approvalSha256:'e'.repeat(64),consumptionSha256:'f'.repeat(64),issuedAt:1000,expiresAt:1801000};
 const clock={startedAt:1001,monotonicStartedAt:10,now:1100,monotonicNow:109};
 const input={schemaVersion:1,kind:'TC01_DEPENDENCY_INPUT_V1',binding,limits:{installationMs:600000,totalMs:1800000}};
 const manifest={schemaVersion:1,sourceHead:binding.sourceHead,packageLockSha256:binding.packageLockSha256,files:[{path:'node_modules/example/index.js',bytes:7,sha256:contentHash('fixture')}]};
 const result={status:'CANDIDATE_ONLY',authority:'NOT_ISSUED',manifestRaw:canonicalJson(manifest)+'\n',manifestSha256:''};
 const seal=()=>{result.manifestRaw=canonicalJson(manifest)+'\n';result.manifestSha256=contentHash(result.manifestRaw);};seal();
 const output={schemaVersion:1,kind:'TC01_DEPENDENCY_RESULT_V1',binding,result};
 return{binding,clock,input,manifest,result,output,seal};
}
const bad=(fn:()=>unknown)=>assert.throws(fn,/^Error: TC01_DEPENDENCY_CARRIER_WIRE_UNKNOWN$/);

test('exact internal input is comparison only; no lock/code/credentials or authority is produced',()=>{
 const f=fixture(),b=wire(f.input),r=readTc01DependencyCarrierInput(b,f.binding,f.clock);assert.equal(r.validation,'COMPARISON_ONLY');assert.equal(r.authority,'NOT_ISSUED');assert.deepEqual({...r.binding},f.binding);assert.deepEqual(r.limits,{installationMs:600000,totalMs:1800000});assert(Object.isFrozen(r)&&Object.isFrozen(r.binding)&&Object.isFrozen(r.binding.source));
 b.fill(0);f.binding.sourceHead='0'.repeat(40);assert.equal(r.binding.sourceHead,'a'.repeat(40));assert.equal(Object.hasOwn(r,'lockBytes'),false);assert.equal(Object.hasOwn(r,'approvalRaw'),false);
});

test('existing canonical dependency candidate survives unchanged; reader never declares installation success',()=>{
 const f=fixture(),r=readTc01DependencyCarrierResult(wire(f.output),f.binding,f.clock);assert.equal(r.validation,'COMPARISON_ONLY');assert.equal(r.authority,'NOT_ISSUED');assert.deepEqual(r.candidate,f.result);assert.equal(contentHash(r.candidate.manifestRaw),r.candidate.manifestSha256);assert(Object.isFrozen(r.candidate));assert.equal(JSON.stringify(r).includes('PASS'),false);
});

test('purpose/attempt/head/lock/source/recipe/approval/consumption must match independently held binding',()=>{
 for(const key of ['purpose','attemptId','sourceHead','packageLockSha256','recipe','approvalSha256','consumptionSha256','issuedAt','expiresAt']){const f=fixture(),expected=structuredClone(f.binding);(f.binding as any)[key]=typeof (f.binding as any)[key]==='number'?(f.binding as any)[key]+1:'0'.repeat(64);bad(()=>readTc01DependencyCarrierInput(wire(f.input),expected,f.clock));bad(()=>readTc01DependencyCarrierResult(wire(f.output),expected,f.clock));}
 for(const key of ['entry','sha256','closureSha256']){const f=fixture(),expected=structuredClone(f.binding);(f.binding.source as any)[key]=key==='entry'?'scripts/other.ts':'0'.repeat(64);bad(()=>readTc01DependencyCarrierInput(wire(f.input),expected,f.clock));}
});

test('missing/extra fields, fake READY authority and arbitrary arguments are rejected',()=>{
 for(const key of ['argv','env','lockBytes','credentials','approvalRaw']){const f=fixture();(f.input as any)[key]='PRIVATE';bad(()=>readTc01DependencyCarrierInput(wire(f.input),f.binding,f.clock));}
 for(const change of [(f:ReturnType<typeof fixture>)=>{(f.result as any).authority='VERIFIED';},(f:ReturnType<typeof fixture>)=>{f.result.status='CHECKED';},(f:ReturnType<typeof fixture>)=>{(f.output as any).executionAuthorized=true;},(f:ReturnType<typeof fixture>)=>{delete (f.result as any).manifestSha256;}]){const f=fixture();change(f);bad(()=>readTc01DependencyCarrierResult(wire(f.output),f.binding,f.clock));}
 const f=fixture();f.input.limits.installationMs++;bad(()=>readTc01DependencyCarrierInput(wire(f.input),f.binding,f.clock));f.input.limits.installationMs=600000;f.input.limits.totalMs++;bad(()=>readTc01DependencyCarrierInput(wire(f.input),f.binding,f.clock));
});

test('strict owned UTF8 canonical single LF; duplicates/BOM/CRLF/trailing bytes or oversized input0',()=>{
 const f=fixture(),s=wire(f.input).toString();for(const raw of [Buffer.from(s+'\n'),Buffer.from(s.replace(/\n$/,'\r\n')),Buffer.from(s.trimEnd()),Buffer.from(' '+s),Buffer.from('\uFEFF'+s),Buffer.from(s.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1')),Buffer.concat([Buffer.from([0xff]),Buffer.from(s)]),Buffer.alloc(16385)])bad(()=>readTc01DependencyCarrierInput(raw,f.binding,f.clock));
 bad(()=>readTc01DependencyCarrierInput(new Uint8Array(new SharedArrayBuffer(1)),f.binding,f.clock));
});

test('expected binding/clock or byte proxy/getter are not evaluated',()=>{
 const f=fixture();let calls=0;const binding=structuredClone(f.binding);Object.defineProperty(binding.source,'sha256',{get(){calls++;throw Error('PRIVATE');}});bad(()=>readTc01DependencyCarrierInput(wire(f.input),binding,f.clock));
 const clock={...f.clock};Object.defineProperty(clock,'now',{get(){calls++;throw Error('PRIVATE');}});bad(()=>readTc01DependencyCarrierResult(wire(f.output),f.binding,clock));
 const p=new Proxy(wire(f.input),{get(){calls++;throw Error('PRIVATE');}});bad(()=>readTc01DependencyCarrierInput(p,f.binding,f.clock));bad(()=>readTc01DependencyCarrierInput(wire(f.input),new Proxy(f.binding,{ownKeys(){calls++;throw Error('PRIVATE');}}),f.clock));assert.equal(calls,0);
});

test('same absolute and monotonic window; no extension/restart or forged elapsed recovery',()=>{
 for(const patch of [{now:1801000},{monotonicNow:1800009},{now:999},{now:1000},{monotonicNow:9},{startedAt:999},{startedAt:1200},{monotonicStartedAt:110}]){const f=fixture();bad(()=>readTc01DependencyCarrierInput(wire(f.input),f.binding,{...f.clock,...patch}));bad(()=>readTc01DependencyCarrierResult(wire(f.output),f.binding,{...f.clock,...patch}));}
 const f=fixture();f.binding.expiresAt++;bad(()=>readTc01DependencyCarrierInput(wire(f.input),f.binding,f.clock));
});

test('manifest exact schema/hash/HEAD/lock/order/path/row bounds, no raw file data',()=>{
 const variants=[(f:ReturnType<typeof fixture>)=>{f.result.manifestSha256='0'.repeat(64);},(f:ReturnType<typeof fixture>)=>{f.manifest.sourceHead='0'.repeat(40);f.seal();},(f:ReturnType<typeof fixture>)=>{f.manifest.packageLockSha256='0'.repeat(64);f.seal();},(f:ReturnType<typeof fixture>)=>{(f.manifest as any).authority='READY';f.seal();},(f:ReturnType<typeof fixture>)=>{f.manifest.files=[];f.seal();},(f:ReturnType<typeof fixture>)=>{f.manifest.files.push({...f.manifest.files[0]!});f.seal();},(f:ReturnType<typeof fixture>)=>{f.manifest.files[0]!.bytes=16777217;f.seal();},(f:ReturnType<typeof fixture>)=>{(f.manifest.files[0] as any).data='PRIVATE';f.seal();},(f:ReturnType<typeof fixture>)=>{f.result.manifestRaw+=' ';f.result.manifestSha256=contentHash(f.result.manifestRaw);}];
 for(const change of variants){const f=fixture();change(f);bad(()=>readTc01DependencyCarrierResult(wire(f.output),f.binding,f.clock));}
 for(const path of ['outside.js','node_modules/../x','node_modules//x','node_modules/./x','/node_modules/x','node_modules/한글','node_modules/x\\y','node_modules/x%2Fy']){const f=fixture();f.manifest.files[0]!.path=path;f.seal();bad(()=>readTc01DependencyCarrierResult(wire(f.output),f.binding,f.clock));}
 const f=fixture();f.manifest.files=Array.from({length:17},(_,i)=>({path:'node_modules/'+String(i).padStart(2,'0'),bytes:16777216,sha256:'0'.repeat(64)}));f.seal();bad(()=>readTc01DependencyCarrierResult(wire(f.output),f.binding,f.clock));
});

test('manifest2MiB and wire cap are separate; truncated/UNKNOWN result cannot emit candidate',()=>{
 const f=fixture();f.result.manifestRaw='x'.repeat(2097153);f.result.manifestSha256=contentHash(f.result.manifestRaw);bad(()=>readTc01DependencyCarrierResult(wire(f.output),f.binding,f.clock));
 bad(()=>readTc01DependencyCarrierResult(Buffer.alloc(4210689),f.binding,f.clock));const g=fixture(),full=wire(g.output);bad(()=>readTc01DependencyCarrierResult(full.subarray(0,full.length-10),g.binding,g.clock));(g.output as any).result={status:'UNKNOWN',code:'DEPENDENCY_INTAKE_UNKNOWN',authority:'NOT_ISSUED'};bad(()=>readTc01DependencyCarrierResult(wire(g.output),g.binding,g.clock));
});

test('a prior file cannot become a directory even with an intervening sorted sibling',()=>{
 const f=fixture();f.manifest.files=['node_modules/x','node_modules/x-','node_modules/x/y'].map(path=>({path,bytes:1,sha256:contentHash('x')}));f.seal();
 bad(()=>readTc01DependencyCarrierResult(wire(f.output),f.binding,f.clock));
 f.manifest.files=['node_modules/x-','node_modules/x/y','node_modules/x/z'].map(path=>({path,bytes:1,sha256:contentHash('x')}));f.seal();
 assert.deepEqual(readTc01DependencyCarrierResult(wire(f.output),f.binding,f.clock).candidate,f.result);
});

test('bounded quote-aware structure rejects before common parser and keeps near-2MiB manifest',async()=>{
 let calls=0;const handle=mock.module(new URL('../../../contracts/canonical.ts',import.meta.url).href,{namedExports:{...canonical,parseWireJson:(raw:string)=>{calls++;return canonical.parseWireJson(raw);}}});
 try{
  const url=new URL('../../../scripts/qa-fn03-tc01-dependency-carrier-wire.ts?structure-bound',import.meta.url);const reader=await import(url.href);
  const f=fixture();let nested:unknown=0;for(let i=0;i<17;i++)nested=[nested];
  bad(()=>reader.readTc01DependencyCarrierInput(wire({...f.input,nested}),f.binding,f.clock));assert.equal(calls,0);
  bad(()=>reader.readTc01DependencyCarrierResult(wire({...f.output,surplus:Array(160129).fill(0)}),f.binding,f.clock));assert.equal(calls,0);
  const deep=fixture();deep.result.manifestRaw=canonicalJson(nested)+'\n';deep.result.manifestSha256=contentHash(deep.result.manifestRaw);bad(()=>reader.readTc01DependencyCarrierResult(wire(deep.output),deep.binding,deep.clock));assert.equal(calls,1);calls=0;
  f.manifest.files=Array.from({length:18000},(_,i)=>({path:'node_modules/'+String(i).padStart(5,'0'),bytes:0,sha256:'0'.repeat(64)}));f.seal();
  assert(Buffer.byteLength(f.result.manifestRaw)>2097152*0.98&&Buffer.byteLength(f.result.manifestRaw)<=2097152);
  assert.deepEqual(reader.readTc01DependencyCarrierResult(wire(f.output),f.binding,f.clock).candidate,f.result);assert.equal(calls,2);
 }finally{handle.restore();}
});
