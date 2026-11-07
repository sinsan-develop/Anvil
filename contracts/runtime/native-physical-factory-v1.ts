import {recordV1,arrayV1,refV1,uuidV1,hashV1,cloneV1,type RuntimeRefV1} from './validation-v1.ts';
export const PHYSICAL_FACTORY_NAMESPACE='ANVIL_NATIVE_OWNER_FACTORY_V1' as const;
export interface NativeParentBasis{schemaVersion:1;purpose:'NATIVE_PREPARATION_PARENT_PACKAGE_BASIS';physicalNamespace:typeof PHYSICAL_FACTORY_NAMESPACE;factoryId:string;factoryVersion:number;parentExeHash:string;parentAsarHash:string;parentHeaderHash:string}
export interface NativePhysicalFactoryArtifact{schemaVersion:1;purpose:'NATIVE_PHYSICAL_FACTORY_ARTIFACT';physicalNamespace:typeof PHYSICAL_FACTORY_NAMESPACE;factoryRef:RuntimeRefV1;parentBasis:NativeParentBasis;helperBytes:number;buildInputHash:string}
const fail=():never=>{throw Error('NATIVE_PHYSICAL_FACTORY_UNAVAILABLE');};
export function freezePhysical<T>(value:T):Readonly<T>{if(value&&typeof value==='object'){for(const v of Object.values(value))freezePhysical(v);Object.freeze(value);}return value;}
export function readNativeParentBasis(value:unknown):Readonly<NativeParentBasis>{
 if(!recordV1(value,['schemaVersion','purpose','physicalNamespace','factoryId','factoryVersion','parentExeHash','parentAsarHash','parentHeaderHash'])||value.schemaVersion!==1||value.purpose!=='NATIVE_PREPARATION_PARENT_PACKAGE_BASIS'||value.physicalNamespace!==PHYSICAL_FACTORY_NAMESPACE||!uuidV1(value.factoryId)||!Number.isSafeInteger(value.factoryVersion)||value.factoryVersion<1||![value.parentExeHash,value.parentAsarHash,value.parentHeaderHash].every(v=>hashV1(v)&&v!=='0'.repeat(64)))return fail();return freezePhysical(cloneV1(value)) as Readonly<NativeParentBasis>;
}
/** 내부 증빙 원형 판독일 뿐 보호 provenance/컴파일/OS admission 인증이 아니다. */
export function readNativePhysicalFactoryArtifact(value:unknown):Readonly<NativePhysicalFactoryArtifact>{
 if(!recordV1(value,['schemaVersion','purpose','physicalNamespace','factoryRef','parentBasis','helperBytes','buildInputHash'])||value.schemaVersion!==1||value.purpose!=='NATIVE_PHYSICAL_FACTORY_ARTIFACT'||value.physicalNamespace!==PHYSICAL_FACTORY_NAMESPACE||!refV1(value.factoryRef)||value.factoryRef.contentHash==='0'.repeat(64)||!Number.isSafeInteger(value.helperBytes)||value.helperBytes<512||value.helperBytes>64*1024*1024||!hashV1(value.buildInputHash)||value.buildInputHash==='0'.repeat(64))return fail();
 const parentBasis=readNativeParentBasis(value.parentBasis);if(parentBasis.factoryId!==value.factoryRef.id||parentBasis.factoryVersion!==value.factoryRef.version)return fail();return freezePhysical({...cloneV1(value),parentBasis}) as Readonly<NativePhysicalFactoryArtifact>;
}
export function readNativePhysicalFactoryCatalogue(values:unknown):readonly Readonly<NativePhysicalFactoryArtifact>[]{
 if(!arrayV1(values,200)||values.length<1)return fail();const seen=new Set<string>();return Object.freeze(values.map(v=>{const item=readNativePhysicalFactoryArtifact(v),key=item.factoryRef.id+':'+item.factoryRef.version;if(seen.has(key))return fail();seen.add(key);return item;}));
}
