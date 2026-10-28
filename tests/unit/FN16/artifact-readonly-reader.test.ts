import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {constants,existsSync} from 'node:fs';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';
import {verifyArtifactBytes} from '../../../apps/server/modules/backups/artifact-byte-verification.ts';
import type {ProtectedFileIo,ProtectedFileObservation} from '../../../apps/server/modules/backups/installation-resource-protected-files.ts';

// 공개 합성 원문·관측 IO만 사용한다. 실제 파일/procfs/권한/DB 검증이 아니다.
const pid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',aid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const root='/srv/anvil-artifacts',filePath=`${root}/blobs/${pid}/${aid}`,marker='public-fixture-raw-path-error';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const copy=<T>(v:T):T=>structuredClone(v);
const gate=()=>{let release!:()=>void;const wait=new Promise<void>(r=>{release=r;});return{wait,release};};
const failure=(code:string,status:number)=>(e:any)=>e instanceof AuthFailure&&e.message===code&&e.statusCode===status&&!e.cause&&!JSON.stringify(e).includes(marker)&&!String(e.stack).includes(marker);
async function factory(){const u=new URL('../../../apps/server/modules/backups/artifact-readonly-reader.ts',import.meta.url);const m:any=existsSync(u)?await import(u.href):{};assert.equal(typeof m.createArtifactReadonlyReader,'function','readonly artifact reader 미구현');return m.createArtifactReadonlyReader;}
function fixture(bytes:Uint8Array=new TextEncoder().encode('공개 합성 문서 원문')){
 const binding={absoluteRoot:root,expectedRootIdentity:{device:'2049',inode:'3'},ownerUid:1000};
 const runtime={platform:'linux',arch:'x64',node:'24.22.1',uid:1000,euid:1000,pid:1234};
 const ref={projectId:pid,artifactId:aid,bytes:bytes.length,contentHash:hash(bytes)};
 type Row={path:string;fd:number;closed:boolean;mountId:number;identity:{device:string;inode:string}};
 const rows=new Map<object,Row>(),fds=new Map<number,object>(),trace:Array<{op:string;path:string;fd?:number;position?:number;maxBytes?:number}>=[];let nextFd=50;
 const state={bytes,change:null as null|((p:string,v:ProtectedFileObservation)=>void),failOpen:'',failRead:false,failClose:'',short:65536,overRead:false,badProc:false,badSelf:false,mountType:'ext4',missingMount:false,duplicateMount:false,oversizeMount:false,missingFdinfo:false,oversizeFdinfo:false,heldMountChanged:false,nameMountChanged:false,nameIdentityChanged:'',pauseRead:false,pauseOpen:'',entered:gate(),waiter:gate(),lastReturned:null as Uint8Array|null};
 const observation=(p:string):ProtectedFileObservation=>{
  let v:ProtectedFileObservation;
  if(p===filePath)v={identity:{device:'2049',inode:'6'},kind:'file',uid:1000,gid:1000,mode:0o600,nlink:1,size:state.bytes.length,mtimeNs:'100',ctimeNs:'200'};
  else if(p.startsWith('/proc'))v={identity:{device:'9',inode:p==='/proc'?'900':String(910+p.length)},kind:p.includes('/fdinfo/')||p.endsWith('/mountinfo')?'file':p==='/proc/self'?'symlink':'directory',uid:p==='/proc'||p==='/proc/self'?0:1000,gid:0,mode:p==='/proc/self'?0o777:p.includes('/fdinfo/')||p.endsWith('/mountinfo')?0o444:0o555,nlink:1,size:0,mtimeNs:'1',ctimeNs:'2'};
  else{const ino=new Map([['/','1'],['/srv','2'],[root,'3'],[`${root}/blobs`,'4'],[`${root}/blobs/${pid}`,'5']]).get(p);assert(ino,'합성 모델 밖 경로');const owned=p===root||p.startsWith(root+'/');v={identity:{device:'2049',inode:ino},kind:'directory',uid:owned?1000:0,gid:owned?1000:0,mode:owned?0o700:0o755,nlink:2,size:4096,mtimeNs:'1',ctimeNs:'2'};}
  state.change?.(p,v);return v;
 };
 const get=(h:object)=>{const r=rows.get(h);assert(r&&!r.closed,'열린 자기 FD만 연산');return r;};
 const resolve=(p:string)=>{const m=/^\/proc\/self\/fd\/(\d+)(?:\/(.*))?$/.exec(p);if(!m)return p;const h=fds.get(Number(m[1]));assert(h,'계산한 자기 FD만 사용');const r=get(h);if(m[2]!==undefined){assert(!m[2].includes('/'),'성분별 parent FD 연산');return(r.path==='/'?'':r.path)+'/'+m[2];}return r.path;};
 const data=(p:string)=>{
  if(p===filePath)return state.bytes;
  if(p==='/proc/self/mountinfo')return new TextEncoder().encode(state.oversizeMount?'x'.repeat(1048577):`${state.missingMount?'10':'7'} 1 8:1 / / rw - ${state.mountType} /dev/public rw\n8 7 0:9 / /proc rw - proc proc rw\n9 1 8:1 / /srv/anvil-artifacts rw - ext4 /dev/public rw\n${state.duplicateMount?'7 1 8:1 / / rw - ext4 /dev/public rw\n':''}`);
  const m=/^\/proc\/self\/fdinfo\/(\d+)$/.exec(p);assert(m,'허용된 proc metadata만 읽기');const h=fds.get(Number(m[1]));assert(h);const r=get(h);return new TextEncoder().encode(state.oversizeFdinfo?'x'.repeat(8193):`pos:\t0\nflags:\t0100000\n${state.missingFdinfo?'':`mnt_id:\t${state.heldMountChanged&&!r.path.startsWith('/proc')?9:r.mountId}\n`}ino:\t${r.identity.inode}\n`);
 };
 const io:ProtectedFileIo={
  async open(p,flags){trace.push({op:'OPEN',path:p});assert.equal(flags&(constants.O_CREAT|constants.O_TRUNC|constants.O_WRONLY|constants.O_RDWR),0);const actual=resolve(p);assert(flags&(constants.O_NOFOLLOW??131072));assert(flags&(constants.O_NONBLOCK??2048));if(!actual.startsWith('/proc')&&actual!=='/')assert(p.startsWith('/proc/self/fd/'),'일반 절대 경로 fallback 금지');if(actual===state.pauseOpen){state.entered.release();await state.waiter.wait;}if(actual===state.failOpen)throw Object.assign(Error(marker),{cause:marker});const o=observation(actual);if(o.kind==='directory')assert(flags&(constants.O_DIRECTORY??65536));const h={},fd=nextFd++,identity=copy(o.identity);if(actual===state.nameIdentityChanged)identity.inode='777';rows.set(h,{path:actual,fd,closed:false,mountId:actual.startsWith('/proc')?8:state.nameMountChanged&&actual===filePath?9:7,identity});fds.set(fd,h);return{handle:h,fd};},
  async fstat(h){const r=get(h);trace.push({op:'FSTAT',path:r.path,fd:r.fd});const v=observation(r.path);v.identity=copy(r.identity);return v;},
  async lstat(p){trace.push({op:'LSTAT',path:p});return observation(resolve(p));},
  async statfs(p){trace.push({op:'STATFS',path:p});const actual=resolve(p);return{type:actual.startsWith('/proc')?(state.badProc?0xef53n:0x9fa0n):0xef53n};},
  async read(h,position,maxBytes){const r=get(h);trace.push({op:'READ',path:r.path,fd:r.fd,position,maxBytes});assert(Number.isSafeInteger(position)&&position>=0);assert(Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<=65536);if(r.path===filePath){if(state.pauseRead){state.entered.release();await state.waiter.wait;}if(state.failRead)throw new AuthFailure(marker,401);if(state.overRead)return new Uint8Array(maxBytes+1);}const b=data(r.path);const out=b.subarray(position,position+Math.min(maxBytes,state.short));if(r.path===filePath)state.lastReturned=out;return out;},
  async readlink(p){trace.push({op:'READLINK',path:p});if(p==='/proc/self')return state.badSelf?'9999':'1234';const m=/^\/proc\/self\/fd\/(\d+)$/.exec(p);assert(m);const h=fds.get(Number(m[1]));assert(h);return get(h).path;},
  async close(h){const r=get(h);trace.push({op:'CLOSE',path:r.path,fd:r.fd});r.closed=true;if(r.path===state.failClose)throw Object.assign(Error(marker),{cause:marker});}
 };
 return{binding,runtime,ref,state,rows,trace,io,bytes,deps:{io,runtime:()=>copy(runtime)},live:()=>[...rows.values()].filter(r=>!r.closed),fileReads:()=>trace.filter(r=>r.op==='READ'&&r.path===filePath),fileCloses:()=>trace.filter(r=>r.op==='CLOSE'&&r.path===filePath)};
}
function closed(f:ReturnType<typeof fixture>){const ids=f.trace.filter(r=>r.op==='CLOSE').map(r=>r.fd);assert.equal(new Set(ids).size,ids.length,'모든 자기 FD close 단발');assert.equal(f.live().length,0,'관측 FD를 포함한 잔여0');}
async function setup(bytes?:Uint8Array){const make=await factory(),f=fixture(bytes),r=make(f.binding,f.deps);assert.equal(f.trace.length,0,'factory IO0');const h=await r.open(f.ref);return{f,r,h};}
async function clean(r:any){try{await r.dispose();}catch{/* 회수 오류는 개별 기대값에서 검증한다. */}}

