import {canonicalJson} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticInstructionAuthority} from '../adapters/primary/instruction-transport.ts';
import {SyntheticExecutionClient} from './execution-client.ts';
import {readClientScope,type ClientScope} from './execution-ledger.ts';
export interface SyntheticInstructionClientVerifier{
 readonly transport:'SYNTHETIC_ONLY';
 /** 기존 sender가 검사하는 현재 세션/수신/이해·선택적 bootstrap fact. 실제 제공자의 진위는 이 연결이 만들지 않는다. */
 current(envelope:DispatchEnvelopeV1,material:unknown,signal:AbortSignal):Promise<unknown>;
 /** sync된 로컬 SEND시도·불변 binding과 현재 source/OS refs를 독립 대조한 합성 결과다. */
 permitCurrent(envelope:DispatchEnvelopeV1,attempt:Ref,bindingHash:string,signal:AbortSignal):Promise<unknown>;
}
class InstructionClientFailure extends Error{}
const fail=(code:string):never=>{throw new InstructionClientFailure(code);},same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
/** 후속 sender→기존 내구 서명 client의 연결이다. START 경로/공개 permit 본문을 바꾸지 않는다.
 * bindingHash 반환은 로컬 현재대조 metadata이며 서버가 추가 서명한 필드가 아니다.
 * 실제 서버 SEND permit·credential/키/HTTP/OS/Agent는 별도이고 모든 port는 SYNTHETIC_ONLY다. */
