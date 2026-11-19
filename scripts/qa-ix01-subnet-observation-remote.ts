import {EventEmitter} from 'node:events';
import {types} from 'node:util';
import {observeSubnetOnHostAsync,type SubnetHostPorts,type SubnetHostCommandOptions} from './qa-ix01-subnet-observation-host.ts';
import type {SubnetCandidateResult} from './qa-ix01-subnet-candidate.ts';

type Proof=Readonly<{attemptId:string;bundleHash:string;approvalHash:string}>;
type Window=Readonly<{issuedAt:number;expiresAt:number}>;
export type SubnetRemoteEnvelope=Readonly<Proof&Window&{schemaVersion:1;purpose:'IX01_SUBNET_REMOTE_COMPLETION';completion:'DIRECT_CHILDREN_CLOSED';result:SubnetCandidateResult}>;
export interface SubnetDirectChildPorts{
 start(file:string,args:readonly string[],options:SubnetHostCommandOptions):unknown;
 requestTermination(original:object):void;
 setTimeout(callback:()=>void,ms:number):unknown;clearTimeout(handle:unknown):void;
}
const unknown=Object.freeze({code:'UNKNOWN'} as const),on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
const started=new WeakSet<object>();
const typedArrayPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const byteLength=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength')!.get!;
const backing=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer')!.get!;
function fields(value:unknown,names:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||types.isProxy(value)||Reflect.ownKeys(value).length!==names.length)throw null;
 const result:Record<string,unknown>=Object.create(null);
 for(const name of names){const d=Object.getOwnPropertyDescriptor(value,name);if(!d||!Object.hasOwn(d,'value'))throw null;result[name]=d.value;}return result;
}
function proofOf(value:unknown):Proof{
 const p=fields(value,['attemptId','bundleHash','approvalHash']);
 if(typeof p.attemptId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.attemptId)
  ||[p.bundleHash,p.approvalHash].some(v=>typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v)))throw null;
 return Object.freeze(p as Proof);
}
function windowOf(value:unknown):Window{
 const p=fields(value,['issuedAt','expiresAt']);
 if(typeof p.issuedAt!=='number'||typeof p.expiresAt!=='number'||!Number.isSafeInteger(p.issuedAt)||!Number.isSafeInteger(p.expiresAt)||p.issuedAt<=0||p.expiresAt<=p.issuedAt||p.expiresAt-p.issuedAt>60_000)throw null;
 return Object.freeze(p as Window);
}
export function readSubnetCompletionBinding(proof:unknown,window:unknown){return Object.freeze({proof:proofOf(proof),window:windowOf(window)});}
/** 데이터 검산일 뿐 원격 신원/실행 승인 증명이 아니다. 원 고정 연결의 소유자가 교차 대조해야 한다. */
export function readSubnetRemoteEnvelope(raw:unknown,proof:unknown,window:unknown):SubnetRemoteEnvelope{
 const p=proofOf(proof),w=windowOf(window),v=fields(raw,['schemaVersion','purpose','completion','attemptId','bundleHash','approvalHash','issuedAt','expiresAt','result']);
 if(v.schemaVersion!==1||v.purpose!=='IX01_SUBNET_REMOTE_COMPLETION'||v.completion!=='DIRECT_CHILDREN_CLOSED'
  ||Object.keys(p).some(k=>v[k]!==p[k as keyof Proof])||v.issuedAt!==w.issuedAt||v.expiresAt!==w.expiresAt)throw null;
 const r=fields(v.result,(v.result&&typeof v.result==='object'&&!types.isProxy(v.result)&&Object.getOwnPropertyDescriptor(v.result,'code')?.value==='CANDIDATE')?['code','cidr']:['code']);
 if(r.code!=='NO_CANDIDATE'){
  if(r.code!=='CANDIDATE'||typeof r.cidr!=='string')throw null;
  const m=/^172\.(\d{2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\/28$/.exec(r.cidr);
  if(!m||m[0]!==r.cidr||Number(m[1])<16||Number(m[1])>31||Number(m[2])>254||Number(m[3])>240||Number(m[3])%16)throw null;
 }
 return Object.freeze({...p,...w,schemaVersion:1,purpose:'IX01_SUBNET_REMOTE_COMPLETION',completion:'DIRECT_CHILDREN_CLOSED',result:Object.freeze({...r}) as SubnetCandidateResult});
}

/** 명시 모의/후속 검수용 포트만 있다. 실제 spawn/kill/SSH/CLI 기본 구현은 없다.
 * 모든 도구 호출은 기존 host의 고정 검산 뒤 이 지역 execute로만 온다. 모의 신원/handle/완료는
 * 실제 운영 증명이 아니다. 미종결 handle은 포트 원 소유자가 보존해야 하며 여기서 삭제/재발급하지 않는다.
 */
export async function observeSubnetRemote(input:unknown,proof:unknown,identity:Omit<SubnetHostPorts,'execute'>,ports:SubnetDirectChildPorts):Promise<Readonly<{code:'REMOTE_COMPLETE';envelope:SubnetRemoteEnvelope}>|typeof unknown>{
 try{
  const p=proofOf(proof),binding=fields(input,['issuedAt','expiresAt','ip']),w=windowOf({issuedAt:binding.issuedAt,expiresAt:binding.expiresAt});
  const clocks=fields(identity,['now','monotonic','context','realpath','inspect','fingerprint']),operations=fields(ports,['start','requestTermination','setTimeout','clearTimeout']);
  for(const fn of [...Object.values(clocks),...Object.values(operations)])if(typeof fn!=='function'||types.isProxy(fn))return unknown;
  const call=(name:string,args:unknown[]=[])=>Reflect.apply(operations[name] as Function,ports,args);
  const now=()=>Reflect.apply(clocks.now as Function,identity,[]) as number,mono=()=>Reflect.apply(clocks.monotonic as Function,identity,[]) as number;
  const firstMono=mono();let lastWall=w.issuedAt,lastMono=firstMono,failed=false,count=0;
  const pending=new Set<EventEmitter>();
  const fresh=()=>{const wall=now(),tick=mono();if(!Number.isSafeInteger(wall)||wall<lastWall||wall>=w.expiresAt||!Number.isFinite(tick)||tick<lastMono||tick-firstMono>=60_000)throw null;lastWall=wall;lastMono=tick;return {wall,tick};};
  const execute=(file:string,args:readonly string[],options:SubnetHostCommandOptions):Promise<unknown>=>new Promise(resolve=>{
   let original:EventEmitter|undefined,stdout:EventEmitter|undefined,done=false,bad=false,ended=false,terminated=false;
   let timer:unknown,timerSet=false,size=0;const bytes=new Uint8Array(1_048_576),listeners:{target:EventEmitter;event:string;fn:(...args:any[])=>void}[]=[];
   const finish=(ok:boolean)=>{
    if(done)return;done=true;if(!ok)failed=true;
    let raw='';try{if(ok)raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(0,size));}catch{ok=false;failed=true;}
    bytes.fill(0);
    for(const {target,event,fn}of listeners)try{off.call(target,event,fn);}catch{ok=false;failed=true;}
    if(timerSet)try{call('clearTimeout',[timer]);}catch{ok=false;failed=true;}
    resolve({ok,stdout:ok?raw:''});
   };
   let end=0,monoEnd=0;
   const stop=()=>{
    if(done||bad)return;bad=true;failed=true;
    if(timerSet){try{call('clearTimeout',[timer]);}catch{/* 회수 불명 유지 */}timerSet=false;}
    let current=false;try{fresh();current=now()<end&&mono()<monoEnd;}catch{/* 원 기한 밖 종료 효과0 */}
    if(!current){finish(false);return;}
    if(original&&!terminated){terminated=true;try{call('requestTermination',[original]);}catch{/* 원문/종료 성공을 추정하지 않는다. */}}
    if(done)return;
    let rest=0;try{rest=Math.floor(Math.min(1000,end-now(),monoEnd-mono(),w.expiresAt-now()));}catch{/* 회수 불명 */}
    if(rest<=0){finish(false);return;}arm(()=>finish(false),rest,true);
   };
   const arm=(callback:()=>void,ms:number,reaping=false)=>{
    let registering=true,inline=false;
    try{timer=call('setTimeout',[()=>{if(registering){inline=true;return;}callback();},ms]);timerSet=true;registering=false;
     if(inline){try{call('clearTimeout',[timer]);}catch{/* 실패 유지 */}timerSet=false;if(reaping)finish(false);else stop();}
     else if(done){try{call('clearTimeout',[timer]);}catch{/* 실패 유지 */}timerSet=false;}
    }catch{registering=false;if(reaping)finish(false);else stop();}
   };
   const listen=(target:EventEmitter,event:string,action:(...args:any[])=>void)=>{const fn=(...values:any[])=>{if(done)return;try{action(...values);}catch{stop();}};listeners.push({target,event,fn});on.call(target,event,fn);};
   try{
    const before=fresh(),duration=Math.floor(Math.min(options.timeout,10_000,w.expiresAt-before.wall,60_000-(before.tick-firstMono)));
    if(failed||pending.size||duration<=1000){finish(false);return;}end=before.wall+duration;monoEnd=before.tick+duration;
    const child=call('start',[file,args,options]);
    if(!child||typeof child!=='object'||types.isProxy(child)||!(child instanceof EventEmitter)||started.has(child)){finish(false);return;}
    original=child;started.add(child);pending.add(child);count++;
    const pipe=Object.getOwnPropertyDescriptor(child,'stdout')?.value;
    if(!pipe||typeof pipe!=='object'||types.isProxy(pipe)||!(pipe instanceof EventEmitter)||pipe===child){stop();return;}
    stdout=pipe;
    listen(child,'error',stop);listen(stdout,'error',stop);
    listen(stdout,'data',(value:unknown)=>{
     fresh();if(bad||ended||now()>=end||mono()>=monoEnd){stop();return;}
     if(types.isProxy(value)||!types.isUint8Array(value)||types.isSharedArrayBuffer(backing.call(value))){stop();return;}
     const n=byteLength.call(value);if(n>Math.min(options.maxBuffer,bytes.length)-size){stop();return;}
     Uint8Array.prototype.set.call(bytes,value,size);size+=n;
    });
    listen(stdout,'end',()=>{if(ended){stop();return;}ended=true;});
    listen(child,'close',(code:unknown,signal:unknown)=>{
     pending.delete(child);let current=true;try{fresh();if(now()>=end||mono()>=monoEnd)current=false;}catch{current=false;}
     finish(!bad&&current&&code===0&&signal===null&&ended);
    });
    fresh();arm(stop,duration-1000);
   }catch{if(original)stop();else finish(false);}
  });
  const hostPorts={...clocks,execute} as unknown as SubnetHostPorts;
  const result=await observeSubnetOnHostAsync(input,hostPorts);fresh();
  if(failed||pending.size||count<5||result.code==='UNKNOWN')return unknown;
  const envelope=readSubnetRemoteEnvelope({...p,...w,schemaVersion:1,purpose:'IX01_SUBNET_REMOTE_COMPLETION',completion:'DIRECT_CHILDREN_CLOSED',result},p,w);
  return Object.freeze({code:'REMOTE_COMPLETE',envelope});
 }catch{return unknown;}
}
