import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {blankPlanTask} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const project='51c0439f-791e-4bb5-8471-70938d6afaf1',user='32b5f276-13e6-4d8a-b93f-27a15d21c788',designId='a6f30000-0000-4000-8000-000000000090',planId='a6f30000-0000-4000-8000-000000000091',itemId='a6f30000-0000-4000-8000-000000000092',savedId='a6f30000-0000-4000-8000-000000000093';
async function fixture(page:Page,deny=false,stored=false){
  const catalog=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url))),at='2026-10-16T05:00:00Z',documents=new Map<string,any>(),bodies=new Map<string,string>(),writes:any[]=[],unknown:string[]=[];
  for(const [id,title,body,form]of [[designId,'설계 원문','# D01 원문 보존',catalog.forms[1]!],[planId,'작업계획 원문','# FN01 문서 저장',catalog.forms[3]!]]as const){
    const artifactId=crypto.randomUUID(),bytes=Buffer.from(body),content={body:{artifactId,bytes:bytes.length,contentHash:createHash('sha256').update(bytes).digest('hex'),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]};bodies.set(artifactId,body);
    documents.set(id,{id,version:1,title,formRef:form.ref,stageNodeRef:null,content,contentHash:contentHash(canonicalJson({title,formRef:form.ref,stageNodeRef:null,content})),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef:form.ref,items:form.definition.items.map(i=>({criterionId:i.itemId,title:i.title,reviewCriteria:i.reviewCriteria}))},contentReviews:[]});
  }
  await page.route('**/api/v1/**',r=>{unknown.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
  for(const form of[catalog.forms[1]!,catalog.forms[3]!])await page.route(`**/api/v1/forms/${form.ref.id}/versions/1`,r=>r.fulfill({json:{...form,authoringStandard:{ref:catalog.standard.ref,content:catalog.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}}}));
  await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:user,displayName:'계획 QA'},clientId:user,csrfToken:'C'.repeat(43)}}));
  await page.route(`**/api/v1/projects/${project}`,r=>r.fulfill({json:{id:project,participation:'OWNER',controlState:{actorId:user,clientId:user,generation:1,status:'HELD'}}}));
  await page.route(`**/api/v1/projects/${project}/documents?*`,r=>r.fulfill({json:{items:[...documents.values()].map(d=>({id:d.id,title:d.title,headVersion:1,confirmedVersion:null,updatedAt:at})),hasMore:false,nextCursor:null,observedAt:at}}));
  await page.route(`**/api/v1/projects/${project}/documents/*/versions/1`,r=>r.fulfill({json:documents.get(new URL(r.request().url()).pathname.split('/')[6]!)}));
  await page.route(`**/api/v1/projects/${project}/files/*`,r=>r.fulfill({contentType:'application/octet-stream',body:bodies.get(new URL(r.request().url()).pathname.split('/').pop()!)!}));
  const d=documents.get(designId),documentRef={id:designId,version:1,contentHash:d.contentHash},data={documentRef,localCode:'D01',title:'원문 보존',anchor:'line:1'},item={id:itemId,...data,itemHash:contentHash(canonicalJson(data))};
  await page.route(`**/api/v1/projects/${project}/design-index?*`,r=>r.fulfill({json:{documentRef,items:[item],screenRegions:[],status:'INDEXED',observedAt:at}}));
  const planDocument=documents.get(planId),seedSnapshot={documentRef:{id:planId,version:1,contentHash:planDocument.contentHash},designRef:documentRef,screenReviewRefs:[],tasks:[{...blankPlanTask(),taskCode:'FN01',title:'문서 저장',purpose:'보관 계획 목적',designRefs:[{kind:'DESIGN_ITEM',id:itemId,versionRef:documentRef,localCode:'D01',anchor:'line:1'}]}],reason:'보관 초안',dependencies:[],issues:[],relationalProjection:'STORED'};
  let result:any=stored?{ref:{id:savedId,version:1,contentHash:contentHash(canonicalJson(seedSnapshot))},status:'DRAFT',...seedSnapshot}:null;
  await page.route(`**/api/v1/projects/${project}/work-plans?*`,r=>r.fulfill({json:{items:result?[{ref:result.ref,status:'DRAFT',title:'작업계획 원문',documentRef:result.documentRef,designRef:result.designRef,issueCount:result.issues.length,updatedAt:at,integrity:'NOT_RECHECKED'}]:[],hasMore:false,nextCursor:null,observedAt:at}}));
  await page.route(`**/api/v1/projects/${project}/commands`,r=>{const c=r.request().postDataJSON();writes.push(c);expect(c.operation).toBe('saveWorkPlanDraft');expect(c.targetId).toBeNull();expect(c.expectedVersion).toBe(0);if(deny&&writes.length>1)return r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}});if(writes.length===1)return r.abort('connectionreset');const snapshot={...c.payload,dependencies:[],issues:[{code:'DESIGN_NOT_CONFIRMED',location:'designRef',message:'설계가 미확정입니다.'}],relationalProjection:'STORED'},ref={id:savedId,version:1,contentHash:contentHash(canonicalJson(snapshot))};result={ref,status:'DRAFT',...snapshot};return r.fulfill({json:{operationId:itemId,commandId:c.commandId,projectId:project,status:'APPLIED',targetId:savedId,version:1,data:{ref,status:'WORK_PLAN_DRAFT_SAVED',workPlan:result},serverReceivedAt:at}});});
  await page.route(`**/api/v1/projects/${project}/work-plans/${savedId}/versions/1`,r=>r.fulfill({json:{...result,executionEvidence:'NOT_CONNECTED',observedAt:at}}));
  return {writes,unknown};
}
async function fill(page:Page){
  await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'작업계획 원문 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전에서 작업계획 작성',exact:true}).click();
  await page.getByLabel('기준 설계 문서',{exact:true}).selectOption(designId);await page.getByRole('button',{name:'기준 설계 항목 확인',exact:true}).click();await expect(page.getByLabel('업무 1 설계 D01',{exact:true})).toBeVisible();await page.getByLabel('업무 1 설계 D01',{exact:true}).check();
  for(const [name,value]of [['업무 1 코드','FN01'],['업무 1 제목','문서 저장'],['업무 1 목적','원문 보존'],['업무 1 책임 역할','개발 책임자'],['업무 1 입력','설계 원문'],['업무 1 출력','저장 API'],['업무 1 포함 범위','문서 저장'],['업무 1 제외 범위','Agent 실행'],['업무 1 허용 파일','apps/server/documents.ts'],['업무 1 수행 절차','구현 후 저장 조회'],['업무 1 검수 조건','원문 바이트 동일'],['업무 1 증거 요구','실제 API DB 결과'],['업무 1 복구 방법','이전 검증 commit 복구'],['업무 1 재개 유의사항','미완료 지점 보존'],['작업계획 저장 이유','설계와 업무 연결']]as const)await page.getByLabel(name,{exact:true}).fill(value);
}
test('작업계획 작성은 원문·설계와 연결하고 단절/화면 이동 뒤 같은 명령으로만 저장·재조회한다',async({page})=>{
  const s=await fixture(page);await fill(page);await page.getByRole('button',{name:'작업계획 초안 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(page.getByRole('button',{name:'새 문서 작성',exact:true})).toBeDisabled();
  await page.evaluate(()=>{location.hash='#/runs';});await page.getByRole('heading',{name:'아직 연결되지 않은 화면',exact:true}).waitFor();await page.evaluate(p=>{location.hash='#/projects/'+p+'/documents';},project);await expect(page.getByLabel('업무 1 코드',{exact:true})).toHaveValue('FN01');expect(s.writes).toHaveLength(1);
  await page.getByRole('button',{name:'같은 작업계획 명령 결과 확인',exact:true}).click();await expect(page.getByText('작업계획 초안 저장 확인 · 실행/완료 아님',{exact:true})).toBeVisible();await page.getByRole('button',{name:'저장한 작업계획 재조회',exact:true}).click();await expect(page.getByText('저장한 버전 재조회 확인',{exact:true})).toBeVisible();expect(s.writes).toHaveLength(2);expect(s.writes[0]).toEqual(s.writes[1]);expect(s.unknown).toEqual([]);
});
test('작업계획 결과 미확인은 나중 거절로 지우거나 다른 문서 쓰기로 교체하지 않는다',async({page})=>{
  const s=await fixture(page,true);await fill(page);await page.getByRole('button',{name:'작업계획 초안 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await page.getByRole('button',{name:'같은 작업계획 명령 결과 확인',exact:true}).click();await expect(page.getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');await expect(page.getByRole('button',{name:'작업계획 작성 닫기',exact:true})).toBeDisabled();expect(s.writes[0]).toEqual(s.writes[1]);expect(s.unknown).toEqual([]);
});
test('보관 계획은 읽기만으로 열고 별도 확인 뒤 같은 계획의 새 개정 초안으로 준비한다',async({page})=>{
  const s=await fixture(page,false,true);await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'보관한 작업계획 조회',exact:true}).click();await page.getByRole('button',{name:'보관 계획 '+savedId+' 열기',exact:true}).click();await expect(page.getByText('실제 실행/시험 증거: 미연결',{exact:true})).toBeVisible();expect(s.writes).toHaveLength(0);
  await page.getByLabel('이 계획을 새 개정 초안으로 준비하겠습니다',{exact:true}).check();await page.getByRole('button',{name:'이 계획에서 개정 준비',exact:true}).click();await expect(page.getByLabel('업무 1 목적',{exact:true})).toHaveValue('보관 계획 목적');await expect(page.getByText('같은 계획의 새 개정 · 기준 v1',{exact:true})).toBeVisible();expect(s.writes).toHaveLength(0);expect(s.unknown).toEqual([]);
});
