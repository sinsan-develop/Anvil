import {types} from 'node:util';
import {posix} from 'node:path';
import type {EventEmitter} from 'node:events';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {currentProfile} from './qa-ix01-current-journey.ts';
import {readTc01DependencyCarrierInput} from './qa-fn03-tc01-dependency-carrier-wire.ts';
import {createTc01DependencyCarrierEntry} from './qa-fn03-tc01-dependency-carrier-entry.ts';
import {createTc01DependencyNativePorts,type Tc01DependencyNativeSystem} from './qa-fn03-tc01-dependency-native-ports.ts';

export interface Tc01DependencyAuthorizationSupervisor {
 now():number;monotonic():number;
 /** 독립 인간 승인/원 실행 창과 이 exact expected의 관계는 외부 감독 책임. JSON/void 자체는 권위가 아니다. */
 assertCurrent(expected:Readonly<Record<string,unknown>>):void;
 /** 동일 Linux checkout·원 HEAD/lock/적재 closure·고정 Node/npm 실제 신원을 검산한다. */
 verifySource(request:Readonly<Record<string,unknown>>):void;
 retainChild(child:EventEmitter):void;
}
export interface Tc01DependencyAuthorizationSystem extends Tc01DependencyNativeSystem {
 /** 원 CREATE fd에만 현재 offset부터 유한 부분 write. O_EXCL/NOFOLLOW/0600 및 원 fd는 system 계약이다. */
 write(fd:number,bytes:Buffer,offset:number):number;
}
const purpose='TC01_DEPENDENCY_PREPARATION',profile='TC01_DEPENDENCY_PREPARATION_ENTRY_V1',recipe='TC01_DEPENDENCY_RECIPE_CANDIDATE_V1';
const planKeys=['schemaVersion','purpose','profile','attemptId','sourceHead','issuedAt','expiresAt','sourceRoot','preparationRoot','receiptRoot','packageLockSha256','source','recipe','commandSha256'];
const sourceKeys=['entry','sha256','closureSha256'];
const supervisorKeys=['now','monotonic','assertCurrent','verifySource','retainChild'];
const nativeKeys=['context','lstat','fstat','realpath','mkdir','open','read','sync','close','readdir','spawn','umask','setTimeout','clearTimeout'];
const systemKeys=[...nativeKeys,'write'];
const statKeys=['dev','ino','uid','gid','mode','size','mtimeMs','ctimeMs','nlink'];
const parentKeys=['dev','ino','uid','gid','mode'];
const fail=():never=>{throw Error('TC01_DEPENDENCY_AUTHORIZATION_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
function record(v:unknown,keys:readonly string[]):Record<string,any>{check(v!==null&&typeof v==='object'&&!types.isProxy(v)&&!Array.isArray(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);const r:Record<string,any>=Object.create(null);for(const k of keys){const x=d[k];check(x&&'value'in x);r[k]=x.value;}return r;}
const hex=(v:unknown,n=64):v is string=>typeof v==='string'&&v.length===n&&/^[a-f0-9]+$/.test(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const same=(a:Record<string,any>,b:Record<string,any>,keys:readonly string[]=statKeys)=>keys.every(k=>a[k]===b[k]);
function stat(v:unknown){const s=record(v,statKeys);check(statKeys.every(k=>typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=0&&(k==='mtimeMs'||k==='ctimeMs'||Number.isSafeInteger(s[k])))&&s.mode<=65535);return s;}
const typed=Object.getPrototypeOf(Uint8Array.prototype),byteLength=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,backing=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!;
function own(v:unknown,max:number){check(!types.isProxy(v)&&types.isUint8Array(v)&&types.isArrayBuffer(backing.call(v)));const n=byteLength.call(v);check(n>0&&n<=max);const b=Buffer.alloc(n);Uint8Array.prototype.set.call(b,v);return b;}
function json(raw:Buffer){
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);let depth=0,nodes=0,quoted=false,escape=false,scalar=false;
 for(const c of text){if(quoted){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c==='"')quoted=false;continue;}if(c==='"'){check(++nodes<=256);quoted=true;scalar=false;}else if(c==='{'||c==='['){check(++depth<=8&&++nodes<=256);scalar=false;}else if(c==='}'||c===']'){check(--depth>=0);scalar=false;}else if(', :\r\n\t'.includes(c))scalar=false;else if(!scalar){check(++nodes<=256);scalar=true;}}
 check(!quoted&&!escape&&depth===0);return parseWireJson(text);
}
function fixedCommand(root:string,prep:string){return {file:currentProfile.node,args:[currentProfile.npm,'ci','--ignore-scripts','--no-audit','--no-fund','--bin-links=false','--omit=dev','--include=optional','--userconfig='+prep+'/npm-user.conf','--globalconfig='+prep+'/npm-global.conf','--cache='+prep+'/npm-cache','--registry=https://registry.npmjs.org/'],cwd:root,
 env:{PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:prep,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_PAGER:'cat'},shell:false,stdio:['ignore','pipe','pipe'],maxOutputBytes:65536};}
const unknown=()=>Object.freeze({status:'UNKNOWN' as const,code:'DEPENDENCY_AUTHORIZED_ENTRY_UNKNOWN' as const,authority:'NOT_ISSUED' as const});
/** 설치 전용 비공개 원문/소진 외피. 기본 OS/환경/CLI/승인 발급 없음; system과 실제 권위 감독이 필수다.
 * A14의 승인 exact9/원 바이트 hash, intent exact7 canonical(no LF), UID1000/0600,
 * exclusive mkdir0700 -> 부모 sync -> wx/write/sync/close -> 부모 sync/readback을 재사용한다.
 * 새 receipt는 -dependency-consumption으로 준비/TC01 실행 receipt와 분리된다.
 * 같은 factory spent와 신규 mkdir 성공을 함께 요구하며 기존 원장은 인수하지 않는다.
 * 동적 import 전 source 적재/실제 배포/Windows 전달 및 인간 승인 진위는 외부 미연결 책임이다. */
export function createTc01DependencyAuthorizedEntry(supervisor:Tc01DependencyAuthorizationSupervisor,system:Tc01DependencyAuthorizationSystem){
 let spent=false;
 return Object.freeze({async run(inputWire:unknown,expectedValue:unknown){
  if(spent)return unknown();spent=true;const buffers:Buffer[]=[];let adapter:ReturnType<typeof createTc01DependencyNativePorts>|undefined;let answer:string|ReturnType<typeof unknown>=unknown();
  try{
   // 외부 clock/current callback보다 먼저 승인 기대값과 입력을 소유한다.
   const expected=record(expectedValue,['plan','planHash','approvalHash','approvalId']),p=record(expected.plan,planKeys),source=Object.freeze(record(p.source,sourceKeys));p.source=source;
   check(p.schemaVersion===1&&p.purpose===purpose&&p.profile===profile&&uuid(p.attemptId)&&hex(p.sourceHead,40)&&hex(p.packageLockSha256)&&p.recipe===recipe&&source.entry==='scripts/qa-fn03-tc01-dependency-intake.ts'&&hex(source.sha256)&&hex(source.closureSha256));
   check(Number.isSafeInteger(p.issuedAt)&&p.issuedAt>=0&&Number.isSafeInteger(p.expiresAt)&&p.expiresAt>p.issuedAt&&p.expiresAt-p.issuedAt<=1800000&&hex(expected.planHash)&&hex(expected.approvalHash)&&uuid(expected.approvalId));
   const root='/home/daon/anvil-fn03-tc01-'+p.attemptId+'-qa',base='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+p.attemptId,prep=base+'-dependency-preparation',receipt=base+'-dependency-consumption';
   check(p.sourceRoot===root&&p.preparationRoot===prep&&p.receiptRoot===receipt&&p.commandSha256===contentHash(canonicalJson(fixedCommand(root,prep))));
   expected.plan=Object.freeze(p);Object.freeze(expected);const wire=own(inputWire,16384);buffers.push(wire);
   const s=record(supervisor,supervisorKeys),io=record(system,systemKeys);check(supervisorKeys.every(k=>typeof s[k]==='function')&&systemKeys.every(k=>typeof io[k]==='function'));
   const parents=new Map<string,Record<string,any>>(),files=new Map<string,Record<string,any>>(),fds=new Set<number>();let wall=-1,mono=-1,until=Infinity,checking=false,consumed=false;
   const clock=()=>{const w=s.now.call(supervisor),m=s.monotonic.call(supervisor);check(Number.isSafeInteger(w)&&w>=p.issuedAt&&w>=wall&&w<p.expiresAt&&Number.isSafeInteger(m)&&m>=0&&m>=mono&&m<until);if(until===Infinity)until=m+p.expiresAt-w;wall=w;mono=m;};
   const identity=()=>{const ss=record(supervisor,supervisorKeys),ii=record(system,systemKeys);check(supervisorKeys.every(k=>ss[k]===s[k])&&systemKeys.every(k=>ii[k]===io[k]));};
   const fresh=()=>{check(!checking);checking=true;try{identity();clock();check(s.assertCurrent.call(supervisor,expected)===undefined);identity();clock();const ctx=record(io.context.call(system),['platform','uid']);check(ctx.platform==='linux'&&ctx.uid===1000);for(const [path,pin]of parents)check(same(pin,stat(io.lstat.call(system,path)),parentKeys)&&io.realpath.call(system,path)===path);for(const [path,pin]of files)check(same(pin,stat(io.lstat.call(system,path)))&&io.realpath.call(system,path)===path);identity();clock();}finally{checking=false;}};
   const call=(key:string,...args:any[])=>{fresh();const v=io[key].apply(system,args);fresh();return v;};
   const pin=(path:string,privateLeaf=false)=>{let cur='';for(const part of path.split('/').filter(Boolean)){cur+='/'+part;const row=stat(call('lstat',cur));check((row.mode&0o170000)===0o040000&&[0,1000].includes(row.uid)&&!(row.mode&0o022));if(cur===path&&privateLeaf)check(row.uid===1000&&(row.mode&0o7777)===0o700);const prior=parents.get(cur);check(!prior||same(prior,row,parentKeys));parents.set(cur,row);}check(call('realpath',path)===path);};
   const close=(fd:number)=>{check(fds.delete(fd));check(io.close.call(system,fd)===undefined);};
   const open=(path:string,kind:'READ'|'CREATE'|'DIRECTORY',mode?:number)=>{fresh();const fd=io.open.call(system,path,kind,mode);check(Number.isSafeInteger(fd)&&fd>=0&&!fds.has(fd));fds.add(fd);return fd;};
   const read=(path:string,max:number,mode?:number)=>{pin(posix.dirname(path));const before=stat(call('lstat',path));check((before.mode&0o170000)===0o100000&&before.uid===1000&&before.nlink===1&&!(before.mode&0o022)&&before.size>0&&before.size<=max&&(mode===undefined||(before.mode&0o7777)===mode)&&call('realpath',path)===path);const raw=Buffer.alloc(before.size),probe=Buffer.alloc(1);buffers.push(raw,probe);const fd=open(path,'READ');try{fresh();check(same(before,stat(call('fstat',fd))));let offset=0;while(offset<raw.length){const n=call('read',fd,raw,offset,Math.min(65536,raw.length-offset),offset);check(Number.isSafeInteger(n)&&n>0&&n<=Math.min(65536,raw.length-offset));offset+=n;}check(call('read',fd,probe,0,1,raw.length)===0&&same(before,stat(call('fstat',fd)))&&same(before,stat(call('lstat',path)))&&call('realpath',path)===path);}finally{close(fd);probe.fill(0);}fresh();files.set(path,before);return raw;};
   const syncDir=(path:string)=>{const fd=open(path,'DIRECTORY');try{fresh();check(same(parents.get(path)!,stat(call('fstat',fd)),parentKeys));check(call('sync',fd)===undefined);}finally{close(fd);}};
   fresh();const startedAt=wall,monotonicStartedAt=mono;
   const intent=Buffer.from(canonicalJson({schemaVersion:1,purpose:purpose+'_INTENT',profile,approvalId:expected.approvalId,planHash:expected.planHash,approvalHash:expected.approvalHash,sourceHead:p.sourceHead}));buffers.push(intent);const intentHash=contentHash(intent);
   const binding=Object.freeze({purpose,attemptId:p.attemptId,sourceHead:p.sourceHead,packageLockSha256:p.packageLockSha256,source,recipe,approvalSha256:expected.approvalHash,consumptionSha256:intentHash,issuedAt:p.issuedAt,expiresAt:p.expiresAt});
   readTc01DependencyCarrierInput(wire,binding,{startedAt,monotonicStartedAt,now:wall,monotonicNow:mono});
   pin(root,true);pin(posix.dirname(receipt));
   const planRaw=read(receipt+'-plan.json',32768,0o600),approvalRaw=read(receipt+'-approval.json',32768,0o600);
   check(contentHash(planRaw)===expected.planHash&&contentHash(approvalRaw)===expected.approvalHash);
   const seen=record(json(planRaw),planKeys);seen.source=record(seen.source,sourceKeys);check(canonicalJson(seen)===canonicalJson(p));
   const approval=record(json(approvalRaw),['schemaVersion','purpose','profile','decision','approvalId','planHash','sourceHead','issuedAt','expiresAt']);
   check(canonicalJson(approval)===canonicalJson({schemaVersion:1,purpose:purpose+'_RUN_APPROVAL',profile,decision:'ALLOW_ONE_RUN',approvalId:expected.approvalId,planHash:expected.planHash,sourceHead:p.sourceHead,issuedAt:p.issuedAt,expiresAt:p.expiresAt}));planRaw.fill(0);approvalRaw.fill(0);
   const verify=(phase:string)=>{fresh();check(s.verifySource.call(supervisor,Object.freeze({expected,phase}))===undefined);fresh();};
   verify('BEFORE_CONSUMPTION');const lock=read(root+'/package-lock.json',16777216);check(contentHash(lock)===p.packageLockSha256);fresh();
   // 기존 mkdir 결과를 인수하지 않는다. 실패/부분 기록 뒤 조회·삭제·재시도는 없다.
   check(call('mkdir',receipt,0o700)===undefined);pin(receipt,true);syncDir(posix.dirname(receipt));
   const fd=open(receipt+'/intent.json','CREATE',0o600);
   try{fresh();const created=stat(call('fstat',fd));check((created.mode&0o170000)===0o100000&&created.uid===1000&&created.nlink===1&&created.size===0&&(created.mode&0o7777)===0o600);let offset=0;
    for(let calls=0;offset<intent.length&&calls<intent.length;calls++){check(contentHash(intent)===intentHash);const n=call('write',fd,intent,offset);check(contentHash(intent)===intentHash&&Number.isSafeInteger(n)&&n>0&&n<=intent.length-offset);offset+=n;}
    check(offset===intent.length&&call('sync',fd)===undefined);
    // 최초 pin은 경로를 재채택하지 않고 CREATE 원 fd에서만 얻는다. close/부모 sync/readback도 이 신원을 유지한다.
    const written=stat(call('fstat',fd)),path=receipt+'/intent.json';
    check(same(created,written,['dev','ino','uid','gid','mode','nlink'])&&written.size===intent.length&&same(written,stat(call('lstat',path)))&&call('realpath',path)===path);
    files.set(path,written);fresh();check(same(written,stat(call('fstat',fd))));
   }finally{close(fd);}
   fresh();syncDir(receipt);const settled=read(receipt+'/intent.json',4096,0o600);check(contentHash(settled)===intentHash&&contentHash(intent)===intentHash);settled.fill(0);consumed=true;
   const current=()=>{fresh();check(consumed);};
   const nativeSystem=Object.fromEntries(nativeKeys.map(k=>[k,(...args:any[])=>io[k].apply(system,args)])) as unknown as Tc01DependencyNativeSystem;
   adapter=createTc01DependencyNativePorts(Object.freeze({attemptId:p.attemptId,sourceHead:p.sourceHead,lockSha256:p.packageLockSha256,issuedAt:p.issuedAt,expiresAt:p.expiresAt}),{
    now:()=>s.now.call(supervisor),monotonic:()=>s.monotonic.call(supervisor),assertCurrent:()=>current(),verify:r=>{current();check(r.phase==='BEFORE_PREPARE'||r.phase==='BEFORE_START'||r.phase==='AFTER_CLOSE');verify(r.phase);},retainChild:child=>s.retainChild.call(supervisor,child),
   },nativeSystem);
   let supplied=false;const receiver=createTc01DependencyCarrierEntry({assertCurrent:r=>{current();check(canonicalJson(r.binding)===canonicalJson(binding));},takeLockBytes:r=>{current();check(!supplied&&canonicalJson(r.binding)===canonicalJson(binding)&&contentHash(lock)===p.packageLockSha256);supplied=true;return Object.freeze({sourceHead:p.sourceHead,packageLockSha256:p.packageLockSha256,bytes:lock});}},adapter.ports,adapter.files);
   current();const result=await receiver.run(wire,binding);check(typeof result==='string');current();answer=result;
  }catch{answer=unknown();}finally{try{adapter?.dispose();}catch{answer=unknown();}finally{for(const b of buffers)Uint8Array.prototype.fill.call(b,0);}}
  return answer;
 }});
}
