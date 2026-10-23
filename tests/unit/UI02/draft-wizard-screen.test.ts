import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {emptyDraft} from '../../../apps/web/src/features/project-create/api.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});after(async()=>{await compiler.close();});
const m=await compiler.ssrLoadModule('/src/features/project-create/ProjectCreatePage.tsx');
const previous=Object.getOwnPropertyDescriptor(globalThis,'location');Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://anvil.invalid/#/projects/new')});after(()=>{if(previous)Object.defineProperty(globalThis,'location',previous);else Reflect.deleteProperty(globalThis,'location');});
const uid='98000000-0000-4000-8000-000000000001',did='98000000-0000-4000-8000-000000000002';
function fixture(step:number):any{return{...emptyDraft(),ownerUserId:uid,draftId:did,version:2,wizardStep:step,input:{...emptyDraft().input,name:'프로젝트',purpose:'<script>원목적</script>',desiredOutcome:'기대 결과',methodologySelection:{kind:'CONFIRMED_REFERENCE',versionRef:{id:did,version:2,contentHash:'a'.repeat(64)}}}};}
function render(buffer:any){let calls=0;const client=new ApiClient(async()=>{calls++;throw Error('NO_REQUEST_ALLOWED');});const html=renderToStaticMarkup(createElement(m.ProjectCreatePage,{client,session:{user:{id:uid},clientId:did,csrfToken:'C'.repeat(43)},buffer,onChange:()=>{throw Error('NO_MUTATION_DURING_RENDER');},onAuthenticationLost:()=>{}}));assert.equal(calls,0);return html;}
const createButton=(html:string)=>{const button=html.match(/<button([^>]*)>저장 초안으로 프로젝트 생성<\/button>/);assert.ok(button);return button[1]!;};
test('3단계는 실제 환경·총괄을 만들지 않고 준비 필요·선택 미구현을 표시한다',()=>{
 const html=render(fixture(3));assert.match(html,/<li aria-current="step">총괄·환경/);assert.match(html,/총괄·환경 준비 상태/);assert.match(html,/선택 미구현/);assert.match(html,/준비 필요 상태로 저장/);assert.match(html,/disabled/);assert.ok(createButton(html).includes('disabled'));assert.match(html,/생성 전 확인으로 다음/);
});
test('4단계는 원입력·선택 참조·저장 상태를 검토하고 생성≠실행을 표시한다',()=>{
 const html=render(fixture(4));assert.match(html,/<li aria-current="step">생성 전 확인/);assert.match(html,/생성 전 입력 확인/);assert.match(html,/&lt;script&gt;원목적&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/기대 결과/);assert.match(html,/확정 참조 선택/);assert.match(html,/생성은 Agent 실행이 아닙니다/);assert.equal(createButton(html).includes('disabled'),false);assert.match(html,/총괄·환경으로 이전/);
});
test('기존1/2단계에서 신규 생성은 잠그고 dirty/pending/미선택은 최종단계에서도 보존한다',()=>{
 for(const step of [1,2,3])assert.ok(createButton(render(fixture(step))).includes('disabled'));
 for(const patch of [{dirty:true},{pendingCommand:{draftId:did,fingerprint:'고정',body:{step:4,commandId:did}}},{input:{...fixture(4).input,methodologySelection:null}}]){const f={...fixture(4),...patch},before=structuredClone(f);assert.ok(createButton(render(f)).includes('disabled'));assert.deepEqual(f,before);}
});

test('기존2단계에서 남은 동일 생성 명령은 새 생성과 구분해 결과 재확인을 제공한다',()=>{
 const f=fixture(2);f.pendingAction={kind:'create',draftId:did,body:{schemaVersion:1,commandId:did,clientId:did,draftId:did,draftVersion:2}};const before=structuredClone(f),html=render(f);assert.match(html,/>같은 생성 명령 결과 확인<\/button>/);assert.ok(createButton(html).includes('disabled'));assert.deepEqual(f,before);
});

test('각 단계의 편집 영역은 해당 단계에만 나타나고 다른 단계의 필드는 숨긴다',()=>{
 for(const step of [1,2,3,4]){const html=render(fixture(step)),purpose=/<label[^>]*>프로젝트 이름<\/label>/.test(html),method=html.includes('aria-label="프로젝트 방법론 선택"');assert.equal(purpose,step===1,`목적 편집 ${step}`);assert.equal(method,step===2,`방법론 편집 ${step}`);if(step!==3)assert.doesNotMatch(html,/aria-label="총괄·환경 준비 상태"/);if(step!==4)assert.doesNotMatch(html,/aria-label="생성 전 입력 확인"/);}
});
