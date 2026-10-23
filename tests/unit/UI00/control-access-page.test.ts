import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
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
 for(const text of ['작업 권한 인계','선택 프로젝트 제어·준비 상태 조회','인수 요청·안전 요약·다음 담당자 수락·권한 전환은 미구현','조회는 인수 요청·수락·새 권한 발급이 아닙니다'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/<button/g)??[]).length,1);assert.doesNotMatch(html,/<input|<form|<textarea/);
});
test('제어 메뉴의 이동은 선택 프로젝트에만 연결하고 다른 프로젝트를 섞지 않는다',async()=>{
 const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
 const html=await render(second);assert.ok(html.includes('#/projects/'+second+'/workspace'));assert.equal(html.includes(first),false);
});
