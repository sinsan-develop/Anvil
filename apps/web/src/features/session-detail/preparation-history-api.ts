import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
export interface PreparationSummary{ref:PlanRef;mode:'CONTEXT_REVIEW'|'WORK';checkedAt:string;missingConditions:string[]}
export interface PreparationHistoryPage{projectId:string;assignmentRef:PlanRef;items:PreparationSummary[];nextCursor:string|null;currentness:'NOT_RECHECKED';executionAuthorized:false;dispatchPerformed:false}
export interface PreparationOriginal{projectId:string;ref:PlanRef;snapshot:Record<string,any>;currentness:'NOT_RECHECKED'}
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const uuid=(v:any):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hash=(v:any)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const ref=(v:any):v is PlanRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash(v.contentHash);
const date=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const unresolved=['RESPONSIBLE_SESSION_RESERVED','CONNECTION_CANDIDATE_ONLY','ENVIRONMENT_CANDIDATE_ONLY','CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','HOST_OS_FENCE_UNVERIFIED'];
const codes=[...unresolved,'REQUIRED_CONTEXT_MISSING','CURRENT_CONTEXT_CHANGED','UNDERSTANDING_NOT_REVIEWED'];
const fail=():never=>{throw new ApiError('PREPARATION_HISTORY_RESPONSE_INVALID');};
const conditions=(v:any)=>Array.isArray(v)&&v.length<=10&&new Set(v).size===v.length&&v.every(c=>codes.includes(c))&&unresolved.every(c=>v.includes(c));
function summary(v:any):v is PreparationSummary{return exact(v,['ref','mode','checkedAt','missingConditions'])&&ref(v.ref)&&v.ref.version===1&&['CONTEXT_REVIEW','WORK'].includes(v.mode)&&date(v.checkedAt)&&conditions(v.missingConditions)&&(v.mode!=='WORK'||v.missingConditions.includes('UNDERSTANDING_NOT_REVIEWED'));}
// 서버의 고정 준비 문법과 동일하게 검산하되 Node Buffer/crypto 의존성은 반출하지 않는다.
function sourceScopes(v:any){
 if(!Array.isArray(v)||!v.length||v.length>200)return false;const roots=new Set<string>();let count=0;
 for(const scope of v){if(!exact(scope,['sourceRootRef','mappingRef','observationRef','baselineRef','targets'])||!ref(scope.sourceRootRef)||scope.mappingRef!==null&&!ref(scope.mappingRef)||!ref(scope.observationRef)||!ref(scope.baselineRef)||!Array.isArray(scope.targets)||!scope.targets.length||scope.targets.length>200||roots.has(scope.sourceRootRef.id))return false;roots.add(scope.sourceRootRef.id);const paths=new Set<string>();
 for(const target of scope.targets){if(++count>200||!exact(target,['relativePath','kind','access','recursive'])||target.kind!=='FILE'||!['READ','WRITE'].includes(target.access)||target.recursive!==false)return false;const path=target.relativePath;if(typeof path!=='string'||!path.isWellFormed()||path!==path.normalize('NFC')||!path.length||new TextEncoder().encode(path).length>1024||/[\x00-\x1f\x7f\\:%?*"<>|]/.test(path)||!path.split('/').every((p:string)=>!!p&&p.length<=255&&p!=='.'&&p!=='..'&&!/[. ]$/.test(p)&&!/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(p))||paths.has(path.toUpperCase()))return false;paths.add(path.toUpperCase());}}
 return true;
}
function intentValid(v:any){return exact(v,['projectId','assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef','capabilityRef','budgetPolicyRef','sourceScopes','mode','reason'])&&uuid(v.projectId)&&['assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef','capabilityRef','budgetPolicyRef'].every(k=>ref(v[k]))&&['CONTEXT_REVIEW','WORK'].includes(v.mode)&&typeof v.reason==='string'&&v.reason.isWellFormed()&&!!v.reason.trim()&&v.reason.length<=20000&&sourceScopes(v.sourceScopes);}
function binding(pid:string,a:PlanRef){if(!uuid(pid)||!ref(a))fail();}
function size(v:unknown){if(new TextEncoder().encode(ordered(v)).length>2*1024*1024)fail();}
export async function readPreparationHistoryPage(client:ApiClient,projectId:string,assignmentRef:PlanRef,cursor:string|null,active:()=>boolean):Promise<PreparationHistoryPage|null>{
 binding(projectId,assignmentRef);if(cursor!==null&&(typeof cursor!=='string'||!cursor.length||cursor.length>4096))fail();const a=structuredClone(assignmentRef);if(!active())return null;
 const v=await client.get<PreparationHistoryPage>(`/api/v1/projects/${projectId}/assignments/${a.id}/versions/${a.version}/execution-preparations${cursor===null?'':'?cursor='+encodeURIComponent(cursor)}`);if(!active())return null;
 if(!exact(v,['projectId','assignmentRef','items','nextCursor','currentness','executionAuthorized','dispatchPerformed'])||v.projectId!==projectId||!same(v.assignmentRef,a)||!Array.isArray(v.items)||v.items.length>20||!v.items.every(summary)||new Set(v.items.map(i=>i.ref.id)).size!==v.items.length||!(v.nextCursor===null||typeof v.nextCursor==='string'&&v.nextCursor.length>0&&v.nextCursor.length<=4096&&v.items.length===20)||v.currentness!=='NOT_RECHECKED'||v.executionAuthorized!==false||v.dispatchPerformed!==false)fail();size(v);return active()?structuredClone(v):null;
}
/** 고정 GET의 원형·해시를 검산한다. 현재 자격·실행 준비 완료를 판정하지 않는다. */
export async function readPreparationOriginal(client:ApiClient,projectId:string,assignmentRef:PlanRef,item:PreparationSummary,active:()=>boolean):Promise<PreparationOriginal|null>{
 binding(projectId,assignmentRef);if(!summary(item))fail();const a=structuredClone(assignmentRef),selected=structuredClone(item);if(!active())return null;
 const v=await client.get<PreparationOriginal>(`/api/v1/projects/${projectId}/execution-preparations/${selected.ref.id}/versions/${selected.ref.version}`);if(!active())return null;
 if(!exact(v,['projectId','ref','snapshot','currentness'])||v.projectId!==projectId||!same(v.ref,selected.ref)||v.currentness!=='NOT_RECHECKED')fail();const s=v.snapshot;
 if(!exact(s,['intent','basisRefs','latestInstructionRefs','checkedAt','missingConditions','authorizationState','preparedBy','executionAuthorized','dispatchPerformed'])||!Array.isArray(s.basisRefs)||s.basisRefs.length>200||!s.basisRefs.every(ref)||!Array.isArray(s.latestInstructionRefs)||s.latestInstructionRefs.length>200||!s.latestInstructionRefs.every((r:any)=>exact(r,['kind','id','contentHash'])&&r.kind==='CONVERSATION'&&uuid(r.id)&&hash(r.contentHash))||s.checkedAt!==selected.checkedAt||!date(s.checkedAt)||!same(s.missingConditions,selected.missingConditions)||!conditions(s.missingConditions)||s.authorizationState!=='NOT_AUTHORIZED'||s.executionAuthorized!==false||s.dispatchPerformed!==false||!exact(s.preparedBy,['kind','userId'])||s.preparedBy.kind!=='HUMAN'||!uuid(s.preparedBy.userId))fail();
 if(!intentValid(s.intent)||s.intent.projectId!==projectId||!same(s.intent.assignmentRef,a)||s.intent.mode!==selected.mode)fail();size(v);
 const bytes=new TextEncoder().encode(ordered(s)),actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(!active())return null;if(actual!==selected.ref.contentHash)fail();return active()?structuredClone(v):null;
}
