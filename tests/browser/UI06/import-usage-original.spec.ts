import {test,expect,type Page} from '@playwright/test';
import {build,transformWithOxc} from 'vite';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const pid='ad600000-0000-4000-8000-000000000001',uid='ad600000-0000-4000-8000-000000000002',device='ad600000-0000-4000-8000-000000000003';
const did='ad600000-0000-4000-8000-000000000004',candidateId='ad600000-0000-4000-8000-000000000005',other='ad600000-0000-4000-8000-000000000006',at='2026-10-26T02:00:00Z';
const formRef={id:'ad600000-0000-4000-8000-000000000007',version:1,contentHash:'a'.repeat(64)};
const originalText='가져온 원본\r\n끝',editedText='저장 전에 편집한 문서\r\n<script>window.IMPORT_XSS=1</script>',secondText='다른 문서의 일곱 번째 버전';
const artifact=(artifactId:string,body:string)=>({artifactId,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'});
const source=artifact('ad600000-0000-4000-8000-000000000008',originalText),edited=artifact('ad600000-0000-4000-8000-000000000009',editedText),second=artifact('ad600000-0000-4000-8000-000000000010',secondText);
const selections=[{documentId:did,version:3,selectedBy:uid,at},{documentId:other,version:7,selectedBy:uid,at:'2026-10-26T03:00:00Z'}];
const candidate={id:candidateId,originalRef:source,extractedContentRef:source,intendedFormRef:formRef,parserVersion:'UTF8_IDENTITY_1',losses:[],issues:[],status:'READY',createdAt:at,selections};
function document(id=did,version=3,body=edited){
 const title='원본에서 편집한 저장 문서',content={body,attachments:[source],sections:[],sourceRefs:[]};
 return {id,version,title,formRef,stageNodeRef:null,content,contentHash:contentHash(canonicalJson({title,formRef,stageNodeRef:null,content})),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[],importCandidateRefs:[candidateId]};
}
type Plan={target:'candidate'|'result'|'body';status?:number;body?:unknown;delay?:boolean;raw?:string};
type Call={path:string;method:string;object:number;started:boolean;settled:boolean};
type QA={calls:Call[];unknown:string[];authLost:number;prepared:number;busy:boolean[];enqueue:(p:Plan)=>void;release:(i:number)=>void;set:(kind:string,side:string)=>void;reset:()=>void};
declare global {interface Window{__importUsageQA:QA;IMPORT_XSS?:number}}

// 실제 React MaterialLibrary·ApiClient·보호 reader를 번들한다. 합성 transport이며 served App/DB 증거가 아니다.
const harness=`
import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '/apps/web/src/api/client.ts';
import {MaterialLibrary} from '/apps/web/src/features/design-trace/MaterialLibrary.tsx';
type Plan={target:'candidate'|'result'|'body';status?:number;body?:unknown;delay?:boolean;raw?:string};
type Call={path:string;method:string;object:number;started:boolean;settled:boolean};
type QA={calls:Call[];unknown:string[];authLost:number;prepared:number;busy:boolean[];enqueue:(p:Plan)=>void;release:(i:number)=>void;set:(k:string,s:string)=>void;reset:()=>void};
declare global {interface Window{__importUsageQA:QA}}
const ids=${JSON.stringify({pid,uid,device,did,candidateId,other,at})},candidate=${JSON.stringify(candidate)},first=${JSON.stringify(document())},second=${JSON.stringify(document(other,7,second))};
const files=new Map<string,string>(${JSON.stringify([[source.artifactId,originalText],[edited.artifactId,editedText],[second.artifactId,secondText]])});
const plans:Plan[]=[],releases=new Map<number,()=>void>();
const qa:QA=window.__importUsageQA={calls:[],unknown:[],authLost:0,prepared:0,busy:[],enqueue:p=>plans.push(p),release:i=>releases.get(i)?.(),set:()=>{},reset:()=>{}};
const take=(target:Plan['target'])=>{const i=plans.findIndex(p=>p.target===target);return i<0?undefined:plans.splice(i,1)[0];};
const clients=[0,1].map(object=>new ApiClient(async(path,init)=>{
 const url=String(path),method=init?.method??'GET',index=qa.calls.length,call:Call={path:url,method,object,started:false,settled:false};qa.calls.push(call);
 const reply=async(value:unknown,status=200,plan?:Plan,binary=false)=>{call.started=true;if(plan?.delay)await new Promise<void>(resolve=>releases.set(index,resolve));call.settled=true;if(plan?.raw!==undefined)return new Response(plan.raw,{status,headers:{'content-type':'application/json'}});return binary?new Response(String(value),{status,headers:{'content-type':'application/octet-stream'}}):Response.json(value,{status});};
 if(method!=='GET'){qa.unknown.push(method+' '+url);return reply({code:'NO_WRITES'},503);}
 if(url.includes('/imports?'))return reply({items:[{...candidate,integrity:'NOT_RECHECKED'},{...candidate,id:ids.other,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:ids.at});
 if(url.includes('/proposals?'))return reply({items:[],hasMore:false,nextCursor:null,observedAt:ids.at});
 if(url.endsWith('/imports/'+ids.candidateId)||url.endsWith('/imports/'+ids.other)){const p=take('candidate');return reply(p?.status?{code:'CANDIDATE_DENIED'}:p?.body??{...candidate,id:url.endsWith(ids.other)?ids.other:ids.candidateId},p?.status??200,p);}
 if(url.endsWith('/documents/'+ids.did+'/versions/3')||url.endsWith('/documents/'+ids.other+'/versions/7')){const p=take('result');return reply(p?.status?{code:'RESULT_DENIED'}:p?.body??(url.endsWith('/versions/7')?second:first),p?.status??200,p);}
 if(url.includes('/files/')){const id=url.split('/').pop()??'',p=id===candidate.originalRef.artifactId?undefined:take('body');return reply(p?.body??files.get(id)??'',p?.status??200,p,true);}
 qa.unknown.push(method+' '+url);return reply({code:'UNEXPECTED_QA_API'},503);
}));
function Harness(){
 const [user,setUser]=useState(ids.uid),[device,setDevice]=useState(ids.device),[project,setProject]=useState(ids.pid),[object,setObject]=useState(0),[shown,setShown]=useState(true);
 const session=useMemo(()=>({user:{id:user},clientId:device,csrfToken:'C'.repeat(43)}),[user,device]);
 qa.set=(kind,side)=>flushSync(()=>{if(kind==='user')setUser(side==='B'?ids.other:ids.uid);if(kind==='device')setDevice(side==='B'?ids.other:ids.device);if(kind==='project')setProject(side==='B'?ids.other:ids.pid);if(kind==='client')setObject(side==='B'?1:0);if(kind==='hide')setShown(side!=='B');});
 qa.reset=()=>{plans.length=0;flushSync(()=>setShown(false));flushSync(()=>{setUser(ids.uid);setDevice(ids.device);setProject(ids.pid);setObject(0);setShown(true);});};
 return <><textarea aria-label="기존 미저장 입력" defaultValue="편집 중 원문"/>{shown?<MaterialLibrary client={clients[object]!} projectId={project} session={session} canPrepare={false} onPrepared={()=>qa.prepared++} onBusy={v=>qa.busy.push(v)} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>}</>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
`;
let bundled:Promise<string>|undefined;
function bundle(){return bundled??=(async()=>{
 const result=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[{name:'ui06-import-usage-entry',resolveId:id=>id==='virtual:ui06-import-usage'?'\0ui06-import-usage':null,load:async id=>id==='\0ui06-import-usage'?(await transformWithOxc(harness,'ui06-import-usage-harness.tsx',{jsx:{runtime:'automatic'}})).code:null}],build:{write:false,minify:false,sourcemap:false,rolldownOptions:{input:'virtual:ui06-import-usage'},lib:{entry:'virtual:ui06-import-usage',name:'AnvilImportUsageQA',formats:['iife']}}});
 const outputs=Array.isArray(result)?result:[result];expect(outputs).toHaveLength(1);const output=outputs[0];if(!output||!('output'in output))throw Error('SINGLE_BUNDLE_REQUIRED');expect(output.output).toHaveLength(1);const chunk=output.output[0];if(!chunk||chunk.type!=='chunk')throw Error('SINGLE_CHUNK_REQUIRED');return chunk.code;
})();}
async function mount(page:Page){
 const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin==='https://localhost:3830'&&u.pathname==='/')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});requests.push(r.request().url());return r.abort();});
 await page.goto('https://localhost:3830/');await page.addScriptTag({content:await bundle()});await expect(openButton(page)).toBeVisible();return{errors,requests};
}
const openButton=(page:Page,id=candidateId)=>page.getByRole('button',{name:'가져오기 후보 '+id+' 열기',exact:true});
// 이력마다 정확 문서/버전을 명시하는 독립 조회 버튼. 한 번에 전체 원문을 읽지 않는다.
const usageButton=(page:Page,id=did,version=3)=>page.getByRole('button',{name:`사용 문서 ${id} 버전 ${version} 원문 보기`,exact:true});
const original=(page:Page)=>page.getByRole('region',{name:'가져오기 사용 문서 원문',exact:true}).locator('pre');
async function open(page:Page,id=candidateId){await openButton(page,id).click();await expect(page.getByLabel('보관 후보 원문',{exact:true})).toHaveText(originalText.replace(/\r\n/g,'\n'));}
const results=(calls:Call[])=>calls.filter(c=>/\/documents\/.+\/versions\//.test(c.path));
async function quiet(page:Page){expect(await page.evaluate(()=>({unknown:window.__importUsageQA.unknown,writes:window.__importUsageQA.calls.filter(c=>c.method!=='GET'),control:window.__importUsageQA.calls.filter(c=>/\/projects\/[^/]+$/.test(c.path)),prepared:window.__importUsageQA.prepared,busy:window.__importUsageQA.busy}))).toEqual({unknown:[],writes:[],control:[],prepared:0,busy:[]});await expect(page.getByLabel('기존 미저장 입력')).toHaveValue('편집 중 원문');await expect(page.getByRole('button',{name:'보관 후보로 새 문서 준비',exact:true})).toBeDisabled();}
async function pending(page:Page,target:Plan['target'],status?:number){await page.evaluate(p=>window.__importUsageQA.enqueue(p),{target,delay:true,...status?{status}:{}} satisfies Plan);await usageButton(page).click();await expect.poll(()=>page.evaluate(()=>window.__importUsageQA.calls.findIndex(c=>c.started&&!c.settled))).toBeGreaterThan(-1);return page.evaluate(()=>window.__importUsageQA.calls.findIndex(c=>c.started&&!c.settled));}
async function release(page:Page,i:number){await page.evaluate(i=>window.__importUsageQA.release(i),i);await expect.poll(()=>page.evaluate(i=>window.__importUsageQA.calls[i]?.settled,i)).toBe(true);}

test('가져오기 사용 이력 두 건에서 사용자가 고른 정확 문서·버전의 편집된 저장 원문만 읽는다',async({page})=>{
 const s=await mount(page);await open(page);expect(results(await page.evaluate(()=>window.__importUsageQA.calls))).toEqual([]);
 await expect(usageButton(page)).toBeVisible();await expect(usageButton(page,other,7)).toBeVisible();await usageButton(page).click();await expect(original(page)).toHaveText(editedText.replace(/\r\n/g,'\n'));
 expect(results(await page.evaluate(()=>window.__importUsageQA.calls)).map(c=>c.path)).toEqual([`/api/v1/projects/${pid}/documents/${did}/versions/3`]);
 await expect(page.getByRole('region',{name:'가져오기 사용 문서 원문',exact:true})).toContainText('읽기 전용');await expect(page.getByRole('region',{name:'가져오기 사용 문서 원문',exact:true})).toContainText('버전 3');
 await usageButton(page,other,7).click();await expect(original(page)).toHaveText(secondText);expect(results(await page.evaluate(()=>window.__importUsageQA.calls)).map(c=>c.path)).toEqual([`/api/v1/projects/${pid}/documents/${did}/versions/3`,`/api/v1/projects/${pid}/documents/${other}/versions/7`]);
 expect(await page.evaluate(()=>window.IMPORT_XSS)).toBeUndefined();await quiet(page);expect(s.errors).toEqual([]);expect(s.requests).toEqual([]);
});

test('조회 직전 후보와 정확 selection tuple 재검증 실패는 저장 문서 요청을 차단한다',async({page})=>{
 await mount(page);
 const first=selections[0]!;
 for(const body of [{...candidate,id:other},{...candidate,originalRef:{...source,contentHash:'f'.repeat(64)}},{...candidate,status:'FAILED',extractedContentRef:null},{...candidate,selections:[selections[1]]},{...candidate,selections:[{...first,selectedBy:other},selections[1]]},{...candidate,selections:[{...first,at:'2026-10-26T04:00:00Z'},selections[1]]},{...candidate,selections:[first,first,selections[1]]},{...candidate,selections:null}]){
  await page.evaluate(()=>window.__importUsageQA.reset());await open(page);const count=results(await page.evaluate(()=>window.__importUsageQA.calls)).length;await page.evaluate(p=>window.__importUsageQA.enqueue(p),{target:'candidate',body} satisfies Plan);await usageButton(page).click();await expect(page.getByRole('alert')).toBeVisible();await expect(original(page)).toHaveCount(0);expect(results(await page.evaluate(()=>window.__importUsageQA.calls))).toHaveLength(count);
 }
 await quiet(page);
});

test('문서 역참조·원본 attachment·양식·snapshot·본문 변조와 비JSON·403·404는 원본으로 대체하지 않는다',async({page})=>{
 await mount(page);const base=document();
 for(const plan of [{target:'result',body:{...base,importCandidateRefs:[other]}},{target:'result',body:{...base,importCandidateRefs:[candidateId,candidateId]}},{target:'result',body:{...base,importCandidateRefs:undefined}},{target:'result',body:{...base,content:{...base.content,attachments:[]}}},{target:'result',body:{...base,formRef:{...formRef,version:2}}},{target:'result',body:{...base,title:'snapshot 변조'}},{target:'result',body:{...base,contentHash:'f'.repeat(64)}},{target:'result',body:{...base,id:other}},{target:'result',body:{...base,version:7}},{target:'result',body:{...base,content:{...base.content,sourceRefs:[{id:other}]}}},{target:'result',raw:'not-json'},{target:'body',body:'변조된 본문'},{target:'result',status:403},{target:'result',status:404},{target:'candidate',status:403},{target:'candidate',status:404}] satisfies Plan[]){
  await page.evaluate(()=>window.__importUsageQA.reset());await open(page);await page.evaluate(p=>window.__importUsageQA.enqueue(p),plan);await usageButton(page).click();await expect(page.getByRole('alert')).toBeVisible();await expect(original(page)).toHaveCount(0);
 }
 await quiet(page);
});

test('표시 원문은 후보·선택·주체·client·project·화면 변경 즉시 숨고 ABA로 부활하지 않는다',async({page})=>{
 await mount(page);
 for(const kind of ['user','device','client','project','hide']){
  await page.evaluate(()=>window.__importUsageQA.reset());await open(page);await usageButton(page).click();await expect(original(page)).toBeVisible();await page.evaluate(k=>window.__importUsageQA.set(k,'B'),kind);await expect(original(page)).toHaveCount(0);await page.evaluate(k=>window.__importUsageQA.set(k,'A'),kind);await expect(original(page)).toHaveCount(0);
 }
 await page.evaluate(()=>window.__importUsageQA.reset());await open(page);await usageButton(page).click();await expect(original(page)).toBeVisible();await open(page,other);await expect(original(page)).toHaveCount(0);await quiet(page);
});

test('늦은 후보·metadata·본문·실패는 폐기 문맥에 반영되지 않고 현재401만 인증상실을 알린다',async({page})=>{
 await mount(page);
 for(const target of ['candidate','result','body'] as const)for(const kind of ['user','device','client','project','hide']){
  await page.evaluate(()=>window.__importUsageQA.reset());await open(page);const i=await pending(page,target);await page.evaluate(k=>window.__importUsageQA.set(k,'B'),kind);await page.evaluate(k=>window.__importUsageQA.set(k,'A'),kind);await release(page,i);await expect(original(page)).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);
 }
 for(const status of [401,403,404]){
  await page.evaluate(()=>window.__importUsageQA.reset());await open(page);const before=await page.evaluate(()=>window.__importUsageQA.authLost),i=await pending(page,'result',status);await page.evaluate(()=>{window.__importUsageQA.set('client','B');window.__importUsageQA.set('client','A');});await release(page,i);expect(await page.evaluate(()=>window.__importUsageQA.authLost)).toBe(before);await expect(page.getByRole('alert')).toHaveCount(0);
 }
 await page.evaluate(()=>window.__importUsageQA.reset());await open(page);const before=await page.evaluate(()=>window.__importUsageQA.authLost);await page.evaluate(p=>window.__importUsageQA.enqueue(p),{target:'result',status:401} satisfies Plan);await usageButton(page).click();await expect.poll(()=>page.evaluate(()=>window.__importUsageQA.authLost)).toBe(before+1);await expect(original(page)).toHaveCount(0);await quiet(page);
});

test('후보 최초 open 문맥과 요청 회차에 묶고 지연 조회 중 다른 후보·다른 이력 선택을 보존한다',async({page})=>{
 await mount(page);
 for(const kind of ['user','device','client','project']){
  await page.evaluate(()=>window.__importUsageQA.reset());await open(page);await page.evaluate(k=>window.__importUsageQA.set(k,'B'),kind);await expect(usageButton(page)).toHaveCount(0);await page.evaluate(k=>window.__importUsageQA.set(k,'A'),kind);await expect(usageButton(page)).toHaveCount(0);
 }
 await page.evaluate(()=>window.__importUsageQA.reset());await open(page);let i=await pending(page,'body');await usageButton(page,other,7).click();await expect(original(page)).toHaveText(secondText);await release(page,i);await expect(original(page)).toHaveText(secondText);
 await page.evaluate(()=>window.__importUsageQA.reset());await open(page);i=await pending(page,'result',401);const before=await page.evaluate(()=>window.__importUsageQA.authLost);await open(page,other);await release(page,i);await expect(original(page)).toHaveCount(0);expect(await page.evaluate(()=>window.__importUsageQA.authLost)).toBe(before);await expect(page.getByRole('alert')).toHaveCount(0);await quiet(page);
});