test('artifactReader 정상 byte verifier 연결·short read·고정FD·권한/안정성 승격0',async()=>{
 const make=await factory(),f=fixture(new TextEncoder().encode('공개 문서 '.repeat(10000))),r=make(f.binding,f.deps);assert.equal(f.trace.length,0);f.state.short=997;
 try{const result=await verifyArtifactBytes({...f.ref,maxBytes:20*1024*1024,deadlineMs:60000},r);assert.equal(result.checkedBytes,f.bytes.length);assert.equal(result.byteIntegrity,'MATCH');assert.equal(result.authorityVerified,false);assert.equal(result.sourceStabilityVerified,false);assert.equal(result.restorable,false);const reads=f.fileReads();assert(reads.length>2);assert.equal(new Set(reads.map(x=>x.fd)).size,1);assert.equal(reads.at(-1)?.maxBytes,1);assert.equal(reads.at(-1)?.position,f.bytes.length);assert.equal(f.live().length,0);}finally{await r.dispose();}closed(f);
});

test('artifactReader 빈 원문·20MiB 경계와 반환 버퍼 독립',async()=>{
 const make=await factory();for(const size of [0,20*1024*1024]){const f=fixture(new Uint8Array(size).fill(65)),r=make(f.binding,f.deps),h=await r.open(f.ref);try{const b=await h.read(65536);assert.equal(b.length,Math.min(size,65536));if(size){b[0]=90;assert.equal(f.state.lastReturned?.[0],65);}else assert.equal(f.fileReads()[0]?.maxBytes,1);}finally{await h.close();await r.dispose();}closed(f);}
});

