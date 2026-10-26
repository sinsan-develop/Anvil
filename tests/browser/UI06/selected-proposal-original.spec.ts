import {test,expect,type Page} from '@playwright/test';
import {build,transformWithOxc} from 'vite';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const pid='ac600000-0000-4000-8000-000000000001',uid='ac600000-0000-4000-8000-000000000002',device='ac600000-0000-4000-8000-000000000003';
const did='ac600000-0000-4000-8000-000000000004',proposalId='ac600000-0000-4000-8000-000000000005',other='ac600000-0000-4000-8000-000000000006',at='2026-10-26T01:00:00Z';
const baseText='기준 원문\r\n끝',proposedText='반영한 원문\r\n<script>window.SELECTED_XSS=1</script>';
const formRef={id:'ac600000-0000-4000-8000-000000000007',version:1,contentHash:'a'.repeat(64)};
const artifact=(artifactId:string,body:string,mediaType='text/plain;charset=utf-8')=>({artifactId,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType});
const baseBody=artifact('ac600000-0000-4000-8000-000000000008',baseText),proposedBody=artifact('ac600000-0000-4000-8000-000000000009',proposedText);
const baseContent={body:baseBody,attachments:[],sections:[],sourceRefs:[]},proposedContent={body:proposedBody,attachments:[],sections:[],sourceRefs:[]};
const title='보관된 설계',baseRef={id:did,version:1,contentHash:contentHash(canonicalJson({title,formRef,stageNodeRef:null,content:baseContent}))};
const resultRef={id:did,version:2,contentHash:contentHash(canonicalJson({title,formRef,stageNodeRef:null,content:proposedContent}))};
const diffText=JSON.stringify({format:'ANVIL_TEXT_DIFF_1',startLine:1,unchangedBefore:0,unchangedAfter:0,before:[baseText],after:[proposedText],baseRef,baseBodyRef:baseBody,proposedBodyRef:proposedBody,beforeContent:baseContent,afterContent:proposedContent});
const diffRef=artifact('ac600000-0000-4000-8000-000000000010',diffText,'application/json;charset=utf-8');
const selection={documentId:did,version:2,selectedBy:uid,at};
const proposal={id:proposalId,baseRef,proposedContentRef:proposedBody,diffRef,status:'PENDING',proposedContent,proposedBy:uid,reason:'원문 확인',createdAt:at,selections:[selection]};
const document=(version:number)=>({id:did,version,title,formRef,stageNodeRef:null,content:version===1?baseContent:proposedContent,contentHash:version===1?baseRef.contentHash:resultRef.contentHash,confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]});
type Plan={target:'proposal'|'result'|'body';status?:number;body?:unknown;delay?:boolean};
type Call={path:string;method:string;object:number;started:boolean;settled:boolean};
type QA={calls:Call[];unknown:string[];authLost:number;prepared:number;busy:boolean[];enqueue:(p:Plan)=>void;release:(i:number)=>void;set:(kind:string,side:string)=>void;reset:()=>void};
declare global {interface Window {__selectedProposalQA:QA;SELECTED_XSS?:number}}

