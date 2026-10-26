import {test,expect,type Page} from '@playwright/test';
import {build,transformWithOxc} from 'vite';
import {emptyDraft,type DraftInput,type DraftEditorState} from '../../../apps/web/src/features/project-create/api.ts';

const user='a9100000-0000-4000-8000-000000000001',clientId='a9100000-0000-4000-8000-000000000002';
const draftId='a9100000-0000-4000-8000-000000000003',projectId='a9100000-0000-4000-8000-000000000004';
const otherDraft='a9100000-0000-4000-8000-000000000005',otherProject='a9100000-0000-4000-8000-000000000006';
const otherUser='a9100000-0000-4000-8000-000000000007',otherClient='a9100000-0000-4000-8000-000000000008';
const input:DraftInput={...emptyDraft().input,name:'저장 조회 이름',purpose:'저장 조회 목적',desiredOutcome:'저장 조회 결과',methodologySelection:{kind:'NEW_PROJECT_DRAFT',name:'저장 조회 방법론',purpose:'저장 절차 목적',graph:{nodes:[],edges:[],entryNodeId:'',terminalNodeIds:[]},sourceRefs:[],reviewRefs:[]}};
const value=(patch:Record<string,unknown>={})=>({draftId,version:2,step:4,input,editable:false,consumedProjectId:null,...patch});
type Plan={status?:number;body?:unknown;delay?:boolean};
type ReadCall={path:string;method:string;object:number;settled:boolean;jsonStarted:boolean};
type QA={calls:ReadCall[];posts:number;buffer:DraftEditorState;authLost:number;render:number;beforeEffectLinks:string[];enqueue:(plan:Plan)=>void;release:(index:number)=>void;set:(kind:string,side:string)=>void;reset:(buffer?:DraftEditorState)=>void};
declare global {interface Window {__readonlyQA:QA}}