test('artifactReader binding 닫힌 shape·경로·uint 상한 및 accessor 거절 IO0',async()=>{
 const make=await factory();for(const mutate of [(v:any)=>{v.extra=1;},(v:any)=>{v.absoluteRoot='/';},(v:any)=>{v.absoluteRoot='relative';},(v:any)=>{v.absoluteRoot='/srv/../bad';},(v:any)=>{v.absoluteRoot='/srv//bad';},(v:any)=>{v.absoluteRoot='/srv/bad/';},(v:any)=>{v.absoluteRoot='/'+ '가'.repeat(86);},(v:any)=>{v.absoluteRoot='/srv/\u0000bad';},(v:any)=>{v.ownerUid=0;},(v:any)=>{v.ownerUid=4294967296;},(v:any)=>{v.expectedRootIdentity.inode='18446744073709551616';},(v:any)=>{v.expectedRootIdentity.device='01';},(v:any)=>{Object.defineProperty(v,'ownerUid',{enumerable:true,get(){throw Error(marker);}});}]){const f=fixture();mutate(f.binding);await assert.rejects(Promise.resolve().then(()=>make(f.binding,f.deps)),failure('INPUT_INVALID',400));assert.equal(f.trace.length,0);}
});

test('artifactReader 지원 runtime 거절은 factory IO0·fallback0',async()=>{
 const make=await factory();for(const [key,value]of [['platform','win32'],['arch','arm64'],['node','24.17.9'],['node','25.0.0'],['node','24.22.1-rc.1'],['uid',0],['euid',1001],['pid',0]]as const){const f=fixture();(f.runtime as any)[key]=value;await assert.rejects(Promise.resolve().then(()=>make(f.binding,f.deps)),failure('ARTIFACT_READER_UNSUPPORTED',412));assert.equal(f.trace.length,0);}
});

test('artifactReader binding/ref는 descriptor snapshot·caller 변경과 Proxy get값에 독립',async()=>{
 const make=await factory(),f=fixture();const binding=new Proxy(f.binding,{get(t,k,r){return k==='absoluteRoot'?'/wrong':Reflect.get(t,k,r);}});const r=make(binding,f.deps);f.binding.absoluteRoot='/changed';f.binding.expectedRootIdentity.inode='99';const ref=new Proxy(f.ref,{get(t,k,r){return k==='bytes'?Infinity:Reflect.get(t,k,r);}});const h=await r.open(ref);f.ref.projectId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';f.ref.bytes=999;try{assert.deepEqual(await h.read(65536),f.bytes);}finally{await h.close();await r.dispose();}closed(f);
});

