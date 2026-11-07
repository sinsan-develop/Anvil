import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const path='../../../apps/web/src/features/decisions/ApprovalOutcome.ts';
const ref={id:'11000000-0000-4000-8000-000000000001',version:1,contentHash:'a'.repeat(64)};
const decision={ref,id:ref.id,requestId:ref.id,requestVersion:1,requestRef:ref,scopeDigest:'b'.repeat(64),decision:'APPROVE' as const,reason:'범위만 <확인>',decidedBy:{kind:'HUMAN' as const,userId:'owner-user',clientId:'owner-client'},controlGeneration:1,policyRef:ref,decidedAt:'2026-10-24T00:00:00.000Z'};
test('저장 결정은 현재 만료·회수와 구분하고 이유·결정 주체를 보존한다',async()=>{
 const {ApprovalOutcome}=await import(path);
 for(const [choice,label,state] of [['APPROVE','이번만 승인','EXPIRED'],['APPROVE','이번만 승인','REVOKED'],['REJECT','거절','REJECTED'],['REQUEST_CHANGE','수정 요청','CHANGE_REQUESTED']] as const){
  const view={decision:{...decision,decision:choice},consumption:null,effectiveState:state,expired:state==='EXPIRED',basisCurrent:state!=='REVOKED',observedAt:'2026-10-24T01:00:00.000Z'},before=structuredClone(view);
  const html=renderToStaticMarkup(createElement(ApprovalOutcome,{view}));
  for(const text of [label,state,'범위만 &lt;확인&gt;','owner-user','owner-client',decision.decidedAt,view.observedAt,'실제 실행·성공의 증거는 아닙니다'])assert.ok(html.includes(text),text);
  assert.equal(html.includes('<확인>'),false);assert.deepEqual(view,before);assert.doesNotMatch(html,/<button|<input|<form/);
 }
});
test('결정·소비 기록 없음과 일회 사용 기록을 실행 성공으로 바꾸지 않는다',async()=>{
 const {ApprovalOutcome}=await import(path),base={effectiveState:'PENDING',expired:false,basisCurrent:true,observedAt:'2026-10-24T01:00:00.000Z'};
 const empty=renderToStaticMarkup(createElement(ApprovalOutcome,{view:{...base,decision:null,consumption:null}}));
 assert.ok(empty.includes('저장된 결정 없음'));assert.ok(empty.includes('이 조회에 일회 사용 기록 없음'));assert.equal(empty.includes('이번만 승인'),false);
 const consumption={id:ref.id,status:'CONSUMED' as const,commandId:'original-command',serverCommandId:'server-command',requestHash:'c'.repeat(64),scopeDigest:'b'.repeat(64),policyRef:ref,consumedAt:'2026-10-24T00:30:00.000Z'};
 const view={...base,effectiveState:'CONSUMED',decision,consumption},before=structuredClone(view);
 const used=renderToStaticMarkup(createElement(ApprovalOutcome,{view}));
 for(const text of ['일회 사용 기록','original-command','server-command',consumption.consumedAt,'실제 실행·성공의 증거는 아닙니다'])assert.ok(used.includes(text),text);
 assert.deepEqual(view,before);assert.doesNotMatch(used,/<button|<input|<form/);
});
