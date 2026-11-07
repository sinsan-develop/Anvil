import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import * as fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {InstallationResourcePosixAdapter,type InstallationPosixBinding,type InstallationResourceNativePort} from '../../../apps/server/modules/backups/installation-resource-posix.ts';

// 작성 단계에서는 실행하지 않는다. 환경 미준비는 FAIL이며 skip 또는 native PASS가 아니다.
const QA_ROOT='/home/daon/anvil-v3-fn16-native-qa-20261029-01';
const CASES=join(QA_ROOT,'cases'),BINARY=join(QA_ROOT,'build/fn16_posix_safe_handle.node');
const bytes=Uint8Array.of(0x41,0x56,0x33,0x2d,0x51,0x41); // 공개 합성 fixture, 실제 키 아님
const uuid=(n:number)=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const ownKeys=(v:unknown,keys:string[])=>{assert(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),keys.slice().sort());};
const identity=(s:{dev:bigint;ino:bigint})=>({device:s.dev.toString(),inode:s.ino.toString()});
const absent=async(path:string)=>assert.rejects(fs.lstat(path),(e:any)=>e?.code==='ENOENT');
const fixedError=(e:any)=>{assert(e instanceof Error);assert(['INPUT_INVALID','RESOURCE_UNVERIFIED','RESOURCE_PROCESSING','RESOURCE_LIMIT','RESOURCE_STATE_UNKNOWN'].includes(e.message));assert.equal((e as Error & {code?:string}).code,e.message);assert.equal(e.cause,undefined);assert(![e.message,JSON.stringify(e)].join('|').includes(QA_ROOT));return true;};
const OPERATIONS=['openRoot','inspectRoot','create','open','stat','read','sync','remove','publish','fsyncParent','closeFile','closeRoot'];
type Snapshot={schemaVersion:1;installationId:string;slots:{binding:InstallationPosixBinding;absoluteRoot:string}[]};
let factory:(snapshot:Snapshot)=>InstallationResourceNativePort;
let qaIdentity:{device:string;inode:string},owner=0,caseCount=0;
const cleanupFaults:string[]=[];

async function protectedFile(path:string,mode:number){const s=await fs.lstat(path,{bigint:true});assert(s.isFile()&&!s.isSymbolicLink());assert.equal(Number(s.uid),owner);assert.equal(Number(s.mode&0o777n),mode);assert.equal(await fs.realpath(path),path);return s;}
async function guard(){const s=await fs.lstat(QA_ROOT,{bigint:true});assert(s.isDirectory()&&!s.isSymbolicLink());assert.deepEqual(identity(s),qaIdentity);assert.equal(Number(s.uid),owner);assert.equal(Number(s.mode&0o777n),0o700);assert.equal(await fs.realpath(QA_ROOT),QA_ROOT);}
function mountType(path:string,text:string){const entries=text.split('\n').filter(Boolean).map(line=>{const [left,right]=line.split(' - ');if(!left||!right)return null;const point=left.split(' ')[4];if(!point)return null;const decoded=point.replace(/\\([0-7]{3})/g,(_,oct:string)=>String.fromCharCode(parseInt(oct,8)));return{point:decoded,type:right.split(' ')[0]};}).filter((v):v is {point:string;type:string}=>!!v&&typeof v.type==='string'&&(path===v.point||path.startsWith(v.point.endsWith('/')?v.point:v.point+'/'))).sort((a,b)=>b.point.length-a.point.length);return entries[0]?.type;}

