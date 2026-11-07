import assert from'node:assert/strict';import{test}from'node:test';
const load=()=>import('../../../apps/server/modules/knowledge/knowledge-reviews.ts').catch(()=>null);
const ref={id:'11111111-1111-4111-8111-111111111111',version:1,contentHash:'a'.repeat(64)},ids=['KNOWLEDGE_PURPOSE','KNOWLEDGE_SOURCE','KNOWLEDGE_REASON','KNOWLEDGE_SCOPE','KNOWLEDGE_LIMITS'];
const input=()=>({targetKind:'KNOWLEDGE',targetRef:ref,criteriaVersion:1,items:ids.map(criterionId=>({criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'원문과 이유를 확인했다'})),outcome:'ACCEPTED',reason:'종류·출처·이유·범위·한계를 원문과 대조했다'});
test('지식 내용 검토는 항목별 판단/이유를 보존하고 누락·부분 합격·주체 위조를 거절한다',async()=>{
 const m=await load();assert.ok(m,'지식 내용 검토 입력 계약이 필요하다');const p=input(),before=structuredClone(p);assert.deepEqual(m.readKnowledgeReviewInput(p,ref),p);assert.deepEqual(p,before);
 for(const bad of[{...p,items:p.items.slice(1)},{...p,items:[...p.items.slice(0,4),p.items[0]]},{...p,items:p.items.map((i,n)=>n===0?{...i,outcome:'REWORK'}:i)},{...p,reviewer:{kind:'HUMAN'}},{...p,targetRef:{...ref,contentHash:'0'.repeat(64)}}])assert.throws(()=>m.readKnowledgeReviewInput(bad,ref));
 const rework={...p,outcome:'REWORK',items:p.items.map((i,n)=>n===0?{...i,outcome:'REWORK',reason:'목적 설명을 보완해야 한다'}:i)};assert.deepEqual(m.readKnowledgeReviewInput(rework,ref),rework);
});
test('연결하지 않은 시험 증거와 의심 비밀을 검토 이유로 저장/노출하지 않는다',async()=>{
 const m=await load();assert.ok(m);const p=input();for(const bad of[{...p,items:p.items.map((i,n)=>n===0?{...i,evidenceRefs:[ref]}:i)},{...p,reason:'token=synthetic-not-a-real-token'}])assert.throws(()=>m.readKnowledgeReviewInput(bad,ref));
});
