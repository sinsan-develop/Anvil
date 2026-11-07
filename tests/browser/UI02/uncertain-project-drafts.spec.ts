import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
const uid='22222222-2222-4222-8222-222222222222',did='33333333-3333-4333-8333-333333333333',pid='44444444-4444-4444-8444-444444444444';
const ref={id:did,version:1,contentHash:'a'.repeat(64)},input={name:'사용자 프로젝트',purpose:'개발 주도권',desiredOutcome:'자료 보존',sourceMode:'EMPTY',methodologySelection:{kind:'CONFIRMED_REFERENCE',versionRef:ref},artifactRefs:[]};
async function fixture(page:Page,mode:string){
 const calls:any[]=[],unknown:string[]=[],errors:string[]=[];let reads=0;
 let firstRelease!:()=>void,secondRelease!:()=>void;
 const firstGate=new Promise<void>(resolve=>firstRelease=resolve),secondGate=new Promise<void>(resolve=>secondRelease=resolve),overlap=mode.startsWith('OVERLAP_'),creating=mode==='CREATE'||mode==='OVERLAP_CREATE';
 await page.addInitScript(()=>{const original=window.fetch;window.fetch=async(...args)=>{const response=await original(...args),json=response.json.bind(response);response.json=async()=>{const data=await json();if(data?.code==='PERMISSION_DENIED')(window as any).__denialParsed=true;return data;};return response;};});
 await page.route('**/api/v1/**',r=>{unknown.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.abort();});await installWorkspaceBundle(page);
 await page.route(/^https:\/\/localhost:3830\/\?draftId=/,async r=>r.fulfill({body:await readFile('apps/web/dist/index.html'),contentType:'text/html'}));
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,...input,version:1,createdAt:'2026-10-21T03:00:00Z',updatedAt:'2026-10-21T03:00:00Z',currentMethodologyRef:ref,baselineRef:null,readinessIssues:[],participation:'OWNER',viewerPermissions:['READ_PROJECT'],controlState:{actorId:uid,clientId:uid,generation:1,status:'HELD'}}}));
 const draft=(version:number,value:any)=>({draftId:did,version,step:1,input:value,editable:true,consumedProjectId:null,methodologyState:null});
 const submit=async(r:any)=>{
  const c=r.request().postDataJSON();calls.push(c);
  if(overlap&&calls.length===1){await firstGate;return r.fulfill({status:403,json:{code:'PERMISSION_DENIED'}});}
  if(overlap&&calls.length===2){await secondGate;return r.abort();}
  if(mode==='FIRST_REJECT')return r.fulfill({status:422,json:{code:'INPUT_INVALID'}});
  if(calls.length===1)return r.abort();
  if(calls.length===2)return r.fulfill({status:403,json:{code:'PERMISSION_DENIED'}});
  expect(c).toEqual(calls[0]);
  return creating?r.fulfill({json:{id:pid,name:input.name,purpose:input.purpose,desiredOutcome:input.desiredOutcome,version:1,currentMethodologyRef:ref,baselineRef:null,readinessIssues:[],participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:1,status:'HELD'}}}):r.fulfill({json:draft(mode==='POST'?1:2,mode==='POST'?{name:c.name,purpose:c.purpose,desiredOutcome:c.desiredOutcome,sourceMode:c.sourceMode,methodologySelection:c.methodologySelection,artifactRefs:c.artifactRefs}:c.input)});
 };
 await page.route('**/api/v1/project-drafts/'+did,r=>{if(r.request().method()==='GET'){reads++;return r.fulfill({json:draft(1,input)});}return submit(r);});
 await page.route('**/api/v1/project-drafts',submit);
 await page.route('**/api/v1/projects',submit);
 await page.route('**/api/v1/projects?*',r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:'2026-10-21T03:00:00Z'}}));
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.goto(mode==='POST'?'/#/projects/new':'/?draftId='+did+'#/projects/new');
 await expect(page.getByLabel('프로젝트 이름',{exact:true})).toHaveValue(mode==='POST'?'':input.name);
 return{calls,unknown,errors,get reads(){return reads;},firstRelease,secondRelease};
}
for(const mode of ['POST','PATCH','CREATE','RESTORE','FIRST_REJECT'])test('DRAFT_UNCERTAIN_'+mode+' 유실뒤권한거절은원명령을보존하고확실한첫거절만편집한다',async({page})=>{
 const f=await fixture(page,mode),title=page.getByLabel('프로젝트 이름',{exact:true});
 if(mode==='POST'){await title.fill(input.name);await page.getByLabel('왜 만드는가',{exact:true}).fill(input.purpose);await page.getByLabel('기대 결과',{exact:true}).fill(input.desiredOutcome);}
 else if(mode!=='CREATE')await title.fill('개정 입력 보존');
 await page.getByRole('button',{name:mode==='CREATE'?'저장 초안으로 프로젝트 생성':'중간 저장',exact:true}).click();
 if(mode==='FIRST_REJECT'){await expect(page.getByRole('button',{name:'중간 저장',exact:true})).toBeEnabled();await expect(title).toHaveJSProperty('readOnly',false);}
 else{
  const retry=()=>page.getByRole('button',{name:mode==='CREATE'?'같은 생성 명령 결과 확인':'저장 결과 다시 확인',exact:true});
  await expect(retry()).toBeEnabled();
  if(mode==='RESTORE'){await expect(page.getByRole('button',{name:'저장본 다시 조회',exact:true})).toBeDisabled();expect(f.reads).toBe(1);}
  else{
   await retry().click();await expect(retry()).toBeEnabled();await expect(title).toHaveJSProperty('readOnly',true);expect(f.calls).toHaveLength(2);expect(f.calls[1]).toEqual(f.calls[0]);
   await retry().click();
   if(mode==='CREATE')await expect(page.getByRole('region',{name:'생성된 프로젝트 원본',exact:true})).toContainText('프로젝트 원본 생성 확인');
   else await expect(page.getByRole('status')).toContainText('초안 버전 '+(mode==='POST'?1:2));
   expect(f.calls).toHaveLength(3);expect(f.calls[2]).toEqual(f.calls[0]);
  }
 }
 expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
for(const creating of [false,true])test('DRAFT_OVERLAP_'+(creating?'CREATE':'PATCH')+' 늦은첫거절은이탈복귀후재확인의원명령을해제하지않는다',async({page})=>{
 const f=await fixture(page,creating?'OVERLAP_CREATE':'OVERLAP_PATCH');
 if(!creating)await page.getByLabel('프로젝트 이름',{exact:true}).fill('중첩 입력 보존');
 await page.getByRole('button',{name:creating?'저장 초안으로 프로젝트 생성':'중간 저장',exact:true}).click();await expect.poll(()=>f.calls.length).toBe(1);
 await page.evaluate(()=>{location.hash='#/projects';});await expect(page.getByRole('region',{name:'프로젝트 생성 중간본',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{location.hash='#/projects/new';});
 const retry=()=>page.getByRole('button',{name:creating?'같은 생성 명령 결과 확인':'저장 결과 다시 확인',exact:true});
 await retry().click();await expect.poll(()=>f.calls.length).toBe(2);
 f.firstRelease();await expect.poll(()=>page.evaluate(()=>(window as any).__denialParsed)).toBe(true);
 await page.evaluate(()=>new Promise<void>(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);}));
 f.secondRelease();await expect(retry()).toBeEnabled();await expect(page.getByLabel('프로젝트 이름',{exact:true})).toHaveJSProperty('readOnly',true);
 await retry().click();
 if(creating)await expect(page.getByRole('region',{name:'생성된 프로젝트 원본',exact:true})).toBeVisible();
 else await expect(page.getByRole('status')).toContainText('초안 버전 2');
 expect(f.calls).toHaveLength(3);expect(f.calls[1]).toEqual(f.calls[0]);expect(f.calls[2]).toEqual(f.calls[0]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
