import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';

// 메모리 native-port 모델만 사용한다. 실제 syscall/FS/ABI/catalog 활성화 증거가 아니다.
type Identity={device:string;inode:string};
type Inspection={identity:Identity;kind:string;symlink:boolean;uid:number;gid:number;mode:string};
type Binding={slotId:string;installationId:string;purpose:'BACKUP_TARGET'|'KEY_VAULT';profileRef:{id:string;version:number;contentHash:string};expectedRootIdentity:Identity;ownerUid:number};
type RootObservation={binding:Binding;generation:number;root:Inspection&{availableBytes:number;availableInodes:number};parents:Inspection[]};
type FileObservation={generation:number;file:Inspection&{bytes:number}};
interface NativePort {
 openRoot(binding:Binding):Promise<object>;
 inspectRoot(root:object):Promise<RootObservation>;
 create(root:object,input:{fileId:string;bytes:Uint8Array;exclusive:true;noFollow:true;mode:number}):Promise<{capability:object;observation:FileObservation}>;
 open(root:object,fileId:string,input:{noFollow:true}):Promise<{capability:object;observation:FileObservation}>;
 stat(root:object,file:object):Promise<FileObservation>;
 read(root:object,file:object,maxBytes:number):Promise<Uint8Array>;
 sync(root:object,file:object):Promise<void>;
 remove(root:object,file:object,expected:Identity):Promise<{identity:Identity;removed:true}>;
 publish(root:object,file:object,expected:Identity,input:{fileId:string;exclusive:true;noFollow:true}):Promise<{identity:Identity;fileId:string;exclusive:true;temporaryRemoved:true}>;
 fsyncParent(root:object):Promise<void>;
 closeFile(root:object,file:object):Promise<void>;
 closeRoot(root:object):Promise<void>;
}
const id=(n:number)=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding=(n=1):Binding=>({slotId:id(n),installationId:id(100),purpose:'KEY_VAULT',profileRef:{id:id(101),version:1,contentHash:'a'.repeat(64)},expectedRootIdentity:{device:'41',inode:String(1000+n)},ownerUid:999});
const exact=(code:string,status:number)=>(e:any)=>e instanceof AuthFailure&&e.message===code&&e.statusCode===status;
const privateMarker='synthetic-private-native-path-and-bytes';
function deferred(){let release!:()=>void;const wait=new Promise<void>(r=>{release=r;});return{wait,release};}
async function model(){const url=new URL('../../../apps/server/modules/backups/installation-resource-posix.ts',import.meta.url),m:any=existsSync(url)?await import(url.href):{};assert.equal(typeof m.InstallationResourcePosixAdapter,'function','관리되는 native-port adapter 미구현');return m.InstallationResourcePosixAdapter;}
function nativeFixture(){
 type Row={root:object;fileId:string;bytes:Uint8Array;observation:FileObservation;closed:boolean;created:boolean};
 const trace:string[]=[],roots=new Map<object,RootObservation>(),rows=new Map<object,Row>(),names=new Map<object,Map<string,object>>();
 const state={fault:'',pause:'',gate:deferred(),entered:deferred(),captured:null as Uint8Array|null,rootChange:null as ((v:RootObservation)=>void)|null,fileChange:null as ((v:FileObservation)=>void)|null,publishPartial:false};
 const point=async(name:string)=>{trace.push(name);if(state.pause===name){state.entered.release();await state.gate.wait;}if(state.fault===name)throw Error(privateMarker);};
 const requireRoot=(r:object)=>{assert(roots.has(r),'native root 소유');return roots.get(r)!;};
 const requireFile=(r:object,f:object)=>{requireRoot(r);const row=rows.get(f);assert(row&&row.root===r&&!row.closed,'native 열린 자기 file');return row;};
 const snapshot=(row:Row)=>{const value=structuredClone(row.observation);state.fileChange?.(value);return value;};
 const newFile=(r:object,fileId:string,data:Uint8Array,created:boolean)=>{
  const f={},row:Row={root:r,fileId,bytes:Uint8Array.from(data),created,closed:false,observation:{generation:1,file:{identity:{device:'41',inode:String(9000+rows.size)},kind:'file',symlink:false,uid:999,gid:999,mode:'600',bytes:data.length}}};
  rows.set(f,row);names.get(r)!.set(fileId,f);return{capability:f,observation:snapshot(row)};
 };
 const port:NativePort={
  async openRoot(b){await point('OPEN_ROOT');const r={};roots.set(r,{binding:structuredClone(b),generation:1,root:{identity:{...b.expectedRootIdentity},kind:'directory',symlink:false,uid:999,gid:999,mode:'700',availableBytes:1048576,availableInodes:1024},parents:[{identity:{device:'41',inode:'40'},kind:'directory',symlink:false,uid:0,gid:0,mode:'755'}]});names.set(r,new Map());return r;},
  async inspectRoot(r){await point('ROOT');const v=structuredClone(requireRoot(r));state.rootChange?.(v);return v;},
  async create(r,input){requireRoot(r);state.captured=input.bytes;await point('CREATE');assert(!names.get(r)!.has(input.fileId));assert.equal(input.exclusive,true);assert.equal(input.noFollow,true);assert.equal(input.mode,0o600);return newFile(r,input.fileId,input.bytes,true);},
  async open(r,fileId,input){requireRoot(r);await point('OPEN');assert.equal(input.noFollow,true);const old=names.get(r)!.get(fileId);assert(old);const original=rows.get(old)!;const cap={};rows.set(cap,{...original,bytes:original.bytes,observation:structuredClone(original.observation),created:false,closed:false});return{capability:cap,observation:snapshot(rows.get(cap)!)};},
  async stat(r,f){await point('STAT');return snapshot(requireFile(r,f));},
  async read(r,f,max){const row=requireFile(r,f);await point('READ');assert(Number.isSafeInteger(max)&&max>0&&max<=16385);return row.bytes.subarray(0,max);},
  async sync(r,f){requireFile(r,f);await point('SYNC');},
  async remove(r,f,expected){const row=requireFile(r,f);await point('REMOVE');assert(row.created);assert.deepEqual(row.observation.file.identity,expected);assert.equal(names.get(r)!.get(row.fileId),f);names.get(r)!.delete(row.fileId);return{identity:{...expected},removed:true};},
  async publish(r,f,expected,input){const row=requireFile(r,f);await point('PUBLISH');assert(row.created);assert.deepEqual(row.observation.file.identity,expected);assert(!names.get(r)!.has(input.fileId));names.get(r)!.set(input.fileId,f);if(state.publishPartial)throw Error(privateMarker);names.get(r)!.delete(row.fileId);row.fileId=input.fileId;return{identity:{...expected},fileId:input.fileId,exclusive:true,temporaryRemoved:true};},
  async fsyncParent(r){requireRoot(r);await point('PARENT_SYNC');},
  async closeFile(r,f){const row=requireFile(r,f);row.closed=true;await point('CLOSE_FILE');},
  async closeRoot(r){requireRoot(r);await point('CLOSE_ROOT');roots.delete(r);}
 };
 return{port,state,trace,roots,rows,names,newFile,count:(s:string)=>trace.filter(v=>v===s).length};
}
async function setup(n=1){const Model=await model(),native=nativeFixture(),adapter=new Model(native.port),config=binding(n),slot=await adapter.prepareSlot(config);return{native,adapter,config,slot,root:slot.rootHandle};}
const create=(root:any,n=10,bytes:Uint8Array=Uint8Array.of(1,2,3))=>root.create({fileId:id(n),bytes,exclusive:true,noFollow:true,mode:0o600});
async function safeDispose(adapter:any){try{await adapter.dispose();}catch{/* 해당 실패는 각 시험에서 별도 판정한다. */}}

