import{ApiClient,ApiError}from'../../api/client.ts';
import{validateKnowledgeView,type KnowledgeView}from'./api.ts';
import{ordered}from'./review-view.ts';
import{validateConstitutionRecord,type ConstitutionRecord}from'./constitution-proof.ts';
export interface ConstitutionView{current:(ConstitutionRecord&{source:KnowledgeView;eligibility:{usable:boolean;reasons:string[]}})|null;history:ConstitutionRecord[];hasMore:boolean;nextBeforeVersion:number|null;agentDelivery:'NOT_CONNECTED';compliance:'NOT_ASSESSED';observedAt:string}
export async function readProjectConstitution(client:ApiClient,pid:string,beforeVersion:number|null=null):Promise<ConstitutionView>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(pid)||beforeVersion!==null&&(!Number.isSafeInteger(beforeVersion)||beforeVersion<1))throw new ApiError('CLIENT_PATH_INVALID');
 const page=await client.get<ConstitutionView>(`/api/v1/projects/${pid}/constitution?limit=10${beforeVersion===null?'':'&beforeVersion='+beforeVersion}`);
 if(!page||page.agentDelivery!=='NOT_CONNECTED'||page.compliance!=='NOT_ASSESSED'||!Array.isArray(page.history)||page.history.length>10||typeof page.hasMore!=='boolean'||(page.hasMore?!Number.isSafeInteger(page.nextBeforeVersion)||page.nextBeforeVersion!==page.history.at(-1)?.ref.version:page.nextBeforeVersion!==null)||!Number.isFinite(Date.parse(page.observedAt)))throw new ApiError('RESPONSE_INVALID');
 if(page.current){const c=page.current;await validateConstitutionRecord(c,pid);await validateKnowledgeView(c.source,pid,c.application.versionRef);if(c.source.entry.kind!=='CONSTITUTION'||c.source.confirmation?.eventId!==c.application.confirmationId||!c.source.appliedAsConstitution||ordered(c.source.constitutionApplication?.ref)!==ordered(c.ref))throw new ApiError('RESPONSE_INVALID');const s=c.source,reason=s.state==='EXCLUDED'?'EXCLUDED':s.headVersion!==s.ref.version?'SUPERSEDED':!s.confirmation?'NOT_CONFIRMED':!s.currentConfirmationValid?'REVIEW_NOT_CURRENT':null;if(ordered(c.eligibility)!==ordered({usable:reason===null,reasons:reason?[reason]:[]}))throw new ApiError('RESPONSE_INVALID');}
 else if(page.current!==null||page.history.length||page.hasMore)throw new ApiError('RESPONSE_INVALID');
 let previous=beforeVersion??Number.MAX_SAFE_INTEGER;for(const record of page.history){await validateConstitutionRecord(record,pid);if(record.ref.version>=previous||page.current&&record.ref.version>page.current.ref.version)throw new ApiError('RESPONSE_INVALID');previous=record.ref.version;}
 if(beforeVersion===null&&page.current&&ordered(page.history[0]?.ref)!==ordered(page.current.ref))throw new ApiError('RESPONSE_INVALID');
 return page;
}
