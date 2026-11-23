import {readUnderstandingApprovalCommand} from '../decisions/understanding-review-approval-api.ts';
import {readNormalUnderstandingHistory,type NormalUnderstandingHistoryView,type UnderstandingHistoryScope} from './understanding-history-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {PreparationRecord} from '../workspace/responsible-session-api.ts';
import type {NormalUnderstandingRangeResult} from '../workspace/NormalUnderstandingDiscovery.tsx';
import {understandingApprovalRef} from '../decisions/understanding-review-approval-api.ts';
import type {ApprovalRequestWork} from '../decisions/api.ts';
import {ApiClient,ApiError} from '../../api/client.ts';
import {postDocumentCommand,type DocumentSession,type DocumentWrite} from '../design-trace/editor-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from './result-api.ts';
import {readStoredUnderstandingHistory,validateUnderstandingHistory,type UnderstandingHistoryView} from './understanding-history-api.ts';
import type {UnderstandingRecord} from '../../../../server/modules/executions/execution-understanding.ts';
type Input=UnderstandingRecord['snapshot']['input'];
export interface UnderstandingReviewBuffer{approval?:{work:ApprovalRequestWork|null;requestId:string};bindingId:string;ownerUserId:string;ownerClientId:string;result:SubmittedResultView;base:UnderstandingRecord;form:Omit<Input,'items'>&{items:(Omit<Input['items'][number],'judgement'>&{judgement:Input['items'][number]['judgement']|''})[]};pending:DocumentWrite|null;stored:UnderstandingRecord|null;uncertain:boolean;failure:{code:string;status:number}|null}
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
 if(b.pending?.approvalRef!==undefined&&b.pending.approvalRef!==null&&!understandingApprovalRef(b.pending.approvalRef))fail();
 const expected:Omit<DocumentWrite,'commandId'>={schemaVersion:1,projectId:scope.projectId,clientId:session.clientId,controlGeneration:generation,operation:'reviewUnderstanding',targetId:e.id,expectedVersion:e.version,baselineRefs:[],approvalRef:b.pending?.approvalRef??null,payload:i};await hash(expected);
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