// 실제 Page·ApiClient를 사용하는 전용 React 번들이다. 서비스·DB·외부 통신은 시작하지 않는다.
// 단일 파일 소유 범위에서 메모리 entry만 만들며 공용 helper와 기존 dist는 변경하지 않는다.
const harness=`
import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '/apps/web/src/api/client.ts';
import {ProjectCreatePage} from '/apps/web/src/features/project-create/ProjectCreatePage.tsx';
import {emptyDraft,type DraftEditorState} from '/apps/web/src/features/project-create/api.ts';
type Plan={status?:number;body?:unknown;delay?:boolean};
type Call={path:string;method:string;object:number;settled:boolean;jsonStarted:boolean};
type QA={calls:Call[];posts:number;buffer:DraftEditorState;authLost:number;render:number;beforeEffectLinks:string[];enqueue:(v:Plan)=>void;release:(i:number)=>void;set:(k:string,s:string)=>void;reset:(b?:DraftEditorState)=>void};
declare global {interface Window{__readonlyQA:QA}}
const ids=${JSON.stringify({user,clientId,draftId,projectId,otherDraft,otherProject,otherUser,otherClient})},stored=${JSON.stringify(input)};
const plans:Plan[]=[],releases=new Map<number,()=>void>();
const initial=()=>({...emptyDraft(),ownerUserId:ids.user});
const qa:QA=window.__readonlyQA={calls:[],posts:0,buffer:initial(),authLost:0,render:0,beforeEffectLinks:[],enqueue:p=>plans.push(p),release:i=>releases.get(i)?.(),set:()=>{},reset:()=>{}};
function Harness(){
 const [buffer,setBuffer]=useState<DraftEditorState>(initial),[who,setWho]=useState(ids.user),[device,setDevice]=useState(ids.clientId),[object,setObject]=useState(0),[shown,setShown]=useState(true);
 qa.buffer=buffer;qa.render++;
 const client=useMemo(()=>new ApiClient(async(path,init)=>{
  const method=init?.method??'GET',call:Call={path:String(path),method,object,settled:false,jsonStarted:false},index=qa.calls.length;qa.calls.push(call);
  if(method!=='GET'){qa.posts++;throw Error('UNEXPECTED_WRITE');}
  if(!String(path).startsWith('/api/v1/project-drafts/')){call.settled=true;return Response.json({items:[],nextCursor:null});}
  const plan=plans.shift()??{},target=String(path).split('/').at(-1),body=plan.body??{draftId:target,version:2,step:4,input:stored,editable:false,consumedProjectId:null};
  const response=Response.json(plan.status?{code:'PERMISSION_DENIED'}:body,{status:plan.status??200}),json=response.json.bind(response);
  response.json=async()=>{call.jsonStarted=true;if(plan.delay)await new Promise<void>(resolve=>releases.set(index,resolve));try{return await json();}finally{call.settled=true;}};
  return response;
 }),[object]);
 const snapshot=()=>{qa.beforeEffectLinks=Array.from(document.querySelectorAll('a')).map(a=>a.getAttribute('href')??'').filter(h=>h.includes('/workspace')||h.includes('/documents'));};
 qa.set=(kind,side)=>{
  flushSync(()=>{if(kind==='user')setWho(side==='B'?ids.otherUser:ids.user);if(kind==='clientId')setDevice(side==='B'?ids.otherClient:ids.clientId);if(kind==='client')setObject(v=>v+1);if(kind==='draft')setBuffer(previous=>({...previous,draftId:side==='B'?ids.otherDraft:ids.draftId}));if(kind==='hide')setShown(side!=='B');if(kind==='input')setBuffer(p=>({...p,input:{...p.input,name:'별도 입력'}}));if(kind==='dirty')setBuffer(p=>({...p,dirty:true}));if(kind==='version')setBuffer(p=>({...p,version:p.version+1}));if(kind==='step')setBuffer(p=>({...p,wizardStep:1}));});snapshot();
 };
 qa.reset=(next)=>{plans.length=0;flushSync(()=>setShown(false));history.replaceState(null,'','/?draftId='+ids.draftId+'#/projects/new');flushSync(()=>{setBuffer(next??initial());setWho(ids.user);setDevice(ids.clientId);setObject(v=>v+1);setShown(true);});};
 return shown?<ProjectCreatePage client={client} session={{user:{id:who},clientId:device,csrfToken:'C'.repeat(43)}} buffer={buffer} onChange={setBuffer} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
`;
let bundled:Promise<string>|undefined;
function bundle(){
 return bundled??= (async()=>{
  const result=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[{name:'ui02-readonly-entry',resolveId:id=>id==='virtual:ui02-readonly'?'\0ui02-readonly':null,load:async id=>id==='\0ui02-readonly'?(await transformWithOxc(harness,'ui02-readonly-harness.tsx',{jsx:{runtime:'automatic'}})).code:null}],build:{write:false,minify:false,sourcemap:false,rolldownOptions:{input:'virtual:ui02-readonly'},lib:{entry:'virtual:ui02-readonly',name:'AnvilReadonlyDraftQA',formats:['iife']}}});
  const outputs=Array.isArray(result)?result:[result];expect(outputs).toHaveLength(1);
  const output=outputs[0];if(!output||!('output'in output))throw Error('SINGLE_BUNDLE_REQUIRED');
  expect(output.output).toHaveLength(1);const chunk=output.output[0];if(!chunk||chunk.type!=='chunk')throw Error('SINGLE_CHUNK_REQUIRED');return chunk.code;
 })();
}
async function mount(page:Page){
 const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin==='https://localhost:3830'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});requests.push(route.request().url());return route.abort();});
 await page.goto(`https://localhost:3830/?draftId=${draftId}#/projects/new`);
 await page.addScriptTag({content:await bundle()});
 await page.waitForFunction(()=>window.__readonlyQA?.calls[0]?.settled);
 return{errors,requests};
}
async function enqueue(page:Page,plan:Plan){await page.evaluate(p=>window.__readonlyQA.enqueue(p),plan);}
async function settled(page:Page){await expect.poll(()=>page.evaluate(()=>window.__readonlyQA.calls.every(c=>c.settled))).toBe(true);}
async function reset(page:Page,buffer?:DraftEditorState){await page.evaluate(b=>window.__readonlyQA.reset(b),buffer);await settled(page);}
const viewer=(page:Page)=>page.getByRole('region',{name:'저장 초안 내용 조회',exact:true});
const next=(page:Page)=>page.getByRole('button',{name:/다음/});
const previous=(page:Page)=>page.getByRole('button',{name:/이전/});
async function currentStep(page:Page,step:number){await expect(page.locator('.wizard-steps [aria-current="step"]')).toHaveText(['목적·소스','방법론·자료','총괄·환경 — 준비 필요','생성 전 확인'][step-1]!);}
async function noWrites(page:Page){expect(await page.evaluate(()=>window.__readonlyQA.posts)).toBe(0);}

