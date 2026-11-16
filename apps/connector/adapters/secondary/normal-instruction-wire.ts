import {runNormalFirstSend,runNormalLiveSend,liveSendParent,type LiveInputPort,type NormalFirstSendSource,type FirstSendCompletion,type LiveSendCompletion} from '../../runtime/normal-first-send-owner.ts';
import type {NormalStartWire} from '../../runtime/normal-start-coordinator.ts';
import {isProxy} from 'node:util/types';
import {recordV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {captureInstructionInput} from '../../runtime/normal-instruction-intake.ts';
import {claimNormalInstructionDispatch,type NormalInstructionDriverInput,type NormalInstructionObservation,type NormalInstructionWirePort} from '../../runtime/normal-instruction-coordinator.ts';
export interface NormalInstructionDriver{send(input:NormalInstructionDriverInput,signal:AbortSignal):Promise<NormalInstructionObservation>}
const firstMode=Symbol('first-send');
const firstWires=new WeakMap<object,{worker:NormalStartWire;source:NormalFirstSendSource;port?:LiveInputPort}>();
const firstResults=new WeakMap<object,{wire:object;token:object;completion:FirstSendCompletion|LiveSendCompletion}>();
export const isNormalFirstSendWire=(wire:object)=>firstWires.has(wire);
export function normalWireLiveParent(wire:object){const first=firstWires.get(wire);return first?liveSendParent(first.worker,wire):null;}
export function consumeNormalFirstSendResult(wire:object,capability:object,value:unknown){
 const stored=firstResults.get(capability);
 if(!stored||stored.wire!==wire||stored.token!==value)return fail();
 firstResults.delete(capability);return stored.completion;
}
export function abandonNormalFirstSendResult(capability:object){
 const stored=firstResults.get(capability);if(stored){firstResults.delete(capability);stored.completion.abandon();}
}
const issuedWires=new WeakSet<object>();
function fail(code='NORMAL_INSTRUCTION_WIRE_UNAVAILABLE'):never{throw Error(code);}
/** SEND 전용 원문 전달 경계. SDK/Query/session owner 생산자 및 기본 driver를 제공하지 않는다. */
export class NormalInstructionWire implements NormalInstructionWirePort{
 readonly transport='NORMAL_PROTECTED' as const;
 #driver?:NormalInstructionDriver;#send?:NormalInstructionDriver['send'];#busy=false;#unknown=false;
 static forFirstSend(worker:NormalStartWire,source:NormalFirstSendSource,port?:LiveInputPort){
  return new NormalInstructionWire({worker,source,port},firstMode);
 }
 constructor(ports:{driver:NormalInstructionDriver});
 constructor(ports:{worker:NormalStartWire;source:NormalFirstSendSource;port?:LiveInputPort},mode:typeof firstMode);
 constructor(ports:{driver:NormalInstructionDriver}|{worker:NormalStartWire;source:NormalFirstSendSource;port?:LiveInputPort},mode?:typeof firstMode){
  if(mode===firstMode&&'worker' in ports){firstWires.set(this,{worker:ports.worker,source:ports.source,port:ports.port});issuedWires.add(this);return;}
  if(!ports||isProxy(ports)||!recordV1(ports,['driver'])||!('driver' in ports)||!ports.driver||isProxy(ports.driver)||!recordV1(ports.driver,['send'])||typeof ports.driver.send!=='function')fail('NORMAL_INSTRUCTION_DRIVER_REQUIRED');
  this.#driver=ports.driver;this.#send=ports.driver.send;issuedWires.add(this);
 }
 async send(capability:object,signal:AbortSignal):Promise<unknown>{
  if(this.#busy)fail('NORMAL_INSTRUCTION_WIRE_BUSY');if(this.#unknown)fail('NORMAL_INSTRUCTION_WIRE_UNKNOWN');
  if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
  const original=claimNormalInstructionDispatch(capability,signal);this.#busy=true;let entered=false,timer:ReturnType<typeof setTimeout>|undefined,listener=()=>{};
  const child=new AbortController(),check=()=>{if(signal.aborted||child.signal.aborted||(this.#driver&&Object.getOwnPropertyDescriptor(this.#driver,'send')?.value!==this.#send)||original.remaining()<=0)fail();};
  const cancelled=new Promise<never>((_,reject)=>{listener=()=>{child.abort();reject(Error('NORMAL_INSTRUCTION_WIRE_UNKNOWN'));};signal.addEventListener('abort',listener,{once:true});});
  try{
   check();timer=setTimeout(listener,Math.max(1,Math.ceil(original.remaining())));
   await Promise.race([original.verify(),cancelled]);check();
   clearTimeout(timer);timer=setTimeout(listener,Math.max(1,Math.ceil(original.remaining())));
   const input=original.input;
   // 원 coordinator가 만든 단발 객체만 받는다. 역사 시각의 schema/hash 검산과 현재 기한 검사는 분리한다.
   const e=readDispatchEnvelopeV1(input.envelope,Date.parse(input.envelope.issuedAt));if(e.operation!=='SEND_INSTRUCTION'||input.executionAuthorized!==false||input.actualExecutionVerified!==false)fail();
   const first=firstWires.get(this);
   if(first){
    entered=true;
    const completion=normalWireLiveParent(this)?await runNormalLiveSend(first.worker,this,original,child.signal):await runNormalFirstSend(first.worker,original,first.source,child.signal,this,first.port);
    try{check();const token=Object.freeze(Object.create(null) as object);firstResults.set(capability,{wire:this,token,completion});return token;}
    catch(error){completion.abandon();throw error;}
   }
   const driver=this.#driver,send=this.#send;if(!driver||!send)return fail();
   const run=Promise.resolve().then(()=>{check();entered=true;return send.call(driver,input,child.signal);});
   const result=captureInstructionInput(await Promise.race([run,cancelled]));check();
   if(!recordV1(result,['transport','responseRef','processRef'])||result.transport!=='NORMAL_PROTECTED'||!refV1(result.responseRef)||result.processRef!==null&&!refV1(result.processRef))fail('NORMAL_INSTRUCTION_RESPONSE_INVALID');
   return result;
  }catch(error){if(entered||signal.aborted||child.signal.aborted)this.#unknown=true;throw error;}
  finally{child.abort();clearTimeout(timer);signal.removeEventListener('abort',listener);this.#busy=false;original.input.instruction.bytes.fill(0);}
 }
}

const originalSend=NormalInstructionWire.prototype.send;
/** 닫힌 내부 instance 검사다. 반환값/JSON/공개 claim 호출은 새 wire를 발급하지 않는다. */
export function isNormalInstructionWire(value:unknown):value is NormalInstructionWire{
 if(!value||typeof value!=='object'||isProxy(value)||!issuedWires.has(value)||Object.getPrototypeOf(value)!==NormalInstructionWire.prototype)return false;
 const own=Object.getOwnPropertyDescriptor(value,'send');
 return Object.getOwnPropertyDescriptor(NormalInstructionWire.prototype,'send')?.value===originalSend&&(!own||own.value===originalSend)&&
  Object.getOwnPropertyDescriptor(value,'transport')?.value==='NORMAL_PROTECTED';
}
