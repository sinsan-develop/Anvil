import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {FormVersion,FormSummary} from '../../../apps/web/src/features/methodologies/forms-api.ts';
import type {MethodCommand} from '../../../apps/web/src/features/methodology-editor/common-api.ts';

const uid='a6f30328-0000-4000-8000-000000000001',fid='a6f30328-0000-4000-8000-000000000002',copyId='a6f30328-0000-4000-8000-000000000003',operationId='a6f30328-0000-4000-8000-000000000004',standardId='a6f30328-0000-4000-8000-000000000005',at='2026-10-27T00:00:00.000Z';
function originalVersion(version:number):FormVersion{
 const old=version===1,content=old?'과거 작성 기준 원문':'현재 작성 기준 원문',standardRef={id:standardId,version,contentHash:contentHash(content)};
 const definition:FormVersion['definition']={formCode:old?'HISTORY01':'CURRENT02',name:old?'과거 공통 양식 v1':'현재 공통 양식 v2',purpose:old?'과거 복사 전용 목적':'현재 원본 목적',scope:'USER_COMMON',authorRole:old?'과거 작성자':'현재 작성자',reviewerRole:'검토자',confirmerRole:'확정자',requiredInputs:[old?'과거 입력':'현재 입력'],authoringStandardRef:standardRef,items:[{itemId:'STABLE-ITEM',title:old?'과거 항목':'현재 항목',required:true,repeated:false,valueType:'TEXT',fields:[],authoringRules:[old?'과거 작성 규칙':'현재 작성 규칙'],reviewCriteria:['실제 내용을 검토한다']}]};
 return{ref:{id:fid,version,contentHash:contentHash(canonicalJson(definition))},definition,authoringStandard:{ref:standardRef,content},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'},confirmation:null,contentReviews:[],contentReviewCriteria:{criteriaVersion:1,items:[{criterionId:'QA-C1',title:'양식 실제 내용 검토'}]}};
}
const summary=(v:FormVersion):FormSummary=>({ref:v.ref,formCode:v.definition.formCode,name:v.definition.name,scope:'USER_COMMON'});
async function fixture(page:Page){
 const dist=process.env.ANVIL_UI03_HISTORICAL_FORM_COPY_DIST;
 if(dist!=='D:/tmp/anvil-v3-stage-b/ui03-historical-form-copy-20261027-01/dist')throw Error('UI03_HISTORICAL_FORM_COPY_REGISTERED_DIST_REQUIRED');
 const current=originalVersion(2),historical=originalVersion(1),versions=new Map([[1,historical],[2,current]]),originalSnapshot=structuredClone({current,historical}),copies=new Map<number,FormVersion>(),writes:MethodCommand[]=[],reads:string[]=[],errors:string[]=[],unknown:string[]=[],offOrigin:string[]=[],sentCsrf:string[]=[];
 const receipts=new Map<string,unknown>();let mode='NORMAL',csrf='A'.repeat(43),copyGetFailed=false,currentHead=current,releaseComparison:(()=>void)|null=null,releaseCopy:(()=>void)|null=null;
 page.on('pageerror',error=>errors.push(error.name));page.on('request',request=>{if(new URL(request.url()).origin!=='https://localhost:3830')offOrigin.push(new URL(request.url()).origin);});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='https://localhost:3830'?route.fallback():route.abort('blockedbyclient'));
 await page.route('https://localhost:3830/**',async route=>{const pathname=new URL(route.request().url()).pathname;if(pathname.startsWith('/api/'))return route.fallback();if(route.request().method()!=='GET'||pathname!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(pathname))return route.abort('blockedbyclient');const name=pathname==='/'?'index.html':pathname.slice(1);return route.fulfill({body:await readFile(new URL(name,pathToFileURL(dist+'/'))),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});});
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),pathname=new URL(req.url()).pathname;
  if(pathname==='/api/v1/session')return route.fulfill({json:{user:{id:uid,displayName:'과거 양식 복사 QA'},clientId:uid,csrfToken:csrf}});
  if(pathname==='/api/v1/auth/reauthenticate'){csrf='D'.repeat(43);return route.fulfill({json:{user:{id:uid,displayName:'과거 양식 복사 QA'},clientId:uid,csrfToken:csrf,reauthUntil:'2099-01-01T00:00:00.000Z'}});}
  if(pathname==='/api/v1/auth/setup')return route.fulfill({json:{setupRequired:false,policyVersion:1}});
  if(pathname==='/api/v1/methodologies')return route.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null}});
  if(pathname==='/api/v1/forms')return route.fulfill({json:{items:[summary(currentHead),...(copies.size?[summary(copies.get(Math.max(...copies.keys()))!)]:[])],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null}});
  const versionPath=/^\/api\/v1\/forms\/([a-f0-9-]+)\/versions\/([1-9][0-9]*)$/.exec(pathname);
  if(req.method()==='GET'&&versionPath){
   reads.push(pathname);const id=versionPath[1],n=Number(versionPath[2]),value=id===fid?versions.get(n):id===copyId?copies.get(n):null;
   if(id===fid&&n===1){if(mode==='DELAY_COMPARE')await new Promise<void>(resolve=>{releaseComparison=resolve;});if(mode==='DENY')return route.fulfill({status:403,json:{code:'ACCESS_DENIED'}});if(mode==='HASH')return route.fulfill({json:{...historical,ref:{...historical.ref,contentHash:'0'.repeat(64)}}});}
   if(id===copyId&&n===1&&mode==='COPY_GET_FAILURE'&&!copyGetFailed){copyGetFailed=true;return route.fulfill({status:503,json:{code:'SERVICE_UNAVAILABLE'}});}
   return value?route.fulfill({json:value}):route.fulfill({status:404,json:{code:'NOT_FOUND'}});
  }
  if(pathname==='/api/v1/user-common/commands'&&req.method()==='POST'){
   const command=req.postDataJSON() as MethodCommand;writes.push(command);const header=await req.headerValue('x-anvil-csrf');sentCsrf.push(header??'');expect(header).toBe(csrf);
   if(receipts.has(command.commandId))return route.fulfill({json:receipts.get(command.commandId)});
   if(command.operation==='recordContentReview'&&mode==='REVIEW_LOSS')return route.abort();
   let value:FormVersion;
   if(command.operation==='copyForm'){
    expect(command.targetId).toBe(null);expect(command.expectedVersion).toBe(0);expect(command.payload.scope).toBe('USER_COMMON');
    const source=versions.get((command.payload.sourceRef as FormVersion['ref']).version)!;expect(command.payload.sourceRef).toEqual(source.ref);
    const definition={...structuredClone(source.definition),name:String(command.payload.name)};
    value={...structuredClone(source),ref:{id:copyId,version:1,contentHash:contentHash(canonicalJson(definition))},definition,confirmation:null,contentReviews:[],validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
   }else if(command.operation==='saveFormDraft'){
    const original=command.targetId===fid;expect(command.targetId).toBe(original?fid:copyId);expect(command.expectedVersion).toBe(original?2:1);
    const definition=structuredClone(command.payload.definition) as FormVersion['definition'];expect(definition.scope).toBe('USER_COMMON');
    value={...structuredClone(original?current:copies.get(1)!),ref:{id:original?fid:copyId,version:original?3:2,contentHash:contentHash(canonicalJson(definition))},definition,confirmation:null};
   }else{unknown.push('POST '+command.operation);return route.fulfill({status:422,json:{code:'UNEXPECTED_QA_OPERATION'}});}
   if(value.ref.id===copyId)copies.set(value.ref.version,value);else{versions.set(value.ref.version,value);currentHead=value;}
   const receipt={scopeKind:'USER_COMMON',ownerUserId:uid,commandId:command.commandId,status:'APPLIED',operationId,targetId:value.ref.id,version:value.ref.version,data:{ref:value.ref,status:'DRAFT'},serverReceivedAt:at};receipts.set(command.commandId,receipt);
   if(mode==='LOSS')return route.abort();if(mode==='LATE_COPY'&&command.operation==='copyForm')await new Promise<void>(resolve=>{releaseCopy=resolve;});return route.fulfill({json:receipt});
  }
  unknown.push(req.method()+' '+pathname);return route.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});
 });
 await page.goto('/#/methodologies');await expect(page.getByRole('article',{name:'선택 양식 원본',exact:true})).toBeVisible();
 return{current,historical,originalSnapshot,copies,writes,reads,errors,unknown,offOrigin,sentCsrf,setMode:(next:string)=>{mode=next;},releaseComparison:()=>releaseComparison?.(),releaseCopy:()=>releaseCopy?.()};
}
const comparison=(page:Page)=>page.getByRole('region',{name:'저장 양식 버전 비교',exact:true});
const editor=(page:Page)=>page.getByRole('region',{name:'내 공통 양식 작업',exact:true});
const selectButton=(page:Page)=>comparison(page).getByRole('button',{name:'이 버전을 복사 원본으로 선택',exact:true});
const saved=(page:Page,n:number)=>editor(page).getByText(`양식 서버 저장·재조회 확인 · 버전 ${n}`,{exact:true});
function noUnexpected(f:Awaited<ReturnType<typeof fixture>>){expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);expect(f.offOrigin).toEqual([]);}
async function compareHistorical(page:Page){await comparison(page).getByRole('button',{name:'저장 양식 비교',exact:true}).click();await expect(comparison(page).getByLabel('비교 양식 차이 구간',{exact:true})).toContainText('과거 복사 전용 목적');}
async function selectHistorical(page:Page){await compareHistorical(page);await selectButton(page).click();await expect(editor(page)).toContainText('복사 전용 과거 원본: v1');}
async function copyHistorical(page:Page,name:string){await editor(page).getByLabel('양식 복사본 이름',{exact:true}).fill(name);await editor(page).getByRole('button',{name:'내 공통 양식으로 복사',exact:true}).click();}

