import {createPublicKey,verify} from 'node:crypto';
import {types} from 'node:util';
import {contentHash} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {nativeSame} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {readNativeReturnAuthority,readNativeOwnershipResult,matchNativeOwnershipResponse} from '../../../contracts/runtime/native-preparation-ownership-return-v1.ts';
import {readOwnershipProcessRefV1,matchOwnershipObservationV1,matchOwnershipObservationFactsV1,ownershipObservationBytesV1} from '../../../contracts/runtime/ownership-observation-v1.ts';
import {consumeNativeFactoryCallContext,readNativeFactoryCallBudget,checkNativeFactoryCallCurrent,type NativeFactoryPort,type NativeFactoryCallContext} from './native-preparation-factory-consumer.ts';
import {NativePreparationHttpsChannel} from './native-preparation-https.ts';

function unavailable():never{throw Error('NATIVE_RETURN_OUTCOME_UNKNOWN');}
const own=(v:object,key:string)=>{if(types.isProxy(v))return unavailable();const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!('value'in d))return unavailable();return d.value;};
export interface RetainedNativeOwnershipSource{
 transport:'SOURCE_ONLY_MODEL';ref:RuntimeRefV1;
 open(context:Readonly<NativeFactoryCallContext>,signal:AbortSignal):Promise<{
  read(signal:AbortSignal):Promise<unknown>;
  sign(response:ReturnType<typeof matchNativeOwnershipResponse>,signal:AbortSignal):Promise<unknown>;
  close():Promise<{closed:boolean}>;
 }>;
}
/** 원 ticket의 내구 FACTORY_ATTEMPTED 뒤 원 retained owner를 조합한다.
 * 보호 OS/key 공급자는 기본 부재이며 인터페이스 주입·RAM 성공은 실제 관측을 증명하지 않는다. */
