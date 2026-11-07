import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {KnowledgeView} from '../../../apps/web/src/features/knowledge/api.ts';
export const comparisonProject='11111111-1111-4111-8111-111111111111',comparisonUser='22222222-2222-4222-8222-222222222222',comparisonId='44444444-4444-4444-8444-444444444444';
export function knowledgeVersionPair(){
 const body='첫 줄\n이전 판단\n끝\n',entry={kind:'FACT',title:'앞 제목',contentRef:{artifactId:'33333333-3333-4333-8333-333333333333',bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'앞 판단 이유',scope:{projectId:comparisonProject,stageRefs:[],taskRefs:[]},relatedRefs:[]},ref={id:comparisonId,version:1,contentHash:contentHash(canonicalJson(entry))};
 const before={ref,entry,body,state:'SUPERSEDED',headVersion:2,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:'33333333-3333-4333-8333-333333333333',kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:comparisonUser},recordedAt:'2026-10-20T00:00:00.000Z'}]} as KnowledgeView;
 const newBody='첫 줄\n<script>window.KNOWLEDGE_HISTORY_EXECUTED=1</script>\n끝\n',newEntry={...entry,title:'정정 제목',reason:'정정 판단 이유',contentRef:{...entry.contentRef,artifactId:'66666666-6666-4666-8666-666666666666',bytes:Buffer.byteLength(newBody),contentHash:contentHash(Buffer.from(newBody))}};
 const after={...before,ref:{id:comparisonId,version:2,contentHash:contentHash(canonicalJson(newEntry))},entry:newEntry,body:newBody,state:'PROPOSED',supersedesRef:ref,history:[{id:'55555555-5555-4555-8555-555555555555',kind:'CORRECTED',reason:'새 관측으로 정정',actorRef:{kind:'HUMAN',userId:comparisonUser},recordedAt:'2026-10-20T00:01:00.000Z',baseRef:ref,sourceRefs:[]}]} as KnowledgeView;
 return{before,after};
}
