import {canonicalJson} from '../../../contracts/canonical.ts';
import {readNativePhysicalFactoryArtifact} from '../../../contracts/runtime/native-physical-factory-v1.ts';
import {cloneV1,recordV1} from '../../../contracts/runtime/validation-v1.ts';
import type {NativeOwnerImageBinding,NativeOwnerImageSupplier} from './native-preparation-owner-launcher.ts';
const fail=():never=>{throw Error('NATIVE_OWNER_UNAVAILABLE');};
/** 원 보호 image mapping에 한정한 adapter다. JSON/일반 파일로 mapping/peer 권위를 생산하지 않는다. */
export function createNativePhysicalFactoryImageSupplier(artifact:unknown,mapping:NativeOwnerImageSupplier|null=null):NativeOwnerImageSupplier{
 const fixed=readNativePhysicalFactoryArtifact(artifact);if(!mapping)return fail();
 const own=(key:'binding'|'read')=>{const d=Object.getOwnPropertyDescriptor(mapping,key);if(!d||!('value'in d))return fail();return d.value;};
 const original=own('binding');if(!recordV1(original,['factoryRef','executablePath','executableHash']))return fail();
 const binding:NativeOwnerImageBinding=Object.freeze(cloneV1(original)) as NativeOwnerImageBinding,read=own('read');
 const stable=()=>{if(typeof read!=='function'||own('read')!==read||canonicalJson(own('binding'))!==canonicalJson(binding)||canonicalJson(binding.factoryRef)!==canonicalJson(fixed.factoryRef)||binding.executableHash!==fixed.factoryRef.contentHash)return fail();};
 stable();return Object.freeze({binding:Object.freeze({...binding,factoryRef:Object.freeze({...binding.factoryRef})}),read:async(signal:AbortSignal)=>{stable();if(signal.aborted)return fail();const result:unknown=await (read as NativeOwnerImageSupplier['read']).call(mapping,signal);stable();if(signal.aborted||!recordV1(result,['factoryRef','executablePath','executableHash'])||canonicalJson(result)!==canonicalJson(binding))return fail();return cloneV1(binding);}});
}