export class NativePreparationOwnershipReturn implements NativeFactoryPort{
 readonly transport='SOURCE_ONLY_MODEL' as const;readonly ref:RuntimeRefV1;
 #channel:NativePreparationHttpsChannel;#source:RetainedNativeOwnershipSource;#open:RetainedNativeOwnershipSource['open'];
 #request:NativePreparationHttpsChannel['ownershipRequest'];#result:NativePreparationHttpsChannel['ownershipResult'];
 #used=false;#owner:Awaited<ReturnType<RetainedNativeOwnershipSource['open']>>|null=null;#close:(()=>Promise<{closed:boolean}>)|null=null;#closing:Promise<void>|null=null;#outcome:Record<string,any>|null=null;
 #now:()=>number;#allocate:()=>string;
 constructor(channel:NativePreparationHttpsChannel,source:RetainedNativeOwnershipSource,clock:{now:()=>number;allocate:()=>string}){
  if(!(channel instanceof NativePreparationHttpsChannel)||!source||own(source,'transport')!=='SOURCE_ONLY_MODEL'||!refV1(own(source,'ref'))||typeof own(source,'open')!=='function')unavailable();
  this.#channel=channel;this.#source=source;this.#open=own(source,'open');this.ref=Object.freeze(cloneV1(own(source,'ref')));
  this.#request=own(channel,'ownershipRequest');this.#result=own(channel,'ownershipResult');this.#now=clock.now;this.#allocate=clock.allocate;
  if(typeof this.#request!=='function'||typeof this.#result!=='function'||typeof this.#now!=='function'||typeof this.#allocate!=='function')unavailable();
 }
 #stable(){if(own(this.#source,'open')!==this.#open||!nativeSame(own(this.#source,'ref'),this.ref)||own(this.#channel,'ownershipRequest')!==this.#request||own(this.#channel,'ownershipResult')!==this.#result)unavailable();}
 readonly invoke=async(ticket:unknown,signal:AbortSignal)=>{
  if(this.#used)unavailable();this.#used=true;
  let context:Readonly<NativeFactoryCallContext>|null=null,last=-Infinity,complete=false;
  const check=()=>{this.#stable();if(!context||signal.aborted)unavailable();const at=this.#now();if(!Number.isSafeInteger(at)||at<last)unavailable();last=at;const budget=readNativeFactoryCallBudget(context,this);if(at>=Date.parse(budget.callExpiresAt))unavailable();return budget;};
  const bounded=<T>(work:()=>Promise<T>,late?:(value:T)=>void):Promise<T>=>{
   const budget=check();return new Promise((resolve,reject)=>{let done=false;const finish=(error:unknown,value?:T)=>{if(done){if(!error&&value!==undefined)late?.(value);return;}done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve(value!);};
    const abort=()=>finish(Error('NATIVE_RETURN_OUTCOME_UNKNOWN')),timer=setTimeout(abort,Math.max(1,Math.floor(budget.remainingMs)));signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>{check();return work();}).then(v=>{try{check();finish(null,v);}catch(e){late?.(v);finish(e);}},e=>finish(e));
   });
  };
  try{
   this.#stable();context=await consumeNativeFactoryCallContext(ticket,this);const a=readNativeReturnAuthority(context.authority.snapshot);check();
   await bounded(()=>checkNativeFactoryCallCurrent(context,this));
   const owner=await bounded(()=>this.#open.call(this.#source,context!,signal),v=>{try{const close=own(v,'close');if(typeof close==='function')void Promise.resolve(close.call(v)).catch(()=>{});}catch{}});
   this.#owner=owner;const read=own(owner,'read'),sign=own(owner,'sign');this.#close=own(owner,'close');if([read,sign,this.#close].some(f=>typeof f!=='function'))unavailable();
   const stableOwner=()=>{check();if(own(owner,'read')!==read||own(owner,'sign')!==sign||own(owner,'close')!==this.#close)unavailable();};
   const process=readOwnershipProcessRefV1(await bounded(()=>read.call(owner,signal)));stableOwner();
   const requestId=this.#allocate();if(!uuidV1(requestId))unavailable();
   const input={schemaVersion:1,requestId,authorityRef:context.authority.ref,consumeReceiptRef:context.receipt.ref,localAttemptRef:context.receipt.snapshot.localAttemptRef,processRef:process};
   await bounded(()=>checkNativeFactoryCallCurrent(context,this));
   const response=matchNativeOwnershipResponse(await bounded(()=>this.#request.call(this.#channel,input,signal)),input,a);stableOwner();
   if(this.#now()>=Date.parse(response.request.expiresAt))unavailable();
   const signed=await bounded(()=>sign.call(owner,cloneV1(response),signal));stableOwner();
   if(!recordV1(signed,['report','facts','publicKeySpki','signature'])||typeof signed.publicKeySpki!=='string')unavailable();
   const report=matchOwnershipObservationV1(signed.report,response.request,this.#now()),facts=matchOwnershipObservationFactsV1(report,signed.facts,process),spki=Buffer.from(signed.publicKeySpki,'base64url');
   if(spki.toString('base64url')!==signed.publicKeySpki||contentHash(spki)!==a.scope.hostPublicKeyFingerprint)unavailable();
   const key=createPublicKey({key:spki,format:'der',type:'spki'}),packet=readNativeOwnershipResult({schemaVersion:1,authorityRef:context.authority.ref,consumeReceiptRef:context.receipt.ref,localAttemptRef:input.localAttemptRef,bindingRef:response.bindingRef,report,facts,signature:signed.signature});
   if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1'||!verify('sha256',ownershipObservationBytesV1(report),{key,dsaEncoding:'ieee-p1363'},Buffer.from(packet.signature,'base64url')))unavailable();
   if(!nativeSame(readOwnershipProcessRefV1(await bounded(()=>read.call(owner,signal))),process))unavailable();
   await bounded(()=>checkNativeFactoryCallCurrent(context,this));
   const accepted=await bounded(()=>this.#result.call(this.#channel,packet,signal));stableOwner();
   this.#outcome=cloneV1(accepted);complete=true;return {state:'CREATED_OBSERVED' as const};
  }catch{return {state:'UNKNOWN' as const};}
  finally{if(!complete){this.#outcome=null;await this.close().catch(()=>{});}}
 };
 outcome(){return this.#outcome?cloneV1(this.#outcome):null;}
 /** 정리는 새 생성/요청/서명을 허용하지 않는다. 실패는 같은 owner에서 재시도하지 않는다. */
 close():Promise<void>{
  if(this.#closing)return this.#closing;
  if(!this.#owner||!this.#close)return Promise.resolve();const owner=this.#owner,close=this.#close;
  this.#closing=new Promise((resolve,reject)=>{let done=false;const finish=(error?:unknown)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve();},timer=setTimeout(()=>finish(Error('NATIVE_RETURN_CLEANUP_UNKNOWN')),10000);
   Promise.resolve().then(()=>{if(own(owner,'close')!==close)unavailable();return close.call(owner);}).then(v=>finish(recordV1(v,['closed'])&&v.closed===true?undefined:Error('NATIVE_RETURN_CLEANUP_UNKNOWN')),e=>finish(e));
  });return this.#closing;
 }
}
