import test from 'node:test';
import assert from 'node:assert/strict';
import {compileFunction} from 'node:vm';
import {posix} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {currentLegacyModuleSource,currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {createHash} from 'node:crypto';
import {createTc01PinnedLoad} from '../../../scripts/qa-fn03-tc01-pinned-load.ts';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('전부 검산 전에는 loader를 발급하지 않는다',()=>{assert.throws(()=>createTc01PinnedLoad(undefined as never),/FN03_TC01_PINNED_LOAD_UNKNOWN/);});

let sequence=0;
function fixture(){
 const attemptId='ad000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),root='/home/daon/anvil-fn03-tc01-'+attemptId+'-qa';
 const files=[{path:'entry.mjs',bytes:Buffer.from("import {answer} from './value.mjs';export default answer;")},{path:'node_modules/fixed/index.cjs',bytes:Buffer.from('module.exports=3;')},{path:'value.mjs',bytes:Buffer.from('export const answer=42;')}];
 const rows=files.map(f=>({path:f.path,bytes:f.bytes.length,sha256:sha(f.bytes),format:f.path.endsWith('.cjs')?'commonjs':'module'}));
 const manifest={schemaVersion:1,attemptId,root,entry:'entry.mjs',sources:rows.filter(r=>!r.path.startsWith('node_modules/')),dependencies:rows.filter(r=>r.path.startsWith('node_modules/')),builtins:['node:crypto'],imports:[{parent:'entry.mjs',specifier:'./value.mjs',target:'value.mjs'},{parent:'entry.mjs',specifier:'fixed',target:'node_modules/fixed/index.cjs'},{parent:'entry.mjs',specifier:'node:crypto',target:'node:crypto'}]};
 const input={attemptId,manifestSha256:'',manifestBytes:Buffer.alloc(0),files};
 const seal=()=>{input.manifestBytes=Buffer.from(JSON.stringify(manifest));input.manifestSha256=sha(input.manifestBytes);};seal();return{input,manifest,seal};
}
const context=(parentURL?:string)=>({parentURL,conditions:['node','import'],importAttributes:{}});
const loadContext={conditions:['node','import'],format:undefined,importAttributes:{}};
const never=():never=>{throw Error('UNAPPROVED_FALLBACK');};
function entered(){const f=fixture(),loader=createTc01PinnedLoad(f.input);loader.resolve(loader.entryURL,context(),never);return{...f,loader};}

test('source와 dependency 전부 SHA/길이 검산하고 원 bytes와 반환 copy의 변경을 격리',()=>{
 const f=fixture(),loader=createTc01PinnedLoad(f.input);f.input.files[0]!.bytes.fill(0);f.input.manifestBytes.fill(0);
 loader.resolve(loader.entryURL,context(),never);const first=loader.load(loader.entryURL,loadContext,never);assert(Buffer.isBuffer(first.source));
 assert.match(first.source.toString(),/answer/);first.source.fill(0);
 const second=loader.load(loader.entryURL,loadContext,never);assert(Buffer.isBuffer(second.source));assert.match(second.source.toString(),/answer/);
 loader.revoke();loader.revoke();assert.throws(()=>loader.load(loader.entryURL,loadContext,never),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);
});

test('잘못된 원 byte/형식/순서/namespace/구분/edge는 loader 발급0',()=>{
 const changes=[
  (f:ReturnType<typeof fixture>)=>{f.input.files[2]!.bytes[0]=0;},
  (f:ReturnType<typeof fixture>)=>{f.manifest.root=f.manifest.root.replace('fn03-tc01','fn03-management');f.seal();},
  (f:ReturnType<typeof fixture>)=>{f.manifest.sources[0]!.format='addon';f.seal();},
  (f:ReturnType<typeof fixture>)=>{f.manifest.sources[0]!.bytes++;f.seal();},
  (f:ReturnType<typeof fixture>)=>{f.manifest.sources.reverse();f.seal();},
  (f:ReturnType<typeof fixture>)=>{f.manifest.sources.push(f.manifest.dependencies[0]!);f.seal();},
  (f:ReturnType<typeof fixture>)=>{f.input.files.pop();},
  (f:ReturnType<typeof fixture>)=>{f.manifest.imports[0]!.specifier='./x/../value.mjs';f.seal();},
  (f:ReturnType<typeof fixture>)=>{f.manifest.imports[0]!.target='../../other.mjs';f.seal();},
  (f:ReturnType<typeof fixture>)=>{f.manifest.imports.push({...f.manifest.imports[0]!});f.seal();},
  (f:ReturnType<typeof fixture>)=>{f.manifest.builtins=['node:not_real'];f.seal();},
  (f:ReturnType<typeof fixture>)=>{f.input.manifestSha256='0'.repeat(64);},
 ];
 for(const change of changes){const f=fixture();change(f);assert.throws(()=>createTc01PinnedLoad(f.input),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);}
 const f=fixture();f.input.files[0]!.bytes=Buffer.from(new SharedArrayBuffer(f.input.files[0]!.bytes.length)) as unknown as Buffer<ArrayBuffer>;assert.throws(()=>createTc01PinnedLoad(f.input));
});

test('미등록 URL/data/remote/절대/변형/다른 parent는 고정 오류와 전체 철회',()=>{
 for(const specifier of ['data:text/javascript,export default 1','https://example.invalid/a.mjs','/tmp/a.mjs','./missing.mjs','./value.mjs?x','./%76alue.mjs','./x/../value.mjs','node:fs','other-package']){
  const {loader}=entered();assert.throws(()=>loader.resolve(specifier,context(loader.entryURL),never),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);assert.throws(()=>loader.load(loader.entryURL,loadContext,never));
 }
 const {loader}=entered();assert.throws(()=>loader.resolve('./value.mjs',context('file:///tmp/unregistered.mjs'),never));
 const other=entered();assert.throws(()=>other.loader.load(other.loader.entryURL.replace('entry','unregistered'),loadContext,never));
});

test('bare/relative/builtin은 등록 parent의 exact edge만, 형식과 attributes도 exact',()=>{
 const {loader}=entered();const dep=loader.resolve('fixed',context(loader.entryURL),never);assert.equal(dep.url,loader.entryURL.replace('entry.mjs','node_modules/fixed/index.cjs'));
 assert.equal(loader.load(dep.url,loadContext,never).format,'commonjs');
 const builtin=loader.resolve('node:crypto',context(loader.entryURL),never);let called=0;
 assert.deepEqual(loader.load(builtin.url,loadContext,(url,c)=>{called++;assert.equal(url,'node:crypto');assert.equal(c?.format,'builtin');return{format:'builtin'};}),{format:'builtin'});assert.equal(called,1);loader.revoke();
 const bad=entered();assert.throws(()=>bad.loader.load(bad.loader.entryURL,{...loadContext,format:'commonjs'},never));
 const attr=entered();assert.throws(()=>attr.loader.resolve('./value.mjs',{...context(attr.loader.entryURL),importAttributes:{type:'json'}},never));
});

test('Node24 실제 동기 hook은 합성 ESM byte만 적재하고 정상/오류 모두 해제한다',async()=>{
 const f=fixture(),loader=createTc01PinnedLoad(f.input);const handle=loader.register();
 try{const result=await import(loader.entryURL);assert.equal(result.default,42);}finally{handle.revoke();}
 assert.throws(()=>loader.register());assert.equal((await import('node:path')).posix.sep,'/');
 const bad=fixture(),broken=createTc01PinnedLoad(bad.input);broken.register();
 await assert.rejects(import(broken.entryURL+'?not-registered'),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);
 // 오류 뒤에도 명시 revoke까지 훅이 남아 후속 import를 차단한다.
 await assert.rejects(import('node:os'),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);broken.revoke();
 assert.equal((await import('node:os')).EOL.length>0,true);
});

test('전체 SHA가 맞아도 invalid UTF8/중복 JSON/비정상 형식은 거절',()=>{
 const f=fixture();f.input.files[0]!.bytes=Buffer.from([0xc0,0xaf]);f.manifest.sources[0]!.bytes=2;f.manifest.sources[0]!.sha256=sha(f.input.files[0]!.bytes);f.seal();assert.throws(()=>createTc01PinnedLoad(f.input));
 const d=fixture();d.input.manifestBytes=Buffer.from(d.input.manifestBytes.toString().replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'));d.input.manifestSha256=sha(d.input.manifestBytes);assert.throws(()=>createTc01PinnedLoad(d.input));
});

test('거절을 catch한 합성 모듈의 다음 import도 명시 revoke 전까지 차단한다',async()=>{
 const f=fixture(),source=Buffer.from("const seen=[];for(const s of ['data:text/javascript,export default 1','node:os']){try{await import(s);seen.push('OPEN');}catch(e){seen.push(e.message);}}export default seen;");
 f.input.files[0]!.bytes=source;f.manifest.sources[0]!.bytes=source.length;f.manifest.sources[0]!.sha256=sha(source);f.seal();
 const loader=createTc01PinnedLoad(f.input),handle=loader.register();
 try{const result=await import(loader.entryURL);assert.deepEqual(result.default,['FN03_TC01_PINNED_LOAD_UNKNOWN','FN03_TC01_PINNED_LOAD_UNKNOWN']);assert.throws(()=>loader.assertHealthy(),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);await assert.rejects(import('node:path'),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);}
 finally{handle.revoke();}
 assert.equal((await import('node:path')).posix.sep,'/');
});

test('caller Proxy/getter와 TypedArray 위장 접근자는 평가하지 않는다',()=>{
 let calls=0;
 const f=fixture(),top=new Proxy(f.input,{ownKeys(){calls++;throw Error('RAW');}});assert.throws(()=>createTc01PinnedLoad(top));assert.equal(calls,0);
 const getter=fixture();Object.defineProperty(getter.input,'files',{get(){calls++;throw Error('RAW');}});assert.throws(()=>createTc01PinnedLoad(getter.input));assert.equal(calls,0);
 const index=fixture();Object.defineProperty(index.input.files,'0',{get(){calls++;throw Error('RAW');}});assert.throws(()=>createTc01PinnedLoad(index.input));assert.equal(calls,0);
 const nested=fixture();Object.defineProperty(nested.input.files[0]!,'bytes',{get(){calls++;throw Error('RAW');}});assert.throws(()=>createTc01PinnedLoad(nested.input));assert.equal(calls,0);
 const proxy=fixture();proxy.input.files[0]!.bytes=new Proxy(proxy.input.files[0]!.bytes,{get(){calls++;throw Error('RAW');}});assert.throws(()=>createTc01PinnedLoad(proxy.input));assert.equal(calls,0);
 const bytes=fixture();for(const key of ['buffer','byteLength',Symbol.iterator])Object.defineProperty(bytes.input.files[0]!.bytes,key,{get(){calls++;throw Error('RAW');}});
 const loader=createTc01PinnedLoad(bytes.input);assert.equal(calls,0);loader.revoke();
});

test('합성 CJS 실제 hook: Windows parent 경로 변형은 거절하고 우회하지 않는다',async()=>{
 const f=fixture();f.input.files[0]!.bytes=Buffer.from("import answer from 'fixed';export default answer;");f.input.files[1]!.bytes=Buffer.from("module.exports=require('path').posix.sep;");
 for(const file of f.input.files){const row=[...f.manifest.sources,...f.manifest.dependencies].find(r=>r.path===file.path)!;row.bytes=file.bytes.length;row.sha256=sha(file.bytes);}
 f.manifest.builtins.push('node:path');f.manifest.imports.push({parent:'node_modules/fixed/index.cjs',specifier:'path',target:'node:path'});f.seal();
 const loader=createTc01PinnedLoad(f.input);loader.assertHealthy();const handle=loader.register();
 try{
  if(process.platform==='win32'){await assert.rejects(import(loader.entryURL),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);assert.throws(()=>loader.assertHealthy());}
  else{assert.equal((await import(loader.entryURL)).default,'/');loader.assertHealthy();}
 }finally{handle.revoke();}
 assert.throws(()=>loader.assertHealthy());
 const bad=fixture();bad.manifest.imports.push({parent:'entry.mjs',specifier:'not-a-builtin',target:'node:crypto'});bad.seal();assert.throws(()=>createTc01PinnedLoad(bad.input));
 const wrong=fixture();wrong.manifest.builtins.push('node:path');wrong.manifest.imports.push({parent:'entry.mjs',specifier:'path',target:'node:crypto'});wrong.seal();assert.throws(()=>createTc01PinnedLoad(wrong.input));
});

test('POSIX parent CJS의 bare require는 VM 합성에서 exact builtin edge를 소비한다',()=>{
 const f=fixture();f.input.files[1]!.bytes=Buffer.from("module.exports=require('path').posix.sep;");f.manifest.dependencies[0]!.bytes=f.input.files[1]!.bytes.length;f.manifest.dependencies[0]!.sha256=sha(f.input.files[1]!.bytes);
 f.manifest.builtins.push('node:path');f.manifest.imports.push({parent:'node_modules/fixed/index.cjs',specifier:'path',target:'node:path'});f.seal();
 const loader=createTc01PinnedLoad(f.input);loader.resolve(loader.entryURL,context(),never);
 const cjs=loader.resolve('fixed',context(loader.entryURL),never),loaded=loader.load(cjs.url,loadContext,never);assert(Buffer.isBuffer(loaded.source));
 const module={exports:undefined as unknown};let requireCount=0;
 compileFunction(loaded.source.toString(),['module','require'])(module,(specifier:string)=>{
  requireCount++;const c={parentURL:cjs.url,conditions:['node','require'],importAttributes:undefined} as unknown as Parameters<typeof loader.resolve>[1];
  const target=loader.resolve(specifier,c,never);assert.equal(target.url,'node:path');return{posix};
 });
 assert.equal(module.exports,'/');assert.equal(requireCount,1);loader.assertHealthy();loader.revoke();
});

test('CJS exact edge의 확장자/index 및 JSON require를 원 바이트 VM에서 사용한다',()=>{
 const f=fixture(),parent='node_modules/fixed/index.cjs';
 f.input.files[1]!.bytes=Buffer.from("module.exports=[require('./value'),require('./dir'),require('./x.json')];");
 f.manifest.dependencies[0]!.bytes=f.input.files[1]!.bytes.length;f.manifest.dependencies[0]!.sha256=sha(f.input.files[1]!.bytes);
 for(const [path,text,format]of [['node_modules/fixed/value.js','module.exports=7;','commonjs'],['node_modules/fixed/dir/index.js','module.exports=8;','commonjs'],['node_modules/fixed/x.json','{"answer":9}','json']]){
  const bytes=Buffer.from(text!);f.input.files.push({path:path!,bytes});f.manifest.dependencies.push({path:path!,bytes:bytes.length,sha256:sha(bytes),format:format!});
 }
 f.input.files.sort((a,b)=>a.path<b.path?-1:1);f.manifest.dependencies.sort((a,b)=>a.path<b.path?-1:1);
 f.manifest.imports.push({parent,specifier:'./value',target:'node_modules/fixed/value.js'},{parent,specifier:'./dir',target:'node_modules/fixed/dir/index.js'},{parent,specifier:'./x.json',target:'node_modules/fixed/x.json'});f.seal();
 const loader=createTc01PinnedLoad(f.input);loader.resolve(loader.entryURL,context(),never);const cjs=loader.resolve('fixed',context(loader.entryURL),never);
 const evaluate=(url:string):unknown=>{
  const c={conditions:['node','require'],format:undefined,importAttributes:undefined} as unknown as Parameters<typeof loader.load>[1];
  const loaded=loader.load(url,c,never);assert(Buffer.isBuffer(loaded.source));
  if(loaded.format==='json')return JSON.parse(loaded.source.toString());
  const module={exports:undefined as unknown};compileFunction(loaded.source.toString(),['module','require'])(module,(specifier:string)=>{
   const resolved=loader.resolve(specifier,{...c,parentURL:url},never);return evaluate(resolved.url);
  });return module.exports;
 };
 assert.deepEqual(evaluate(cjs.url),[7,8,{answer:9}]);loader.assertHealthy();loader.revoke();
 const esm=fixture();esm.manifest.imports[0]!.specifier='./value';esm.seal();assert.throws(()=>createTc01PinnedLoad(esm.input));
 const cjsDynamic=createTc01PinnedLoad(f.input);cjsDynamic.resolve(cjsDynamic.entryURL,context(),never);const selected=cjsDynamic.resolve('fixed',context(cjsDynamic.entryURL),never);assert.throws(()=>cjsDynamic.resolve('./value',context(selected.url),never));cjsDynamic.revoke();
});

test('고정 TS byte는 실제 hook, JSON은 exact attribute와 소유 byte를 검산한다',async()=>{
 const f=fixture();f.input.files[0]!.path='entry.ts';f.input.files[0]!.bytes=Buffer.from("const answer:number=42;export default answer;");
 f.input.files[2]!.path='value.json';f.input.files[2]!.bytes=Buffer.from('{"answer":42}');
 f.manifest.entry='entry.ts';f.manifest.sources=f.input.files.filter(r=>!r.path.startsWith('node_modules/')).map(r=>({path:r.path,bytes:r.bytes.length,sha256:sha(r.bytes),format:r.path.endsWith('.ts')?'module-typescript':'json'}));
 f.manifest.imports=[{parent:'entry.ts',specifier:'./value.json',target:'value.json'}];f.seal();
 const loader=createTc01PinnedLoad(f.input),handle=loader.register();try{assert.equal((await import(loader.entryURL)).default,42);loader.assertHealthy();}finally{handle.revoke();}
 const json=createTc01PinnedLoad(f.input);json.resolve(json.entryURL,context(),never);const jsonContext={...context(json.entryURL),importAttributes:{type:'json'}};const target=json.resolve('./value.json',jsonContext,never);const output=json.load(target.url,{...loadContext,importAttributes:{type:'json'}},never);assert(Buffer.isBuffer(output.source));assert.equal(output.source.toString(),'{"answer":42}');json.revoke();
 const invalid=createTc01PinnedLoad(f.input);invalid.resolve(invalid.entryURL,context(),never);assert.throws(()=>invalid.resolve('./value.json',context(invalid.entryURL),never));invalid.revoke();
 const huge=fixture();huge.input.manifestBytes=Buffer.alloc(2097153);huge.input.manifestSha256=sha(huge.input.manifestBytes);assert.throws(()=>createTc01PinnedLoad(huge.input));
});

const r9Parent='scripts/qa-fn03-source-content-management-origin-isolated-ports.ts';
const r9Sha='1ee090f4e5e46c096cec8e5f4e82c35d09c3604893a68367181cc85cdec20f1b';
const r9Builtins=['node:child_process','node:crypto','node:fs','node:fs/promises','node:url'];
let r9:Buffer|undefined;
function originalR9(){
 if(!r9){const raw=execFileSync('git',['cat-file','blob','ca7bd814:scripts/qa-ix01-schema-closure.sh'],{cwd:fileURLToPath(new URL('../../../',import.meta.url)),maxBuffer:65536,windowsHide:true});
  assert.equal(raw.length,35588);assert.equal(sha(raw),'b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733');
  r9=Buffer.from(currentLegacyModuleSource(raw,currentProfile.legacyHash));assert.equal(r9.length,33478);assert.equal(sha(r9),r9Sha);
 }return Buffer.from(r9);
}
function r9Fixture(){
 const f=fixture(),body=originalR9(),url='data:text/javascript;base64,'+body.toString('base64');
 const source=Buffer.from('export const legacy=await import('+JSON.stringify(url)+');');
 f.input.files=[{path:r9Parent,bytes:source}];f.manifest.entry=r9Parent;
 f.manifest.sources=[{path:r9Parent,bytes:source.length,sha256:sha(source),format:'module-typescript'}];f.manifest.dependencies=[];f.manifest.imports=[];f.manifest.builtins=[...r9Builtins];
 Object.assign(f.manifest,{legacyR9:{parent:r9Parent,originSha256:currentProfile.legacyHash,bytes:33478,sha256:r9Sha}});f.seal();
 return{...f,body,url};
}

test('명시 R9 manifest는 원 importer가 만든 exact 파생 byte만 적재한다',async()=>{
 const f=r9Fixture(),loader=createTc01PinnedLoad(f.input),handle=loader.register();
 try{const result=await import(loader.entryURL);assert.equal(typeof result.legacy.bootstrapSql,'function');assert.equal(typeof result.legacy.verifyRoleMetadata,'function');loader.assertHealthy();}
 finally{handle.revoke();}
});

test('R9 명시 결박의 누락/추가/부모·원 hash·파생 hash·길이·builtin 불일치는 발급0',()=>{
 for(const mutate of [
  (m:any)=>{m.legacyR9.parent='scripts/other.ts';},
  (m:any)=>{m.legacyR9.originSha256='0'.repeat(64);},
  (m:any)=>{m.legacyR9.sha256='0'.repeat(64);},
  (m:any)=>{m.legacyR9.bytes++;},
  (m:any)=>{m.legacyR9.other=true;},
  (m:any)=>{delete m.legacyR9.originSha256;},
  (m:any)=>{m.builtins=m.builtins.filter((v:string)=>v!=='node:fs');},
 ]){const f=r9Fixture();mutate(f.manifest);f.seal();assert.throws(()=>createTc01PinnedLoad(f.input),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);}
 const f=r9Fixture();delete (f.manifest as any).legacyR9;f.seal();const loader=createTc01PinnedLoad(f.input);loader.resolve(loader.entryURL,context(),never);assert.throws(()=>loader.resolve(f.url,context(loader.entryURL),never));assert.throws(()=>loader.assertHealthy());loader.revoke();
});

test('R9 canonical base64와 exact 본문만 허용하며 다른 data·부모·미진입은 거절한다',()=>{
 const original=r9Fixture(),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 const padIndex=alphabet.indexOf(original.url.at(-3)!);assert(padIndex>=0&&padIndex%16===0);
 const noncanonical=original.url.slice(0,-3)+alphabet[padIndex+1]+'==';
 assert.deepEqual(Buffer.from(noncanonical.slice('data:text/javascript;base64,'.length),'base64'),original.body);
 const altered=Buffer.from(original.body);altered[0]=altered[0]!^1;
 for(const url of [
  noncanonical,original.url.slice(0,-1),original.url+'\n',original.url.replace('text/javascript','application/javascript'),
  'data:text/javascript;base64,'+altered.toString('base64'),'data:text/javascript,export default 1',
  original.url+'#fragment',original.url.replace('base64,','base64, '),
 ]){const f=r9Fixture(),loader=createTc01PinnedLoad(f.input);loader.resolve(loader.entryURL,context(),never);assert.throws(()=>loader.resolve(url,context(loader.entryURL),never),/^Error: FN03_TC01_PINNED_LOAD_UNKNOWN$/);assert.throws(()=>loader.assertHealthy());loader.revoke();}
 for(const parent of ['file:///tmp/other.ts','file://'+original.manifest.root+'/scripts/other.ts']){const f=r9Fixture(),loader=createTc01PinnedLoad(f.input);loader.resolve(loader.entryURL,context(),never);assert.throws(()=>loader.resolve(f.url,context(parent),never));loader.revoke();}
 const f=r9Fixture(),loader=createTc01PinnedLoad(f.input);assert.throws(()=>loader.resolve(f.url,context(loader.entryURL),never));loader.revoke();
});

test('R9 load는 검산한 소유 copy만 반환하며 R9 parent는 원 다섯 builtin 밖으로 나가지 않는다',()=>{
 const f=r9Fixture();f.manifest.builtins.push('node:os');f.manifest.builtins.sort();f.seal();const loader=createTc01PinnedLoad(f.input);
 loader.resolve(loader.entryURL,context(),never);assert.equal(loader.resolve(f.url,context(loader.entryURL),never).url,f.url);
 const result=loader.load(f.url,loadContext,never);assert.equal(result.format,'module');assert(Buffer.isBuffer(result.source));assert.equal(result.source.length,33478);assert.equal(sha(result.source),r9Sha);
 result.source.fill(0);f.body.fill(0);const again=loader.load(f.url,loadContext,never);assert(Buffer.isBuffer(again.source));assert.equal(sha(again.source),r9Sha);
 for(const name of r9Builtins)assert.equal(loader.resolve(name,context(f.url),never).url,name);
 assert.throws(()=>loader.resolve('node:os',context(f.url),never));assert.throws(()=>loader.load(f.url,loadContext,never));loader.revoke();
 const bare=r9Fixture(),other=createTc01PinnedLoad(bare.input);other.resolve(other.entryURL,context(),never);other.resolve(bare.url,context(other.entryURL),never);assert.throws(()=>other.resolve('fs',context(bare.url),never));other.revoke();
});
