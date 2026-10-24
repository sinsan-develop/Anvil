import {ApiClient,ApiError} from '../../api/client.ts';
import {postDocumentCommand,type DocumentSession,type DocumentWrite} from '../design-trace/editor-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from './result-api.ts';
import {readStoredUnderstandingHistory,validateUnderstandingHistory,type UnderstandingHistoryView} from './understanding-history-api.ts';
import type {UnderstandingRecord} from '../../../../server/modules/executions/execution-understanding.ts';
type Input=UnderstandingRecord['snapshot']['input'];
export interface UnderstandingReviewBuffer{bindingId:string;ownerUserId:string;ownerClientId:string;result:SubmittedResultView;base:UnderstandingRecord;form:Omit<Input,'items'>&{items:(Omit<Input['items'][number],'judgement'>&{judgement:Input['items'][number]['judgement']|''})[]};pending:DocumentWrite|null;stored:UnderstandingRecord|null;uncertain:boolean;failure:{code:string;status:number}|null}
export interface UnderstandingReviewStorage{buffers:Record<string,UnderstandingReviewBuffer|null>;onChange:(key:string,change:(value:UnderstandingReviewBuffer|null)=>UnderstandingReviewBuffer|null)=>void}
export class UnderstandingReadbackUnconfirmed extends ApiError{readonly writeMayHaveApplied=true;}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),uuid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),safeText=(v:unknown)=>typeof v==='string'&&!!v.trim()&&v.length<=20000&&!/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9_.~+\/-]{16,}|\b(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*["']?[^\s"']{4,}/i.test(v);
function fail():never{throw new ApiError('UNDERSTANDING_REVIEW_INPUT_INVALID');}
async function hash(v:unknown){const bytes=new TextEncoder().encode(ordered(v));if(bytes.length>2*1024*1024)fail();return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function understandingReviewKey(session:DocumentSession,result:SubmittedResultView){return[session.user.id,session.clientId,result.snapshot.scope.projectId,ordered(result.ref)].join(':');}
export async function beginUnderstandingReview(rawResult:SubmittedResultView,rawHistory:UnderstandingHistoryView,rawBaseRef:UnderstandingRecord['ref'],rawSession:DocumentSession):Promise<UnderstandingReviewBuffer>{
 const session=structuredClone(rawSession),baseRef=structuredClone(rawBaseRef),result=structuredClone(rawResult),history=structuredClone(rawHistory),scope=result.snapshot.scope,e=scope.executionRef;
 if(!uuid(session.user.id)||!uuid(session.clientId)||await hash(result.snapshot)!==result.ref.contentHash)fail();
 const validated=await validateUnderstandingHistory(history,{projectId:scope.projectId,executionId:e.id,executionGeneration:e.version}),base=validated?.items.find(row=>same(row.ref,baseRef));if(!base)fail();
 return{bindingId:crypto.randomUUID(),ownerUserId:session.user.id,ownerClientId:session.clientId,result,base:structuredClone(base!),form:{...structuredClone(base!.snapshot.input),reason:'',items:base!.snapshot.input.items.map(item=>({...structuredClone(item),judgement:'',reason:''}))},pending:null,stored:null,uncertain:false,failure:null};
}
export async function prepareUnderstandingReview(raw:UnderstandingReviewBuffer,rawSession:DocumentSession,generation:number):Promise<DocumentWrite>{
 const session=structuredClone(rawSession),b=structuredClone(raw),scope=b.result.snapshot.scope,e=scope.executionRef;
 if(b.ownerUserId!==session.user.id||b.ownerClientId!==session.clientId||!uuid(session.user.id)||!uuid(session.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken)||!uuid(scope.projectId)||!uuid(e.id)||!Number.isSafeInteger(e.version)||e.version<1||!Number.isSafeInteger(generation)||generation<1||b.stored||await hash(b.result.snapshot)!==b.result.ref.contentHash||await hash(b.base.snapshot)!==b.base.ref.contentHash||!same(b.base.snapshot.scope,{projectId:scope.projectId,executionId:e.id,executionGeneration:e.version}))fail();
 const i=b.form,base=b.base.snapshot.input;
 if(!same(Object.keys(i).sort(),['bundleRef','responseRef','subjectBindingRef','criteriaVersion','items','reason'].sort())||!['bundleRef','responseRef','subjectBindingRef','criteriaVersion'].every(k=>same(i[k as keyof typeof i],base[k as keyof typeof base]))||!safeText(i.reason)||!Array.isArray(i.items)||i.items.length!==6||new Set(i.items.map(row=>row.code)).size!==6)fail();
 for(const row of i.items){const prior=base.items.find(v=>v.code===row.code);if(!prior||!same(Object.keys(row).sort(),['code','sourceRefs','responsePartRefs','judgement','reason'].sort())||!same(prior.sourceRefs,row.sourceRefs)||!same(prior.responsePartRefs,row.responsePartRefs)||!['MATCH','MISMATCH','INSUFFICIENT'].includes(row.judgement)||!safeText(row.reason))fail();}
 const expected:Omit<DocumentWrite,'commandId'>={schemaVersion:1,projectId:scope.projectId,clientId:session.clientId,controlGeneration:generation,operation:'reviewUnderstanding',targetId:e.id,expectedVersion:e.version,baselineRefs:[],approvalRef:null,payload:i};await hash(expected);
 if(b.pending){const{commandId,...value}=b.pending;if(!uuid(commandId)||!same(value,expected))fail();return structuredClone(b.pending);}if(b.uncertain)fail();return{...expected,commandId:crypto.randomUUID()};
}
export async function saveUnderstandingReview(client:ApiClient,raw:UnderstandingReviewBuffer,rawSession:DocumentSession,active:()=>boolean):Promise<UnderstandingRecord|null>{
 const b=structuredClone(raw),session=structuredClone(rawSession);
 if(!b.pending)fail();const command=await prepareUnderstandingReview(b,session,b.pending!.controlGeneration);if(!active())return null;
 const receipt=await postDocumentCommand(client,command,session.csrfToken);if(!active())return null;
 try{const history=await readStoredUnderstandingHistory(client,b.result,active);if(!history||!active())return null;const rows=history.items.filter(row=>row.snapshot.request.commandId===command.commandId),row=rows[0],d=receipt.data;
  if(rows.length!==1||!row||!same(row.snapshot.request,command)||!same(row.snapshot.input,command.payload)||row.snapshot.reviewer.userId!==session.user.id||row.snapshot.reviewer.clientId!==session.clientId||receipt.targetId!==row.ref.id||receipt.version!==row.ref.version||d?.status!=='SYNTHETIC_UNDERSTANDING_REVIEWED'||!same(d.ref,row.ref)||!same(d.snapshot,row.snapshot)||!same(Object.keys(d).sort(),['status','ref','snapshot'].sort()))throw new ApiError('UNDERSTANDING_REVIEW_RESPONSE_INVALID');
  return structuredClone(row);
 }catch(cause){const e=cause instanceof ApiError?cause:new ApiError('UNDERSTANDING_REVIEW_RESPONSE_INVALID');throw new UnderstandingReadbackUnconfirmed(e.code,e.status);}
}