// 실제 MaterialLibrary·ApiClient·보호 reader의 메모리 번들이다. 합성 transport 증거이며 App·DB 인수가 아니다.
const harness=`
import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '/apps/web/src/api/client.ts';
import {MaterialLibrary} from '/apps/web/src/features/design-trace/MaterialLibrary.tsx';
type Plan={target:'proposal'|'result'|'body';status?:number;body?:unknown;delay?:boolean};
type Call={path:string;method:string;object:number;started:boolean;settled:boolean};
type QA={calls:Call[];unknown:string[];authLost:number;prepared:number;busy:boolean[];enqueue:(p:Plan)=>void;release:(i:number)=>void;set:(k:string,s:string)=>void;reset:()=>void};
declare global {interface Window{__selectedProposalQA:QA}}
const ids=${JSON.stringify({pid,uid,device,did,proposalId,other,at})},proposal=${JSON.stringify(proposal)},base=${JSON.stringify(document(1))},result=${JSON.stringify(document(2))};
const files=new Map<string,string>(${JSON.stringify([[baseBody.artifactId,baseText],[proposedBody.artifactId,proposedText],[diffRef.artifactId,diffText]])});
const plans:Plan[]=[],releases=new Map<number,()=>void>();let resultRead=false;
const qa:QA=window.__selectedProposalQA={calls:[],unknown:[],authLost:0,prepared:0,busy:[],enqueue:p=>plans.push(p),release:i=>releases.get(i)?.(),set:()=>{},reset:()=>{}};
const take=(target:Plan['target'])=>{const i=plans.findIndex(p=>p.target===target);return i<0?undefined:plans.splice(i,1)[0];};
const clients=[0,1].map(object=>new ApiClient(async(path,init)=>{
 const url=String(path),method=init?.method??'GET',index=qa.calls.length,call:Call={path:url,method,object,started:false,settled:false};qa.calls.push(call);
 const reply=async(value:unknown,status=200,plan?:Plan,binary=false)=>{call.started=true;if(plan?.delay)await new Promise<void>(resolve=>releases.set(index,resolve));call.settled=true;return binary?new Response(String(value),{status,headers:{'content-type':'application/octet-stream'}}):Response.json(value,{status});};
 if(method!=='GET'){qa.unknown.push(method+' '+url);return reply({code:'NO_WRITES'},503);}
 if(url.includes('/imports?'))return reply({items:[],hasMore:false,nextCursor:null,observedAt:ids.at});
 if(url.includes('/proposals?'))return reply({items:[{...proposal,title:base.title,status:'SELECTED',integrity:'NOT_RECHECKED'},{...proposal,id:ids.other,title:'다른 제안',status:'SELECTED',integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:ids.at});
 if(url.endsWith('/proposals/'+ids.proposalId)||url.endsWith('/proposals/'+ids.other)){const p=take('proposal');return reply(p?.status?{code:'PROPOSAL_DENIED'}:p?.body??{...proposal,id:url.endsWith(ids.other)?ids.other:ids.proposalId},p?.status??200,p);}
 if(url.endsWith('/documents/'+ids.did+'/versions/1'))return reply(base);
 if(url.endsWith('/documents/'+ids.did+'/versions/2')){resultRead=true;const p=take('result');return reply(p?.status?{code:'RESULT_DENIED'}:p?.body??result,p?.status??200,p);}
 if(url.includes('/files/')){const id=url.split('/').pop()??'',p=resultRead&&id===result.content.body.artifactId?take('body'):undefined;return reply(p?.body??files.get(id)??'',p?.status??200,p,true);}
 qa.unknown.push(method+' '+url);return reply({code:'UNEXPECTED_QA_API'},503);
}));
function Harness(){
 const [user,setUser]=useState(ids.uid),[device,setDevice]=useState(ids.device),[project,setProject]=useState(ids.pid),[object,setObject]=useState(0),[shown,setShown]=useState(true);
 const session=useMemo(()=>({user:{id:user},clientId:device,csrfToken:'C'.repeat(43)}),[user,device]);
 qa.set=(kind,side)=>flushSync(()=>{if(kind==='user')setUser(side==='B'?ids.other:ids.uid);if(kind==='device')setDevice(side==='B'?ids.other:ids.device);if(kind==='project')setProject(side==='B'?ids.other:ids.pid);if(kind==='client')setObject(side==='B'?1:0);if(kind==='hide')setShown(side!=='B');});
 qa.reset=()=>{plans.length=0;resultRead=false;flushSync(()=>setShown(false));flushSync(()=>{setUser(ids.uid);setDevice(ids.device);setProject(ids.pid);setObject(0);setShown(true);});};
 return <><textarea aria-label="기존 미저장 입력" defaultValue="편집 중 원문"/>{shown?<MaterialLibrary client={clients[object]!} projectId={project} session={session} canPrepare={false} onPrepared={()=>qa.prepared++} onBusy={v=>qa.busy.push(v)} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>}</>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
`;
let bundled:Promise<string>|undefined;
function bundle(){return bundled??=(async()=>{
 const result=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[{name:'ui06-selected-entry',resolveId:id=>id==='virtual:ui06-selected'?'\0ui06-selected':null,load:async id=>id==='\0ui06-selected'?(await transformWithOxc(harness,'ui06-selected-harness.tsx',{jsx:{runtime:'automatic'}})).code:null}],build:{write:false,minify:false,sourcemap:false,rolldownOptions:{input:'virtual:ui06-selected'},lib:{entry:'virtual:ui06-selected',name:'AnvilSelectedProposalQA',formats:['iife']}}});
 const outputs=Array.isArray(result)?result:[result];expect(outputs).toHaveLength(1);const output=outputs[0];if(!output||!('output'in output))throw Error('SINGLE_BUNDLE_REQUIRED');expect(output.output).toHaveLength(1);const chunk=output.output[0];if(!chunk||chunk.type!=='chunk')throw Error('SINGLE_CHUNK_REQUIRED');return chunk.code;
})();}
async function mount(page:Page){
 const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin==='https://localhost:3830'&&u.pathname==='/')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});requests.push(r.request().url());return r.abort();});
 await page.goto('https://localhost:3830/');await page.addScriptTag({content:await bundle()});await expect(page.getByRole('button',{name:'보관 제안 '+proposalId+' 열기',exact:true})).toBeVisible();return{errors,requests};
}
const button=(page:Page)=>page.getByRole('button',{name:'반영 결과 원문 보기',exact:true});
const original=(page:Page)=>page.getByLabel('반영 결과 원문',{exact:true});
async function open(page:Page,id=proposalId){await page.getByRole('button',{name:'보관 제안 '+id+' 열기',exact:true}).click();await expect(page.getByLabel('보관 제안 기준 원문',{exact:true})).toHaveText(baseText.replace(/\r\n/g,'\n'));await expect(page.getByLabel('보관 제안 새 원문',{exact:true})).toHaveText(proposedText.replace(/\r\n/g,'\n'));}
async function quiet(page:Page){expect(await page.evaluate(()=>({unknown:window.__selectedProposalQA.unknown,writes:window.__selectedProposalQA.calls.filter(c=>c.method!=='GET'),control:window.__selectedProposalQA.calls.filter(c=>/\/projects\/[^/]+$/.test(c.path)),prepared:window.__selectedProposalQA.prepared,busy:window.__selectedProposalQA.busy}))).toEqual({unknown:[],writes:[],control:[],prepared:0,busy:[]});await expect(page.getByLabel('기존 미저장 입력')).toHaveValue('편집 중 원문');}
async function pending(page:Page,target:'result'|'body',status?:number){await page.evaluate(p=>window.__selectedProposalQA.enqueue(p),{target,delay:true,...status?{status}:{}});await button(page).click();await expect.poll(()=>page.evaluate(t=>window.__selectedProposalQA.calls.findIndex(c=>c.started&&!c.settled&&(t==='result'?c.path.endsWith('/versions/2'):c.path.includes('/files/'))),target)).toBeGreaterThan(-1);return page.evaluate(t=>window.__selectedProposalQA.calls.findIndex(c=>c.started&&!c.settled&&(t==='result'?c.path.endsWith('/versions/2'):c.path.includes('/files/'))),target);}