before(async()=>{
 assert.equal(process.platform,'linux','실제 Linux 실행안이 필요함');assert.equal(process.arch,'x64');assert.match(process.versions.node,/^24\./);assert(Number(process.versions.node.split('.')[1])>=18);
 assert.equal(process.env.ANVIL_FN16_NATIVE_QA_ROOT,QA_ROOT,'별도 exact 실행안 없이 실행하지 않음');owner=process.getuid!();assert(owner>0,'QA는 권한 상승 없이 수행');assert.equal(process.getgid!(),owner,'현재 계약의 service UID/GID 일치');
 const root=await fs.lstat(QA_ROOT,{bigint:true});assert(root.isDirectory()&&!root.isSymbolicLink());qaIdentity=identity(root);await guard();
 const manifestPath=join(QA_ROOT,'execution-manifest.json');const manifestStat=await protectedFile(manifestPath,0o600);assert(manifestStat.size<=8192n);const raw=await fs.readFile(manifestPath);assert(raw.length<=8192);const plan=JSON.parse(raw.toString('utf8'));
 ownKeys(plan,['schemaVersion','purpose','rootIdentity','ownerUid','ownerGid','expiresAt','binarySha256','addonSourceSha256','bindingSourceSha256']);assert.equal(plan.schemaVersion,1);assert.equal(plan.purpose,'FN16_NATIVE_ISOLATED_QA');assert.deepEqual(plan.rootIdentity,qaIdentity);assert.equal(plan.ownerUid,owner);assert.equal(plan.ownerGid,owner);assert(Number.isFinite(Date.parse(plan.expiresAt))&&Date.now()<Date.parse(plan.expiresAt));assert(sha(plan.binarySha256)&&sha(plan.addonSourceSha256)&&sha(plan.bindingSourceSha256));
 assert.equal(mountType(QA_ROOT,await fs.readFile('/proc/self/mountinfo','utf8')),'ext4');assert.equal(mountType('/proc/self/fd',await fs.readFile('/proc/self/mountinfo','utf8')),'proc');
 const binary=await fs.lstat(BINARY,{bigint:true});assert(binary.isFile()&&!binary.isSymbolicLink());assert.equal(Number(binary.uid),owner);assert.equal(Number(binary.mode&0o022n),0);assert.equal(await fs.realpath(BINARY),BINARY);assert.equal(hash(await fs.readFile(BINARY)),plan.binarySha256);
 assert.equal(hash(await fs.readFile(new URL('../../../native/fn16-posix-safe-handle/addon.c',import.meta.url))),plan.addonSourceSha256);assert.equal(hash(await fs.readFile(new URL('../../../native/fn16-posix-safe-handle/binding.gyp',import.meta.url))),plan.bindingSourceSha256);
 await absent(CASES);await guard();await fs.mkdir(CASES,{mode:0o700});
 const addon=createRequire(import.meta.url)(BINARY);ownKeys(addon,['createInstallationResourceNativePort']);assert.equal(typeof addon.createInstallationResourceNativePort,'function');factory=addon.createInstallationResourceNativePort;
});
after(async()=>{if(qaIdentity)await guard();assert.deepEqual(cleanupFaults,[],'자기 capability 회수 미확정은 성공으로 숨기지 않음');});

async function ownedDescriptors(path:string){
 const found:string[]=[];for(const name of await fs.readdir('/proc/self/fd')){let target:string;try{target=await fs.readlink('/proc/self/fd/'+name);}catch(e:any){if(e?.code==='ENOENT')continue;throw e;}if(target===path||target.startsWith(path+'/'))found.push(name);}return found;
}