test('posixHandle 생성→읽기→열린 자기 정리와 parent sync 뒤 단발 close',async()=>{
 const z=await setup();try{
  assert.equal(z.slot.slotId,z.config.slotId);assert.deepEqual(z.slot.expectedRootIdentity,z.config.expectedRootIdentity);
  const h=await create(z.root);await h.sync();const s=await h.stat();assert.deepEqual(await h.read(1025),Uint8Array.of(1,2,3));
  await z.root.remove(h,s.identity);await z.root.fsyncParent();await h.close();await h.close();
  assert.deepEqual(z.native.trace.filter(v=>['REMOVE','PARENT_SYNC','CLOSE_FILE'].includes(v)),['REMOVE','PARENT_SYNC','CLOSE_FILE']);
  assert.equal([...z.native.names.values()][0]!.size,0);await z.adapter.dispose();assert.equal(z.native.count('CLOSE_FILE'),1);assert.equal(z.native.count('CLOSE_ROOT'),1);
 }finally{await safeDispose(z.adapter);}
});

test('posixHandle 배타 게시 성공은 동일 inode와 tmp 제거이며 기존 조회·게시 파일 삭제0',async()=>{
 const z=await setup();try{
  const h=await create(z.root),s=await h.stat();await h.sync();await z.root.publish(h,s.identity,{fileId:id(20),exclusive:true,noFollow:true});await z.root.fsyncParent();
  const named=[...z.native.names.values()][0]!;assert.equal(named.has(id(10)),false);assert.equal(named.has(id(20)),true);
  await assert.rejects(z.root.remove(h,s.identity),exact('RESOURCE_UNVERIFIED',412));assert.equal(z.native.count('REMOVE'),0);
  await h.close();const old=await z.root.open(id(20),{noFollow:true});assert.deepEqual((await old.stat()).identity,s.identity);assert.deepEqual(await old.read(16385),Uint8Array.of(1,2,3));
  await assert.rejects(z.root.remove(old,s.identity),exact('RESOURCE_UNVERIFIED',412));assert.equal(z.native.count('REMOVE'),0);await old.close();
 }finally{await safeDispose(z.adapter);}
});

