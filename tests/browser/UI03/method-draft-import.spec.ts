import {test,expect,type Page} from '@playwright/test';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readFile} from 'node:fs/promises';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
const formCatalog=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
const user='22222222-2222-4222-8222-222222222222',mid='33333333-3333-4333-8333-333333333333',at='2026-10-21T01:00:00Z';
const payload=()=>({name:'가져온 절차',purpose:'사용자 정의 절차 재사용',scope:'USER_COMMON',reason:'합의한 방법론 가져오기',graph:{nodes:[{nodeId:'DEFINE',name:'사용자 요구 정의',purpose:'왜 개발하는지 합의',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['요구 정의'],excluded:['실행']},completionCriteria:['요구 확인'],approvalBoundary:['사용자 확인'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['판단 이유']}],edges:[],entryNodeId:'DEFINE',terminalNodeIds:['DEFINE']}});
async function setup(page:Page,lost=false){
 const commands:any[]=[],unknown:string[]=[],errors:string[]=[];let saved:any=null,receipt:any=null;
 await page.route('**/api/v1/**',r=>{unknown.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:user,displayName:'QA'},clientId:user,csrfToken:'C'.repeat(43)}}));
 await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null}}));
 await page.route(/\/api\/v1\/forms(?:\?.*)?$/,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null}}));
 await page.route('**/api/v1/user-common/commands',r=>{
  const c=r.request().postDataJSON();commands.push(c);expect(c.operation).toBe('saveMethodologyDraft');expect(c.targetId).toBe(null);expect(c.expectedVersion).toBe(0);
  if(receipt){expect(c).toEqual(commands[0]);return r.fulfill({json:receipt});}
  const ref={id:mid,version:1,contentHash:contentHash(canonicalJson(c.payload.graph))};
  saved={ref,name:c.payload.name,purpose:c.payload.purpose,scope:'USER_COMMON',systemCode:null,graph:c.payload.graph,confirmation:null,validation:{validForConfirmation:false,issues:[]},runtimeReadiness:'PROJECT_BINDINGS_REQUIRED'};
  receipt={scopeKind:'USER_COMMON',ownerUserId:user,commandId:c.commandId,status:'APPLIED',operationId:mid,targetId:mid,version:1,data:{ref,status:'DRAFT'},serverReceivedAt:at};
  return lost?r.abort():r.fulfill({json:receipt});
 });
 await page.route('**/api/v1/methodologies/'+mid+'/versions/1',r=>r.fulfill({json:saved}));
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.goto('/#/methodologies');await expect(page.getByText('조회 가능한 방법론이 없습니다.',{exact:true})).toBeVisible();
 return{commands,unknown,errors};
}
const file=(value:any)=>({name:'method.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
for(const mode of ['NORMAL','SENSITIVE','LOSS']as const)test('METHOD_EXPORT_'+mode+' 초안을 파일로 내려받아 새 초안으로 가져오고 별도 저장한다',async({page})=>{
 await page.addInitScript(()=>{const revoke=URL.revokeObjectURL.bind(URL);(globalThis as any).__methodExportRevoked=[];URL.revokeObjectURL=url=>{(globalThis as any).__methodExportRevoked.push(url);revoke(url);};});
 const f=await setup(page,mode==='LOSS'),draft=payload(),input=page.getByLabel('방법론 초안 JSON 가져오기',{exact:true});
 await input.setInputFiles(file(draft));await expect(page.getByLabel('방법론 이름',{exact:true})).toHaveValue(draft.name);
 const prepare=page.getByRole('button',{name:'방법론 초안 파일 준비',exact:true}),link=page.getByRole('link',{name:'방법론 초안 JSON 내려받기',exact:true});
 if(mode==='LOSS'){
  await page.getByRole('button',{name:'공통본 새 버전 저장',exact:true}).click();await expect(page.getByRole('button',{name:'같은 명령 결과 다시 확인',exact:true})).toBeVisible();await expect(prepare).toBeDisabled();await expect(link).toHaveCount(0);expect(f.commands).toHaveLength(1);
 }else if(mode==='SENSITIVE'){
  await page.getByLabel('개정 이유',{exact:true}).fill('password=synthetic-export-marker');await prepare.click();await expect(page.getByRole('alert')).toContainText('METHOD_DRAFT_FILE_SENSITIVE');await expect(link).toHaveCount(0);await expect(page.getByLabel('개정 이유',{exact:true})).toHaveValue('password=synthetic-export-marker');expect(f.commands).toEqual([]);
 }else{
  await prepare.click();await expect(link).toBeVisible();const ready=page.waitForEvent('download');await link.click();const download=await ready;expect(download.suggestedFilename()).toBe('anvil-method-draft.json');const stream=await download.createReadStream();if(!stream)throw Error('QA_DOWNLOAD_STREAM_MISSING');const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks);expect(JSON.parse(bytes.toString('utf8'))).toEqual(draft);expect(f.commands).toEqual([]);
  const previousUrl=await link.getAttribute('href');await page.getByLabel('방법론 이름',{exact:true}).fill('내보낸 뒤 수정');await expect(link).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>(globalThis as any).__methodExportRevoked)).toContain(previousUrl);page.once('dialog',dialog=>dialog.accept());await input.setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:bytes});await expect(page.getByLabel('방법론 이름',{exact:true})).toHaveValue(draft.name);await page.getByRole('button',{name:'공통본 새 버전 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('서버 저장·재조회 확인');expect(f.commands).toHaveLength(1);expect(f.commands[0].payload).toEqual(draft);
 }
 expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
for(const mode of ['NORMAL','DENIED','MISMATCH','LATE','LOSS','TAMPER_DEFINITION','TAMPER_STANDARD']as const)test('DRAFT_FORM_ORIGINAL_'+mode+' 작성중인 단계 문서의 정확 양식만 명시 조회하고 입력/저장 명령은 보존한다',async({page})=>{
 await page.addInitScript(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(...args)=>{const result=await digest(...args);(globalThis as any).__draftFormDigest=((globalThis as any).__draftFormDigest??0)+1;return result;};const f=globalThis.fetch;globalThis.fetch=async(...args)=>{const response=await f(...args);if(String(args[0]).includes('/forms/')){const json=response.json.bind(response);response.json=async()=>{const value=await json();(globalThis as any).__draftFormRead=((globalThis as any).__draftFormRead??0)+1;return value;};}return response;};});
 const f=await setup(page,mode==='LOSS'),draft=payload(),form=formCatalog.forms[1]!,other=formCatalog.forms[3]!,first=draft.graph.nodes[0]!;
 (first as any).outputs=[{itemId:'DESIGN',formRef:form.ref,required:true,reviewCriteria:['설계 검수']}];draft.graph.nodes.push({...structuredClone(first),nodeId:'PLAN',name:'계획 작성',outputs:[{itemId:'PLAN_DOC',formRef:other.ref,required:true,reviewCriteria:['계획 검수']}]} as any);
 const reads:string[]=[];let release=()=>{};const gate=new Promise<void>(r=>release=r);
 for(const target of [form,other])await page.route(`**/api/v1/forms/${target.ref.id}/versions/${target.ref.version}`,async r=>{reads.push(r.request().url());if(mode==='LATE'&&target===form)await gate;if(mode==='DENIED')return r.fulfill({status:403,json:{code:'DRAFT_PINNED_FORM_DENIED'}});const response={...target,definition:mode==='TAMPER_DEFINITION'?{...target.definition,purpose:'보이면 안 되는 변조 정의'}:target.definition,ref:mode==='MISMATCH'?{...target.ref,version:target.ref.version+1}:target.ref,authoringStandard:{ref:formCatalog.standard.ref,content:mode==='TAMPER_STANDARD'?'보이면 안 되는 변조 기준':formCatalog.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};return r.fulfill({json:response});});
 await page.getByLabel('방법론 초안 JSON 가져오기',{exact:true}).setInputFiles(file(draft));await expect(page.getByLabel('단계 이름 편집',{exact:true})).toHaveValue('사용자 요구 정의');await page.getByText('단계의 입력·산출 문서 양식',{exact:true}).click();expect(reads).toHaveLength(0);
 const area=page.getByRole('region',{name:'산출 문서 1 고정 양식 확인',exact:true}),original=area.getByRole('region',{name:'고정 양식 원문',exact:true});await area.getByRole('button',{name:'고정 양식 원문 보기',exact:true}).click();
 if(mode==='LATE'){await expect.poll(()=>reads.length).toBe(1);const before=await page.evaluate(()=>(globalThis as any).__draftFormDigest??0);await page.getByRole('button',{name:'계획 작성 편집',exact:true}).click();release();await expect.poll(()=>page.evaluate(()=>(globalThis as any).__draftFormRead??0)).toBe(1);await expect.poll(()=>page.evaluate(()=>(globalThis as any).__draftFormDigest??0)).toBe(before+2);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>r())));await expect(original).toHaveCount(0);await expect(page.getByLabel('단계 이름 편집',{exact:true})).toHaveValue('계획 작성');expect(reads).toHaveLength(1);await area.getByRole('button',{name:'고정 양식 원문 보기',exact:true}).click();await expect(original).toContainText('AF04');}
 else if(mode==='DENIED'||mode==='MISMATCH'||mode.startsWith('TAMPER_')){await expect(area.getByRole('alert')).toContainText(mode==='DENIED'?'DRAFT_PINNED_FORM_DENIED':'RESPONSE_INVALID');await expect(original).toHaveCount(0);await expect(page.getByText(/보이면 안 되는 변조/)).toHaveCount(0);}
 else{await expect(original).toContainText(form.definition.items[0]!.title);await original.getByText('이 양식에 고정된 문서 작성 공통 기준',{exact:true}).click();expect(await original.locator('pre').textContent()).toBe(formCatalog.standard.body.toString('utf8'));await area.getByRole('button',{name:'양식 원문 닫기',exact:true}).click();await expect(original).toHaveCount(0);if(mode==='LOSS'){await area.getByRole('button',{name:'고정 양식 원문 보기',exact:true}).click();await expect(original).toBeVisible();}await page.getByRole('button',{name:'공통본 새 버전 저장',exact:true}).click();if(mode==='LOSS'){await expect(page.getByRole('button',{name:'같은 명령 결과 다시 확인',exact:true})).toBeVisible();await expect(area).toHaveCount(0);await page.getByRole('button',{name:'같은 명령 결과 다시 확인',exact:true}).click();}await expect(page.getByRole('status')).toContainText('서버 저장·재조회 확인');expect(f.commands).toHaveLength(mode==='LOSS'?2:1);if(mode==='LOSS')expect(f.commands[1]).toEqual(f.commands[0]);expect(f.commands[0].payload).toEqual(draft);}
 if(mode!=='NORMAL'&&mode!=='LOSS')expect(f.commands).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
