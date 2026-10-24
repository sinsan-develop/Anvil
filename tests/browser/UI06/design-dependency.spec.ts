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

  const d=documents.get(designId),ref={id:designId,version:1,contentHash:d.contentHash},items=[1,2].map(n=>{const data={documentRef:ref,localCode:'D0'+n,title:'설계 항목 '+n,anchor:'line:'+n};return{id:n===1?itemId:regionId,...data,itemHash:contentHash(canonicalJson(data))};});
  await page.route(`**/api/v1/projects/${project}/design-index?*`,r=>r.fulfill({json:{documentRef:ref,items,screenRegions:[],status:'INDEXED',observedAt:at}}));
  await page.route(`**/api/v1/projects/${project}/commands`,r=>{
    const c=r.request().postDataJSON();writes.push(c);expect(c.operation).toBe('linkTrace');expect(c.payload.relation).toBe('DEPENDS_ON');
    if(denied)return r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}});
    if(writes.length===1)return r.abort('connectionreset');
    const data={...c.payload,designRefs:[ref]},edgeHash=contentHash(canonicalJson(data)),edge={id:screenId,...data,edgeHash,createdAt:at};
    return r.fulfill({json:{commandId:c.commandId,projectId:project,operationId:itemId,status:'APPLIED',targetId:edge.id,version:1,serverReceivedAt:at,data:{status:'TRACE_LINKED',ref:{id:edge.id,version:1,contentHash:edgeHash},edge}}});
  });
  return {writes,unknown};
}

test.beforeEach(async({page})=>{
 await page.route('https://localhost:3830/**',async r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/'))return r.fallback();if(r.request().method()!=='GET'||u.pathname!=='/'&&!(u.pathname.startsWith('/assets/')&&/^[A-Za-z0-9_.-]+$/.test(u.pathname.slice(8))))return r.abort('blockedbyclient');const p=u.pathname==='/'?'index.html':u.pathname.slice(1);return r.fulfill({body:await readFile(new URL('../../../apps/web/dist/'+p,import.meta.url)),contentType:p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':'application/javascript'});});
});
test('문서 해시 준비 중 설계 의존 편집은 시작하지 않는다',async({page})=>{
 const f=await fixture(page);let posts=0;await page.route(`**/api/v1/projects/${project}/files`,r=>{posts++;return r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}});});
 await page.goto('/#/projects/'+project+'/documents');await page.getByRole('button',{name:'설계 원문 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전에서 편집',exact:true}).click();await page.getByLabel('문서 변경 이유',{exact:true}).fill('경쟁 준비 시험');
 await page.evaluate(()=>{const real=crypto.subtle.digest.bind(crypto.subtle);let first=true;(window as any).digestStarted=false;crypto.subtle.digest=async(...args:Parameters<SubtleCrypto['digest']>)=>{if(first){first=false;(window as any).digestStarted=true;await new Promise<void>(resolve=>{(window as any).releaseDigest=resolve;});}return real(...args);};});
 await page.getByRole('button',{name:'새 초안 버전 저장',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).digestStarted)).toBe(true);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'이 버전 설계 의존 관계 작성',exact:true}).click();await expect(page.getByLabel('설계 의존 관계 편집',{exact:true})).toHaveCount(0);expect(posts).toBe(0);
 await page.evaluate(()=>(window as any).releaseDigest());await expect.poll(()=>posts).toBe(1);await expect(page.getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');await expect(page.getByLabel('설계 의존 관계 편집',{exact:true})).toHaveCount(0);expect(f.writes).toHaveLength(0);expect(f.unknown).toEqual([]);
});
test('같은 설계 의존 명령 성공 뒤 옛 POST 실패가 닫기를 잠그지 않는다',async({page})=>{
 const f=await fixture(page);let first:any=null,count=0,edge:any=null;
 await page.route(`**/api/v1/projects/${project}/commands`,r=>{count++;const c=r.request().postDataJSON();f.writes.push(c);if(count===1){first=r;return;}const data={...c.payload,designRefs:[c.payload.from.versionRef]},edgeHash=contentHash(canonicalJson(data));edge={id:screenId,...data,edgeHash,createdAt:'2026-10-25T00:00:00Z'};return r.fulfill({json:{commandId:c.commandId,projectId:project,operationId:itemId,status:'APPLIED',targetId:edge.id,version:1,serverReceivedAt:edge.createdAt,data:{status:'TRACE_LINKED',ref:{id:edge.id,version:1,contentHash:edgeHash},edge}}});});
 await page.goto('/#/projects/'+project+'/documents');await page.getByRole('button',{name:'설계 원문 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 설계 의존 관계 작성',exact:true}).click();await page.getByLabel('의존하는 설계 항목',{exact:true}).selectOption(itemId);await page.getByLabel('의존 대상 설계 항목',{exact:true}).selectOption(regionId);await page.getByLabel('설계 의존 관계 이유',{exact:true}).fill('역순 응답');await page.getByRole('button',{name:'설계 의존 관계 저장',exact:true}).click();await expect.poll(()=>count).toBe(1);
 await page.evaluate(()=>{location.hash='#/runs';});await page.getByRole('heading',{name:'아직 연결되지 않은 화면',exact:true}).waitFor();await page.evaluate(p=>{location.hash='#/projects/'+p+'/documents';},project);await page.getByRole('button',{name:'같은 설계 의존 명령 결과 확인',exact:true}).click();await expect(page.getByText('설계 의존 관계 저장 확인 · 실행/완료 판정 아님',{exact:true})).toBeVisible();await first.abort('connectionreset');await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));await expect(page.getByRole('button',{name:'설계 의존 편집 닫기',exact:true})).toBeEnabled();expect(f.writes[0]).toEqual(f.writes[1]);expect(f.unknown).toEqual([]);
});
for(const denied of [false,true])test('설계 의존 관계 명시 저장·동일명령 복구 '+denied,async({page})=>{
 const f=await fixture(page,denied);await page.goto('/#/projects/'+project+'/documents');await page.getByRole('button',{name:'설계 원문 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 설계 의존 관계 작성',exact:true}).click();
 await page.getByLabel('의존하는 설계 항목',{exact:true}).selectOption(itemId);await page.getByLabel('의존 대상 설계 항목',{exact:true}).selectOption(regionId);await page.getByLabel('설계 의존 관계 이유',{exact:true}).fill('사용자 정의 설계 의존');
 await expect(page.getByRole('button',{name:'새 문서 작성',exact:true})).toBeDisabled();await page.getByRole('button',{name:'설계 의존 관계 저장',exact:true}).click();
 if(denied){await expect(page.getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'설계 의존 편집 닫기',exact:true}).click();await expect(page.getByRole('button',{name:'새 문서 작성',exact:true})).toBeEnabled();expect(f.writes).toHaveLength(1);}
 else{await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(page.getByRole('button',{name:'설계 의존 편집 닫기',exact:true})).toBeDisabled();await page.evaluate(()=>{location.hash='#/runs';});await page.getByRole('heading',{name:'아직 연결되지 않은 화면',exact:true}).waitFor();await page.evaluate(p=>{location.hash='#/projects/'+p+'/documents';},project);await page.getByRole('button',{name:'같은 설계 의존 명령 결과 확인',exact:true}).click();await expect(page.getByText('설계 의존 관계 저장 확인 · 실행/완료 판정 아님',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'설계 의존 편집 닫기',exact:true})).toBeEnabled();expect(f.writes).toHaveLength(2);expect(f.writes[0]).toEqual(f.writes[1]);}expect(f.unknown).toEqual([]);
});

