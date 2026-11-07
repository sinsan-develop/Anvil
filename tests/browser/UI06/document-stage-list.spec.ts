import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {contentHash,canonicalJson} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',did='33333333-3333-4333-8333-333333333333',fid='44444444-4444-4444-8444-444444444444',aid='55555555-5555-4555-8555-555555555555',at='2026-10-21T07:00:00Z',body='저장 문서 본문',formRef={id:fid,version:1,contentHash:'a'.repeat(64)},applicationRef={id:aid,version:2,contentHash:'b'.repeat(64)};
const options={projectId:pid,formRef,applicationRef,methodologyName:'사용자 방법론',items:[{stageNodeRef:{applicationId:aid,nodeId:'design'},nodeName:'상세 설계',nodeKind:'HUMAN',uses:['OUTPUT']}],status:'READY',observedAt:at};
async function fixture(page:Page,mismatch=false){
 let filteredView=false;const unknown:string[]=[],writes:string[]=[],errors:string[]=[],queries:string[]=[];await page.route('**/*',r=>{unknown.push(r.request().url());return r.abort();});await installStageListBundle(page);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'단계 조회 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid+'/documents?*',r=>{const q=new URL(r.request().url()).searchParams;queries.push(q.toString());const filtered=q.has('applicationId');filteredView=filtered;return r.fulfill({json:{items:filtered&&q.has('cursor')?[]:[{id:did,title:filtered?'단계 문서':'보관 문서',headVersion:1,confirmedVersion:null,updatedAt:at}],hasMore:filtered&&!q.has('cursor'),nextCursor:filtered&&!q.has('cursor')?'stage-page-2':null,observedAt:at}});});
 const content={body:{artifactId:fid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]};
 await page.route('**/api/v1/projects/'+pid+'/documents/'+did+'/versions/1',r=>{const stageNodeRef=filteredView&&!mismatch?{applicationId:aid,nodeId:'design'}:null;return r.fulfill({json:{id:did,version:1,title:'보관 문서',formRef,stageNodeRef,stageBinding:stageNodeRef?{applicationRef,methodologyName:'사용자 방법론',nodeId:'design',nodeName:'상세 설계',uses:['OUTPUT']}:null,contentHash:contentHash(canonicalJson({title:'보관 문서',formRef,stageNodeRef,content})),confirmed:false,content,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]}});});
 await page.route('**/api/v1/projects/'+pid+'/files/'+fid,r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.from(body)}));
 return{unknown,writes,errors,queries};
}
async function open(page:Page){await page.goto('/#/projects/'+pid+'/documents');await page.getByRole('button',{name:'보관 문서 열기',exact:true}).click();await expect(page.getByLabel('문서 원문',{exact:true})).toHaveText(body);}
async function installStageListBundle(page:Page){
 const dist=process.env.ANVIL_UI06_QA_DIST;
 if(!dist){await installWorkspaceBundle(page);return;}
 await page.route(/^https:\/\/localhost:3830\/(?:assets\/[A-Za-z0-9_.-]+)?$/,async r=>{
  if(r.request().method()!=='GET')return r.fallback();
  const path=new URL(r.request().url()).pathname;
  const contentType=path==='/'?'text/html':path.endsWith('.css')?'text/css':'application/javascript';
  return r.fulfill({contentType,body:await readFile(join(dist,path==='/'?'index.html':path.slice(1)))});
 });
}

