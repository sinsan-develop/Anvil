import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';

// 기존 native ABI 실행을 반복하지 않는다. 이 포트와 verifier는 메모리 합성 전용이다.
const id=(n:number)=>`71000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const marker='synthetic-private-native-detail';
const clone=<T>(v:T):T=>structuredClone(v);
const deferred=()=>{let release!:()=>void;const wait=new Promise<void>(r=>{release=r;});return{wait,release};};
const failure=(code:string,status:number)=>(e:any)=>e instanceof AuthFailure&&e.message===code&&e.statusCode===status&&!JSON.stringify(e).includes(marker)&&!e.cause;
const snapshot=()=>({installationId:id(100),slots:[1,2].map(n=>({binding:{slotId:id(n),installationId:id(100),purpose:n===1?'BACKUP_TARGET':'KEY_VAULT',profileRef:{id:id(100+n),version:2,contentHash:String(n).repeat(64)},expectedRootIdentity:{device:'41',inode:String(1000+n)},ownerUid:999},absoluteRoot:`/srv/anvil/catalog-${n}`,displayName:`합성 슬롯 ${n}`,capacityBytes:1048576,profileVersion:2}))});
async function provider(){const url=new URL('../../../apps/server/modules/backups/installation-resource-catalog-provider.ts',import.meta.url),m:any=existsSync(url)?await import(url.href):{};assert.equal(typeof m.createInstallationResourceCatalogProvider,'function','내부 catalog 조합 미구현');return m.createInstallationResourceCatalogProvider;}
function fixture(){
 const source=snapshot(),trace:string[]=[],roots=new Map<object,any>(),seen:any[]=[];
 const state={revoked:false,failClose:false,pause:false,gate:deferred(),entered:deferred(),badSlot:'',lowSlot:'',active:0,maxActive:0,factorySnapshot:null as any};
 const forbidden=async()=>{trace.push('MUTATION');throw Error(marker);};
 const port={
  async openRoot(binding:any){trace.push('OPEN');const root={};roots.set(root,clone(binding));return root;},
  async inspectRoot(root:object){trace.push('INSPECT');const b=roots.get(root);assert(b);state.active++;state.maxActive=Math.max(state.maxActive,state.active);try{if(state.pause){state.entered.release();await state.gate.wait;}return{binding:clone(b),generation:1,root:{identity:b.slotId===state.badSlot?{device:'41',inode:'999999'}:clone(b.expectedRootIdentity),kind:'directory',symlink:false,uid:999,gid:999,mode:'700',availableBytes:b.slotId===state.lowSlot?1024:1048576,availableInodes:1024},parents:[{identity:{device:'41',inode:'40'},kind:'directory',symlink:false,uid:0,gid:0,mode:'755'}]};}finally{state.active--;}}
  ,create:forbidden,open:forbidden,stat:forbidden,read:forbidden,sync:forbidden,remove:forbidden,publish:forbidden,fsyncParent:forbidden,closeFile:forbidden,
  async closeRoot(root:object){trace.push('CLOSE');assert(roots.has(root));if(state.failClose)throw Object.assign(Error(marker),{cause:marker});roots.delete(root);}
 };
 const verifier={async assertCurrent(value:any){trace.push('VERIFY');seen.push(value);if(state.revoked)throw Object.assign(Error(marker),{cause:marker});}};
 const nativeFactory=(value:any)=>{trace.push('FACTORY');state.factorySnapshot=value;return port;};
 return{source,state,trace,roots,seen,port,verifier,nativeFactory,count:(s:string)=>trace.filter(v=>v===s).length};
}
async function setup(){const create=await provider(),f=fixture(),catalog=await create({snapshot:f.source,nativeFactory:f.nativeFactory,verifier:f.verifier});return{f,catalog};}
async function cleanup(catalog:any){try{await catalog.dispose();}catch{/* 각 실패 시험에서 별도 관측 */}}

test('catalogComposition 보호 목록·정확 준비·목적 분리와 기존 native snapshot 조합',async()=>{
 const {f,catalog}=await setup();try{
  assert.equal(f.count('FACTORY'),1);
  assert.deepEqual(f.state.factorySnapshot,{schemaVersion:1,installationId:f.source.installationId,slots:f.source.slots.map(s=>({binding:s.binding,absoluteRoot:s.absoluteRoot}))});
  for(const [kind,index] of [['TARGET',0],['ENCRYPTION_KEY',1]] as const){const result=await catalog.list(kind),s=f.source.slots[index]!;assert.equal(result.state,'CONFIGURED');assert.deepEqual(result.items,[{slotId:s.binding.slotId,displayName:s.displayName,purpose:s.binding.purpose,profileRef:s.binding.profileRef,state:'VERIFIED',reasonCodes:[]}]);const prepared=await catalog.prepareSlot(s.binding.slotId,kind);assert.equal(prepared.installationId,f.source.installationId);assert.deepEqual(prepared.profileRef,s.binding.profileRef);assert.deepEqual((await prepared.rootHandle.inspect()).identity,s.binding.expectedRootIdentity);assert(!JSON.stringify(result).includes('/srv/'));assert(!JSON.stringify(result).includes('ownerUid'));}
  await assert.rejects(catalog.list('KEY_VAULT'),failure('INPUT_INVALID',400));await assert.rejects(catalog.prepareSlot(id(1),'ENCRYPTION_KEY'),failure('RESOURCE_UNVERIFIED',412));await assert.rejects(catalog.prepareSlot(id(500),'TARGET'),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.count('MUTATION'),0);
 }finally{await cleanup(catalog);}
});

test('catalogComposition 닫힌 snapshot·정체성·profile·경로·용량·개수 사전검사 실패는 factory0',async()=>{
 const create=await provider();const mutations:Array<(v:any)=>void>=[
  v=>{v.extra=true;},v=>{v.slots[0].binding.ownerUid=-1;},v=>{v.slots[0].binding.expectedRootIdentity.inode='001';},v=>{v.slots[0].binding.installationId=id(999);},v=>{v.slots[0].profileVersion=3;},v=>{v.slots[0].binding.profileRef.contentHash='bad';},v=>{v.slots[0].binding.purpose='OTHER';},
  v=>{v.slots[1].binding.slotId=v.slots[0].binding.slotId;},v=>{v.slots[1].binding.expectedRootIdentity=clone(v.slots[0].binding.expectedRootIdentity);},v=>{v.slots[1].absoluteRoot=v.slots[0].absoluteRoot;},v=>{v.slots[1].absoluteRoot=v.slots[0].absoluteRoot+'/nested';},
  v=>{v.slots[0].absoluteRoot='relative';},v=>{v.slots[0].absoluteRoot='/srv/../anvil';},v=>{v.slots[0].absoluteRoot='/srv//anvil';},v=>{v.slots[0].absoluteRoot='/srv/anvil\u0000';},v=>{v.slots[0].capacityBytes=1023;},v=>{v.slots[1].capacityBytes=16383;},v=>{v.slots[0].capacityBytes=Number.MAX_SAFE_INTEGER+1;},v=>{v.slots=[];},v=>{v.slots=Array.from({length:65},()=>clone(v.slots[0]));}
 ];
 for(const mutate of mutations){const f=fixture();mutate(f.source);await assert.rejects(create({snapshot:f.source,nativeFactory:f.nativeFactory,verifier:f.verifier}),failure('INPUT_INVALID',400));assert.equal(f.count('FACTORY'),0);assert.equal(f.count('OPEN'),0);}
});

test('catalogComposition verifier 부재·초기 근거 거절은 factory0·원 오류 비노출',async()=>{
 const create=await provider();for(const missing of [true,false]){const f=fixture();f.state.revoked=true;await assert.rejects(create({snapshot:f.source,nativeFactory:f.nativeFactory,...(missing?{}:{verifier:f.verifier})}),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.count('FACTORY'),0);assert.equal(f.count('OPEN'),0);}
});

test('catalogComposition factory 예외는 새 고정 오류이며 실제 로드 fallback0',async()=>{
 const create=await provider(),f=fixture();await assert.rejects(create({snapshot:f.source,verifier:f.verifier,nativeFactory(){throw Object.assign(Error(marker),{cause:marker});}}),failure('RESOURCE_STATE_UNKNOWN',503));assert.equal(f.count('OPEN'),0);
});

test('catalogComposition 입력 변경 격리·verifier 고정 snapshot과 profile 원값 보존',async()=>{
 const {f,catalog}=await setup(),original=clone(f.source);try{f.source.slots[0]!.displayName='변조';f.source.slots[0]!.binding.profileRef.version=99;f.source.slots[0]!.absoluteRoot='/other';const result=await catalog.list('TARGET');assert.equal(result.items[0].displayName,original.slots[0]!.displayName);assert.deepEqual(result.items[0].profileRef,original.slots[0]!.binding.profileRef);for(const seen of f.seen){assert.deepEqual(seen,original);assert(Object.isFrozen(seen)&&Object.isFrozen(seen.slots)&&Object.isFrozen(seen.slots[0]!.binding.profileRef));}result.items[0].profileRef.version=88;assert.equal((await catalog.list('TARGET')).items[0].profileRef.version,2);}finally{await cleanup(catalog);}
});

test('catalogComposition 슬롯별 root 현재성 실패는 해당 항목만 UNVERIFIED',async()=>{
 const create=await provider(),f=fixture();f.source.slots[1]!.binding.purpose='BACKUP_TARGET';const catalog=await create({snapshot:f.source,nativeFactory:f.nativeFactory,verifier:f.verifier});try{f.state.badSlot=id(1);const result=await catalog.list('TARGET');assert.equal(result.state,'CONFIGURED');assert.equal(result.items.find((v:any)=>v.slotId===id(1)).state,'UNVERIFIED');assert.deepEqual(result.items.find((v:any)=>v.slotId===id(1)).reasonCodes,['RESOURCE_UNVERIFIED']);assert.equal(result.items.find((v:any)=>v.slotId===id(2)).state,'VERIFIED');await assert.rejects(catalog.prepareSlot(id(1),'TARGET'),failure('RESOURCE_UNVERIFIED',412));}finally{await cleanup(catalog);}
});

test('catalogComposition vault 현재 공간 최소16384 미달은 준비·사용 불가',async()=>{
 const {f,catalog}=await setup();try{f.state.lowSlot=id(2);const result=await catalog.list('ENCRYPTION_KEY');assert.equal(result.items[0].state,'UNVERIFIED');await assert.rejects(catalog.prepareSlot(id(2),'ENCRYPTION_KEY'),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.count('MUTATION'),0);}finally{await cleanup(catalog);}
});

test('catalogComposition 설치 근거 회수는 전체 UNVERIFIED·사용 차단·비밀 오류0',async()=>{
 const {f,catalog}=await setup();try{await catalog.list('TARGET');f.state.revoked=true;const result=await catalog.list('TARGET');assert.equal(result.state,'UNVERIFIED');assert(result.items.every((v:any)=>v.state==='UNVERIFIED'));assert(!JSON.stringify(result).includes(marker));await assert.rejects(catalog.prepareSlot(id(1),'TARGET'),failure('RESOURCE_UNVERIFIED',412));}finally{await cleanup(catalog);}
});

test('catalogComposition 동시 같은slot 준비는 native root와 adapter 재사용',async()=>{
 const {f,catalog}=await setup();try{const slots=await Promise.all(Array.from({length:8},()=>catalog.prepareSlot(id(1),'TARGET')));assert(slots.every(v=>v.rootHandle===slots[0].rootHandle));assert.equal(f.count('FACTORY'),1);assert.equal(f.count('OPEN'),1);assert(f.state.maxActive<=32);}finally{await cleanup(catalog);}
});

test('catalogComposition 진행 검사 중 근거 회수는 늦은 준비 결과 차단',async()=>{
 const {f,catalog}=await setup();try{f.state.pause=true;const pending=catalog.prepareSlot(id(1),'TARGET');await f.state.entered.wait;f.state.revoked=true;f.state.gate.release();await assert.rejects(pending,failure('RESOURCE_UNVERIFIED',412));}finally{f.state.gate.release();await cleanup(catalog);}
});

test('catalogComposition dispose 즉시 신규차단·진행 drain·늦은 handle0·동일 Promise·close1',async()=>{
 const {f,catalog}=await setup();f.state.pause=true;const pending=catalog.prepareSlot(id(1),'TARGET');await f.state.entered.wait;const first=catalog.dispose();assert.equal(first,catalog.dispose());let done=false;void first.then(()=>{done=true;});await assert.rejects(catalog.prepareSlot(id(1),'TARGET'),failure('RESOURCE_UNVERIFIED',412));await assert.rejects(catalog.list('TARGET'),failure('RESOURCE_UNVERIFIED',412));assert.equal(done,false);assert.equal(f.count('CLOSE'),0);f.state.gate.release();await assert.rejects(pending,failure('RESOURCE_UNVERIFIED',412));await first;assert.equal(f.count('CLOSE'),1);assert.equal(f.roots.size,0);assert.equal(first,catalog.dispose());
});

test('catalogComposition close 불명은 동일503·재시도0·원 오류 비노출',async()=>{
 const {f,catalog}=await setup();await catalog.prepareSlot(id(1),'TARGET');f.state.failClose=true;const first=catalog.dispose();await assert.rejects(first,failure('RESOURCE_STATE_UNKNOWN',503));assert.equal(first,catalog.dispose());await assert.rejects(catalog.dispose(),failure('RESOURCE_STATE_UNKNOWN',503));assert.equal(f.count('CLOSE'),1);assert.equal(f.count('MUTATION'),0);
});

test('catalogComposition 총 admission32 초과는 무한 대기 대신409·기존 작업 보존',async()=>{
 const {f,catalog}=await setup();try{f.state.pause=true;const pending=Array.from({length:32},()=>catalog.prepareSlot(id(1),'TARGET'));await f.state.entered.wait;await assert.rejects(catalog.prepareSlot(id(1),'TARGET'),failure('RESOURCE_PROCESSING',409));f.state.gate.release();const slots=await Promise.all(pending);assert(slots.every(v=>v.rootHandle===slots[0].rootHandle));assert.equal(f.count('OPEN'),1);}finally{f.state.gate.release();await cleanup(catalog);}
});
test('catalogComposition 근거 회수 관측은 기존 root 신규IO 차단·단발회수·자동 재활성화0',async()=>{
 const {f,catalog}=await setup(),prepared=await catalog.prepareSlot(id(1),'TARGET');try{
  f.state.revoked=true;assert.equal((await catalog.list('TARGET')).state,'UNVERIFIED');const inspections=f.count('INSPECT');
  await assert.rejects(prepared.rootHandle.inspect(),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.count('INSPECT'),inspections);
  f.state.revoked=false;assert.equal((await catalog.list('TARGET')).state,'UNVERIFIED');await assert.rejects(catalog.prepareSlot(id(1),'TARGET'),failure('RESOURCE_UNVERIFIED',412));
  await catalog.dispose();assert.equal(f.count('CLOSE'),1);assert.equal(f.count('OPEN'),1);assert.equal(f.roots.size,0);assert.equal(f.count('MUTATION'),0);
 }finally{await cleanup(catalog);}
});
for(const [label,mutate] of [
 ['ownerUid uint32 초과',(s:any)=>{s.slots[0].binding.ownerUid=4294967296;}],
 ['identity uint64 초과',(s:any)=>{s.slots[0].binding.expectedRootIdentity.inode='18446744073709551616';}],
 ['경로 성분 UTF8 255bytes 초과',(s:any)=>{s.slots[0].absoluteRoot='/srv/'+ '가'.repeat(86);}]
] as const)test(`catalogBounds ${label}는 factory 전 INPUT_INVALID`,async()=>{
 const create=await provider(),f=fixture();mutate(f.source);await assert.rejects(create({snapshot:f.source,nativeFactory:f.nativeFactory,verifier:f.verifier}),failure('INPUT_INVALID',400));assert.equal(f.count('FACTORY'),0);assert.equal(f.count('OPEN'),0);
});

test('catalogBounds profileRef 역순 key의 같은 값은 목록·준비에서 그대로 수용',async()=>{
 const create=await provider(),f=fixture(),p=f.source.slots[0]!.binding.profileRef;f.source.slots[0]!.binding.profileRef={contentHash:p.contentHash,version:p.version,id:p.id};
 const catalog=await create({snapshot:f.source,nativeFactory:f.nativeFactory,verifier:f.verifier});try{const result=await catalog.list('TARGET');assert.equal(result.items[0].state,'VERIFIED');const prepared=await catalog.prepareSlot(id(1),'TARGET');assert.deepEqual(prepared.profileRef,p);assert.equal(f.count('FACTORY'),1);}finally{await cleanup(catalog);}
});