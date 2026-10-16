import assert from'node:assert/strict';import{test}from'node:test';
const id='a6f30000-0000-4000-8000-000000000090',hash='1'.repeat(64);
test('변경 요청 출처는 정확한 기존4종·유한 개수만 보존하고 입력을 바꾸지 않는다',async()=>{
 const m=await import('../../../apps/server/modules/traceability/design-change-sources.ts').catch(()=>null);assert.ok(m,'변경 출처 형식 검사 필요');
 const refs=[{kind:'DOCUMENT_VERSION',id,version:1,contentHash:hash},{kind:'ARTIFACT',id,contentHash:hash},{kind:'CONVERSATION',id,contentHash:hash},{kind:'USER_INSTRUCTION',id,contentHash:hash}],before=structuredClone(refs);
 assert.deepEqual(m.readDesignChangeSources(refs),before);assert.deepEqual(refs,before);assert.notEqual(m.readDesignChangeSources(refs),refs);assert.deepEqual(m.readDesignChangeSources([]),[]);
});
test('잘못된/중복/과다 출처나 권한 위장 필드는 저장 후보로 받지 않는다',async()=>{
 const m=await import('../../../apps/server/modules/traceability/design-change-sources.ts').catch(()=>null);assert.ok(m,'변경 출처 경계 검사 필요');const ref={kind:'CONVERSATION',id,contentHash:hash};
 for(const invalid of [null,{},[ref,ref],[{...ref,kind:'AGENT_APPROVAL'}],[{...ref,contentHash:'x'}],[{...ref,allow:true}],[{kind:'DOCUMENT_VERSION',id,version:0,contentHash:hash}],Array.from({length:201},()=>ref)])assert.throws(()=>m.readDesignChangeSources(invalid),(e:unknown)=>(e as{statusCode:number}).statusCode===422);
});
