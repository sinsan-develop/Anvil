import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {constants,existsSync} from 'node:fs';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';

// 공개 문자열과 메모리 관측만 사용한다. 실제 fs/procfs/native/catalog 검증이 아니다.
type Observation={identity:{device:string;inode:string};kind:'directory'|'file'|'symlink'|'fifo';uid:number;gid:number;mode:number;nlink:number;size:number;mtimeNs:string;ctimeNs:string};
type Handle={};
interface ReadIo {
 open(path:string,flags:number):Promise<{handle:Handle;fd:number}>;
 fstat(handle:Handle):Promise<Observation>;lstat(path:string):Promise<Observation>;statfs(path:string):Promise<{type:bigint}>;
 read(handle:Handle,position:number,maxBytes:number):Promise<Uint8Array>;readlink(path:string):Promise<string>;close(handle:Handle):Promise<void>;
}
const marker='synthetic-private-path-errno-content';
const digest=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const clone=<T>(v:T):T=>structuredClone(v);
const deferred=()=>{let release!:()=>void;const wait=new Promise<void>(r=>{release=r;});return{wait,release};};
const failure=(code:string,status:number)=>(e:any)=>e instanceof AuthFailure&&e.message===code&&e.statusCode===status&&!JSON.stringify(e).includes(marker)&&!String(e.stack).includes(marker)&&!e.cause;
async function reader(){const u=new URL('../../../apps/server/modules/backups/installation-resource-protected-files.ts',import.meta.url),m:any=existsSync(u)?await import(u.href):{};assert.equal(typeof m.openProtectedInstallationFile,'function','보호 설치 파일 reader 미구현');return m.openProtectedInstallationFile;}
function fixture(kind:'CATALOG'|'ARTIFACT'='CATALOG'){
 const bytes=new TextEncoder().encode('{"fixture":"public-installation"}'),filePath='/srv/anvil-install/'+(kind==='CATALOG'?'catalog.json':'port.node');
 const descriptor={absolutePath:filePath,expectedIdentity:{device:'2049',inode:'42'},expectedSha256:digest(bytes),sizeBytes:bytes.length,kind};
 const runtime={platform:'linux',arch:'x64',node:'24.22.1',napi:'8',uid:1000,euid:1000,pid:1234};
 const trace:Array<{op:string;path:string;fd?:number}>=[],handles=new Map<Handle,{path:string;fd:number;closed:boolean;mountId:number}>(),byFd=new Map<number,Handle>();let nextFd=40;
 const state={fileBytes:bytes,rootChange:null as ((path:string,v:Observation)=>void)|null,readLimit:65536,pauseRead:false,gate:deferred(),entered:deferred(),failOpen:'',failClose:'',badProc:false,badSelf:false,mountType:'ext4',mountMissing:false,mountDuplicate:false,mountOversize:false,fdinfoMissing:false,fdinfoOversize:false,changedMnt:false,readBeyond:false,mountReassigned:false,nameOverlay:false};
 const observation=(path:string):Observation=>{let v:Observation;
  if(path===filePath)v={identity:{device:'2049',inode:'42'},kind:'file',uid:0,gid:0,mode:0o444,nlink:1,size:bytes.length,mtimeNs:'100',ctimeNs:'200'};
  else if(path.startsWith('/proc'))v={identity:{device:'9',inode:path==='/proc'?'900':String(910+path.length)},kind:path.endsWith('/mountinfo')||path.includes('/fdinfo/')?'file':path==='/proc/self'?'symlink':'directory',uid:path==='/proc'||path==='/proc/self'?0:1000,gid:path==='/proc'||path==='/proc/self'?0:1000,mode:path==='/proc/self'?0o777:path.endsWith('/mountinfo')||path.includes('/fdinfo/')?0o444:0o555,nlink:1,size:0,mtimeNs:'10',ctimeNs:'20'};
  else{const inode=path==='/'?'1':path==='/srv'?'2':path==='/srv/anvil-install'?'3':null;assert(inode,`모델 밖 경로 ${path}`);v={identity:{device:'2049',inode},kind:'directory',uid:0,gid:0,mode:0o755,nlink:2,size:4096,mtimeNs:'10',ctimeNs:'20'};}
  state.rootChange?.(path,v);return v;
 };
 const get=(h:Handle)=>{const row=handles.get(h);assert(row&&!row.closed,'살아 있는 자기 handle');return row;};
 const resolve=(path:string)=>{const m=/^\/proc\/self\/fd\/(\d+)(?:\/(.*))?$/.exec(path);if(!m)return path;const h=byFd.get(Number(m[1]));assert(h,'보유 FD만 사용');const row=get(h);if(m[2]!==undefined){assert(!m[2].includes('/'),'한 성분 상대 열기');assert.equal(observation(row.path).kind,'directory');return(row.path==='/'?'':row.path)+'/'+m[2];}return row.path;};
 const body=(path:string):Uint8Array=>{
  if(path===filePath)return state.fileBytes;
  if(path==='/proc/self/mountinfo')return new TextEncoder().encode(state.mountOversize?'x'.repeat(1048577):`${state.mountMissing?'9':'7'} 1 8:1 / / rw - ${state.mountType} /dev/sda1 rw\n8 7 0:9 / /proc rw - proc proc rw\n${state.mountReassigned||state.nameOverlay?'9 1 8:1 / /srv/anvil-install/catalog.json rw - ext4 /dev/sda1 rw\n':''}${state.mountDuplicate?'7 1 8:1 / / rw - ext4 /dev/sda1 rw\n':''}`);
  const m=/^\/proc\/self\/fdinfo\/(\d+)$/.exec(path);assert(m,'고정 자기 proc 파일만 읽기');const h=byFd.get(Number(m[1]));assert(h);const row=get(h);return new TextEncoder().encode(state.fdinfoOversize?'x'.repeat(8193):`pos:\t0\nflags:\t0100000\n${state.fdinfoMissing?'':`mnt_id:\t${state.changedMnt?99:state.mountReassigned&&!row.path.startsWith('/proc')?9:row.mountId}\n`}ino:\t${observation(row.path).identity.inode}\n`);
 };
 const io:ReadIo={
  async open(path,flags){trace.push({op:'OPEN',path});assert.equal(flags&constants.O_CREAT,0);assert.equal(flags&constants.O_TRUNC,0);assert.equal(flags&constants.O_WRONLY,0);const actual=resolve(path);if(actual===state.failOpen)throw Object.assign(Error(marker),{cause:marker});if(actual===filePath){assert.notEqual(path,filePath,'원래 전체 경로 재open 금지');assert(flags&(constants.O_NOFOLLOW??131072));assert(flags&(constants.O_NONBLOCK??2048));}const handle={},fd=nextFd++;handles.set(handle,{path:actual,fd,closed:false,mountId:actual.startsWith('/proc')?8:state.nameOverlay&&actual===filePath?9:7});byFd.set(fd,handle);return{handle,fd};},
  async fstat(h){const r=get(h);trace.push({op:'FSTAT',path:r.path,fd:r.fd});return clone(observation(r.path));},
  async lstat(path){trace.push({op:'LSTAT',path});return clone(observation(resolve(path)));},
  async statfs(path){trace.push({op:'STATFS',path});const actual=resolve(path);return{type:actual.startsWith('/proc')?(state.badProc?0xef53n:0x9fa0n):0xef53n};},
  async read(h,position,maxBytes){const r=get(h);trace.push({op:'READ',path:r.path,fd:r.fd});assert(Number.isSafeInteger(position)&&position>=0);assert(Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<=65536);if(r.path===filePath&&state.pauseRead){state.entered.release();await state.gate.wait;}const data=body(r.path);if(state.readBeyond&&r.path===filePath&&position>=data.length)return Uint8Array.of(9);return Uint8Array.from(data.subarray(position,position+Math.min(maxBytes,state.readLimit)));},
  async readlink(path){trace.push({op:'READLINK',path});if(path==='/proc/self')return state.badSelf?'9999':'1234';const m=/^\/proc\/self\/fd\/(\d+)$/.exec(path);assert(m);const h=byFd.get(Number(m[1]));assert(h);return get(h).path;},
  async close(h){const r=get(h);trace.push({op:'CLOSE',path:r.path,fd:r.fd});r.closed=true;if(r.path===state.failClose)throw Object.assign(Error(marker),{cause:marker});}
 };
 return{descriptor,runtime,trace,state,handles,byFd,filePath,bytes,io,dependencies:{io,runtime:()=>clone(runtime)},openCount:()=>trace.filter(t=>t.op==='OPEN').length,live:()=>[...handles.values()].filter(r=>!r.closed),closes:(path:string)=>{const held=[...handles.values()].find(r=>r.path===path);return trace.filter(t=>t.op==='CLOSE'&&t.fd===held?.fd).length;}};
}
async function setup(kind:'CATALOG'|'ARTIFACT'='CATALOG'){const open=await reader(),f=fixture(kind),cap=await open(f.descriptor,f.dependencies);return{f,cap};}
async function cleanup(cap:any){try{await cap.dispose();}catch{/* 회수 불명은 해당 시험에서 별도 판정 */}}
function closedOnce(f:ReturnType<typeof fixture>){const calls=f.trace.filter(x=>x.op==='CLOSE').map(x=>x.fd);assert.equal(new Set(calls).size,calls.length);assert.equal(f.live().length,0);}

