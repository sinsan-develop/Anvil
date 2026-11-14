import {isProxy} from 'node:util/types';
import {recordV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {captureInstructionInput} from '../../runtime/normal-instruction-intake.ts';
import {claimNormalInstructionDispatch,type NormalInstructionDriverInput,type NormalInstructionObservation,type NormalInstructionWirePort} from '../../runtime/normal-instruction-coordinator.ts';
export interface NormalInstructionDriver{send(input:NormalInstructionDriverInput,signal:AbortSignal):Promise<NormalInstructionObservation>}
const issuedWires=new WeakSet<object>();
function fail(code='NORMAL_INSTRUCTION_WIRE_UNAVAILABLE'):never{throw Error(code);}
/** SEND 전용 원문 전달 경계. SDK/Query/session owner 생산자 및 기본 driver를 제공하지 않는다. */
export class NormalInstructionWire implements NormalInstructionWirePort{
 readonly transport='NORMAL_PROTECTED' as const;
 #driver:NormalInstructionDriver;#send:NormalInstructionDriver['send'];#busy=false;#unknown=false;
 constructor(ports:{driver:NormalInstructionDriver}){
  if(!ports||isProxy(ports)||!recordV1(ports,['driver'])||!ports.driver||isProxy(ports.driver)||!recordV1(ports.driver,['send'])||typeof ports.driver.send!=='function')fail('NORMAL_INSTRUCTION_DRIVER_REQUIRED');
  this.#driver=ports.driver;this.#send=ports.driver.send;issuedWires.add(this);
 }
 async send(capability:object,signal:AbortSignal):Promise<NormalInstructionObservation>{
  if(this.#busy)fail('NORMAL_INSTRUCTION_WIRE_BUSY');if(this.#unknown)fail('NORMAL_INSTRUCTION_WIRE_UNKNOWN');
  if(!(signal instanceof AbortSignal)||signal.aborted)fail('NORMAL_INSTRUCTION_CANCELLED');
  const original=claimNormalInstructionDispatch(capability,signal);this.#busy=true;let entered=false,timer:ReturnType<typeof setTimeout>|undefined,listener=()=>{};
  const child=new AbortController(),check=()=>{if(signal.aborted||child.signal.aborted||Object.getOwnPropertyDescriptor(this.#driver,'send')?.value!==this.#send||original.remaining()<=0)fail();};
  const cancelled=new Promise<never>((_,reject)=>{listener=()=>{child.abort();reject(Error('NORMAL_INSTRUCTION_WIRE_UNKNOWN'));};signal.addEventListener('abort',listener,{once:true});});
  try{
   check();timer=setTimeout(listener,Math.max(1,Math.ceil(original.remaining())));
   await Promise.race([original.verify(),cancelled]);check();
   clearTimeout(timer);timer=setTimeout(listener,Math.max(1,Math.ceil(original.remaining())));
   const input=original.input;
   // 원 coordinator가 만든 단발 객체만 받는다. 역사 시각의 schema/hash 검산과 현재 기한 검사는 분리한다.
   const e=readDispatchEnvelopeV1(input.envelope,Date.parse(input.envelope.issuedAt));if(e.operation!=='SEND_INSTRUCTION'||input.executionAuthorized!==false||input.actualExecutionVerified!==false)fail();
   const run=Promise.resolve().then(()=>{check();entered=true;return this.#send.call(this.#driver,input,child.signal);});
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
