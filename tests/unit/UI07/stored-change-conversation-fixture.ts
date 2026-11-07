import {designChangeFixture} from './design-change-fixture.ts';
import {fixtureData} from '../FN05/knowledge-conversation-source-fixture.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
export function conversationChangeFixture(instruction=true,declaredInstruction=instruction){
 const data=fixtureData(instruction),page:any=designChangeFixture();data.source.kind=declaredInstruction?'USER_INSTRUCTION':'CONVERSATION';page.change.sourceRefs=[structuredClone(data.source)];
 const {ref,status,requestedBy,createdAt,...snapshot}=page.change;ref.contentHash=contentHash(canonicalJson(snapshot));
 for(const impact of [...page.impactVersions].reverse()){impact.changeRef=ref;if(impact.sourceKind==='HUMAN_REVIEW')impact.baseImpactRef=page.impactVersions[1].ref;const {ref:old,observedAt,...value}=impact;impact.ref={...old,contentHash:contentHash(canonicalJson(value))};}page.latestImpactRef=page.impactVersions[0].ref;
 return {page,conversation:data.conversation,selection:{projectId:data.selection.projectId,userId:data.selection.userId,clientId:data.selection.clientId,changeRef:structuredClone(ref),source:structuredClone(data.source),conversationId:data.selection.conversationId}};
}
