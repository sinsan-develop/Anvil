import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';

// 기존 provider/managed adapter는 소비하지만 reader/loader/native 관측은 메모리다.
const id=(n:number)=>`72000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clone=<T>(v:T):T=>structuredClone(v);
const bytes=(s:string)=>new TextEncoder().encode(s),hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const marker='synthetic-private-loader-path-and-errno';
const failure=(code:string,status:number)=>(e:any)=>e instanceof AuthFailure&&e.message===code&&e.statusCode===status&&!JSON.stringify(e).includes(marker)&&!String(e.stack).includes(marker)&&!e.cause;
const deferred=()=>{let release!:()=>void;const wait=new Promise<void>(r=>{release=r;});return{wait,release};};
async function bootstrap(){const u=new URL('../../../apps/server/modules/backups/installation-resource-bootstrap.ts',import.meta.url),m:any=existsSync(u)?await import(u.href):{};assert.equal(typeof m.bootstrapInstallationResourceCatalog,'function','보호 설치 bootstrap 미구현');return m.bootstrapInstallationResourceCatalog;}
function fixture(){
 const snapshot={installationId:id(100),slots:[1,2].map(n=>({binding:{slotId:id(n),installationId:id(100),purpose:n===1?'BACKUP_TARGET':'KEY_VAULT',profileRef:{id:id(200+n),version:1,contentHash:String(n).repeat(64)},expectedRootIdentity:{device:'2049',inode:String(2000+n)},ownerUid:1000},absoluteRoot:`/srv/anvil-data/slot-${n}`,displayName:`공개 합성 ${n}`,capacityBytes:1048576,profileVersion:1}))};
 const artifact=bytes('public-synthetic-artifact'),catalog=bytes(JSON.stringify(snapshot));
 const catalogDescriptor={absolutePath:'/opt/anvil-install/catalog.json',expectedIdentity:{device:'2049',inode:'42'},expectedSha256:hash(catalog),sizeBytes:catalog.length,kind:'CATALOG'};
 const artifactDescriptor={absolutePath:'/opt/anvil-install/port.node',expectedIdentity:{device:'2049',inode:'43'},expectedSha256:hash(artifact),sizeBytes:artifact.length,kind:'ARTIFACT'};
 const buildIdentity={sourceCommit:'a'.repeat(40),sourceSha256:'b'.repeat(64),compiler:{id:'gcc',version:'13.3.0',flags:['-std=c11','-O2','-fPIC','-shared','-pthread','-DNAPI_VERSION=8','-lm']},artifactSha256:artifactDescriptor.expectedSha256,platform:'linux',arch:'x64',node:'24.22.1',napi:8,minimumGlibc:'2.28',minimumKernel:'4.18'};
 const runtime={platform:'linux',arch:'x64',node:'24.22.1',napi:'8',kernel:'6.18.54.1-microsoft-standard-WSL2',glibc:'2.39',uid:1000,euid:1000,pid:1234};
 const trace:string[]=[],opened:any[]=[],evidence:any[]=[],roots=new Map<object,any>();
 const state={catalogBytes:catalog,installerRevoked:false,installerBool:false,catalogChanged:false,artifactChanged:false,openFail:'',closeFail:'',loaderFail:false,badExport:false,prePinFail:false,postPinFail:false,pinned:false,pauseCurrent:false,entered:deferred(),gate:deferred(),factorySnapshot:null as any};
 const pointFailure=()=>Object.assign(Error(marker),{cause:marker,extra:marker});
 const caps=new Map<string,any>();
 for(const kind of ['CATALOG','ARTIFACT']){let closing:Promise<void>|null=null,busy=false;
  const cap={
   async readCatalog(){assert.equal(kind,'CATALOG');trace.push('READ_CATALOG');return Uint8Array.from(state.catalogBytes);},
   async assertCurrent(){trace.push('CURRENT_'+kind);if(busy||kind==='ARTIFACT'&&state.pinned)throw new AuthFailure('RESOURCE_PROCESSING',409);busy=true;try{if(kind==='CATALOG'&&state.pauseCurrent){state.entered.release();await state.gate.wait;}if(kind==='CATALOG'?state.catalogChanged:state.artifactChanged)throw pointFailure();}finally{busy=false;}},
   async withArtifactFile<T>(callback:(path:string)=>Promise<T>){assert.equal(kind,'ARTIFACT');trace.push('PIN_BEGIN');if(state.prePinFail)throw new AuthFailure('RESOURCE_UNVERIFIED',412);assert.equal(busy,false);state.pinned=true;let result:T;try{result=await callback('/proc/self/fd/77');}finally{state.pinned=false;}if(state.postPinFail)throw new AuthFailure('RESOURCE_STATE_UNKNOWN',503);trace.push('PIN_END');return result;},
   dispose(){if(closing)return closing;trace.push('CLOSE_'+kind);closing=state.closeFail===kind?Promise.reject(pointFailure()):Promise.resolve();void closing.catch(()=>{});return closing;}
  };caps.set(kind,cap);
 }
 const forbidden=async()=>{trace.push('UNAUTHORIZED_IO');throw pointFailure();};
 const nativePort={
  async openRoot(binding:any){trace.push('NATIVE_OPEN');const cap={};roots.set(cap,clone(binding));return cap;},
  async inspectRoot(cap:object){trace.push('NATIVE_INSPECT');const b=roots.get(cap);assert(b);return{binding:clone(b),generation:1,root:{identity:clone(b.expectedRootIdentity),kind:'directory',symlink:false,uid:1000,gid:1000,mode:'700',availableBytes:1048576,availableInodes:1024},parents:[{identity:{device:'2049',inode:'1'},kind:'directory',symlink:false,uid:0,gid:0,mode:'755'}]};},
  create:forbidden,open:forbidden,stat:forbidden,read:forbidden,sync:forbidden,remove:forbidden,publish:forbidden,fsyncParent:forbidden,closeFile:forbidden,
  async closeRoot(cap:object){trace.push('NATIVE_CLOSE');assert(roots.has(cap));roots.delete(cap);}
 };
 const installerVerifier={async assertCurrent(value:any){trace.push('INSTALLER');evidence.push(value);if(state.installerRevoked)throw pointFailure();if(state.installerBool)return true as any;}};
 const input={catalogDescriptor,artifactDescriptor,buildIdentity,installerVerifier};
 const dependencies={
  async openFile(d:any){trace.push('OPEN_'+d.kind);opened.push(d);if(state.openFail===d.kind)throw pointFailure();return caps.get(d.kind);},
  load(path:string){trace.push('LOAD');assert.equal(state.pinned,true,'동일 held FD callback 범위');assert.equal(path,'/proc/self/fd/77');if(state.loaderFail)throw pointFailure();if(state.badExport)return{unrelated(){}};return{createInstallationResourceNativePort(value:any){trace.push('FACTORY');assert.equal(state.pinned,false,'reader 후검사 이후 factory');assert(trace.includes('PIN_END'));state.factorySnapshot=value;return nativePort;}};},
  runtime:()=>clone(runtime)
 };
 return{input,dependencies,state,trace,opened,evidence,roots,snapshot,runtime,count:(s:string)=>trace.filter(x=>x===s).length};
}
async function setup(){const create=await bootstrap(),f=fixture(),catalog=await create(f.input,f.dependencies);return{create,f,catalog};}
async function cleanup(catalog:any){try{await catalog.dispose();}catch{/* 불명은 해당 시험에서 판정 */}}

test('installationBootstrap 같은heldFD load1→후검사→기존provider 목록/준비 소비',async()=>{
 const {f,catalog}=await setup();try{assert.equal(f.count('LOAD'),1);assert.equal(f.count('FACTORY'),1);assert(f.trace.indexOf('PIN_END')<f.trace.indexOf('FACTORY'));assert.deepEqual(Object.keys(catalog).sort(),['dispose','list','prepareSlot']);const view=await catalog.list('TARGET');assert.equal(view.state,'CONFIGURED');assert.equal(view.items[0].state,'VERIFIED');assert.equal(view.items[0].slotId,id(1));assert(!JSON.stringify(view).includes('/srv'));const slot=await catalog.prepareSlot(id(2),'ENCRYPTION_KEY');assert.equal(slot.slotId,id(2));assert.equal(f.count('UNAUTHORIZED_IO'),0);}finally{await catalog.dispose();}assert.equal(f.roots.size,0);assert.deepEqual(f.trace.filter(s=>s.startsWith('CLOSE_')),['CLOSE_ARTIFACT','CLOSE_CATALOG']);
});

test('installationBootstrap descriptor/build의 모든 사전입력 실패는 open/load0',async()=>{
 const create=await bootstrap();for(const mutate of [
  (v:any)=>{v.extra=1;},(v:any)=>{v.artifactDescriptor.kind='CATALOG';},(v:any)=>{v.artifactDescriptor.absolutePath=v.catalogDescriptor.absolutePath;},(v:any)=>{v.artifactDescriptor.expectedIdentity=clone(v.catalogDescriptor.expectedIdentity);},(v:any)=>{v.catalogDescriptor.absolutePath='/opt/../catalog';},(v:any)=>{v.artifactDescriptor.sizeBytes=16777217;},(v:any)=>{v.buildIdentity.extra=true;},(v:any)=>{v.buildIdentity.sourceCommit='bad';},(v:any)=>{v.buildIdentity.artifactSha256='0'.repeat(64);},(v:any)=>{v.buildIdentity.compiler.flags=['bad\nflag'];},(v:any)=>{v.buildIdentity.compiler.flags=Array(33).fill('-O2');},(v:any)=>{v.buildIdentity.node='25.0.0';}
 ]){const f=fixture();mutate(f.input);await assert.rejects(create(f.input,f.dependencies),failure('INPUT_INVALID',400));assert.equal(f.opened.length,0);assert.equal(f.count('LOAD'),0);}
});

test('installationBootstrap 미지원 실제관측 ABI/kernel/glibc/root는 open/load0',async()=>{
 const create=await bootstrap();for(const [key,value] of [['platform','win32'],['arch','arm64'],['node','24.18.0'],['napi','7'],['kernel','4.17.9'],['glibc','2.27'],['glibc','unknown'],['uid',0],['euid',0]] as const){const f=fixture();(f.runtime as any)[key]=value;await assert.rejects(create(f.input,f.dependencies),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.opened.length,0);assert.equal(f.count('LOAD'),0);}
});

test('installationBootstrap 필수 installer 부재·회수·bool대체는 load0',async()=>{
 const create=await bootstrap();for(const mode of ['missing','revoked','bool']){const f=fixture();if(mode==='missing')delete(f.input as any).installerVerifier;else if(mode==='revoked')f.state.installerRevoked=true;else f.state.installerBool=true;await assert.rejects(create(f.input,f.dependencies),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.count('LOAD'),0);for(const d of f.opened)assert.equal(f.count('CLOSE_'+d.kind),1);}
});

test('installationBootstrap JSON중복키/BOM/NUL/잘못된Unicode/과대/잘못된snapshot은 load0',async()=>{
 const create=await bootstrap();for(const raw of [bytes('{"installationId":"a","installationId":"b","slots":[]}'),Uint8Array.from([239,187,191,...bytes('{}')]),bytes('{"x":"\u0000"}'),bytes('{"x":"\\ud800"}'),new Uint8Array(1048577),bytes('{"installationId":"invalid","slots":[]}')]){const f=fixture();f.state.catalogBytes=raw;if(raw.length<=1048576){f.input.catalogDescriptor.sizeBytes=raw.length;f.input.catalogDescriptor.expectedSha256=hash(raw);}await assert.rejects(create(f.input,f.dependencies),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.count('LOAD'),0);for(const d of f.opened)assert.equal(f.count('CLOSE_'+d.kind),1);}
});

test('installationBootstrap 고정입력/installer evidence deep snapshot·profile 원값',async()=>{
 const {f,catalog}=await setup(),original=clone({catalogDescriptor:f.input.catalogDescriptor,artifactDescriptor:f.input.artifactDescriptor,buildIdentity:f.input.buildIdentity});try{f.input.catalogDescriptor.absolutePath='/wrong';f.input.artifactDescriptor.expectedSha256='0'.repeat(64);f.input.buildIdentity.compiler.flags.push('changed');assert.equal((await catalog.list('TARGET')).items[0].state,'VERIFIED');for(const e of f.evidence){assert.deepEqual(e.catalogDescriptor,original.catalogDescriptor);assert.deepEqual(e.artifactDescriptor,original.artifactDescriptor);assert.deepEqual(e.buildIdentity,original.buildIdentity);assert.deepEqual(e.snapshot,f.snapshot);assert.deepEqual(e.runtimeObservation,f.runtime);assert(Object.isFrozen(e)&&Object.isFrozen(e.snapshot.slots[0].binding.profileRef)&&Object.isFrozen(e.buildIdentity.compiler.flags));}}finally{await cleanup(catalog);}
});

test('installationBootstrap artifact open실패는 catalog만회수·load0',async()=>{
 const create=await bootstrap(),f=fixture();f.state.openFail='ARTIFACT';await assert.rejects(create(f.input,f.dependencies),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.count('CLOSE_CATALOG'),1);assert.equal(f.count('CLOSE_ARTIFACT'),0);assert.equal(f.count('LOAD'),0);
});

test('installationBootstrap pin전실패는412/load0, pin후실패는503/factory0',async()=>{
 const create=await bootstrap();for(const after of [false,true]){const f=fixture();f.state.prePinFail=!after;f.state.postPinFail=after;await assert.rejects(create(f.input,f.dependencies),failure(after?'RESOURCE_STATE_UNKNOWN':'RESOURCE_UNVERIFIED',after?503:412));assert.equal(f.count('LOAD'),after?1:0);assert.equal(f.count('FACTORY'),0);assert.equal(f.count('CLOSE_ARTIFACT'),1);assert.equal(f.count('CLOSE_CATALOG'),1);}
});

test('installationBootstrap 잘못된native export는503·provider생성0·회수',async()=>{
 const create=await bootstrap(),f=fixture();f.state.badExport=true;await assert.rejects(create(f.input,f.dependencies),failure('RESOURCE_STATE_UNKNOWN',503));assert.equal(f.count('LOAD'),1);assert.equal(f.count('FACTORY'),0);assert.equal(f.count('CLOSE_ARTIFACT'),1);assert.equal(f.count('CLOSE_CATALOG'),1);
});

test('installationBootstrap loader실패는단발503·같은주입loader재시도0',async()=>{
 const create=await bootstrap(),f=fixture();f.state.loaderFail=true;await assert.rejects(create(f.input,f.dependencies),failure('RESOURCE_STATE_UNKNOWN',503));f.state.loaderFail=false;await assert.rejects(create(f.input,f.dependencies),failure('RESOURCE_STATE_UNKNOWN',503));assert.equal(f.count('LOAD'),1);assert.equal(f.count('FACTORY'),0);
});

test('installationBootstrap provider현재성회수는UNVERIFIED/기존root차단/재로드0',async()=>{
 const {f,catalog}=await setup();try{const slot=await catalog.prepareSlot(id(1),'TARGET');f.state.artifactChanged=true;assert.equal((await catalog.list('TARGET')).state,'UNVERIFIED');await assert.rejects(slot.rootHandle.inspect(),failure('RESOURCE_UNVERIFIED',412));f.state.artifactChanged=false;assert.equal((await catalog.list('TARGET')).state,'UNVERIFIED');assert.equal(f.count('LOAD'),1);}finally{await catalog.dispose();}assert.equal(f.roots.size,0);
});

test('installationBootstrap 겹친검증은409이며 자기reader busy를회수로오판0',async()=>{
 const {f,catalog}=await setup();try{f.state.pauseCurrent=true;const first=catalog.list('TARGET');await f.state.entered.wait;await assert.rejects(catalog.prepareSlot(id(1),'TARGET'),failure('RESOURCE_PROCESSING',409));f.state.gate.release();assert.equal((await first).items[0].state,'VERIFIED');f.state.pauseCurrent=false;assert.equal((await catalog.list('TARGET')).items[0].state,'VERIFIED');assert.equal(f.count('LOAD'),1);}finally{f.state.gate.release();await cleanup(catalog);}
});

test('installationBootstrap dispose신규차단/drain/late성공0→provider→artifact/catalog1',async()=>{
 const {f,catalog}=await setup();await catalog.prepareSlot(id(1),'TARGET');f.state.pauseCurrent=true;const work=catalog.list('TARGET');await f.state.entered.wait;const disposal=catalog.dispose();assert.equal(disposal,catalog.dispose());await assert.rejects(catalog.list('TARGET'),failure('RESOURCE_UNVERIFIED',412));assert.equal(f.count('CLOSE_ARTIFACT'),0);assert.equal(f.count('NATIVE_CLOSE'),0);f.state.gate.release();await assert.rejects(work,failure('RESOURCE_UNVERIFIED',412));await disposal;assert(f.trace.indexOf('NATIVE_CLOSE')<f.trace.indexOf('CLOSE_ARTIFACT'));assert.deepEqual(f.trace.filter(x=>x.startsWith('CLOSE_')),['CLOSE_ARTIFACT','CLOSE_CATALOG']);assert.equal(f.roots.size,0);
});

test('installationBootstrap 회수불명은단발503·다른자기cap회수지속·원오류0',async()=>{
 const {f,catalog}=await setup();await catalog.list('TARGET');f.state.closeFail='ARTIFACT';const disposal=catalog.dispose();await assert.rejects(disposal,failure('RESOURCE_STATE_UNKNOWN',503));assert.equal(disposal,catalog.dispose());await assert.rejects(catalog.dispose(),failure('RESOURCE_STATE_UNKNOWN',503));assert.equal(f.count('CLOSE_ARTIFACT'),1);assert.equal(f.count('CLOSE_CATALOG'),1);assert.equal(f.roots.size,0);
});

test('bootstrapInputBoundary throwing accessor 입력은 고정400·원오류 비노출·IO/load0',async()=>{
 const create=await bootstrap(),f=fixture(),value={...f.input};Object.defineProperty(value,'catalogDescriptor',{enumerable:true,get(){throw Object.assign(Error(marker),{cause:marker});}});
 await assert.rejects(create(value,f.dependencies),failure('INPUT_INVALID',400));assert.equal(f.opened.length,0);assert.equal(f.count('LOAD'),0);
});

test('bootstrapInputBoundary throwing reflection dependency는 고정400·원오류 비노출·IO/load0',async()=>{
 const create=await bootstrap(),f=fixture(),dependencies=new Proxy(f.dependencies,{ownKeys(){throw Object.assign(Error(marker),{cause:marker});}});
 await assert.rejects(create(f.input,dependencies),failure('INPUT_INVALID',400));assert.equal(f.opened.length,0);assert.equal(f.count('LOAD'),0);
});