import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
const load=async()=>{
 const result=await build({configFile:false,envDir:false,logLevel:'error',build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('../../../apps/web/src/features/knowledge/ConversationPanel.tsx',import.meta.url)),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
 const out=Array.isArray(result)?result[0]:result;assert.ok(out&&'output'in out);const chunk=out.output.find(x=>x.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
 assert.doesNotMatch(chunk.code,/from\s*["']node:|require\(["']node:/);
 const code=chunk.code.replace(/(["'])(react(?:\/jsx-runtime)?)\1/g,(_m,_q,name)=>JSON.stringify(import.meta.resolve(name)));
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
};
test('RAM SSR: 원 지시 부분계획은 명시 버튼만 제공하고 자동 GET/승인/SEND가 없다',async()=>{
 const m=await load();assert.equal(typeof m.InstructionPartsLookup,'function');let calls=0;
 const props={client:new ApiClient(async()=>{calls++;throw Error('UNEXPECTED_GET');}),projectId:'p',conversationId:'c',view:{message:{kind:'USER_INSTRUCTION'}},active:()=>true,onAuthenticationLost:()=>{throw Error('UNEXPECTED_AUTH');}};
 const html=renderToStaticMarkup(createElement(m.InstructionPartsLookup,props));assert.match(html,/>지시 부분계획 조회<\/button>/);assert.doesNotMatch(html,/SEND|승인|<details/);assert.equal(calls,0);
 const other=renderToStaticMarkup(createElement(m.InstructionPartsLookup,{...props,view:{message:{kind:'USER_MESSAGE'}}}));assert.equal(other,'');assert.equal(calls,0);
});
test('RAM SSR: 검산 결과는 부분 수/bytes와 기본 닫힌 참조 details만 표시한다',async()=>{
 const m=await load();assert.equal(typeof m.InstructionPartsDetails,'function');
 const html=renderToStaticMarkup(createElement(m.InstructionPartsDetails,{result:{instructionRef:{id:'i'},partsRef:{id:'p'},plan:{bodyRef:{bytes:65540},parts:[{},{}]}}}));
 assert.match(html,/부분 2개/);assert.match(html,/65540 bytes/);assert.match(html,/<details>/);assert.doesNotMatch(html,/<details[^>]*open|<button|<pre[^>]*>원문/);
});
