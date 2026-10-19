import {test,expect} from '@playwright/test';
import {criteriaFixture,criteriaHash,criteriaId} from '../../unit/FN12/result-criteria-fixture.ts';
import {resultFixture} from '../../unit/UI05/result-view-fixture.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {sessionDetailHref,routeHref} from '../../../apps/web/src/shell/routes.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
for(const scenario of ['CONNECTION_LOSS','READBACK_DENIED','NAVIGATE_PENDING','CONTROL_REBIND'])test('검수기준입력의명시저장과미확인명령·미전송입력보존 '+scenario,async({page})=>{
 const f=criteriaFixture(),pid=f.assignment.projectId,aid=f.assignment.ref.id,at='2026-10-19T10:02:00.000Z',actor=criteriaId(6),clientId=criteriaId(8),d=f.d;
 const ds={definition:d,reason:'내용 확정',previousRef:null,basis:{planRef:d.taskRef.planRef,applicationRef:d.taskRef.applicationRef,designRef:d.baselineRefs[0],taskCode:d.taskRef.taskCode,nodeId:d.taskRef.nodeId,taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},draftRef={id:aid,version:1,contentHash:criteriaHash(ds)},draft={projectId:pid,ref:draftRef,snapshot:ds,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 f.assignment.snapshot.draftRef=draftRef;f.rehash();const cr=f.assignment.ref,decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef:cr,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:cr,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 const result=resultFixture();result.entry.snapshot.scope.projectId=pid;result.entry.snapshot.scope.assignmentRef=cr;result.entry.snapshot.manifest.assignmentRef=cr;result.entry.snapshot.manifestHash=criteriaHash(result.entry.snapshot.manifest);result.entry.ref.contentHash=criteriaHash(result.entry.snapshot);result.item.ref=result.entry.ref;result.item.manifestRef.contentHash=result.entry.snapshot.manifestHash;result.page.projectId=pid;result.page.assignmentRef=cr;
 const sources={projectId:pid,result:result.entry,assignment:f.assignment,criteriaState:'TEXT_ONLY_NOT_MAPPED',issues:['TYPED_CRITERIA_NOT_REGISTERED','RESULT_BASELINES_MISMATCH'],reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false},unexpected:string[]=[],errors:string[]=[],commands:any[]=[];let stored:any=null,generation=3,release:()=>void=()=>{};
 await page.route('**/*',r=>{unexpected.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:actor,displayName:'합성 QA'},clientId,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid, r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{actorId:actor,clientId,generation,status:'HELD'}}}));
 await page.route('**/api/v1/projects/'+pid+'/**',async r=>{
  const p=new URL(r.request().url()).pathname,base='/api/v1/projects/'+pid+'/';let body:any;
  if(p===base+'assignment-drafts/'+aid+'/versions/1')body=draft;
  else if(p===base+'assignment-drafts/'+aid+'/versions/1/decision')body=decision;
  else if(p===base+'assignments/'+aid+'/versions/1')body=f.assignment;
  else if(p===base+'assignments/'+aid+'/versions/1/execution-preparation-state')body=state;
  else if(p===base+'assignments/'+aid+'/versions/1/results')body=result.page;
  else if(p===base+'results/'+result.entry.ref.id)body=result.entry;
  else if(p===base+'results/'+result.entry.ref.id+'/review-sources')body=sources;
  else if(p===base+'commands'){
   const c=r.request().postDataJSON();commands.push(c);expect(c.operation).toBe('saveResultCriteria');expect(c.controlGeneration).toBe(generation);expect(c.approvalRef).toBeNull();expect(r.request().headers()['idempotency-key']).toBe(c.commandId);
   const snapshot={assignmentRef:cr,baselineRefs:d.baselineRefs,items:c.payload.items.map((i:any)=>({criterionId:i.criterionId,testId:i.testId,kind:i.kind,environmentRef:i.environmentRef,required:true}))},ref={id:criteriaId(9),version:1,contentHash:criteriaHash(snapshot)},sourceBindings=c.payload.items.map((i:any)=>({criterionId:i.criterionId,sources:i.sources})),flags={registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};
   stored={projectId:pid,ref,snapshot,input:c.payload,sourceBindings,createdBy:actor,registeredAt:at,...flags,observedAt:at};
   if(scenario==='CONNECTION_LOSS'&&commands.length===1)return r.abort('failed');
   if(scenario==='NAVIGATE_PENDING'){if(commands.length===1){await new Promise<void>(resolve=>release=resolve);}else return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});}
   body={commandId:c.commandId,operationId:criteriaId(10),projectId:pid,targetId:ref.id,version:1,status:'APPLIED',serverReceivedAt:at,data:{ref,status:'RESULT_CRITERIA_STORED',snapshot,sourceBindings,...flags}};
  }else if(p===base+'result-criteria/'+criteriaId(9)+'/versions/1'&&stored){if(scenario==='READBACK_DENIED')return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});body=stored;}
  else{unexpected.push(p);return r.abort();}return r.fulfill({json:body});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unexpected.push(r.url());});
 const href='/'+sessionDetailHref(pid,draftRef);async function open(){await page.goto(href);await page.getByRole('button',{name:'제출 원문 '+result.entry.ref.id,exact:true}).click();await page.getByRole('button',{name:'검수 기준 원문 조회',exact:true}).click();}
 await open();const editor=page.getByRole('region',{name:'검수 기준 등록',exact:true});await expect(editor).toBeVisible();await editor.getByRole('button',{name:'검수 기준 작성',exact:true}).click();
 for(const [index,kind]of ['INTEGRATION','SECURITY'].entries()){await editor.getByLabel('기준 ID '+(index+1),{exact:true}).fill(index?'denied':'save');await editor.getByLabel('시험 ID '+(index+1),{exact:true}).fill(index?'DENY-01':'SAVE-01');await editor.getByLabel('시험 종류 '+(index+1),{exact:true}).selectOption(kind);}
 await editor.getByLabel('기준 등록 이유',{exact:true}).fill('조건별 실제 시험 계획');
 // hash 라우트 왕복은 입력/미확인 명령을 버리지 않는다. 문서 새로고침은 보존 범위 밖이다.
 async function roundTrip(){await page.evaluate(h=>{location.hash=h.slice(1);},'/'+routeHref('session',pid));await expect(editor).toHaveCount(0);await page.evaluate(h=>{location.hash=h.slice(1);},href);await page.getByRole('button',{name:'제출 원문 '+result.entry.ref.id,exact:true}).click();await page.getByRole('button',{name:'검수 기준 원문 조회',exact:true}).click();}
 await roundTrip();await expect(editor.getByLabel('시험 ID 1',{exact:true})).toHaveValue('SAVE-01');
 if(scenario==='CONTROL_REBIND'){generation=4;await editor.getByRole('button',{name:'검수 기준 저장 준비',exact:true}).click();await expect(editor.getByRole('alert')).toContainText('PROJECT_CONTROL_CHANGED');expect(commands).toHaveLength(0);await editor.getByRole('button',{name:'현재 제어로 미전송 입력 재결박',exact:true}).click();await expect(editor.getByLabel('시험 ID 1',{exact:true})).toHaveValue('SAVE-01');}
 if(scenario==='READBACK_DENIED'||scenario==='NAVIGATE_PENDING'){
  await editor.getByRole('button',{name:'검수 기준 저장 준비',exact:true}).click();await editor.getByRole('button',{name:'검수 기준 명시 저장',exact:true}).click();await expect.poll(()=>commands.length).toBe(1);
  if(scenario==='READBACK_DENIED')await expect(editor).toHaveCount(0);
  try{await roundTrip();await expect(editor).toContainText('저장 결과 미확인');await expect(editor.getByRole('button',{name:'확인된 거절 이후 입력 수정',exact:true})).toHaveCount(0);release();await editor.getByRole('button',{name:'같은 기준 저장 명령 재확인',exact:true}).click();await expect(editor).toHaveCount(0);await roundTrip();await expect(editor).toContainText('저장 결과 미확인');await expect(editor.getByRole('button',{name:'확인된 거절 이후 입력 수정',exact:true})).toHaveCount(0);expect(commands).toHaveLength(2);expect(commands[1]).toEqual(commands[0]);expect({unexpected,errors}).toEqual({unexpected:[],errors:[]});}finally{release();}return;
 }
 await editor.getByRole('button',{name:'검수 기준 저장 준비',exact:true}).click();expect(commands).toHaveLength(0);await editor.getByRole('button',{name:'검수 기준 명시 저장',exact:true}).click();if(scenario==='CONTROL_REBIND'){await expect(editor).toContainText('등록 원문 확인 완료');expect(commands).toHaveLength(1);expect(commands[0].controlGeneration).toBe(4);expect({unexpected,errors}).toEqual({unexpected:[],errors:[]});return;}await expect(editor.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(editor.getByLabel('시험 ID 1',{exact:true})).toBeDisabled();
 await editor.getByRole('button',{name:'같은 기준 저장 명령 재확인',exact:true}).click();await expect(editor).toContainText('등록 원문 확인 완료 · 검수 합격/적용/실행 허가 아님');expect(commands).toHaveLength(2);expect(commands[1]).toEqual(commands[0]);expect(commands[0].payload.items.every((i:any)=>JSON.stringify(i.environmentRef)===JSON.stringify(d.environmentRef))).toBe(true);expect({unexpected,errors}).toEqual({unexpected:[],errors:[]});
});
