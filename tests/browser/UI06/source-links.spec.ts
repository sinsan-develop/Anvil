import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',aid='44444444-4444-4444-8444-444444444444';
const doc={id,version:1,contentHash:'a'.repeat(64)},body='사용자 원문',bytes=Buffer.from(body),artifact={artifactId:aid,bytes:bytes.length,contentHash:createHash('sha256').update(bytes).digest('hex'),mediaType:'text/markdown;charset=utf-8'},formRef={id:aid,version:1,contentHash:'b'.repeat(64)};
const otherId='55555555-5555-4555-8555-555555555555';
function view(){const snapshot={projectId:pid,documentRef:doc,sourceRootId:uid,relativePath:'docs/연결된설계.md',sourceSnapshotRef:{id:uid,version:1,contentHash:'c'.repeat(64)},blobHash:'d'.repeat(64),reason:'사용자가 보관한 연결',kind:'LINKED',state:'ACTIVE',previousRef:null,recordedAt:'2026-10-21T00:00:00.000Z'},ref={id:uid,version:1,contentHash:contentHash(canonicalJson(snapshot))};return{projectId:pid,documentRef:doc,items:[{projectId:pid,documentRef:doc,ref,state:'ACTIVE',comparison:'UNVERIFIED',rawAllowed:true,history:[{ref,snapshot}]}],hasMore:false,observedAt:'2026-10-21T00:00:01.000Z'};}
async function setup(page:any){
 await installWorkspaceBundle(page);
 await page.route('**/api/v1/**',(r:any)=>r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}}));
 await page.route('**/api/v1/session',(r:any)=>r.fulfill({json:{user:{id:uid,displayName:'소스 연결 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route(`**/api/v1/projects/${pid}/documents?*`,(r:any)=>r.fulfill({json:{items:[{id,title:'보관 문서',headVersion:1,confirmedVersion:null,updatedAt:'2026-10-21T00:00:00.000Z'},{id:otherId,title:'다른 문서',headVersion:1,confirmedVersion:null,updatedAt:'2026-10-21T00:00:00.000Z'}],hasMore:false,nextCursor:null,observedAt:'2026-10-21T00:00:00.000Z'}}));
 await page.route(`**/api/v1/projects/${pid}/documents/${otherId}/versions/1`,(r:any)=>r.fulfill({json:{...doc,id:otherId,title:'다른 문서',confirmed:false,formRef,stageNodeRef:null,stageBinding:null,content:{body:artifact,attachments:[],sections:[],sourceRefs:[]},validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]}}));
 await page.route(`**/api/v1/projects/${pid}/documents/${id}/versions/1`,(r:any)=>r.fulfill({json:{...doc,title:'보관 문서',confirmed:false,formRef,stageNodeRef:null,stageBinding:null,content:{body:artifact,attachments:[],sections:[],sourceRefs:[]},validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]}}));
 await page.route(`**/api/v1/projects/${pid}/files/${aid}`,(r:any)=>r.fulfill({contentType:'application/octet-stream',body:bytes}));
}
test('명시 조회에서만 source 이력을 보이고 오류/재조회 때 옛 경로를 숨긴다',async({page})=>{
 await setup(page);let calls=0,broken=false;
 await page.route(`**/api/v1/projects/${pid}/documents/*/source-links?*`,r=>{calls++;expect(r.request().method()).toBe('GET');expect(new URL(r.request().url()).searchParams.get('contentHash')).toBe(doc.contentHash);return broken?r.fulfill({status:403,json:{code:'PROJECT_READ_DENIED'}}):r.fulfill({json:view()});});
 await page.goto(`/#/projects/${pid}/documents`);await page.getByRole('button',{name:'보관 문서 열기',exact:true}).click();expect(calls).toBe(0);
 await page.getByRole('button',{name:'이 버전 소스 연결 조회',exact:true}).click();const panel=page.getByRole('region',{name:'문서 소스 연결 이력',exact:true});await expect(panel.getByText('docs/연결된설계.md',{exact:true})).toBeVisible();await expect(panel).toContainText('미확인');await expect(panel).toContainText('현재 파일 내용과의 일치는 확인하지 않았습니다');
 broken=true;await panel.getByRole('button',{name:'소스 연결 새로고침',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('PROJECT_READ_DENIED');await expect(panel.getByText('docs/연결된설계.md',{exact:true})).toHaveCount(0);expect(calls).toBe(2);
 await page.getByRole('button',{name:'다른 문서 열기',exact:true}).click();await expect(page.getByRole('heading',{name:'다른 문서',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'이 버전 소스 연결 조회',exact:true})).toBeVisible();await expect(panel).toHaveCount(0);expect(calls).toBe(2);
});
test('닫힌 조회의 늦은 결과는 새 화면에 노출하지 않는다',async({page})=>{
 await page.addInitScript(()=>{const original=window.fetch;window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0]).includes('/source-links?')){const json=response.json.bind(response);response.json=async()=>{try{return await json();}finally{(window as any).SOURCE_LINK_JSON_CONSUMED=true;}};}return response;};});
 await setup(page);let release!:()=>void,requested!:()=>void;const waiting=new Promise<void>(r=>{requested=r;}),barrier=new Promise<void>(r=>{release=r;});
 await page.route(`**/api/v1/projects/${pid}/documents/${id}/source-links?*`,async r=>{requested();await barrier;await r.fulfill({json:view()});});
 await page.goto(`/#/projects/${pid}/documents`);await page.getByRole('button',{name:'보관 문서 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 소스 연결 조회',exact:true}).click();await waiting;
 await page.getByRole('button',{name:'소스 연결 조회 닫기',exact:true}).click();release();await page.waitForFunction(()=>(window as any).SOURCE_LINK_JSON_CONSUMED===true);await expect(page.getByRole('region',{name:'문서 소스 연결 이력',exact:true})).toHaveCount(0);await expect(page.getByText('docs/연결된설계.md',{exact:true})).toHaveCount(0);
});
