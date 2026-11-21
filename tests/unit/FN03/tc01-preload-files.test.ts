import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {createTc01PreloadFiles,type Tc01PreloadFilesPort} from '../../../scripts/qa-fn03-tc01-preload-files.ts';
const sha=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const attempt='a1000000-0000-4000-8000-000000000001',root='/home/daon/anvil-fn03-tc01-'+attempt+'-qa';
 const binding:any={attemptId:attempt,approvalId:'a1000000-0000-4000-8000-000000000002',planHash:'1'.repeat(64),approvalHash:'2'.repeat(64),sourceHead:'a'.repeat(40),issuedAt:1000,expiresAt:2000,artifactRoot:'/tmp/fn03-tc01-'+attempt,subnet:'172.18.0.16/28',purpose:'FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED',profile:'FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1'};
 const contents=new Map<string,Buffer>([['package-lock.json',Buffer.from('lock')],['scripts/runtime.ts',Buffer.from('export const mock=true;')],['node_modules/example/index.js',Buffer.from('module.exports=1;')]]);
 const runtime:any={sourceHead:binding.sourceHead,entry:'scripts/qa-fn03-source-content-management-origin-entry.ts',nodeSha256:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb',sourceClosureSha256:'',packageLockSha256:sha('lock'),installedDependenciesSha256:''};
 const source:any={schemaVersion:1,sourceHead:binding.sourceHead,sourceRoot:root,gitSha256:'3'.repeat(64),dockerSha256:'4'.repeat(64),files:[]},dependency:any={schemaVersion:1,sourceHead:binding.sourceHead,packageLockSha256:runtime.packageLockSha256,files:[]};
 const preparation:any={binding,runtime,sourceManifestRaw:'',dependencyManifestRaw:''};
 const input={preparation,retainPaths:['scripts/runtime.ts']};
 function seal(){const rows=[...contents].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes)})).sort((a,b)=>a.path<b.path?-1:1);source.files=rows.filter(r=>!r.path.startsWith('node_modules/'));dependency.files=rows.filter(r=>r.path.startsWith('node_modules/'));sealManifests();}
 function sealManifests(){preparation.sourceManifestRaw=JSON.stringify(source);preparation.dependencyManifestRaw=JSON.stringify(dependency);runtime.sourceClosureSha256=sha(preparation.sourceManifestRaw);runtime.installedDependenciesSha256=sha(preparation.dependencyManifestRaw);}
 let inode=1,wall=1001,mono=0,fd=10;const nodes=new Map<string,any>(),handles=new Map<number,string>(),trace:{op:string;path?:string;fd?:number}[]=[],buffers:Buffer[]=[];
 const metadata=(dir:boolean,size=0)=>({dev:1,ino:inode++,uid:1000,gid:1000,mode:dir?0o040755:0o100644,size,mtimeMs:1,ctimeMs:1,nlink:dir?2:1});
 function build(){nodes.clear();for(const [relative,data]of contents){const path=root+'/'+relative;let parent=posix.dirname(path);while(parent!=='/'){if(!nodes.has(parent))nodes.set(parent,{...metadata(true),uid:['/home','/home/daon'].includes(parent)?0:1000});parent=posix.dirname(parent);}nodes.set(path,{...metadata(false,data.length)});}nodes.get(root).mode=0o040700;}
 const hooks:any={before:(_op:string,_path:string)=>{},afterRead:(_path:string)=>{},close:()=>{},current:()=>{},context:()=>({platform:'linux',uid:1000})};
 const access=(op:string,path:string)=>{trace.push({op,path});hooks.before(op,path);const stat=nodes.get(path);if(!stat)throw Error('PRIVATE_MISSING');return stat;};
 const io:Tc01PreloadFilesPort={context:()=>hooks.context(),lstat:path=>({...access('lstat',path)}),fstat:n=>{const path=handles.get(n);if(!path)throw Error('PRIVATE_FD');return{...access('fstat',path)};},realpath:path=>{access('realpath',path);return path;},
  open:path=>{access('open',path);const n=fd++;handles.set(n,path);return n;},
  read:(n,b,o,len,p)=>{const path=handles.get(n)!;access('read',path);if(!buffers.includes(b))buffers.push(b);const data=contents.get(path.slice(root.length+1))!,count=Math.min(len,Math.max(0,data.length-p));data.copy(b,o,p,p+count);hooks.afterRead(path);return count;},
  close:n=>{trace.push({op:'close',fd:n});assert(handles.has(n));handles.delete(n);hooks.close();},
  readdir:path=>{access('readdir',path);return [...nodes.keys()].filter(p=>posix.dirname(p)===path).map(p=>posix.basename(p));}};
 const supervisor={now:()=>wall,monotonic:()=>mono,assertCurrent:(b:Readonly<Record<string,unknown>>,r:Readonly<Record<string,unknown>>)=>{assert.deepEqual({...b},binding);assert.deepEqual({...r},runtime);hooks.current();}};
 seal();build();return{input,source,dependency,preparation,binding,runtime,root,contents,nodes,handles,trace,buffers,hooks,io,supervisor,seal,sealManifests,build,setTime:(w:number,m:number)=>{wall=w;mono=m;}};
}
const zero=(f:ReturnType<typeof fixture>)=>assert(f.buffers.every(b=>b.every(x=>x===0)));
const stopped=(f:ReturnType<typeof fixture>)=>{assert.throws(()=>createTc01PreloadFiles(f.supervisor,f.io).read(f.input),/^Error: FN03_TC01_PRELOAD_UNKNOWN$/);assert.equal(f.handles.size,0);zero(f);};

