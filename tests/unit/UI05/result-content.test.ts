import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {transformWithOxc} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {resultFixture} from './result-view-fixture.ts';
test('결과본문은제출주장·미실행·누락증거와원문을표시하며HTML/검수완료로승격하지않는다',async()=>{
 const url=new URL('../../../apps/web/src/features/session-detail/SessionDetailPage.tsx',import.meta.url),require=createRequire(import.meta.url);
 const compile=async(source:URL,reviewModule?:string,criteriaModule?:string)=>{const compiled=(await transformWithOxc(await readFile(source,'utf8'),fileURLToPath(source),{lang:'tsx'})).code,code=compiled.replace(/(from\s*['"])([^'"]+)(['"])/g,(_m,start,path,end)=>start+(path==='./ResultReviewSources.tsx'&&reviewModule?reviewModule:path==='./ResultCriteriaEditor.tsx'&&criteriaModule?criteriaModule:path.startsWith('.')?new URL(path,source).href:pathToFileURL(require.resolve(path)).href)+end);return'data:text/javascript;base64,'+Buffer.from(code).toString('base64');};
 const criteriaModule=await compile(new URL('./ResultCriteriaEditor.tsx',url)),reviewModule=await compile(new URL('./ResultReviewSources.tsx',url),undefined,criteriaModule),screen=await import(await compile(url,reviewModule));
 assert.equal(typeof screen.ResultContent,'function','제출 원문 화면 미연결');const f=resultFixture();f.entry.snapshot.manifest.rollback='<script>private()</script>';
 const html=renderToStaticMarkup(createElement(screen.ResultContent,{value:f.entry}));for(const text of ['제출자 주장','검수 전','INCOMPLETE','src/task.ts','NOT_EXECUTED','실제 Agent 미연결','파일 변경','명령 결과','시험 결과','미실행','되돌리기'])assert(html.includes(text),text);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('실행 완료'));assert(!html.includes('검수 완료'));
});
