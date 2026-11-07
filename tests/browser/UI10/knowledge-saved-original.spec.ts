import {test,expect,type Page} from '@playwright/test';
import {build,transformWithOxc} from 'vite';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {KnowledgeBuffer,KnowledgeView} from '../../../apps/web/src/features/knowledge/api.ts';
import type {DocumentWrite} from '../../../apps/web/src/features/design-trace/editor-api.ts';

const pid='ab100000-0000-4000-8000-000000000001',uid='ab100000-0000-4000-8000-000000000002',device='ab100000-0000-4000-8000-000000000003';
const kid='ab100000-0000-4000-8000-000000000004',aid='ab100000-0000-4000-8000-000000000005',other='ab100000-0000-4000-8000-000000000006',at='2026-10-26T01:00:00Z';
const body='저장한 원문\r\n<script>window.SAVED_ORIGINAL_XSS=1</script>',title='저장한 사실',reason='검색 조건과 별개로 원문 보존';
const entry:KnowledgeView['entry']={kind:'FACT',title,reason,contentRef:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},sourceRefs:[{kind:'ARTIFACT',id:aid,contentHash:contentHash(Buffer.from(body))}],scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]};
const ref={id:kid,version:1,contentHash:contentHash(canonicalJson(entry))};
const stored:KnowledgeView={ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at}]};
const second:KnowledgeView={...stored,ref:{...ref,id:other},entry:{...entry,title:'다른 선택 원문'}};
second.ref.contentHash=contentHash(canonicalJson(second.entry));

type Plan={status?:number;body?:unknown;delay?:boolean};
type Call={path:string;method:string;object:number;settled:boolean;jsonStarted:boolean};
type QA={calls:Call[];writes:DocumentWrite[];unknown:string[];buffer:KnowledgeBuffer|null;authLost:number;enqueue:(p:Plan)=>void;release:(i:number)=>void;set:(kind:string,side:string)=>void;reset:(saved?:boolean)=>void};
declare global {interface Window {__savedKnowledgeQA:QA}}

