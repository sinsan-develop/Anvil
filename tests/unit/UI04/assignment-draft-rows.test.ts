import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AssignmentPage } from '../../../apps/web/src/features/workspace/assignment-api.ts';
const file='../../../apps/web/src/features/workspace/AssignmentDraftRows.ts';
const id='11000000-0000-4000-8000-000000000001',ref={id,version:2,contentHash:'a'.repeat(64)};
function fixture():AssignmentPage['items']{return[{ref:{...ref,id:'22000000-0000-4000-8000-000000000002'},status:'DRAFT',goal:'목표 <script>원입력</script>',taskRef:{planRef:{...ref,version:3,contentHash:'b'.repeat(64)},taskCode:'FN01',applicationRef:ref,nodeId:'N1'},issueCount:2,updatedAt:'2026-10-24T01:00:00Z',ready:false,executionAuthorized:false}];}
test('목록 행은 정확 업무·단계·양쪽 고정 참조와 준비·현재성 한계를 표시한다',async()=>{
 const {AssignmentDraftRows}=await import(file),items=fixture(),before=structuredClone(items),calls:unknown[]=[];
 const html=renderToStaticMarkup(createElement(AssignmentDraftRows,{items,busy:false,currentApplicationRef:ref,stage:{applicationId:id,nodeId:'N1',nodeName:'선택단계'},onOpen:(r:unknown)=>calls.push(r)}));
 for(const text of ['FN01','N1','선택 단계와 고정 참조 일치','목록 원본 현재성 미재검사','실제 배정·실행 허가 아님',ref.contentHash,items[0]!.taskRef.planRef.contentHash])assert.ok(html.includes(text),text);
 assert.match(html,/&lt;script&gt;원입력&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);assert.deepEqual(items,before);assert.equal(calls.length,0);
});
test('다른 node·적용본 버전/hash와 단계 미선택은 현재 단계로 합성하지 않는다',async()=>{
 const {AssignmentDraftRows}=await import(file),items=fixture();
 for(const [stage,currentApplicationRef]of [[{applicationId:id,nodeId:'N2'},ref],[{applicationId:'33000000-0000-4000-8000-000000000003',nodeId:'N1'},ref],[{applicationId:id,nodeId:'N1'},{...ref,version:3}],[{applicationId:id,nodeId:'N1'},{...ref,contentHash:'f'.repeat(64)}]]){
  const html=renderToStaticMarkup(createElement(AssignmentDraftRows,{items,busy:false,stage,currentApplicationRef,onOpen:()=>{throw Error('렌더 조회 금지');}}));assert.match(html,/선택 단계 또는 적용본과 다름/);assert.doesNotMatch(html,/선택 단계와 고정 참조 일치/);
 }
 const html=renderToStaticMarkup(createElement(AssignmentDraftRows,{items,busy:false,stage:null,currentApplicationRef:ref,onOpen:()=>{}}));assert.match(html,/선택 단계 없음 · 연계 미확인/);
});
test('명시 원문 열기는 같은 목록 ref만 전달하고 busy에서는 버튼을 잠근다',async()=>{
 const {AssignmentDraftRows}=await import(file),items=fixture(),seen:unknown[]=[];
 const tree=AssignmentDraftRows({items,busy:false,stage:null,currentApplicationRef:ref,onOpen:(r:unknown)=>seen.push(r)});
 function visit(value:ReactNode):any{if(Array.isArray(value)){for(const item of value){const found=visit(item);if(found)return found;}}else if(isValidElement<{children?:ReactNode;onClick?:()=>void}>(value)){if(value.type==='button')return value;return visit(value.props.children);}return null;}
 const button=visit(tree);assert.ok(button);button.props.onClick();assert.deepEqual(seen,[items[0]!.ref]);
 const busyProps={items,busy:true,stage:null,currentApplicationRef:ref,onOpen:()=>{throw Error('진행 중 조회 금지');}};
 const html=renderToStaticMarkup(createElement(AssignmentDraftRows,busyProps));assert.match(html,/<button[^>]*disabled=""/);visit(AssignmentDraftRows(busyProps)).props.onClick();assert.equal(seen.length,1);
});
