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

test('연결 해제는 준비 POST0·응답유실 후 화면복귀·같은명령 replay·별도 재조회로 확인한다',async({page})=>{
 await setup(page);let generation=2,result:any=null,lost=true,deny=false;const commands:any[]=[];
 await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation}}}));
 await page.route(`**/api/v1/projects/${pid}/documents/${id}/source-links?*`,r=>{
  if(deny)return r.fulfill({status:403,json:{code:'PROJECT_READ_DENIED'}});const v=view();
  if(result){v.items[0]!.ref=result.data.ref;v.items[0]!.state='DETACHED';v.items[0]!.history.push({ref:result.data.ref,snapshot:result.data.snapshot});}
  return r.fulfill({json:v});
 });
 await page.route(`**/api/v1/projects/${pid}/commands`,r=>{
  const c=r.request().postDataJSON();commands.push(c);expect(c.operation).toBe('detachDocumentSource');expect(c.targetId).toBe(uid);expect(c.expectedVersion).toBe(1);
  if(!result){const original=view().items[0]!,snapshot={...original.history[0]!.snapshot,kind:'DETACHED',state:'DETACHED',previousRef:original.ref,reason:c.payload.reason,recordedAt:'2026-10-21T00:00:02.000Z'},ref={id:uid,version:2,contentHash:contentHash(canonicalJson(snapshot))};result={commandId:c.commandId,operationId:aid,projectId:pid,targetId:uid,version:2,status:'APPLIED',data:{ref,snapshot,status:'DOCUMENT_SOURCE_DETACHED'},serverReceivedAt:snapshot.recordedAt};}
  if(lost){lost=false;return r.abort('failed');}return r.fulfill({json:result});
 });
 await page.goto(`/#/projects/${pid}/documents`);await page.getByRole('button',{name:'보관 문서 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 소스 연결 조회',exact:true}).click();await page.getByRole('button',{name:'이 연결 해제 준비',exact:true}).click();
 const editor=page.getByRole('region',{name:'문서 소스 연결 해제',exact:true});await editor.getByLabel('연결 해제 사유',{exact:true}).fill('사용자가 파일을 남기고 연결만 분리');await editor.getByRole('checkbox').check();await editor.getByRole('button',{name:'분리 명령 준비',exact:true}).click();await expect(editor.getByRole('button',{name:'연결 해제 실행',exact:true})).toBeVisible();expect(commands).toHaveLength(0);
 await editor.getByRole('button',{name:'연결 해제 실행',exact:true}).click();await expect(editor.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(editor.getByRole('button',{name:'분리 준비 닫기',exact:true})).toBeDisabled();await expect(editor.getByLabel('연결 해제 사유',{exact:true})).toBeDisabled();
 await page.evaluate(()=>{location.hash='/projects';});await expect(editor).toHaveCount(0);await page.evaluate(target=>{location.hash=target;},`/projects/${pid}/documents`);await expect(editor.getByRole('button',{name:'같은 분리 명령 결과 확인',exact:true})).toBeVisible();
 await editor.getByRole('button',{name:'같은 분리 명령 결과 확인',exact:true}).click();await expect(editor.getByText('연결 해제 저장 응답 확인 · 목록 재조회 미확인',{exact:true})).toBeVisible();expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);
 deny=true;await editor.getByRole('button',{name:'분리 결과 재조회',exact:true}).click();await expect(editor.getByRole('alert')).toContainText('PROJECT_READ_DENIED');await expect(editor.getByRole('button',{name:'분리 준비 닫기',exact:true})).toBeDisabled();
 deny=false;await editor.getByRole('button',{name:'분리 결과 재조회',exact:true}).click();await expect(editor.getByText('정확한 분리 이력 재조회 확인 · 파일 내용·배포 확인 아님',{exact:true})).toBeVisible();await expect(editor.getByRole('button',{name:'분리 준비 닫기',exact:true})).toBeEnabled();expect(commands).toHaveLength(2);
});

