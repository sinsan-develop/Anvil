import {test} from 'node:test';import assert from 'node:assert/strict';import {ApiClient} from '../../../apps/web/src/api/client.ts';
const id='51c0439f-791e-4bb5-8471-70938d6afaf1',ref={id,version:2,contentHash:'a'.repeat(64)};
test('추적 문서 browser reader는 Node crypto를 끌어오는 서버 검증기를 소비하지 않는다',async()=>{
 const {readFile}=await import('node:fs/promises'),source=await readFile(new URL('../../../apps/web/src/features/design-trace/trace-document-original.ts',import.meta.url),'utf8');assert.doesNotMatch(source,/contracts\/runtime\/validation-v1/);
});
test('추적 문서는 정확 DOCUMENT_VERSION만 선택하고 닫힌 화면은 조회하지 않는다',async()=>{
 const m:any=await import('../../../apps/web/src/features/design-trace/trace-document-original.ts').catch(()=>null);assert.ok(m,'문서 추적 원문 reader 필요');const target={kind:'DOCUMENT_VERSION',id,versionRef:ref},selected=m.traceDocumentReference(target);assert.deepEqual(selected,ref);assert.notEqual(selected,ref);assert.throws(()=>m.traceDocumentReference({...target,localCode:'D01'}));assert.throws(()=>m.traceDocumentReference({...target,kind:'PLAN_TASK'}));assert.throws(()=>m.traceDocumentReference({...target,id:'a6f30000-0000-4000-8000-000000000090'}));let calls=0;const client=new ApiClient(async()=>{calls++;throw Error('조회 금지');});await assert.rejects(m.readTraceDocumentOriginal(client,id,target,()=>false),{code:'TRACE_DOCUMENT_READ_PAUSED'});assert.equal(calls,0);
});
