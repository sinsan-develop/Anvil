import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {originalFixture} from './transfer-original-fixture.ts';
const path='../../../apps/web/src/features/transfers/TransferSourceRows.ts';
test('원문 선택 행은 고정 문서 버전과 누락 사유를 숨기지 않는다',async()=>{
 const {TransferSourceRows}=await import(path),f=originalFixture('DOCUMENT_VERSION'),items=f.context.manifest.items,before=structuredClone(items);
 const html=renderToStaticMarkup(TransferSourceRows({items,pending:false,onRead:()=>{throw Error('렌더 요청 금지');}}));
 const item=items.find(i=>i.itemId===f.itemId)!;
 for(const text of [item.sourceRef.id,'v1',item.sourceRef.contentHash,item.reason,'원문 미선택','미선택 보존','MISSING','현재 효력·이해 대조·재개 확인이 아닙니다'])assert.ok(html.includes(text),text);
 assert.deepEqual(items,before);
});
test('대화 ref에 버전을 합성하지 않고 INCLUDED 한 건의 선택만 기존 callback에 넘긴다',async()=>{
 const {TransferSourceRows}=await import(path),f=originalFixture('USER_INSTRUCTION'),items=f.context.manifest.items;
 const callbacks:string[]=[];
 function buttons(node:any):any[]{if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(buttons);return [...(node.type==='button'?[node]:[]),...buttons(node.props?.children)];}
 const tree=TransferSourceRows({items,pending:false,onRead:(id:string)=>callbacks.push(id)}),html=renderToStaticMarkup(tree);
 assert.ok(html.includes('버전 없는 대화 원문'));assert.equal(html.includes('vundefined'),false);
 const controls=buttons(tree);assert.equal(controls.length,items.length);
 for(const control of controls)control.props.onClick();assert.deepEqual(callbacks,[f.itemId]);
 const busy=TransferSourceRows({items,pending:true,onRead:()=>{throw Error('조회 중 선택 금지');}});
 for(const control of buttons(busy)){assert.equal(control.props.disabled,true);control.props.onClick();}
});