test('연결 해제 준비 뒤 제어 세대가 바뀌면 POST0·원명령을 보존한다',async({page})=>{
 await setup(page);let generation=2,posts=0;
 await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation}}}));
 await page.route(`**/api/v1/projects/${pid}/documents/${id}/source-links?*`,r=>r.fulfill({json:view()}));await page.route(`**/api/v1/projects/${pid}/commands`,r=>{posts++;return r.fulfill({status:503,json:{code:'UNEXPECTED_POST'}});});
 await page.goto(`/#/projects/${pid}/documents`);await page.getByRole('button',{name:'보관 문서 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 소스 연결 조회',exact:true}).click();await page.getByRole('button',{name:'이 연결 해제 준비',exact:true}).click();const editor=page.getByRole('region',{name:'문서 소스 연결 해제',exact:true});await editor.getByLabel('연결 해제 사유',{exact:true}).fill('명시 분리');await editor.getByRole('checkbox').check();await editor.getByRole('button',{name:'분리 명령 준비',exact:true}).click();await expect(editor.getByRole('button',{name:'연결 해제 실행',exact:true})).toBeVisible();const command=await editor.getByLabel('분리 원명령',{exact:true}).textContent();generation=3;
 await editor.getByRole('button',{name:'연결 해제 실행',exact:true}).click();await expect(editor.getByRole('alert')).toContainText('CONTROL_GENERATION_CONFLICT');expect(posts).toBe(0);expect(await editor.getByLabel('분리 원명령',{exact:true}).textContent()).toBe(command);
});

for(const receiptFirst of [false,true])test(`연결 해제 POST 중 복귀 뒤 재확인 거절도 원명령 보존·응답순서 ${receiptFirst?'원응답 먼저':'거절 먼저'}`,async({page})=>{
 await setup(page);let release!:()=>void,notify!:()=>void,releaseControl!:()=>void,notifyControl!:()=>void,posts=0,generation=2;const arrived=new Promise<void>(r=>{notify=r;}),barrier=new Promise<void>(r=>{release=r;}),controlArrived=new Promise<void>(r=>{notifyControl=r;}),controlBarrier=new Promise<void>(r=>{releaseControl=r;});
 await page.route(`**/api/v1/projects/${pid}`,async r=>{const g=generation;if(g===3&&receiptFirst){notifyControl();await controlBarrier;}await r.fulfill({json:{id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:g}}});});await page.route(`**/api/v1/projects/${pid}/documents/${id}/source-links?*`,r=>r.fulfill({json:view()}));
 await page.route(`**/api/v1/projects/${pid}/commands`,async r=>{posts++;const c=r.request().postDataJSON(),original=view().items[0]!,snapshot={...original.history[0]!.snapshot,kind:'DETACHED',state:'DETACHED',previousRef:original.ref,reason:c.payload.reason,recordedAt:'2026-10-21T00:00:02.000Z'},ref={id:uid,version:2,contentHash:contentHash(canonicalJson(snapshot))};notify();await barrier;await r.fulfill({json:{commandId:c.commandId,operationId:aid,projectId:pid,targetId:uid,version:2,status:'APPLIED',data:{ref,snapshot,status:'DOCUMENT_SOURCE_DETACHED'},serverReceivedAt:snapshot.recordedAt}});});
 await page.goto(`/#/projects/${pid}/documents`);await page.getByRole('button',{name:'보관 문서 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 소스 연결 조회',exact:true}).click();await page.getByRole('button',{name:'이 연결 해제 준비',exact:true}).click();const editor=page.getByRole('region',{name:'문서 소스 연결 해제',exact:true});await editor.getByLabel('연결 해제 사유',{exact:true}).fill('이탈해도 원명령 결과 보존');await editor.getByRole('checkbox').check();await editor.getByRole('button',{name:'분리 명령 준비',exact:true}).click();await editor.getByRole('button',{name:'연결 해제 실행',exact:true}).click();await arrived;
 const command=await editor.getByLabel('분리 원명령',{exact:true}).textContent();await page.evaluate(()=>{location.hash='/projects';});await expect(editor).toHaveCount(0);generation=3;await page.evaluate(target=>{location.hash=target;},`/projects/${pid}/documents`);
 await editor.getByRole('button',{name:'같은 분리 명령 결과 확인',exact:true}).click();if(receiptFirst){await controlArrived;release();await expect(editor.getByText('연결 해제 저장 응답 확인 · 목록 재조회 미확인',{exact:true})).toBeVisible();releaseControl();await expect(editor.getByRole('button',{name:'분리 결과 재조회',exact:true})).toBeEnabled();await expect(editor.getByRole('alert')).toHaveCount(0);}else{await expect(editor.getByRole('alert')).toContainText('CONTROL_GENERATION_CONFLICT');}expect(posts).toBe(1);expect(await editor.getByLabel('분리 원명령',{exact:true}).textContent()).toBe(command);await expect(editor.getByRole('button',{name:'분리 준비 닫기',exact:true})).toBeDisabled();
 release();await expect(editor.getByText('연결 해제 저장 응답 확인 · 목록 재조회 미확인',{exact:true})).toBeVisible();await expect(editor.getByText(/전송 결과 미확인/)).toHaveCount(0);expect(posts).toBe(1);
});