test('posixHandle 타root·틀린 identity·닫힌 handle·임의 path와 과대 입력은 native mutation0',async()=>{
 const z=await setup();try{
  const other=await z.adapter.prepareSlot(binding(2)),h=await create(z.root),s=await h.stat();
  await assert.rejects(other.rootHandle.remove(h,s.identity),exact('RESOURCE_UNVERIFIED',412));
  await assert.rejects(z.root.remove(h,{device:'41',inode:'wrong'}),exact('RESOURCE_UNVERIFIED',412));
  for(const input of [{fileId:'../escape',bytes:Uint8Array.of(1),exclusive:true,noFollow:true,mode:0o600},{fileId:id(11),bytes:new Uint8Array(16385),exclusive:true,noFollow:true,mode:0o600},{fileId:id(11),bytes:Uint8Array.of(1),exclusive:false,noFollow:true,mode:0o600}])await assert.rejects(z.root.create(input),exact('INPUT_INVALID',400));
  await assert.rejects(h.read(16386),exact('INPUT_INVALID',400));assert.equal(z.native.count('CREATE'),1);assert.equal(z.native.count('READ'),0);
  await h.close();await assert.rejects(z.root.remove(h,s.identity),exact('RESOURCE_UNVERIFIED',412));assert.equal(z.native.count('REMOVE'),0);
 }finally{await safeDispose(z.adapter);}
});

test('posixHandle 입력·반환 bytes와 binding 변경은 격리되고 내부 create 복사본은 소거된다',async()=>{
 const z=await setup();try{
  const bytes=Uint8Array.of(4,5,6);z.native.state.pause='CREATE';const pending=create(z.root,12,bytes);await z.native.state.entered.wait;bytes.fill(9);z.config.expectedRootIdentity.inode='caller-mutated';z.config.profileRef.contentHash='b'.repeat(64);z.native.state.gate.release();const h=await pending;
  assert(z.native.state.captured!.every(v=>v===0));assert.deepEqual(bytes,Uint8Array.of(9,9,9));const read=await h.read(10);assert.deepEqual(read,Uint8Array.of(4,5,6));read.fill(8);assert.deepEqual(await h.read(10),Uint8Array.of(4,5,6));
  const first=await h.stat();first.identity.inode='caller-mutated';assert.notEqual((await h.stat()).identity.inode,'caller-mutated');await h.close();
 }finally{z.native.state.gate.release();await safeDispose(z.adapter);}
});