for(const mode of ['UNLINKED','MISMATCH'] as const)test('STAGE_LIST_SAVE_'+mode+' 저장 영수증의 문서만 보호 재조회한다',async({page})=>{
 const f=await fixture(page);
 const documentId='66666666-6666-4666-8666-666666666666',artifactId='77777777-7777-4777-8777-777777777777';
 const title='단계에 연결하지 않은 새 초안',text='# 목적\n저장 영수증의 정확한 본문';
 const catalog=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
 const form=catalog.forms[0]!;
 await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:1,status:'HELD'}}}));
 await page.route('**/api/v1/projects/'+pid+'/documents/stage-options?*',r=>r.fulfill({json:options}));
 await page.route('**/api/v1/forms',r=>r.fulfill({json:{items:[{ref:form.ref,name:form.definition.name,formCode:form.definition.formCode,scope:'SYSTEM'}],observedAt:at,hasMore:false,nextCursor:null,baselineVersion:null}}));
 await page.route('**/api/v1/forms/'+form.ref.id+'/versions/1',r=>r.fulfill({json:{...form,authoringStandard:{ref:catalog.standard.ref,content:catalog.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}}}));
 let bytes=Buffer.alloc(0),saves=0,versionReads=0,bodyReads=0;
 let savedContent:unknown;
 const receipt=(commandId:string,targetId:string,version:number|null,data:unknown)=>({operationId:artifactId,commandId,projectId:pid,status:'APPLIED',targetId,version,data,evidenceRefs:[],warnings:[],serverReceivedAt:at});
 const snapshot=(name:string)=>({title:name,formRef:form.ref,stageNodeRef:null,content:savedContent});
 await page.route('**/api/v1/projects/'+pid+'/files',r=>{
  const command=JSON.parse(r.request().headers()['x-anvil-command']!);
  bytes=Buffer.from(r.request().postDataBuffer()!);
  expect(bytes.toString('utf8')).toBe(text);
  return r.fulfill({status:201,json:receipt(command.commandId,artifactId,null,{artifactRef:{artifactId,...command.payload},status:'ARTIFACT_READY'})});
 });
 await page.route('**/api/v1/projects/'+pid+'/commands',r=>{
  const command=r.request().postDataJSON();saves++;
  expect(command.targetId).toBeNull();expect(command.expectedVersion).toBe(0);
  expect(command.payload.formRef).toEqual(form.ref);expect(command.payload.stageNodeRef).toBeNull();
  savedContent=command.payload.content;
  return r.fulfill({json:receipt(command.commandId,documentId,1,{status:'DRAFT',ref:{id:documentId,version:1,contentHash:contentHash(canonicalJson(snapshot(title)))}})});
 });
 await page.route('**/api/v1/projects/'+pid+'/documents/'+documentId+'/versions/1',r=>{
  versionReads++;expect(saves).toBe(1);
  const metadata=snapshot(mode==='MISMATCH'?'영수증과 다른 제목':title);
  return r.fulfill({json:{...metadata,id:documentId,version:1,contentHash:contentHash(canonicalJson(metadata)),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef:form.ref,items:form.definition.items.map(item=>({criterionId:item.itemId,title:item.title,reviewCriteria:item.reviewCriteria}))},contentReviews:[],reviewRefs:[]}});
 });
 await page.route('**/api/v1/projects/'+pid+'/files/'+artifactId,r=>{bodyReads++;return r.fulfill({contentType:'application/octet-stream',body:bytes});});
 await open(page);
 await page.getByRole('button',{name:'이 문서 양식의 적용 단계 조회',exact:true}).click();
 await page.getByLabel('문서를 찾을 개발 단계',{exact:true}).selectOption('design');
 await expect(page.getByRole('button',{name:'단계 문서 열기',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'새 문서 작성',exact:true}).click();
 await page.getByLabel('새 문서 양식',{exact:true}).selectOption(form.ref.id);
 await page.getByRole('button',{name:'선택 양식으로 작성',exact:true}).click();
 await page.getByLabel('문서 제목',{exact:true}).fill(title);
 await page.getByLabel('문서 본문 편집',{exact:true}).fill(text);
 await page.getByLabel('문서 변경 이유',{exact:true}).fill('명시적으로 새 초안 저장');
 await page.getByRole('button',{name:'새 초안 버전 저장',exact:true}).click();
 await expect(page.getByText('초안 버전 1 저장 확인',{exact:true})).toBeVisible();
 if(mode==='MISMATCH'){
  await expect(page.getByRole('alert')).toContainText('DOCUMENT_REFERENCE_CHANGED');
  await expect(page.getByLabel('문서 원문',{exact:true})).toHaveCount(0);
 }else{
  await expect(page.getByLabel('문서 원문',{exact:true})).toHaveText(text);
 }
 await expect(page.getByText('목록 조회 조건: 상세 설계',{exact:true})).toBeVisible();
 expect(saves).toBe(1);expect(versionReads).toBe(1);expect(bodyReads).toBe(mode==='MISMATCH'?0:1);
 expect(f.writes).toEqual(['POST','POST']);expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);
});