test('artifactReader ref·read 한도 불량은 원문 IO0·정상 handle 유지',async()=>{
 const make=await factory();for(const mutate of [(v:any)=>{v.extra=1;},(v:any)=>{v.bytes=20971521;},(v:any)=>{v.bytes=-1;},(v:any)=>{v.projectId=pid.toUpperCase();},(v:any)=>{v.contentHash='bad';}]){const f=fixture(),r=make(f.binding,f.deps);mutate(f.ref);await assert.rejects(r.open(f.ref),failure('INPUT_INVALID',400));assert.equal(f.trace.length,0);await r.dispose();}
 const{f,r,h}=await setup();try{for(const n of [0,-1,65537,Infinity,1.5])await assert.rejects(h.read(n),failure('INPUT_INVALID',400));assert.equal(f.fileReads().length,0);assert.deepEqual(await h.read(65536),f.bytes);}finally{await h.close();await r.dispose();}closed(f);
});

test('artifactReader root pin·owner·mode·symlink/FIFO/hardlink 거절과 부분FD 회수',async()=>{
 const make=await factory();for(const change of [(p:string,v:ProtectedFileObservation)=>{if(p===root)v.identity.inode='999';},(p:string,v:ProtectedFileObservation)=>{if(p==='/srv')v.uid=1001;},(p:string,v:ProtectedFileObservation)=>{if(p==='/srv')v.mode=0o775;},(p:string,v:ProtectedFileObservation)=>{if(p==='/srv')v.mode=0o1755;},(p:string,v:ProtectedFileObservation)=>{if(p===root)v.mode=0o750;},(p:string,v:ProtectedFileObservation)=>{if(p===filePath)v.uid=0;},(p:string,v:ProtectedFileObservation)=>{if(p===filePath)v.mode=0o640;},(p:string,v:ProtectedFileObservation)=>{if(p===filePath)v.kind='symlink';},(p:string,v:ProtectedFileObservation)=>{if(p===filePath)v.kind='fifo';},(p:string,v:ProtectedFileObservation)=>{if(p===filePath)v.nlink=2;}]){const f=fixture();f.state.change=change;const r=make(f.binding,f.deps);await assert.rejects(r.open(f.ref),failure('ARTIFACT_READER_UNVERIFIED',412));await clean(r);closed(f);}
});

test('artifactReader proc 자기PID·mount ID/fstype·metadata 상한 불명은 거절',async()=>{
 const make=await factory();for(const change of [(s:any)=>{s.badProc=true;},(s:any)=>{s.badSelf=true;},(s:any)=>{s.mountType='ext3';},(s:any)=>{s.missingMount=true;},(s:any)=>{s.duplicateMount=true;},(s:any)=>{s.oversizeMount=true;},(s:any)=>{s.missingFdinfo=true;},(s:any)=>{s.oversizeFdinfo=true;}]){const f=fixture();change(f.state);const r=make(f.binding,f.deps);await assert.rejects(r.open(f.ref),failure('ARTIFACT_READER_UNVERIFIED',412));await clean(r);closed(f);}
});

test('artifactReader 부모/원문 이름 교체·bind mount·runtime 변화 뒤 영구poison',async()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.state.nameIdentityChanged='/srv';},(f:ReturnType<typeof fixture>)=>{f.state.nameIdentityChanged=filePath;},(f:ReturnType<typeof fixture>)=>{f.state.nameMountChanged=true;},(f:ReturnType<typeof fixture>)=>{f.state.heldMountChanged=true;},(f:ReturnType<typeof fixture>)=>{f.runtime.node='24.23.0';}]){const{f,r,h}=await setup();change(f);await assert.rejects(h.read(32),failure('ARTIFACT_READER_UNVERIFIED',412));const count=f.trace.length;await assert.rejects(h.read(32),failure('ARTIFACT_READER_UNVERIFIED',412));assert.equal(f.trace.length,count);await h.close();await clean(r);closed(f);}
});