test('과거 공통 양식 v1을 선택 POST0 뒤 새 ID/v1로 복사하고 편집·save/v2를 재조회한다',async({page})=>{
 const f=await fixture(page),work=editor(page);await compareHistorical(page);
 // 기존 App의 과거 조회·무결성 비교 성공 다음 버튼 부재가 최초 RED여야 한다.
 await expect(selectButton(page)).toBeVisible();await selectButton(page).click();expect(f.writes).toHaveLength(0);
 await expect(page.getByRole('article',{name:'선택 양식 원본',exact:true})).toContainText('현재 공통 양식 v2');
 await copyHistorical(page,'과거 v1에서 새 공통 양식');await expect(saved(page,1)).toBeVisible();
 await expect(work.getByLabel('양식 코드',{exact:true})).toHaveValue('HISTORY01');await expect(work.getByLabel('양식 목적',{exact:true})).toHaveValue('과거 복사 전용 목적');await expect(work.getByLabel('양식 항목 제목',{exact:true})).toHaveValue('과거 항목');
 expect(f.writes).toHaveLength(1);expect(f.writes[0]!.payload.sourceRef).toEqual(f.historical.ref);expect(f.reads).toContain(`/api/v1/forms/${copyId}/versions/1`);
 expect(f.copies.get(1)!.definition).toEqual({...f.historical.definition,name:'과거 v1에서 새 공통 양식'});expect(f.copies.get(1)!.authoringStandard).toEqual(f.historical.authoringStandard);
 await work.getByLabel('양식 이름',{exact:true}).fill('사용자가 개정한 과거 사본');await work.getByLabel('양식 항목 제목',{exact:true}).fill('사용자 편집 항목');await work.getByLabel('양식 개정 이유',{exact:true}).fill('과거 원본 복사 후 별도 개정');await work.getByRole('button',{name:'공통 양식 새 버전 저장',exact:true}).click();
 await expect(saved(page,2)).toBeVisible();await expect(work.getByLabel('양식 항목 제목',{exact:true})).toHaveValue('사용자 편집 항목');
 expect(f.writes.map(c=>c.operation)).toEqual(['copyForm','saveFormDraft']);expect(f.writes[1]!.targetId).toBe(copyId);expect(f.writes[1]!.expectedVersion).toBe(1);expect(f.reads).toContain(`/api/v1/forms/${copyId}/versions/2`);expect(f.copies.get(1)!.definition.items).toEqual(f.historical.definition.items);expect(f.copies.get(2)!.definition.authoringStandardRef).toEqual(f.historical.authoringStandard.ref);expect({current:f.current,historical:f.historical}).toEqual(f.originalSnapshot);noUnexpected(f);
});