test('STAGE_LIST 양식의 적용 단계로 문서 목록·cursor를 조회하고 전체 목록으로 돌아온다',async({page})=>{
 const f=await fixture(page);let calls=0;await page.route('**/api/v1/projects/'+pid+'/documents/stage-options?*',r=>{calls++;const q=new URL(r.request().url()).searchParams;expect(q.get('formId')).toBe(fid);expect(q.get('formVersion')).toBe('1');expect(q.get('formHash')).toBe('a'.repeat(64));return r.fulfill({json:options});});await open(page);
 await expect(page.getByRole('button',{name:'이 문서 양식의 적용 단계 조회',exact:true})).toBeVisible();expect(calls).toBe(0);await page.getByRole('button',{name:'이 문서 양식의 적용 단계 조회',exact:true}).click();await page.getByLabel('문서를 찾을 개발 단계',{exact:true}).selectOption('design');
 await expect(page.getByText('목록 조회 조건: 상세 설계',{exact:true})).toBeVisible();await expect(page.getByLabel('문서 원문',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'단계 문서 열기',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'단계 문서 열기',exact:true}).click();await expect(page.getByLabel('문서 원문',{exact:true})).toHaveText(body);await expect(page.getByRole('region',{name:'문서 단계 연결',exact:true})).toContainText('사용자 방법론 · 상세 설계');
 await page.getByRole('button',{name:'다음 문서 더 보기',exact:true}).click();await expect(page.getByRole('button',{name:'다음 문서 더 보기',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'전체 단계 문서로 돌아가기',exact:true}).click();await expect(page.getByRole('button',{name:'보관 문서 열기',exact:true})).toBeVisible();
 expect(f.queries).toEqual(['limit=50',`limit=50&applicationId=${aid}&nodeId=design`,`limit=50&applicationId=${aid}&nodeId=design&cursor=stage-page-2`,'limit=50']);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);
});
test('STAGE_LIST_BOUNDARY 필터와 다른 단계의 원문은 표시하지 않고 불일치로 남긴다',async({page})=>{
 const f=await fixture(page,true);await page.route('**/api/v1/projects/'+pid+'/documents/stage-options?*',r=>r.fulfill({json:options}));await open(page);await page.getByRole('button',{name:'이 문서 양식의 적용 단계 조회',exact:true}).click();await page.getByLabel('문서를 찾을 개발 단계',{exact:true}).selectOption('design');await page.getByRole('button',{name:'단계 문서 열기',exact:true}).click();await expect(page.getByRole('alert')).toContainText('DOCUMENT_STAGE_CHANGED');await expect(page.getByLabel('문서 원문',{exact:true})).toHaveCount(0);await expect(page.getByText('목록 조회 조건: 상세 설계',{exact:true})).toBeVisible();expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);
});
test('STAGE_LIST 단계 재조회 거절은 이전 선택지를 숨기고 문서 목록·원문을 바꾸지 않는다',async({page})=>{
 const f=await fixture(page);let denied=false;await page.route('**/api/v1/projects/'+pid+'/documents/stage-options?*',r=>denied?r.fulfill({status:403,json:{code:'PROJECT_ACCESS_DENIED'}}):r.fulfill({json:options}));await open(page);await page.getByRole('button',{name:'이 문서 양식의 적용 단계 조회',exact:true}).click();await expect(page.getByLabel('문서를 찾을 개발 단계',{exact:true})).toBeVisible();denied=true;await page.getByRole('button',{name:'이 문서 양식의 적용 단계 조회',exact:true}).click();await expect(page.getByRole('region',{name:'문서 목록 단계 찾기',exact:true}).getByRole('alert')).toContainText('PROJECT_ACCESS_DENIED');await expect(page.getByLabel('문서를 찾을 개발 단계',{exact:true})).toHaveCount(0);await expect(page.getByLabel('문서 원문',{exact:true})).toHaveText(body);expect(f.queries).toEqual(['limit=50']);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);
});
test('STAGE_LIST 문서 재조회 뒤 늦게 소비된 단계 응답은 새 선택기에 재등장하지 않는다',async({page})=>{
 await page.addInitScript(()=>{const original=Response.prototype.json;(window as any).stageQa={consumed:false};Response.prototype.json=async function(){const v=await original.call(this);if(new URL(this.url,location.href).pathname.endsWith('/documents/stage-options'))setTimeout(()=>{(window as any).stageQa.consumed=true;},0);return v;};});
 const f=await fixture(page);let entered=false,release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);await page.route('**/api/v1/projects/'+pid+'/documents/stage-options?*',async r=>{entered=true;await gate;await r.fulfill({json:options});});await open(page);await page.getByRole('button',{name:'이 문서 양식의 적용 단계 조회',exact:true}).click();await expect.poll(()=>entered).toBe(true);await page.getByRole('button',{name:'지정 버전 조회',exact:true}).click();await expect(page.getByLabel('문서 원문',{exact:true})).toHaveText(body);release();await expect.poll(()=>page.evaluate(()=>(window as any).stageQa.consumed)).toBe(true);await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));await expect(page.getByLabel('문서를 찾을 개발 단계',{exact:true})).toHaveCount(0);expect(f.queries).toEqual(['limit=50']);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);
});
test('STAGE_LIST 단계 필터와 전체 복귀는 작성 중 제목·본문·이유를 바꾸거나 저장하지 않는다',async({page})=>{
 const f=await fixture(page);await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:1,status:'HELD'}}}));await page.route('**/api/v1/projects/'+pid+'/documents/stage-options?*',r=>r.fulfill({json:options}));await open(page);await page.getByRole('button',{name:'이 버전에서 편집',exact:true}).click();await page.getByLabel('문서 제목',{exact:true}).fill('미저장 제목');await page.getByLabel('문서 본문 편집',{exact:true}).fill('버리지 않을 본문');await page.getByLabel('문서 변경 이유',{exact:true}).fill('작성 계속');await page.getByRole('button',{name:'이 문서 양식의 적용 단계 조회',exact:true}).click();await page.getByLabel('문서를 찾을 개발 단계',{exact:true}).selectOption('design');await expect(page.getByRole('button',{name:'단계 문서 열기',exact:true})).toBeVisible();await page.getByRole('button',{name:'전체 단계 문서로 돌아가기',exact:true}).click();await expect(page.getByRole('button',{name:'보관 문서 열기',exact:true})).toBeVisible();await expect(page.getByLabel('문서 제목',{exact:true})).toHaveValue('미저장 제목');await expect(page.getByLabel('문서 본문 편집',{exact:true})).toHaveValue('버리지 않을 본문');await expect(page.getByLabel('문서 변경 이유',{exact:true})).toHaveValue('작성 계속');expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);
});