test('연결 해제 두 POST가 겹치면 최초 늦은 거절로 후속 진행 명령을 닫지 않는다',async({page})=>{
 await page.addInitScript(()=>{const original=Response.prototype.json;Response.prototype.json=async function(){const value=await original.call(this);if(this.url.endsWith('/commands')&&value?.code==='PROJECT_WRITE_DENIED')(window as any).__detachRejectionConsumed=((window as any).__detachRejectionConsumed??0)+1;return value;};});
 await setup(page);const releases:Array<()=>void>=[],arrivals:Array<()=>void>=[];const seen=[0,1].map(i=>new Promise<void>(r=>{arrivals[i]=r;})),barriers=[0,1].map(i=>new Promise<void>(r=>{releases[i]=r;}));let posts=0;
 await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:2}}}));await page.route(`**/api/v1/projects/${pid}/documents/${id}/source-links?*`,r=>r.fulfill({json:view()}));await page.route(`**/api/v1/projects/${pid}/commands`,async r=>{const index=posts++;arrivals[index]!();await barriers[index];await r.fulfill({status:403,json:{code:'PROJECT_WRITE_DENIED'}});});
 await page.goto(`/#/projects/${pid}/documents`);await page.getByRole('button',{name:'보관 문서 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 소스 연결 조회',exact:true}).click();await page.getByRole('button',{name:'이 연결 해제 준비',exact:true}).click();const editor=page.getByRole('region',{name:'문서 소스 연결 해제',exact:true});await editor.getByLabel('연결 해제 사유',{exact:true}).fill('중첩 전송 결과 보존');await editor.getByRole('checkbox').check();await editor.getByRole('button',{name:'분리 명령 준비',exact:true}).click();await editor.getByRole('button',{name:'연결 해제 실행',exact:true}).click();await seen[0];
 await page.evaluate(()=>{location.hash='/projects';});await expect(editor).toHaveCount(0);await page.evaluate(target=>{location.hash=target;},`/projects/${pid}/documents`);await editor.getByRole('button',{name:'같은 분리 명령 결과 확인',exact:true}).click();await seen[1];releases[0]!();
 // 원 응답을 실제 소비한 뒤 재진입하여 로컬 busy와 무관한 원명령 보존을 검사한다.
 await page.waitForFunction(()=>(window as any).__detachRejectionConsumed===1);await page.evaluate(()=>{location.hash='/projects';});await expect(editor).toHaveCount(0);await page.evaluate(target=>{location.hash=target;},`/projects/${pid}/documents`);await expect(editor.getByRole('button',{name:'분리 준비 닫기',exact:true})).toBeDisabled();
 releases[1]!();await expect(editor.getByRole('button',{name:'같은 분리 명령 결과 확인',exact:true})).toBeEnabled();await expect(editor.getByRole('button',{name:'분리 준비 닫기',exact:true})).toBeDisabled();expect(posts).toBe(2);
});

test('연결 해제 최초 POST의 확실한 거절은 사용자 확인 후 준비를 닫을 수 있다',async({page})=>{
 await setup(page);let posts=0;
 await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:2}}}));await page.route(`**/api/v1/projects/${pid}/documents/${id}/source-links?*`,r=>r.fulfill({json:view()}));await page.route(`**/api/v1/projects/${pid}/commands`,r=>{posts++;return r.fulfill({status:403,json:{code:'PROJECT_WRITE_DENIED'}});});
 await page.goto(`/#/projects/${pid}/documents`);await page.getByRole('button',{name:'보관 문서 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 소스 연결 조회',exact:true}).click();await page.getByRole('button',{name:'이 연결 해제 준비',exact:true}).click();const editor=page.getByRole('region',{name:'문서 소스 연결 해제',exact:true});await editor.getByLabel('연결 해제 사유',{exact:true}).fill('확실한 거절 상태 확인');await editor.getByRole('checkbox').check();await editor.getByRole('button',{name:'분리 명령 준비',exact:true}).click();await editor.getByRole('button',{name:'연결 해제 실행',exact:true}).click();await expect(editor.getByRole('alert')).toContainText('PROJECT_WRITE_DENIED');await expect(editor.getByRole('button',{name:'분리 준비 닫기',exact:true})).toBeEnabled();page.once('dialog',dialog=>dialog.accept());await editor.getByRole('button',{name:'분리 준비 닫기',exact:true}).click();await expect(editor).toHaveCount(0);expect(posts).toBe(1);
});