test('artifactReader 성장·축소·mtime/ctime 변경은 byte 읽기 전 거절',async()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.state.bytes=new Uint8Array(f.bytes.length+1);},(f:ReturnType<typeof fixture>)=>{f.state.bytes=f.bytes.subarray(1);},(f:ReturnType<typeof fixture>)=>{f.state.change=(p,v)=>{if(p===filePath)v.mtimeNs='999';};},(f:ReturnType<typeof fixture>)=>{f.state.change=(p,v)=>{if(p===filePath)v.ctimeNs='999';};}]){const{f,r,h}=await setup();change(f);await assert.rejects(h.read(32),failure('ARTIFACT_READER_UNVERIFIED',412));assert.equal(f.fileReads().length,0);await h.close();await clean(r);closed(f);}
});

test('artifactReader 과대 IO응답·원오류는 고정503·재읽기0',async()=>{
 for(const over of [false,true]){const{f,r,h}=await setup();f.state.overRead=over;f.state.failRead=!over;await assert.rejects(h.read(2),failure('ARTIFACT_READER_IO_FAILED',503));const count=f.fileReads().length;await assert.rejects(h.read(2),failure('ARTIFACT_READER_UNVERIFIED',412));assert.equal(f.fileReads().length,count);await h.close();await clean(r);closed(f);}
});

test('artifactReader 부분open 실패·회수불명 우선·관측FD도 단발회수',async()=>{
 const make=await factory();for(const closeFault of [false,true]){const f=fixture();f.state.failOpen=`${root}/blobs`;if(closeFault)f.state.failClose='/srv';const r=make(f.binding,f.deps);await assert.rejects(r.open(f.ref),failure(closeFault?'ARTIFACT_READER_CLEANUP_FAILED':'ARTIFACT_READER_IO_FAILED',503));await clean(r);closed(f);assert.equal(f.fileReads().length,0);}
});

test('artifactReader open중 dispose는 늦은FD까지 drain·close1·후속open0',async()=>{
 const make=await factory(),f=fixture();f.state.pauseOpen=root;const r=make(f.binding,f.deps),opening=r.open(f.ref);await f.state.entered.wait;const ending=r.dispose();assert.equal(ending,r.dispose());let done=false;void ending.then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);f.state.waiter.release();await assert.rejects(opening,failure('ARTIFACT_READER_CLOSED',409));await ending;closed(f);const count=f.trace.length;await assert.rejects(r.open(f.ref),failure('ARTIFACT_READER_CLOSED',409));assert.equal(f.trace.length,count);
});

test('artifactReader 동시open/read BUSY·close는 진행read drain·동일Promise',async()=>{
 const{f,r,h}=await setup();await assert.rejects(r.open(f.ref),failure('ARTIFACT_READER_BUSY',409));f.state.pauseRead=true;const pending=h.read(3);await f.state.entered.wait;await assert.rejects(h.read(3),failure('ARTIFACT_READER_BUSY',409));const before=f.fileCloses().length,ending=h.close();assert.equal(ending,h.close());let done=false;void ending.then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);assert.equal(f.fileCloses().length,before);f.state.waiter.release();await assert.rejects(pending,failure('ARTIFACT_READER_CLOSED',409));await ending;await r.dispose();closed(f);
});

test('artifactReader 취소 beforeIO·원 signal/read signal 지연 취소 후 후속읽기0',async()=>{
 const make=await factory(),f=fixture(),r=make(f.binding,f.deps),already=new AbortController();already.abort();await assert.rejects(r.open(f.ref,already.signal),failure('ARTIFACT_READER_CANCELLED',409));assert.equal(f.trace.length,0);await r.dispose();
 for(const original of [false,true]){const f=fixture(),r=make(f.binding,f.deps),controller=new AbortController(),h=await r.open(f.ref,original?controller.signal:undefined);f.state.pauseRead=true;const pending=h.read(3,original?undefined:controller.signal);await f.state.entered.wait;const before=f.fileCloses().length;controller.abort();assert.equal(f.fileCloses().length,before);f.state.waiter.release();await assert.rejects(pending,failure('ARTIFACT_READER_CANCELLED',409));await h.close();await r.dispose();closed(f);assert.equal(f.fileReads().length,1);}
});

test('artifactReader read 뒤 현재성 변경은 반환폐기·close실패 재시도0·나머지FD 회수',async()=>{
 const{f,r,h}=await setup();f.state.pauseRead=true;const pending=h.read(3);await f.state.entered.wait;f.state.change=(p,v)=>{if(p===filePath)v.ctimeNs='999';};f.state.waiter.release();await assert.rejects(pending,failure('ARTIFACT_READER_UNVERIFIED',412));f.state.failClose=filePath;const ending=h.close();assert.equal(ending,h.close());await assert.rejects(ending,failure('ARTIFACT_READER_CLEANUP_FAILED',503));await clean(r);closed(f);
});
