import {canonicalJson} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {SyntheticExecutionClient} from './execution-client.ts';
import {readClientScope,type ClientScope} from './execution-ledger.ts';
import type {SyntheticStartAuthority} from './execution-start-receiver.ts';

export interface SyntheticStartClientVerifier {
 transport:'SYNTHETIC_ONLY';
 /** 실제 source/OS 권위 제공자가 아니다. 같은 봉투와 sync한 시도에 대한 합성 관측 ref를 반환한다. */
 current(envelope:DispatchEnvelopeV1,localAttemptRef:RuntimeRefV1,signal:AbortSignal):Promise<unknown>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
class StartClientFailure extends Error{}
const fail=(code:string):never=>{throw new StartClientFailure(code);};

/** P1의 수신기→내구 서명 client permit 연결. credential/실키/HTTP/OS/Agent를 생성하지 않는다.
 * permit 또는 응답이 불명확하면 재전송하지 않고 기존 수신기가 UNKNOWN을 기록한다.
 * source/OS 제공자의 실제 진위와 launch fence는 별도이며 합성 표식을 실제 권한으로 승격하지 않는다. */
export class SyntheticStartClientAuthority implements SyntheticStartAuthority {
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly client:SyntheticExecutionClient;readonly verifier:SyntheticStartClientVerifier;
 #scope:ClientScope;#clock:()=>number;#timeout:number;
 constructor(client:SyntheticExecutionClient,verifier:SyntheticStartClientVerifier,scope:unknown,options:{clock:()=>number;timeoutMs:number}){
  this.client=client;this.verifier=verifier;this.#ports();
  this.#scope=(()=>{try{return readClientScope(scope);}catch{return fail('START_CLIENT_SCOPE_INVALID');}})();
  if(this.#scope.mode!=='EXECUTION'||!options||typeof options.clock!=='function'||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)fail('START_CLIENT_CONFIG_INVALID');
  this.#clock=options.clock;this.#timeout=options.timeoutMs;
 }
 #ports(){if(!(this.client instanceof SyntheticExecutionClient)||this.verifier?.transport!=='SYNTHETIC_ONLY'||typeof this.verifier.current!=='function')fail('START_CLIENT_PORTS_REQUIRED');}
 #now(){const at=this.#clock();if(!Number.isSafeInteger(at)||!Number.isFinite(new Date(at).getTime()))return fail('START_CLIENT_CLOCK_INVALID');return at;}
 async #current(e:DispatchEnvelopeV1,attempt:RuntimeRefV1,ceiling:number){
  this.#ports();const wait=Math.min(this.#timeout,ceiling-this.#now());if(wait<=0)return fail('START_CLIENT_EXPIRED');const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,value:any;
  try{value=cloneV1(await Promise.race([Promise.resolve().then(()=>this.verifier.current(cloneV1(e),cloneV1(attempt),controller.signal)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new StartClientFailure('START_CLIENT_CURRENT_TIMEOUT'));},wait);})]));}finally{if(timer)clearTimeout(timer);}
  const now=this.#now();this.#ports();
  if(!recordV1(value,['transport','key','envelopeHash','grantRef','sourceObservationRefs','osOwnershipRef','checkedAt','expiresAt'])||value.transport!=='SYNTHETIC_ONLY'||!same(value.key,receiptKeyV1(e))||value.envelopeHash!==e.envelopeHash||!same(value.grantRef,this.#scope.grantRef)||!refV1(value.osOwnershipRef)||!arrayV1(value.sourceObservationRefs,200)||!value.sourceObservationRefs.length||!value.sourceObservationRefs.every(refV1)||new Set(value.sourceObservationRefs.map(canonicalJson)).size!==value.sourceObservationRefs.length||!isoV1(value.checkedAt)||!isoV1(value.expiresAt)||Date.parse(value.checkedAt)>now||now-Date.parse(value.checkedAt)>30000||Date.parse(value.expiresAt)<=now||Date.parse(value.expiresAt)>Date.parse(value.checkedAt)+30000||now>=ceiling)return fail('START_CLIENT_CURRENT_INVALID');
  const sourceRefs=[...new Map(e.context.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()],expected=sourceRefs.map(canonicalJson).sort();if(!same(value.sourceObservationRefs.map(canonicalJson).sort(),expected))return fail('START_CLIENT_SOURCE_MISMATCH');
  const{checkedAt,expiresAt,...binding}=value;binding.sourceObservationRefs=cloneV1(sourceRefs);return{binding,checkedAt,expiresAt,deadline:Math.min(ceiling,Date.parse(expiresAt),Date.parse(checkedAt)+30000)};
 }
 async consume(rawEnvelope:unknown,rawAttempt:RuntimeRefV1){
  try{
   this.#ports();const e=readDispatchEnvelopeV1(rawEnvelope,this.#now()),s=this.#scope;
   if(e.operation!=='START_SESSION'||e.context.projectId!==s.projectId||e.context.executionId!==s.executionId||e.context.executionGeneration!==s.executionGeneration||!refV1(rawAttempt))return fail('START_CLIENT_INPUT_INVALID');
   const attempt=cloneV1(rawAttempt),first=await this.#current(e,attempt,Date.parse(e.expiresAt));
   const body={envelopeHash:e.envelopeHash,localAttemptRef:attempt,sourceObservationRefs:first.binding.sourceObservationRefs,osOwnershipRef:first.binding.osOwnershipRef};
   const result=await this.client.execute(cloneV1(s),{kind:'PERMIT',commandId:e.commandId,bodyRaw:canonicalJson(body)});
   if(result.transport!=='SYNTHETIC_ONLY'||result.state!=='RESPONSE_RECORDED'||result.executionAuthorized!==false||result.dispatchPerformed!==false||result.writerReleaseVerified!==false||result.ackAudited!==false)return fail('START_CLIENT_PERMIT_UNCERTAIN');
   const response=result.response,p=response?.permit;
   if(!recordV1(response,['transport','proofResultRef','permit','nonceConsumed','executionAuthorized','dispatchPerformed'])||response.transport!=='SYNTHETIC_ONLY'||!refV1(response.proofResultRef)||response.nonceConsumed!==true||response.executionAuthorized!==false||response.dispatchPerformed!==false||!recordV1(p,['transport','key','envelopeHash','grantRef','permitRef','checkedAt','expiresAt','executionAuthorized','dispatchPerformed'])||p.transport!=='SYNTHETIC_ONLY'||!same(p.key,receiptKeyV1(e))||p.envelopeHash!==e.envelopeHash||!same(p.grantRef,s.grantRef)||!refV1(p.permitRef)||p.executionAuthorized!==false||p.dispatchPerformed!==false||!isoV1(p.checkedAt)||!isoV1(p.expiresAt))return fail('START_CLIENT_PERMIT_INVALID');
   const latest=await this.#current(e,attempt,first.deadline),now=this.#now(),end=Math.min(first.deadline,latest.deadline,Date.parse(p.checkedAt)+30000);
   if(!same(first.binding,latest.binding)||Date.parse(p.checkedAt)>now||now-Date.parse(p.checkedAt)>30000||Date.parse(p.expiresAt)<=now||Date.parse(p.expiresAt)>end)return fail('START_CLIENT_PERMIT_EXPIRED');
   return{transport:'SYNTHETIC_ONLY' as const,key:cloneV1(p.key),envelopeHash:p.envelopeHash,grantRef:cloneV1(p.grantRef),permitRef:cloneV1(p.permitRef),checkedAt:p.checkedAt,expiresAt:p.expiresAt};
  }catch(error){if(error instanceof StartClientFailure)throw error;return fail('START_CLIENT_UNAVAILABLE');}
 }
}
