import * as fs from 'node:fs';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {posix} from 'node:path';
import {types} from 'node:util';
import {canonicalJson} from '../contracts/canonical.ts';
import {currentProfile} from './qa-ix01-current-journey.ts';
import type {Tc01DependencyIntakePorts} from './qa-fn03-tc01-dependency-intake.ts';
import type {Tc01PreloadFilesPort} from './qa-fn03-tc01-preload-files.ts';

type Binding=Readonly<{attemptId:string;sourceHead:string;lockSha256:string;issuedAt:number;expiresAt:number}>;
type Command=Parameters<Tc01DependencyIntakePorts['takeChild']>[0];
type OpenKind='READ'|'DIRECTORY'|'CREATE';
export interface Tc01DependencyNativeController {
 now():number;monotonic():number;
 /** 원 승인·배타 소진·고정 도구/HEAD/lock/root 현재성은 동일 외부 감독이 검산한다. 반환값은 권위가 아니다. */
 assertCurrent(binding:Binding):void;
 verify(request:Readonly<Record<string,unknown>>):void;
 /** 생성 직후 원 객체를 외부 감독에 인계. 불명 뒤에도 이 객체만 보존하며 이 모듈은 signal/delete하지 않는다. */
 retainChild(child:EventEmitter):void;
}
export interface Tc01DependencyNativeSystem {
 context():unknown;lstat(path:string):unknown;fstat(fd:number):unknown;realpath(path:string):string;
 mkdir(path:string,mode:number):void;open(path:string,kind:OpenKind,mode?:number):number;
 read(fd:number,b:Buffer,offset:number,length:number,position:number):number;sync(fd:number):void;close(fd:number):void;
 readdir(path:string,limit:number):unknown;spawn(command:Command):unknown;umask(value?:number):number;
 setTimeout(fn:()=>void,ms:number):unknown;clearTimeout(handle:unknown):void;
}
const statKeys=['dev','ino','uid','gid','mode','size','mtimeMs','ctimeMs','nlink'] as const;
const parentKeys=['dev','ino','uid','gid','mode'] as const;
const controllerKeys=['now','monotonic','assertCurrent','verify','retainChild'] as const;
const ioKeys=['context','lstat','fstat','realpath','mkdir','open','read','sync','close','readdir','spawn','umask','setTimeout','clearTimeout'] as const;
const bindingKeys=['attemptId','sourceHead','lockSha256','issuedAt','expiresAt'] as const;
const fail=():never=>{throw Error('TC01_DEPENDENCY_NATIVE_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
function record(v:unknown,keys:readonly string[]):Record<string,any>{check(v!==null&&typeof v==='object'&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);const r:Record<string,any>=Object.create(null);for(const k of keys){const x=d[k];check(x&&'value'in x);r[k]=x.value;}return r;}
function stat(v:unknown){const r=record(v,statKeys);check(statKeys.every(k=>typeof r[k]==='number'&&Number.isFinite(r[k])&&r[k]>=0&&(k==='mtimeMs'||k==='ctimeMs'||Number.isSafeInteger(r[k])))&&r.mode<=65535);return r;}
function strings(v:unknown){check(Array.isArray(v)&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v) as unknown as Record<string,PropertyDescriptor>,n=d.length?.value;check(Number.isSafeInteger(n)&&n>=0&&n<=32&&Reflect.ownKeys(d).length===n+1);const r:string[]=[];for(let i=0;i<n;i++){const x=d[String(i)];check(x&&'value'in x&&typeof x.value==='string');r.push(x.value);}return Object.freeze(r);}
function ownCommand(v:unknown):Command {const r=record(v,['file','args','cwd','env','shell','stdio','timeoutMs','maxOutputBytes']);const e=record(r.env,['PATH','LANG','LC_ALL','HOME','GIT_CONFIG_NOSYSTEM','GIT_CONFIG_SYSTEM','GIT_CONFIG_GLOBAL','GIT_CONFIG_COUNT','GIT_OPTIONAL_LOCKS','GIT_NO_REPLACE_OBJECTS','GIT_NO_LAZY_FETCH','GIT_TERMINAL_PROMPT','GIT_ATTR_NOSYSTEM','GIT_PAGER']);check(Object.values(e).every(x=>typeof x==='string'));return Object.freeze({...r,args:strings(r.args),env:Object.freeze(e),stdio:strings(r.stdio)}) as Command;}
const same=(a:Record<string,any>,b:Record<string,any>,keys:readonly string[]=statKeys)=>keys.every(k=>a[k]===b[k]);
function nativeSystem():Tc01DependencyNativeSystem {
 const project=(s:fs.Stats)=>Object.fromEntries(statKeys.map(k=>[k,s[k]]));
 return {context:()=>({platform:process.platform,uid:process.getuid?.()}),lstat:p=>project(fs.lstatSync(p)),fstat:n=>project(fs.fstatSync(n)),realpath:p=>fs.realpathSync(p),
  mkdir:(p,mode)=>fs.mkdirSync(p,{mode}),open:(p,kind,mode)=>{const c=fs.constants;check(c.O_NOFOLLOW>0&&c.O_NONBLOCK>0&&c.O_DIRECTORY>0);return fs.openSync(p,c.O_NOFOLLOW|c.O_NONBLOCK|(kind==='CREATE'?c.O_WRONLY|c.O_CREAT|c.O_EXCL:c.O_RDONLY)|(kind==='DIRECTORY'?c.O_DIRECTORY:0),mode);},
  read:(n,b,o,l,p)=>fs.readSync(n,b,o,l,p),sync:n=>fs.fsyncSync(n),close:n=>fs.closeSync(n),
  readdir:(p,limit)=>{const d=fs.opendirSync(p,{bufferSize:1}),out:string[]=[];try{while(out.length<limit){const e=d.readSync();if(e===null)break;out.push(e.name);}return out;}finally{d.closeSync();}},
  // timeout/killSignal은 넣지 않는다. 원 수거기의 유한 timer는 UNKNOWN만 만들고 원 child는 감독이 보존한다.
  spawn:c=>spawn(c.file,[...c.args],{cwd:c.cwd,env:{...c.env},shell:false,stdio:['ignore','pipe','pipe']}),
  umask:v=>v===undefined?process.umask():process.umask(v),setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:h=>clearTimeout(h as ReturnType<typeof setTimeout>)};
}
/** import/factory 효과0. 명시 감독이 실제 권위를 보유한 경우에만 기존 entry/intake에 공급한다.
 * NOFOLLOW/원 fd finally-close/부모 pin 방식은 기존 preload/native와 동일하다.
 * createSubnetNativeIdentity의 fingerprint는 root-owned0755 도구용이며 여기서 uid1000 설치 파일에 적용하지 않는다.
 * 도구·버전·Git/lock/승인 원문 검산은 controller 책임이고 합성 void는 운영 권위가 아니다.
 * preparation의 withCurrentNpmUmask와 원 stdout/stderr/exit/close/600초 수거를 재사용한다.
 * 대기 수거 handle은 원 process가 아니다. start에서 원 ChildProcess/streams를 한 번 캡처해 중계하며,
 * 외부 retainChild는 실패/시간초과 뒤 원 자원 보존을 책임진다. dispose는 자기 관측 listener/timer만 해제한다.
 * UNKNOWN 뒤 원 child/stream error sink 최대3개+원 close listener1개는 원 close까지 남는다.
 * 이 bounded 잔여는 프로세스 종료/회수를 증명하지 않는다. 강제 종료와 외부 감독 수명은 이 코드 밖이다. */
export function createTc01DependencyNativePorts(input:unknown,controller:Tc01DependencyNativeController,injected?:Tc01DependencyNativeSystem){
 const b=Object.freeze(record(input,bindingKeys)) as Binding;
 check(typeof b.attemptId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(b.attemptId)&&typeof b.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(b.sourceHead)&&typeof b.lockSha256==='string'&&/^[a-f0-9]{64}$/.test(b.lockSha256)&&Number.isSafeInteger(b.issuedAt)&&b.issuedAt>=0&&Number.isSafeInteger(b.expiresAt)&&b.expiresAt>b.issuedAt&&b.expiresAt-b.issuedAt<=1800000);
 const system=injected??nativeSystem(),c=record(controller,controllerKeys),io=record(system,ioKeys);check(controllerKeys.every(k=>typeof c[k]==='function')&&ioKeys.every(k=>typeof io[k]==='function'));
 const root='/home/daon/anvil-fn03-tc01-'+b.attemptId+'-qa',receipt='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+b.attemptId,prep=receipt+'-dependency-preparation',configs=[prep+'/npm-user.conf',prep+'/npm-global.conf'],cache=prep+'/npm-cache';
 const pins=new Map<string,Record<string,any>>(),fds=new Set<number>(),timers=new Set<unknown>(),listeners:{target:EventEmitter;event:string;fn:(...a:any[])=>void}[]=[];
 let dead=false,prepared=false,before=false,beforeStart=false,after=false,taken=false,started=false,wall=-1,mono=-1,until=Infinity,request:Readonly<Record<string,unknown>>|undefined,command:Command|undefined,commandOwner:unknown;
 let outEnd=false,errEnd=false,exited=false,normalClosed=false,maskStage=0,originalMask=0;
 let original:EventEmitter|undefined,out:EventEmitter|undefined,err:EventEmitter|undefined;
 const safety:{target:EventEmitter;event:string;fn:(...a:any[])=>void}[]=[];
 const pending=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter()});
 const detach=()=>{for(const l of listeners.splice(0))EventEmitter.prototype.removeListener.call(l.target,l.event,l.fn);};
 const clock=()=>{const w=c.now.call(controller),m=c.monotonic.call(controller);check(Number.isSafeInteger(w)&&w>=b.issuedAt&&w>=wall&&w<b.expiresAt&&Number.isSafeInteger(m)&&m>=0&&m>=mono&&m<until);if(until===Infinity)until=m+b.expiresAt-w;wall=w;mono=m;};
 const guard=()=>{try{check(!dead);const cc=record(controller,controllerKeys),ii=record(system,ioKeys);check(controllerKeys.every(k=>cc[k]===c[k])&&ioKeys.every(k=>ii[k]===io[k]));clock();check(c.assertCurrent.call(controller,b)===undefined);clock();const ctx=record(io.context.call(system),['platform','uid']);check(ctx.platform==='linux'&&ctx.uid===1000);}catch{dead=true;fail();}};
 const call=(k:typeof ioKeys[number],...args:any[])=>{guard();const r=io[k].apply(system,args);guard();return r;};
 const pin=(path:string)=>{let cur='';for(const segment of path.split('/').filter(Boolean)){cur+='/'+segment;const s=stat(call('lstat',cur));check((s.mode&0o170000)===0o040000&&[0,1000].includes(s.uid)&&!(s.mode&0o022));if(cur===root||cur===prep||cur===cache)check(s.uid===1000&&(s.mode&0o7777)===0o700);const prior=pins.get(cur);check(!prior||same(prior,s,parentKeys));pins.set(cur,s);}check(call('realpath',path)===path);};
 const absent=(path:string)=>{guard();try{io.lstat.call(system,path);}catch(e){check(e!==null&&typeof e==='object'&&Object.getOwnPropertyDescriptor(e,'code')?.value==='ENOENT');guard();return;}fail();};
 const open=(path:string,kind:OpenKind,mode?:number)=>{guard();const fd=io.open.call(system,path,kind,mode);check(Number.isSafeInteger(fd)&&fd>=0&&!fds.has(fd));fds.add(fd);return fd;};
 const close=(fd:number)=>{check(fds.delete(fd));check(io.close.call(system,fd)===undefined);};
 const syncDir=(path:string)=>{const fd=open(path,'DIRECTORY');try{guard();check(same(pins.get(path)!,stat(call('fstat',fd)),parentKeys));check(call('sync',fd)===undefined);}finally{close(fd);}};
 const verifyPrepared=()=>{pin(prep);pin(cache);for(const path of [prep,cache]){const s=stat(call('lstat',path));check(s.uid===1000&&(s.mode&0o7777)===0o700);}for(const path of configs){const s=stat(call('lstat',path));check((s.mode&0o170000)===0o100000&&s.uid===1000&&s.nlink===1&&s.size===0&&(s.mode&0o7777)===0o600&&call('realpath',path)===path);const prior=pins.get(path);check(!prior||same(prior,s));pins.set(path,s);}};
 const checkRequest=(r:Readonly<Record<string,unknown>>)=>{check(r.recipe==='TC01_DEPENDENCY_RECIPE_CANDIDATE_V1'&&same(record(r.binding,bindingKeys),b)&&r.sourceRoot===root&&r.preparationRoot===prep&&r.cache===cache&&canonicalJson(r.configs)===canonicalJson(configs)&&canonicalJson(r.requiredAbsent)===canonicalJson([receipt,'/tmp/fn03-tc01-'+b.attemptId])&&r.uid===1000&&r.cacheMode===0o700&&r.configMode===0o600&&r.configBytes===0);};
 const ports:Tc01DependencyIntakePorts={now:()=>c.now.call(controller),monotonic:()=>c.monotonic.call(controller),assertApproved:r=>{guard();checkRequest(r);request=r;},
  verify:r=>{guard();checkRequest(r);check(request);if(r.phase==='AFTER_CLOSE')check(started&&normalClosed);check(c.verify.call(controller,r)===undefined);guard();pin(root);pin(posix.dirname(prep));absent(receipt);absent('/tmp/fn03-tc01-'+b.attemptId);absent(root+'/.npmrc');
   if(r.phase==='BEFORE_PREPARE'){check(!before&&!prepared&&!taken);absent(prep);absent(root+'/node_modules');before=true;}
   else if(r.phase==='BEFORE_START'){check(prepared&&!taken);verifyPrepared();absent(root+'/node_modules');beforeStart=true;}
   else{check(r.phase==='AFTER_CLOSE'&&started&&normalClosed);verifyPrepared();after=true;}guard();},
  prepare:r=>{guard();checkRequest(r);check(before&&!prepared&&!taken);prepared=true;pin(posix.dirname(prep));absent(prep);check(call('mkdir',prep,0o700)===undefined);pin(prep);syncDir(posix.dirname(prep));check(call('mkdir',cache,0o700)===undefined);pin(cache);
   for(const path of configs){const fd=open(path,'CREATE',0o600);try{guard();const s=stat(call('fstat',fd));check((s.mode&0o170000)===0o100000&&s.uid===1000&&s.nlink===1&&s.size===0&&(s.mode&0o7777)===0o600);check(call('sync',fd)===undefined);check(same(s,stat(call('fstat',fd)))&&same(s,stat(call('lstat',path)))&&call('realpath',path)===path);}finally{close(fd);}}syncDir(prep);verifyPrepared();},
  takeChild:input=>{const value=ownCommand(input);guard();check(beforeStart&&prepared&&!taken&&request);const expectedArgs=[currentProfile.npm,'ci','--ignore-scripts','--no-audit','--no-fund','--bin-links=false','--omit=dev','--include=optional','--userconfig='+configs[0],'--globalconfig='+configs[1],'--cache='+cache,'--registry=https://registry.npmjs.org/'];
   check(value.file===currentProfile.node&&value.cwd===root&&value.shell===false&&canonicalJson(value.args)===canonicalJson(expectedArgs)&&canonicalJson(value.stdio)==='["ignore","pipe","pipe"]'&&value.maxOutputBytes===65536&&Number.isSafeInteger(value.timeoutMs)&&value.timeoutMs>0&&value.timeoutMs<=600000);
   const env={PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:prep,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_PAGER:'cat'};check(canonicalJson(value.env)===canonicalJson(env));taken=true;command=value;commandOwner=input;return pending;},
  start:(handle,value)=>{check(!dead&&beforeStart&&taken&&!started&&handle===pending&&value===commandOwner&&command&&canonicalJson(ownCommand(value))===canonicalJson(command));guard();check(pending.listenerCount('close')>0&&timers.size===1&&maskStage===2);started=true;
   check(c.verify.call(controller,Object.freeze({...request,phase:'BEFORE_START'}))===undefined);guard();pin(root);pin(posix.dirname(prep));verifyPrepared();absent(receipt);absent('/tmp/fn03-tc01-'+b.attemptId);absent(root+'/node_modules');absent(root+'/.npmrc');guard();
   const raw=io.spawn.call(system,command);check(raw instanceof EventEmitter&&!types.isProxy(raw));original=raw;
   const stream=(key:string)=>{const d=Object.getOwnPropertyDescriptor(raw,key);check(d&&'value'in d&&d.value instanceof EventEmitter&&!types.isProxy(d.value));return d.value as EventEmitter;};
   const listen=(target:EventEmitter,event:string,fn:(...a:any[])=>void)=>{listeners.push({target,event,fn});EventEmitter.prototype.on.call(target,event,fn);};
   // 원 error는 밖으로 원문을 내보내지 않는다. exact 원 handle 인계는 guard 후 검사보다 먼저다.
   const safe=(target:EventEmitter,event:string,fn:(...a:any[])=>void)=>{safety.push({target,event,fn});EventEmitter.prototype.on.call(target,event,fn);};
   safe(raw,'error',()=>{});safe(raw,'close',()=>{for(const l of safety.splice(0))EventEmitter.prototype.removeListener.call(l.target,l.event,l.fn);});
   const reject=()=>{dead=true;if(pending.listenerCount('error'))pending.emit('error',Error('TC01_DEPENDENCY_NATIVE_UNKNOWN'));};
   listen(raw,'error',reject);
   let handed=false;const handoff=()=>{handed=true;check(c.retainChild.call(controller,raw)===undefined);};
   try{out=stream('stdout');safe(out,'error',()=>{});err=stream('stderr');check(out!==err&&out!==raw&&err!==raw);safe(err,'error',()=>{});
    for(const [source,target]of [[out,pending.stdout],[err,pending.stderr]] as const)for(const event of ['data','end','error','close'])listen(source,event,(...a)=>{if(dead)return;try{guard();check(stream('stdout')===out&&stream('stderr')===err);if(event==='error')return reject();if(event==='end'){check(source===out?!outEnd:!errEnd);if(source===out)outEnd=true;else errEnd=true;}target.emit(event,...a);}catch{reject();}});
    listen(raw,'exit',(code,signal)=>{if(dead)return;try{guard();check(!exited&&code===0&&signal===null);exited=true;pending.emit('exit',code,signal);}catch{reject();}});
    listen(raw,'close',(code,signal)=>{try{if(!dead){guard();check(exited&&outEnd&&errEnd&&code===0&&signal===null);normalClosed=true;pending.emit('close',code,signal);}}catch{reject();}finally{detach();}});handoff();guard();
   }catch{if(!handed)try{handoff();}catch{}dead=true;fail();}},
  umask:v=>{if(maskStage===2){check(v===originalMask);maskStage=3;return io.umask.call(system,v);}guard();check(taken&&!started);if(maskStage===0){check(v===undefined);originalMask=io.umask.call(system);check(Number.isInteger(originalMask)&&originalMask>=0&&originalMask<=0o777);maskStage=1;return originalMask;}check(maskStage===1&&v===(originalMask|0o077));maskStage=2;return io.umask.call(system,v);},setTimeout:(fn,ms)=>{guard();check(timers.size===0&&ms>0&&ms<=600000);const h=io.setTimeout.call(system,()=>{dead=true;fn();},ms);check(h!==undefined&&h!==null);timers.add(h);return h;},clearTimeout:h=>{check(timers.delete(h));check(io.clearTimeout.call(system,h)===undefined);},
  assertCurrent:r=>{guard();check(after&&r.attemptId===b.attemptId&&r.sourceHead===b.sourceHead&&r.packageLockSha256===b.lockSha256&&r.issuedAt===b.issuedAt&&r.expiresAt===b.expiresAt);},
 };
 const path=(p:string,metadata=false)=>{check(after&&typeof p==='string'&&posix.normalize(p)===p&&(p===root||p.startsWith(root+'/node_modules/')||p===root+'/node_modules'||metadata&&root.startsWith(p+'/')));};
 const files:Tc01PreloadFilesPort={context:()=>{guard();check(after);return call('context');},lstat:p=>{path(p,true);return call('lstat',p);},realpath:p=>{path(p,true);return call('realpath',p);},
  open:p=>{path(p);return open(p,'READ');},fstat:n=>{check(fds.has(n));return call('fstat',n);},read:(n,buf,o,l,p)=>{check(fds.has(n));return call('read',n,buf,o,l,p);},close,
  readdir:(p,limit)=>{path(p);check(Number.isSafeInteger(limit)&&limit>0&&limit<=20001);return call('readdir',p,limit);}};
 return Object.freeze({ports:Object.freeze(ports),files:Object.freeze(files),dispose:()=>{dead=true;detach();for(const h of [...timers]){timers.delete(h);io.clearTimeout.call(system,h);}/* 원 child/원 경로는 삭제하거나 종료하지 않는다. */void original;}});
}
