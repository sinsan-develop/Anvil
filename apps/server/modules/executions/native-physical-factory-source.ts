import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readNativePhysicalFactoryCatalogue} from '../../../../contracts/runtime/native-physical-factory-v1.ts';
import {cloneV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {NativePreparationSource} from './project-native-preparations.ts';
const fail=():never=>{throw Error('NATIVE_PHYSICAL_FACTORY_UNAVAILABLE');};
/** 실제 source의 등록/정책/current 검산을 위임하고 결과를 좁힌다. manifest는 권위 공급자가 아니다. 기본 source는 null. */
export function createNativePhysicalFactorySource(artifacts:unknown,upstream:NativePreparationSource|null=null):NativePreparationSource{
 const catalogue=readNativePhysicalFactoryCatalogue(artifacts),source=upstream;
 const own=(key:keyof NativePreparationSource)=>{if(!source)return fail();const d=Object.getOwnPropertyDescriptor(source,key);if(!d||!('value'in d))return fail();return d.value;};
 const transport=source?own('transport'):null,functions=source?(['options','current','allocate','credential'] as const).map(k=>own(k)):null;
 const stable=()=>{if(!source||transport!=='SOURCE_ONLY_MODEL'||own('transport')!==transport||!functions||functions.some((v,i)=>typeof v!=='function'||v!==own((['options','current','allocate','credential'] as const)[i]!)))return fail();return source;};
 const entry=(ref:RuntimeRefV1)=>{const found=catalogue.find(v=>canonicalJson(v.factoryRef)===canonicalJson(ref));if(!found)return fail();return found;};
 return Object.freeze({
  transport:'SOURCE_ONLY_MODEL' as const,
  options:async(...args:Parameters<NativePreparationSource['options']>)=>{const s=stable(),result=await s.options.call(s,...args);stable();if(!Array.isArray(result.items)||result.items.length>200)return fail();for(const item of result.items)entry(item.nativeFactoryRef);return cloneV1(result);},
  current:async(...args:Parameters<NativePreparationSource['current']>)=>{entry(args[3].nativeFactoryRef);const expected=cloneV1(args[3]),s=stable(),result=await s.current.call(s,...args);stable();if(canonicalJson(args[3])!==canonicalJson(expected)||canonicalJson(result.nativeFactoryRef)!==canonicalJson(expected.nativeFactoryRef)||canonicalJson(result.registrationRef)!==canonicalJson(expected.registrationRef))return fail();entry(result.nativeFactoryRef);return cloneV1(result);},
  allocate:(...args:Parameters<NativePreparationSource['allocate']>)=>{const s=stable(),v=s.allocate.call(s,...args);stable();return v;},
  credential:async(...args:Parameters<NativePreparationSource['credential']>)=>{const s=stable(),v=await s.credential.call(s,...args);stable();return v;}
 });
}
