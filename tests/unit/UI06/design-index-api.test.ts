import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalJson,contentHash } from '../../../contracts/canonical.ts';
import { ApiClient,ApiError } from '../../../apps/web/src/api/client.ts';
import { newDesignIndex,prepareDesignIndex,readDesignIndex,sendDesignIndex } from '../../../apps/web/src/features/design-trace/design-index-api.ts';
import { editDocument } from '../../../apps/web/src/features/design-trace/editor-api.ts';
const project='51c0439f-791e-4bb5-8471-70938d6afaf1',id='32b5f276-13e6-4d8a-b93f-27a15d21c788',itemId='a6f30000-0000-4000-8000-000000000099',ref={id,version:1,contentHash:'a'.repeat(64)};
const source={documentRef:ref,localCode:'D01',title:'사용자 소유 원문',anchor:'line:1'};
const value={documentRef:ref,items:[{id:itemId,...source,itemHash:contentHash(canonicalJson(source))}],screenRegions:[],status:'INDEXED',observedAt:'2026-10-16T05:00:00Z'};
test('설계 추적 조회는 정확 문서 버전과 항목 hash를 확인하고 GET만 보낸다',async()=>{
  const calls:string[]=[];const client=new ApiClient(async(input,init)=>{calls.push(String(input));assert.equal(init?.method,'GET');return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});});
  const read=await readDesignIndex(client,project,ref);assert.equal(read.items[0]?.localCode,'D01');assert.deepEqual(calls,[`/api/v1/projects/${project}/design-index?documentId=${id}&version=1`]);
});
test('다른 버전·변조 항목·가짜 완료 상태는 조회 성공으로 채택하지 않는다',async()=>{
  for(const response of [{...value,documentRef:{...ref,version:2}},{...value,items:[{...value.items[0],title:'변조'}]},{...value,status:'COMPLETED'}]){
    await assert.rejects(readDesignIndex(new ApiClient(async()=>new Response(JSON.stringify(response),{headers:{'content-type':'application/json'}})),project,ref),ApiError);
  }
  let calls=0;await assert.rejects(readDesignIndex(new ApiClient(async()=>{calls++;throw Error();}),'../outside',ref),ApiError);assert.equal(calls,0);
});
test('추적 등록은 다른 주체·중단 화면·변조 명령이면 전송하지 않고 같은 입력 snapshot만 보낸다',async()=>{
  const session={user:{id},clientId:id,csrfToken:'C'.repeat(43)},document={id,version:1,contentHash:ref.contentHash,title:'설계',formRef:ref,stageNodeRef:null,content:{body:{artifactId:itemId,bytes:1,contentHash:'b'.repeat(64),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]},contentReviewCriteria:{items:[]}} as any;
  const b=editDocument(project,{document,body:'# D01 사용자 소유 원문'},id,1);b.designIndexState=newDesignIndex(b);b.designIndexState.input={items:[{localCode:'D01',title:'사용자 소유 원문',anchor:'line:1'}],screens:[],reason:'원문 위치 확인'};
  assert.throws(()=>prepareDesignIndex(b,{...session,user:{id:project}}),ApiError);b.designIndexState.pending=prepareDesignIndex(b,session);
  let calls=0;const client=new ApiClient(async()=>{calls++;throw Error('unexpected');});
  await assert.rejects(sendDesignIndex(client,b,session,()=>false),(e:unknown)=>(e as ApiError).code==='DESIGN_INDEX_CONTINUATION_PAUSED');
  await assert.rejects(sendDesignIndex(client,{...b,designIndexState:{...b.designIndexState,pending:{...b.designIndexState.pending,operation:'proposeDocumentChange'}}},session,()=>true),ApiError);
  await assert.rejects(sendDesignIndex(client,{...b,designIndexState:{...b.designIndexState,pending:{...b.designIndexState.pending,projectId:id}}},session,()=>true),ApiError);assert.equal(calls,0);
});
