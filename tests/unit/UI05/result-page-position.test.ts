import assert from 'node:assert/strict';
import { test } from 'node:test';
const file='../../../apps/web/src/features/session-detail/result-page-position.ts';
test('제출 이력 위치는 방문 cursor를 그대로 보존해 최근 페이지로 돌아간다',async()=>{
 const {initialResultPagePosition,olderResultPage,newerResultPage}=await import(file);
 const first=initialResultPagePosition(),second=olderResultPage(first,'opaque%2Fcursor-one'),third=olderResultPage(second,'opaque-two');
 assert.deepEqual(first,{cursors:[null],index:0});assert.equal(third.index,2);
 const back=newerResultPage(third);assert.equal(back.index,1);assert.equal(back.cursors[back.index],'opaque%2Fcursor-one');assert.deepEqual(newerResultPage(back),{cursors:[null,'opaque%2Fcursor-one','opaque-two'],index:0});assert.deepEqual(first,{cursors:[null],index:0});
});
test('되돌아간 뒤 서버가 새 cursor를 주면 이전 이후 경로만 교체하며 초기화는 과거 cursor를 쓰지 않는다',async()=>{
 const {initialResultPagePosition,olderResultPage,newerResultPage}=await import(file);
 const third=olderResultPage(olderResultPage(initialResultPagePosition(),'one'),'old-two'),before=structuredClone(third);
 const changed=olderResultPage(newerResultPage(third),'new-two');assert.deepEqual(changed,{cursors:[null,'one','new-two'],index:2});assert.deepEqual(third,before);
 assert.deepEqual(initialResultPagePosition(),{cursors:[null],index:0});
});
test('첫 페이지 복귀는 그대로이고 비어 있거나 과도한 cursor로 이동하지 않는다',async()=>{
 const {initialResultPagePosition,olderResultPage,newerResultPage}=await import(file),first=initialResultPagePosition();
 assert.equal(newerResultPage(first),first);
 for(const cursor of ['',null,'a'.repeat(4097)])assert.throws(()=>olderResultPage(first,cursor));
});
