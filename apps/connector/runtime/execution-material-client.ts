import {canonicalJson} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../contracts/runtime/validation-v1.ts';
import {clientBase64,readClientOperation,readClientScope,type ClientScope} from './execution-ledger.ts';
import type {SyntheticClientTransport} from './execution-client.ts';
import {SyntheticMaterialReceiver} from './execution-material-receiver.ts';
/** raw 합성 port의 MATERIAL 결과는 기존 인증 서버의 {proofResultRef,material,...}다.
 * 이 adapter가 receiver에 저장하고 기존 client 계약의 partReceipt만 반환한다. */
export interface SyntheticMaterialResponseTransport extends SyntheticClientTransport{}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
class MaterialClientFailure extends Error{}
const fail=(code:string):never=>{throw new MaterialClientFailure(code);};
/** 정확 한 부분의 명시 요청 전용. HTTP/키/credential/현재 권한 제공자·자동 polling은 만들지 않는다.
 * 실제 서명/서버 current 진위는 raw port 책임이며 SYNTHETIC_ONLY를 실권한으로 승격하지 않는다. */
export class SyntheticMaterialClientTransport implements SyntheticClientTransport{
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly source:SyntheticMaterialResponseTransport;readonly receiver:SyntheticMaterialReceiver;
 #scope:ClientScope;#envelope:DispatchEnvelopeV1;#selection:ReturnType<typeof readClientOperation>;#clock:()=>number;
 constructor(source:SyntheticMaterialResponseTransport,receiver:SyntheticMaterialReceiver,scope:unknown,envelope:unknown,operation:unknown,options:{clock:()=>number}){
  this.source=source;this.receiver=receiver;this.#ports();if(typeof options?.clock!=='function')fail('MATERIAL_CLIENT_CONFIG_INVALID');this.#clock=options.clock;
  const bound=(()=>{try{const s=readClientScope(scope),e=readDispatchEnvelopeV1(envelope,this.#now()),selection=readClientOperation(s,operation,this.#now()),b=selection.body as any;
   if(s.mode!=='EXECUTION'||e.operation==='REQUEST_STOP'||selection.operation.kind!=='MATERIAL'||selection.operation.commandId!==e.commandId||b.envelopeHash!==e.envelopeHash||e.context.projectId!==s.projectId||e.context.executionId!==s.executionId||e.context.executionGeneration!==s.executionGeneration)fail('MATERIAL_CLIENT_SELECTION_INVALID');
   return{scope:s,envelope:e,selection};
  }catch{return fail('MATERIAL_CLIENT_SELECTION_INVALID');}})();this.#scope=bound.scope;this.#envelope=bound.envelope;this.#selection=bound.selection;
 }
 #ports(){if(this.source?.transport!=='SYNTHETIC_ONLY'||typeof this.source.challenge!=='function'||typeof this.source.perform!=='function'||!(this.receiver instanceof SyntheticMaterialReceiver))fail('MATERIAL_CLIENT_PORTS_REQUIRED');}
 #now(){const at=this.#clock();if(!Number.isSafeInteger(at)||!Number.isFinite(new Date(at).getTime()))return fail('MATERIAL_CLIENT_CLOCK_INVALID');return at;}
 #check(scope:ClientScope,signal:AbortSignal){this.#ports();if(!(signal instanceof AbortSignal)||signal.aborted||!same(readClientScope(scope),this.#scope))fail('MATERIAL_CLIENT_REQUEST_INVALID');readDispatchEnvelopeV1(this.#envelope,this.#now());}
 async challenge(scope:ClientScope,request:unknown,signature:string,signal:AbortSignal){
  try{this.#check(scope,signal);
   if(!recordV1(request,['requestId','purpose','grantRef','credentialGeneration','target','clientNonce','issuedAt'])||!uuidV1(request.requestId)||request.purpose!=='EXECUTION_REQUEST'||!same(request.grantRef,this.#scope.grantRef)||request.credentialGeneration!==this.#scope.credentialGeneration||!same(request.target,this.#selection.target)||!clientBase64(request.clientNonce,32)||!isoV1(request.issuedAt)||Date.parse(request.issuedAt)>this.#now()||this.#now()-Date.parse(request.issuedAt)>30000||!clientBase64(signature,64))return fail('MATERIAL_CLIENT_REQUEST_INVALID');
   const result=await this.source.challenge(cloneV1(this.#scope),cloneV1(request),signature,signal);this.#check(scope,signal);return cloneV1(result);
  }catch{return fail('MATERIAL_CLIENT_CHALLENGE_UNAVAILABLE');}
 }
 async perform(scope:ClientScope,operation:Parameters<SyntheticClientTransport['perform']>[1],challengeRef:unknown,proof:unknown,signature:string,bodyRaw:string,signal:AbortSignal){
  try{this.#check(scope,signal);
   if(!recordV1(operation,['kind','commandId'])||operation.kind!=='MATERIAL'||operation.commandId!==this.#envelope.commandId||!same(readClientOperation(this.#scope,{...operation,bodyRaw},this.#now()).operation,this.#selection.operation)||!refV1(challengeRef)||challengeRef.version!==1||!recordV1(proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])||!uuidV1(proof.requestId)||!same({method:proof.method,path:proof.path,queryHash:proof.queryHash,bodyHash:proof.bodyHash},this.#selection.target)||!same(proof.grantRef,this.#scope.grantRef)||proof.credentialGeneration!==this.#scope.credentialGeneration||!clientBase64(proof.serverNonce,32)||!clientBase64(signature,64))return fail('MATERIAL_CLIENT_REQUEST_INVALID');
   const result=await this.source.perform(cloneV1(this.#scope),cloneV1(operation),cloneV1(challengeRef),cloneV1(proof),signature,this.#selection.operation.bodyRaw,signal);this.#check(scope,signal);
   if(!recordV1(result,['transport','proofResultRef','material','nonceConsumed','executionAuthorized','dispatchPerformed'])||result.transport!=='SYNTHETIC_ONLY'||!refV1(result.proofResultRef)||result.proofResultRef.version!==1||result.nonceConsumed!==true||result.executionAuthorized!==false||result.dispatchPerformed!==false||!recordV1(result.material,['transport','materialId','materialRef','sourceRef','partIndex','partCount','byteOffset','sourceBytes','contentHash','mediaType','bytes','cacheControl','completeContextVerified','executionAuthorized','dispatchPerformed'])||!same(result.material.materialRef,(this.#selection.body as any).materialRef))return fail('MATERIAL_CLIENT_RESPONSE_INVALID');
   const proofResultRef=cloneV1(result.proofResultRef),partReceipt=await this.receiver.recordReceipt(this.#envelope,result.material);this.#check(scope,signal);
   return{transport:'SYNTHETIC_ONLY' as const,proofResultRef,partReceipt,nonceConsumed:true as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch{return fail('MATERIAL_CLIENT_RECEIVE_UNAVAILABLE');}
 }
}