test('반영 제안은 검증된 비교 뒤 명시적으로 정확 v2 원문을 읽고 쓰기·편집 준비를 하지 않는다',async({page})=>{
 const s=await mount(page);await open(page);
 expect(await page.evaluate(()=>window.__selectedProposalQA.calls.filter(c=>c.path.endsWith('/versions/2')))).toEqual([]);
 await expect(button(page)).toBeVisible();await button(page).click();await expect(original(page)).toHaveText(proposedText.replace(/\r\n/g,'\n'));
 await expect(page.getByRole('region',{name:'제안 반영 결과 원문',exact:true})).toContainText('버전 2');
 await expect(page.getByRole('region',{name:'제안 반영 결과 원문',exact:true})).toContainText('읽기 전용');
 expect(await page.evaluate(()=>window.__selectedProposalQA.calls.filter(c=>c.path.endsWith('/versions/2')).length)).toBe(1);expect(await page.evaluate(()=>window.SELECTED_XSS)).toBeUndefined();await quiet(page);expect(s.errors).toEqual([]);expect(s.requests).toEqual([]);
});

test('selection의 다른 문서·다른 버전·복수 반영은 결과 원문 요청으로 이어지지 않는다',async({page})=>{
 await mount(page);
 for(const selections of [[{...selection,documentId:other}],[{...selection,version:3}],[selection,selection]]){
  await page.evaluate(()=>window.__selectedProposalQA.reset());await page.evaluate(p=>window.__selectedProposalQA.enqueue(p),{target:'proposal',body:{...proposal,selections}} satisfies Plan);await page.getByRole('button',{name:'보관 제안 '+proposalId+' 열기',exact:true}).click();
  await expect(page.getByRole('button',{name:'보관 제안 '+proposalId+' 열기',exact:true})).toBeEnabled();await expect(button(page)).toHaveCount(0);await expect(original(page)).toHaveCount(0);
 }
 expect(await page.evaluate(()=>window.__selectedProposalQA.calls.filter(c=>c.path.endsWith('/versions/2')))).toEqual([]);await quiet(page);
});

