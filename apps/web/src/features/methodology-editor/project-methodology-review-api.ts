import{ApiClient,ApiError}from'../../api/client.ts';
import type{VersionRef}from'../../../../../contracts/generated-types.ts';
import type{MethodologyGraph}from'../../../../../contracts/methodologies.ts';
import{ordered}from'../knowledge/review-view.ts';
export interface MethodLookup{id:string;version:number;targetHash?:string}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v),hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const ref=(v:any):v is VersionRef=>!!v&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash(v.contentHash)&&Object.keys(v).sort().join(',')==='contentHash,id,version';
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),texts=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(x=>typeof x==='string'),iso=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v));
const invalid=():never=>{throw new ApiError('RESPONSE_INVALID');},check=(active:()=>boolean)=>{if(!active())throw new ApiError('READ_CONTEXT_CHANGED');};
const outcomes=['ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED'];
const criteriaTitles=['방법론의 목적과 단계별 작업 범위가 분명한가','순서·분기·합류·재작업이 의도한 절차인가','입력·산출물과 양식의 연결이 충분한가','완료 기준·검수·사람 승인 경계가 충분한가','담당·작업 기록·한도와 미연결 사항을 분명히 했는가'];
const criteriaIds=['METHOD_PURPOSE_SCOPE','METHOD_FLOW_CONTROL','METHOD_INPUT_OUTPUT','METHOD_COMPLETION_APPROVAL','METHOD_RECORD_LIMITS'];
interface Criteria{criteriaVersion:1;items:{criterionId:string;title:string}[]}
interface ReviewRef{id:string;criteriaVersion:1;targetRef:VersionRef;outcome:string}
export interface StoredReview{ref:ReviewRef;criteria:Criteria;items:{criterionId:string;outcome:string;reason:string;evidenceRefs:[]}[];reviewer:{kind:'HUMAN';userId:string;sameAsTargetRecorder:boolean};sourceKind:'HUMAN_REVIEW';reason:string;reviewedAt:string;serverSequence:number}
export interface MethodOverview{projectId:string;ref:VersionRef;headVersion:number;name:string;purpose:string;scope:'PROJECT';systemCode:null;graph:MethodologyGraph;sourceApproval:unknown;reason:string;createdAt:string;contentReviewCriteria:Criteria;confirmation:null|{id:string;decision:'CONFIRMED';decidedBy:string;decided_at:string;reviewRefs:ReviewRef[];validation:{validForConfirmation:boolean;issues:unknown[]}};historyMode:'SEPARATE_PAGE';currentConfirmationState:'NOT_REEVALUATED';runtimeReadiness:'PROJECT_BINDINGS_REQUIRED';applicationTransition:'EXECUTION_STATE_UNVERIFIED'}
export interface StoredReviewPage{targetRef:VersionRef;upperSequence:number;items:StoredReview[];hasMore:boolean;nextCursor:string|null;observedAt:string}
function criteria(v:any){return !!v&&v.criteriaVersion===1&&Array.isArray(v.items)&&v.items.length===5&&v.items.every((x:any,i:number)=>x?.criterionId===criteriaIds[i]&&x.title===criteriaTitles[i]);}
function reviewRef(v:any,target:VersionRef){return !!v&&Object.keys(v).sort().join(',')==='criteriaVersion,id,outcome,targetRef'&&uuid(v.id)&&v.criteriaVersion===1&&ref(v.targetRef)&&same(v.targetRef,target)&&typeof v.outcome==='string'&&outcomes.includes(v.outcome);}
function conditionShape(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>, keys = Object.keys(item);
  if (keys.length === 1 && ('all' in item || 'any' in item)) {
    const children = item.all ?? item.any;
    return Array.isArray(children) && children.length > 0 && children.every(conditionShape);
  }
  if (keys.length === 1 && 'not' in item) return conditionShape(item.not);
  const field = item.fieldRef as Record<string, unknown> | null;
  return keys.length === 3 && !!field && typeof field === 'object' && Object.keys(field).length === 2 && typeof field.nodeId === 'string'
    && ['REVIEW_OUTCOME', 'USER_DECISION'].includes(String(field.field))
    && (['EQ', 'NE'].includes(String(item.operator)) && typeof item.value === 'string'
      || item.operator === 'IN' && texts(item.value) || item.operator === 'IS_PRESENT' && item.value === null);
}
function graphShape(graph:MethodologyGraph){

  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || typeof graph.entryNodeId !== 'string' || !texts(graph.terminalNodeIds)
    || new Set(graph.nodes.map(node => node?.nodeId)).size !== graph.nodes.length
    || graph.nodes.some(node => !node || typeof node.nodeId !== 'string' || typeof node.name !== 'string' || typeof node.purpose !== 'string' || !['HUMAN', 'AGENT', 'DECISION', 'JOIN'].includes(node.kind)
      || !['USER', 'COORDINATOR', 'STAGE_OWNER'].includes(node.role) || !['AUTO', 'CASE_BY_CASE'].includes(node.mode)
      || !node.taskScope || !texts(node.taskScope.included) || !texts(node.taskScope.excluded)
      || node.limitPolicyRef !== null && !ref(node.limitPolicyRef)
      || node.requirements !== undefined && (!node.requirements || !texts(node.requirements.capabilities) || !texts(node.requirements.environment))
      || node.joinRule !== undefined && (!node.joinRule || !['ALL', 'DECLARED_CONDITION'].includes(node.joinRule.mode) || node.joinRule.condition !== undefined && !conditionShape(node.joinRule.condition))
      || !node.position || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y) || !texts(node.completionCriteria) || !texts(node.approvalBoundary) || !texts(node.recordRequirements)
      || !Array.isArray(node.inputs) || !Array.isArray(node.outputs) || [...node.inputs, ...node.outputs].some(item => !item || typeof item.itemId !== 'string' || !ref(item.formRef) || !texts(item.reviewCriteria)))
    || graph.edges.some(edge => !edge || typeof edge.edgeId !== 'string' || typeof edge.fromNodeId !== 'string' || typeof edge.toNodeId !== 'string' || typeof edge.reason !== 'string' || !['SEQUENCE', 'BRANCH', 'JOIN', 'REWORK'].includes(edge.kind))) invalid();
}
function path(pid:string,lookup:MethodLookup){if(!uuid(pid)||!uuid(lookup.id)||!Number.isSafeInteger(lookup.version)||lookup.version<1||lookup.targetHash!==undefined&&!hash(lookup.targetHash))throw new ApiError('CLIENT_PATH_INVALID');return `/api/v1/projects/${pid}/methodologies/${lookup.id}/versions/${lookup.version}`;}
function bounded(v:unknown){if(new TextEncoder().encode(ordered(v)).byteLength>2097152)invalid();}
/** 별도 읽기 DTO다. 기존 MethodVersion/편집 command에 넣지 않는다. */
export async function readMethodOverview(client:ApiClient,pid:string,lookup:MethodLookup,active:()=>boolean=()=>true):Promise<MethodOverview>{
 lookup=structuredClone(lookup);const url=path(pid,lookup)+'/overview'+(lookup.targetHash?'?targetHash='+lookup.targetHash:'');check(active);const v=structuredClone(await client.get<MethodOverview>(url));check(active);bounded(v);
 if(!exact(v,['projectId','ref','headVersion','name','purpose','scope','systemCode','graph','sourceApproval','reason','createdAt','contentReviewCriteria','confirmation','historyMode','currentConfirmationState','runtimeReadiness','applicationTransition'])||v.projectId!==pid||!ref(v.ref)||v.ref.id!==lookup.id||v.ref.version!==lookup.version||lookup.targetHash!==undefined&&v.ref.contentHash!==lookup.targetHash||v.scope!=='PROJECT'||v.systemCode!==null||!Number.isSafeInteger(v.headVersion)||v.headVersion<lookup.version||typeof v.name!=='string'||typeof v.purpose!=='string'||typeof v.reason!=='string'||!iso(v.createdAt)||!criteria(v.contentReviewCriteria)||v.historyMode!=='SEPARATE_PAGE'||v.currentConfirmationState!=='NOT_REEVALUATED'||v.runtimeReadiness!=='PROJECT_BINDINGS_REQUIRED'||v.applicationTransition!=='EXECUTION_STATE_UNVERIFIED'||'contentReviews'in v)invalid();
 graphShape(v.graph);const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(v.graph)));check(active);if([...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')!==v.ref.contentHash)invalid();
 const c=v.confirmation;if(c!==null&&(!c||!uuid(c.id)||c.decision!=='CONFIRMED'||!uuid(c.decidedBy)||!iso(c.decided_at)||!Array.isArray(c.reviewRefs)||!c.reviewRefs.length||c.reviewRefs.length>200||new Set(c.reviewRefs.map(x=>x.id)).size!==c.reviewRefs.length||c.reviewRefs.some(x=>!reviewRef(x,v.ref)||x.outcome!=='ACCEPTED')||c.validation?.validForConfirmation!==true||!Array.isArray(c.validation.issues)))invalid();check(active);return v;
}
export async function readStoredMethodReviews(client:ApiClient,pid:string,target:VersionRef,limit=20,cursor:string|null=null,active:()=>boolean=()=>true):Promise<StoredReviewPage>{
 target=structuredClone(target);if(!ref(target)||!Number.isSafeInteger(limit)||limit<1||limit>50||cursor!==null&&(typeof cursor!=='string'||!cursor||cursor.length>4096))throw new ApiError('CLIENT_PATH_INVALID');const url=path(pid,target)+'/content-reviews?'+new URLSearchParams({targetHash:target.contentHash,limit:String(limit),...(cursor?{cursor}:{})});check(active);const v=structuredClone(await client.get<StoredReviewPage>(url));check(active);bounded(v);
 if(!exact(v,['targetRef','upperSequence','items','hasMore','nextCursor','observedAt'])||!ref(v.targetRef)||!same(v.targetRef,target)||!Number.isSafeInteger(v.upperSequence)||v.upperSequence<0||!iso(v.observedAt)||!Array.isArray(v.items)||v.items.length>limit||typeof v.hasMore!=='boolean'||(v.hasMore?typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor.length>4096||v.nextCursor===cursor||v.items.length!==limit:v.nextCursor!==null)||!v.upperSequence&&(v.items.length||v.hasMore))invalid();
 let previous:number|null=null;const ids=new Set<string>();for(const x of v.items){if(!x||!reviewRef(x.ref,target)||ids.has(x.ref.id)||!criteria(x.criteria)||!Array.isArray(x.items)||x.items.length!==5||new Set(x.items.map(i=>i.criterionId)).size!==5||x.items.some(i=>!criteriaIds.includes(i.criterionId)||typeof i.outcome!=='string'||!outcomes.includes(i.outcome)||typeof i.reason!=='string'||!i.reason.trim()||!Array.isArray(i.evidenceRefs)||i.evidenceRefs.length)||x.ref.outcome==='ACCEPTED'&&x.items.some(i=>i.outcome!=='ACCEPTED')||x.sourceKind!=='HUMAN_REVIEW'||x.reviewer?.kind!=='HUMAN'||!uuid(x.reviewer.userId)||typeof x.reviewer.sameAsTargetRecorder!=='boolean'||typeof x.reason!=='string'||!x.reason.trim()||!iso(x.reviewedAt)||Date.parse(x.reviewedAt)>Date.parse(v.observedAt)||!Number.isSafeInteger(x.serverSequence)||x.serverSequence<1||x.serverSequence>v.upperSequence||previous!==null&&x.serverSequence>=previous)invalid();ids.add(x.ref.id);previous=x.serverSequence;}check(active);return v;
}
