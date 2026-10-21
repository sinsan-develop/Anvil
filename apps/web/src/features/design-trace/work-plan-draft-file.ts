import {ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {workPlanCardShape} from './work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
function fail(code='WORK_PLAN_DRAFT_FILE_INVALID'):never{throw new ApiError(code);}
/** 현재 문서/설계/검토 참조를 그대로 둔 카드 입력이다. 저장/권한/확정/구조 검수 증거가 아니다. */
export function importWorkPlanDraftFile(buffer:DocumentBuffer,session:DocumentSession,raw:string):DocumentBuffer{
 const s=buffer.workPlanState;
 if(buffer.ownerUserId!==session.user.id||buffer.pending||buffer.designIndexState||buffer.proposalState||buffer.importState||buffer.importPreparationId||!s||!s.input.designRef||!s.designIndex||s.pending||s.result||s.uncertain||s.sent||s.approval||s.decision||s.traceLink)fail('WORK_PLAN_DRAFT_FILE_LOCKED');
 if(ordered(s.input.documentRef)!==ordered({id:buffer.documentId,version:buffer.baseVersion,contentHash:buffer.baseHash})||ordered(s.designIndex.documentRef)!==ordered(s.input.designRef))fail('WORK_PLAN_DRAFT_FILE_LOCKED');
 try{
  if(typeof raw!=='string'||!raw.isWellFormed()||new TextEncoder().encode(raw).length>2097152)fail();
  const stack:{keys:Set<string>|null;key:boolean}[]=[];
  for(const match of raw.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)){
   const token=match[0];if(token==='{'||token==='['){if(stack.length>=64)fail();stack.push({keys:token==='{'?new Set():null,key:token==='{'});}
   else if(token==='}'||token===']')stack.pop();
   else{const f=stack.at(-1);if(f?.keys){if(token===',')f.key=true;else if(token===':')f.key=false;else if(f.key&&token.startsWith('"')){const k=JSON.parse(token);if(f.keys.has(k))fail();f.keys.add(k);}}}
  }
  const v=JSON.parse(raw),scan=(x:any):void=>{if(typeof x==='string'){if(!x.isWellFormed())fail();if(/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(x))fail('WORK_PLAN_DRAFT_FILE_SENSITIVE');}else if(typeof x==='number'&&!Number.isSafeInteger(x))fail();else if(x&&typeof x==='object')for(const c of Object.values(x))scan(c);};scan(v);
  if(!v||Array.isArray(v)||Object.keys(v).sort().join(',')!=='designRef,documentRef,reason,screenReviewRefs,tasks'||ordered(v.documentRef)!==ordered(s.input.documentRef)||ordered(v.designRef)!==ordered(s.input.designRef)||ordered(v.screenReviewRefs)!==ordered(s.input.screenReviewRefs)||typeof v.reason!=='string'||!v.reason.trim()||v.reason.length>20000||!Array.isArray(v.tasks)||v.tasks.length>200||!v.tasks.every(workPlanCardShape))fail();
  return {...buffer,dirty:true,workPlanState:{...s,failure:null,input:{...s.input,tasks:structuredClone(v.tasks),reason:v.reason}}};
 }catch(cause){if(cause instanceof ApiError)throw cause;return fail();}
}
