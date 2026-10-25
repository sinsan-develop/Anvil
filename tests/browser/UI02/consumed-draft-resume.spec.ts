import {test,expect,type Page} from '@playwright/test';
import {build,transformWithOxc} from 'vite';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {emptyDraft,readProjectDraft,writeProjectDraft,type DraftEditorState} from '../../../apps/web/src/features/project-create/api.ts';

const user='a9000000-0000-4000-8000-000000000001',clientId='a9000000-0000-4000-8000-000000000002';
const draftId='a9000000-0000-4000-8000-000000000003',projectId='a9000000-0000-4000-8000-000000000004';
const otherDraft='a9000000-0000-4000-8000-000000000005',otherProject='a9000000-0000-4000-8000-000000000006';
const otherUser='a9000000-0000-4000-8000-000000000007',otherClient='a9000000-0000-4000-8000-000000000008';
const input={...emptyDraft().input,name:'저장한 초안',purpose:'원본 보존',desiredOutcome:'다시 이어가기'};
const value=(patch:Record<string,unknown>={})=>({draftId,version:2,step:1,input,editable:false,consumedProjectId:projectId,...patch});

test('UI02_CONSUMED_GET_CONTRACT 소비 UUID/null·미제공을 구분하고 모순·위조를 거절한다',async()=>{
 for(const extra of [{editable:false,consumedProjectId:projectId},{editable:true,consumedProjectId:null},{editable:false,consumedProjectId:null},{editable:true}]){
  const response={draftId,version:2,step:1,input,...extra},calls:string[]=[];
  const client=new ApiClient(async(path,init)=>{calls.push(`${init?.method} ${String(path)}`);return Response.json(response);});
  const result=await readProjectDraft(client,draftId);
  expect(result).toEqual(response);expect(Object.hasOwn(result,'consumedProjectId')).toBe(Object.hasOwn(extra,'consumedProjectId'));
  expect(calls).toEqual([`GET /api/v1/project-drafts/${draftId}`]);
 }
 for(const bad of [value({consumedProjectId:'javascript:alert(1)'}),value({consumedProjectId:[]}),value({consumedProjectId:1}),value({consumedProjectId:{id:projectId}}),value({editable:true}),value({editable:'false'}),value({draftId:otherDraft})]){
  const client=new ApiClient(async()=>Response.json(bad));
  await expect(readProjectDraft(client,draftId)).rejects.toMatchObject({code:'RESPONSE_INVALID'});
 }
});

test('UI02_CONSUMED_WRITE_COMPAT POST/PATCH 응답에 소비 조회 필드를 필수화하지 않는다',async()=>{
 const response={draftId,version:2,step:1,input},calls:string[]=[];
 const client=new ApiClient(async(path,init)=>{calls.push(`${init?.method} ${String(path)}`);return Response.json(response);});
 expect(await writeProjectDraft(client,null,{},'C'.repeat(43))).toEqual(response);
 expect(await writeProjectDraft(client,draftId,{},'C'.repeat(43))).toEqual(response);
 expect(calls).toEqual(['POST /api/v1/project-drafts',`PATCH /api/v1/project-drafts/${draftId}`]);
});