export class SyntheticInstructionClientAuthority implements SyntheticInstructionAuthority{
 readonly transport='SYNTHETIC_ONLY' as const;readonly client:SyntheticExecutionClient;readonly verifier:SyntheticInstructionClientVerifier;
 #scope:ClientScope;#clock:()=>number;#timeout:number;
 constructor(client:SyntheticExecutionClient,verifier:SyntheticInstructionClientVerifier,scope:unknown,options:{clock:()=>number;timeoutMs:number}){
  this.client=client;this.verifier=verifier;this.#ports();this.#scope=(()=>{try{return readClientScope(scope);}catch{return fail('INSTRUCTION_CLIENT_SCOPE_INVALID');}})();
  if(this.#scope.mode!=='EXECUTION'||typeof options?.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)fail('INSTRUCTION_CLIENT_CONFIG_INVALID');this.#clock=options.clock;this.#timeout=options.timeoutMs;
 }
 #ports(){if(!(this.client instanceof SyntheticExecutionClient)||this.verifier?.transport!=='SYNTHETIC_ONLY'||typeof this.verifier.current!=='function'||typeof this.verifier.permitCurrent!=='function')fail('INSTRUCTION_CLIENT_PORTS_REQUIRED');}
 #now(){const at=this.#clock();if(!Number.isSafeInteger(at)||!Number.isFinite(new Date(at).getTime()))return fail('INSTRUCTION_CLIENT_CLOCK_INVALID');return at;}
 #envelope(raw:unknown){const e=readDispatchEnvelopeV1(raw,this.#now()),s=this.#scope;if(e.operation!=='SEND_INSTRUCTION'||e.context.projectId!==s.projectId||e.context.executionId!==s.executionId||e.context.executionGeneration!==s.executionGeneration)return fail('INSTRUCTION_CLIENT_INPUT_INVALID');return e;}
 async #bounded(body:(signal:AbortSignal)=>Promise<unknown>,ceiling:number){
  this.#ports();const wait=Math.min(this.#timeout,ceiling-this.#now());if(wait<=0)return fail('INSTRUCTION_CLIENT_EXPIRED');const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{const value=cloneV1(await Promise.race([Promise.resolve().then(()=>{this.#ports();if(this.#now()>=ceiling)fail('INSTRUCTION_CLIENT_EXPIRED');return body(controller.signal);}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new InstructionClientFailure('INSTRUCTION_CLIENT_CURRENT_TIMEOUT'));},wait);})]));this.#ports();if(this.#now()>=ceiling)fail('INSTRUCTION_CLIENT_EXPIRED');return value;}finally{if(timer)clearTimeout(timer);}
 }
 async current(raw:DispatchEnvelopeV1,material:unknown){try{this.#ports();const e=this.#envelope(raw),value=await this.#bounded(signal=>this.verifier.current(cloneV1(e),cloneV1(material),signal),Date.parse(e.expiresAt));if((value as any)?.transport!=='SYNTHETIC_ONLY')return fail('INSTRUCTION_CLIENT_CURRENT_INVALID');return value;}catch(error){if(error instanceof InstructionClientFailure)throw error;return fail('INSTRUCTION_CLIENT_UNAVAILABLE');}}
 async #permitCurrent(e:DispatchEnvelopeV1,attempt:Ref,bindingHash:string,ceiling:number){
  const value:any=await this.#bounded(signal=>this.verifier.permitCurrent(cloneV1(e),cloneV1(attempt),bindingHash,signal),ceiling),now=this.#now();
  if(!recordV1(value,['transport','key','envelopeHash','bindingHash','grantRef','sourceObservationRefs','osOwnershipRef','checkedAt','expiresAt'])||value.transport!=='SYNTHETIC_ONLY'||!same(value.key,receiptKeyV1(e))||value.envelopeHash!==e.envelopeHash||value.bindingHash!==bindingHash||!same(value.grantRef,this.#scope.grantRef)||!refV1(value.osOwnershipRef)||!arrayV1(value.sourceObservationRefs,200)||!value.sourceObservationRefs.length||!value.sourceObservationRefs.every(refV1)||new Set(value.sourceObservationRefs.map(canonicalJson)).size!==value.sourceObservationRefs.length||!isoV1(value.checkedAt)||!isoV1(value.expiresAt)||Date.parse(value.checkedAt)>now||now-Date.parse(value.checkedAt)>30000||Date.parse(value.expiresAt)<=now||Date.parse(value.expiresAt)>Date.parse(value.checkedAt)+30000)return fail('INSTRUCTION_CLIENT_CURRENT_INVALID');
  const sources=[...new Map(e.context.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()];if(!same(value.sourceObservationRefs.map(canonicalJson).sort(),sources.map(canonicalJson).sort()))return fail('INSTRUCTION_CLIENT_SOURCE_MISMATCH');const{checkedAt,expiresAt,...binding}=value;binding.sourceObservationRefs=cloneV1(sources);return{binding,deadline:Math.min(ceiling,Date.parse(expiresAt),Date.parse(checkedAt)+30000)};
 }
 async consume(raw:DispatchEnvelopeV1,rawAttempt:Ref,bindingHash:string){
  try{this.#ports();const e=this.#envelope(raw),scope=this.#scope;if(!refV1(rawAttempt)||rawAttempt.version!==1||!hashV1(bindingHash))return fail('INSTRUCTION_CLIENT_INPUT_INVALID');const attempt=cloneV1(rawAttempt),first=await this.#permitCurrent(e,attempt,bindingHash,Date.parse(e.expiresAt)),body={envelopeHash:e.envelopeHash,localAttemptRef:attempt,sourceObservationRefs:first.binding.sourceObservationRefs,osOwnershipRef:first.binding.osOwnershipRef};
   const result=await this.client.execute(cloneV1(scope),{kind:'PERMIT',commandId:e.commandId,bodyRaw:canonicalJson(body)});if(result.transport!=='SYNTHETIC_ONLY'||result.state!=='RESPONSE_RECORDED'||result.executionAuthorized!==false||result.dispatchPerformed!==false||result.writerReleaseVerified!==false||result.ackAudited!==false)return fail('INSTRUCTION_CLIENT_PERMIT_UNCERTAIN');
   const response=result.response,p=response?.permit;if(!recordV1(response,['transport','proofResultRef','permit','nonceConsumed','executionAuthorized','dispatchPerformed'])||response.transport!=='SYNTHETIC_ONLY'||!refV1(response.proofResultRef)||response.nonceConsumed!==true||response.executionAuthorized!==false||response.dispatchPerformed!==false||!recordV1(p,['transport','key','envelopeHash','grantRef','permitRef','checkedAt','expiresAt','executionAuthorized','dispatchPerformed'])||p.transport!=='SYNTHETIC_ONLY'||!same(p.key,receiptKeyV1(e))||p.envelopeHash!==e.envelopeHash||!same(p.grantRef,scope.grantRef)||!refV1(p.permitRef)||p.executionAuthorized!==false||p.dispatchPerformed!==false||!isoV1(p.checkedAt)||!isoV1(p.expiresAt))return fail('INSTRUCTION_CLIENT_PERMIT_INVALID');
   const final=await this.#permitCurrent(e,attempt,bindingHash,first.deadline),now=this.#now();if(!same(first.binding,final.binding)||Date.parse(p.checkedAt)>now||now-Date.parse(p.checkedAt)>30000||Date.parse(p.expiresAt)<=now||Date.parse(p.expiresAt)>Math.min(first.deadline,final.deadline,Date.parse(p.checkedAt)+30000))return fail('INSTRUCTION_CLIENT_PERMIT_EXPIRED');
   return{transport:'SYNTHETIC_ONLY' as const,key:cloneV1(p.key),envelopeHash:p.envelopeHash,grantRef:cloneV1(p.grantRef),permitRef:cloneV1(p.permitRef),bindingHash,checkedAt:p.checkedAt,expiresAt:p.expiresAt};
  }catch(error){if(error instanceof InstructionClientFailure)throw error;return fail('INSTRUCTION_CLIENT_UNAVAILABLE');}
 }
}