async function fixture(){
 await guard();const n=++caseCount;assert(n<=16);const base=join(CASES,'case-'+n);await fs.mkdir(base,{mode:0o700});const path=join(base,'slot');await fs.mkdir(path,{mode:0o700});const s=await fs.stat(path,{bigint:true});
 const binding:InstallationPosixBinding={slotId:uuid(n),installationId:uuid(100),purpose:'KEY_VAULT',profileRef:{id:uuid(101),version:1,contentHash:'a'.repeat(64)},expectedRootIdentity:identity(s),ownerUid:owner};
 const snapshot:Snapshot={schemaVersion:1,installationId:binding.installationId,slots:[{binding:structuredClone(binding),absoluteRoot:path}]};
 const port=factory(snapshot);ownKeys(port,OPERATIONS);for(const method of OPERATIONS)assert.equal(typeof(port as any)[method],'function');
 const cap=await port.openRoot(binding),files:object[]=[];
 const create=async(fileId=uuid(200),data:Uint8Array=bytes)=>{const result=await port.create(cap,{fileId,bytes:data,exclusive:true,noFollow:true,mode:0o600});ownKeys(result,['capability','observation']);files.push(result.capability);return result;};
 const open=async(fileId:string)=>{const result=await port.open(cap,fileId,{noFollow:true});files.push(result.capability);return result;};
 const close=async()=>{for(const file of files)try{await port.closeFile(cap,file);}catch{cleanupFaults.push('CLOSE_FILE');}try{await port.closeRoot(cap);}catch{cleanupFaults.push('CLOSE_ROOT');}};
 return{base,path,binding,snapshot,port,cap,files,create,open,close};
}

test('fn16Native 실제 probe bytes·inode 관측→자기 remove→parent sync→close',async()=>{
 const f=await fixture();try{
  const root=await f.port.inspectRoot(f.cap);ownKeys(root,['binding','generation','root','parents']);assert.deepEqual(root.binding,f.binding);assert.deepEqual(root.root.identity,f.binding.expectedRootIdentity);assert.equal(root.root.mode,'700');assert.equal(root.root.uid,owner);assert(root.parents.length>0&&root.parents.every(p=>p.kind==='directory'&&p.symlink===false));
  const input=Uint8Array.from(bytes),pending=f.create(uuid(201),input);input.fill(0xff);const created=await pending;await f.port.sync(f.cap,created.capability);const observed=await f.port.stat(f.cap,created.capability),actual=await fs.stat(join(f.path,uuid(201)),{bigint:true});assert.deepEqual(observed.file.identity,identity(actual));assert.equal(observed.file.mode,'600');assert.equal(observed.file.bytes,bytes.length);assert.deepEqual(await f.port.read(f.cap,created.capability,1025),bytes);
  await assert.rejects(f.port.read(f.cap,created.capability,16386),fixedError);const removed=await f.port.remove(f.cap,created.capability,observed.file.identity);assert.deepEqual(removed,{identity:observed.file.identity,removed:true});await absent(join(f.path,uuid(201)));await f.port.fsyncParent(f.cap);await f.port.closeFile(f.cap,created.capability);
 }finally{await f.close();}
});

test('fn16Native 실제 publish는 같은 inode final과 tmp 제거·기존 조회 삭제 차단',async()=>{
 const f=await fixture();try{
  const source=uuid(202),final=uuid(203),created=await f.create(source);await f.port.sync(f.cap,created.capability);const before=await fs.stat(join(f.path,source),{bigint:true});const published=await f.port.publish(f.cap,created.capability,created.observation.file.identity,{fileId:final,exclusive:true,noFollow:true});assert.deepEqual(published,{identity:identity(before),fileId:final,exclusive:true,temporaryRemoved:true});await absent(join(f.path,source));assert.deepEqual(identity(await fs.stat(join(f.path,final),{bigint:true})),identity(before));await f.port.fsyncParent(f.cap);
  await assert.rejects(f.port.remove(f.cap,created.capability,created.observation.file.identity),fixedError);await f.port.closeFile(f.cap,created.capability);
  const existing=await f.open(final);assert.deepEqual(await f.port.read(f.cap,existing.capability,16385),bytes);await assert.rejects(f.port.remove(f.cap,existing.capability,existing.observation.file.identity),fixedError);assert.deepEqual(new Uint8Array(await fs.readFile(join(f.path,final))),bytes);
 }finally{await f.close();}
});

