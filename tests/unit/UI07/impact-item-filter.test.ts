import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const file='../../../apps/web/src/features/design-change/ImpactItemFilter.ts';
const ref={id:'11000000-0000-4000-8000-000000000001',version:1,contentHash:'a'.repeat(64)};
const items:any[]=[{targetRef:{kind:'DESIGN_ITEM',id:ref.id,versionRef:ref,localCode:'D01',anchor:'line:4'},state:'UNKNOWN',reason:'범위 미확인',evidenceRefs:[]},{targetRef:{kind:'PLAN_TASK',id:ref.id,versionRef:ref,localCode:'FN02'},state:'UNAFFECTED',reason:'사람 검토',evidenceRefs:[]},{targetRef:{kind:'SCREEN_REGION',id:ref.id,versionRef:ref,localCode:'S01',anchor:'line:9'},state:'AFFECTED',reason:'화면 보완',evidenceRefs:[]}];
test('영향 탐색은 원순서·위치와 중복을 보존하고 상태·대상·사유만 좁힌다',async()=>{
 const {selectImpactItems}=await import(file),raw=[...items,items[0]],before=structuredClone(raw);
 assert.deepEqual(selectImpactItems(raw,'ALL','').map((r:any)=>r.index),[0,1,2,3]);
 assert.deepEqual(selectImpactItems(raw,'UNKNOWN',' d01 ').map((r:any)=>r.index),[0,3]);
 assert.deepEqual(selectImpactItems(raw,'ALL','화면').map((r:any)=>r.index),[2]);
 assert.deepEqual(selectImpactItems(raw,'UNAFFECTED','FN02').map((r:any)=>r.index),[1]);
 assert.equal(selectImpactItems(raw,'UNKNOWN','FN02').length,0);assert.deepEqual(raw,before);
});
test('탐색 표시는 전체 미확인 수와 필터 한계를 유지하고 렌더가 입력·원문 요청을 바꾸지 않는다',async()=>{
 const {ImpactItemFilter}=await import(file),before=structuredClone(items);let renders=0;
 const html=renderToStaticMarkup(createElement(ImpactItemFilter,{items,children:(rows:any[])=>{renders++;return createElement('ul',null,rows.map(r=>createElement('li',{key:r.index},r.item.targetRef.localCode)));}}));
 for(const text of ['영향 항목 상태','영향 대상·사유 찾기','전체 미확인 1건','표시된 항목만으로 영향 없음·안전을 판정하지 않습니다','D01','FN02','S01'])assert.ok(html.includes(text),text);
 assert.equal(renders,1);assert.deepEqual(items,before);
});
