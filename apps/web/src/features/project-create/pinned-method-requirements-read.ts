import {ApiClient,ApiError} from '../../api/client.ts';
import type {VersionRef} from '../../../../../contracts/generated-types.ts';
import {validateMethodVersion,type MethodVersion} from '../methodology-editor/api.ts';
import {ordered} from '../knowledge/review-view.ts';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** 선택한 고정 참조의 저장 원문만 읽는다. 현재 확정 유효성·준비·권한 판정은 하지 않는다. */
export async function readPinnedMethodRequirements(client:ApiClient,reference:VersionRef,current:()=>boolean=()=>true):Promise<MethodVersion|null>{
 if(!reference||typeof reference!=='object'||Object.keys(reference).sort().join(',')!=='contentHash,id,version'||!uuid.test(reference.id)||!Number.isSafeInteger(reference.version)||reference.version<1||!/^[0-9a-f]{64}$/.test(reference.contentHash))throw new ApiError('CLIENT_PATH_INVALID');
 const ref={...reference};
 if(!current())return null;
 const value=await client.get<MethodVersion>(`/api/v1/methodologies/${ref.id}/versions/${ref.version}`);
 if(!current())return null;
 if(!value||value.ref?.id!==ref.id||value.ref.version!==ref.version||value.ref.contentHash!==ref.contentHash||typeof value.name!=='string'||typeof value.purpose!=='string'||!['SYSTEM','USER_COMMON'].includes(value.scope)||value.scope==='USER_COMMON'&&value.systemCode!==null||value.scope==='SYSTEM'&&(typeof value.systemCode!=='string'||!value.systemCode.trim()))throw new ApiError('RESPONSE_INVALID');
 validateMethodVersion(value,{ref,name:value.name,purpose:value.purpose,scope:value.scope,systemCode:value.systemCode});
 if(!current())return null;
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(value.graph))))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(!current())return null;
 if(hash!==ref.contentHash)throw new ApiError('RESPONSE_INVALID');
 return value;
}
