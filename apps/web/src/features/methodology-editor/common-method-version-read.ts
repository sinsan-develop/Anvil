import {ApiClient,ApiError} from '../../api/client.ts';
import {validateMethodVersion,type MethodSummary,type MethodVersion} from './api.ts';
import {ordered} from '../knowledge/review-view.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** 기존 읽기 계약만 소비한다. 목록 최신 이름/목적을 과거 버전에 강제하지 않는다. */
export async function readCommonMethodAtVersion(client:ApiClient,selected:MethodSummary,version:number):Promise<MethodVersion>{
 if(!selected||!uuid.test(selected.ref?.id)||!Number.isSafeInteger(selected.ref.version)||selected.ref.version<1||!/^[0-9a-f]{64}$/.test(selected.ref.contentHash)||!['SYSTEM','USER_COMMON'].includes(selected.scope)||selected.scope==='USER_COMMON'&&selected.systemCode!==null||selected.scope==='SYSTEM'&&typeof selected.systemCode!=='string'||!Number.isSafeInteger(version)||version<1||version>selected.ref.version)throw new ApiError('CLIENT_PATH_INVALID');
 const value=await client.get<MethodVersion>(`/api/v1/methodologies/${selected.ref.id}/versions/${version}`);
 if(!value||value.ref?.id!==selected.ref.id||value.ref.version!==version||typeof value.name!=='string'||typeof value.purpose!=='string')throw new ApiError('RESPONSE_INVALID');
 if(version===selected.ref.version&&(value.ref.contentHash!==selected.ref.contentHash||value.name!==selected.name||value.purpose!==selected.purpose))throw new ApiError('RESPONSE_INVALID');
 validateMethodVersion(value,{ref:value.ref,name:value.name,purpose:value.purpose,scope:selected.scope,systemCode:selected.systemCode});
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(value.graph))))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==value.ref.contentHash)throw new ApiError('RESPONSE_INVALID');
 return value;
}
