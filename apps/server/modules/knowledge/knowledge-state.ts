import{AuthFailure}from'../access/repository.ts';
export function knowledgeState(version:number,head:number,kinds:string[]):'PROPOSED'|'SUPERSEDED'|'EXCLUDED'{
 if(!Number.isSafeInteger(version)||version<1||!Number.isSafeInteger(head)||head<version||!Array.isArray(kinds)||kinds.length<1||kinds.length>2||kinds[0]!==(version===1?'PROPOSED':'CORRECTED')||kinds.length===2&&kinds[1]!=='EXCLUDED')throw new AuthFailure('KNOWLEDGE_EVENT_INTEGRITY_FAILED',503);
 return kinds.includes('EXCLUDED')?'EXCLUDED':version<head?'SUPERSEDED':'PROPOSED';
}