test('fn16Native final 선점은 기존 marker 덮기0·source 이름 보존',async()=>{
 const f=await fixture();try{
  const source=uuid(204),final=uuid(205),marker=Uint8Array.of(8,7,6);await fs.writeFile(join(f.path,final),marker,{flag:'wx',mode:0o600});const created=await f.create(source);await f.port.sync(f.cap,created.capability);
  await assert.rejects(f.port.publish(f.cap,created.capability,created.observation.file.identity,{fileId:final,exclusive:true,noFollow:true}),fixedError);assert.deepEqual(new Uint8Array(await fs.readFile(join(f.path,final))),marker);assert.deepEqual(new Uint8Array(await fs.readFile(join(f.path,source))),bytes);
 }finally{await f.close();}
});

test('fn16Native 위조·타port/root·닫힌 capability와 path 인수는 거절',async()=>{
 const a=await fixture(),b=await fixture();try{
  const created=await a.create(uuid(206));await assert.rejects(a.port.inspectRoot({}),fixedError);await assert.rejects(b.port.stat(b.cap,created.capability),fixedError);await assert.rejects(a.port.create(a.cap,{fileId:'../outside',bytes,exclusive:true,noFollow:true,mode:0o600}),fixedError);await assert.rejects(a.port.create(a.cap,{fileId:uuid(207),bytes:new Uint8Array(16385),exclusive:true,noFollow:true,mode:0o600}),fixedError);
  await a.port.closeFile(a.cap,created.capability);await assert.rejects(a.port.read(a.cap,created.capability,10),fixedError);assert.deepEqual(new Uint8Array(await fs.readFile(join(a.path,uuid(206)))),bytes);
 }finally{await a.close();await b.close();}
});

test('fn16Native 동일 실제 root는 별도 port의 이중 writer를 막고 확정 close 뒤에만 재소유',async()=>{
 const f=await fixture();let second:InstallationResourceNativePort|undefined,cap:object|undefined;
 try{
  second=factory(structuredClone(f.snapshot));await assert.rejects(second.openRoot(f.binding),fixedError);const previous=(await f.port.inspectRoot(f.cap)).generation;await f.port.closeRoot(f.cap);cap=await second.openRoot(f.binding);const next=await second.inspectRoot(cap);assert(next.generation>previous);assert.deepEqual(next.root.identity,f.binding.expectedRootIdentity);await assert.rejects(f.port.inspectRoot(f.cap),fixedError);
 }finally{if(second&&cap)await second.closeRoot(cap);await f.close();}
});

test('fn16Native root·자식 symlink는 따라가지 않고 기존 marker를 보존한다',async()=>{
 const f=await fixture();try{
  const marker=join(f.base,'marker');await fs.writeFile(marker,bytes,{flag:'wx',mode:0o600});await fs.symlink(marker,join(f.path,uuid(208)));await assert.rejects(f.port.open(f.cap,uuid(208),{noFollow:true}),fixedError);assert.deepEqual(new Uint8Array(await fs.readFile(marker)),bytes);
  await f.port.closeRoot(f.cap);const link=join(f.base,'linked-slot');await fs.symlink(f.path,link);const snapshot=structuredClone(f.snapshot);snapshot.slots[0]!.absoluteRoot=link;const port=factory(snapshot);await assert.rejects(port.openRoot(f.binding),fixedError);
 }finally{await f.close();}
});

test('fn16Native root 경로 사전 교체는 held 원본·대체 경로 모두 새 파일 생성0',async()=>{
 const f=await fixture();try{
  const moved=join(f.base,'original-slot');await fs.rename(f.path,moved);await fs.mkdir(f.path,{mode:0o700});await assert.rejects(f.port.create(f.cap,{fileId:uuid(209),bytes,exclusive:true,noFollow:true,mode:0o600}),fixedError);assert.deepEqual(await fs.readdir(moved),[]);assert.deepEqual(await fs.readdir(f.path),[]);
 }finally{await f.close();}
});