test('posixHandle root 부모·세대·파일 종류 변경은 true 한 개로 승인되지 않는다',async()=>{
 for(const mode of ['PARENT_LINK','ROOT_GENERATION','FILE_SPECIAL'] as const){const z=await setup();try{
  if(mode==='PARENT_LINK')z.native.state.rootChange=v=>{v.parents[0]!.symlink=true;};
  if(mode==='ROOT_GENERATION')z.native.state.rootChange=v=>{v.generation++;};
  if(mode==='FILE_SPECIAL')z.native.state.fileChange=v=>{v.file.kind='fifo';};
  await assert.rejects(create(z.root),mode==='FILE_SPECIAL'?exact('RESOURCE_STATE_UNKNOWN',503):exact('RESOURCE_UNVERIFIED',412));assert.equal(z.native.count('REMOVE'),0);assert.equal(z.native.count('PUBLISH'),0);
  if(mode!=='FILE_SPECIAL')assert.equal(z.native.count('CREATE'),0);else assert.equal(z.native.count('CLOSE_FILE'),1,'부적합 생성 관측은 자기 cap만 닫고 파일 보존');
 }finally{await safeDispose(z.adapter);}}
});

for(const fault of ['CREATE','SYNC','REMOVE','PUBLISH','PARENT_SYNC','CLOSE_FILE'] as const)test(`posixUnknown ${fault} 원오류 비노출·효과 재시도0·소유 close만 회수`,async()=>{
 const z=await setup();let h:any;
 try{
  if(fault!=='CREATE')h=await create(z.root);const identity=h?(await h.stat()).identity:null;
  z.native.state.fault=fault;
  const run=()=>fault==='CREATE'?create(z.root,30):fault==='SYNC'?h.sync():fault==='REMOVE'?z.root.remove(h,identity):fault==='PUBLISH'?z.root.publish(h,identity,{fileId:id(31),exclusive:true,noFollow:true}):fault==='PARENT_SYNC'?z.root.fsyncParent():h.close();
  for(let attempt=0;attempt<2;attempt++)await assert.rejects(run(),(e:any)=>{assert(exact('RESOURCE_STATE_UNKNOWN',503)(e));assert(![String(e),e.stack,JSON.stringify(e),String(e.cause)].join('|').includes(privateMarker));return true;});
  if(h&&fault!=='CLOSE_FILE'){await assert.rejects(fault==='REMOVE'?z.root.publish(h,identity,{fileId:id(32),exclusive:true,noFollow:true}):z.root.remove(h,identity),exact('RESOURCE_STATE_UNKNOWN',503));}
  assert.equal(z.native.count(fault),1,'불명 native 연산 단발');assert.equal(z.native.count('REMOVE'),fault==='REMOVE'?1:0);
  assert.equal(z.native.count('PUBLISH'),fault==='PUBLISH'?1:0);
  if(fault==='CREATE')assert(z.native.state.captured!.every(v=>v===0),'실패한 create 복사본 소거');
 }finally{await safeDispose(z.adapter);if(h)assert.equal(z.native.count('CLOSE_FILE'),1);assert.equal(z.native.count('CLOSE_ROOT'),1);}
});

test('posixUnknown final link 뒤 tmp 정리 불명은 두 이름 보존·게시 재시도0',async()=>{
 const z=await setup();try{
  const h=await create(z.root),s=await h.stat();z.native.state.publishPartial=true;
  await assert.rejects(z.root.publish(h,s.identity,{fileId:id(40),exclusive:true,noFollow:true}),exact('RESOURCE_STATE_UNKNOWN',503));
  const names=[...z.native.names.values()][0]!;assert(names.has(id(10))&&names.has(id(40)));
  await assert.rejects(z.root.publish(h,s.identity,{fileId:id(40),exclusive:true,noFollow:true}),exact('RESOURCE_STATE_UNKNOWN',503));
  assert.equal(z.native.count('PUBLISH'),1);assert.equal(z.native.count('REMOVE'),0);assert.equal(z.native.count('PARENT_SYNC'),0);
 }finally{await safeDispose(z.adapter);assert.equal(z.native.count('REMOVE'),0);}
});

