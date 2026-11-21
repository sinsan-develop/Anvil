import {EventEmitter} from 'node:events';
import {Writable} from 'node:stream';
import {spawn} from 'node:child_process';
import {openSync,writeSync,fsyncSync,closeSync,fstatSync,lstatSync,realpathSync} from 'node:fs';
import {win32} from 'node:path';
import {performance} from 'node:perf_hooks';
import {types} from 'node:util';
import {canonicalJson,contentHash} from '../contracts/canonical.ts';
import {readTc01DependencyCarrierInput} from './qa-fn03-tc01-dependency-carrier-wire.ts';
import {createTc01DependencyCarrierSupervisor,type Tc01DependencyCarrierCollection} from './qa-fn03-tc01-dependency-carrier-supervisor.ts';

const profile='TC01_DEPENDENCY_PREPARATION_WINDOWS_SENDER_V1';
const client=String.raw`C:\Windows\System32\OpenSSH\ssh.exe`,ledgerRoot=String.raw`D:\Project\Anvil\.av3-data`;
const deployment='/home/daon/.local/share/anvil-v3-qa-launchers/fn03-tc01-dependency-78dae503';
const node='/opt/node-v24.22.1-linux-x64/bin/node',cli=deployment+'/qa-fn03-tc01-dependency-cli.mjs';
const pins=Object.freeze({
 cli:Object.freeze({path:cli,bytes:26983,sha256:'cdbad5ad1efff6be94aa03439e9ed80968d018077961ed66b3e1fb8af2aee765'}),
 bootstrap:Object.freeze({path:deployment+'/qa-fn03-tc01-dependency-bootstrap-start.mjs',bytes:14597,sha256:'99d4ed9fb47252815616ed3109645843baf97fd56e20bba47769a1a68f6ab18c'}),
 entry:Object.freeze({path:deployment+'/qa-fn03-tc01-dependency-linux-entry.ts',bytes:21426,sha256:'59dbeab165bdd9ec333d084c5e03c86658634e6418198fe780a9e099ba8b9ea0'}),
 node:Object.freeze({path:node,sha256:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb'}),
});
const options=Object.freeze({cwd:String.raw`C:\Windows\System32`,env:Object.freeze({}),shell:false as const,windowsHide:true as const,stdio:Object.freeze(['pipe','pipe','ignore'] as const)});
const flags=Object.freeze(['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ClearAllForwardings=yes',
 '-o','UpdateHostKeys=no','-o','AddKeysToAgent=no','-o','VerifyHostKeyDNS=no','-o','ForwardAgent=no','-o','ForwardX11=no','-o','ForwardX11Trusted=no','-o','Tunnel=no',
 '-o','ProxyCommand=none','-o','ProxyJump=none','-o','PermitLocalCommand=no','-o','LocalCommand=none','-o','ControlMaster=no','-o','ControlPath=none','-o','ControlPersist=no','-o','RequestTTY=no','-o','RemoteCommand=none',
 '-o','ConnectionAttempts=1','-o','ConnectTimeout=8','-o','ServerAliveInterval=3','-o','ServerAliveCountMax=2','-o','LogLevel=ERROR','WSL-server']);
const unknown=():Tc01DependencyCarrierCollection=>Object.freeze({status:'UNKNOWN',code:'DEPENDENCY_CARRIER_UNKNOWN',localCollection:'UNCONFIRMED',authority:'NOT_ISSUED'});
function check(v:unknown):asserts v{if(!v)throw Error('TC01_DEPENDENCY_WINDOWS_UNKNOWN');}
function record(v:unknown,keys:readonly string[]):Record<string,any>{check(v&&typeof v==='object'&&!types.isProxy(v)&&!Array.isArray(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);const r:Record<string,any>=Object.create(null);for(const k of keys){const x=d[k];check(x&&x.enumerable&&'value'in x);r[k]=x.value;}return r;}
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const typed=Object.getPrototypeOf(Uint8Array.prototype),length=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,backing=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!;
function copy(v:unknown){check(!types.isProxy(v)&&types.isUint8Array(v)&&types.isArrayBuffer(backing.call(v)));const n=length.call(v);check(n>0&&n<=16384);const b=new Uint8Array(n);Uint8Array.prototype.set.call(b,v);return b;}
const on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener,seenChildren=new WeakSet<object>();
const emitter=(v:unknown):v is EventEmitter=>!!v&&typeof v==='object'&&!types.isProxy(v)&&v instanceof EventEmitter;
type ReviewRequest=Readonly<Record<string,unknown>>;
/** 외부 원 감독이 승인/소진 목적·Windows exe/config/alias/host trust·원장 부모 ACL·Linux 배치/최초 Node 신원을 현재 검산한다.
 * 이 callback의 void나 입력 SHA를 돌려주는 합성 fixture 자체는 운영 권위/검증기가 아니다. */
export type Tc01DependencyWindowsReview=(request:ReviewRequest)=>void;
export interface Tc01DependencyWindowsPorts{
 platform():unknown;now():number;monotonic():number;setTimeout(fn:()=>void,ms:number):unknown;clearTimeout(handle:unknown):void;
 openExclusive(path:string):object;write(token:object,bytes:Uint8Array,offset:number):number;
 flush(token:object):void;close(token:object):void;confirmClosed(token:object,bytes:number):void;
 spawn(file:string,args:readonly string[],launchOptions:typeof options):unknown;end(child:EventEmitter,bytes:Uint8Array):void;
}
const portKeys=['platform','now','monotonic','setTimeout','clearTimeout','openExclusive','write','flush','close','confirmClosed','spawn','end'];
/** 설치 전용 한 시도. 기존 Windows §1/subnet/N2 기록은 소비하지 않는다.
 * native 포트는 명시 run 이후에만 효과가 있다. 빈 Windows env의 실제 인증 호환, 보호 publish 및 최초 실행 신원은 외부 review 선행.
 * 로컬 COLLECTED는 원 SSH 보고 수거뿐이며 원격 실행/provenance/통합시험 PASS가 아니다. UNKNOWN 뒤 kill/retry/delete 없음. */
export function createTc01DependencyWindowsSender(review:Tc01DependencyWindowsReview,ports?:Tc01DependencyWindowsPorts){
 const supplied=ports??nativePorts();let spent=false;
 return Object.freeze({async run(inputWire:unknown,value:unknown):Promise<Tc01DependencyCarrierCollection>{
  if(spent)return unknown();spent=true;let raw:Uint8Array|undefined,ledger:Buffer|undefined;let stopped=false;
  try{
   check(typeof review==='function'&&!types.isProxy(review));
   const v=record(value,['profile','binding','planSha256','gitSha256','carrier']);check(v.profile===profile&&hex(v.planSha256)&&hex(v.gitSha256));
   const b=record(v.binding,['purpose','attemptId','sourceHead','packageLockSha256','source','recipe','approvalSha256','consumptionSha256','issuedAt','expiresAt']);b.source=Object.freeze(record(b.source,['entry','sha256','closureSha256']));Object.freeze(b);
   const carrier=Object.freeze(record(v.carrier,['imageSha256','configurationSha256','knownHostsSha256']));check(Object.values(carrier).every(hex));
   raw=copy(inputWire);const inputSha256=contentHash(raw),p=record(supplied,portKeys);check(portKeys.every(k=>typeof p[k]==='function')&&p.platform.call(supplied)==='win32');
   const startedAt=p.now.call(supplied),startedMono=p.monotonic.call(supplied);const parsed=readTc01DependencyCarrierInput(raw,b,{startedAt,monotonicStartedAt:startedMono,now:startedAt,monotonicNow:startedMono});
   const binding=parsed.binding;check(binding.sourceHead==='4c44da5d432e561c672021eee14983562ac57b78'&&binding.source.sha256==='be189d368418e5963a958fe2a4dbaf4038f0a992a88031cb183840dd40733f25'&&binding.source.closureSha256==='d4a0ca7695ccb7d05d2c9e61e113c2cd6a09d774f59a674aa53c288b1f460132');
   const root='/home/daon/anvil-fn03-tc01-'+binding.attemptId+'-qa',receipt=ledgerRoot+'\\fn03-tc01-dependency-'+binding.attemptId+'.json';
   // 모든 삽입값은 기존 reader의 UUID 또는 exact SHA다. 임의 shell/host/path/추가 argv 입력은 없다.
   const remote="cd '"+root+"' && exec /usr/bin/env -i "+node+' '+cli+' --run '+binding.attemptId+' '+v.planSha256+' '+binding.approvalSha256+' '+v.gitSha256;
   const args=Object.freeze([...flags,remote]),command=Object.freeze({file:client,args,options});
   const request=Object.freeze({schemaVersion:1,purpose:'TC01_DEPENDENCY_PREPARATION_WINDOWS_SEND',profile,binding,planSha256:v.planSha256,gitSha256:v.gitSha256,inputSha256,carrier,placement:pins,sourceRoot:root,ledgerPath:receipt,command,commandSha256:contentHash(canonicalJson(command)),limits:parsed.limits});
   let wall=startedAt,mono=startedMono;const until=startedMono+binding.expiresAt-startedAt;check(Number.isSafeInteger(until));
   const clock=()=>{const w=p.now.call(supplied),m=p.monotonic.call(supplied);check(Number.isSafeInteger(w)&&w>=wall&&w<binding.expiresAt&&Number.isSafeInteger(m)&&m>=mono&&m<until);wall=w;mono=m;};
   const current=()=>{check(!stopped);clock();const q=record(supplied,portKeys);check(portKeys.every(k=>q[k]===p[k])&&p.platform.call(supplied)==='win32'&&raw&&contentHash(raw)===inputSha256);check(review(request)===undefined);clock();};
   current();ledger=Buffer.from(canonicalJson({schemaVersion:1,purpose:'TC01_DEPENDENCY_PREPARATION_WINDOWS_EXCLUSIVE_SEND',profile,attemptId:binding.attemptId,issuedAt:binding.issuedAt,expiresAt:binding.expiresAt,requestSha256:contentHash(canonicalJson(request)),planSha256:v.planSha256,approvalSha256:binding.approvalSha256,inputSha256})+'\n');check(ledger.length<=4096);
   let token:object|undefined,closeAttempted=false;
   try{current();const original=p.openExclusive.call(supplied,receipt);check(original&&typeof original==='object'&&!types.isProxy(original));token=original;current();let offset=0;const digest=contentHash(ledger);
    for(let n=0;offset<ledger.length&&n<4096;n++){current();check(contentHash(ledger)===digest);const count=p.write.call(supplied,token,ledger,offset);check(contentHash(ledger)===digest&&Number.isSafeInteger(count)&&count>0&&count<=ledger.length-offset);offset+=count;current();}
    check(offset===ledger.length&&p.flush.call(supplied,token)===undefined);current();closeAttempted=true;check(p.close.call(supplied,token)===undefined);current();check(p.confirmClosed.call(supplied,token,ledger.length)===undefined);current();
   }finally{if(token&&!closeAttempted){closeAttempted=true;try{p.close.call(supplied,token);}catch{stopped=true;}}ledger.fill(0);}
   current();const child=p.spawn.call(supplied,client,args,options);check(emitter(child)&&!seenChildren.has(child));seenChildren.add(child);
   let closed=false,sent=false;const failed=()=>{stopped=true;};const sinks:EventEmitter[]=[child];
   // spawn으로 받은 원 child는 stream 형상 검산 실패에도 실제 close까지 보존한다.
   on.call(child,'error',failed);const close=()=>{closed=true;for(const e of sinks)off.call(e,'error',failed);off.call(child,'close',close);};on.call(child,'close',close);
   const input=Object.getOwnPropertyDescriptor(child,'stdin')?.value,output=Object.getOwnPropertyDescriptor(child,'stdout')?.value;
   for(const e of [input,output])if(emitter(e)&&!sinks.includes(e)){sinks.push(e);on.call(e,'error',failed);}
   check(emitter(input)&&emitter(output)&&input!==output&&input!==child&&output!==child);
   current();const collector=createTc01DependencyCarrierSupervisor({now:()=>{clock();return wall;},monotonic:()=>{clock();return mono;},
    assertCurrent(c,r){current();check(c===child&&Object.getOwnPropertyDescriptor(child,'stdin')?.value===input&&Object.getOwnPropertyDescriptor(child,'stdout')?.value===output&&r.inputSha256===inputSha256&&canonicalJson(r.binding)===canonicalJson(binding));},
    setTimeout(fn,ms){current();const remaining=Math.min(ms,until-mono,binding.expiresAt-wall);check(Number.isSafeInteger(remaining)&&remaining>0);return p.setTimeout.call(supplied,fn,remaining);},clearTimeout(h){check(p.clearTimeout.call(supplied,h)===undefined);},
    transmit(c,bytes){current();check(c===child&&!sent&&!closed);sent=true;check(p.end.call(supplied,c,bytes)===undefined);current();},
   });
   const result=await collector.run(child,raw,binding);current();return closed&&result.status==='COLLECTED'?result:unknown();
  }catch{return unknown();}finally{raw?.fill(0);ledger?.fill(0);}
 }});
}

function nativePorts():Tc01DependencyWindowsPorts{
 type State={fd:number;path:string;parent:import('node:fs').Stats;dev:number;ino:number;size:number;closed:boolean;flushed:boolean};
 const handles=new WeakMap<object,State>();
 const parent=()=>{const s=lstatSync(ledgerRoot);check(s.isDirectory()&&!s.isSymbolicLink()&&realpathSync(ledgerRoot)===ledgerRoot);return s;};
 const original=(token:object)=>{const s=handles.get(token);check(s);return s;};
 const same=(s:State)=>{const p=parent(),f=lstatSync(s.path);check(p.dev===s.parent.dev&&p.ino===s.parent.ino&&f.isFile()&&!f.isSymbolicLink()&&f.nlink===1&&f.dev===s.dev&&f.ino===s.ino&&f.size===s.size&&realpathSync(s.path)===s.path);};
 return {platform:()=>process.platform,now:()=>Date.now(),monotonic:()=>Math.floor(performance.now()),setTimeout:(f,ms)=>setTimeout(f,ms),clearTimeout:h=>clearTimeout(h as NodeJS.Timeout),
  openExclusive(path){check(win32.dirname(path)===ledgerRoot&&/^fn03-tc01-dependency-[a-f0-9-]{36}\.json$/.test(win32.basename(path)));const par=parent(),fd=openSync(path,'wx',0o600);let kept=false;try{const s=fstatSync(fd);check(s.isFile()&&s.nlink===1&&s.size===0);const token=Object.freeze({});handles.set(token,{fd,path,parent:par,dev:s.dev,ino:s.ino,size:0,closed:false,flushed:false});same(original(token));kept=true;return token;}finally{if(!kept)closeSync(fd);}},
  write(token,b,offset){const s=original(token);check(!s.closed&&!s.flushed&&offset===s.size);same(s);const n=writeSync(s.fd,b,offset,b.length-offset,null);s.size+=n;return n;},
  flush(token){const s=original(token);check(!s.closed&&!s.flushed);const f=fstatSync(s.fd);check(f.isFile()&&f.nlink===1&&f.dev===s.dev&&f.ino===s.ino&&f.size===s.size);same(s);fsyncSync(s.fd);same(s);s.flushed=true;},
  close(token){const s=original(token);check(!s.closed);s.closed=true;closeSync(s.fd);},
  confirmClosed(token,bytes){const s=original(token);check(s.closed&&s.flushed&&s.size===bytes);same(s);handles.delete(token);},
  spawn:(file,args,o)=>spawn(file,[...args],{cwd:o.cwd,env:{...o.env},shell:false,windowsHide:true,stdio:['pipe','pipe','ignore']}),
  end(child,bytes){const input=Object.getOwnPropertyDescriptor(child,'stdin')?.value;check(input instanceof Writable&&!types.isProxy(input));const raw=Buffer.from(bytes);let done=false;const clear=()=>{if(done)return;done=true;raw.fill(0);off.call(input,'finish',clear);off.call(input,'close',clear);};on.call(input,'finish',clear);on.call(input,'close',clear);try{Reflect.apply(Writable.prototype.end,input,[raw]);}catch{clear();throw Error('TC01_DEPENDENCY_WINDOWS_UNKNOWN');}},
 };
}