// 실제 KnowledgePage·ApiClient·저장/읽기 검증을 실행하는 전용 메모리 번들이다.
// 합성 transport만 주입하며 서비스/DB/App 로그인 증거로 사용하지 않는다.
const harness=`
import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '/apps/web/src/api/client.ts';
import {KnowledgePage} from '/apps/web/src/features/knowledge/KnowledgePage.tsx';
import {newKnowledge,type KnowledgeBuffer} from '/apps/web/src/features/knowledge/api.ts';
import type {DocumentWrite} from '/apps/web/src/features/design-trace/editor-api.ts';
type Plan={status?:number;body?:unknown;delay?:boolean};
type Call={path:string;method:string;object:number;settled:boolean;jsonStarted:boolean};
type QA={calls:Call[];writes:DocumentWrite[];unknown:string[];buffer:KnowledgeBuffer|null;authLost:number;enqueue:(p:Plan)=>void;release:(i:number)=>void;set:(k:string,s:string)=>void;reset:(saved?:boolean)=>void};
declare global {interface Window{__savedKnowledgeQA:QA}}
const ids=${JSON.stringify({pid,uid,device,kid,aid,other,at})},stored=${JSON.stringify(stored)},second=${JSON.stringify(second)};
const session={user:{id:ids.uid},clientId:ids.device,csrfToken:'C'.repeat(43)};
const initial=(saved=false):KnowledgeBuffer=>({...newKnowledge(ids.pid,session,1),title:stored.entry.title,body:stored.body,reason:stored.entry.reason,dirty:!saved,resultRef:saved?{...stored.ref}:null});
const plans:Plan[]=[],releases=new Map<number,()=>void>();let pending:KnowledgeBuffer['pending']=null,originalBuffer:KnowledgeBuffer|null=null;
const qa:QA=window.__savedKnowledgeQA={calls:[],writes:[],unknown:[],buffer:initial(),authLost:0,enqueue:p=>plans.push(p),release:i=>releases.get(i)?.(),set:()=>{},reset:()=>{}};
const clients=[0,1].map(object=>new ApiClient(async(path,init)=>{
 const method=init?.method??'GET',url=String(path),call:Call={path:url,method,object,settled:false,jsonStarted:false},index=qa.calls.length;qa.calls.push(call);
 const reply=(value:unknown,status=200,plan?:Plan)=>{const response=Response.json(value,{status}),json=response.json.bind(response);response.json=async()=>{call.jsonStarted=true;if(plan?.delay)await new Promise<void>(resolve=>releases.set(index,resolve));try{return await json();}finally{call.settled=true;}};return response;};
 const receipt=(c:DocumentWrite,data:unknown,targetId:string,version:number|null)=>({operationId:ids.kid,commandId:c.commandId,projectId:ids.pid,status:'APPLIED',targetId,version,data,serverReceivedAt:ids.at});
 if(method==='POST'&&url==='/api/v1/projects/'+ids.pid+'/files'){
  const c=JSON.parse(new Headers(init?.headers).get('x-anvil-command')??'null') as DocumentWrite;qa.writes.push(c);
  return reply(receipt(c,{status:'ARTIFACT_READY',artifactRef:{artifactId:ids.aid,...c.payload}},ids.aid,null),201);
 }
 if(method==='POST'&&url==='/api/v1/projects/'+ids.pid+'/commands'){
  const c=JSON.parse(String(init?.body)) as DocumentWrite;qa.writes.push(c);
  return reply(receipt(c,{status:'PROPOSED',entry:c.payload.entry,ref:stored.ref},ids.kid,1));
 }
 if(method==='GET'&&url==='/api/v1/projects/'+ids.pid)return reply({id:ids.pid,participation:'OWNER',controlState:{actorId:ids.uid,clientId:ids.device,generation:1,status:'HELD'}});
 if(method==='GET'&&/^\\/api\\/v1\\/projects\\/[^/]+\\/conversations\\?/.test(url))return reply({items:[],hasMore:false,nextCursor:null,observedAt:ids.at});
 if(method==='GET'&&/^\\/api\\/v1\\/projects\\/[^/]+\\/knowledge\\?/.test(url)){
  const query=new URL(url,'https://anvil.invalid').searchParams,items=query.get('query')==='다른 선택'?[{versionRef:second.ref,title:second.entry.title,kind:second.entry.kind,sourceRefs:second.entry.sourceRefs,reasonSnippet:second.entry.reason,state:'PROPOSED'}]:[];
  return reply({items,hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:ids.at});
 }
 if(method==='GET'&&url==='/api/v1/projects/'+ids.pid+'/knowledge/'+ids.kid+'/versions/1'){
  const plan=plans.shift()??{};return reply(plan.status?{code:'SAVED_READ_DENIED'}:plan.body??stored,plan.status??200,plan);
 }
 if(method==='GET'&&url==='/api/v1/projects/'+ids.pid+'/knowledge/'+ids.other+'/versions/1')return reply(second);
 qa.unknown.push(method+' '+url);return reply({code:'UNEXPECTED_QA_API'},503);
}));
function Harness(){
 const [buffer,setBuffer]=useState<KnowledgeBuffer|null>(initial),[user,setUser]=useState(ids.uid),[device,setDevice]=useState(ids.device),[project,setProject]=useState(ids.pid),[object,setObject]=useState(0),[shown,setShown]=useState(true),[,render]=useState(0);
 qa.buffer=buffer;
 const currentSession=useMemo(()=>({user:{id:user},clientId:device,csrfToken:'C'.repeat(43)}),[user,device]);
 qa.set=(kind,side)=>{flushSync(()=>{
  if(kind==='user')setUser(side==='B'?ids.other:ids.uid);
  if(kind==='device')setDevice(side==='B'?ids.other:ids.device);
  if(kind==='client')setObject(side==='B'?1:0);
  if(kind==='project')setProject(side==='B'?ids.other:ids.pid);
  if(kind==='hide')setShown(side!=='B');
  if(kind==='buffer'){if(side==='B'){originalBuffer=buffer;setBuffer({...initial(true)});}else setBuffer(originalBuffer);}
  if(kind==='ref')setBuffer(b=>b?{...b,resultRef:side==='B'?{...second.ref}:{...stored.ref}}:b);
  if(kind==='mutateRef'&&buffer?.resultRef){buffer.resultRef.contentHash=side==='B'?'f'.repeat(64):stored.ref.contentHash;render(n=>n+1);}
  if(kind==='pending')setBuffer(b=>b?{...b,pending:side==='B'?pending:null}:b);
  if(kind==='uncertain')setBuffer(b=>b?{...b,uncertain:side==='B'}:b);
  if(kind==='owner')setBuffer(b=>b?{...b,ownerUserId:side==='B'?ids.other:ids.uid}:b);
 });};
 qa.reset=(saved=false)=>{plans.length=0;flushSync(()=>setShown(false));flushSync(()=>{setBuffer(initial(saved));setUser(ids.uid);setDevice(ids.device);setProject(ids.pid);setObject(0);setShown(true);});};
 return shown?<KnowledgePage client={clients[object]} projectId={project} session={currentSession} buffer={buffer} onChange={b=>{if(b?.pending)pending=structuredClone(b.pending);setBuffer(b);}} exclusion={null} onExclusionChange={()=>{}} correction={null} onCorrectionChange={()=>{}} decision={null} onDecisionChange={()=>{}} conversationBuffer={null} onConversationChange={()=>{}} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
`;
let bundled:Promise<string>|undefined;
function bundle(){return bundled??=(async()=>{
 const result=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[{name:'ui10-saved-entry',resolveId:id=>id==='virtual:ui10-saved'?'\0ui10-saved':null,load:async id=>id==='\0ui10-saved'?(await transformWithOxc(harness,'ui10-saved-harness.tsx',{jsx:{runtime:'automatic'}})).code:null}],build:{write:false,minify:false,sourcemap:false,rolldownOptions:{input:'virtual:ui10-saved'},lib:{entry:'virtual:ui10-saved',name:'AnvilSavedKnowledgeQA',formats:['iife']}}});
 const outputs=Array.isArray(result)?result:[result];expect(outputs).toHaveLength(1);const output=outputs[0];if(!output||!('output'in output))throw Error('SINGLE_BUNDLE_REQUIRED');expect(output.output).toHaveLength(1);const chunk=output.output[0];if(!chunk||chunk.type!=='chunk')throw Error('SINGLE_CHUNK_REQUIRED');return chunk.code;
})();}
async function mount(page:Page){
 const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin==='https://localhost:3830'&&u.pathname==='/')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});requests.push(r.request().url());return r.abort();});
 await page.goto('https://localhost:3830/');await page.addScriptTag({content:await bundle()});await expect(page.getByText('조회된 지식이 없습니다.',{exact:true})).toBeVisible();return{errors,requests};
}
const open=(page:Page)=>page.getByRole('button',{name:'저장한 지식 고정 원문 보기',exact:true});
const original=(page:Page)=>page.getByLabel('보관 지식 원문',{exact:true});
async function readPlan(page:Page,plan:Plan){await page.evaluate(p=>window.__savedKnowledgeQA.enqueue(p),plan);}
async function reset(page:Page,saved=true){await page.evaluate(s=>window.__savedKnowledgeQA.reset(s),saved);await expect(page.getByText('조회된 지식이 없습니다.',{exact:true})).toBeVisible();}
async function set(page:Page,kind:string,side='B'){await page.evaluate(({kind,side})=>window.__savedKnowledgeQA.set(kind,side),{kind,side});}
async function started(page:Page){const index=await page.evaluate(()=>window.__savedKnowledgeQA.calls.length-1);await page.waitForFunction(i=>window.__savedKnowledgeQA.calls[i]?.jsonStarted,index);return index;}
async function release(page:Page,index:number){await page.evaluate(i=>window.__savedKnowledgeQA.release(i),index);await expect.poll(()=>page.evaluate(i=>window.__savedKnowledgeQA.calls[i]?.settled,index)).toBe(true);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}
async function preserved(page:Page){await expect(page.getByLabel('지식 제목',{exact:true})).toHaveValue(title);await expect(page.getByLabel('지식 원문',{exact:true})).toHaveValue(body.replace(/\r\n/g,'\n'));expect(await page.evaluate(()=>window.__savedKnowledgeQA.buffer?.body)).toBe(body);await expect(page.getByLabel('지식 작성 이유',{exact:true})).toHaveValue(reason);}
async function noUnexpected(page:Page,f:Awaited<ReturnType<typeof mount>>){expect(await page.evaluate(()=>window.__savedKnowledgeQA.unknown)).toEqual([]);expect(f.errors).toEqual([]);expect(f.requests).toEqual([]);}

