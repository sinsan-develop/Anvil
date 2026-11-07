import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {reworkFixture} from '../FN12/result-rework-input-fixture.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});after(async()=>{await compiler.close();});

test('문제 보고의 고정 임무에는 기존 검수와 보완 이력의 명시 조회를 함께 제공한다',async()=>{
 const m=await compiler.ssrLoadModule('/src/features/decisions/ReportedIssueHistories.ts'),f=reworkFixture(),before=structuredClone(f.sources);let requests=0,unavailable=0,lost=0;
 const client=new ApiClient(async()=>{requests++;throw Error('NO_AUTOMATIC_QUERY');});
 const html=renderToStaticMarkup(createElement(m.ReportedIssueHistories,{client,result:f.sources.result,assignment:f.sources.assignment,onUnavailable:()=>unavailable++,onAuthenticationLost:()=>lost++}));
 for(const text of ['검수 이력 조회','보관 보완 목록 조회','최신 자동선택','실제 배정/실행은 하지 않습니다'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/보관 보완 목록 조회/g)??[]).length,1);assert.equal(requests,0);assert.equal(unavailable,0);assert.equal(lost,0);assert.deepEqual(f.sources,before);assert.doesNotMatch(html,/보완 저장 명령|보완 저장|재작업 시작|<form|<input/);
});
