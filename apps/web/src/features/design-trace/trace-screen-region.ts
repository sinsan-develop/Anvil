import {ApiClient,ApiError} from '../../api/client.ts';
import {readDesignIndex,type ScreenRegion} from './design-index-api.ts';
import type {PlanRef} from './work-plan-api.ts';
import type {TraceRef} from './trace-api.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** 고정 참조를 등록 시안과 대조한다. 원문 열기는 기존 readRegisteredScreen에서 다시 검증한다. */
export async function readTraceScreenRegion(client:ApiClient,projectId:string,sourceRef:PlanRef,raw:TraceRef,active:()=>boolean):Promise<ScreenRegion|null>{
 const target=structuredClone(raw),source=structuredClone(sourceRef);
 if(!target||Object.keys(target).sort().join(',')!=='anchor,id,kind,localCode,versionRef'||target.kind!=='SCREEN_REGION'||!uuid.test(target.id)||typeof target.localCode!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(target.localCode)||typeof target.anchor!=='string'||!/^line:[1-9][0-9]{0,7}$/.test(target.anchor)||!target.versionRef||Object.keys(target.versionRef).sort().join(',')!=='contentHash,id,version'||!uuid.test(target.versionRef.id)||!Number.isSafeInteger(target.versionRef.version)||target.versionRef.version<1||!/^[a-f0-9]{64}$/.test(target.versionRef.contentHash))throw new ApiError('TRACE_SCREEN_REFERENCE_INVALID');
 if(!active())return null;
 const index=await readDesignIndex(client,projectId,source);if(!active())return null;
 const matches=index.screenRegions.filter(r=>r.id===target.id&&r.screenCode===target.localCode&&r.anchor===target.anchor&&r.documentRef.id===target.versionRef.id&&r.documentRef.version===target.versionRef.version&&r.documentRef.contentHash===target.versionRef.contentHash);
 if(matches.length!==1)throw new ApiError('TRACE_SCREEN_REFERENCE_UNVERIFIED');
 return structuredClone(matches[0]!);
}