test('fn16Native remove 직전 이름 교체는 다른 inode 삭제0·원 파일 보존',async()=>{
 const f=await fixture();try{
  const fileId=uuid(210),moved=join(f.path,uuid(211)),created=await f.create(fileId),marker=Uint8Array.of(9,8,7);await fs.rename(join(f.path,fileId),moved);await fs.writeFile(join(f.path,fileId),marker,{flag:'wx',mode:0o600});await assert.rejects(f.port.remove(f.cap,created.capability,created.observation.file.identity),fixedError);assert.deepEqual(new Uint8Array(await fs.readFile(join(f.path,fileId))),marker);assert.deepEqual(new Uint8Array(await fs.readFile(moved)),bytes);
 }finally{await f.close();}
});

test('fn16Native initializer는 전체 slots를 선검증하고 입력 변경으로 등록 경로가 바뀌지 않는다',async()=>{
 const f=await fixture();try{
  for(const mode of ['DUPLICATE_SLOT','DUPLICATE_IDENTITY','INVALID_PATH'] as const){const bad=structuredClone(f.snapshot),entry=structuredClone(bad.slots[0]!);if(mode==='DUPLICATE_SLOT')bad.slots.push(entry);if(mode==='DUPLICATE_IDENTITY'){entry.binding.slotId=uuid(400);entry.absoluteRoot=join(f.base,'not-created');bad.slots.push(entry);}if(mode==='INVALID_PATH')entry.absoluteRoot='../outside';if(mode==='INVALID_PATH')bad.slots[0]=entry;assert.throws(()=>factory(bad),fixedError);}
  const frozen=structuredClone(f.snapshot),port=factory(frozen);frozen.slots[0]!.absoluteRoot=join(f.base,'not-created');frozen.slots[0]!.binding.expectedRootIdentity.inode='1';await f.port.closeRoot(f.cap);const cap=await port.openRoot(f.binding);try{assert.deepEqual((await port.inspectRoot(cap)).root.identity,f.binding.expectedRootIdentity);}finally{await port.closeRoot(cap);}
 }finally{await f.close();}
});

test('fn16Native 관리 adapter dispose는 실제 진행 read 뒤 close하고 신규 사용을 막는다',async()=>{
 await guard();const n=++caseCount;assert(n<=16);const path=join(CASES,'managed-'+n);await fs.mkdir(path,{mode:0o700});const st=await fs.stat(path,{bigint:true});const binding:InstallationPosixBinding={slotId:uuid(500),installationId:uuid(100),purpose:'KEY_VAULT',profileRef:{id:uuid(101),version:1,contentHash:'a'.repeat(64)},expectedRootIdentity:identity(st),ownerUid:owner};
 const port=factory({schemaVersion:1,installationId:binding.installationId,slots:[{binding,absoluteRoot:path}]}),adapter=new InstallationResourcePosixAdapter(port);try{
  const root=(await adapter.prepareSlot(binding)).rootHandle,h=await root.create({fileId:uuid(212),bytes,exclusive:true,noFollow:true,mode:0o600});await h.sync();assert((await ownedDescriptors(path)).length>=2,'root와 file FD가 실제 열려 있어야 함');const pending=h.read(16385),disposed=adapter.dispose();assert.equal(adapter.dispose(),disposed);assert.deepEqual(await pending,bytes);await disposed;assert.deepEqual(await ownedDescriptors(path),[],'dispose 뒤 해당 root의 열린 FD가 없어야 함');await assert.rejects(adapter.prepareSlot(binding));await assert.rejects(h.read(10));assert.deepEqual(new Uint8Array(await fs.readFile(join(path,uuid(212)))),bytes);
 }finally{await adapter.dispose();}
});


