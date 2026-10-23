import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {knowledgeVersionPair,comparisonProject,comparisonUser} from './knowledge-version-comparison-fixture.ts';
import {validateKnowledgeView} from '../../../apps/web/src/features/knowledge/api.ts';
const path='../../../apps/web/src/features/knowledge/KnowledgeHistory.ts';
test('정정·제외 이력의 이유·작성자·시각과 앞 고정 버전을 보존한다',async()=>{
 const {KnowledgeHistory}=await import(path),{after,before}=knowledgeVersionPair();
 after.state='EXCLUDED';after.history.push({id:'77777777-7777-4777-8777-777777777777',kind:'EXCLUDED',reason:'새 지시로 사용 제외 <보존>',actorRef:{kind:'HUMAN',userId:comparisonUser},recordedAt:'2026-10-20T00:02:00.000Z'});
 const view=await validateKnowledgeView(after,comparisonProject,after.ref),original=structuredClone(view);
 const html=renderToStaticMarkup(createElement(KnowledgeHistory,{view}));
 for(const text of ['정정','사용 제외','새 관측으로 정정','새 지시로 사용 제외 &lt;보존&gt;',comparisonUser,'2026-10-20T00:02:00.000Z',before.ref.contentHash,'v1','v2','이 버전의 기록만 표시','원문 삭제가 아닙니다'])assert.ok(html.includes(text),text);
 assert.equal(html.includes('<보존>'),false);assert.deepEqual(view,original);assert.doesNotMatch(html,/<button|<input|<form/);
});
test('대체된 과거 버전과 제안본에 현재 확정·헌법 준수를 합성하지 않는다',async()=>{
 const {KnowledgeHistory}=await import(path),{before,after}=knowledgeVersionPair();
 for(const [input,label] of [[before,'대체된 과거 버전'],[after,'제안 상태']] as const){
  const view=await validateKnowledgeView(input,comparisonProject,input.ref),html=renderToStaticMarkup(createElement(KnowledgeHistory,{view}));
  assert.ok(html.includes(label));assert.ok(html.includes('현재 확정 유효성 미확인'));assert.ok(html.includes('Agent 전달·이해 대조 확인이 아닙니다'));
 }
});
