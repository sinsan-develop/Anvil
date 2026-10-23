import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});
after(async()=>{await compiler.close();});
const pid='11111111-1111-4111-8111-111111111111';
async function render(projectId:string|null){
 const {AccountSecurity}=await compiler.ssrLoadModule('/src/shell/AccountSecurity.tsx');let calls=0;
 const html=renderToStaticMarkup(createElement(AccountSecurity,{client:new ApiClient(async()=>{calls++;throw Error('렌더요청금지');}),csrfToken:'C'.repeat(43),projectId,onSession:()=>{throw Error('세션변경금지');},onRevoked:()=>{throw Error('회수금지');}}));
 assert.equal(calls,0);return html;
}
test('설정은 같은 프로젝트의 원화면으로 연결하고 백업·복원 미구현을 표시한다',async()=>{
 const html=await render(pid);
 for(const screen of ['workspace','connections','approvals','control','documents'])assert.ok(html.includes('#/projects/'+pid+'/'+screen),screen);
 for(const text of ['설정 관련 원화면','백업·복원 설정·실행은 미구현','이동은 설정 저장·백업·복원·승인·실행이 아닙니다'])assert.ok(html.includes(text),text);
});
test('프로젝트 미선택 설정은 프로젝트별 상태·링크를 합성하지 않는다',async()=>{
 const html=await render(null);assert.ok(html.includes('프로젝트를 선택하면 같은 프로젝트의 원화면으로 이동할 수 있습니다'));
 assert.ok(html.includes('href="#/projects"'));assert.equal(html.includes('#/projects/'+pid),false);
});
