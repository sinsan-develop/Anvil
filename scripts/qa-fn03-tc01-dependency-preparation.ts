import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {parseWireJson} from '../contracts/canonical.ts';
import {currentProfile,withCurrentNpmUmask} from './qa-ix01-current-journey.ts';

type Binding=Readonly<{attemptId:string;sourceHead:string;lockSha256:string;issuedAt:number;expiresAt:number}>;
type Command=Readonly<{file:string;args:readonly string[];cwd:string;env:Readonly<Record<string,string>>;shell:false;stdio:readonly ['ignore','pipe','pipe'];timeoutMs:number;maxOutputBytes:65536}>;
export interface Tc01DependencyPreparationPorts {
 now():number;monotonic():number;
 /** 동일 감독의 외부 승인/원장·정확 recipe 채택 및 현재성을 검산한다. void 반환은 자체 권위가 아니다. */
 assertApproved(request:Readonly<Record<string,unknown>>):void;
 /** 실제 도구/버전/checkout HEAD·lock/보호 부모/원 파일 신원 검산 책임. boolean 증거를 발급하지 않는다.
  * BEFORE_PREPARE: 새 preparationRoot/cache/config 및 node_modules/.npmrc 부재.
  * BEFORE_START: 같은 부모, uid1000, cache0700, 빈 config0600, node_modules/.npmrc 부재.
  * AFTER_CLOSE: 같은 source/tool/config와 새 node_modules의 보호 metadata. 설치 manifest 발급 아님. 모든 단계에서 requiredAbsent의 실행용 receipt/artifact는 계속 부재. */
 verify(request:Readonly<Record<string,unknown>> & {phase:'BEFORE_PREPARE'|'BEFORE_START'|'AFTER_CLOSE'}):void;
 /** 새 전용 preparationRoot/cache0700, exclusive 빈 config0600만 준비. 기존 경로 덮기/권한 변경 없음. */
 prepare(request:Readonly<Record<string,unknown>>):void;
 /** 아직 시작하지 않은 원 handle+stdout/stderr만 공급. 생성/종료의 실제 소유권은 외부 감독 책임. */
 takeChild(command:Command):unknown;
 /** 같은 handle/command만 동기 시작. shell/추가 자식·재시도 없음. 실제 adapter는 이 모듈에 없다. */
 start(child:EventEmitter,command:Command):void;
 umask(value?:number):number;
 setTimeout(callback:()=>void,ms:number):unknown;clearTimeout(handle:unknown):void;
}
export type Tc01DependencyPreparationResult=Readonly<{status:'COLLECTED'|'UNKNOWN';code:'INSTALL_EXIT_COLLECTED'|'PREPARATION_UNKNOWN';recipe:'TC01_DEPENDENCY_RECIPE_CANDIDATE_V1';authority:'NOT_ISSUED';manifest:'NOT_ISSUED'}>;
const recipe='TC01_DEPENDENCY_RECIPE_CANDIDATE_V1',cap=600000,outputCap=65536,used=new WeakSet<object>();
const on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,bufferOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
const keys=['now','monotonic','assertApproved','verify','prepare','takeChild','start','umask','setTimeout','clearTimeout'] as const;
const fail=():never=>{throw Error('TC01_DEPENDENCY_PREPARATION_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
function record(v:unknown,fields:readonly string[]):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===fields.length);
 const r:Record<string,any>=Object.create(null);for(const k of fields){const x=d[k];check(x&&'value'in x);r[k]=x.value;}return r;
}
function own(v:object,k:string):unknown{const d=Object.getOwnPropertyDescriptor(v,k);return d&&'value'in d?d.value:undefined;}
function bytes(v:unknown):Uint8Array{
 check(!types.isProxy(v)&&types.isUint8Array(v)&&types.isArrayBuffer(bufferOf.call(v)));const n=lengthOf.call(v);check(n>0&&n<=16*1024*1024);const b=new Uint8Array(n);set.call(b,v);return b;
}
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const hex=(v:unknown,n:number):v is string=>typeof v==='string'&&v.length===n&&/^[0-9a-f]+$/.test(v);
const emitter=(v:unknown):v is EventEmitter=>v!==null&&typeof v==='object'&&!types.isProxy(v)&&v instanceof EventEmitter;
const answer=(ok=false):Tc01DependencyPreparationResult=>Object.freeze({status:ok?'COLLECTED':'UNKNOWN',code:ok?'INSTALL_EXIT_COLLECTED':'PREPARATION_UNKNOWN',recipe,authority:'NOT_ISSUED',manifest:'NOT_ISSUED'});
/** 설치 recipe 후보의 원 handle 종결만 수거한다. 기본 live adapter/CLI/파일·설치/승인 발급 없음.
 * 외부 승인/도구·checkout 검사 포트가 미구현이면 호출할 수 없다. 합성 성공은 실제 Linux 설치 증거가 아니다.
 * 실패/불명은 신호·재조회·재시도·삭제하지 않는다. 원 child 보존/외부 회수는 감독 책임이다.
 * omit=dev는 runtime 후보이며 rolldown graph 조사 도구의 설치/closure를 제공하지 않는다. */
