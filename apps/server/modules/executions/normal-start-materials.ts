import {contentHash} from '../../../../contracts/canonical.ts';
import {hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';

const limit=2*1024*1024;
function deny(code='EXECUTION_MATERIAL_REJECTED',status=412):never{throw new AuthFailure(code,status);}
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
/** 재구성한 원본 전체와 등록된 부분을 각각 검산한다. 원본이 등록 hash/길이와 다르면 부분 bytes를 만들지 않는다.
 * 이 함수는 보호 읽기·nonce 소비·전달을 수행하지 않으며 결과는 실행 허가가 아니다. */
export function checkedMaterialPart(raw:string,source:{sourceBytes:unknown;contentHash:unknown},part:{byteOffset:unknown;utf8Bytes:unknown;contentHash:unknown}){
 if(typeof raw!=='string'||!positive(source?.sourceBytes)||source.sourceBytes>limit||!hashV1(source.contentHash)||
   !Number.isSafeInteger(part?.byteOffset)||Number(part.byteOffset)<0||!positive(part.utf8Bytes)||!hashV1(part.contentHash))deny();
 const bytes=Buffer.from(raw,'utf8'),offset=Number(part.byteOffset),end=offset+part.utf8Bytes;
 if(bytes.length!==source.sourceBytes||end>bytes.length||bytes.toString('utf8')!==raw||contentHash(bytes)!==source.contentHash)deny();
 const selected=bytes.subarray(offset,end);
 if(selected.length!==part.utf8Bytes||contentHash(selected)!==part.contentHash)deny();
 return selected;
}