test('UI10_SAVED_ORIGINAL_EMPTY_FILTER 확정·다른종류 검색을 유지한 명시 저장 뒤 정확 고정 원문을 읽는다',async({page})=>{
 const f=await mount(page);await page.getByLabel('지식 상태 필터',{exact:true}).selectOption('CONFIRMED');await page.getByLabel('종류 필터',{exact:true}).selectOption('CAUTION');await page.getByLabel('지식 검색',{exact:true}).fill('확정 기준');await page.getByRole('button',{name:'제목·이유 검색',exact:true}).click();
 await page.getByRole('button',{name:'지식 초안 저장',exact:true}).click();await expect(page.getByText('지식 초안 저장 확인 · v1 · 별도 확정 전',{exact:true})).toBeVisible();await expect(page.getByText('조회된 지식이 없습니다.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.__savedKnowledgeQA.calls.filter(c=>c.path.includes('/versions/')).length)).toBe(0);await expect(open(page)).toBeVisible();
 const writes=await page.evaluate(()=>window.__savedKnowledgeQA.writes);expect(writes.map(c=>c.operation)).toEqual(['uploadArtifact','saveKnowledge']);expect(writes[1]?.payload.entry).toEqual(entry);
 await open(page).click();await expect(original(page)).toHaveText(body);await preserved(page);expect(await page.evaluate(()=>window.__savedKnowledgeQA.buffer?.resultRef)).toEqual(ref);
 expect(await page.evaluate(()=>window.__savedKnowledgeQA.calls.filter(c=>c.path.includes('/versions/')).map(c=>c.path))).toEqual([`/api/v1/projects/${pid}/knowledge/${kid}/versions/1`]);expect(await page.evaluate(()=>window.__savedKnowledgeQA.writes)).toEqual(writes);
 await expect(page.getByLabel('지식 상태 필터',{exact:true})).toHaveValue('CONFIRMED');await expect(page.getByLabel('종류 필터',{exact:true})).toHaveValue('CAUTION');await expect(page.getByLabel('지식 검색',{exact:true})).toHaveValue('확정 기준');
 const searches=await page.evaluate(()=>window.__savedKnowledgeQA.calls.filter(c=>c.path.includes('/knowledge?')).map(c=>c.path));expect(searches.at(-1)).toBe(searches.at(-2));expect(Object.fromEntries(new URL(searches.at(-1)!,'https://anvil.invalid').searchParams)).toEqual({query:'확정 기준',limit:'50',kind:'CAUTION',status:'CONFIRMED'});
 for(const name of ['이 버전에서 지식 정정','이 지식 사용 제외','지식 내용 검토','지식 별도 확정','프로젝트 헌법으로 적용'])await expect(page.getByRole('button',{name,exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>Object.hasOwn(window,'SAVED_ORIGINAL_XSS'))).toBe(false);await noUnexpected(page,f);
});

test('UI10_SAVED_ORIGINAL_REJECTION 거절·ref/hash/본문 변조는 원문을 숨기고 저장 입력·참조를 보존한다',async({page})=>{
 const f=await mount(page);
 for(const plan of [{status:403},{status:404},{body:{...stored,ref:{...ref,id:other}}},{body:{...stored,ref:{...ref,contentHash:'f'.repeat(64)}}},{body:{...stored,body:'변조 본문'}},{body:{...stored,entry:{...entry,title:'변조 제목'}}}]){
  await reset(page);const before=await page.evaluate(()=>window.__savedKnowledgeQA.buffer);await readPlan(page,plan);await open(page).click();await expect(page.getByRole('alert')).toBeVisible();await expect(original(page)).toHaveCount(0);await preserved(page);expect(await page.evaluate(()=>window.__savedKnowledgeQA.buffer)).toEqual(before);await expect(page.getByText('지식 확인 중',{exact:true})).toHaveCount(0);
 }
 expect(await page.evaluate(()=>window.__savedKnowledgeQA.writes)).toEqual([]);await noUnexpected(page,f);
});

test('UI10_SAVED_ORIGINAL_CONTEXT 주체·기기·client·project·buffer·ref/ABA 변경은 늦은 원문과 오류·401을 버린다',async({page})=>{
 const f=await mount(page);
 for(const kind of ['user','device','client','project','buffer','ref','mutateRef'])for(const status of [undefined,401,403]){
  await reset(page);await readPlan(page,{delay:true,status});await open(page).click();const index=await started(page);await set(page,kind);await set(page,kind,'A');await release(page,index);
  await expect(original(page)).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);expect(await page.evaluate(()=>window.__savedKnowledgeQA.authLost)).toBe(0);await expect(page.getByText('지식 확인 중',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'제목·이유 검색',exact:true})).toBeEnabled();
 }
 expect(await page.evaluate(()=>window.__savedKnowledgeQA.writes)).toEqual([]);await noUnexpected(page,f);
});

test('UI10_SAVED_ORIGINAL_LOCKS pending·미확인·다른소유에는 새 조회가 없고 늦은 조회도 현재 자료를 덮지 않는다',async({page})=>{
 const f=await mount(page);await page.getByRole('button',{name:'지식 초안 저장',exact:true}).click();await expect(open(page)).toBeVisible();
 for(const kind of ['pending','uncertain','owner']){
  await reset(page);await set(page,kind);const before=await page.evaluate(()=>window.__savedKnowledgeQA.calls.length);const button=open(page);if(await button.count())await expect(button).toBeDisabled();expect(await page.evaluate(()=>window.__savedKnowledgeQA.calls.length)).toBe(before);
  await reset(page);await readPlan(page,{delay:true,status:401});await open(page).click();const index=await started(page);await set(page,kind);await release(page,index);await expect(original(page)).toHaveCount(0);expect(await page.evaluate(()=>window.__savedKnowledgeQA.authLost)).toBe(0);await expect(page.getByText('지식 확인 중',{exact:true})).toHaveCount(0);
 }
 await noUnexpected(page,f);
});

test('UI10_SAVED_ORIGINAL_SELECTION 현재 다른 원문 선택을 늦은 저장원문/오류가 덮지 않는다',async({page})=>{
 const f=await mount(page);
 for(const status of [undefined,401,403]){
  await reset(page);await page.getByLabel('지식 검색',{exact:true}).fill('다른 선택');await page.getByRole('button',{name:'제목·이유 검색',exact:true}).click();await expect(page.getByRole('button',{name:'지식 원문 보기',exact:true})).toBeEnabled();
  await readPlan(page,{delay:true,status});await open(page).click();const index=await started(page);
  await set(page,'buffer');await expect(page.getByRole('button',{name:'지식 원문 보기',exact:true})).toBeEnabled();await page.getByRole('button',{name:'지식 원문 보기',exact:true}).click();await expect(page.getByRole('heading',{name:'다른 선택 원문',exact:true})).toBeVisible();
  await release(page,index);await expect(page.getByRole('heading',{name:'다른 선택 원문',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);expect(await page.evaluate(()=>window.__savedKnowledgeQA.authLost)).toBe(0);await expect(page.getByText('지식 확인 중',{exact:true})).toHaveCount(0);
 }
 expect(await page.evaluate(()=>window.__savedKnowledgeQA.writes)).toEqual([]);await noUnexpected(page,f);
});
