import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {emptyDraft} from '../../../apps/web/src/features/project-create/api.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),configLoader:'runner',server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});after(async()=>{await compiler.close();});
const page=await compiler.ssrLoadModule('/src/features/project-create/ProjectCreatePage.tsx');
const uid='98000000-0000-4000-8000-000000000001',did='98000000-0000-4000-8000-000000000002';
const prior=Object.getOwnPropertyDescriptor(globalThis,'location');Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://anvil.invalid/#/projects/new')});after(()=>{if(prior)Object.defineProperty(globalThis,'location',prior);else Reflect.deleteProperty(globalThis,'location');});
function fixture(step=3){return{...emptyDraft(),ownerUserId:uid,draftId:did,version:2,wizardStep:step,input:{...emptyDraft().input,name:'이름',purpose:'목적',desiredOutcome:'결과',methodologySelection:{kind:'CONFIRMED_REFERENCE' as const,versionRef:{id:did,version:2,contentHash:'a'.repeat(64)}}}};}
function render(buffer=fixture()){const before=structuredClone(buffer);let requests=0,changes=0;const html=renderToStaticMarkup(createElement(page.ProjectCreatePage,{client:new ApiClient(async()=>{requests++;throw Error('NO_REQUEST');}),session:{user:{id:uid},clientId:did,csrfToken:'C'.repeat(43)},buffer,onChange:()=>{changes++;},onAuthenticationLost:()=>{}}));assert.equal(requests,0);assert.equal(changes,0);assert.deepEqual(buffer,before);return html;}
test('3단계의 고정 참조만 명시적 조회를 제공하고 자동 요청·입력 변경은 없다',()=>{assert.match(render(),/>저장된 준비 요구 조회<\/button>/);for(const step of [1,2,4])assert.doesNotMatch(render(fixture(step)),/>저장된 준비 요구 조회<\/button>/);assert.doesNotMatch(render({...fixture(),ownerUserId:did}),/>저장된 준비 요구 조회<\/button>/);});
test('고정 원문의 단계별 요구를 텍스트로 표시하고 빈/공백 요구는 미작성으로 남긴다',async()=>{
 const module=await compiler.ssrLoadModule('/src/features/project-create/PinnedMethodRequirements.tsx');assert.equal(typeof module.PinnedMethodRequirementsContent,'function');
 const graph={nodes:[{nodeId:'N1',name:'구현',requirements:{capabilities:['코딩'],environment:['<script>Windows</script>']}},{nodeId:'N2',name:'검토',requirements:{capabilities:['   '],environment:[]}}]};const before=structuredClone(graph),html=renderToStaticMarkup(createElement(module.PinnedMethodRequirementsContent,{graph}));
 for(const text of ['N1 · 구현','코딩','&lt;script&gt;Windows&lt;/script&gt;','N2 · 검토','요구 능력 미작성','요구 환경 미작성'])assert.ok(html.includes(text),text);assert.doesNotMatch(html,/<script>/);assert.deepEqual(graph,before);
});