test('protectedReader catalog 동일FD bounded read·독립bytes·목적분리·raw필드0',async()=>{
 const {f,cap}=await setup();try{assert.deepEqual(Object.keys(cap).sort(),['assertCurrent','dispose','readCatalog','withArtifactFile'].sort());const result=await cap.readCatalog();assert.deepEqual(result,f.bytes);result.fill(0);assert.deepEqual(await cap.readCatalog(),f.bytes);await cap.assertCurrent();await assert.rejects(cap.withArtifactFile(async()=>1),failure('INPUT_INVALID',400));const reads=f.trace.filter(x=>x.op==='READ'&&x.path===f.filePath);assert(reads.length>=3);assert.equal(new Set(reads.map(x=>x.fd)).size,1);assert.equal(f.trace.filter(x=>x.op==='OPEN'&&x.path===f.filePath).length,0);}finally{await cap.dispose();}closedOnce(f);
});

test('protectedReader artifact hash검증 동일FD callback pin과 후검사·DL실행0',async()=>{
 const {f,cap}=await setup('ARTIFACT');try{await assert.rejects(cap.readCatalog(),failure('INPUT_INVALID',400));let called=0;const answer=await cap.withArtifactFile(async(path:string)=>{called++;assert(/^\/proc\/self\/fd\/\d+$/.test(path));const fd=Number(path.split('/').at(-1)),row=[...f.handles.values()].find(r=>r.fd===fd);assert(row&&!row.closed&&row.path===f.filePath);return'합성 소비 결과';});assert.equal(answer,'합성 소비 결과');assert.equal(called,1);}finally{await cap.dispose();}closedOnce(f);
});