test('과거 선택은 현재 v2의 편집·저장 source를 바꾸지 않는다',async({page})=>{
 const f=await fixture(page),work=editor(page);await selectHistorical(page);await work.getByRole('button',{name:'이 공통 양식 편집',exact:true}).click();await expect(work.getByLabel('양식 코드',{exact:true})).toHaveValue('CURRENT02');await expect(work.getByLabel('양식 항목 제목',{exact:true})).toHaveValue('현재 항목');await work.getByLabel('양식 이름',{exact:true}).fill('현재 v2만 별도 개정');await work.getByLabel('양식 개정 이유',{exact:true}).fill('과거 선택과 분리된 현재본 편집');await work.getByRole('button',{name:'공통 양식 새 버전 저장',exact:true}).click();await expect(saved(page,3)).toBeVisible();expect(f.writes).toHaveLength(1);expect(f.writes[0]!.operation).toBe('saveFormDraft');expect(f.writes[0]!.targetId).toBe(fid);expect(f.writes[0]!.expectedVersion).toBe(2);expect(f.copies.size).toBe(0);noUnexpected(f);
});

test('과거 선택은 미저장 편집·검토를 유지하고 교체 거절은 POST0이다',async({page})=>{
 const f=await fixture(page),work=editor(page),review=page.getByRole('region',{name:'양식 내용 검토·확정',exact:true});await work.getByRole('button',{name:'이 공통 양식 편집',exact:true}).click();await work.getByLabel('양식 이름',{exact:true}).fill('보존할 현재 양식');await review.getByRole('button',{name:'이 양식 내용 검토 시작',exact:true}).click();await review.getByLabel('내용 검토 종합 이유',{exact:true}).fill('보존할 검토 이유');await selectHistorical(page);await expect(work.getByLabel('양식 이름',{exact:true})).toHaveValue('보존할 현재 양식');await expect(review.getByLabel('내용 검토 종합 이유',{exact:true})).toHaveValue('보존할 검토 이유');page.once('dialog',dialog=>dialog.dismiss());await copyHistorical(page,'교체 거절 사본');expect(f.writes).toHaveLength(0);await expect(work.getByLabel('양식 이름',{exact:true})).toHaveValue('보존할 현재 양식');await expect(review.getByLabel('내용 검토 종합 이유',{exact:true})).toHaveValue('보존할 검토 이유');noUnexpected(f);
});

