import {spawn,ChildProcess} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {types} from 'node:util';
import {createSubnetNativeIdentity,type SubnetHostPorts} from './qa-ix01-subnet-observation-host.ts';
import {observeSubnetRemote,readSubnetCompletionBinding} from './qa-ix01-subnet-observation-remote.ts';

type Identity=Omit<SubnetHostPorts,'execute'>;
interface SpawnOptions{readonly cwd:'/';readonly env:Readonly<Record<string,string>>;readonly stdio:readonly ['ignore','pipe','ignore'];readonly shell:false;readonly windowsHide:true;}
/** 주입은 합성 검수용이며 운영 승인/도구 신원을 발급하지 않는다. */
export interface SubnetNativePorts{
 identity:Identity;
 spawn(file:string,args:readonly string[],options:SpawnOptions):unknown;
 terminate(original:object,signal:'SIGKILL'):unknown;
 setTimeout(callback:()=>void,ms:number):unknown;clearTimeout(handle:unknown):void;
}
const unknown=Object.freeze({code:'UNKNOWN'} as const),on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
const kill=ChildProcess.prototype.kill;
function fields(value:unknown,names:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||types.isProxy(value)||Reflect.ownKeys(value).length!==names.length)throw null;
 const out:Record<string,unknown>=Object.create(null);for(const name of names){const d=Object.getOwnPropertyDescriptor(value,name);if(!d||!Object.hasOwn(d,'value'))throw null;out[name]=d.value;}return out;
}
function nativePorts():SubnetNativePorts{
 return {identity:createSubnetNativeIdentity(),
  spawn:(file,args,options)=>spawn(file,[...args],{cwd:options.cwd,env:{...options.env},stdio:['ignore','pipe','ignore'],shell:false,windowsHide:true}),
  terminate:(original,signal)=>Reflect.apply(kill,original,[signal]),
  setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:handle=>clearTimeout(handle as ReturnType<typeof setTimeout>)};
}
/** 호출만 가능한 소스 어댑터. CLI/stdin/SSH/승인 발급·자동 실행은 없다.
 * 기존 host가 Linux·고정 Node/도구·환경·신원·닫힌 명령을 검산한 뒤에만 start에 도달한다.
 * 자동 spawn timeout은 사용하지 않는다. 기존 원격 감독이 남긴 수거 예산 안에서 원 객체에만
 * SIGKILL 요청 최대1회이며 반환값/exit 이벤트는 close 증거가 아니다.
 * 실제 호출에는 별도 고정 실행안·승인·원 연결 감독 및 미관측 ip 지문이 필요하다.
 */
export async function observeSubnetNative(input:unknown,proof:unknown,ports:SubnetNativePorts=nativePorts()){
 try{
  const supplied=fields(input,['issuedAt','expiresAt','ip']);
  const {window}=readSubnetCompletionBinding(proof,{issuedAt:supplied.issuedAt,expiresAt:supplied.expiresAt});
  const p=fields(ports,['identity','spawn','terminate','setTimeout','clearTimeout']);
  const identity=fields(p.identity,['now','monotonic','context','realpath','inspect','fingerprint']);
  for(const fn of [...Object.values(identity),p.spawn,p.terminate,p.setTimeout,p.clearTimeout])if(typeof fn!=='function'||types.isProxy(fn))return unknown;
  const invoke=(name:string,args:unknown[])=>Reflect.apply(p[name] as Function,ports,args);
  const now=()=>Reflect.apply(identity.now as Function,p.identity,[]) as number,mono=()=>Reflect.apply(identity.monotonic as Function,p.identity,[]) as number;
  const owned=new WeakMap<object,{closed:boolean;exited:boolean;requested:boolean;wall:number;mono:number;startWall:number;startMono:number}>();
  return await observeSubnetRemote(input,proof,p.identity as Identity,{
   start(file,args,options){
    const startWall=now(),startMono=mono();
    if(!Number.isSafeInteger(startWall)||startWall<window.issuedAt||startWall>=window.expiresAt||!Number.isFinite(startMono)||startMono<0)throw null;
    const child=invoke('spawn',[file,args,Object.freeze({cwd:options.cwd,env:options.env,stdio:options.stdio,shell:false,windowsHide:true})]);
    if(!child||typeof child!=='object'||types.isProxy(child)||!(child instanceof EventEmitter)||owned.has(child))throw null;
    const state={closed:false,exited:false,requested:false,wall:Math.min(window.expiresAt,startWall+options.timeout),mono:startMono+options.timeout,startWall,startMono};owned.set(child,state);
    // UNKNOWN 뒤 늦은 원 error는 원문 없이 소비한다. 원 close에서 자체 listener만 회수한다.
    const ignore=()=>{},stdout=Object.getOwnPropertyDescriptor(child,'stdout')?.value;
    on.call(child,'error',ignore);if(!types.isProxy(stdout)&&stdout instanceof EventEmitter)on.call(stdout,'error',ignore);
    const exited=()=>{state.exited=true;};on.call(child,'exit',exited);
    const closed=()=>{state.closed=true;off.call(child,'error',ignore);off.call(child,'exit',exited);off.call(child,'close',closed);if(!types.isProxy(stdout)&&stdout instanceof EventEmitter)off.call(stdout,'error',ignore);};
    on.call(child,'close',closed);return child;
   },
   requestTermination(original){
    const state=owned.get(original);if(!state||state.closed||state.exited||state.requested)throw null;
    const wall=now(),tick=mono();if(!Number.isSafeInteger(wall)||wall<state.startWall||wall>=state.wall||!Number.isFinite(tick)||tick<state.startMono||tick>=state.mono)throw null;
    state.requested=true;invoke('terminate',[original,'SIGKILL']);
   },
   setTimeout:(fn,ms)=>invoke('setTimeout',[fn,ms]),clearTimeout:handle=>{invoke('clearTimeout',[handle]);},
  });
 }catch{return unknown;}
}
