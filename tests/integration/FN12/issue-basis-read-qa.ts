/** 정상 원제출 seed 뒤의 새 읽기만 확인한다. 생성/Agent 호출/DB 적용을 하지 않는다. */
import {readStoredIssueBasis} from '../../../apps/web/src/features/decisions/issue-basis-api.ts';
import type {ApiClient} from '../../../apps/web/src/api/client.ts';
type Counts={reviews:number;results:number;observations:number;acknowledgements:number;assignments:number;commands:number;authorizations:number;audits:number};
const keys=['reviews','results','observations','acknowledgements','assignments','commands','authorizations','audits']as const;
function fail():never{throw Error('STORED_ISSUE_BASIS_READ_QA_FAILED');}
export function storedIssueBasisReadQaMode(env:NodeJS.ProcessEnv){if(env.ANVIL_FN12_STORED_ISSUE_BASIS_QA===undefined)return false;if(env.ANVIL_FN12_STORED_ISSUE_BASIS_QA!=='1'||env.ANVIL_FN12_RESULT_REVIEW_QA!=='1'||env.ANVIL_FN10_NEXT_ACTION_BASIS_QA!==undefined)throw Error('STORED_ISSUE_BASIS_QA_MODE_INVALID');return true;}
const counts=(v:Counts)=>{if(!v||Object.keys(v).sort().join(',')!==[...keys].sort().join(',')||keys.some(k=>!Number.isSafeInteger(v[k])||v[k]<0))fail();return JSON.stringify(keys.map(k=>v[k]));};
export async function verifyStoredIssueBasisReadQa(v:{client:ApiClient;original:Parameters<typeof readStoredIssueBasis>[1];active:()=>boolean;counts:()=>Promise<Counts>;denied:(kind:'OUTSIDER'|'ANONYMOUS'|'EXTRA_QUERY')=>Promise<{status:number;body:unknown}>}){
 if(!v.active())fail();const before=counts(await v.counts());if(!v.active())fail();const basis=await readStoredIssueBasis(v.client,v.original,v.active);
 if(!basis||basis.ack!==null||basis.classification.kind!=='UNVERIFIED_CAUSE'||basis.causeUnestablished!==true)fail();
 for(const kind of ['OUTSIDER','ANONYMOUS','EXTRA_QUERY']as const){if(!v.active())fail();const r=await v.denied(kind),b=r.body as any;if(r.status!==(kind==='OUTSIDER'?404:kind==='ANONYMOUS'?401:400)||!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).sort().join(',')!==['code','message','requestId','targetId','retryDisposition','details'].sort().join(',')||b.code!==(kind==='OUTSIDER'?'NOT_FOUND':kind==='ANONYMOUS'?'AUTH_REQUIRED':'INPUT_INVALID')||b.message!=='요청을 처리하지 못했습니다'||typeof b.requestId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(b.requestId)||b.targetId!==null||b.retryDisposition!=='not-retryable'||!b.details||typeof b.details!=='object'||Array.isArray(b.details)||Object.keys(b.details).length)fail();}
 if(!v.active())fail();const after=counts(await v.counts());if(!v.active()||after!==before)fail();return['STORED_ISSUE_BASIS_EMPTY_ACK_WEB_READ','ISSUE_BASIS_DENIED_NO_CONTENT','ISSUE_BASIS_READ_LEDGER_COUNTS_UNCHANGED'];
}
