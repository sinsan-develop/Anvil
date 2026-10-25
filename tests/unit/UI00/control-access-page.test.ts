import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {createControlHandoffSummary} from '../../../apps/server/modules/control-handoff/control-handoff-summary.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});
after(async()=>{await compiler.close();});
async function render(projectId:string){
 const {ControlAccessPage}=await compiler.ssrLoadModule('/src/features/control-handoff/ControlAccessPage.tsx');let calls=0,lost=0;
 const html=renderToStaticMarkup(createElement(ControlAccessPage,{client:new ApiClient(async()=>{calls++;throw Error('페이지 열기 요청 금지');}),projectId,onAuthenticationLost:()=>{lost++;}}));
 assert.equal(calls,0);assert.equal(lost,0);return html;
}
test('인계 메뉴는 기존 제어 조회를 제공하되 열기만으로 조회·허가·수락하지 않는다',async()=>{
 const html=await render('11111111-1111-4111-8111-111111111111');
 for(const text of ['작업 권한 인계','선택 프로젝트 제어·준비 상태 조회','다른 사람 선택·다음 담당자 수락·권한 전환은 미구현','조회는 인수 요청·수락·새 권한 발급이 아닙니다'])assert.ok(html.includes(text),text);
 // UI12 adds explicit FN15 queries and a preserved SELF form; opening still sends nothing.
 assert.equal((html.match(/<button/g)??[]).length,6);
 assert.equal((html.match(/<textarea/g)??[]).length,1);assert.equal((html.match(/<input/g)??[]).length,1);assert.doesNotMatch(html,/<form/);
 for(const label of ['현재 제어 조회','인수 요청 이유','요청 만료 시각','내 요청 목록 조회','현재 제어자 요청 목록 조회','인수 수락 (미구현)','연결은 기본 비활성']) assert.ok(html.includes(label),label);
 assert.match(html,/<button[^>]*disabled[^>]*>인수 수락 \(미구현\)<\/button>/);
});
test('제어 메뉴의 이동은 선택 프로젝트에만 연결하고 다른 프로젝트를 섞지 않는다',async()=>{
 const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
 const html=await render(second);assert.ok(html.includes('#/projects/'+second+'/workspace'));assert.equal(html.includes(first),false);
});

test('요약 30초 기한 경과와 원요청 20분 기한 내를 서버 관측으로 분리 표시한다',async()=>{
 const {ControlSummaryView}=await compiler.ssrLoadModule('/src/features/control-handoff/ControlAccessPage.tsx');
 const projectId='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',requestRef={id,version:1,contentHash:'a'.repeat(64)},basis={actorId:id,clientId:'33333333-3333-4333-8333-333333333333',generation:1,version:1};
 const expiresAt='2026-10-26T00:20:00.000Z';const record=createControlHandoffSummary({projectId,requestRef,version:1,controller:basis,baseControl:basis,observedAt:'2026-10-26T00:00:00.000Z',requestExpiresAt:expiresAt,collections:{activeExecutions:null,pendingCommands:null,pendingApprovals:null,sourceCheckpointRefs:null}});
 const summary={projectId,requestRef,summaryRef:record.summaryRef,body:record.body,observedAt:'2026-10-26T00:01:00.000Z',current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
 const html=renderToStaticMarkup(createElement(ControlSummaryView,{summary,requestExpiresAt:expiresAt}));
 assert.ok(html.includes('요약 기한 경과'));assert.ok(html.includes('원요청은 관측 시점 기한 내'));assert.ok(html.includes(summary.observedAt));assert.ok(html.includes(record.body.validUntil));assert.doesNotMatch(html,/관측 시점 요약 기한 내/);
});
