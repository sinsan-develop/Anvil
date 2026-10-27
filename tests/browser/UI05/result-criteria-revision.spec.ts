import {test,expect,type Page,type Request as BrowserRequest} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {criteriaFixture,criteriaHash,criteriaId} from '../../unit/FN12/result-criteria-fixture.ts';
import {resultFixture} from '../../unit/UI05/result-view-fixture.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';
const root=process.env.ANVIL_UI05_RESULT_CRITERIA_REVISION_DIST;
if(root!=='D:/tmp/anvil-v3-stage-b/ui05-result-criteria-revision-20261027-01/dist')throw Error('RESULT_CRITERIA_REVISION_QA_PATH_INVALID');
async function installWorkspaceBundle(page:Page){
 const files=new Map<string,{body:Buffer;contentType:string}>();files.set('/',{body:await readFile(root+'/index.html'),contentType:'text/html'});
 for(const name of await readdir(root+'/assets')){if(!/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(name))throw Error('RESULT_CRITERIA_REVISION_QA_ASSET_INVALID');files.set('/assets/'+name,{body:await readFile(root+'/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':'text/css'});}
 await page.route(/^https:\/\/localhost:3830\/(?:$|assets\/)/,r=>{const f=files.get(new URL(r.request().url()).pathname);return r.request().method()==='GET'&&f?r.fulfill({status:200,...f}):r.abort();});
}
const flags={registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};
function projection(assignment:any,input:any){return{snapshot:{assignmentRef:input.assignmentRef,baselineRefs:assignment.snapshot.definition.baselineRefs,items:input.items.map((i:any)=>({criterionId:i.criterionId,testId:i.testId,kind:i.kind,environmentRef:i.environmentRef,required:true}))},sourceBindings:input.items.map((i:any)=>({criterionId:i.criterionId,sources:i.sources}))};}
for(const mode of ['FLOW','ORIGINAL_DENIED','ORIGINAL_INVALID','CONTROL_CLIENT','CONTROL_OWNER','SELECTION_ABA','LOST_POST','GET_FAIL','RECEIPT_MISMATCH','LEAVE_INFLIGHT'])test('RESULT_CRITERIA_REVISION_'+mode,async({page})=>{
 const f=criteriaFixture(),pid=f.assignment.projectId,aid=f.assignment.ref.id,d=f.d,actor=criteriaId(6),clientId=criteriaId(8),at='2026-10-27T10:02:00.000Z';
 const ds={definition:d,reason:'내용 확정',previousRef:null,basis:{planRef:d.taskRef.planRef,applicationRef:d.taskRef.applicationRef,designRef:d.baselineRefs[0],taskCode:d.taskRef.taskCode,nodeId:d.taskRef.nodeId,taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const draftRef={id:aid,version:1,contentHash:criteriaHash(ds)},draft={projectId:pid,ref:draftRef,snapshot:ds,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 f.assignment.snapshot.draftRef=draftRef;f.rehash();const cr=f.assignment.ref;
 const decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef:cr,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at};
 const state={projectId:pid,assignmentRef:cr,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 const result=resultFixture();result.entry.snapshot.scope.projectId=pid;result.entry.snapshot.scope.assignmentRef=cr;result.entry.snapshot.manifest.assignmentRef=cr;result.entry.snapshot.manifestHash=criteriaHash(result.entry.snapshot.manifest);result.entry.ref.contentHash=criteriaHash(result.entry.snapshot);result.item.ref=result.entry.ref;result.item.manifestRef.contentHash=result.entry.snapshot.manifestHash;result.page.projectId=pid;result.page.assignmentRef=cr;
 const sources={projectId:pid,result:result.entry,assignment:f.assignment,criteriaState:'TEXT_ONLY_NOT_MAPPED',issues:['TYPED_CRITERIA_NOT_REGISTERED','RESULT_BASELINES_MISMATCH'],reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};
 const input={...structuredClone(f.input),items:[{...structuredClone(f.input.items[0]),sources:f.input.items.flatMap((i:any)=>structuredClone(i.sources))}]},initial=projection(f.assignment,input);
 const base={projectId:pid,ref:{id:criteriaId(9),version:1,contentHash:criteriaHash(initial.snapshot)},...initial,input,createdBy:actor,registeredAt:'2026-10-19T10:02:00.000Z',...flags,observedAt:at},archive:any[]=[base],commands:any[]=[],unexpected:string[]=[],errors:string[]=[];
 if(mode==='SELECTION_ABA')archive.push({...structuredClone(base),ref:{...base.ref,id:criteriaId(15)}});
 let reads=0,denyControl=false,release:()=>void=()=>{},held:BrowserRequest|null=null;const wait=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/*',r=>{unexpected.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:actor,displayName:'합성 검수'},clientId,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{actorId:denyControl&&mode==='CONTROL_OWNER'?criteriaId(66):actor,clientId:denyControl&&mode==='CONTROL_CLIENT'?criteriaId(67):clientId,generation:3,status:'HELD'}}}));
 await page.route('**/api/v1/projects/'+pid+'/**',async r=>{
  const p=new URL(r.request().url()).pathname,b='/api/v1/projects/'+pid+'/';let body:any;
  if(p===b+'assignment-drafts/'+aid+'/versions/1')body=draft;
  else if(p===b+'assignment-drafts/'+aid+'/versions/1/decision')body=decision;
  else if(p===b+'assignments/'+aid+'/versions/1')body=f.assignment;
  else if(p===b+'assignments/'+aid+'/versions/1/execution-preparation-state')body=state;
  else if(p===b+'assignments/'+aid+'/versions/1/result-pages')body={...result.page,nextCursor:null,selectionState:'NOT_SELECTED'};
  else if(p===b+'results/'+result.entry.ref.id)body=result.entry;
  else if(p===b+'results/'+result.entry.ref.id+'/review-sources')body=sources;
  else if(p===b+'assignments/'+aid+'/versions/1/result-criteria')body={projectId:pid,assignmentRef:cr,items:[...archive].reverse().map(v=>({ref:v.ref,createdBy:v.createdBy,registeredAt:v.registeredAt,conditionCount:v.input.items.length,...flags})),hasMore:false,selectionState:'NOT_SELECTED',observedAt:at};
  else if(p.startsWith(b+'result-criteria/')){
   const version=Number(p.split('/').at(-1));reads++;
   if(version===1&&reads===2){
    if(mode==='ORIGINAL_DENIED')return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});
    if(mode==='ORIGINAL_INVALID'){const invalid=structuredClone(base);invalid.input.items[0].sources.pop();return r.fulfill({json:invalid});}
    if(mode==='SELECTION_ABA'){held=r.request();await wait;}
   }
   if(mode==='GET_FAIL'&&version===2&&commands.length===1)return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});
   body=archive.find(v=>v.ref.version===version&&v.ref.id===p.split('/').at(-3));
  }else if(p===b+'commands'){
   const c=r.request().postDataJSON();commands.push(c);expect(c.operation).toBe('saveResultCriteria');expect(c.approvalRef).toBeNull();expect(c.baselineRefs).toEqual([]);expect(c.controlGeneration).toBe(3);expect(r.request().headers()['idempotency-key']).toBe(c.commandId);
   expect(c.targetId).toBe(base.ref.id);expect(c.payload.baseRef.id).toBe(base.ref.id);expect(c.payload.baseRef.version).toBe(c.expectedVersion);expect(c.payload.items[0].sources).toEqual(base.input.items[0].sources);
   const projectionValue=projection(f.assignment,c.payload),version=c.expectedVersion+1,ref={id:base.ref.id,version,contentHash:criteriaHash(projectionValue.snapshot)};
   let value=archive.find(v=>v.ref.version===version);if(!value){value={projectId:pid,ref,...projectionValue,input:c.payload,createdBy:actor,registeredAt:at,...flags,observedAt:at};archive.push(value);}
   if(mode==='LOST_POST'&&commands.length===1)return r.abort('failed');
   if(mode==='LEAVE_INFLIGHT'&&commands.length===1){held=r.request();await wait;}
   body={commandId:c.commandId,operationId:criteriaId(10),projectId:pid,targetId:ref.id,version,status:'APPLIED',serverReceivedAt:at,data:{ref,status:'RESULT_CRITERIA_STORED',...projectionValue,...flags}};
   if(mode==='RECEIPT_MISMATCH')body.data.ref={...ref,id:criteriaId(77)};
  }else{unexpected.push(p);return r.abort();}
  return r.fulfill({json:body});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unexpected.push(r.url());});
 const href='/'+sessionDetailHref(pid,draftRef),editor=page.getByRole('region',{name:'검수 기준 등록',exact:true}),stored=page.getByRole('region',{name:'보관된 검수 기준',exact:true});
 async function open(){await page.getByRole('button',{name:'제출 원문 '+result.entry.ref.id,exact:true}).click();await page.getByRole('button',{name:'검수 기준 원문 조회',exact:true}).click();await expect(editor).toBeVisible();}
 await page.goto(href);await open();await stored.getByRole('button',{name:'보관 기준 목록 조회',exact:true}).click();await stored.getByRole('button',{name:'보관 기준 원문 '+base.ref.id+' v1',exact:true}).click();await expect(stored.getByRole('article',{name:'보관 기준 원문',exact:true})).toBeVisible();
 denyControl=mode==='CONTROL_OWNER'||mode==='CONTROL_CLIENT';
 await stored.getByRole('button',{name:'선택 원문으로 검수 기준 개정',exact:true}).click();
 try{
  if(mode==='SELECTION_ABA'){
   await expect.poll(()=>!!held).toBe(true);await stored.getByRole('button',{name:'보관 기준 원문 '+criteriaId(15)+' v1',exact:true}).click();await expect(stored.getByRole('article',{name:'보관 기준 원문',exact:true})).toContainText(criteriaId(15));await stored.getByRole('button',{name:'보관 기준 원문 '+base.ref.id+' v1',exact:true}).click();await expect(stored.getByRole('article',{name:'보관 기준 원문',exact:true})).toBeVisible();
   const response=page.waitForResponse(r=>r.request()===held);release();await (await response).finished();await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
   await expect(editor.getByRole('button',{name:'검수 기준 작성',exact:true})).toBeVisible();expect(commands).toHaveLength(0);
  }else if(['ORIGINAL_DENIED','ORIGINAL_INVALID','CONTROL_OWNER','CONTROL_CLIENT'].includes(mode)){
   await expect(page.getByRole('alert').first()).toContainText(mode==='ORIGINAL_INVALID'?'RESULT_CRITERIA_RESPONSE_INVALID':mode==='ORIGINAL_DENIED'?'ACCESS_DENIED':'PROJECT_CONTROL_REQUIRED');expect(commands).toHaveLength(0);
  }else{
   await expect(editor.getByLabel('시험 ID 1',{exact:true})).toHaveValue('SAVE-01');await expect(editor.getByLabel('기준 입력 파일 불러오기',{exact:true})).toBeDisabled();await expect(editor.getByRole('button',{name:'기준 입력 파일로 저장',exact:true})).toHaveCount(0);
   await expect(editor).toContainText('다중 원조건 보존');await editor.getByLabel('시험 ID 1',{exact:true}).fill('SAVE-02');await editor.getByRole('textbox',{name:'기준 등록 이유',exact:true}).fill('명시 개정 입력');
   await expect(stored.getByRole('button',{name:'선택 원문으로 검수 기준 개정',exact:true})).toBeDisabled();
   await editor.getByRole('button',{name:'검수 기준 저장 준비',exact:true}).click();expect(commands).toHaveLength(0);await editor.getByRole('button',{name:'검수 기준 명시 저장',exact:true}).click();
   if(mode==='LEAVE_INFLIGHT'){
    await expect.poll(()=>!!held).toBe(true);await page.evaluate(()=>{location.hash='/not-found';});await expect(editor).toHaveCount(0);await page.evaluate(h=>{location.hash=h.slice(1);},href);await open();await expect(editor).toContainText('저장 결과 미확인');
    const response=page.waitForResponse(r=>r.request()===held);release();await (await response).finished();await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    await expect(editor).toContainText('저장 결과 미확인');await expect(editor).not.toContainText('등록 원문 확인 완료');await expect(editor.getByLabel('시험 ID 1',{exact:true})).toHaveValue('SAVE-02');expect(commands).toHaveLength(1);
   }else if(mode==='RECEIPT_MISMATCH'){
    await expect(editor.getByRole('alert')).toContainText('RESULT_CRITERIA_RESPONSE_INVALID');await expect(editor).not.toContainText('등록 원문 확인 완료');await expect(editor).toContainText('저장 결과 미확인');
   }else{
    if(mode==='GET_FAIL'){
     await expect(editor).toHaveCount(0);await page.evaluate(()=>{location.hash='/not-found';});await page.evaluate(h=>{location.hash=h.slice(1);},href);await open();
    }
    if(mode==='LOST_POST'||mode==='GET_FAIL'){await expect(editor).toContainText('저장 결과 미확인');await editor.getByRole('button',{name:'같은 기준 저장 명령 재확인',exact:true}).click();await expect.poll(()=>commands.length).toBe(2);expect(commands[1]).toEqual(commands[0]);}
    await expect(editor).toContainText('등록 원문 확인 완료 · 검수 합격/적용/실행 허가 아님');expect(archive).toHaveLength(2);expect(base.input.baseRef).toBeNull();expect(archive[1].input.items[0].sources).toHaveLength(2);
    if(mode==='FLOW'){
     await stored.getByRole('button',{name:'보관 기준 목록 다시 조회',exact:true}).click();await stored.getByRole('button',{name:'보관 기준 원문 '+base.ref.id+' v2',exact:true}).click();await stored.getByRole('button',{name:'선택 원문으로 검수 기준 개정',exact:true}).click();await expect(editor.getByLabel('시험 ID 1',{exact:true})).toBeEnabled();await editor.getByLabel('시험 ID 1',{exact:true}).fill('SAVE-03');await editor.getByRole('button',{name:'검수 기준 저장 준비',exact:true}).click();await editor.getByRole('button',{name:'검수 기준 명시 저장',exact:true}).click();await expect(editor).toContainText('등록 원문 확인 완료');expect(commands).toHaveLength(2);expect(commands[1].expectedVersion).toBe(2);expect(commands[1].payload.baseRef).toEqual(archive[1].ref);expect(archive[2].ref.version).toBe(3);
    }
   }
  }
  expect({unexpected,errors}).toEqual({unexpected:[],errors:[]});
 }finally{release();}
});