// 기존 코드는 readonly 이전에 상위 wizardStep을 바꾸고, 1단계의 다음은 잠긴다.
// 첫 RED는 준비·문구가 아니라 해당 다음 버튼의 활성 여부에서 발생해야 한다.
test('UI02_READONLY_ROUNDTRIP 저장4단계 조회는 4→1→4 내용만 왕복하고 편집 버퍼를 바꾸지 않는다',async({page})=>{
 const f=await mount(page);await currentStep(page,4);
 const baseline=await page.evaluate(()=>window.__readonlyQA.buffer);
 for(const step of [3,2,1]){await previous(page).click();await currentStep(page,step);}
 await expect(next(page)).toBeEnabled();
 await expect(viewer(page)).toBeVisible();await expect(viewer(page)).toContainText('조회 전용');
 expect(await page.evaluate(()=>window.__readonlyQA.buffer)).toEqual(baseline);
 await expect(page.getByLabel('프로젝트 이름',{exact:true})).toHaveValue(input.name);await expect(page.getByLabel('프로젝트 이름',{exact:true})).toBeDisabled();
 await expect(page.getByLabel('왜 만드는가',{exact:true})).toHaveValue(input.purpose);await expect(page.getByLabel('기대 결과',{exact:true})).toHaveValue(input.desiredOutcome);
 await next(page).click();await currentStep(page,2);
 await expect(page.getByLabel('전용 방법론 이름',{exact:true})).toHaveValue('저장 조회 방법론');await expect(page.getByLabel('전용 방법론 이름',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'이 프로젝트 방법론 직접 작성',exact:true})).toBeDisabled();
 await next(page).click();await currentStep(page,3);await expect(page.getByRole('region',{name:'총괄·환경 준비 상태',exact:true})).toContainText('실제 연결 미확인');
 await next(page).click();await currentStep(page,4);await expect(page.getByRole('region',{name:'생성 전 입력 확인',exact:true})).toContainText(input.name);await expect(page.getByRole('region',{name:'생성 전 입력 확인',exact:true})).toContainText('저장 조회 방법론');
 await expect(page.getByRole('button',{name:'중간 저장',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'저장 초안으로 프로젝트 생성',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.__readonlyQA.buffer)).toEqual(baseline);await noWrites(page);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});

test('UI02_READONLY_REFRESH 실패 GET은 조회 권한을 없애고 editable 응답은 기존 저장 단계로 복귀한다',async({page})=>{
 const f=await mount(page);await expect(viewer(page)).toBeVisible();await previous(page).click();await currentStep(page,3);
 for(const status of [403,404]){await enqueue(page,{status});await page.getByRole('button',{name:'저장본 다시 조회',exact:true}).click();await settled(page);await expect(viewer(page)).toHaveCount(0);}
 await enqueue(page,{body:value({editable:true,step:2})});await page.getByRole('button',{name:'저장본 다시 조회',exact:true}).click();await settled(page);
 await expect(viewer(page)).toHaveCount(0);await currentStep(page,2);await expect(next(page)).toBeEnabled();
 await page.getByLabel('전용 방법론 이름',{exact:true}).fill('편집 입력');await expect(next(page)).toBeDisabled();
 expect(await page.evaluate(()=>window.__readonlyQA.buffer.dirty)).toBe(true);expect(await page.evaluate(()=>window.__readonlyQA.buffer.input.methodologySelection?.kind==='NEW_PROJECT_DRAFT'?window.__readonlyQA.buffer.input.methodologySelection.name:null)).toBe('편집 입력');
 await noWrites(page);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});

