import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {resultFixture} from './result-view-fixture.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});
after(async()=>{await compiler.close();});
const screen=await compiler.ssrLoadModule('/src/features/session-detail/SessionDetailPage.tsx');
test('결과본문은제출주장·미실행·누락증거와원문을표시하며HTML/검수완료로승격하지않는다',async()=>{
 assert.equal(typeof screen.ResultContent,'function','제출 원문 화면 미연결');const f=resultFixture();f.entry.snapshot.manifest.rollback='<script>private()</script>';
 const html=renderToStaticMarkup(createElement(screen.ResultContent,{value:f.entry}));for(const text of ['제출자 주장','검수 전','INCOMPLETE','src/task.ts','NOT_EXECUTED','실제 Agent 미연결','파일 변경','명령 결과','시험 결과','미실행','되돌리기','제출 변경 파일 보고 탐색','diff 근거 참조 미보고'])assert(html.includes(text),text);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('실행 완료'));assert(!html.includes('검수 완료'));
});
