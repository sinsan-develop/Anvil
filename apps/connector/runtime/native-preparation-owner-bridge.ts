import {consumeNativeFactoryCallContext,readNativeFactoryCallBudget,checkNativeFactoryCallCurrent,type NativeFactoryPort} from './native-preparation-factory-consumer.ts';
import {NativePreparationOwnerLauncher,type NativeOwnerHandle} from './native-preparation-owner-launcher.ts';
import {nativeHash,nativeSame} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {refV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
const fail=()=>Error('NATIVE_OWNER_UNAVAILABLE');
/** 이 객체의 ticket provenance는 프로세스 내부 한정이다. OS 부모/peer/admission을 증명하지 않는다. */
export class NativePreparationOwnerBridge implements NativeFactoryPort{
 readonly transport='SOURCE_ONLY_MODEL' as const;readonly ref:RuntimeRefV1;#launcher:NativePreparationOwnerLauncher;#open:NativePreparationOwnerLauncher['open'];#used=false;#owner:NativeOwnerHandle|null=null;
 constructor(launcher:NativePreparationOwnerLauncher){const ref=launcher.factoryRef;if(!refV1(ref))throw fail();this.ref=Object.freeze({...ref});this.#launcher=launcher;this.#open=launcher.open;Object.freeze(this);}
 #stable(){if(this.#launcher.open!==this.#open||!nativeSame(this.#launcher.factoryRef,this.ref))throw fail();}
 readonly invoke=async(ticket:unknown,signal:AbortSignal):Promise<{state:'CREATED_OBSERVED'|'UNKNOWN'}>=>{
  if(this.#used)throw fail();this.#used=true;this.#stable();const context=await consumeNativeFactoryCallContext(ticket,this);const budget=()=>{this.#stable();if(signal.aborted)throw fail();return readNativeFactoryCallBudget(context,this);};
  const first=budget();const owner=await this.#open.call(this.#launcher,{bridgeRunId:context.permit.ref.id,bindingHash:nativeHash(context),context,callExpiresAt:first.callExpiresAt,remainingMs:first.remainingMs},signal,async()=>{budget();await checkNativeFactoryCallCurrent(context,this);return budget();});this.#owner=owner;
  try{budget();await owner.query();budget();return{state:'CREATED_OBSERVED'};}catch{return{state:'UNKNOWN'};}
 };
 /** 동일 원 owner의 후보 관측·정리다. 새 OPEN/실행/회수 권위를 발급하지 않는다. */
 async query(){this.#stable();if(!this.#owner)throw fail();return this.#owner.query();}
 async close(){this.#stable();if(!this.#owner)return this.#launcher.closeOwned();return this.#owner.close();}
}