test('factory 생성 효과0, 정상 모든 행 검산·부분 보유 및 명시 소거·단회',()=>{
 const f=fixture(),reader=createTc01PreloadFiles(f.supervisor,f.io);assert.equal(f.trace.length,0);const out=reader.read(f.input);
 assert.deepEqual(out.files.map(x=>x.path),['scripts/runtime.ts']);assert.equal(out.files[0]!.bytes.toString(),'export const mock=true;');assert.equal(f.trace.filter(x=>x.op==='open').length,3);assert.equal(f.trace.filter(x=>x.op==='close').length,3);assert.equal(f.handles.size,0);assert(f.buffers.includes(out.files[0]!.bytes));
 const other=f.buffers.filter(b=>b!==out.files[0]!.bytes);assert(other.every(b=>b.every(x=>x===0)));out.assertCurrent();out.dispose();out.dispose();zero(f);const count=f.trace.length;assert.throws(()=>out.assertCurrent());assert.throws(()=>reader.read(f.input));assert.equal(f.trace.length,count);
});
test('미공급·교차 binding/runtime/root/hash/lock/manifest 형상은 파일 효과0',()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{f.input.preparation=undefined;},
  (f:ReturnType<typeof fixture>)=>{f.binding.purpose='OTHER';},
  (f:ReturnType<typeof fixture>)=>{f.runtime.sourceHead='b'.repeat(40);},
  (f:ReturnType<typeof fixture>)=>{f.source.sourceRoot+='/other';f.sealManifests();},
  (f:ReturnType<typeof fixture>)=>{f.preparation.sourceManifestRaw+=' ';},
  (f:ReturnType<typeof fixture>)=>{f.dependency.packageLockSha256='f'.repeat(64);f.sealManifests();},
  (f:ReturnType<typeof fixture>)=>{f.source.files[0].path='../outside';f.sealManifests();},
  (f:ReturnType<typeof fixture>)=>{f.source.files[0].bytes=16777217;f.sealManifests();},
  (f:ReturnType<typeof fixture>)=>{f.source.files.push(f.source.files[0]);f.sealManifests();},
  (f:ReturnType<typeof fixture>)=>{f.input.retainPaths=['unapproved'];},
  (f:ReturnType<typeof fixture>)=>{f.input.retainPaths=['scripts/runtime.ts','scripts/runtime.ts'];},
 ]){const f=fixture();mutate(f);stopped(f);assert.equal(f.trace.length,0);}
});
test('Linux/UID·외부 현재 승인·만료 전제 없으면 파일 접근0',()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{f.hooks.context=()=>({platform:'win32',uid:1000});},
  (f:ReturnType<typeof fixture>)=>{f.hooks.context=()=>({platform:'linux',uid:0});},
  (f:ReturnType<typeof fixture>)=>{f.hooks.current=()=>{throw Error('PRIVATE_APPROVAL');};},
  (f:ReturnType<typeof fixture>)=>{f.setTime(2000,0);},
 ]){const f=fixture();mutate(f);stopped(f);assert.equal(f.trace.length,0);}
});
test('symlink/hardlink/UID/쓰기 가능한 mode·부모 이탈은 원 파일 open0',()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{f.nodes.get(f.root+'/package-lock.json').mode=0o120777;},
  (f:ReturnType<typeof fixture>)=>{f.nodes.get(f.root+'/package-lock.json').nlink=2;},
  (f:ReturnType<typeof fixture>)=>{f.nodes.get(f.root+'/package-lock.json').uid=0;},
  (f:ReturnType<typeof fixture>)=>{f.nodes.get(f.root+'/package-lock.json').mode=0o100666;},
  (f:ReturnType<typeof fixture>)=>{f.nodes.get(f.root).mode=0o040755;},
  (f:ReturnType<typeof fixture>)=>{f.nodes.get('/home/daon').mode=0o040777;},
  (f:ReturnType<typeof fixture>)=>{f.io.realpath=()=>'/outside';},
 ]){const f=fixture();mutate(f);stopped(f);assert.equal(f.trace.filter(x=>x.op==='open').length,0);}
});
test('설치 누락/추가 및 .bin 링크는 생략하지 않는다',()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{f.nodes.delete(f.root+'/node_modules/example/index.js');},
  (f:ReturnType<typeof fixture>)=>{f.nodes.set(f.root+'/node_modules/extra.js',{...f.nodes.get(f.root+'/node_modules/example/index.js')});},
  (f:ReturnType<typeof fixture>)=>{f.nodes.set(f.root+'/node_modules/.bin',{...f.nodes.get(f.root+'/node_modules/example'),mode:0o120777});},
 ]){const f=fixture();mutate(f);stopped(f);assert.equal(f.trace.filter(x=>x.op==='open').length,0);}
 const f=fixture();f.contents.set('node_modules/.bin/tool',Buffer.from('x'));f.seal();f.build();f.nodes.get(f.root+'/node_modules/.bin/tool').mode=0o120777;stopped(f);assert(!f.trace.some(x=>x.op==='open'&&x.path?.endsWith('/.bin/tool')));
});
test('open 후 만료/메타교체/읽기 변조/close 불명은 원 fd 한번 회수, 후속 파일0',()=>{
 for(const mode of ['open','metadata','bytes','close','mono'] as const){const f=fixture();
  if(mode==='open'){const open=f.io.open;f.io.open=p=>{const fd=open(p);f.setTime(2000,1);return fd;};}
  if(mode==='metadata')f.hooks.afterRead=(p:string)=>{f.nodes.get(p).ino++;};
  if(mode==='bytes')f.contents.set('package-lock.json',Buffer.from('evil'));
  if(mode==='close')f.hooks.close=()=>{throw Error('PRIVATE_CLOSE');};
  if(mode==='mono')f.hooks.afterRead=()=>f.setTime(1001,999);
  stopped(f);assert.equal(f.trace.filter(x=>x.op==='open').length,1);assert.equal(f.trace.filter(x=>x.op==='close').length,1);
 }
});
test('부분 read·EOF 추가 및 zero-length 파일을 정확 검산',()=>{
 const f=fixture();f.contents.set('scripts/empty.ts',Buffer.alloc(0));f.seal();f.build();const read=f.io.read;f.io.read=(fd,b,o,n,p)=>read(fd,b,o,Math.min(n,2),p);const out=createTc01PreloadFiles(f.supervisor,f.io).read(f.input);out.dispose();zero(f);
 const bad=fixture(),original=bad.io.read;bad.io.read=(fd,b,o,n,p)=>{const result=original(fd,b,o,n,p);return result===0?1:result;};stopped(bad);assert.equal(bad.trace.filter(x=>x.op==='open').length,1);
});
test('완료 직전 설치 추가·chmod 및 반환 byte 변조는 현재성 실패와 소거',()=>{
 const f=fixture();const out=createTc01PreloadFiles(f.supervisor,f.io).read(f.input);f.nodes.set(f.root+'/node_modules/new',{...f.nodes.get(f.root+'/node_modules/example')});assert.throws(()=>out.assertCurrent(),/FN03_TC01_PRELOAD_UNKNOWN/);zero(f);
 const g=fixture();const value=createTc01PreloadFiles(g.supervisor,g.io).read(g.input);value.files[0]!.bytes[0]=value.files[0]!.bytes[0]!^1;assert.throws(()=>value.assertCurrent());zero(g);
 const h=fixture();const held=createTc01PreloadFiles(h.supervisor,h.io).read(h.input);h.nodes.get(h.root+'/scripts/runtime.ts').mode=0o100666;assert.throws(()=>held.assertCurrent());zero(h);
});
test('입력 Proxy/getter 평가0·포트 교체는 뒤 효과0',()=>{
 const f=fixture();let getters=0;f.input.preparation=new Proxy(f.preparation,{get(){getters++;throw Error('PRIVATE');}});stopped(f);assert.equal(getters,0);assert.equal(f.trace.length,0);
 const g=fixture();Object.defineProperty(g.input,'preparation',{get(){getters++;throw Error('PRIVATE');},enumerable:true});stopped(g);assert.equal(getters,0);
 const h=fixture();h.hooks.afterRead=()=>{h.io.lstat=()=>{throw Error('PRIVATE_REPLACED');};};stopped(h);assert.equal(h.trace.filter(x=>x.op==='close').length,1);
});