test('posixLifetime 지연 publish 중 중복 publish/remove는 native 호출 전에 차단된다',async()=>{
 const z=await setup();try{
  const h=await create(z.root),s=await h.stat();z.native.state.pause='PUBLISH';const pending=z.root.publish(h,s.identity,{fileId:id(50),exclusive:true,noFollow:true});await z.native.state.entered.wait;
  await assert.rejects(z.root.publish(h,s.identity,{fileId:id(51),exclusive:true,noFollow:true}));await assert.rejects(z.root.remove(h,s.identity));assert.equal(z.native.count('PUBLISH'),1);assert.equal(z.native.count('REMOVE'),0);
  z.native.state.gate.release();await pending;await h.close();
 }finally{z.native.state.gate.release();await safeDispose(z.adapter);}
});

test('posixLifetime dispose는 신규 작업 차단·진행 read drain 뒤 file→root 단발 close',async()=>{
 const z=await setup();try{
  const h=await create(z.root);z.native.state.pause='READ';const pending=h.read(10);await z.native.state.entered.wait;
  const first=z.adapter.dispose(),second=z.adapter.dispose();assert.equal(first,second,'dispose는 동일 단발 Promise');
  await assert.rejects(z.adapter.prepareSlot(binding(2)),exact('RESOURCE_UNVERIFIED',412));await assert.rejects(create(z.root,60),exact('RESOURCE_UNVERIFIED',412));
  assert.equal(z.native.count('OPEN_ROOT'),1);assert.equal(z.native.count('CREATE'),1);assert.equal(z.native.count('CLOSE_FILE'),0);assert.equal(z.native.count('CLOSE_ROOT'),0);
  z.native.state.gate.release();assert.deepEqual(await pending,Uint8Array.of(1,2,3));await first;
  assert.deepEqual(z.native.trace.filter(v=>v.startsWith('CLOSE')),['CLOSE_FILE','CLOSE_ROOT']);await z.adapter.dispose();assert.equal(z.native.count('CLOSE_FILE'),1);assert.equal(z.native.count('CLOSE_ROOT'),1);assert.equal(z.native.count('REMOVE'),0);
 }finally{z.native.state.gate.release();await safeDispose(z.adapter);}
});

test('posixLifetime 같은 root 재준비는 동일 관리 handle·mutation guard를 공유한다',async()=>{
 const z=await setup();try{
  const again=await z.adapter.prepareSlot(structuredClone(z.config));assert.equal(again.rootHandle,z.root);assert.equal(z.native.count('OPEN_ROOT'),1);
  const h=await create(z.root),s=await h.stat();z.native.state.pause='PUBLISH';const pending=z.root.publish(h,s.identity,{fileId:id(70),exclusive:true,noFollow:true});await z.native.state.entered.wait;
  await assert.rejects(again.rootHandle.remove(h,s.identity));assert.equal(z.native.count('REMOVE'),0);z.native.state.gate.release();await pending;await h.close();
 }finally{z.native.state.gate.release();await safeDispose(z.adapter);}
});

test('posixReview root identity 속성 순서가 달라도 다른 slot의 동일 root 재소유는 거절한다',async()=>{
 const z=await setup();try{
  const next=binding(2);next.expectedRootIdentity={inode:z.config.expectedRootIdentity.inode,device:z.config.expectedRootIdentity.device};
  await assert.rejects(z.adapter.prepareSlot(next),exact('RESOURCE_UNVERIFIED',412));assert.equal(z.native.count('OPEN_ROOT'),1);
 }finally{await safeDispose(z.adapter);}
});

