import {ApiClient,ApiError} from '../../api/client.ts';
import {readFormVersion,type FormVersion} from './forms-api.ts';
import {ordered} from '../knowledge/review-view.ts';
const hash=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function verifyFormVersionIntegrity(raw:FormVersion):Promise<FormVersion>{
 if(!raw?.definition||!['SYSTEM','USER_COMMON'].includes(raw.definition.scope))throw new ApiError('RESPONSE_INVALID');
 const value=readFormVersion(raw,{ref:raw.ref,name:raw.definition.name,formCode:raw.definition.formCode,scope:raw.definition.scope as 'SYSTEM'|'USER_COMMON'});
 if(await hash(ordered(value.definition))!==value.ref.contentHash||await hash(value.authoringStandard.content)!==value.authoringStandard.ref.contentHash)throw new ApiError('RESPONSE_INVALID');
 return value;
}
/** 기존 보호 GET만 사용한다. 과거 이름/항목을 최신본으로 덮지 않는다. */
export async function readFormAtVersion(client:ApiClient,current:FormVersion,version:number):Promise<FormVersion>{
 const base=structuredClone(current);
 if(!base?.ref||!Number.isSafeInteger(version)||version<1||version>base.ref.version)throw new ApiError('CLIENT_PATH_INVALID');
 await verifyFormVersionIntegrity(base);
 const raw=await client.get<FormVersion>(`/api/v1/forms/${base.ref.id}/versions/${version}`);
 if(!raw||raw.ref?.id!==base.ref.id||raw.ref.version!==version||raw.definition?.scope!==base.definition.scope||version===base.ref.version&&raw.ref.contentHash!==base.ref.contentHash)throw new ApiError('RESPONSE_INVALID');
 return verifyFormVersionIntegrity(raw);
}