test('결과 metadata·내용 hash·원문 변조와 403·404는 제안 본문으로 대체하지 않는다',async({page})=>{
 await mount(page);
 const wrongTitle={...document(2),title:'변조'},wrongId={...document(2),id:other},wrongHash={...document(2),contentHash:'f'.repeat(64)};
 for(const plan of [{target:'result',body:wrongTitle},{target:'result',body:wrongId},{target:'result',body:wrongHash},{target:'body',body:'변조된 결과'},{target:'result',status:403},{target:'result',status:404}] satisfies Plan[]){
  await page.evaluate(()=>window.__selectedProposalQA.reset());await open(page);await page.evaluate(p=>window.__selectedProposalQA.enqueue(p),plan);await button(page).click();await expect(page.getByRole('alert')).toBeVisible();await expect(original(page)).toHaveCount(0);
 }
 await quiet(page);
});

test('다른 제안·주체·client·project·이탈에서 표시한 결과는 즉시 숨기며 ABA 복귀로 부활하지 않는다',async({page})=>{
 await mount(page);
 for(const kind of ['user','device','client','project','hide']){
  await page.evaluate(()=>window.__selectedProposalQA.reset());await open(page);await button(page).click();await expect(original(page)).toBeVisible();await page.evaluate(k=>window.__selectedProposalQA.set(k,'B'),kind);await expect(original(page)).toHaveCount(0);await page.evaluate(k=>window.__selectedProposalQA.set(k,'A'),kind);await expect(original(page)).toHaveCount(0);
 }
 await page.evaluate(()=>window.__selectedProposalQA.reset());await open(page);await button(page).click();await expect(original(page)).toBeVisible();await open(page,other);await expect(original(page)).toHaveCount(0);await quiet(page);
});

test('늦은 결과 metadata·본문·401은 폐기한 문맥과 ABA 복귀에 영향을 주지 않는다',async({page})=>{
 await mount(page);
 for(const target of ['result','body'] as const)for(const kind of ['user','device','client','project','hide']){
  await page.evaluate(()=>window.__selectedProposalQA.reset());await open(page);const i=await pending(page,target);await page.evaluate(k=>window.__selectedProposalQA.set(k,'B'),kind);await page.evaluate(k=>window.__selectedProposalQA.set(k,'A'),kind);await page.evaluate(i=>window.__selectedProposalQA.release(i),i);await expect.poll(()=>page.evaluate(i=>window.__selectedProposalQA.calls[i]?.settled,i)).toBe(true);await expect(original(page)).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);
 }
 await page.evaluate(()=>window.__selectedProposalQA.reset());await open(page);const before=await page.evaluate(()=>window.__selectedProposalQA.authLost),i=await pending(page,'result',401);await page.evaluate(()=>{window.__selectedProposalQA.set('client','B');window.__selectedProposalQA.set('client','A');});await page.evaluate(i=>window.__selectedProposalQA.release(i),i);await expect.poll(()=>page.evaluate(i=>window.__selectedProposalQA.calls[i]?.settled,i)).toBe(true);expect(await page.evaluate(()=>window.__selectedProposalQA.authLost)).toBe(before);await expect(page.getByRole('alert')).toHaveCount(0);await expect(original(page)).toHaveCount(0);await quiet(page);
});
