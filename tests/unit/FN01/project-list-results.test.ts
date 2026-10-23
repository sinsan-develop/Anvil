import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});after(async()=>{await compiler.close();});
const m=await compiler.ssrLoadModule('/src/features/projects/ProjectsPage.tsx');
const id=(n:number)=>`96000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at='2026-10-24T04:00:00.000Z',later='2026-10-24T04:05:00.000Z',client=new ApiClient(async()=>{throw Error('NO_REQUEST_ALLOWED');});
function fixture():any{return {client,query:'',archived:false,refresh:0,cursor:'next1',current:true,page:{items:[1,2].map(n=>({id:id(n),name:'비공개프로젝트'+n,purpose:'목적',version:1,updatedAt:at})),hasMore:false,nextCursor:null,observedAt:later,baselineVersion:null},itemObservedAt:{[id(1)]:at,[id(2)]:later}};}
function render(snapshot:any=fixture(),patch:any={}){assert.equal(typeof m.ProjectListResults,'function','목록 관측/오류 읽기 표시 미구현');return renderToStaticMarkup(createElement(m.ProjectListResults,{client,snapshot,pending:false,error:null,onAuthenticationLost:()=>{},...patch}));}
test('항목별 원관측·정의 변경시각과 마지막 페이지 관측을 구분하고 단계/최근작업을 합성하지 않는다',()=>{
 const html=render();assert.ok(html.includes(`dateTime="${at}"`)||html.includes(`datetime="${at}"`));assert.ok(html.includes(`dateTime="${later}"`)||html.includes(`datetime="${later}"`));assert.match(html,/마지막 수신 페이지 관측/);assert.match(html,/목록 항목 관측/);assert.match(html,/현재 실행 단계·다음 행동: 미확인/);assert.doesNotMatch(html,/개발 중|개발 완료|최근 실행 완료|완료율/);assert.ok(html.includes(`href="#/projects/${id(1)}/workspace"`));
});
test('같은 목록의 과거 결과는 오래된 자료로 표시하고 행 열기·부속조회는 잠근다',()=>{
 for(const patch of [{snapshot:{...fixture(),current:false}},{pending:true},{error:new ApiError('CONNECTION_LOST')}]){const f=fixture(),html=render(patch.snapshot??f,patch);assert.match(html,/오래된 자료/);assert.doesNotMatch(html,/href="#\/projects\//);assert.match(html,/disabled/);assert.match(html,/현재 상태 미확인/);}
});
test('숨긴 문맥/접근거절에는 이름·건수를 출력하지 않으며 empty/실패/조회대기를 구분한다',()=>{
 const denied=render(null,{error:new ApiError('NOT_AUTHORIZED',403)});assert.match(denied,/role="alert"/);assert.doesNotMatch(denied,/비공개프로젝트|프로젝트가 없습니다/);
 const f=fixture();f.page.items=[];const empty=render(f);assert.match(empty,/프로젝트가 없습니다/);for(const p of [{pending:true},{error:new ApiError('CONNECTION_LOST')},{snapshot:{...f,current:false}}])assert.doesNotMatch(render(p.snapshot??f,p),/프로젝트가 없습니다/);
});

test('표시 소비자도 다른 client의 snapshot을 그대로 받으면 이름·행을 숨긴다',()=>{
 const html=render(fixture(),{client:new ApiClient(async()=>{throw Error('NO_REQUEST_ALLOWED');})});assert.doesNotMatch(html,/비공개프로젝트|href="#\/projects\//);assert.match(html,/프로젝트를 조회하고 있습니다/);
});

test('항목이 남아 있는 snapshot도 401·403·404 거절 시 이름·링크·부속조회가 사라진다',()=>{
 for(const status of [401,403,404]){const html=render(fixture(),{error:new ApiError('NOT_AUTHORIZED',status)});assert.match(html,/role="alert"/);assert.doesNotMatch(html,/비공개프로젝트|href="#\/projects\/|제어·준비 상태|대기 승인 조회|저장 임무 초안|프로젝트가 없습니다/);}
});
