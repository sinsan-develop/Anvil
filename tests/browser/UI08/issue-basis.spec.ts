import {test,expect} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {resultFixture} from '../../unit/UI05/result-view-fixture.ts';
const pid='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222',at='2026-10-19T10:00:00.000Z',ref={id:pid,version:1,contentHash:'a'.repeat(64)},hash=(v:unknown)=>contentHash(canonicalJson(v));
const definition={taskRef:{planRef:ref,taskCode:'FN09',applicationRef:ref,nodeId:'개발'},baselineRefs:[],allowedScopes:[],environmentRef:null,budgetRef:null,parentAssignmentRef:null,recordingPolicyRef:null,purpose:'사용자가 개발 통제',goal:'정확 임무의 책임자 조회',ownerRole:'단계책임자',integrationResponsibility:'검수 연결',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['핵심 동작 확인'],verificationRequirements:['중요 실패 확인'],included:['선택 임무'],excluded:['다른 프로젝트'],requiredCapabilities:[]};
const snapshot={definition,reason:'고정 원문',previousRef:null,basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN09',nodeId:'개발',taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},draftRef={id:aid,version:1,contentHash:hash(snapshot)},draft={projectId:pid,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
const cs={draftRef,definition,reviewRefs:[ref],reason:'과거 내용 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},cr={id:aid,version:1,contentHash:hash(cs)},confirmed={projectId:pid,ref:cr,snapshot:cs,observedAt:at},decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef:cr,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:cr,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
import {observationJournalFor} from '../../unit/UI05/observation-journal-fixture.ts';
import {prepareStoredIssueBasis} from '../../../apps/server/modules/results/stored-issue-basis.ts';

for(const mode of ['GAP','NO_ACK','NO_GAP','TAMPER','DENY','LEAVE'])test('ISSUE_BASIS_'+mode,async({page})=>{
 if(mode==='LEAVE')await page.addInitScript(()=>{const fetch=window.fetch;window.fetch=async(...args)=>{const response=await fetch(...args);if(String(args[0]).endsWith('/issue-basis')){const json=response.json.bind(response);response.json=async()=>{try{return await json();}finally{(window as any).ISSUE_BASIS_JSON_DONE=true;}};}return response;};const digest=crypto.subtle.digest.bind(crypto.subtle);(crypto.subtle as any).digest=async(...args:any[])=>{(window as any).ISSUE_BASIS_HASH_PENDING=((window as any).ISSUE_BASIS_HASH_PENDING??0)+1;try{return await Reflect.apply(digest,crypto.subtle,args);}finally{(window as any).ISSUE_BASIS_HASH_PENDING--;}};});
 const f=resultFixture();f.entry.snapshot.scope.assignmentRef=cr;f.entry.snapshot.manifest.assignmentRef=cr;f.entry.snapshot.manifestHash=hash(f.entry.snapshot.manifest);f.entry.ref.contentHash=hash(f.entry.snapshot);f.item.ref=f.entry.ref;f.item.manifestRef.contentHash=f.entry.snapshot.manifestHash;f.page.assignmentRef=cr;
 const journal=observationJournalFor(f.entry);if(mode==='NO_ACK')Object.assign(journal,{items:[],storedCount:0,ack:null,hasMore:false});if(mode==='NO_GAP'){Object.assign(journal,{items:[],storedCount:0,hasMore:false});Object.assign(journal.ack.snapshot,{highestContiguous:0,maxSequence:0,gaps:[],storedCount:0});journal.ack.ref.contentHash=hash(journal.ack.snapshot);}const basis=prepareStoredIssueBasis(f.entry,journal,journal.observedAt);let reads=0,release:()=>void=()=>{};const writes:string[]=[],unexpected:string[]=[],errors:string[]=[];
 await page.route('**/*',r=>{unexpected.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:pid,displayName:'합성 QA'},clientId:pid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid+'/**',async route=>{const p=new URL(route.request().url()).pathname,base='/api/v1/projects/'+pid+'/';let value:any;
  if(p===base+'assignment-drafts/'+aid+'/versions/1')value=draft;
  else if(p===base+'assignment-drafts/'+aid+'/versions/1/decision')value=decision;
  else if(p===base+'assignments/'+aid+'/versions/1')value=confirmed;
  else if(p===base+'assignments/'+aid+'/versions/1/execution-preparation-state')value=state;
  else if(p===base+'assignments/'+aid+'/versions/1/result-pages')value={...f.page,nextCursor:null,selectionState:'NOT_SELECTED'};
  else if(p===base+'results/'+f.entry.ref.id)value=f.entry;
  else if(p===base+'results/'+f.entry.ref.id+'/issue-basis'){reads++;if(mode==='DENY'&&reads===2)return route.fulfill({status:403,json:{code:'ACCESS_DENIED'}});if(mode==='LEAVE')await new Promise<void>(resolve=>release=resolve);value=structuredClone(basis);if(mode==='TAMPER')value.causeUnestablished=false;}
  else if(p===base+'approvals')value={items:[],hasMore:false,nextCursor:null,observedAt:at};
  else{unexpected.push(p);return route.abort();}return route.fulfill({json:value});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());if(new URL(r.url()).origin!=='https://localhost:3830')unexpected.push(r.url());});
 await page.goto('https://localhost:3830/'+sessionDetailHref(pid,draftRef));await page.getByRole('button',{name:'제출 원문 '+f.entry.ref.id,exact:true}).click();await page.getByRole('link',{name:'승인·문제 화면에서 이 보고 확인',exact:true}).click();
 const parent=page.getByRole('region',{name:'선택 보고의 문제 원문',exact:true});await parent.getByRole('button',{name:'선택 보고 원문 확인',exact:true}).click();

 const panel=parent.getByRole('region',{name:'보관 원장 문제 근거',exact:true});await expect(panel).toBeVisible();expect(reads).toBe(0);await panel.getByRole('button',{name:'문제 근거 조회',exact:true}).click();
 const article=panel.getByRole('article',{name:'선택 보고의 저장 원장 근거',exact:true});
 if(mode==='TAMPER'){await expect(panel.getByRole('alert')).toContainText('STORED_ISSUE_BASIS_RESPONSE_INVALID');await expect(article).toHaveCount(0);}
 else if(mode==='LEAVE'){await expect.poll(()=>reads).toBe(1);const response=page.waitForResponse(r=>r.url().endsWith('/issue-basis'));await parent.getByRole('button',{name:'선택 보고 닫기',exact:true}).click();release();await response;await page.waitForFunction(()=>(window as any).ISSUE_BASIS_JSON_DONE===true&&((window as any).ISSUE_BASIS_HASH_PENDING??0)===0);await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));await expect(panel).toHaveCount(0);}
 else{await expect(article).toContainText('현재 중단 원인 미확인');await expect(article).toContainText('실제 Agent/OS·현재 권한·업무 완료를 확인하지 않았습니다.');if(mode==='NO_ACK')await expect(article).toContainText('보관 ACK 없음');else if(mode==='NO_GAP')await expect(article).toContainText('보관 ACK 범위의 공백 없음 · 현재 정상 가동이나 관측 완전성을 뜻하지 않습니다.');else{await expect(article).toContainText('저장 원장 미수신 구간');await expect(article).toContainText('1~1');await expect(article).toContainText(journal.ack.ref.contentHash);}
 if(mode==='DENY'){await panel.getByRole('button',{name:'문제 근거 다시 조회',exact:true}).click();await expect(parent.getByRole('alert')).toContainText('ACCESS_DENIED');await expect(panel).toHaveCount(0);await expect(parent.getByRole('article',{name:'선택 제출 원문'})).toHaveCount(0);}}
 expect(writes).toEqual([]);expect(unexpected).toEqual([]);expect(errors).toEqual([]);
});