test('protectedReader 입력 상한·닫힌 descriptor·정규경로 검사 IO0',async()=>{
 const open=await reader();for(const mutate of [
  (v:any)=>{v.extra=1;},(v:any)=>{v.absolutePath='relative';},(v:any)=>{v.absolutePath='/srv/../bad';},(v:any)=>{v.absolutePath='/srv//bad';},(v:any)=>{v.absolutePath='/'+ '가'.repeat(86);},(v:any)=>{v.absolutePath='/srv/\u0000bad';},(v:any)=>{v.expectedIdentity.inode='18446744073709551616';},(v:any)=>{v.expectedIdentity.device='01';},(v:any)=>{v.expectedSha256='bad';},(v:any)=>{v.sizeBytes=1048577;},(v:any)=>{v.kind='ARTIFACT';v.sizeBytes=16777217;}
 ]){const f=fixture();mutate(f.descriptor);await assert.rejects(open(f.descriptor,f.dependencies),failure('INPUT_INVALID',400));assert.equal(f.trace.length,0);}
});

test('protectedReader 지원밖 runtime·root서비스는 IO0',async()=>{
 const open=await reader();for(const [key,value] of [['platform','win32'],['arch','arm64'],['node','24.18.0'],['napi','7'],['uid',0],['euid',0]] as const){const f=fixture();(f.runtime as any)[key]=value;await assert.rejects(open(f.descriptor,f.dependencies),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.trace.length,0);}
});

