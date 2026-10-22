/** 정상 저장 검수 seed 직후의 조회만 검사한다. DB·Agent 생성이나 실행은 하지 않는다. */
import {readNextActionBasis} from '../../../apps/web/src/features/session-detail/next-action-basis-api.ts';
import type {ApiClient} from '../../../apps/web/src/api/client.ts';
type Inputs=Parameters<typeof readNextActionBasis>;
type Counts={reviews:number;results:number;assignments:number;commands:number;authorizations:number;audits:number};
const fail=():never=>{throw Error('NEXT_ACTION_BASIS_READ_QA_FAILED');};
export function nextActionBasisReadQaMode(env:NodeJS.ProcessEnv){if(env.ANVIL_FN10_NEXT_ACTION_BASIS_QA===undefined)return false;if(env.ANVIL_FN10_NEXT_ACTION_BASIS_QA!=='1'||env.ANVIL_FN12_RESULT_REVIEW_QA!=='1')throw Error('NEXT_ACTION_BASIS_QA_MODE_INVALID');return true;}
function counts(value:Counts){const keys=['reviews','results','assignments','commands','authorizations','audits'];if(Object.keys(value).sort().join(',')!==keys.sort().join(',')||Object.values(value).some(v=>!Number.isSafeInteger(v)||v<0))fail();return JSON.stringify(keys.map(k=>value[k as keyof Counts]));}
export async function verifyNextActionBasisReadQa(v:{client:ApiClient;original:Inputs[1];confirmed:Inputs[2];review:Inputs[3];active:()=>boolean;counts:()=>Promise<Counts>;denied:(kind:'OUTSIDER'|'ANONYMOUS'|'EXTRA_QUERY')=>Promise<{status:number;body:unknown}>}){
 const before=counts(await v.counts()),basis=await readNextActionBasis(v.client,v.original,v.confirmed,v.review,v.active);if(!basis)fail();
 for(const kind of ['OUTSIDER','ANONYMOUS','EXTRA_QUERY']as const){if(!v.active())fail();const r=await v.denied(kind),b=r.body as any;if(r.status!==(kind==='OUTSIDER'?404:kind==='ANONYMOUS'?401:400)||!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).sort().join(',')!==['code','message','requestId','targetId','retryDisposition','details'].sort().join(',')||b.code!==(kind==='OUTSIDER'?'NOT_FOUND':kind==='ANONYMOUS'?'AUTH_REQUIRED':'INPUT_INVALID')||b.message!=='요청을 처리하지 못했습니다'||typeof b.requestId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(b.requestId)||b.targetId!==null||b.retryDisposition!=='not-retryable'||!b.details||typeof b.details!=='object'||Array.isArray(b.details)||Object.keys(b.details).length!==0)fail();}
 if(!v.active()||counts(await v.counts())!==before)fail();
 return ['SELECTED_REVIEW_BASIS_WEB_READ','OUTSIDER_ANONYMOUS_QUERY_DENIED_NO_CONTENT','READ_LEDGER_COUNTS_UNCHANGED'];
}