export function createTc01DependencyPreparation(ports:Tc01DependencyPreparationPorts){
 const p=record(ports,keys);for(const k of keys)check(typeof p[k]==='function');let spent=false;
 return Object.freeze({async run(input:unknown):Promise<Tc01DependencyPreparationResult>{
  if(spent)return answer();spent=true;let raw:Uint8Array|undefined;
  try{
   const i=record(input,['binding','lockBytes']),b=record(i.binding,['attemptId','sourceHead','lockSha256','issuedAt','expiresAt']);
   check(typeof b.attemptId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(b.attemptId));
   check(hex(b.sourceHead,40)&&hex(b.lockSha256,64)&&Number.isSafeInteger(b.issuedAt)&&b.issuedAt>=0&&Number.isSafeInteger(b.expiresAt)&&b.expiresAt>b.issuedAt&&b.expiresAt-b.issuedAt<=1800000);
   const binding=Object.freeze(b) as Binding;raw=bytes(i.lockBytes);check(hash(raw)===binding.lockSha256);
   const parsed=parseWireJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw));
   check(parsed!==null&&typeof parsed==='object'&&!Array.isArray(parsed));const lock=parsed as Record<string,any>;
   check(lock.lockfileVersion===3&&lock.packages!==null&&typeof lock.packages==='object'&&!Array.isArray(lock.packages)&&Object.hasOwn(lock.packages,''));
   for(const [path,row]of Object.entries(lock.packages) as [string,any][])if(path!=='')check(row&&typeof row==='object'&&!Array.isArray(row)&&row.link!==true&&typeof row.resolved==='string'&&row.resolved.startsWith('https://registry.npmjs.org/')&&typeof row.integrity==='string'&&/^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/.test(row.integrity));
   fill.call(raw,0);raw=undefined;
   const sourceRoot='/home/daon/anvil-fn03-tc01-'+binding.attemptId+'-qa',receiptRoot='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+binding.attemptId,preparationRoot=receiptRoot+'-dependency-preparation';
   const tools=Object.freeze({node:Object.freeze({path:currentProfile.node,sha256:currentProfile.nodeHash,version:'24.22.1',maxBytes:160*1024*1024,mode:0o755}),npm:Object.freeze({path:currentProfile.npm,sha256:currentProfile.npmHash,bytes:54,mode:0o755,version:currentProfile.npmVersion}),npmPackage:Object.freeze({path:currentProfile.npmPackage,sha256:currentProfile.npmPackageHash,bytes:6597,mode:0o644})});
   const request=Object.freeze({recipe,binding,sourceRoot,preparationRoot,requiredAbsent:Object.freeze([receiptRoot,'/tmp/fn03-tc01-'+binding.attemptId]),uid:1000,tools,cache:preparationRoot+'/npm-cache',cacheMode:0o700,configs:Object.freeze([preparationRoot+'/npm-user.conf',preparationRoot+'/npm-global.conf']),configBytes:0,configMode:0o600});
   let lastWall=-1,lastMono=-1,wallUntil=binding.expiresAt,monoUntil=Infinity;
   const fresh=()=>{
    const current=record(ports,keys);for(const k of keys)check(current[k]===p[k]);
    const time=()=>{const wall=p.now.call(ports),mono=p.monotonic.call(ports);check(Number.isSafeInteger(wall)&&wall>=binding.issuedAt&&wall>=lastWall&&wall<wallUntil&&Number.isSafeInteger(mono)&&mono>=0&&mono>=lastMono&&mono<monoUntil);if(monoUntil===Infinity){wallUntil=Math.min(wallUntil,wall+cap);monoUntil=mono+Math.min(cap,wallUntil-wall);check(Number.isSafeInteger(monoUntil));}lastWall=wall;lastMono=mono;};
    time();check(p.assertApproved.call(ports,request)===undefined);time();return Math.min(wallUntil-lastWall,monoUntil-lastMono);
   };
   const verify=(phase:'BEFORE_PREPARE'|'BEFORE_START'|'AFTER_CLOSE')=>{fresh();check(p.verify.call(ports,Object.freeze({...request,phase}))===undefined);fresh();};
   verify('BEFORE_PREPARE');fresh();check(p.prepare.call(ports,request)===undefined);fresh();verify('BEFORE_START');
   const env=Object.freeze({PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:preparationRoot,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_PAGER:'cat'});
   const command:Command=Object.freeze({file:currentProfile.node,args:Object.freeze([currentProfile.npm,'ci','--ignore-scripts','--no-audit','--no-fund','--bin-links=false','--omit=dev','--include=optional','--userconfig='+request.configs[0],'--globalconfig='+request.configs[1],'--cache='+request.cache,'--registry=https://registry.npmjs.org/']),cwd:sourceRoot,env,shell:false,stdio:Object.freeze(['ignore','pipe','pipe'] as const),timeoutMs:fresh(),maxOutputBytes:outputCap});
   const child=p.takeChild.call(ports,command);check(emitter(child)&&!used.has(child));used.add(child);
   const stdout=own(child,'stdout'),stderr=own(child,'stderr');check(emitter(stdout)&&emitter(stderr)&&stdout!==stderr&&stdout!==child&&stderr!==child&&!used.has(stdout)&&!used.has(stderr));used.add(stdout);used.add(stderr);fresh();
   const collected=await new Promise<boolean>(resolve=>{
    const listeners:{target:EventEmitter;event:string;fn:(...args:any[])=>void}[]=[];
    let setup=true,ready=false,terminal:boolean|undefined,settled=false,timer:unknown,timerSet=false,size=0,outEnd=false,errEnd=false,exited=false;
    const settle=()=>{if(setup||settled||terminal===undefined)return;settled=true;let clean=true;for(const l of listeners)try{off.call(l.target,l.event,l.fn);}catch{clean=false;}if(timerSet)try{check(p.clearTimeout.call(ports,timer)===undefined);}catch{clean=false;}resolve(clean&&terminal);};
    const finish=(ok=false)=>{if(terminal===undefined)terminal=ok;settle();};
    const valid=()=>{check(own(child,'stdout')===stdout&&own(child,'stderr')===stderr);fresh();};
    const listen=(target:EventEmitter,event:string,action:(...args:any[])=>void)=>{if(terminal!==undefined)return;const fn=(...args:any[])=>{if(terminal!==undefined)return;if(!ready){finish();return;}try{valid();action(...args);}catch{finish();}};listeners.push({target,event,fn});on.call(target,event,fn);};
    const data=(value:unknown,ended:boolean)=>{check(!ended&&!types.isProxy(value)&&types.isUint8Array(value)&&types.isArrayBuffer(bufferOf.call(value)));size+=lengthOf.call(value);check(size<=outputCap);};
    try{
     valid();listen(child,'error',()=>finish());
     listen(stdout,'data',v=>data(v,outEnd));listen(stderr,'data',v=>data(v,errEnd));
     listen(stdout,'end',()=>{check(!outEnd);outEnd=true;});listen(stderr,'end',()=>{check(!errEnd);errEnd=true;});
     listen(stdout,'error',()=>finish());listen(stderr,'error',()=>finish());
     listen(stdout,'close',()=>{check(outEnd);});listen(stderr,'close',()=>{check(errEnd);});
     listen(child,'exit',(code:unknown,signal:unknown)=>{check(!exited&&code===0&&signal===null);exited=true;});
     listen(child,'close',(code:unknown,signal:unknown)=>{check(exited&&outEnd&&errEnd&&code===0&&signal===null);finish(true);});
     if(terminal===undefined){const ms=fresh();check(ms>0);timer=p.setTimeout.call(ports,()=>finish(),ms);timerSet=timer!==undefined&&timer!==null;check(timerSet);}
     if(terminal===undefined){valid();ready=true;withCurrentNpmUmask(()=>{valid();check(p.start.call(ports,child,command)===undefined);return '';},value=>p.umask.call(ports,value));valid();}
    }catch{terminal=false;}finally{setup=false;settle();}
   });
   if(!collected)return answer();verify('AFTER_CLOSE');return answer(true);
  }catch{return answer();}finally{if(raw)fill.call(raw,0);}
 }});
}