test('비교 입력 변경과 명시 해제는 과거 선택을 폐기한다',async({page})=>{
 const f=await fixture(page),work=editor(page);await selectHistorical(page);await comparison(page).getByLabel('비교할 양식 버전',{exact:true}).fill('2');await expect(work).not.toContainText('복사 전용 과거 원본: v1');await expect(selectButton(page)).toHaveCount(0);await comparison(page).getByLabel('비교할 양식 버전',{exact:true}).fill('1');await selectHistorical(page);await work.getByRole('button',{name:'과거 복사 원본 해제',exact:true}).click();await expect(work).not.toContainText('복사 전용 과거 원본: v1');expect(f.writes).toHaveLength(0);noUnexpected(f);
});
for(const mode of ['HASH','DENY'])test(`과거 ${mode} 응답은 이전 선택과 과거 복사 동작을 회수한다`,async({page})=>{
 const f=await fixture(page);await selectHistorical(page);f.setMode(mode);await comparison(page).getByRole('button',{name:'저장 양식 비교',exact:true}).click();await expect(page.getByRole('alert').first()).toContainText(mode==='HASH'?'RESPONSE_INVALID':'ACCESS_DENIED');await expect(selectButton(page)).toHaveCount(0);await expect(editor(page)).not.toContainText('복사 전용 과거 원본: v1');expect(f.writes).toHaveLength(0);noUnexpected(f);
});

