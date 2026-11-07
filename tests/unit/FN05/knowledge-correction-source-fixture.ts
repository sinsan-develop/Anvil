import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {newKnowledgeCorrection} from '../../../apps/web/src/features/knowledge/correction-api.ts';
export const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',kid='44444444-4444-4444-8444-444444444444',freshAid='55555555-5555-4555-8555-555555555555';
export const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
export const documentSource={kind:'DOCUMENT_VERSION' as const,id:'66666666-6666-4666-8666-666666666666',version:2,contentHash:'a'.repeat(64)};
export function correctionFixture(){
 const body='기존 원문',entry={kind:'FACT',title:'기존 관측',contentRef:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},sourceRefs:[{kind:'CONVERSATION',id:uid,contentHash:'b'.repeat(64)}],reason:'기존 이유',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]};
 const view={ref:{id:kid,version:1,contentHash:contentHash(canonicalJson(entry))},entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:'2026-10-16T05:00:00Z'}]};
 const buffer=newKnowledgeCorrection(pid,view as any,session,3);buffer.body='정정 본문';buffer.reason='현재 이유';buffer.changeReason='새 문서 근거 반영';return{buffer,view};
}
