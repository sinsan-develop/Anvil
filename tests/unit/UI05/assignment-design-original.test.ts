import assert from 'node:assert/strict';import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {assignmentDesignFixture} from './assignment-design-original-fixture.ts';
const m:any=await import('../../../apps/web/src/features/session-detail/assignment-design-original.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function reader(){assert.equal(typeof m.readAssignmentDesignOriginal,'function');return m.readAssignmentDesignOriginal;}
test('확정 임무와 원초안 baseline에 결박된 설계 exact 버전·hash·보호 bytes만 읽는다',async()=>{
 const read=reader(),f=assignmentDesignFixture(),before=structuredClone(f.detail),calls:string[]=[],base=`/api/v1/projects/${f.detail.projectId}`;
 const result=await read(new ApiClient(async(url,init)=>{calls.push(String(url));assert.equal(init?.method,'GET');if(String(url)===`${base}/documents/${f.document.id}/versions/2`)return Response.json(f.document);if(String(url)===`${base}/files/${f.fileId}`)return new Response(f.bytes,{headers:{'content-type':'application/octet-stream'}});throw Error('UNEXPECTED');}),f.detail);
 assert.equal(result.body,f.body);assert.equal(result.document.version,2);assert.equal(calls.length,2);assert.deepEqual(f.detail,before);
});
test('다른 확정본·초안·설계 baseline과 중복 baseline은 문서/본문 GET0으로 거절한다',async()=>{
 const read=reader();for(const mode of ['PAIR','DEFINITION','BASELINE','DUPLICATE','PROJECT']){const f=assignmentDesignFixture();
  if(mode==='PAIR')f.detail.confirmed!.snapshot.draftRef={...f.detail.draft.ref,contentHash:'0'.repeat(64)};
  if(mode==='DEFINITION')f.detail.confirmed!.snapshot.definition=structuredClone(f.detail.confirmed!.snapshot.definition),f.detail.confirmed!.snapshot.definition.goal='다른 임무';
  if(mode==='BASELINE')f.detail.draft.snapshot.definition.baselineRefs=[];
  if(mode==='DUPLICATE')f.detail.draft.snapshot.definition.baselineRefs.push({...f.detail.draft.snapshot.basis.designRef});
  if(mode==='PROJECT')f.detail.confirmed!.projectId=f.document.id;
  let calls=0;await assert.rejects(read(new ApiClient(async()=>{calls++;throw Error('UNEXPECTED');}),f.detail),{code:'ASSIGNMENT_DESIGN_ORIGINAL_UNVERIFIED'});assert.equal(calls,0);
 }
});
test('다른 metadata hash·미지원 source·권한거절·이탈은 보호 bytes GET0이고 변조 bytes는 채택하지 않는다',async()=>{
 const read=reader();for(const mode of ['HASH','SOURCE','DENIED','LATE','BYTES']){const f=assignmentDesignFixture();let active=true,bodyCalls=0;
  const client=new ApiClient(async url=>{if(String(url).includes('/files/')){bodyCalls++;return new Response(mode==='BYTES'?Buffer.from('변조'):f.bytes,{headers:{'content-type':'application/octet-stream'}});}if(mode==='HASH')return Response.json({...f.document,contentHash:'0'.repeat(64)});if(mode==='SOURCE')return Response.json({...f.document,content:{...f.document.content,sourceRefs:[{id:f.document.id}]}});if(mode==='DENIED')return Response.json({code:'ACCESS_DENIED'},{status:403});if(mode==='LATE')active=false;return Response.json(f.document);});
  await assert.rejects(read(client,f.detail,()=>active));assert.equal(bodyCalls,mode==='BYTES'?1:0);
 }
});
