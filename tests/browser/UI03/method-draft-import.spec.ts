import {test,expect,type Page} from '@playwright/test';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
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
