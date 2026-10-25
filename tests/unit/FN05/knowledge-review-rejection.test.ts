import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {newKnowledgeDecision,prepareKnowledgeDecision} from '../../../apps/web/src/features/knowledge/decision-api.ts';
import * as decision from '../../../apps/web/src/features/knowledge/decision-api.ts';
const id=(n:number)=>'10000000-0000-4000-8000-'+n.toString().padStart(12,'0'),session={user:{id:id(2)},clientId:id(3),csrfToken:'C'.repeat(43)};
async function rejected(){
 const body='합성 원문',entry={kind:'FACT',title:'검토 대상',contentRef:{artifactId:id(4),bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'보존',scope:{projectId:id(1),stageRefs:[],taskRefs:[]},relatedRefs:[]},ref={id:id(5),version:1,contentHash:contentHash(canonicalJson(entry))},criteria={criteriaVersion:1,knowledgeKind:'FACT',items:['KNOWLEDGE_PURPOSE','KNOWLEDGE_SOURCE','KNOWLEDGE_REASON','KNOWLEDGE_SCOPE','KNOWLEDGE_LIMITS'].map((criterionId,n)=>({criterionId,title:'검토 기준 '+n}))},target:any={ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,confirmation:null,currentConfirmationValid:false,contentReviewCriteria:criteria,contentReviews:[],appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:id(7),kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:session.user.id},baseRef:null,sourceRefs:null,reviewRefs:null,recordedAt:'2026-10-25T00:00:00Z'}]};
 const b=newKnowledgeDecision(id(1),target,session,7,'REVIEW');b.items=b.items.map((i,n)=>({...i,outcome:n===2?'BLOCKED':'REWORK',reason:'항목 이유 '+n}));b.outcome='REWORK';b.reason='api_key=synthetic_rejection_only';b.dirty=true;b.pending=await prepareKnowledgeDecision(b,session);b.failure={code:'KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED',status:412};return b;
}
const retire=(b:Parameters<typeof decision.retireRejectedKnowledgeReview>[0],s=session)=>decision.retireRejectedKnowledgeReview(b,s);
test('첫 명시거절 복구는 원명령과 실패를 별도 이력으로 보존하고 판단 전체를 유지한다',async()=>{
 const b=await rejected(),original=structuredClone(b),next=await retire(b);assert.deepEqual(b,original);assert.deepEqual(structuredClone(next),{...b,pending:null,failure:null,dirty:true,rejectedAttempts:[{title:b.target.entry.title,command:b.pending,failure:b.failure}]});assert.notEqual(next.target,b.target);assert.notEqual(next.rejectedAttempts![0]!.command,b.pending);
 next.reason='정정 이유';next.pending=await prepareKnowledgeDecision(next,session);assert.notEqual(next.pending.commandId,b.pending!.commandId);assert.equal(next.pending.payload.reason,'정정 이유');assert.deepEqual(next.pending.payload.items,b.items);assert.deepEqual(next.rejectedAttempts![0]!.command,b.pending);
});
test('미확인·완료·다른주체·세대·target·명령/승인/내용 불일치는 복구하지 않는다',async()=>{
 const b=await rejected(),mutations=[(v:any)=>({...v,uncertain:true}),(v:any)=>({...v,savedId:id(8)}),(v:any)=>({...v,pending:null}),(v:any)=>({...v,failure:null}),(v:any)=>({...v,failure:{code:'RESPONSE_INVALID',status:412}}),(v:any)=>({...v,failure:{code:'KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED',status:500}}),(v:any)=>({...v,kind:'CONFIRM'}),(v:any)=>({...v,kind:'APPLY'}),(v:any)=>({...v,ownerUserId:id(9)}),(v:any)=>({...v,ownerClientId:id(10)}),(v:any)=>({...v,projectId:id(11)}),(v:any)=>({...v,controlGeneration:8}),(v:any)=>({...v,reason:'명령과 다른 입력'}),(v:any)=>({...v,items:v.items.map((i:any,n:number)=>n===1?{...i,reason:'다른 이유'}:i)}),(v:any)=>({...v,target:{...v.target,ref:{...v.target.ref,contentHash:'b'.repeat(64)}}}),(v:any)=>({...v,target:{...v.target,body:'다른 원문'}})];
 for(const field of [{commandId:'invalid'},{schemaVersion:2},{projectId:id(12)},{clientId:id(13)},{controlGeneration:9},{operation:'confirmKnowledge'},{targetId:id(14)},{expectedVersion:2},{baselineRefs:[b.target.ref]},{approvalRef:{requestId:id(15),decisionId:id(16),scopeDigest:'a'.repeat(64)}},{payload:{...b.pending!.payload,reason:'다른 명령'}},{unexpected:true}])mutations.push((v:any)=>({...v,pending:{...v.pending,...field}}));
 for(const mutate of mutations){const changed=mutate(structuredClone(b)),copy=structuredClone(changed);await assert.rejects(retire(changed));assert.deepEqual(changed,copy);}
 for(const changed of [{...session,user:{id:id(18)}},{...session,clientId:id(19)},{...session,csrfToken:'bad'}])await assert.rejects(retire(b,changed));
});
test('검증 await 중 원본 입력·원명령·세션 내부변경도 복구를 무효화한다',async()=>{
 for(const mutate of [(b:any)=>b.reason='검증 중 새 입력',(b:any)=>b.pending.payload.reason='검증 중 새명령']){const b=await rejected(),promise=retire(b);mutate(b);await assert.rejects(promise);assert(b.pending);}
 const b=await rejected(),s=structuredClone(session),promise=retire(b,s);s.clientId=id(20);await assert.rejects(promise);
});