test('늦은 과거 비교 응답은 현재 원본 재조회 ABA 뒤 선택으로 부활하지 않는다',async({page})=>{
 const f=await fixture(page);f.setMode('DELAY_COMPARE');const requested=page.waitForRequest(r=>new URL(r.url()).pathname===`/api/v1/forms/${fid}/versions/1`);await comparison(page).getByRole('button',{name:'저장 양식 비교',exact:true}).click();await requested;await page.getByRole('button',{name:'양식 다시 조회',exact:true}).click();await expect(comparison(page).getByRole('button',{name:'저장 양식 비교',exact:true})).toBeEnabled();f.setMode('NORMAL');const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/forms/${fid}/versions/1`);f.releaseComparison();await response;await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));await expect(selectButton(page)).toHaveCount(0);expect(f.writes).toHaveLength(0);noUnexpected(f);
});

for(const mode of ['LOSS','COPY_GET_FAILURE'])test(`${mode}: 복사 응답 유실과 수락 후 첫 GET 실패를 원명령으로 각각 재확인한다`,async({page})=>{
 const f=await fixture(page),work=editor(page);await selectHistorical(page);f.setMode(mode);await copyHistorical(page,'원명령 보존 과거 사본');await expect(work.getByRole('button',{name:'같은 양식 명령 결과 확인',exact:true})).toBeVisible();await expect(saved(page,1)).toHaveCount(0);expect(f.writes).toHaveLength(1);expect(f.copies.size).toBe(1);expect(f.reads.filter(p=>p===`/api/v1/forms/${copyId}/versions/1`)).toHaveLength(mode==='LOSS'?0:1);
 await expect(work.getByRole('button',{name:'과거 복사 원본 해제',exact:true})).toBeDisabled();await expect(work.getByRole('button',{name:'내 공통 양식으로 복사',exact:true})).toBeDisabled();await expect(selectButton(page)).toBeDisabled();await page.getByRole('button',{name:'양식 다시 조회',exact:true}).click();await expect(comparison(page).getByRole('button',{name:'저장 양식 비교',exact:true})).toBeEnabled();await expect(work.getByRole('button',{name:'같은 양식 명령 결과 확인',exact:true})).toBeVisible();f.setMode('NORMAL');await work.getByRole('button',{name:'같은 양식 명령 결과 확인',exact:true}).click();await expect(saved(page,1)).toBeVisible();expect(f.writes).toHaveLength(2);expect(f.writes[1]).toEqual(f.writes[0]);expect(f.writes[1]!.payload.sourceRef).toEqual(f.historical.ref);expect(f.writes[1]!.payload.name).toBe('원명령 보존 과거 사본');expect(f.copies.size).toBe(1);await expect(work.getByLabel('양식 코드',{exact:true})).toHaveValue('HISTORY01');noUnexpected(f);
});

test('재인증 왕복 뒤 늦은 복사 성공은 새 문맥을 덮지 않고 원명령 재확인만 허용한다',async({page})=>{
 const f=await fixture(page);await selectHistorical(page);f.setMode('LATE_COPY');const requested=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/v1/user-common/commands');await copyHistorical(page,'재인증 원명령 과거 사본');await requested;await page.evaluate(()=>{location.hash='#/settings';});await page.getByLabel('재인증 비밀번호',{exact:true}).fill('synthetic reauthentication');await page.getByRole('button',{name:'재인증',exact:true}).click();await expect(page.getByRole('region',{name:'로그인 보안',exact:true})).toContainText('재인증했습니다');await page.evaluate(()=>{location.hash='#/methodologies';});await expect(editor(page).getByRole('button',{name:'같은 양식 명령 결과 확인',exact:true})).toBeVisible();const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/user-common/commands');f.releaseCopy();await response;await expect(saved(page,1)).toHaveCount(0);f.setMode('NORMAL');await editor(page).getByRole('button',{name:'같은 양식 명령 결과 확인',exact:true}).click();await expect(saved(page,1)).toBeVisible();expect(f.writes).toHaveLength(2);expect(f.writes[1]).toEqual(f.writes[0]);expect(f.sentCsrf).toEqual(['A'.repeat(43),'D'.repeat(43)]);noUnexpected(f);
});

test('과거 선택을 닫고 다시 열면 선택은 부활하지 않고 현재본 복사·신규 작성이 유지된다',async({page})=>{
 const f=await fixture(page);await selectHistorical(page);await page.evaluate(()=>{location.hash='#/settings';});await expect(comparison(page)).toHaveCount(0);await page.evaluate(()=>{location.hash='#/methodologies';});await expect(comparison(page)).toBeVisible();await expect(editor(page)).not.toContainText('복사 전용 과거 원본: v1');await copyHistorical(page,'현재본 회귀 사본');await expect(saved(page,1)).toBeVisible();expect(f.writes[0]!.payload.sourceRef).toEqual(f.current.ref);await expect(editor(page).getByLabel('양식 코드',{exact:true})).toHaveValue('CURRENT02');await editor(page).getByRole('button',{name:'새 양식 작성',exact:true}).click();await expect(editor(page).getByLabel('양식 코드',{exact:true})).toHaveValue('USER01');expect(f.writes).toHaveLength(1);noUnexpected(f);
});

test('검토 원명령 미확인 중에는 과거 선택·복사로 pending을 교체하지 않는다',async({page})=>{
 const f=await fixture(page),review=page.getByRole('region',{name:'양식 내용 검토·확정',exact:true});await compareHistorical(page);await review.getByRole('button',{name:'이 양식 내용 검토 시작',exact:true}).click();await review.getByLabel('QA-C1 검토 이유',{exact:true}).fill('보존할 항목 검토');await review.getByLabel('내용 검토 종합 이유',{exact:true}).fill('보존할 검토 원명령');f.setMode('REVIEW_LOSS');await review.getByRole('button',{name:'내용 검토 기록',exact:true}).click();await expect(review.getByRole('button',{name:'같은 검토·확정 명령 결과 확인',exact:true})).toBeVisible();await expect(selectButton(page)).toBeDisabled();await expect(editor(page).getByRole('button',{name:'내 공통 양식으로 복사',exact:true})).toBeDisabled();expect(f.writes).toHaveLength(1);expect(f.writes[0]!.operation).toBe('recordContentReview');await expect(review.getByLabel('내용 검토 종합 이유',{exact:true})).toHaveValue('보존할 검토 원명령');noUnexpected(f);
});