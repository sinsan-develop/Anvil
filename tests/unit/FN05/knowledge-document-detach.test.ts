import assert from 'node:assert/strict';
import test from 'node:test';
import { newKnowledge, prepareKnowledge } from '../../../apps/web/src/features/knowledge/api.ts';
const module = await import('../../../apps/web/src/features/knowledge/knowledge-document-attach.ts');
const pid='11111111-1111-4111-8111-111111111111', uid='22222222-2222-4222-8222-222222222222', did='33333333-3333-4333-8333-333333333333';
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
const source={kind:'DOCUMENT_VERSION' as const,id:did,version:2,contentHash:'a'.repeat(64)};
const other={...source,version:3}, conversation={kind:'CONVERSATION' as const,id:uid,contentHash:'b'.repeat(64)}, artifact={kind:'ARTIFACT' as const,id:pid,contentHash:'c'.repeat(64)};
const draft=()=>({...newKnowledge(pid,session,4), title:'보존 제목',body:'보존 본문',reason:'보존 이유',sourceRefs:[source,other,conversation,artifact]});
const detach=(...args:unknown[])=>{const fn=(module as Record<string,unknown>).detachKnowledgeDocument; assert.equal(typeof fn,'function');return (fn as Function)(...args);};
test('미저장 문서 한 건만 해제하고 본문·다른 출처·기존 buffer와 저장 snapshot을 보존한다',async()=>{
 const before=draft(),snapshot=structuredClone(before),next=detach(before,session,pid,source);
 assert.deepEqual(before,snapshot); assert.equal(next.title,'보존 제목'); assert.equal(next.body,'보존 본문'); assert.equal(next.reason,'보존 이유');
 assert.deepEqual(next.sourceRefs,[other,conversation,artifact]);assert.equal(next.dirty,true);assert.equal(next.pending,null);
 const prepared=await prepareKnowledge(next,session);assert.deepEqual(prepared.snapshot.sourceRefs,[other,conversation,artifact]);assert.equal(prepared.snapshot.body,'보존 본문');
});
test('동결·불명·저장완료·다른 주체/기기/프로젝트·잘못된 제어 세대는 변경하지 않는다',async()=>{
 assert.equal(typeof (module as Record<string,unknown>).detachKnowledgeDocument,'function');
 const b=draft(),pending=await prepareKnowledge(b,session);
 for(const patch of [{pending},{uncertain:true},{resultRef:{id:did,version:1,contentHash:'a'.repeat(64)}},{ownerUserId:did},{ownerClientId:did},{projectId:did},{controlGeneration:0}]){
  const bad={...b,...patch},before=structuredClone(bad);assert.throws(()=>detach(bad,session,pid,source));assert.deepEqual(bad,before);
 }
});
test('없는/바뀐 fullref·중복 문서와 발언/파일 출처의 해제를 거절한다',()=>{
 assert.equal(typeof (module as Record<string,unknown>).detachKnowledgeDocument,'function');
 for(const selected of [{...source,version:9},{...source,contentHash:'d'.repeat(64)},{...source,kind:'ARTIFACT'},conversation,artifact,{...source,extra:true}])assert.throws(()=>detach(draft(),session,pid,selected));
 assert.throws(()=>detach({...draft(),sourceRefs:[source,{...source}]},session,pid,source));
});