test('UI02_READONLY_BUFFER 변경된 입력·버전·단계·dirty와 미확인 원명령에는 조회 snapshot을 재사용하지 않는다',async({page})=>{
 const f=await mount(page);
 for(const kind of ['input','version','step','dirty']){await reset(page);await expect(viewer(page)).toBeVisible();await page.evaluate(k=>window.__readonlyQA.set(k,'B'),kind);await expect(viewer(page)).toHaveCount(0);}
 for(const kind of ['dirty','save','create']){
  const original:DraftEditorState={...emptyDraft(),ownerUserId:user,draftId,version:9,wizardStep:2,input:{...input,name:'유지할 원입력'},dirty:kind==='dirty'};
  if(kind==='save')original.pendingCommand={draftId,fingerprint:'기존 저장 지문',body:{commandId:projectId,clientId,expectedVersion:9,step:2,input:original.input}};
  if(kind==='create')original.pendingAction={kind:'create',draftId,body:{schemaVersion:1,commandId:projectId,clientId,draftId,draftVersion:9}};
  await reset(page,original);await expect(viewer(page)).toHaveCount(0);expect(await page.evaluate(()=>window.__readonlyQA.buffer)).toEqual(original);await expect(next(page)).toBeDisabled();
 }
 await noWrites(page);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});

test('UI02_READONLY_CONTEXT 주체·기기·client객체·다른 초안 ABA와 늦은401은 조회 snapshot을 복원하지 않는다',async({page})=>{
 const f=await mount(page);
 for(const kind of ['user','clientId','client','draft']){
  await reset(page);await expect(viewer(page)).toBeVisible();
  await enqueue(page,{status:401,delay:true});await page.getByRole('button',{name:'저장본 다시 조회',exact:true}).click();
  const index=await page.evaluate(()=>window.__readonlyQA.calls.length-1);await page.waitForFunction(i=>window.__readonlyQA.calls[i]?.jsonStarted,index);await expect(viewer(page)).toHaveCount(0);
  await enqueue(page,{status:403});await page.evaluate(k=>window.__readonlyQA.set(k,'B'),kind);await expect(viewer(page)).toHaveCount(0);
  await enqueue(page,{status:404});await page.evaluate(k=>window.__readonlyQA.set(k,'A'),kind);await expect(viewer(page)).toHaveCount(0);
  await page.evaluate(i=>window.__readonlyQA.release(i),index);await settled(page);await expect(viewer(page)).toHaveCount(0);
  expect(await page.evaluate(()=>window.__readonlyQA.authLost)).toBe(0);
 }
 await noWrites(page);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});

test('UI02_READONLY_CONSUMED 소비된 저장4단계도 내용을 왕복 조회하고 프로젝트 링크·편집 버퍼를 보존한다',async({page})=>{
 const f=await mount(page);
 await enqueue(page,{body:value({consumedProjectId:projectId})});await page.getByRole('button',{name:'저장본 다시 조회',exact:true}).click();await settled(page);await currentStep(page,4);
 // 기존 회귀는 성공한 소비 GET 이후 이전 버튼을 잠근다. 새 문구 검사보다 먼저 확인한다.
 await expect(previous(page)).toBeEnabled();
 const baseline=await page.evaluate(()=>window.__readonlyQA.buffer);
 const projectLinks=page.locator('a[href$="/workspace"],a[href$="/documents"]');
 const expected=[`#/projects/${projectId}/documents`,`#/projects/${projectId}/workspace`];
 let current=4;
 for(const step of [3,2,1,2,3,4]){
  await (step<current?previous(page):next(page)).click();current=step;
  await currentStep(page,step);await expect(viewer(page)).toContainText('조회 전용');
  expect(await projectLinks.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')).sort())).toEqual(expected);
  expect(await page.evaluate(()=>window.__readonlyQA.buffer)).toEqual(baseline);
 }
 await expect(page.getByRole('region',{name:'생성 전 입력 확인',exact:true})).toContainText(input.name);
 await expect(page.getByRole('button',{name:'중간 저장',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'저장 초안으로 프로젝트 생성',exact:true})).toBeDisabled();
 await noWrites(page);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});