test('보유 byte의 사용자 fill 교체를 호출하지 않고 소거한다',()=>{
 const f=fixture(),out=createTc01PreloadFiles(f.supervisor,f.io).read(f.input);let called=0;out.files[0]!.bytes.fill=(()=>{called++;throw Error('PRIVATE_OVERRIDE');}) as never;out.dispose();assert.equal(called,0);zero(f);
});

const officialEvidence=['docs/design/공식산출물_양식정의.md','docs/design/문서작성_공통기준.md','docs/design/기본방법론_상세검토안.md'];
test('통합 source 공식3경로만 원 checkout에서 읽고 보유·소거한다',()=>{
 const f=fixture();for(const path of officialEvidence)f.contents.set(path,Buffer.from('synthetic evidence:'+path));f.seal();f.build();f.input.retainPaths=[...officialEvidence].sort();
 const out=createTc01PreloadFiles(f.supervisor,f.io).read(f.input);assert.deepEqual(out.files.map(r=>r.path),[...officialEvidence].sort());for(const row of out.files){assert.equal(row.bytes.toString(),'synthetic evidence:'+row.path);assert.equal(f.trace.filter(t=>t.op==='open'&&t.path===f.root+'/'+row.path).length,1);}out.dispose();zero(f);
});
test('한글 경로 예외는 다른 이름/위치·정규화·node_modules·구 profile을 허용하지 않는다',()=>{
 const original=officialEvidence[0]!;
 for(const path of ['docs/other/'+original.split('/').at(-1),original+'.ts',original.normalize('NFD'),'./'+original,'docs/design/../design/'+original,original.replaceAll('/','\\'),'node_modules/'+original,'docs/design/임의.md']){const f=fixture();f.contents.set(path,Buffer.from('x'));f.seal();f.build();stopped(f);assert.equal(f.trace.length,0);}
 const f=fixture();f.contents.set(original,Buffer.from('x'));f.seal();f.build();f.binding.profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1';stopped(f);assert.equal(f.trace.length,0);
});
