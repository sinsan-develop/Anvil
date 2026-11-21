import * as fs from 'node:fs';
import {posix} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Pool} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';
import {copyControlData} from '../apps/server/modules/control-handoff/control-grant.ts';
import {currentProfile,currentLocalTimeoutOptions} from './qa-ix01-current-journey.ts';
import {createSubnetNativeIdentity} from './qa-ix01-subnet-observation-host.ts';
import type {ManagementOriginHostBinding} from './qa-fn03-source-content-management-origin-host.ts';
import type {ManagementOriginEntryPorts,ManagementOriginEntryRuntime} from './qa-fn03-source-content-management-origin-entry.ts';
import type {ManagementOriginPoolRequest} from './qa-fn03-source-content-management-origin-isolated-ports.ts';
import {consumeManagementOriginDockerCall} from './qa-fn03-source-content-management-origin-isolated-ports.ts';

type FsPort=Pick<typeof fs,'lstatSync'|'fstatSync'|'realpathSync'|'openSync'|'readSync'|'writeFileSync'|'fsyncSync'|'closeSync'|'mkdirSync'|'readdirSync'>;
export interface ManagementOriginNativeOperations {
 identity:ReturnType<typeof createSubnetNativeIdentity>;files:FsPort;
 spawn:typeof spawnSync;pool(request:ManagementOriginPoolRequest):Pool;
 timer(callback:()=>void,ms:number):unknown;clearTimer(handle:unknown):void;
}
export interface ManagementOriginNativePreparation {
 binding:ManagementOriginHostBinding;runtime:ManagementOriginEntryRuntime;
 /** 원 승인 runtime hash에 결박된 검수 manifest. 이 생성 함수가 closure를 발견/발급하지 않는다. */
 sourceManifestRaw:string;dependencyManifestRaw:string;
}
interface Row{path:string;bytes:number;sha256:string}
const fail=():never=>{throw Error('FN03_MANAGEMENT_NATIVE_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1',purpose='FN03_MANAGEMENT_ORIGIN_ISOLATED';
const entry='scripts/qa-fn03-source-content-management-origin-entry.ts',native='scripts/qa-fn03-source-content-management-origin-native.ts';
const required=[entry,native,'scripts/qa-fn03-source-content-management-origin-isolated-ports.ts','scripts/qa-fn03-source-content-management-origin-host.ts','scripts/qa-ix01-current-journey.ts','scripts/qa-ix01-subnet-observation-host.ts','package.json','package-lock.json'];
function defaults():ManagementOriginNativeOperations{return{identity:createSubnetNativeIdentity(),files:fs,spawn:spawnSync,pool:request=>new Pool(request),timer:(f,ms)=>setTimeout(f,ms),clearTimer:h=>clearTimeout(h as ReturnType<typeof setTimeout>)};}
function manifest(raw:string,sha:string,dependencies:boolean):Record<string,any>&{files:Row[]}{
 check(typeof raw==='string'&&raw.isWellFormed()&&Buffer.byteLength(raw)<=2097152&&contentHash(Buffer.from(raw))===sha);
 const m=parseWireJson(raw);check(recordV1(m,dependencies?['schemaVersion','sourceHead','packageLockSha256','files']:['schemaVersion','sourceHead','sourceRoot','gitSha256','dockerSha256','files'])&&m.schemaVersion===1&&Array.isArray(m.files)&&m.files.length>0&&m.files.length<=20000);
 let total=0,prior='';const files:Row[]=m.files.map((r:unknown)=>{
  check(recordV1(r,['path','bytes','sha256'])&&typeof r.path==='string'&&/^[A-Za-z0-9_@.+/-]{1,400}$/.test(r.path)&&posix.normalize(r.path)===r.path&&!r.path.startsWith('/')&&!r.path.split('/').some((p:string)=>p==='..'||p==='.'||p==='')&&r.path>prior&&Number.isSafeInteger(r.bytes)&&r.bytes>=0&&r.bytes<=16*1024*1024&&hashV1(r.sha256));
  check(dependencies?r.path.startsWith('node_modules/'):!r.path.startsWith('node_modules/')&&!r.path.startsWith('.git/'));prior=r.path;total+=r.bytes;check(total<=256*1024*1024);return{path:r.path,bytes:r.bytes,sha256:r.sha256};
 });return{...m,files};
}

/** 기존 entry에 공급하는 실제 Linux 효과 구현. import/factory 효과0, CLI/설치/SSH 없음.
 * 원 launcher의 import 전 exact source/runtime 검산은 별도 실행 선행이다. 아래의 현재 디스크
 * 재검산은 이미 적재된 코드의 출처나 완전한 import closure를 소급 증명하지 않는다.
 * 실제 manifest/승인 파일은 현재 미공급이며 과거 tool/dependency hash로 대체하지 않는다.
 * native 원 read/spawnSync가 OS에서 반환하지 않는 경우의 외부 전체 감독도 별도 필요하다.
 */
function nativeProviders(preparation:ManagementOriginNativePreparation,injected?:ManagementOriginNativeOperations):ManagementOriginEntryPorts{
 const p=copyControlData(preparation,5*1024*1024) as unknown as ManagementOriginNativePreparation;
 check(recordV1(p,['binding','runtime','sourceManifestRaw','dependencyManifestRaw']));const b=p.binding,r=p.runtime;
 check(recordV1(b,['attemptId','approvalId','planHash','approvalHash','sourceHead','issuedAt','expiresAt','artifactRoot','subnet'])&&uuidV1(b.attemptId)&&uuidV1(b.approvalId)&&hashV1(b.planHash)&&hashV1(b.approvalHash)&&/^[a-f0-9]{40}$/.test(b.sourceHead)&&Number.isSafeInteger(b.issuedAt)&&Number.isSafeInteger(b.expiresAt)&&b.issuedAt>=0&&b.expiresAt>b.issuedAt&&b.expiresAt-b.issuedAt<=1800000);
 const root='/home/daon/anvil-fn03-management-'+b.attemptId+'-qa',receipt='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-management-'+b.attemptId,parent=posix.dirname(receipt),artifact='/tmp/anvil-v3-fn03-management-'+b.attemptId,config=receipt+'/docker-config';
 check(b.artifactRoot===artifact&&recordV1(r,['sourceHead','entry','nodeSha256','sourceClosureSha256','packageLockSha256','installedDependenciesSha256'])&&r.sourceHead===b.sourceHead&&r.entry===entry&&r.nodeSha256===currentProfile.nodeHash&&[r.sourceClosureSha256,r.packageLockSha256,r.installedDependenciesSha256].every(hashV1));
 const sources=manifest(p.sourceManifestRaw,r.sourceClosureSha256,false),dependencies=manifest(p.dependencyManifestRaw,r.installedDependenciesSha256,true);
 check(sources.sourceHead===b.sourceHead&&sources.sourceRoot===root&&hashV1(sources.gitSha256)&&hashV1(sources.dockerSha256)&&required.every(path=>sources.files.some(row=>row.path===path))&&sources.files.find(row=>row.path==='package-lock.json')?.sha256===r.packageLockSha256&&dependencies.sourceHead===b.sourceHead&&dependencies.packageLockSha256===r.packageLockSha256);
 const subnet=/^172\.(1[6-9]|2\d|3[01])\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\/28$/.exec(b.subnet);check(subnet&&Number(subnet[2])<=254&&Number(subnet[3])<=240&&Number(subnet[3])%16===0);
 const ops=injected??defaults(),io=ops.files,identity=ops.identity;
 const fsKeys=['lstatSync','fstatSync','realpathSync','openSync','readSync','writeFileSync','fsyncSync','closeSync','mkdirSync','readdirSync'] as const;
 const identityKeys=['now','monotonic','context','realpath','inspect','fingerprint'] as const;
 const functionList=()=>[ops.spawn,ops.pool,ops.timer,ops.clearTimer,...fsKeys.map(k=>io[k]),...identityKeys.map(k=>identity[k])];
 const methods=functionList();check(methods.every(f=>typeof f==='function'));
 const now=()=>Math.ceil(identity.now()),monotonic=()=>Math.ceil(identity.monotonic());
 let broken=false,initialized=false,initializing=false,consumed=false,claimAttempted=false,artifactAttempted=false,wall=-1,mono=-1,until=Infinity,socketPath='';
 const pins=new Map<string,fs.Stats>(),files=new Map<string,fs.Stats>(),dependencyDirectories=new Map<string,fs.Stats>();
 const pools=new Map<Pool,{end:Pool['end'];state:'OPEN'|'ENDING'|'CLOSED'|'UNKNOWN'}>(),roles=new Set<string>();
 const statSame=(a:fs.Stats,c:fs.Stats)=>['dev','ino','uid','gid','mode','size','mtimeMs','ctimeMs','nlink'].every(k=>(a as any)[k]===(c as any)[k]);
 const dirSame=(a:fs.Stats,c:fs.Stats)=>['dev','ino','uid','gid','mode'].every(k=>(a as any)[k]===(c as any)[k]);
 const guard=<T>(work:()=>T):T=>{try{return work();}catch{broken=true;return fail();}};
 const clock=()=>{
  check(!broken);const t=now(),m=monotonic();check(Number.isSafeInteger(t)&&Number.isSafeInteger(m)&&t>=wall&&m>=mono&&m>=0&&t>=b.issuedAt&&t<b.expiresAt&&m<until);
  if(until===Infinity){until=m+b.expiresAt-t;check(Number.isSafeInteger(until));}wall=t;mono=m;
 };
 const missing=(path:string)=>{try{io.lstatSync(path);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}fail();};
 const pin=(path:string,privateLeaf=false)=>{
  let cur='';for(const part of path.split('/').filter(Boolean)){cur+='/'+part;const s=io.lstatSync(cur);
   check(s.isDirectory()&&[0,1000].includes(s.uid)&&(!(s.mode&0o022)||cur==='/tmp'&&s.uid===0&&(s.mode&0o7777)===0o1777)&&(!privateLeaf||cur!==path||s.uid===1000&&(s.mode&0o7777)===0o700));
   const old=pins.get(cur);check(!old||dirSame(old,s));pins.set(cur,s);
  }check(io.realpathSync(path)===path);
 };
 // IX01 plainFile의 NOFOLLOW·fd/경로 전후 동일성을 유지하고 소유 바이트만 반환한다.
 const read=(path:string,limit:number,mode?:number)=>{
  clock();const s=io.lstatSync(path);check(s.isFile()&&s.nlink===1&&s.uid===1000&&!(s.mode&0o022)&&s.size<=limit&&s.size>=0&&(mode===undefined||(s.mode&0o7777)===mode)&&io.realpathSync(path)===path);
  const fd=io.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);const data=Buffer.alloc(s.size+1);
  try{check(statSame(s,io.fstatSync(fd)));let n=0;while(n<data.length){clock();const count=io.readSync(fd,data,n,data.length-n,null);if(!count)break;n+=count;}check(n===s.size&&statSame(s,io.fstatSync(fd))&&statSame(s,io.lstatSync(path)));clock();files.set(path,s);return Buffer.from(data.subarray(0,n));}
  finally{data.fill(0);io.closeSync(fd);}
 };
 const syncDir=(path:string)=>{const fd=io.openSync(path,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);try{io.fsyncSync(fd);}finally{io.closeSync(fd);}};
 const intent=canonicalJson({schemaVersion:1,purpose:'FN03_MANAGEMENT_ORIGIN_INTENT',binding:b,runtime:r});
 const fresh=()=>{
  clock();check(ops.files===io&&ops.identity===identity);
  const currentMethods=functionList();check(methods.length===currentMethods.length&&methods.every((f,i)=>f===currentMethods[i]));
  for(const [path,s]of pins)check(dirSame(s,io.lstatSync(path))&&io.realpathSync(path)===path);
  for(const [path,s]of files)check(statSame(s,io.lstatSync(path))&&io.realpathSync(path)===path);
  for(const [path,s]of dependencyDirectories)check(statSame(s,io.lstatSync(path)));
  if(socketPath)check(identity.realpath('/var/run/docker.sock')===socketPath);
  if(consumed){check(io.readdirSync(config).length===0);const raw=read(receipt+'/intent.json',4096,0o600);try{check(raw.toString('utf8')===intent);}finally{raw.fill(0);}}
  clock();
 };
 const writeExclusive=(path:string,raw:string)=>{
  fresh();const fd=io.openSync(path,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try{io.writeFileSync(fd,raw,'utf8');io.fsyncSync(fd);}finally{io.closeSync(fd);}fresh();syncDir(posix.dirname(path));const seen=read(path,4096,0o600);try{check(seen.toString('utf8')===raw);}finally{seen.fill(0);}
 };
 const gitEnv=Object.freeze({PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:receipt,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_PAGER:'cat'});
 const execute=(file:string,args:readonly string[],env:Readonly<Record<string,string>>,input:string|Uint8Array|undefined,cap:number,maxBuffer:number)=>{
  fresh();const ms=Math.min(cap,b.expiresAt-wall,until-mono);check(Number.isSafeInteger(ms)&&ms>0);
  const startWall=wall,startMono=mono,out=ops.spawn(file,[...args],{cwd:root,env:{...env},input,shell:false,...currentLocalTimeoutOptions(ms),maxBuffer,stdio:[input===undefined?'ignore':'pipe','pipe','ignore']});
  check(!out.error&&out.signal===null&&Number.isInteger(out.status)&&Buffer.isBuffer(out.stdout)&&out.stdout.length<=maxBuffer);fresh();check(wall-startWall<ms&&mono-startMono<ms);
  return{status:out.status!,signal:null as null,stdout:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(out.stdout)};
 };
 function initialize(){
  if(initialized)return;check(!initializing);initializing=true;clock();const c=identity.context();
  check(recordV1(c,['platform','uid','hostname','execPath','execArgv','environmentKeys'])&&c.platform==='linux'&&c.uid===1000&&c.hostname==='SINSAN'&&c.execPath===currentProfile.node&&same(c.execArgv,[])&&same(c.environmentKeys,[]));
  pin(root,true);pin(root+'/.git');pin(parent);pin('/tmp');
  for(const [suffix,hash]of [['-plan.json',b.planHash],['-approval.json',b.approvalHash]]){const data=read(receipt+suffix,16384,0o600);try{
   check(contentHash(data)===hash);const v=parseWireJson(new TextDecoder('utf-8',{fatal:true}).decode(data));
   if(suffix==='-plan.json')check(recordV1(v,['schemaVersion','purpose','profile','attemptId','sourceHead','issuedAt','expiresAt','artifactRoot','receiptRoot','subnet','runtime'])&&v.schemaVersion===1&&v.purpose===purpose&&v.profile===profile&&v.attemptId===b.attemptId&&v.sourceHead===b.sourceHead&&v.issuedAt===b.issuedAt&&v.expiresAt===b.expiresAt&&v.artifactRoot===artifact&&v.receiptRoot===receipt&&v.subnet===b.subnet&&same(v.runtime,r));
   else check(same(v,{schemaVersion:1,purpose:purpose+'_RUN_APPROVAL',profile,decision:'ALLOW_ONE_RUN',approvalId:b.approvalId,attemptId:b.attemptId,planHash:b.planHash,sourceHead:b.sourceHead,issuedAt:b.issuedAt,expiresAt:b.expiresAt}));
  }finally{data.fill(0);}}
  missing(receipt);missing(artifact);
  for(const [path,hash]of [[currentProfile.node,currentProfile.nodeHash],[currentProfile.git,sources.gitSha256],[currentProfile.docker,sources.dockerSha256]]){pin(posix.dirname(path));const before=io.lstatSync(path);check(identity.fingerprint(path,160*1024*1024,clock)===hash&&statSame(before,io.lstatSync(path)));files.set(path,before);}
  const observedSocket=identity.realpath('/var/run/docker.sock');check(typeof observedSocket==='string'&&['/run/docker.sock','/var/run/docker.sock'].includes(observedSocket));socketPath=observedSocket;pin(posix.dirname(socketPath));const sock=io.lstatSync(socketPath);check(sock.isSocket()&&sock.uid===0&&!(sock.mode&0o002));files.set(socketPath,sock);
  const cfg=read(root+'/.git/config',8192);try{check(!/\[(?:include|includeIf|filter)|fsmonitor|hooksPath|sshCommand|credential|alternate|worktree/i.test(cfg.toString('utf8')));}finally{cfg.fill(0);}
  for(const name of ['objects/info/alternates','info/attributes','config.worktree'])missing(root+'/.git/'+name);
  const git=(args:string[],max=65536)=>{for(const name of ['objects/info/alternates','info/attributes','config.worktree'])missing(root+'/.git/'+name);const out=execute(currentProfile.git,['--no-pager','--no-optional-locks','--no-replace-objects','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','core.attributesFile=/dev/null','-c','core.excludesFile=/dev/null','-c','core.untrackedCache=false',...args],gitEnv,undefined,10000,max);check(out.status===0);return out.stdout;};
  check(git(['rev-parse','HEAD']).trim()===b.sourceHead&&git(['status','--porcelain','--untracked-files=all','--ignore-submodules=none'])==='');
  const tracked=git(['ls-files','-v','-z'],2097152).split('\0');check(tracked.pop()===''&&tracked.length>0&&tracked.every(row=>row.startsWith('H ')));
  for(const row of sources.files){check(tracked.includes('H '+row.path));pin(posix.dirname(root+'/'+row.path));const data=read(root+'/'+row.path,row.bytes);try{check(data.length===row.bytes&&contentHash(data)===row.sha256);}finally{data.fill(0);}}
  // 설치 tree 전체를 manifest의 정확 파일/디렉터리 집합과 대조. 링크/추가 모듈/외부 경로를 채택하지 않는다.
  const children=new Map<string,Set<string>>();children.set('node_modules',new Set());
  for(const row of dependencies.files){const parts=row.path.split('/');for(let i=1;i<parts.length;i++){const dir=parts.slice(0,i).join('/');if(!children.has(dir))children.set(dir,new Set());children.get(dir)!.add(parts[i]!);}}
  for(const [path,names]of children){pin(root+'/'+path);const before=io.lstatSync(root+'/'+path);check(same(io.readdirSync(root+'/'+path).sort(),[...names].sort())&&statSame(before,io.lstatSync(root+'/'+path)));dependencyDirectories.set(root+'/'+path,before);}
  for(const row of dependencies.files){const data=read(root+'/'+row.path,row.bytes);try{check(data.length===row.bytes&&contentHash(data)===row.sha256);}finally{data.fill(0);}}
  fresh();initialized=true;initializing=false;
 }
 const current=()=>guard(()=>{initialize();fresh();});
 const exactBinding=(value:Readonly<ManagementOriginHostBinding>)=>check(same(value,b));
 async function end(pool:Pool,ms:number){
  const owned=pools.get(pool);guard(()=>check(owned&&owned.state==='OPEN'&&Number.isSafeInteger(ms)&&ms>0&&ms<=10000));check(owned);owned.state='ENDING';
  const start=now(),startMono=monotonic();let handle:unknown,settled=false;
  try{await new Promise<void>((resolve,reject)=>{
   const finish=(ok:boolean)=>{if(settled)return;settled=true;if(handle!==undefined)ops.clearTimer(handle);ok?resolve():reject(Error('FN03_MANAGEMENT_NATIVE_UNKNOWN'));};
   try{handle=ops.timer(()=>finish(false),ms);if(settled){ops.clearTimer(handle);return;}Promise.resolve((owned.end as ()=>Promise<void>).call(pool)).then(()=>finish(true),()=>finish(false));}catch{finish(false);}
  });check(now()>=start&&now()-start<ms&&monotonic()>=startMono&&monotonic()-startMono<ms);owned.state='CLOSED';}
  catch{owned.state='UNKNOWN';broken=true;fail();}
 }
 const providers:ManagementOriginEntryPorts={now,monotonic,
  assertCurrent:value=>guard(()=>{exactBinding(value);current();}),
  assertPreparedRuntime:(value,runtime)=>guard(()=>{exactBinding(value);check(same(runtime,r));current();}),
  async consume(value){guard(()=>{exactBinding(value);current();check(!claimAttempted);claimAttempted=true;io.mkdirSync(receipt,{mode:0o700});pin(receipt,true);syncDir(parent);writeExclusive(receipt+'/intent.json',intent);io.mkdirSync(config,{mode:0o700});pin(config,true);syncDir(receipt);consumed=true;fresh();});},
  command:call=>guard(()=>{
   consumeManagementOriginDockerCall(call,b);current();check(consumed&&call.file===currentProfile.docker&&call.shell===false&&call.maxBuffer===65536&&Number.isSafeInteger(call.timeoutMs)&&call.timeoutMs>0&&call.timeoutMs<=30000&&same(call.argv.slice(0,4),['--config',config,'--host',currentProfile.socket]));
   const {POSTGRES_PASSWORD,...env}=call.env;check(same(env,{PATH:gitEnv.PATH,LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:receipt})&&(POSTGRES_PASSWORD===undefined||call.argv[4]==='create'&&hashV1(POSTGRES_PASSWORD)));
   return execute(call.file,call.argv,call.env,call.input,call.timeoutMs,call.maxBuffer);
  }),
  async wait(ms){try{current();check(ms===250&&Math.min(b.expiresAt-wall,until-mono)>ms);let handle:unknown,done=false;
   await new Promise<void>((resolve,reject)=>{try{handle=ops.timer(()=>{done=true;if(handle!==undefined)ops.clearTimer(handle);resolve();},ms);if(done)ops.clearTimer(handle);}catch{reject(Error('FN03_MANAGEMENT_NATIVE_UNKNOWN'));}});current();
  }catch{broken=true;fail();}},
  async openPool(request){
   current();let pool:Pool|undefined,newOwned=false;
   try{check(consumed&&recordV1(request,['host','port','database','user','password','ssl','max','connectionTimeoutMillis','statement_timeout','query_timeout'])&&['anvil_v3_app','anvil_v3_migrator','anvil_v3_bootstrap'].includes(request.user)&&!roles.has(request.user)&&request.database==='anvil_v3_fn03_management_'+b.attemptId.replaceAll('-','')&&request.port===5432&&request.ssl===false&&request.max===2&&request.connectionTimeoutMillis===3000&&request.statement_timeout===5000&&request.query_timeout===6000&&hashV1(request.password));
    const prefix=`172.${subnet[1]}.${subnet[2]}.`,last=Number(request.host.slice(prefix.length));check(request.host.startsWith(prefix)&&String(last)===request.host.slice(prefix.length)&&last>Number(subnet[3])&&last<Number(subnet[3])+15);
    roles.add(request.user);pool=ops.pool({...request});check(pool&&typeof pool.end==='function'&&!pools.has(pool));pools.set(pool,{end:pool.end,state:'OPEN'});newOwned=true;current();return pool;
   }catch{broken=true;if(newOwned&&pool&&pools.get(pool)?.state==='OPEN')await end(pool,10000).catch(()=>{});return fail();}
  },
  closePool:end,
  async prepareArtifactRoot(value){guard(()=>{exactBinding(value);current();check(consumed&&!artifactAttempted);artifactAttempted=true;io.mkdirSync(artifact,{mode:0o700});pin(artifact,true);syncDir('/tmp');writeExclusive(artifact+'/owner.json',intent);fresh();});},
 };return Object.freeze(providers);
}

export function createManagementOriginNativeProviders(preparation:ManagementOriginNativePreparation,injected?:ManagementOriginNativeOperations):ManagementOriginEntryPorts{
 try{return nativeProviders(preparation,injected);}catch{return fail();}
}