test('protectedReader owner·write권한·특수권한·identity·symlink·FIFO·hardlink 거절과 부분회수',async()=>{
 const open=await reader();for(const change of [
  (p:string,v:Observation)=>{if(p==='/srv')v.uid=1000;},(p:string,v:Observation)=>{if(p==='/srv')v.mode=0o775;},(p:string,v:Observation)=>{if(p==='/srv')v.mode=0o1755;},(p:string,v:Observation)=>{if(p.endsWith('catalog.json'))v.identity.inode='99';},(p:string,v:Observation)=>{if(p.endsWith('catalog.json'))v.kind='symlink';},(p:string,v:Observation)=>{if(p.endsWith('catalog.json'))v.kind='fifo';},(p:string,v:Observation)=>{if(p.endsWith('catalog.json'))v.nlink=2;}
 ]){const f=fixture();f.state.rootChange=change;await assert.rejects(open(f.descriptor,f.dependencies),failure('RESOURCE_UNVERIFIED',412));closedOnce(f);}
});

test('protectedReader procfs/self/mnt_id/ext4 정확관측 없으면 magic만으로 승격0',async()=>{
 const open=await reader();for(const change of [(s:any)=>{s.badProc=true;},(s:any)=>{s.badSelf=true;},(s:any)=>{s.mountType='ext3';},(s:any)=>{s.mountMissing=true;},(s:any)=>{s.mountDuplicate=true;},(s:any)=>{s.fdinfoMissing=true;},(s:any)=>{s.changedMnt=true;},(s:any)=>{s.mountOversize=true;},(s:any)=>{s.fdinfoOversize=true;}]){const f=fixture();change(f.state);await assert.rejects(open(f.descriptor,f.dependencies),failure('RESOURCE_UNVERIFIED',412));closedOnce(f);}
});

test('protectedReader 부분 read를 모아 정확 bytes/hash 확인하고 추가 EOF바이트 거절',async()=>{
 const open=await reader(),f=fixture();f.state.readLimit=3;const cap=await open(f.descriptor,f.dependencies);assert.deepEqual(await cap.readCatalog(),f.bytes);await cap.dispose();closedOnce(f);const bad=fixture();bad.state.readBeyond=true;await assert.rejects(open(bad.descriptor,bad.dependencies),failure('RESOURCE_UNVERIFIED',412));closedOnce(bad);
});

test('protectedReader 초기 size/hash 불일치는 실패·자기FD회수',async()=>{
 const open=await reader();for(const size of [true,false]){const f=fixture();if(size)f.descriptor.sizeBytes++;else f.descriptor.expectedSha256='0'.repeat(64);await assert.rejects(open(f.descriptor,f.dependencies),failure('RESOURCE_UNVERIFIED',412));closedOnce(f);}
});

test('protectedReader descriptor alias 수정은 고정 입력·같은FD를 바꾸지 않음',async()=>{
 const {f,cap}=await setup();try{f.descriptor.absolutePath='/different';f.descriptor.expectedIdentity.inode='99';f.descriptor.expectedSha256='0'.repeat(64);assert.deepEqual(await cap.readCatalog(),f.bytes);}finally{await cap.dispose();}closedOnce(f);
});

test('protectedReader 현재 bytes/부모/시간/runtime 변경 후 영구poison·재open0',async()=>{
 for(const change of [
  (f:ReturnType<typeof fixture>)=>{f.state.fileBytes=Uint8Array.from(f.bytes);f.state.fileBytes[0]=f.state.fileBytes[0]!^1;},
  (f:ReturnType<typeof fixture>)=>{f.state.rootChange=(p,v)=>{if(p==='/srv')v.identity.inode='88';};},
  (f:ReturnType<typeof fixture>)=>{f.state.rootChange=(p,v)=>{if(p===f.filePath)v.ctimeNs='999';};},
  (f:ReturnType<typeof fixture>)=>{f.runtime.node='25.0.0';}
 ]){const {f,cap}=await setup();change(f);await assert.rejects(cap.assertCurrent(),failure('RESOURCE_UNVERIFIED',412));const opens=f.openCount();f.state.rootChange=null;f.state.fileBytes=f.bytes;f.runtime.node='24.22.1';await assert.rejects(cap.readCatalog(),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.openCount(),opens);await cap.dispose();closedOnce(f);}
});

