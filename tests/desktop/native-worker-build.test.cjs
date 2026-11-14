'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const hash=b=>createHash('sha256').update(b).digest('hex');
// 시험 전용 RAM PE. 원 source를 컴파일하거나 실행한 결과가 아니다.
function workerPE({entry='OwnershipEvidenceWorker',ns='Anvil.Native.OwnershipEvidence',module='OwnershipEvidenceWorker.exe',assembly='OwnershipEvidenceWorker',publicMain=true}={}){
 const names=['',module,entry,ns,'Main',assembly],offsets=[];let n=0;for(const s of names){offsets.push(n);n+=Buffer.byteLength(s)+1;}
 const strings=Buffer.from(names.join('\0')+'\0'),blob=Buffer.from([0,5,0,1,8,0x1d,0x0e]);
 const rows=[Buffer.alloc(10),Buffer.alloc(14),Buffer.alloc(14),Buffer.alloc(22)];rows[0].writeUInt16LE(offsets[1],2);rows[0].writeUInt16LE(1,4);rows[1].writeUInt16LE(offsets[2],4);rows[1].writeUInt16LE(offsets[3],6);rows[1].writeUInt16LE(1,10);rows[1].writeUInt16LE(1,12);rows[2].writeUInt32LE(0x2100);rows[2].writeUInt16LE(publicMain?0x96:0x91,6);rows[2].writeUInt16LE(offsets[4],8);rows[2].writeUInt16LE(1,10);rows[2].writeUInt16LE(1,12);rows[3].writeUInt32LE(0x8004);rows[3].writeUInt16LE(1,4);rows[3].writeUInt16LE(offsets[5],18);
 const tables=Buffer.alloc(40);tables[4]=2;tables[7]=1;tables.writeBigUInt64LE(1n|1n<<2n|1n<<6n|1n<<32n,8);for(let i=0;i<4;i++)tables.writeUInt32LE(1,24+i*4);
 const streams=[{name:'#~',bytes:Buffer.concat([tables,...rows])},{name:'#Strings',bytes:strings},{name:'#Blob',bytes:blob},{name:'#GUID',bytes:Buffer.alloc(16)}];let off=32+streams.reduce((sum,s)=>sum+8+Math.ceil((s.name.length+1)/4)*4,0);const meta=Buffer.alloc(1024);meta.writeUInt32LE(0x424a5342);meta.writeUInt16LE(1,4);meta.writeUInt16LE(1,6);meta.writeUInt32LE(12,12);meta.write('v4.0.30319\0',16);meta.writeUInt16LE(4,30);let sh=32;for(const s of streams){meta.writeUInt32LE(off,sh);meta.writeUInt32LE(s.bytes.length,sh+4);meta.write(s.name+'\0',sh+8);s.bytes.copy(meta,off);sh+=8+Math.ceil((s.name.length+1)/4)*4;off=Math.ceil((off+s.bytes.length)/4)*4;}
 const pe=Buffer.alloc(0x1200);pe.write('MZ');pe.writeUInt32LE(0x80,60);pe.write('PE\0\0',0x80);pe.writeUInt16LE(0x8664,0x84);pe.writeUInt16LE(1,0x86);pe.writeUInt16LE(240,0x94);pe.writeUInt16LE(0x22,0x96);const opt=0x98;pe.writeUInt16LE(0x20b,opt);pe.writeUInt32LE(0x2000,opt+32);pe.writeUInt32LE(0x200,opt+36);pe.writeUInt32LE(0x4000,opt+56);pe.writeUInt32LE(0x200,opt+60);pe.writeUInt32LE(16,opt+108);pe.writeUInt32LE(0x2000,opt+112+14*8);pe.writeUInt32LE(72,opt+116+14*8);const sec=0x188;pe.write('.text',sec);pe.writeUInt32LE(4096,sec+8);pe.writeUInt32LE(0x2000,sec+12);pe.writeUInt32LE(4096,sec+16);pe.writeUInt32LE(512,sec+20);pe.writeUInt32LE(0x60000020,sec+36);
 pe.writeUInt32LE(72,0x200);pe.writeUInt16LE(2,0x204);pe.writeUInt16LE(5,0x206);pe.writeUInt32LE(0x2200,0x208);pe.writeUInt32LE(off,0x20c);pe.writeUInt32LE(1,0x210);pe.writeUInt32LE(0x06000001,0x214);meta.copy(pe,0x400,0,off);return pe;
}
function resolver(){const {registerHooks,createRequire}=require('node:module'),{pathToFileURL}=require('node:url');const deps=createRequire('C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil/apps/desktop/package.json'),paths=new Map(['pe-library','resedit','@electron/fuses','@electron/asar'].map(s=>[s,pathToFileURL(deps.resolve(s)).href]));return registerHooks({resolve(s,c,next){if(paths.has(s))return{url:paths.get(s),shortCircuit:true};return next(s,c);}});}
// 기존 제품 validator는 그대로 실행한다. 대역은 가상 C:\WorkerQA 파일의 raw FS뿐이다.
async function withWorkerBuild(body,{beforeFactory=null}={}){
 const fs=require('node:fs'),path=require('node:path'),{syncBuiltinESMExports}=require('node:module'),{Readable}=require('node:stream');const hooks=resolver(),files=new Map(),root='C:\\WorkerQA',parent=root+'\\Anvil-win32-x64',repo=root+'\\Source';let fd=900000;const handles=new Map(),restore=[];
 const isVirtual=p=>typeof p==='string'&&p.startsWith(root),get=p=>{const b=files.get(p);if(!b)throw Error('RAM_FILE_MISSING '+p);return b;};
 function patch(obj,name,replacement){const old=obj[name];obj[name]=function(...args){return replacement(old.bind(obj),...args);};restore.push(()=>obj[name]=old);}
 const stat=p=>{const b=files.get(p),dir=!b&&[...files.keys()].some(k=>k.startsWith(p+'\\'));if(!b&&!dir)throw Error('RAM_STAT_MISSING '+p);return {isFile:()=>!!b,isDirectory:()=>dir,isSymbolicLink:()=>false,nlink:1,size:b?.length??0,dev:1,ino:hash(p).slice(0,8),mtimeNs:1n,ctimeNs:1n};};
 patch(fs.promises,'lstat',(old,p,...rest)=>isVirtual(p)?Promise.resolve(stat(p)):old(p,...rest));patch(fs.promises,'realpath',(old,p)=>isVirtual(p)?Promise.resolve(p):old(p));patch(fs.promises,'readFile',(old,p,...rest)=>isVirtual(p)?Promise.resolve(Buffer.from(get(p))):old(p,...rest));patch(fs.promises,'readdir',(old,p,...rest)=>isVirtual(p)?Promise.resolve([...new Set([...files.keys()].filter(k=>k.startsWith(p+'\\')).map(k=>k.slice(p.length+1).split('\\')[0]))]):old(p,...rest));
 patch(fs.promises,'open',(old,p,...rest)=>isVirtual(p)?Promise.resolve({stat:async()=>stat(p),read:async(b,o,n,at)=>({bytesRead:get(p).copy(b,o,at,Math.min(get(p).length,at+n))}),createReadStream:()=>Readable.from([Buffer.from(get(p))]),close:async()=>{}}):old(p,...rest));
 patch(fs,'openSync',(old,p,...rest)=>{if(!isVirtual(p))return old(p,...rest);const h=++fd;handles.set(h,{p,at:0});return h;});patch(fs,'readSync',(old,h,b,o,n,at)=>{const f=handles.get(h);if(!f)return old(h,b,o,n,at);const start=at??f.at,r=get(f.p).copy(b,o,start,start+n);f.at=start+r;return r;});patch(fs,'closeSync',(old,h)=>handles.has(h)?handles.delete(h):old(h));syncBuiltinESMExports();
 patch(fs,'fstatSync',(old,h,...rest)=>handles.has(h)?stat(handles.get(h).p):old(h,...rest));
 try{
  const res=await import('resedit');const content=Buffer.from(JSON.stringify({name:'anvil-desktop',version:'0.1.0',main:'src/main.cjs'})),header=Buffer.from(JSON.stringify({files:{'package.json':{size:content.length,offset:'0',integrity:{algorithm:'SHA256',hash:hash(content),blockSize:4194304,blocks:[hash(content)]}}}}));const hs=4+Math.ceil((header.length+4)/4)*4,asar=Buffer.alloc(8+hs+content.length);asar.writeUInt32LE(4);asar.writeUInt32LE(hs,4);asar.writeUInt32LE(hs-4,8);asar.writeUInt32LE(header.length,12);header.copy(asar,16);content.copy(asar,8+hs);files.set(parent+'\\resources\\app.asar',asar);
  const pe=res.NtExecutable.createEmpty(false,false),resource=res.NtExecutableResource.from(pe);resource.entries.push({type:'INTEGRITY',id:'ELECTRONASAR',lang:1033,codepage:1200,bin:Uint8Array.from(Buffer.from(JSON.stringify([{file:'resources\\app.asar',alg:'SHA256',value:hash(header)}]))).buffer});resource.outputResource(pe);pe.setExtraData(Buffer.concat([Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'),Buffer.from([1,9]),Buffer.from('010011000')]));files.set(parent+'\\Anvil.exe',Buffer.from(pe.generate()));
  const factory=require('../../apps/desktop/scripts/native-physical-factory-build.cjs'),worker=require('../../apps/desktop/scripts/native-worker-build.cjs');const compiler={path:root+'\\Tools\\csc.exe',sha256:hash('compiler')};files.set(compiler.path,Buffer.from('compiler'));const references=factory.REFERENCE_FILES.map(name=>{const p=root+'\\Tools\\'+name;files.set(p,Buffer.from(name));return{path:p,sha256:hash(name)};});for(const s of factory.SOURCE_FILES)files.set(path.win32.join(repo,...s.split('/')),Buffer.from(s));files.set(path.win32.join(repo,...worker.SOURCE.split('/')),Buffer.from('RAM original worker source'));
  const configuration={factoryId:'ad140002-0000-4000-8000-000000000008',factoryVersion:1,compiler,references,basisPath:root+'\\Build\\ParentBasis.json',outputPath:root+'\\Build\\NativeOwner.exe'};
  const staged=beforeFactory?await beforeFactory({files,root,parent,repo,compiler,references,worker,now:Date.parse('2030-01-01T00:00:00.000Z')}):undefined;
  const production=await factory.produceCompileInput({repoRoot:repo,parentRoot:parent,configuration});
  // 동일 helper PE fixture 생성은 이 파일 안에서만 수행하며 원 verifier를 대체하지 않는다.
  const helper=helperPE(production.compile.parentBasis),artifact=await production.verifyOutput(helper);let now=Date.parse('2030-01-01T00:00:00.000Z'),revoked=false;
  const ps={schemaVersion:1,purpose:'NATIVE_FACTORY_PACKAGE_BASIS',parentExeHash:hash(files.get(parent+'\\Anvil.exe')),parentAsarHash:hash(asar),parentHeaderHash:hash(header),issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString()};
  const config={repoRoot:repo,compiler,references:references.slice(0,2),sourceHash:hash('RAM original worker source'),outputPath:root+'\\Build\\OwnershipEvidenceWorker.exe',packageRecord:{ref:{id:'ad140002-0000-4000-8000-000000000040',version:1,contentHash:hash(canonical(ps))},snapshot:ps},buildReceiptId:'ad140002-0000-4000-8000-000000000041',rootId:'ad140002-0000-4000-8000-000000000042',issuedAt:ps.issuedAt,expiresAt:ps.expiresAt};
  const ports={read:async p=>Buffer.from(get(p)),now:()=>now,check:()=>{if(revoked)throw Error('RAM_REVOKED');}};
  return await body({factory,worker,artifact,config,ports,files,repo,staged,advance:n=>now+=n,revoke:()=>{revoked=true;}});
 }finally{for(const r of restore.reverse())r();syncBuiltinESMExports();hooks.deregister();}
}
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
function helperPE(parent){
 // helper 전용 metadata를 재구성한다. worker가 helper로 통과하도록 validator를 대체하지 않는다.
 const pe=workerPE({entry:'NativePreparationOwnerHostSource',ns:'',module:'native.exe',assembly:'native'}),names=['','native.exe','NativePreparationOwnerHostSource','','Main','native','Anvil.Native.NativePreparationOwner.ParentBasis.v1'];let offset=0;const ix=names.map(s=>{const n=offset;offset+=Buffer.byteLength(s)+1;return n;});
 const rows=[Buffer.alloc(10),Buffer.alloc(14),Buffer.alloc(14),Buffer.alloc(22),Buffer.alloc(12)];rows[0].writeUInt16LE(ix[1],2);rows[0].writeUInt16LE(1,4);rows[1].writeUInt16LE(ix[2],4);rows[1].writeUInt16LE(1,10);rows[1].writeUInt16LE(1,12);rows[2].writeUInt32LE(0x2100);rows[2].writeUInt16LE(0x96,6);rows[2].writeUInt16LE(ix[4],8);rows[2].writeUInt16LE(1,10);rows[2].writeUInt16LE(1,12);rows[3].writeUInt32LE(0x8004);rows[3].writeUInt16LE(1,4);rows[3].writeUInt16LE(ix[5],18);rows[4].writeUInt32LE(2,4);rows[4].writeUInt16LE(ix[6],8);
 const tables=Buffer.alloc(44);tables[4]=2;tables[7]=1;tables.writeBigUInt64LE(1n|1n<<2n|1n<<6n|1n<<32n|1n<<40n,8);for(let i=0;i<5;i++)tables.writeUInt32LE(1,24+i*4);const streams=[{name:'#~',bytes:Buffer.concat([tables,...rows])},{name:'#Strings',bytes:Buffer.from(names.join('\0')+'\0')},{name:'#Blob',bytes:Buffer.from([0,5,0,1,8,0x1d,0x0e])},{name:'#GUID',bytes:Buffer.alloc(16)}];let off=32+streams.reduce((n,s)=>n+8+Math.ceil((s.name.length+1)/4)*4,0),sh=32;pe.fill(0,0x400,0x800);const m=pe.subarray(0x400);m.writeUInt32LE(0x424a5342);m.writeUInt16LE(1,4);m.writeUInt16LE(1,6);m.writeUInt32LE(12,12);m.write('v4.0.30319\0',16);m.writeUInt16LE(4,30);for(const s of streams){m.writeUInt32LE(off,sh);m.writeUInt32LE(s.bytes.length,sh+4);m.write(s.name+'\0',sh+8);s.bytes.copy(m,off);sh+=8+Math.ceil((s.name.length+1)/4)*4;off=Math.ceil((off+s.bytes.length)/4)*4;}pe.writeUInt32LE(off,0x20c);const raw=Buffer.from(canonical(parent));pe.writeUInt32LE(0x2a00,0x218);pe.writeUInt32LE(raw.length+4,0x21c);pe.writeUInt32LE(raw.length,0xc00);raw.copy(pe,0xc04);return pe;
}
module.exports={withWorkerBuild,workerPE,resolver};
if(require.main===module){
test('worker build 대기 뒤 원 source/부모 교체·회수·만료·clock후퇴는 토큰 없이 닫힌다',async()=>{
 for(const mode of ['SOURCE','PARENT','REVOKED','EXPIRED','BACKWARD','PORT_CHANGED'])await withWorkerBuild(async f=>{
  const build=await f.worker.createNativeWorkerBuild({factoryArtifact:f.artifact,configuration:f.config},f.ports);let calls=0;
  await assert.rejects(()=>build.build(async()=>{calls++;
   if(mode==='SOURCE')f.files.set(require('node:path').win32.join(f.repo,...f.worker.SOURCE.split('/')),Buffer.from('changed source'));
   if(mode==='PARENT'){const p=[...f.files.keys()].find(p=>p.endsWith('\\Anvil.exe'));f.files.set(p,Buffer.from('changed parent'));}
   if(mode==='REVOKED')f.revoke();if(mode==='EXPIRED')f.advance(60000);if(mode==='BACKWARD')f.advance(-1);if(mode==='PORT_CHANGED')f.ports.read=async()=>Buffer.from('changed');
   return workerPE();
  }));assert.equal(calls,1);await assert.rejects(()=>build.build(async()=>{calls++;return workerPE();}));assert.equal(calls,1);
 });
});
test('package 재봉인·미래 시각·caller compiler/ref 변경은 원 build 부모를 대신하지 못한다',async()=>withWorkerBuild(async f=>{
 const bad=structuredClone(f.config);bad.packageRecord.snapshot.parentExeHash='f'.repeat(64);bad.packageRecord.ref.contentHash=hash(canonical(bad.packageRecord.snapshot));
 await assert.rejects(()=>f.worker.createNativeWorkerBuild({factoryArtifact:f.artifact,configuration:bad},f.ports));
 await assert.rejects(()=>f.worker.createNativeWorkerBuild({factoryArtifact:f.artifact,configuration:{...f.config,issuedAt:'2030-01-01T00:00:01.000Z'}},f.ports));
 await assert.rejects(()=>f.worker.createNativeWorkerBuild({factoryArtifact:f.artifact,configuration:{...f.config,compiler:{...f.config.compiler,sha256:'e'.repeat(64)}}},f.ports));
 let trap=0;const clone=new Proxy(f.artifact,{get(){trap++;throw Error('trap');}});await assert.rejects(()=>f.worker.createNativeWorkerBuild({factoryArtifact:clone,configuration:f.config},f.ports));assert.equal(trap,0);
}));
test('JSON factory/build 모양과 worker bytes만으로 보호 descriptor를 발급하지 않는다',async()=>{
 let build;try{build=require('../../apps/desktop/scripts/native-worker-build.cjs');}catch{}
 assert.ok(build,'원 worker build 생산자가 아직 없다');
 await assert.rejects(()=>build.createNativeWorkerBuild({factoryArtifact:{},configuration:{}},{read:async()=>Buffer.from('MZ')}),/NATIVE_WORKER_/);
 assert.throws(()=>build.readNativeWorkerProduct({}),/NATIVE_WORKER_/);
});
test('worker 정확 namespace/entry/assembly/module/resource 경계를 RAM PE로 검산한다',async()=>{const h=resolver();try{const {verifyNativeWorker}=require('../../apps/desktop/scripts/verify-native-worker.cjs'),bytes=workerPE();assert.equal((await verifyNativeWorker(bytes)).workerHash,hash(bytes));for(const config of [{entry:'DesktopTrustKeyHostSource'},{ns:''},{assembly:'native'},{module:'native.exe'},{publicMain:false}])await assert.rejects(()=>verifyNativeWorker(workerPE(config)));const resource=workerPE();resource.writeUInt32LE(0x2a00,0x218);resource.writeUInt32LE(4,0x21c);await assert.rejects(()=>verifyNativeWorker(resource));}finally{h.deregister();}});
test('RAM parent 실제 검산→원 factory closure→고정 worker build→opaque descriptor 및 복제 거절',async()=>withWorkerBuild(async f=>{
 const p=await f.worker.createNativeWorkerBuild({factoryArtifact:f.artifact,configuration:f.config},f.ports);assert.ok(p.compile.arguments.includes('/main:Anvil.Native.OwnershipEvidence.OwnershipEvidenceWorker'));
 const token=await p.build(async()=>workerPE()),result=f.worker.readNativeWorkerProduct(token);assert.equal(result.descriptor.snapshot.workerHash,hash(workerPE()));assert.equal(result.descriptor.snapshot.nativeFactoryRef.contentHash,f.artifact.factoryRef.contentHash);assert.notEqual(result.descriptor.snapshot.workerHash,f.artifact.factoryRef.contentHash);assert.throws(()=>f.worker.readNativeWorkerProduct({...token}));await assert.rejects(()=>p.build(async()=>workerPE()));
 await assert.rejects(()=>f.worker.createNativeWorkerBuild({factoryArtifact:structuredClone(f.artifact),configuration:f.config},f.ports));
 const changed=await f.worker.createNativeWorkerBuild({factoryArtifact:f.artifact,configuration:{...f.config,rootId:'ad140002-0000-4000-8000-000000000043'}},f.ports);await assert.rejects(()=>changed.build(async()=>workerPE()));
}));
}
