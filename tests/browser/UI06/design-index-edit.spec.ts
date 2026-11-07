import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
const project='51c0439f-791e-4bb5-8471-70938d6afaf1',user='32b5f276-13e6-4d8a-b93f-27a15d21c788',designId='a6f30000-0000-4000-8000-000000000090',screenId='a6f30000-0000-4000-8000-000000000091',itemId='a6f30000-0000-4000-8000-000000000092',regionId='a6f30000-0000-4000-8000-000000000093';
async function fixture(page:Page,denied:boolean|'AFTER_UNKNOWN'=false) {
  const catalog=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url))),at='2026-10-16T05:00:00Z';
  const bodies=new Map<string,string>(),documents=new Map<string,any>();
  for(const [id,title,body,form] of [[designId,'설계 원문','# D01 사용자 지식 보존\n원문을 유지한다.',catalog.forms[1]!],[screenId,'화면시안 원문','# S06 문서 상세 영역\n원문·버전을 조회한다.',catalog.forms[2]!]] as const) {
    const artifactId=crypto.randomUUID(),bytes=Buffer.from(body),content={body:{artifactId,bytes:bytes.length,contentHash:createHash('sha256').update(bytes).digest('hex'),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]};bodies.set(artifactId,body);
    documents.set(id,{id,version:1,title,formRef:form.ref,stageNodeRef:null,content,contentHash:contentHash(canonicalJson({title,formRef:form.ref,stageNodeRef:null,content})),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef:form.ref,items:form.definition.items.map(i=>({criterionId:i.itemId,title:i.title,reviewCriteria:i.reviewCriteria}))},contentReviews:[]});
  }
  const writes:any[]=[],unknown:string[]=[];
  await page.route('**/api/v1/**',r=>{unknown.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
  // 개별 양식 route를 catch-all 뒤에 등록해 모든 실제 API 유출을 막는다.
  for(const form of [catalog.forms[1]!,catalog.forms[2]!])await page.route(`**/api/v1/forms/${form.ref.id}/versions/1`,r=>r.fulfill({json:{...form,authoringStandard:{ref:catalog.standard.ref,content:catalog.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}}}));
  await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:user,displayName:'위치 등록 QA'},clientId:user,csrfToken:'C'.repeat(43)}}));
  await page.route(`**/api/v1/projects/${project}`,r=>r.fulfill({json:{id:project,participation:'OWNER',controlState:{actorId:user,clientId:user,generation:1,status:'HELD'}}}));
  await page.route(`**/api/v1/projects/${project}/documents?*`,r=>r.fulfill({json:{items:[...documents.values()].map(d=>({id:d.id,title:d.title,headVersion:1,confirmedVersion:null,updatedAt:at})),hasMore:false,nextCursor:null,observedAt:at}}));
  await page.route(`**/api/v1/projects/${project}/documents/*/versions/1`,r=>r.fulfill({json:documents.get(new URL(r.request().url()).pathname.split('/')[6]!)}));
  await page.route(`**/api/v1/projects/${project}/files/*`,r=>r.fulfill({contentType:'application/octet-stream',body:bodies.get(new URL(r.request().url()).pathname.split('/').pop()!)!}));
  await page.route(`**/api/v1/projects/${project}/commands`,r=>{
    const c=r.request().postDataJSON();writes.push(c);expect(c.operation).toBe('indexDesignDocument');expect(c.targetId).toBe(designId);expect(c.expectedVersion).toBe(1);
    if(denied===true||denied==='AFTER_UNKNOWN'&&writes.length>1)return r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}});
    if(denied==='AFTER_UNKNOWN')return r.abort('connectionreset');
    const i=c.payload.items[0],item={id:itemId,documentRef:c.payload.documentRef,...i,itemHash:contentHash(canonicalJson({documentRef:c.payload.documentRef,...i}))},s=c.payload.screens[0],screen=documents.get(screenId),sd={designItemId:itemId,screenCode:s.screenCode,documentRef:s.documentRef,artifactRef:screen.content.body,anchor:s.anchor},region={id:regionId,...sd,regionHash:contentHash(canonicalJson(sd))};
    return writes.length===1?r.abort('connectionreset'):r.fulfill({json:{operationId:itemId,commandId:c.commandId,projectId:project,status:'APPLIED',targetId:designId,version:1,data:{status:'DESIGN_INDEXED',ref:c.payload.documentRef,designItems:[item],screenRegions:[region]},serverReceivedAt:at}});
  });
  return {writes,unknown};
}
async function fill(page:Page) {
  await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'설계 원문 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 설계 위치 등록',exact:true}).click();
  await page.getByLabel('설계 항목 1 코드',{exact:true}).fill('D01');await page.getByLabel('설계 항목 1 제목',{exact:true}).fill('사용자 지식 보존');
  await page.getByLabel('화면시안 문서 선택',{exact:true}).selectOption(screenId);await page.getByRole('button',{name:'화면시안 원문 확인',exact:true}).click();await expect(page.getByLabel('등록할 화면시안 원문',{exact:true})).toContainText('S06');
  await page.getByLabel('연결할 설계 코드',{exact:true}).selectOption('D01');await page.getByLabel('화면 코드',{exact:true}).fill('S06');await page.getByRole('button',{name:'확인한 화면 위치 추가',exact:true}).click();await page.getByLabel('추적 등록 이유',{exact:true}).fill('원문과 시안 위치를 확인한 명시 연결');
}
test('설계·화면 위치 등록은 원문/버전을 고정하고 단절·화면 이동에도 같은 명령만 재확인한다',async({page})=>{
  const s=await fixture(page);await fill(page);await expect(page.getByRole('button',{name:'새 문서 작성',exact:true})).toBeDisabled();await page.getByRole('button',{name:'설계·화면 위치 등록',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');
  await page.evaluate(()=>{location.hash='#/runs';});await page.getByRole('heading',{name:'아직 연결되지 않은 화면',exact:true}).waitFor();await page.evaluate(p=>{location.hash='#/projects/'+p+'/documents';},project);await expect(page.getByLabel('설계 항목 1 코드',{exact:true})).toHaveValue('D01');expect(s.writes).toHaveLength(1);
  await page.getByRole('button',{name:'같은 추적 등록 명령 결과 확인',exact:true}).click();await expect(page.getByText('설계·화면 위치 등록 확인 · 문서/구현 완료 아님',{exact:true})).toBeVisible();expect(s.writes).toHaveLength(2);expect(s.writes[1]).toEqual(s.writes[0]);expect(s.writes[0].payload.screens[0].screenCode).toBe('S06');expect(s.unknown).toEqual([]);
});
test('설계 등록의 명확한 권한 거절은 입력을 보존하고 사용자 선택 전 다른 문서 작업을 열지 않는다',async({page})=>{
  const s=await fixture(page,true);await fill(page);await page.getByRole('button',{name:'설계·화면 위치 등록',exact:true}).click();await expect(page.getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');await expect(page.getByRole('button',{name:'새 문서 작성',exact:true})).toBeDisabled();expect(s.writes).toHaveLength(1);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'설계 위치 등록 닫기',exact:true}).click();await expect(page.getByRole('button',{name:'새 문서 작성',exact:true})).toBeEnabled();expect(s.writes).toHaveLength(1);expect(s.unknown).toEqual([]);
});
test('설계 등록의 단절 뒤 거절은 이전 결과 미확인을 지우거나 닫기를 허용하지 않는다',async({page})=>{
  const s=await fixture(page,'AFTER_UNKNOWN');await fill(page);await page.getByRole('button',{name:'설계·화면 위치 등록',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await page.getByRole('button',{name:'같은 추적 등록 명령 결과 확인',exact:true}).click();await expect(page.getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');
  await expect(page.getByRole('button',{name:'설계 위치 등록 닫기',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'새 문서 작성',exact:true})).toBeDisabled();expect(s.writes).toHaveLength(2);expect(s.writes[1]).toEqual(s.writes[0]);expect(s.unknown).toEqual([]);
});
