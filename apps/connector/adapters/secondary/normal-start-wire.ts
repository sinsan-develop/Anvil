import {isProxy,isUint8Array} from 'node:util/types';
import {canonicalJson,parseWireJson} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,isoV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {NormalStartIntake} from '../../runtime/normal-start-intake.ts';
import type {NormalStartWire,NormalStartCurrent} from '../../runtime/normal-start-coordinator.ts';
import {readClaudeQueryParams} from './start-options.ts';
type Input=Parameters<NormalStartWire['send']>[0];
type Observation={transport:'NORMAL_PROTECTED';responseRef:Ref;processRef:Ref|null};
export type NormalClaudeDriverRequest=Input&{params:ReturnType<typeof readClaudeQueryParams>;actualExecutionVerified:false;executionAuthorized:false};
/** 공급자가 실제 OS/SDK·도구·SID 권위를 마련하기 전에는 등록하지 않는다. 합성 driver는 관측 ref만 반환한다. */
export interface NormalClaudeDriver{send(value:NormalClaudeDriverRequest,signal:AbortSignal):Promise<Observation>}
type Ports={intake:NormalStartIntake;current:NormalStartCurrent;grantRef:Ref;driver:NormalClaudeDriver;clock:()=>number;timeoutMs:number};
const originalMaterials=NormalStartIntake.prototype.startMaterials;
const fail=(code='NORMAL_CLAUDE_START_UNAVAILABLE'):never=>{throw Error(code);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function material<T extends Input['contextBundle']|Input['options']>(v:T):T{
 if(!v||isProxy(v))return fail();
 const d=Object.getOwnPropertyDescriptor(v,'bytes');
 if(!d||!('value'in d)||isProxy(d.value)||!isUint8Array(d.value)||d.value.byteLength<1||d.value.byteLength>2097152)return fail();
 const meta:Record<string,unknown>={};for(const key of Object.keys(v)){if(key==='bytes')continue;const p=Object.getOwnPropertyDescriptor(v,key);if(!p||!('value'in p))return fail();meta[key]=p.value;}
 return {...cloneV1(meta),bytes:new Uint8Array(d.value)} as T;
}
/** normal coordinator의 원 START/permit/attempt 소비 경계. 새 admission이나 SDK 실행 정책이 아니다.
 * 메모리 재호출 방어는 내구 journal을 대신하지 않는다. 재시작은 기존 coordinator가 소유한다. */
export class NormalClaudeStartWire implements NormalStartWire{
 readonly transport='NORMAL_PROTECTED' as const;
 #p:Ports;#read=originalMaterials;#current:NormalStartCurrent['current'];#send:NormalClaudeDriver['send'];
 #used=new Set<string>();#busy=false;#unknown=false;#last=-Infinity;
 constructor(p:Ports){
  if(!p||isProxy(p)||!recordV1(p,['intake','current','grantRef','driver','clock','timeoutMs'])||
   isProxy(p.intake)||Object.getPrototypeOf(p.intake)!==NormalStartIntake.prototype||p.intake.startMaterials!==originalMaterials||
   !p.current||isProxy(p.current)||p.current.transport!=='NORMAL_PROTECTED'||typeof p.current.current!=='function'||
   !p.driver||isProxy(p.driver)||typeof p.driver.send!=='function'||!refV1(p.grantRef)||typeof p.clock!=='function'||
   !Number.isSafeInteger(p.timeoutMs)||p.timeoutMs<1||p.timeoutMs>10000)fail('NORMAL_CLAUDE_PORTS_REQUIRED');
  this.#p={...p,grantRef:cloneV1(p.grantRef)};this.#current=p.current.current;this.#send=p.driver.send;
 }
 #now(){const n=this.#p.clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime())||n<this.#last)return fail();this.#last=n;return n;}
 #ports(){if(this.#p.intake.startMaterials!==this.#read||NormalStartIntake.prototype.startMaterials!==this.#read||this.#p.current.current!==this.#current||this.#p.driver.send!==this.#send)fail();}
 async send(raw:Input,signal:AbortSignal):Promise<Observation>{
  if(this.#busy)fail('NORMAL_CLAUDE_BUSY');if(this.#unknown)fail('NORMAL_CLAUDE_UNKNOWN');
  if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_CLAUDE_CANCELLED');
  if(!recordV1(raw,['envelope','contextBundle','options','localAttemptRef','permit']))fail();
  const e=readDispatchEnvelopeV1(cloneV1(raw.envelope),this.#now()),attempt=cloneV1(raw.localAttemptRef),permit=cloneV1(raw.permit);
  if(e.operation!=='START_SESSION'||!refV1(attempt)||attempt.version!==1||
   !recordV1(permit,['ref','commandId','envelopeHash','issuedAt','expiresAt'])||!refV1(permit.ref)||permit.ref.version!==1||
   permit.commandId!==e.commandId||permit.envelopeHash!==e.envelopeHash||!isoV1(permit.issuedAt)||!isoV1(permit.expiresAt)||
   Date.parse(permit.issuedAt)>this.#now()||Date.parse(permit.expiresAt)<=this.#now()||Date.parse(permit.expiresAt)>Date.parse(permit.issuedAt)+30000)fail();
  const input:Input={envelope:e,localAttemptRef:attempt,permit,contextBundle:material(raw.contextBundle),options:material(raw.options)};
  if(this.#used.has(e.commandId))fail('NORMAL_CLAUDE_ALREADY_ATTEMPTED');
  this.#busy=true;
  let deadline=Math.min(Date.parse(e.expiresAt),Date.parse(permit.expiresAt),this.#now()+this.#p.timeoutMs);
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,entered=false,listener=()=>{};
  const guard=()=>{this.#ports();if(controller.signal.aborted||signal.aborted||this.#now()>=deadline)fail('NORMAL_CLAUDE_EXPIRED');};
  const cancelled=new Promise<never>((_,reject)=>{listener=()=>{controller.abort();reject(Error('NORMAL_CLAUDE_CANCELLED'));};signal.addEventListener('abort',listener,{once:true});timer=setTimeout(listener,Math.max(0,deadline-this.#now()));});
  const work=Promise.resolve().then(async()=>{
   guard();const original=await Reflect.apply(this.#read,this.#p.intake,[cloneV1(e)]);guard();
   for(const key of ['contextBundle','options'] as const){const a=input[key],b=original[key];if(!same({...a,bytes:null},{...b,bytes:null})||!Buffer.from(a.bytes).equals(Buffer.from(b.bytes)))fail('NORMAL_CLAUDE_MATERIAL_CHANGED');}
   const bytes=input.options.bytes;if(bytes[0]===239&&bytes[1]===187&&bytes[2]===191)fail();
   const params=readClaudeQueryParams(parseWireJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)));
   const v:any=cloneV1(await Reflect.apply(this.#current,this.#p.current,[cloneV1(e),cloneV1(attempt),controller.signal]));guard();
   const refs=[...new Map(e.context.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()];
   if(!recordV1(v,['transport','key','envelopeHash','grantRef','localAttemptRef','sourceObservationRefs','osOwnershipRef','checkedAt','expiresAt'])||v.transport!=='NORMAL_PROTECTED'||
    !same(v.key,receiptKeyV1(e))||v.envelopeHash!==e.envelopeHash||!same(v.grantRef,this.#p.grantRef)||!same(v.localAttemptRef,attempt)||!same(v.sourceObservationRefs,refs)||!refV1(v.osOwnershipRef)||
    !isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>this.#now()||this.#now()-Date.parse(v.checkedAt)>30000||Date.parse(v.expiresAt)>Date.parse(v.checkedAt)+30000)fail('NORMAL_CLAUDE_CURRENT_INVALID');
   deadline=Math.min(deadline,Date.parse(v.expiresAt));guard();
   // 더 짧아진 보호 관측 기한을 진행 중 driver의 취소에도 반영한다.
   if(timer!==undefined)clearTimeout(timer);timer=setTimeout(listener,Math.max(0,deadline-this.#now()));
   this.#used.add(e.commandId);entered=true;
   const out=await Reflect.apply(this.#send,this.#p.driver,[{...input,params,actualExecutionVerified:false,executionAuthorized:false},controller.signal]);guard();
   const result=cloneV1(out);if(!recordV1(result,['transport','responseRef','processRef'])||result.transport!=='NORMAL_PROTECTED'||!refV1(result.responseRef)||result.processRef!==null&&!refV1(result.processRef))fail('NORMAL_CLAUDE_OBSERVATION_INVALID');
   return result as Observation;
  });
  try{return await Promise.race([work,cancelled]);}catch(error){if(entered||controller.signal.aborted)this.#unknown=true;throw error;}
  finally{controller.abort();if(timer!==undefined)clearTimeout(timer);signal.removeEventListener('abort',listener);this.#busy=false;}
 }
}