for(const boundary of ['PREPARE','CURRENT'] as const)test(`posixReview ${boundary} native AuthFailure 원객체는 비노출503이며 UNKNOWN 재호출0`,async()=>{
 const Model=await model(),native=nativeFixture(),adapter=new Model(native.port);let hits=0,root:any;
 const raw=Object.assign(new AuthFailure(boundary==='PREPARE'?'RESOURCE_UNVERIFIED':'RESOURCE_STATE_UNKNOWN',boundary==='PREPARE'?412:503),{cause:Error(privateMarker),nativeDetail:privateMarker});raw.stack=privateMarker;
 try{
  if(boundary==='PREPARE')native.port.openRoot=async()=>{hits++;throw raw;};
  else{root=(await adapter.prepareSlot(binding())).rootHandle;native.port.inspectRoot=async()=>{hits++;throw raw;};}
  const operation=()=>boundary==='PREPARE'?adapter.prepareSlot(binding()):root.inspect();
  for(let i=0;i<2;i++)await assert.rejects(operation(),(e:any)=>{assert(exact('RESOURCE_STATE_UNKNOWN',503)(e));assert.notEqual(e,raw);assert(![String(e),e.stack,JSON.stringify(e),String(e.cause)].join('|').includes(privateMarker));return true;});
  assert.equal(hits,1,'불명 native 상태를 다시 실행하지 않음');
 }finally{await safeDispose(adapter);}
});

for(const boundary of ['CREATE','OPEN'] as const)test(`posixReview ${boundary} file adopt 뒤 root 재검사 실패는 반환 못한 자기 cap을 즉시 단발 close한다`,async()=>{
 const z=await setup();try{
  if(boundary==='OPEN'){const cap=[...z.native.roots.keys()][0]!;z.native.newFile(cap,id(80),Uint8Array.of(7,8,9),false);}
  z.native.state.rootChange=v=>{if(z.native.count(boundary)>0)v.generation++;};
  const operation=boundary==='CREATE'?create(z.root,80):z.root.open(id(80),{noFollow:true});
  const error=await operation.then(()=>null,(e:any)=>e);assert(error instanceof AuthFailure);
  assert.equal(z.native.count('CLOSE_FILE'),1,'호출자가 handle을 받지 못했으므로 dispose까지 회수를 미루지 않음');
  assert(exact('RESOURCE_STATE_UNKNOWN',503)(error));assert.equal(z.native.count('REMOVE'),0);assert.equal(z.native.count('PUBLISH'),0);
  assert.equal([...z.native.names.values()][0]!.has(id(80)),true,'생성/기존 이름은 삭제하지 않음');await z.adapter.dispose();assert.equal(z.native.count('CLOSE_FILE'),1);
 }finally{await safeDispose(z.adapter);}
});


test('posixRetention 정상 300회 순차 조회는 닫힌 handle 보관과 무관하며 close Promise를 유지한다',async()=>{
 const z=await setup();try{
  const created=await create(z.root,80);await created.close();const retained:any[]=[];
  for(let n=0;n<300;n++){const h=await z.root.open(id(80),{noFollow:true});retained.push(h);assert.deepEqual(await h.read(10),Uint8Array.of(1,2,3));const closing=h.close();assert.equal(h.close(),closing);await closing;}
  const reads=z.native.count('READ');await assert.rejects(retained[0].read(10),exact('RESOURCE_UNVERIFIED',412));assert.equal(z.native.count('READ'),reads);
  assert.equal(z.native.count('CLOSE_FILE'),301);assert([...z.native.rows.values()].every(row=>row.closed));
  await z.adapter.dispose();assert.equal(z.native.count('CLOSE_FILE'),301);assert.equal(z.native.count('CLOSE_ROOT'),1);
 }finally{await safeDispose(z.adapter);}
});

test('posixRetention 불명 close는 동일 거절 Promise와 원 오류 차단을 보존한다',async()=>{
 const z=await setup();try{
  const h=await create(z.root,81);z.native.state.fault='CLOSE_FILE';const closing=h.close();assert.equal(h.close(),closing);await assert.rejects(closing,exact('RESOURCE_STATE_UNKNOWN',503));
  assert.equal(h.close(),closing);await assert.rejects(h.close(),exact('RESOURCE_STATE_UNKNOWN',503));await assert.rejects(h.read(10),exact('RESOURCE_UNVERIFIED',412));
  assert.equal(z.native.count('CLOSE_FILE'),1);assert.equal(z.native.count('READ'),0);await assert.rejects(z.adapter.dispose(),exact('RESOURCE_STATE_UNKNOWN',503));assert.equal(z.native.count('CLOSE_FILE'),1);
 }finally{await safeDispose(z.adapter);}
});
