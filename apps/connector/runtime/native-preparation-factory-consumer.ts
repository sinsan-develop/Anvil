import {recordV1,refV1,cloneV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {canonicalJson} from '../../../contracts/canonical.ts';
export interface NativeFactoryCapability{consume():Promise<Readonly<Record<string,unknown>>>}
export interface NativeFactoryPort{transport:'SOURCE_ONLY_MODEL';ref:RuntimeRefV1;invoke(capability:NativeFactoryCapability,signal:AbortSignal):Promise<unknown>}
export type NativeFactoryOutcome='KNOWN_NOT_CREATED'|'CREATED_OBSERVED'|'UNKNOWN';
const immutable=<T>(v:T):T=>{if(v&&typeof v==='object'){for(const x of Object.values(v))immutable(x);Object.freeze(v);}return v;};
/** 보호 공급자는 기본 부재다. 이 binding과 합성 성공은 실제 factory 지원/권위의 증거가 아니다. */
export class NativePreparationFactoryConsumer{
 #take:(capability:object)=>Record<string,unknown>|undefined;#binding:{port:NativeFactoryPort;ref:RuntimeRefV1;invoke:unknown}|null;
 constructor(take:(capability:object)=>Record<string,unknown>|undefined,port:NativeFactoryPort|null){this.#take=take;const r=port?Object.getOwnPropertyDescriptor(port,'ref'):undefined,invoke=port?Object.getOwnPropertyDescriptor(port,'invoke'):undefined;this.#binding=port&&r&&'value'in r&&refV1(r.value)&&invoke&&'value'in invoke&&typeof invoke.value==='function'?{port,ref:immutable(cloneV1(r.value)),invoke:invoke.value}:null;}
 assertFactoryRef(expected:RuntimeRefV1){const b=this.#binding,p=b?.port,r=p?Object.getOwnPropertyDescriptor(p,'ref'):undefined,t=p?Object.getOwnPropertyDescriptor(p,'transport'):undefined,d=p?Object.getOwnPropertyDescriptor(p,'invoke'):undefined;if(!b||!refV1(expected)||!p||!r||!('value'in r)||!refV1(r.value)||canonicalJson(expected)!==canonicalJson(b.ref)||canonicalJson(r.value)!==canonicalJson(b.ref)||!t||!('value'in t)||t.value!=='SOURCE_ONLY_MODEL'||!d||!('value'in d)||d.value!==b.invoke)throw Error('NATIVE_FACTORY_UNAVAILABLE');}
 async consume(capability:unknown,signal:AbortSignal,guard:()=>Promise<void>,check:()=>void=()=>{},expectedFactoryRef?:RuntimeRefV1):Promise<NativeFactoryOutcome>{
  if(!capability||typeof capability!=='object'||Array.isArray(capability)||!refV1(expectedFactoryRef))throw Error('NATIVE_CAPABILITY_REQUIRED');
  const stable=()=>{check();this.assertFactoryRef(expectedFactoryRef);if(signal.aborted)throw Error('NATIVE_SOURCE_EXPIRED');};
  stable();await guard();stable();const input=this.#take(capability);if(!input)throw Error('NATIVE_CAPABILITY_REQUIRED');const material=immutable(cloneV1(input));let active=true,consumed=false,consuming=false;const ticket=Object.create(null) as NativeFactoryCapability;
  Object.defineProperties(ticket,{consume:{value:function(this:unknown){const receiver=this;const pending=(async()=>{stable();if(receiver!==ticket||!active||consumed||consuming)throw Error('NATIVE_CAPABILITY_REQUIRED');consuming=true;try{await guard();stable();if(!active||consumed)throw Error('NATIVE_CAPABILITY_REQUIRED');consumed=true;return material;}catch(error){active=false;throw error;}finally{consuming=false;}})();void pending.catch(()=>{});return pending;},enumerable:false,writable:false,configurable:false},toJSON:{value:()=>{throw Error('NATIVE_CAPABILITY_NOT_SERIALIZABLE');},enumerable:false,writable:false,configurable:false}});Object.freeze(ticket);
  try{const result=await this.#binding!.port.invoke(ticket,signal);if(consuming&&!consumed){active=false;return 'UNKNOWN';}await guard();stable();if(!consumed||!recordV1(result,['state'])||!['KNOWN_NOT_CREATED','CREATED_OBSERVED','UNKNOWN'].includes(result.state))return 'UNKNOWN';return result.state as NativeFactoryOutcome;}catch{return 'UNKNOWN';}finally{active=false;}
 }
}