test('fn16Native 중간 부모 이름 교체는 root inode가 같아도 새 작업을 거절한다',async()=>{
 const f=await fixture();try{
  const moved=f.base+'-moved';await fs.rename(f.base,moved);await fs.mkdir(f.base,{mode:0o700});await fs.mkdir(f.path,{mode:0o700});
  await assert.rejects(f.port.create(f.cap,{fileId:uuid(213),bytes,exclusive:true,noFollow:true,mode:0o600}),fixedError);
  assert.deepEqual(await fs.readdir(join(moved,'slot')),[]);assert.deepEqual(await fs.readdir(f.path),[]);
 }finally{await f.close();}
});

test('fn16Native 직접 close는 이미 받은 read를 drain하고 신규 작업을 거절한다',async()=>{
 const f=await fixture();try{
  const created=await f.create(uuid(214));await f.port.sync(f.cap,created.capability);await assert.rejects(f.port.closeRoot(f.cap),fixedError);
  const pending=f.port.read(f.cap,created.capability,16385),closing=f.port.closeFile(f.cap,created.capability);
  assert.equal(f.port.closeFile(f.cap,created.capability),closing);const refused=assert.rejects(f.port.read(f.cap,created.capability,16385),fixedError);
  assert.deepEqual(await pending,bytes);await closing;await refused;await f.port.closeRoot(f.cap);assert.deepEqual(await ownedDescriptors(f.path),[]);
  assert.deepEqual(new Uint8Array(await fs.readFile(join(f.path,uuid(214)))),bytes);
 }finally{await f.close();}
});


test('fn16Native FIFO 이름은 writer를 기다리지 않고 거절하며 기존 inode를 보존한다',{timeout:3000},async()=>{
 const f=await fixture();try{
  const path=join(f.path,uuid(215));await promisify(execFile)('/usr/bin/python3',['-I','-c','import os,sys; os.mkfifo(sys.argv[1],0o600)',path],{timeout:1500,maxBuffer:1024});
  const before=await fs.lstat(path,{bigint:true});assert(before.isFIFO());await assert.rejects(f.port.open(f.cap,uuid(215),{noFollow:true}),fixedError);
  const after=await fs.lstat(path,{bigint:true});assert(after.isFIFO());assert.deepEqual(identity(after),identity(before));
 }finally{await f.close();}
});


test('fn16Native 닫힌 cap 300개를 계속 보관해도 정상 순차 조회와 FD 회수는 계속된다',async()=>{
 const f=await fixture();try{
  const fileId=uuid(216),first=await f.create(fileId);await f.port.closeFile(f.cap,first.capability);const retained:object[]=[first.capability];
  for(let n=0;n<300;n++){const opened=await f.open(fileId);retained.push(opened.capability);assert.deepEqual(await f.port.read(f.cap,opened.capability,16385),bytes);const closing=f.port.closeFile(f.cap,opened.capability);assert.equal(f.port.closeFile(f.cap,opened.capability),closing);await closing;}
  assert.equal(retained.length,301);await assert.rejects(f.port.read(f.cap,retained[0]!,10),fixedError);assert.deepEqual(new Uint8Array(await fs.readFile(join(f.path,fileId))),bytes);
  await f.port.closeRoot(f.cap);assert.deepEqual(await ownedDescriptors(f.path),[]);
 }finally{await f.close();}
});

test('fn16Native 닫힌 root cap 65개를 보관해도 확정 회수한 root를 재소유한다',async()=>{
 const f=await fixture();let current=f.cap;const retained:object[]=[];
 try{for(let n=0;n<65;n++){retained.push(current);const closing=f.port.closeRoot(current);assert.equal(f.port.closeRoot(current),closing);await closing;current=await f.port.openRoot(f.binding);assert.deepEqual((await f.port.inspectRoot(current)).root.identity,f.binding.expectedRootIdentity);}
  assert.equal(retained.length,65);await assert.rejects(f.port.inspectRoot(retained[0]!),fixedError);await f.port.closeRoot(current);assert.deepEqual(await ownedDescriptors(f.path),[]);
 }finally{if(current!==f.cap)await f.port.closeRoot(current);await f.close();}
});