for(const mode of ['NORMAL','LOSS','INVALID','CANCEL'] as const)test('METHOD_IMPORT_'+mode+' 가져오기→편집→별도저장/재조회와 미확인 명령 보존',async({page})=>{
 const f=await setup(page,mode==='LOSS'),input=page.getByLabel('방법론 초안 JSON 가져오기',{exact:true});
 await input.setInputFiles(file(payload()));await expect(page.getByRole('textbox',{name:'방법론 이름',exact:true})).toHaveValue('가져온 절차');await expect(page.getByRole('textbox',{name:'단계 이름 편집',exact:true})).toHaveValue('사용자 요구 정의');expect(f.commands).toEqual([]);
 await page.getByRole('textbox',{name:'방법론 이름',exact:true}).fill('수정한 가져오기');
 if(mode==='CANCEL'){
  page.once('dialog',dialog=>dialog.dismiss());await input.setInputFiles(file({...payload(),name:'교체할 절차'}));
  await expect(page.getByRole('status',{name:''})).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'방법론 이름',exact:true})).toHaveValue('수정한 가져오기');expect(f.commands).toEqual([]);
 }else if(mode==='INVALID'){
  await input.setInputFiles(file({...payload(),scope:'PROJECT'}));
  await expect(page.getByRole('alert')).toContainText('METHOD_DRAFT_FILE_INVALID');
  await expect(page.getByRole('textbox',{name:'방법론 이름',exact:true})).toHaveValue('수정한 가져오기');expect(f.commands).toEqual([]);
 }else{
  await page.getByRole('button',{name:'공통본 새 버전 저장',exact:true}).click();
  if(mode==='LOSS'){
   await expect(page.getByText('저장 결과가 아직 확인되지 않았습니다. 새 명령을 만들지 않고 같은 명령으로 결과를 확인하세요.',{exact:true})).toBeVisible();
   await expect(input).toBeDisabled();await page.getByRole('button',{name:'같은 명령 결과 다시 확인',exact:true}).click();
  }
  await expect(page.getByRole('status')).toContainText('서버 저장·재조회 확인');
  expect(f.commands).toHaveLength(mode==='LOSS'?2:1);expect(f.commands[0].payload).toEqual({...payload(),name:'수정한 가져오기'});
 }
 expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
