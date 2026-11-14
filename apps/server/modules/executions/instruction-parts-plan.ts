import {TextDecoder} from 'node:util';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {planContextText} from '../context/context-text-plan.ts';

export interface InstructionBodyRef{artifactId:string;bytes:number;contentHash:string;mediaType:'text/plain;charset=utf-8'|'text/markdown;charset=utf-8'}
/** 보호 reader가 이미 선택한 원 bytes의 고정 계산이다. 이 함수는 읽기/실행 권위를 발급하지 않는다. */
export function instructionPartsPlan(raw:unknown,input:Uint8Array){
 const fail=():never=>{throw new AuthFailure('INSTRUCTION_PARTS_UNAVAILABLE',422);};
 if(!recordV1(raw,['artifactId','bytes','contentHash','mediaType'])||!uuidV1(raw.artifactId)||!hashV1(raw.contentHash)||!Number.isSafeInteger(raw.bytes)||raw.bytes<1||raw.bytes>2097152||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(raw.mediaType)||!(input instanceof Uint8Array)||input.byteLength!==raw.bytes)return fail();
 const bodyRef=cloneV1(raw) as unknown as InstructionBodyRef,bytes=Buffer.from(input);let body:string;
 try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return fail();}
 if(!body.isWellFormed()||!Buffer.from(body,'utf8').equals(bytes)||contentHash(body)!==bodyRef.contentHash)return fail();
 let split:ReturnType<typeof planContextText>;
 try{split=planContextText([{itemId:'instruction',category:'LATEST_INSTRUCTIONS',required:true,sourceRef:{kind:'ARTIFACT',id:bodyRef.artifactId,contentHash:bodyRef.contentHash},reason:'원 지시 부분계획',state:'AVAILABLE',bodyRef,body}],{maxPartBytes:65536,maxParts:200});}catch{return fail();}
 if(split.missingRequired.length||split.items.length!==1||split.items[0]?.includedState!=='INCLUDED'||!split.parts.length||split.parts.length>200)return fail();
 let offset=0;const parts=split.parts.map((p,i)=>{const part={partIndex:i+1,byteOffset:offset,utf8Bytes:p.utf8Bytes,contentHash:p.contentHash};offset+=p.utf8Bytes;return part;});if(offset!==bytes.length)return fail();
 const plan={schemaVersion:1 as const,purpose:'INSTRUCTION_PARTS_PLAN' as const,algorithm:'UTF8_CODEPOINT_64K_V1' as const,bodyRef,limits:{maxSourceBytes:2097152,maxPartBytes:65536,maxParts:200},parts};
 return {partsRef:{id:bodyRef.artifactId,version:1,contentHash:contentHash(canonicalJson(plan))},plan};
}
