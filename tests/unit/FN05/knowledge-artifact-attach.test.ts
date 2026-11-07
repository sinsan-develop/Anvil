import test from 'node:test';import assert from 'node:assert/strict';
import {newKnowledge,prepareKnowledge} from '../../../apps/web/src/features/knowledge/api.ts';
const m=await import('../../../apps/web/src/features/knowledge/knowledge-artifact-attach.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},selection={projectId:pid,artifact:{artifactId:aid,bytes:3,contentHash:'a'.repeat(64),mediaType:'text/plain;charset=utf-8'}};
const draft=()=>({...newKnowledge(pid,session,3),title:'작성제목',body:'내 판단',reason:'판단이유',dirty:true});
test('보관파일 출처 추가/해제는 원문/입력을 보존하고 별도저장 snapshot에 고정한다',async()=>{
 assert.equal(typeof m?.attachKnowledgeArtifact,'function');const b=draft(),before=structuredClone(b),next=m!.attachKnowledgeArtifact(b,session,selection);assert.deepEqual(b,before);assert.equal(next.body,b.body);assert.equal(next.title,b.title);assert.equal(next.reason,b.reason);assert.equal(next.pending,null);assert.deepEqual(next.sourceRefs,[{kind:'ARTIFACT',id:aid,contentHash:'a'.repeat(64)}]);const p=await prepareKnowledge(next,session);assert.deepEqual(p.snapshot.sourceRefs,next.sourceRefs);const removed=m!.detachKnowledgeArtifact(next,session,pid,{kind:'ARTIFACT',id:aid,contentHash:'a'.repeat(64)});assert.deepEqual(removed.sourceRefs,[]);assert.equal(removed.body,b.body);assert.equal(next.sourceRefs.length,1);
});
test('다른project/주체·pending/미확인/완료·중복ID·본문예약한도를 거절한다',async()=>{
 assert.equal(typeof m?.attachKnowledgeArtifact,'function');const b=draft(),pending=await prepareKnowledge(b,session);
 for(const patch of [{ownerUserId:aid},{ownerClientId:aid},{projectId:aid},{pending},{uncertain:true},{resultRef:{id:aid,version:1,contentHash:'a'.repeat(64)}},{sourceRefs:[{kind:'ARTIFACT',id:aid,contentHash:'b'.repeat(64)}]},{sourceRefs:Array.from({length:199},(_,i)=>({kind:'DOCUMENT_VERSION',id:aid,version:i+1,contentHash:'a'.repeat(64)}))}]){const value={...b,...patch} as any,before=structuredClone(value);assert.throws(()=>m!.attachKnowledgeArtifact(value,session,selection));assert.deepEqual(value,before);}
});