export interface NormalInitialUnderstandingBasis{scope:UnderstandingHistoryScope;assignmentRef:PlanRef;preparationRef:PlanRef;rangeRequestRef:PlanRef;bundleRef:PlanRef;subjectBindingRef:PlanRef;basisRefs:PlanRef[];responseRef:PlanRef;responsePartRefs:PlanRef[]}
export type NormalInitialUnderstandingRecord=NormalUnderstandingHistoryView['items'][number];
export interface NormalInitialUnderstandingReviewBuffer{ownerEpoch:string;bindingId:string;ownerUserId:string;ownerClientId:string;basis:NormalInitialUnderstandingBasis;form:UnderstandingReviewBuffer['form'];pending:DocumentWrite|null;stored:NormalInitialUnderstandingRecord|null;uncertain:boolean;failure:{code:string;status:number}|null;approval?:{work:ApprovalRequestWork|null;requestId:string}}
export interface NormalInitialUnderstandingReviewStorage{buffers:Record<string,NormalInitialUnderstandingReviewBuffer|null>;read:(key:string)=>NormalInitialUnderstandingReviewBuffer|null;onChange:(key:string,change:(prior:NormalInitialUnderstandingReviewBuffer|null)=>NormalInitialUnderstandingReviewBuffer|null)=>void}
const normalRef=(v:any):v is PlanRef=>!!v&&same(Object.keys(v).sort(),['contentHash','id','version'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);
const normalRefs=(v:any):v is PlanRef[]=>Array.isArray(v)&&v.length>0&&v.length<=200&&v.every(normalRef)&&new Set(v.map(ordered)).size===v.length;
/** 보호 reader가 검산한 현재 BODY와 동일 EP 원형을 다시 대조한다. 반환/보존은 refs뿐이다. */
export async function normalInitialUnderstandingBasis(source:Extract<NormalUnderstandingRangeResult,{status:'RANGE_STORED'}>,preparation:PreparationRecord,retainedPreparationRef:PlanRef,active:()=>boolean=()=>true):Promise<NormalInitialUnderstandingBasis>{
 const check=()=>{if(!active()||source.status!=='RANGE_STORED'||source.currentness!=='CURRENT'||source.selectionAvailable!==true||Date.parse(source.expiresAt)<=Date.now()||!Number.isFinite(Date.parse(source.expiresAt)))fail();};check();
 const r=source.request,p=preparation,s=p.snapshot,i=s?.intent,b=source.body;
 const digest=async(value:unknown)=>{check();const bytes=new TextEncoder().encode(ordered(value));if(bytes.length>2097152){bytes.fill(0);fail();}try{const result=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');check();return result;}finally{bytes.fill(0);}};
 if(!normalRef(p.ref)||p.ref.version!==1||!same(p.ref,retainedPreparationRef)||!same(p.ref,r.preparationRef)||p.projectId!==r.projectId||i?.projectId!==r.projectId||i?.mode!=='CONTEXT_REVIEW'||i?.connectionKind!=='REGISTERED_DEFINITION'||!same(i.assignmentRef,r.assignmentRef)||!normalRef(i.roleBindingRef)||!normalRef(i.contextBundleRef)||!same(b.contextBundleRef,i.contextBundleRef)||!normalRefs(s.basisRefs)||s.executionAuthorized!==false||s.dispatchPerformed!==false||!normalRef(source.responseRef)||source.responseRef.version!==1||!normalRefs(source.partRefs)||!Array.isArray(b.parts)||b.parts.length!==source.partRefs.length||b.projectId!==r.projectId||b.executionId!==r.executionId||b.executionGeneration!==r.executionGeneration||!normalRef(r.requestRef)||r.requestRef.version!==1||!same(b.requestRef,r.requestRef)||b.kind!=='FIXED_RANGE_SELECTION'||b.attribution!=='SESSION_ONLY'||b.wholeConversationComplete!==false||b.executionAuthorized!==false||!uuid(r.projectId)||!uuid(r.executionId)||!Number.isSafeInteger(r.executionGeneration)||r.executionGeneration<1||!normalRef(r.assignmentRef))fail();
 if(await digest(s)!==p.ref.contentHash||await digest(b)!==source.responseRef.contentHash)fail();check();
 for(const [n,part]of b.parts.entries()){if(source.partRefs[n]!.version!==1||await digest(part)!==source.partRefs[n]!.contentHash||part.kind!=='ASSISTANT_TEXT')fail();check();}
 return structuredClone({scope:{projectId:r.projectId,executionId:r.executionId,executionGeneration:r.executionGeneration},assignmentRef:r.assignmentRef,preparationRef:p.ref,rangeRequestRef:r.requestRef,bundleRef:i.contextBundleRef,subjectBindingRef:i.roleBindingRef,basisRefs:s.basisRefs,responseRef:source.responseRef,responsePartRefs:source.partRefs});
}
// 인증 값은 이 모듈 밖으로 반환하거나 draft에 넣지 않는다. transport/인증 epoch마다 분리한다.
const normalReviewOwners=new WeakMap<ApiClient,WeakMap<typeof fetch,{userId:string;clientId:string;csrf:string;epoch:string}[]>>();
export function normalInitialUnderstandingOwner(client:ApiClient,s:DocumentSession){
 if(!uuid(s.user.id)||!uuid(s.clientId)||!(/^[A-Za-z0-9_-]{43}$/).test(s.csrfToken))fail();
 let transports=normalReviewOwners.get(client);if(!transports){transports=new WeakMap();normalReviewOwners.set(client,transports);}let owners=transports.get(client.transport);if(!owners){owners=[];transports.set(client.transport,owners);}
 let owner=owners.find(v=>v.userId===s.user.id&&v.clientId===s.clientId&&v.csrf===s.csrfToken);if(!owner){owner={userId:s.user.id,clientId:s.clientId,csrf:s.csrfToken,epoch:crypto.randomUUID()};owners.push(owner);}return owner.epoch;
}
export function normalInitialUnderstandingReviewKey(b:NormalInitialUnderstandingBasis,s:DocumentSession,ownerEpoch:string){if(!uuid(ownerEpoch))fail();return ordered([ownerEpoch,s.user.id,s.clientId,b.scope,b.assignmentRef,b.preparationRef,b.rangeRequestRef,b.responseRef]);}
export function beginNormalInitialUnderstandingReview(raw:NormalInitialUnderstandingBasis,s:DocumentSession,ownerEpoch:string):NormalInitialUnderstandingReviewBuffer{
 const b=structuredClone(raw);if(!uuid(ownerEpoch)||!uuid(s.user.id)||!uuid(s.clientId)||!normalRefs(b.basisRefs)||!normalRefs(b.responsePartRefs)||![b.assignmentRef,b.preparationRef,b.rangeRequestRef,b.bundleRef,b.subjectBindingRef,b.responseRef].every(normalRef))fail();
 return{ownerEpoch,bindingId:crypto.randomUUID(),ownerUserId:s.user.id,ownerClientId:s.clientId,basis:b,form:{bundleRef:b.bundleRef,responseRef:b.responseRef,subjectBindingRef:b.subjectBindingRef,criteriaVersion:1,items:['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'].map(code=>({code:code as Input['items'][number]['code'],sourceRefs:[],responsePartRefs:[],judgement:'',reason:''})),reason:''},pending:null,stored:null,uncertain:false,failure:null};
}
export async function prepareNormalInitialUnderstandingReview(raw:NormalInitialUnderstandingReviewBuffer,s:DocumentSession,generation:number,ownerEpoch:string):Promise<DocumentWrite>{
 const b=structuredClone(raw),basis=b.basis,i=b.form;
 if(!uuid(ownerEpoch)||b.ownerEpoch!==ownerEpoch||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid(s.user.id)||!uuid(s.clientId)||!(/^[A-Za-z0-9_-]{43}$/).test(s.csrfToken)||!Number.isSafeInteger(generation)||generation<1||b.stored||!['bundleRef','responseRef','subjectBindingRef'].every(k=>same(i[k as keyof typeof i],basis[k as 'bundleRef']))||!normalRefs(basis.basisRefs)||!normalRefs(basis.responsePartRefs))fail();
 for(const row of i.items){if(!normalRefs(row.sourceRefs)||!normalRefs(row.responsePartRefs)||!row.sourceRefs.every(r=>basis.basisRefs.some(v=>same(r,v)))||!row.responsePartRefs.every(r=>basis.responsePartRefs.some(v=>same(r,v))))fail();}
 const scope=basis.scope,base={schemaVersion:1 as const,projectId:scope.projectId,clientId:s.clientId,controlGeneration:generation,operation:'reviewUnderstanding' as const,targetId:scope.executionId,expectedVersion:scope.executionGeneration,baselineRefs:[] as [],approvalRef:b.pending?.approvalRef??null,payload:i};
 if(base.approvalRef!==null&&!understandingApprovalRef(base.approvalRef))fail();
 const command={...base,commandId:b.pending?.commandId??crypto.randomUUID()};readUnderstandingApprovalCommand({...command,approvalRef:null});await hash(command);
 if(b.pending&&!same(b.pending,command)||!b.pending&&b.uncertain)fail();return structuredClone(command) as DocumentWrite;
}
export function matchNormalInitialUnderstandingReview(raw:NormalUnderstandingHistoryView,b:NormalInitialUnderstandingReviewBuffer):NormalInitialUnderstandingRecord|null{
 if(!b.pending||raw.items.length!==1||!same(raw.scope,b.basis.scope))return null;const row=raw.items[0]!,s=row.snapshot;
 if(!same(s.request,b.pending)||!same(s.input,b.form)||s.reviewer.userId!==b.ownerUserId||s.reviewer.clientId!==b.ownerClientId||s.currentBinding.transport!=='NORMAL_PROTECTED'||!same(s.currentBinding.sourceBasis.preparationRef,b.basis.preparationRef)||!same(s.currentBinding.sourceBasis.requestRef,b.basis.rangeRequestRef)||!same(s.currentBinding.basisRefs,b.basis.basisRefs)||!same(s.currentBinding.responsePartRefs,b.basis.responsePartRefs)||row.ref.version!==1)return null;return structuredClone(row);
}
/** 정상 POST와 exact 이력 1행이 모두 같을 때만 저장 확인이다. 응답유실은 원명령을 보존한다. */
export async function saveNormalInitialUnderstandingReview(client:ApiClient,raw:NormalInitialUnderstandingReviewBuffer,rawSession:DocumentSession,active:()=>boolean):Promise<NormalInitialUnderstandingRecord|null>{
 const b=structuredClone(raw),s=structuredClone(rawSession),transport=client.transport,epoch=normalInitialUnderstandingOwner(client,s),check=()=>active()&&client.transport===transport&&same(rawSession,s)&&normalInitialUnderstandingOwner(client,rawSession)===epoch&&b.ownerEpoch===epoch;
 if(!b.pending)fail();const command=await prepareNormalInitialUnderstandingReview(b,s,b.pending.controlGeneration,epoch);if(!check())return null;
 const pinned=new ApiClient((...args)=>{if(!check())throw new ApiError('UNDERSTANDING_REVIEW_INPUT_INVALID');return transport.call(globalThis,...args);});
 const receipt=await postDocumentCommand(pinned,command,s.csrfToken);if(!check())return null;
 try{const history=await readNormalUnderstandingHistory(client,b.basis.scope,check);if(!history||!check())return null;const row=matchNormalInitialUnderstandingReview(history,b),d=receipt.data;
  if(!row||receipt.targetId!==row.ref.id||receipt.version!==row.ref.version||!d||!same(Object.keys(d).sort(),['ref','snapshot','status'])||d.status!=='NORMAL_UNDERSTANDING_REVIEWED'||!same(d.ref,row.ref)||!same(d.snapshot,row.snapshot))throw new ApiError('UNDERSTANDING_REVIEW_RESPONSE_INVALID');return row;
 }catch(cause){const e=cause instanceof ApiError?cause:new ApiError('UNDERSTANDING_REVIEW_RESPONSE_INVALID');throw new UnderstandingReadbackUnconfirmed(e.code,e.status);}
}
