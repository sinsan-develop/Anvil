import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newKnowledge,prepareKnowledge} from '../../../apps/web/src/features/knowledge/api.ts';
import {ApiError} from '../../../apps/web/src/api/client.ts';
const load=()=>import('../../../apps/web/src/features/knowledge/knowledge-document-attach.ts').catch(()=>null);
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',did='33333333-3333-4333-8333-333333333333';
const s={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},source={kind:'DOCUMENT_VERSION' as const,id:did,version:2,contentHash:'a'.repeat(64)};
const draft=()=>({...newKnowledge(pid,s,1),title:'작성 중 제목',body:'변경한 본문',reason:'당시 판단',dirty:true});
test('명시 문서 출처 붙이기는 현재 입력을 보존하고 저장 snapshot에 정확 버전/hash만 고정한다',async()=>{
 const m=await load();assert.ok(m,'명시 문서 출처 연결이 필요하다');const b=draft(),before=structuredClone(b),next=m.attachKnowledgeDocument(b,s,pid,source);
 assert.deepEqual(b,before);assert.equal(next.body,'변경한 본문');assert.equal(next.title,'작성 중 제목');assert.equal(next.reason,'당시 판단');assert.equal(next.pending,null);assert.deepEqual(next.sourceRefs,[source]);
 const pending=await prepareKnowledge(next,s);source.contentHash='b'.repeat(64);assert.equal(pending.snapshot.sourceRefs[0]?.contentHash,'a'.repeat(64));source.contentHash='a'.repeat(64);
});
test('같은 버전 중복·같은 버전 다른hash·저장용 출처 여유 없는 경우를 거절한다',async()=>{
 const m=await load();assert.ok(m);for(const sources of [[source],[{...source,contentHash:'f'.repeat(64)}],Array.from({length:199},(_,i)=>({...source,version:i+3}))])assert.throws(()=>m.attachKnowledgeDocument({...draft(),sourceRefs:sources},s,pid,source),ApiError);
});
test('저장 진행/결과미확인/완료·다른 주체/프로젝트는 출처를 변경하지 않는다',async()=>{
 const m=await load();assert.ok(m);const b=draft(),pending=await prepareKnowledge(b,s);for(const bad of [{...b,pending},{...b,uncertain:true},{...b,resultRef:{id:did,version:1,contentHash:'a'.repeat(64)}},{...b,ownerClientId:did},{...b,ownerUserId:did},{...b,projectId:did}]){const before=structuredClone(bad);assert.throws(()=>m.attachKnowledgeDocument(bad,s,pid,source),ApiError);assert.deepEqual(bad,before);}
});
test('명시 버전은 양수 정수/해시/식별자와 정확한 참조 형식을 검사한다',async()=>{
 const m=await load();assert.ok(m);for(const bad of [{...source,version:0},{...source,version:1.5},{...source,contentHash:'x'},{...source,id:'../file'},{...source,kind:'ARTIFACT'},{...source,body:'자동 복사 금지'}])assert.throws(()=>m.attachKnowledgeDocument(draft(),s,pid,bad as any),ApiError);
});
