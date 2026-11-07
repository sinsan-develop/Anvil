import {AuthFailure} from '../access/repository.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';

export interface InventoryLimits {
 readonly metadataBytes:number;
 readonly inputBytes:number;
 readonly fileCount:number;
 readonly deadlineMs:number;
}
export interface DocumentInventoryRequest {
 readonly projectId:string;
 readonly limits:Readonly<InventoryLimits>;
}
const limitFields=['metadataBytes','inputBytes','fileCount','deadlineMs'] as const;

function dataSnapshot(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error();
 // 입력 descriptor는 한 번만 읽는다. 이후 검증/복제는 이 로컬 data 값만 소비한다.
 const descriptors=Object.getOwnPropertyDescriptors(value),names=Reflect.ownKeys(descriptors);
 if(names.length!==keys.length||names.some(key=>typeof key!=='string'||!keys.includes(key)))throw Error();
 const snapshot:Record<string,unknown>=Object.create(null);
 for(const key of keys){const descriptor=descriptors[key];if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error();snapshot[key]=descriptor.value;}
 return snapshot;
}

/** 내부 수집 요청의 형식과 유한 한도만 검사한다. 인증·IO·백업 실행을 하지 않는다. */
export function readDocumentInventoryInput(value:unknown):Readonly<DocumentInventoryRequest>{
 try{
  const snapshot=dataSnapshot(value,['projectId','limits']);
  if(!uuidV1(snapshot.projectId))throw Error();
  const limits=dataSnapshot(snapshot.limits,limitFields);
  for(const field of limitFields)if(!Number.isSafeInteger(limits[field])||Number(limits[field])<=0)throw Error();
  return Object.freeze({projectId:snapshot.projectId,limits:Object.freeze({
   metadataBytes:Number(limits.metadataBytes),inputBytes:Number(limits.inputBytes),fileCount:Number(limits.fileCount),deadlineMs:Number(limits.deadlineMs)
  })});
 }catch{
  // 원 입력의 accessor/reflection 오류와 cause를 외부로 전달하지 않는다.
  throw new AuthFailure('INPUT_INVALID',400);
 }
}
