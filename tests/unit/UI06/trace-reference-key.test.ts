import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readTrace,type TraceRef} from '../../../apps/web/src/features/design-trace/trace-api.ts';
const file='../../../apps/web/src/features/design-trace/trace-reference-key.ts';
const pid='11000000-0000-4000-8000-000000000001',other='22000000-0000-4000-8000-000000000002',indexId='33000000-0000-4000-8000-000000000003',designRef={id:pid,version:1,contentHash:'a'.repeat(64)};
const source:TraceRef={kind:'DESIGN_ITEM',id:indexId,versionRef:designRef,localCode:'D01',anchor:'line:1'};
test('실제 추적 getter가 구분한 다른 문서 fullref의 노드는 표시 병합에서도 각각 보존한다',async()=>{
 const {traceReferenceKey}=await import(file),refs=[source,{...source,versionRef:{...designRef,id:other}}],seen:string[]=[];
 const client=new ApiClient(async path=>{seen.push(String(path));const index=seen.length-1;return Response.json({designRef,direction:'FORWARD',nodes:[{ref:refs[index],title:index?'다른 문서':'기준 문서',designRefs:[designRef]}],edges:[],traversal:[],missingLinks:[],unknownEvidence:[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}],baselineRef:null,hasMore:index===0,nextCursor:index===0?'second':null,observedAt:'2026-10-24T01:00:00Z'});});
 const first=await readTrace(client,pid,designRef,'FORWARD',null),second=await readTrace(client,pid,designRef,'FORWARD',first.nextCursor);
 const merged=new Map([...first.nodes,...second.nodes].map(n=>[traceReferenceKey(n.ref),n]));assert.equal(merged.size,2);assert.equal(merged.get(traceReferenceKey(refs[0]))!.title,'기준 문서');assert.equal(merged.get(traceReferenceKey(refs[1]))!.title,'다른 문서');assert.equal(seen.length,2);
});
test('kind/id/문서id/version/hash/code/anchor의 차이와 정확 중복을 구분하고 입력을 바꾸지 않는다',async()=>{
 const {traceReferenceKey}=await import(file),before=structuredClone(source),key=traceReferenceKey(source);
 const variations=[{...source,kind:'SCREEN_REGION'},{...source,id:other},{...source,versionRef:{...designRef,id:other}},{...source,versionRef:{...designRef,version:2}},{...source,versionRef:{...designRef,contentHash:'b'.repeat(64)}},{...source,localCode:'D02'},{...source,anchor:'line:2'}];
 for(const value of variations)assert.notEqual(traceReferenceKey(value),key);assert.equal(traceReferenceKey(structuredClone(source)),key);assert.deepEqual(source,before);
});
