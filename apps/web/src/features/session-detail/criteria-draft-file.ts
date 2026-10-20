import {ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {criteriaRows,resultTestKinds,type CriteriaRow} from './result-criteria-api.ts';
const max=2097152,exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const fail=():never=>{throw new ApiError('RESULT_CRITERIA_DRAFT_INVALID');};
async function digest(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function payload(assignment:ConfirmedAssignmentView,rows:CriteriaRow[],reason:string){
 const a=structuredClone(assignment),expected=criteriaRows(a);
 if(a.snapshot.contentConfirmed!==true||a.snapshot.executionAuthorized!==false||a.snapshot.dispatchPerformed!==false||await digest(a.snapshot)!==a.ref.contentHash||!expected.length||expected.length>100||!Array.isArray(rows)||rows.length!==expected.length||typeof reason!=='string'||!reason.isWellFormed()||reason.length>20000)fail();
 const seen=new Set<string>();for(const r of rows){const key=r.field+':'+r.index;if(!exact(r,['field','index','criterionId','testId','kind'])||!expected.some(e=>e.field===r.field&&e.index===r.index)||seen.has(key)||typeof r.criterionId!=='string'||r.criterionId.length>80||!r.criterionId.isWellFormed()||typeof r.testId!=='string'||r.testId.length>80||!r.testId.isWellFormed()||r.kind!==''&&!resultTestKinds.includes(r.kind as any))fail();seen.add(key);}
 const v={format:'ANVIL_RESULT_CRITERIA_DRAFT',schemaVersion:1,projectId:a.projectId,assignmentRef:a.ref,rows:structuredClone(rows),reason};
 if(/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(JSON.stringify(v)))throw new ApiError('RESULT_CRITERIA_DRAFT_SENSITIVE');
 return v;
}
/** 사용자 선택 파일의 무결성/정확 임무만 대조한다. 서명·작성자 진위·저장/실행 명령이 아니다. */
export async function encodeCriteriaDraft(assignment:ConfirmedAssignmentView,rows:CriteriaRow[],reason:string):Promise<string>{
 const v=await payload(assignment,rows,reason),text=JSON.stringify({...v,contentHash:await digest(v)},null,2);if(new TextEncoder().encode(text).length>max)fail();return text;
}
export async function decodeCriteriaDraft(assignment:ConfirmedAssignmentView,text:string):Promise<{rows:CriteriaRow[];reason:string}>{
 try{
  if(typeof text!=='string'||!text.isWellFormed()||new TextEncoder().encode(text).length>max)fail();const v=JSON.parse(text);
  if(!exact(v,['format','schemaVersion','projectId','assignmentRef','rows','reason','contentHash'])||v.format!=='ANVIL_RESULT_CRITERIA_DRAFT'||v.schemaVersion!==1||v.projectId!==assignment.projectId||ordered(v.assignmentRef)!==ordered(assignment.ref))fail();
  const p=await payload(assignment,v.rows,v.reason);if(v.contentHash!==await digest(p))fail();return{rows:structuredClone(p.rows),reason:p.reason};
 }catch(e){if(e instanceof ApiError)throw e;return fail();}
}