test('protectedReader 부분open 실패도 이미소유FD만 역순close·원오류누출0',async()=>{
 const open=await reader(),f=fixture();f.state.failOpen='/srv/anvil-install';await assert.rejects(open(f.descriptor,f.dependencies),failure('RESOURCE_UNVERIFIED',412));closedOnce(f);const heldByPath=new Map<string,number>();for(const r of f.handles.values())if(!r.path.startsWith('/proc')&&!heldByPath.has(r.path))heldByPath.set(r.path,r.fd);const dirOpens=[...heldByPath.values()],held=new Set(dirOpens);const closes=f.trace.filter(t=>t.op==='CLOSE'&&held.has(t.fd!)).map(t=>t.fd);assert.deepEqual(closes,dirOpens.reverse());
});

test('protectedReader busy409·dispose 즉시차단/drain·late read성공0·단발close',async()=>{
 const {f,cap}=await setup();f.state.pauseRead=true;const read=cap.readCatalog();await f.state.entered.wait;await assert.rejects(cap.assertCurrent(),failure('RESOURCE_PROCESSING',409));const disposed=cap.dispose();assert.equal(disposed,cap.dispose());let settled=false;void disposed.then(()=>{settled=true;});await assert.rejects(cap.readCatalog(),failure('RESOURCE_UNVERIFIED',412));assert.equal(settled,false);assert.equal(f.closes(f.filePath),0);f.state.gate.release();await assert.rejects(read,failure('RESOURCE_UNVERIFIED',412));await disposed;closedOnce(f);
});

test('protectedReader artifact callback 뒤검사실패 UNKNOWN·재호출0·파일보존',async()=>{
 const {f,cap}=await setup('ARTIFACT');let calls=0;await assert.rejects(cap.withArtifactFile(async()=>{calls++;f.state.fileBytes=Uint8Array.from(f.bytes);f.state.fileBytes[0]=f.state.fileBytes[0]!^1;return'결과';}),failure('RESOURCE_STATE_UNKNOWN',503));f.state.fileBytes=f.bytes;await assert.rejects(cap.withArtifactFile(async()=>{calls++;}),failure('RESOURCE_UNVERIFIED',412));assert.equal(calls,1);await cap.dispose();closedOnce(f);
});

test('protectedReader callback 중dispose는 FDpin drain 뒤 UNKNOWN·같은close1',async()=>{
 const {f,cap}=await setup('ARTIFACT'),gate=deferred(),entered=deferred();let completed=0;const work=cap.withArtifactFile(async(path:string)=>{entered.release();await gate.wait;assert([...f.handles.values()].some(r=>r.fd===Number(path.split('/').at(-1))&&!r.closed));completed++;return 1;});
 await entered.wait;const disposal=cap.dispose();assert.equal(f.closes(f.filePath),0);gate.release();await assert.rejects(work,failure('RESOURCE_STATE_UNKNOWN',503));await disposal;assert.equal(completed,1);closedOnce(f);
});

test('protectedReader close 불명은 고정503·같은Promise·숫자FD재시도0',async()=>{
 const {f,cap}=await setup();f.state.failClose=f.filePath;const disposal=cap.dispose();await assert.rejects(disposal,failure('RESOURCE_STATE_UNKNOWN',503));assert.equal(disposal,cap.dispose());await assert.rejects(cap.dispose(),failure('RESOURCE_STATE_UNKNOWN',503));assert.equal(f.closes(f.filePath),1);closedOnce(f);
});

test('protectedMount 최초 held mountID가 다른 ext4/dev entry로 바뀌면 영구거절',async()=>{
 const {f,cap}=await setup();try{f.state.mountReassigned=true;await assert.rejects(cap.assertCurrent(),failure('RESOURCE_UNVERIFIED',412));f.state.mountReassigned=false;await assert.rejects(cap.readCatalog(),failure('RESOURCE_UNVERIFIED',412));}finally{await cap.dispose();}closedOnce(f);
});

test('protectedMount 이름으로 새로 연 동일inode의 bindmount와 held mountID 차이는 거절',async()=>{
 const {f,cap}=await setup();try{f.state.nameOverlay=true;await assert.rejects(cap.assertCurrent(),failure('RESOURCE_UNVERIFIED',412));}finally{await cap.dispose();}closedOnce(f);
});