import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {designChangeFixture,projectId} from './design-change-fixture.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});
after(async()=>{await compiler.close();});
const module=await compiler.ssrLoadModule('/src/features/design-change/StoredChangeSources.tsx');
test('보관 출처는 문서만 명시 열기 진입을 제공하고 미지원 참조와 hash를 그대로 표시한다',()=>{
 let calls=0;const client=new ApiClient(async()=>{calls++;throw Error('UNEXPECTED_CALL');}),change:any=designChangeFixture().change;
 change.sourceRefs.push({kind:'DOCUMENT_VERSION',id:projectId,version:2,contentHash:'c'.repeat(64)});
 const html=renderToStaticMarkup(createElement(module.StoredChangeSources,{client,projectId,session:{user:{id:projectId},clientId:projectId},change,onAuthenticationLost:()=>{throw Error('UNEXPECTED_AUTH');}}));
 assert.ok(html.includes('변경 문서 출처 2 원문 보기'));assert.equal(html.includes('변경 문서 출처 1 원문 보기'),false);assert.ok(html.includes('USER_INSTRUCTION'));assert.ok(html.includes('직접 열기 미연결'));assert.ok(html.includes('c'.repeat(64)));assert.equal(calls,0);assert.equal(html.includes('aria-label="변경 근거 문서 원문"'),false);
});
test('저장 요청의 출처가 없으면 없는 상태를 표시하고 원문 조회를 만들지 않는다',()=>{
 const change:any=designChangeFixture().change;change.sourceRefs=[];const html=renderToStaticMarkup(createElement(module.StoredChangeSources,{client:new ApiClient(async()=>{throw Error('UNEXPECTED_CALL');}),projectId,session:{user:{id:projectId},clientId:projectId},change,onAuthenticationLost:()=>{}}));
 assert.ok(html.includes('출처 참조 없음'));assert.equal(html.includes('변경 근거 문서 원문 보기'),false);
});
