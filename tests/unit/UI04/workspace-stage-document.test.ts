import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { readDocument } from '../../../apps/web/src/features/design-trace/api.ts';
import { contentHash } from '../../../contracts/canonical.ts';
const pid='11000000-0000-4000-8000-000000000001',id='11000000-0000-4000-8000-000000000002',aid='11000000-0000-4000-8000-000000000003',fid='11000000-0000-4000-8000-000000000004';
function fixture(nodeId='A', applicationId=aid) {
 const body='보존할 원문',bytes=Buffer.from(body),formRef={id:fid,version:1,contentHash:'f'.repeat(64)};
 const document={id,version:1,title:'단계 원문',confirmed:false,contentHash:'c'.repeat(64),formRef,stageNodeRef:{applicationId,nodeId},stageBinding:{applicationRef:{id:applicationId,version:1,contentHash:'a'.repeat(64)},methodologyName:'방법론',nodeId,nodeName:nodeId,uses:['OUTPUT']},content:{body:{artifactId:fid,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]},validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 return {body,bytes,document};
}
const code=(expected:string)=>(e:unknown)=>e instanceof ApiError&&e.code===expected;
test('선택 단계와 다른 문서는 메타데이터에서 거절하고 원문 GET을 하지 않는다',async()=>{
 for(const mismatch of ['NODE','APPLICATION','UNBOUND']){
  const f=fixture(mismatch==='NODE'?'B':'A',mismatch==='APPLICATION'?fid:aid),calls:string[]=[];
  if(mismatch==='UNBOUND')Object.assign(f.document,{stageNodeRef:null,stageBinding:null});
  const client=new ApiClient(async path=>{calls.push(String(path));return String(path).includes('/files/')?new Response(f.bytes,{headers:{'content-type':'application/octet-stream'}}):Response.json(f.document);});
  const options={active:()=>true,expectedStage:{applicationId:aid,nodeId:'A'}};
  await assert.rejects(readDocument(client,pid,id,1,options),code('DOCUMENT_STAGE_CHANGED'));
  assert.deepEqual(calls,[`/api/v1/projects/${pid}/documents/${id}/versions/1`]);
 }
});
test('첫 대기 전 단계 선택을 고정하며 호출자가 뒤에 바꿔도 다른 원문을 읽지 않는다',async()=>{
 const f=fixture('B'),expectedStage={applicationId:aid,nodeId:'A'},calls:string[]=[];
 const client=new ApiClient(async path=>{calls.push(String(path));if(String(path).includes('/files/'))return new Response(f.bytes,{headers:{'content-type':'application/octet-stream'}});expectedStage.nodeId='B';return Response.json(f.document);});
 await assert.rejects(readDocument(client,pid,id,1,{active:()=>true,expectedStage}),code('DOCUMENT_STAGE_CHANGED'));assert.equal(calls.length,1);
});
test('이탈은 후속 원문 조회를 막고 같은 단계 정상 조회·기존 무필터 조회는 보존한다',async()=>{
 const f=fixture();let active=true;const calls:string[]=[];
 const paused=new ApiClient(async path=>{calls.push(String(path));active=false;return Response.json(f.document);});
 await assert.rejects(readDocument(paused,pid,id,1,{active:()=>active,expectedStage:{applicationId:aid,nodeId:'A'}}),code('DOCUMENT_READ_PAUSED'));assert.equal(calls.length,1);
 for(const options of [undefined,{active:()=>true,expectedStage:{applicationId:aid,nodeId:'A'}}]){
  const requests:string[]=[],client=new ApiClient(async path=>{requests.push(String(path));return String(path).includes('/files/')?new Response(f.bytes,{headers:{'content-type':'application/octet-stream'}}):Response.json(f.document);});
  const value=await readDocument(client,pid,id,1,options);assert.equal(value.body,f.body);assert.equal(requests.length,2);
 }
});
