import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readStoredIssueBasis} from '../../../apps/web/src/features/decisions/issue-basis-api.ts';
import {prepareStoredIssueBasis} from '../../../apps/server/modules/results/stored-issue-basis.ts';
import {readSubmittedResultRecord} from '../../../apps/server/modules/results/result-submission-store.ts';
import {resultFixture} from '../UI05/result-view-fixture.ts';
import {observationJournalFor} from '../UI05/observation-journal-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/decisions/IssueBasisGuidance.ts').catch((error:NodeJS.ErrnoException)=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
function submitted(){const raw=resultFixture().entry;return{raw,result:readSubmittedResultRecord(raw,raw.snapshot.scope,raw.ref.id,'2026-10-20T00:00:00.000Z')};}

test('문제 근거의 미확인·다음 확인 안내는 보관 공백을 원인이나 자동 재시도로 바꾸지 않는다',async()=>{
 const {raw,result}=submitted(),journal=observationJournalFor(raw),basis=prepareStoredIssueBasis(result,journal,journal.observedAt),calls:string[]=[];
 const value=await readStoredIssueBasis(new ApiClient(async url=>{calls.push(String(url));return Response.json(basis);}),result,()=>true);assert.ok(value);const before=structuredClone(value);
 assert.equal(typeof mod.IssueBasisGuidance,'function');const html=renderToStaticMarkup(createElement(mod.IssueBasisGuidance,{value}));
 for(const text of ['확인하지 못한 사항','직접 원인은 확인되지 않았습니다','실제 공급자 동작은 검증하지 않았습니다','관측 순번에 보관 공백이 있습니다','현재 직접 관측이 없습니다','다음 확인 선택','누락 순번의 보관·수신 기록을 대조','자동으로 수행하지 않습니다'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/<button|<input|<form|<a\b/);assert.deepEqual(value,before);assert.deepEqual(calls,[`/api/v1/projects/${result.snapshot.scope.projectId}/results/${result.ref.id}/issue-basis`]);
});

test('보관 ACK 없음의 안내는 공백 해소나 정상·완료로 바꾸지 않고 근거 조사를 남긴다',async()=>{
 const {raw,result}=submitted(),journal=observationJournalFor(raw);Object.assign(journal,{items:[],storedCount:0,hasMore:false,ack:null});const basis=prepareStoredIssueBasis(result,journal,journal.observedAt);
 const value=await readStoredIssueBasis(new ApiClient(async()=>Response.json(basis)),result,()=>true);assert.ok(value);assert.equal(typeof mod.IssueBasisGuidance,'function');
 const html=renderToStaticMarkup(createElement(mod.IssueBasisGuidance,{value}));
 assert.ok(html.includes('직접 원인을 추측하지 말고 근거를 확인'));assert.ok(html.includes('현재 직접 관측이 없습니다'));assert.equal(html.includes('누락 순번의 보관·수신 기록을 대조'),false);assert.equal(html.includes('관측 순번에 보관 공백이 있습니다'),false);assert.doesNotMatch(html,/<button|<input|<form|<a\b/);assert.equal(value.classification.kind,'UNVERIFIED_CAUSE');
});
