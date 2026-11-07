import {AuthFailure} from '../access/repository.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readSourceReadRequestV1,readSourceReadRevokeV1,type SourceReadRequestV1} from '../../../../contracts/runtime/source-read-observation-v1.ts';
import type {RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
export const sourceReadOperations=['requestSourceReadObservation','revokeSourceReadObservation'] as const;
export type SourceReadOperation=typeof sourceReadOperations[number];
export type SourceReadInput={operation:'requestSourceReadObservation';input:SourceReadRequestV1}|{operation:'revokeSourceReadObservation';input:{grantRef:RuntimeRefV1;reason:string}};
export function readSourceReadInput(operation:string,value:unknown,nowMs:number):SourceReadInput{
 let result:SourceReadInput;
 try{
  if(operation==='requestSourceReadObservation')result={operation,input:readSourceReadRequestV1(value,nowMs)};
  else if(operation==='revokeSourceReadObservation')result={operation,input:readSourceReadRevokeV1(value)};
  else throw Error();
 }catch{throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);}
 if(inspectArtifact(Buffer.from(result.input.reason,'utf8')).state==='SUSPECTED')throw new AuthFailure('SOURCE_READ_SENSITIVE_CONTENT_SUSPECTED',412);return result;
}
export function readSourceReadListQuery(value:Record<string,unknown>):{limit:number;cursor:string|null}{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['limit','cursor'].includes(k))||value.limit!==undefined&&(typeof value.limit!=='string'||!/^([1-9]|[1-4][0-9]|50)$/.test(value.limit))||value.cursor!==undefined&&(typeof value.cursor!=='string'||!value.cursor.length||value.cursor.length>4096))throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);
 return{limit:value.limit===undefined?20:Number(value.limit),cursor:value.cursor===undefined?null:value.cursor as string};
}