type Plan={status?:number;body?:unknown;delay?:boolean};
type ReadCall={path:string;method:string;object:number;settled:boolean;jsonStarted:boolean};
type QA={calls:ReadCall[];posts:number;buffer:DraftEditorState;authLost:number;render:number;beforeEffectLinks:string[];enqueue:(plan:Plan)=>void;release:(index:number)=>void;set:(kind:string,side:string)=>void;reset:(buffer?:DraftEditorState)=>void};
declare global {interface Window {__consumedQA:QA}}

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
declare global {interface Window{__consumedQA:QA}}
const ids=${JSON.stringify({user,clientId,draftId,projectId,otherDraft,otherProject,otherUser,otherClient})},stored=${JSON.stringify(input)};
const plans:Plan[]=[],releases=new Map<number,()=>void>();
const initial=()=>({...emptyDraft(),ownerUserId:ids.user});
const qa:QA=window.__consumedQA={calls:[],posts:0,buffer:initial(),authLost:0,render:0,beforeEffectLinks:[],enqueue:p=>plans.push(p),release:i=>releases.get(i)?.(),set:()=>{},reset:()=>{}};
function Harness(){
 const [buffer,setBuffer]=useState<DraftEditorState>(initial),[who,setWho]=useState(ids.user),[device,setDevice]=useState(ids.clientId),[object,setObject]=useState(0),[shown,setShown]=useState(true);
 qa.buffer=buffer;qa.render++;
 const client=useMemo(()=>new ApiClient(async(path,init)=>{
  const method=init?.method??'GET',call:Call={path:String(path),method,object,settled:false,jsonStarted:false},index=qa.calls.length;qa.calls.push(call);
  if(method!=='GET'){qa.posts++;throw Error('UNEXPECTED_WRITE');}
  const plan=plans.shift()??{},target=String(path).split('/').at(-1),body=plan.body??{draftId:target,version:2,step:1,input:stored,editable:false,consumedProjectId:target===ids.otherDraft?ids.otherProject:ids.projectId};
  const response=Response.json(plan.status?{code:'PERMISSION_DENIED'}:body,{status:plan.status??200}),json=response.json.bind(response);
  response.json=async()=>{call.jsonStarted=true;if(plan.delay)await new Promise<void>(resolve=>releases.set(index,resolve));try{return await json();}finally{call.settled=true;}};
  return response;
 }),[object]);
 const snapshot=()=>{qa.beforeEffectLinks=Array.from(document.querySelectorAll('a')).map(a=>a.getAttribute('href')??'').filter(h=>h.includes('/workspace')||h.includes('/documents'));};
 qa.set=(kind,side)=>{
  flushSync(()=>{if(kind==='user')setWho(side==='B'?ids.otherUser:ids.user);if(kind==='clientId')setDevice(side==='B'?ids.otherClient:ids.clientId);if(kind==='client')setObject(v=>v+1);if(kind==='draft')setBuffer(previous=>({...previous,draftId:side==='B'?ids.otherDraft:ids.draftId}));if(kind==='hide')setShown(side!=='B');});snapshot();
 };
 qa.reset=(next)=>{plans.length=0;flushSync(()=>setShown(false));history.replaceState(null,'','/?draftId='+ids.draftId+'#/projects/new');flushSync(()=>{setBuffer(next??initial());setWho(ids.user);setDevice(ids.clientId);setObject(v=>v+1);setShown(true);});};
 return shown?<ProjectCreatePage client={client} session={{user:{id:who},clientId:device,csrfToken:'C'.repeat(43)}} buffer={buffer} onChange={setBuffer} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
`;
let bundled:Promise<string>|undefined;
function bundle(){
 return bundled??= (async()=>{
  const result=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[{name:'ui02-consumed-entry',resolveId:id=>id==='virtual:ui02-consumed'?'\0ui02-consumed':null,load:async id=>id==='\0ui02-consumed'?(await transformWithOxc(harness,'ui02-consumed-harness.tsx',{jsx:{runtime:'automatic'}})).code:null}],build:{write:false,minify:false,sourcemap:false,rolldownOptions:{input:'virtual:ui02-consumed'},lib:{entry:'virtual:ui02-consumed',name:'AnvilConsumedDraftQA',formats:['iife']}}});
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
 await page.waitForFunction(()=>window.__consumedQA?.calls[0]?.settled);
 return{errors,requests};
}
const links=(page:Page)=>page.locator('a[href$="/workspace"],a[href$="/documents"]');
async function enqueue(page:Page,plan:Plan){await page.evaluate(p=>window.__consumedQA.enqueue(p),plan);}
async function settled(page:Page){await expect.poll(()=>page.evaluate(()=>window.__consumedQA.calls.every(c=>c.settled))).toBe(true);}
async function exactLinks(page:Page,pid=projectId){await expect(links(page)).toHaveCount(2);expect((await links(page).evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')))).sort()).toEqual([`#/projects/${pid}/documents`,`#/projects/${pid}/workspace`]);}
async function reset(page:Page,buffer?:DraftEditorState){await page.evaluate(b=>window.__consumedQA.reset(b),buffer);await settled(page);}

test('UI02_CONSUMED_DOM_RESUME 소비 GET 재진입은 정확 프로젝트 두 링크만 제공하고 재생성하지 않는다',async({page})=>{
 const f=await mount(page);await exactLinks(page);
 expect(await page.evaluate(()=>window.__consumedQA.posts)).toBe(0);
 expect(await page.evaluate(()=>window.__consumedQA.buffer.createdProject)).toBeUndefined();
 await expect(page).toHaveURL(new RegExp(`draftId=${draftId}#/projects/new$`));
 expect(await links(page).evaluateAll(nodes=>nodes.some(n=>n.getAttribute('href')?.includes('a9000000-0000-4000-8000-000000000003')))).toBe(false);
 expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});

test('UI02_CONSUMED_DOM_INVALID 미소비·미제공·위조·거절에는 과거 소비 링크가 없다',async({page})=>{
 const f=await mount(page);await exactLinks(page);
 for(const plan of [{body:value({editable:true,consumedProjectId:null})},{body:{draftId,version:2,step:1,input,editable:true}},{body:value({consumedProjectId:'not-a-project'})},{body:value({editable:true})},{status:403},{status:404}]){
  await enqueue(page,plan);await page.getByRole('button',{name:'저장본 다시 조회',exact:true}).click();await settled(page);await expect(links(page)).toHaveCount(0);
 }
 expect(await page.evaluate(()=>window.__consumedQA.posts)).toBe(0);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});

test('UI02_CONSUMED_DOM_CONTEXT 주체·기기·client객체·다른 초안과 ABA의 늦은 응답은 링크를 복원하지 않는다',async({page})=>{
 const f=await mount(page);
 for(const kind of ['user','clientId','client','draft']){
  await reset(page);await exactLinks(page);
  await enqueue(page,{delay:true});await page.evaluate(k=>window.__consumedQA.set(k,'B'),kind);
  await expect(links(page)).toHaveCount(0);expect(await page.evaluate(()=>window.__consumedQA.beforeEffectLinks)).toEqual([]);
  // 사용자 교체는 owner guard로 GET을 보내지 않는다. 다른 문맥의 새 GET은 지연 뒤에만 반환한다.
  if(kind!=='user'){const current=await page.evaluate(()=>window.__consumedQA.calls.length-1);await page.waitForFunction(i=>window.__consumedQA.calls[i]?.jsonStarted,current);await page.evaluate(i=>window.__consumedQA.release(i),current);await settled(page);}
  await reset(page);await exactLinks(page);
  await enqueue(page,{delay:true});await page.getByRole('button',{name:'저장본 다시 조회',exact:true}).click();
  const index=await page.evaluate(()=>window.__consumedQA.calls.length-1);await page.waitForFunction(i=>window.__consumedQA.calls[i]?.jsonStarted,index);
  await enqueue(page,{status:403});await page.evaluate(k=>window.__consumedQA.set(k,'B'),kind);await expect(links(page)).toHaveCount(0);
  expect(await page.evaluate(()=>window.__consumedQA.beforeEffectLinks)).toEqual([]);
  await enqueue(page,{status:404});await page.evaluate(k=>window.__consumedQA.set(k,'A'),kind);await expect(links(page)).toHaveCount(0);
  await page.evaluate(i=>window.__consumedQA.release(i),index);await settled(page);await expect(links(page)).toHaveCount(0);
 }
 expect(await page.evaluate(()=>window.__consumedQA.posts)).toBe(0);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});

test('UI02_CONSUMED_DOM_DRAFT_SWITCH 다른 초안을 명시 조회하면 그 초안의 프로젝트만 연다',async({page})=>{
 const f=await mount(page);await exactLinks(page);
 await enqueue(page,{status:404});await page.evaluate(()=>window.__consumedQA.set('draft','B'));await settled(page);await expect(links(page)).toHaveCount(0);
 await enqueue(page,{delay:true});await page.getByRole('button',{name:'저장본 다시 조회',exact:true}).click();
 const index=await page.evaluate(()=>window.__consumedQA.calls.length-1);await page.waitForFunction(i=>window.__consumedQA.calls[i]?.jsonStarted,index);await expect(links(page)).toHaveCount(0);
 await page.evaluate(i=>window.__consumedQA.release(i),index);await settled(page);await exactLinks(page,otherProject);
 expect(await page.evaluate(()=>window.__consumedQA.calls.at(-1)?.path)).toBe(`/api/v1/project-drafts/${otherDraft}`);
 expect(await page.evaluate(()=>window.__consumedQA.posts)).toBe(0);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});

test('UI02_CONSUMED_DOM_PRESERVE 소비 조회는 미저장 입력·저장/생성 원명령을 보존한다',async({page})=>{
 const f=await mount(page);
 for(const target of [draftId,otherDraft])for(const kind of ['dirty','save','create']){
  const original:DraftEditorState={...emptyDraft(),ownerUserId:user,draftId:target,version:7,input:{...input,name:'다른 초안의 원입력'},dirty:kind==='dirty'};
  if(kind==='save')original.pendingCommand={draftId:target,fingerprint:'원래 저장 명령',body:{commandId:otherProject,clientId,expectedVersion:7,input:original.input}};
  if(kind==='create')original.pendingAction={kind:'create',draftId:target,body:{schemaVersion:1,commandId:otherProject,clientId,draftId:target,draftVersion:7}};
  await reset(page,original);await settled(page);expect(await page.evaluate(()=>window.__consumedQA.buffer)).toEqual(original);
  expect(await page.evaluate(()=>window.__consumedQA.buffer.createdProject)).toBeUndefined();
  // URL의 초안과 화면 버퍼가 다르면 그 소비 결과를 현재 초안 링크로 제시하지 않는다.
  if(target===otherDraft)await expect(links(page)).toHaveCount(0);else await exactLinks(page);
 }
 expect(await page.evaluate(()=>window.__consumedQA.posts)).toBe(0);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);
});
