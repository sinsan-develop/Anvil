import{AuthFailure}from'../access/repository.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import{exact,assertKnowledgeTextSafe}from'./knowledge-entry.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
export function constitutionEligibility(view:{entry:{kind:string};state:string;headVersion:number;ref:VersionRef;confirmation:unknown;currentConfirmationValid:boolean}){
 const reason=view.entry.kind!=='CONSTITUTION'?'NOT_CONSTITUTION':view.state==='EXCLUDED'?'EXCLUDED':view.headVersion!==view.ref.version?'SUPERSEDED':!view.confirmation?'NOT_CONFIRMED':!view.currentConfirmationValid?'REVIEW_NOT_CURRENT':null;
 return{usable:reason===null,reasons:reason?[reason]:[]};
}
export function readConstitutionApplication(value:unknown):{versionRef:VersionRef;confirmationId:string;reason:string;acknowledged:true}{
 if(!exact(value,['versionRef','confirmationId','reason','acknowledged'])||!isVersionRef(value.versionRef)||typeof value.confirmationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.confirmationId)||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>20000||!value.reason.isWellFormed()||value.acknowledged!==true)throw new AuthFailure('CONSTITUTION_INPUT_INVALID',422);
 assertKnowledgeTextSafe(value.reason);return structuredClone(value)as unknown as{versionRef:VersionRef;confirmationId:string;reason:string;acknowledged:true};
}
export function knowledgeState(version:number,head:number,kinds:string[]):'PROPOSED'|'CONFIRMED'|'SUPERSEDED'|'EXCLUDED'{
 if(!Number.isSafeInteger(version)||version<1||!Number.isSafeInteger(head)||head<version||!Array.isArray(kinds)||kinds.length<1||kinds.length>3||kinds[0]!==(version===1?'PROPOSED':'CORRECTED')||!['','CONFIRMED','EXCLUDED','CONFIRMED,EXCLUDED'].includes(kinds.slice(1).join(',')))throw new AuthFailure('KNOWLEDGE_EVENT_INTEGRITY_FAILED',503);
 return kinds.includes('EXCLUDED')?'EXCLUDED':version<head?'SUPERSEDED':kinds.includes('CONFIRMED')?'CONFIRMED':'PROPOSED';
}
export function assertKnowledgeHistory(events:any[],ref:{id:string;version:number;contentHash:string},entry:any){
 const same=(a:unknown,b:unknown)=>a!==undefined&&b!==undefined&&canonicalJson(a)===canonicalJson(b);
 for(const e of events){
  const c=e.command_result,d=c?.data,operation={PROPOSED:'saveKnowledge',CORRECTED:'correctKnowledge',CONFIRMED:'confirmKnowledge',EXCLUDED:'excludeKnowledge'}[e.kind as string];
  if(!operation||e.command_operation!==operation||!c||c.status!=='APPLIED'||c.projectId!==entry.scope.projectId||c.targetId!==ref.id||c.version!==ref.version||!d||!same(d.ref,ref)||d.status!==(e.kind==='EXCLUDED'?'EXCLUDED':e.kind==='CONFIRMED'?'CONFIRMED':'PROPOSED')||!same(e.actor_ref,{kind:'HUMAN',userId:e.command_actor_id})||e.reason!==(e.kind==='PROPOSED'?entry.reason:d.reason)||typeof e.reason!=='string'||!e.reason.trim()||e.reason.length>20000||['PROPOSED','CORRECTED'].includes(e.kind)&&!same(d.entry,entry)||e.kind!=='PROPOSED'&&d.eventId!==e.id||e.kind==='CORRECTED'&&(!same(e.base_ref,d.baseRef)||!same(e.change_sources,d.changeSources))||e.kind!=='CORRECTED'&&(e.base_ref!==null||e.change_sources!==null)||e.kind==='CONFIRMED'&&!same(e.review_refs,d.reviewRefs)||e.kind!=='CONFIRMED'&&e.review_refs!=null)throw new AuthFailure('KNOWLEDGE_EVENT_INTEGRITY_FAILED',503);
 }
}
