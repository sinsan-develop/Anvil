import {test,expect} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {resultFixture} from '../../unit/UI05/result-view-fixture.ts';
import {budgetUsageFixture} from '../../unit/UI05/budget-usage-fixture.ts';
const pid='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222',at='2026-10-19T10:00:00.000Z',ref={id:pid,version:1,contentHash:'a'.repeat(64)},hash=(v:unknown)=>contentHash(canonicalJson(v));
const definition={taskRef:{planRef:ref,taskCode:'FN09',applicationRef:ref,nodeId:'개발'},baselineRefs:[],allowedScopes:[],environmentRef:null,budgetRef:null,parentAssignmentRef:null,recordingPolicyRef:null,purpose:'사용자가 개발 통제',goal:'정확 임무의 책임자 조회',ownerRole:'단계책임자',integrationResponsibility:'검수 연결',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['핵심 동작 확인'],verificationRequirements:['중요 실패 확인'],included:['선택 임무'],excluded:['다른 프로젝트'],requiredCapabilities:[]};
const snapshot={definition,reason:'고정 원문',previousRef:null,basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN09',nodeId:'개발',taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},draftRef={id:aid,version:1,contentHash:hash(snapshot)},draft={projectId:pid,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
const cs={draftRef,definition,reviewRefs:[ref],reason:'과거 내용 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},cr={id:aid,version:1,contentHash:hash(cs)},confirmed={projectId:pid,ref:cr,snapshot:cs,observedAt:at},decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef:cr,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:cr,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
// 모든 응답은 합성 route fulfillment다. 실제 HTTPS/TLS·서버/DB·Agent 검증이 아니다.
test('BUDGET_USAGE 선택예산은명시조회·UNKNOWN보존·재조회중앞값숨김·403부모회수',async({page})=>{
 const budget=budgetUsageFixture(),ds=structuredClone(snapshot);(ds.definition as any).budgetRef=budget.ref;const dr={...draftRef,contentHash:hash(ds)},draftView={...draft,ref:dr,snapshot:ds},confirmedSnapshot={...structuredClone(cs),draftRef:dr,definition:ds.definition},confirmedRef={...cr,contentHash:hash(confirmedSnapshot)},confirmedView={...confirmed,ref:confirmedRef,snapshot:confirmedSnapshot},decisionView={...decision,draftRef:dr,confirmedRef:confirmedRef},emptyResults={projectId:pid,assignmentRef:confirmedRef,items:[],hasMore:false,observedAt:at},unexpected:string[]=[],writes:string[]=[],errors:string[]=[];let reads=0,release:()=>void=()=>{};
 await page.route('**/*',r=>{unexpected.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:pid,displayName:'합성 QA'},clientId:pid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid+'/**',async r=>{const u=new URL(r.request().url()),p=u.pathname,base='/api/v1/projects/'+pid+'/';let body:any;if(p===base+'assignment-drafts/'+aid+'/versions/1')body=draftView;else if(p===base+'assignment-drafts/'+aid+'/versions/1/decision')body=decisionView;else if(p===base+'assignments/'+aid+'/versions/1')body=confirmedView;else if(p===base+'assignments/'+aid+'/versions/1/execution-preparation-state')body={...state,assignmentRef:confirmedRef};else if(p===base+'assignments/'+aid+'/versions/1/results')body=emptyResults;else if(p===base+`limit-policies/${budget.ref.id}/versions/1/usage`){expect(u.searchParams.get('contentHash')).toBe(budget.ref.contentHash);reads++;if(reads>1){await new Promise<void>(resolve=>release=resolve);return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});}body=budget.view;}else{unexpected.push(p);return r.abort();}return r.fulfill({json:body});});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')unexpected.push(r.url());});await page.goto('https://localhost:3830/'+sessionDetailHref(pid,dr));
 const panel=page.getByRole('region',{name:'선택 예산 보관 원장'});await expect(panel).toBeVisible();expect(reads).toBe(0);await panel.getByRole('button',{name:'예산 원장 조회'}).click();await expect(panel.getByText('사용량 미확인 예약: 1', {exact:true})).toBeVisible();await expect(panel.getByText('현재 정책·실제 공급자 과금·실행 허가 미검증', {exact:true})).toBeVisible();await panel.getByRole('button',{name:'예산 원장 다시 조회'}).click();await expect(panel.getByText('사용량 미확인 예약: 1',{exact:true})).toHaveCount(0);await expect.poll(()=>reads).toBe(2);release();await expect(page.getByRole('alert').filter({hasText:'ACCESS_DENIED'})).toBeVisible();await expect(panel).toHaveCount(0);expect(writes).toEqual([]);expect(unexpected).toEqual([]);expect(errors).toEqual([]);
});
test('검수기준원문은명시조회하고재조회대기/거절때이전자료를숨기며쓰기하지않는다',async({page})=>{
 const result=resultFixture();result.entry.snapshot.scope.assignmentRef=cr;result.entry.snapshot.manifest.assignmentRef=cr;result.entry.snapshot.manifestHash=hash(result.entry.snapshot.manifest);result.entry.ref.contentHash=hash(result.entry.snapshot);result.item.ref=result.entry.ref;result.item.manifestRef.contentHash=result.entry.snapshot.manifestHash;result.page.assignmentRef=cr;
 const sources={projectId:pid,result:result.entry,assignment:confirmed,criteriaState:'TEXT_ONLY_NOT_MAPPED',issues:['TYPED_CRITERIA_NOT_REGISTERED','ENVIRONMENT_NOT_DEFINED'],reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false},unexpected:string[]=[],writes:string[]=[],errors:string[]=[];let sourceReads=0,release:()=>void=()=>{};
 await page.route('**/*',r=>{unexpected.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:pid,displayName:'합성 QA'},clientId:pid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid+'/**',async r=>{
  const p=new URL(r.request().url()).pathname,base='/api/v1/projects/'+pid+'/';let body:any;
  if(p===base+'assignment-drafts/'+aid+'/versions/1')body=draft;
  else if(p===base+'assignment-drafts/'+aid+'/versions/1/decision')body=decision;
  else if(p===base+'assignments/'+aid+'/versions/1')body=confirmed;
  else if(p===base+'assignments/'+aid+'/versions/1/execution-preparation-state')body=state;
  else if(p===base+'assignments/'+aid+'/versions/1/results')body=result.page;
  else if(p===base+'results/'+result.item.ref.id)body=result.entry;
  else if(p===base+'results/'+result.item.ref.id+'/review-sources'){sourceReads++;if(sourceReads>1){await new Promise<void>(resolve=>release=resolve);return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});}body=sources;}
  else{unexpected.push(p);return r.abort();}return r.fulfill({json:body});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')unexpected.push(r.url());});
 await page.goto('/'+sessionDetailHref(pid,draftRef));const results=page.getByRole('region',{name:'제출 결과',exact:true});await results.getByRole('button',{name:'제출 원문 '+result.item.ref.id,exact:true}).click();
 const panel=results.getByRole('region',{name:'검수 기준 원문',exact:true});await expect(panel).toBeVisible();expect(sourceReads).toBe(0);await panel.getByRole('button',{name:'검수 기준 원문 조회',exact:true}).click();
 await expect(panel.getByRole('heading',{name:'완료 조건 원문',exact:true})).toBeVisible();await expect(panel).toContainText('핵심 동작 확인');await expect(panel).toContainText('중요 실패 확인');await expect(panel).toContainText('시험 기준 미연결');await expect(panel).toContainText('환경 미정');await expect(panel).toContainText('검수 저장·보완 배정 미연결');
 try{await panel.getByRole('button',{name:'검수 기준 원문 다시 조회',exact:true}).click();await expect.poll(()=>sourceReads).toBe(2);await expect(panel.getByRole('heading',{name:'완료 조건 원문',exact:true})).toHaveCount(0);release();await expect(results.getByRole('alert')).toContainText('ACCESS_DENIED');await expect(results.getByRole('article',{name:'선택 제출 원문',exact:true})).toHaveCount(0);await expect(panel).toHaveCount(0);}finally{release();}
 expect({unexpected,writes,errors}).toEqual({unexpected:[],writes:[],errors:[]});
});
test('상세조회의정상표시후접근거절은앞선원문을제거하며쓰기/실행/외부요청이없다',async({page})=>{
 const unexpected:string[]=[],writes:string[]=[],errors:string[]=[];let denied=false,resultDenied=false,delaySelection=false,originalReads=0;let releaseA:()=>void=()=>{},releaseB:()=>void=()=>{};
 const result=resultFixture();result.a=cr;result.entry.snapshot.scope.assignmentRef=cr;result.entry.snapshot.manifest.assignmentRef=cr;result.entry.snapshot.manifestHash=hash(result.entry.snapshot.manifest);result.entry.ref.contentHash=hash(result.entry.snapshot);result.item.ref=result.entry.ref;result.item.manifestRef.contentHash=result.entry.snapshot.manifestHash;result.page.assignmentRef=cr;
 const other=structuredClone(result.item);other.ref.id='33333333-3333-4333-8333-333333333333';other.manifestRef.id=other.ref.id;result.page.items.push(other);
 await page.route('**/*',r=>{unexpected.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:pid,displayName:'합성 QA'},clientId:pid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid+'/**',async r=>{
  const p=new URL(r.request().url()).pathname,base='/api/v1/projects/'+pid+'/';let body:any;
  if(p===base+'assignment-drafts/'+aid+'/versions/1')body=draft;
  else if(p===base+'assignment-drafts/'+aid+'/versions/1/decision')body=decision;
  else if(p===base+'assignments/'+aid+'/versions/1')body=confirmed;
  else if(p===base+'assignments/'+aid+'/versions/1/execution-preparation-state')body=state;
  else if(p===base+'assignments/'+aid+'/versions/1/results'){if(resultDenied)return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});body=result.page;}
  else if(p===base+'results/'+result.item.ref.id){originalReads++;if(delaySelection){await new Promise<void>(resolve=>releaseA=resolve);return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});}body=result.entry;}
  else if(p===base+'results/'+other.ref.id){await new Promise<void>(resolve=>releaseB=resolve);return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});}
  else{unexpected.push(p);return r.abort();}
  return denied?r.fulfill({status:403,json:{code:'ACCESS_DENIED'}}):r.fulfill({json:body});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')unexpected.push(r.url());});
 await page.goto('/'+sessionDetailHref(pid,draftRef));const region=page.getByRole('region',{name:'단계책임자·실행 상세',exact:true});
 await expect(region.getByRole('heading',{name:definition.goal,exact:true})).toBeVisible();await expect(region).toContainText('재검토 필요');await expect(region).toContainText('현재 실행 미확인');await expect(region).toContainText('실제 관측·증거 검수 미연결');
 const results=region.getByRole('region',{name:'제출 결과',exact:true});await results.getByRole('button',{name:'제출 원문 '+result.item.ref.id,exact:true}).click();const original=results.getByRole('article',{name:'선택 제출 원문',exact:true});await expect(original).toContainText('INCOMPLETE');await expect(original).toContainText('NOT_EXECUTED');await expect(original).toContainText('실제 Agent 미연결');await expect(original).toContainText('검수 전');
 delaySelection=true;try{
  await results.getByRole('button',{name:'제출 원문 '+other.ref.id,exact:true}).click();await expect(original).toHaveCount(0);
  await results.getByRole('button',{name:'제출 원문 '+result.item.ref.id,exact:true}).click();await expect.poll(()=>originalReads).toBe(2);await expect(original).toHaveCount(0);releaseA();await expect(results.getByRole('alert')).toContainText('ACCESS_DENIED');await expect(original).toHaveCount(0);
 }finally{releaseA();releaseB();}
 resultDenied=true;await results.getByRole('button',{name:'결과 목록 새로고침',exact:true}).click();await expect(results.getByRole('alert')).toContainText('ACCESS_DENIED');await expect(original).toHaveCount(0);
 denied=true;await region.getByRole('button',{name:'상세 원본 새로고침',exact:true}).click();await expect(region.getByRole('alert')).toContainText('ACCESS_DENIED');await expect(region.getByRole('heading',{name:definition.goal,exact:true})).toHaveCount(0);
 expect({unexpected,writes,errors}).toEqual({unexpected:[],writes:[],errors:[]});
});
