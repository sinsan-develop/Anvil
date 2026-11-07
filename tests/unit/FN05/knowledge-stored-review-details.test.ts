import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {knowledgeVersionPair,comparisonProject,comparisonUser} from './knowledge-version-comparison-fixture.ts';
import {validateKnowledgeView} from '../../../apps/web/src/features/knowledge/api.ts';
import {knowledgeCriterionIds,type KnowledgeStoredReview} from '../../../apps/web/src/features/knowledge/review-view.ts';
async function loadDetails(){
 const result=await build({configFile:false,logLevel:'error',build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('../../../apps/web/src/features/knowledge/KnowledgeStoredReviewDetails.tsx',import.meta.url)),formats:['es']},rollupOptions:{external:['react/jsx-runtime']}}});
 const output=Array.isArray(result)?result[0]:result;if(!output||!('output' in output))throw Error('bundle missing');const chunk=output.output.find(o=>o.type==='chunk');if(!chunk||chunk.type!=='chunk')throw Error('chunk missing');
 const code=chunk.code.replace(/(["'])react\/jsx-runtime\1/g,JSON.stringify(import.meta.resolve('react/jsx-runtime')));return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
test('저장된 두 검토의 기준·정확 대상·판정·이유·작성 정보를 읽기 전용으로 표시한다',async()=>{
 const {KnowledgeStoredReviewDetails}=await loadDetails(),{after}=knowledgeVersionPair();
 const criteria={criteriaVersion:1 as const,knowledgeKind:'FACT',items:knowledgeCriterionIds.map((criterionId,n)=>({criterionId,title:`보관 기준 ${n+1}`}))};
 after.contentReviewCriteria=criteria;after.confirmation=null;after.currentConfirmationValid=false;
 after.contentReviews=[2,1].map(n=>({ref:{id:`77777777-7777-4777-8777-77777777777${n}`,targetRef:after.ref,criteriaVersion:1,outcome:'REWORK'},criteria,items:knowledgeCriterionIds.map((criterionId,i)=>({criterionId,outcome:(['ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED','ACCEPTED'] as const)[i],evidenceRefs:[],reason:`검토${n} 항목${i+1} <script>unsafe()</script>`})).reverse(),reviewer:{kind:'HUMAN',userId:comparisonUser,sameAsTargetRecorder:n===1},sourceKind:'HUMAN_REVIEW',reason:`총 이유 ${n}`,reviewedAt:`2026-10-20T00:00:0${n}.123Z`,serverSequence:n})) as KnowledgeStoredReview[];
 const view=await validateKnowledgeView(after,comparisonProject,after.ref),before=structuredClone(view),html=renderToStaticMarkup(createElement(KnowledgeStoredReviewDetails,{view}));
 for(const text of ['보관 내용 검토','검토 ID','총 이유 2','총 이유 1','적합','재작업','차단','미실행',after.ref.id,after.ref.contentHash,comparisonUser,'2026-10-20T00:00:02.123Z','같음','다름','기준 버전','서버 순번'])assert.ok(html.includes(text),text);
 for(let n=1;n<=5;n++){assert.equal(html.split(`보관 기준 ${n}`).length-1,2);assert.ok(html.includes(`항목${n} &lt;script&gt;unsafe()&lt;/script&gt;`));}
 assert.equal((html.match(/<details/g)||[]).length,2);assert.doesNotMatch(html,/<details[^>]*\bopen|<script|<button|<input|<form|<textarea/);assert.ok(html.indexOf('총 이유 2')<html.indexOf('총 이유 1'));assert.deepEqual(view,before);
 const row=html.match(/<li[^>]*>.*?<\/li>/)?.[0]??'';assert.ok(row.includes('보관 기준 1'));assert.ok(row.includes('항목1'));assert.ok(row.includes('적합'));
});
test('검토 목록 없음과 검토 메타데이터 미제공을 구분한다',async()=>{
 const {KnowledgeStoredReviewDetails}=await loadDetails(),{after}=knowledgeVersionPair();
 const unavailable=renderToStaticMarkup(createElement(KnowledgeStoredReviewDetails,{view:after}));assert.ok(unavailable.includes('검토 메타데이터 미제공'));assert.ok(!unavailable.includes('보관된 내용 검토가 없습니다'));
 const empty=renderToStaticMarkup(createElement(KnowledgeStoredReviewDetails,{view:{...after,contentReviews:[]}}));assert.ok(empty.includes('보관된 내용 검토가 없습니다'));assert.doesNotMatch(empty,/<details|적합|PASS/);
});
