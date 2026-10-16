import{AuthFailure}from'../access/repository.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
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
