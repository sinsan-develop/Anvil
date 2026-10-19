import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {parseRoute} from '../../../apps/web/src/shell/routes.ts';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {transformWithOxc} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const routes:any=await import('../../../apps/web/src/shell/routes.ts');
const mod:any=await import('../../../apps/web/src/features/session-detail/api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222',at='2026-10-19T10:00:00.000Z',ref={id:pid,version:1,contentHash:'a'.repeat(64)},hash=(v:unknown)=>contentHash(canonicalJson(v));
export function fixture(){
 const definition={taskRef:{planRef:ref,taskCode:'FN09',applicationRef:ref,nodeId:'개발'},baselineRefs:[],allowedScopes:[],environmentRef:null,budgetRef:null,parentAssignmentRef:null,recordingPolicyRef:null,purpose:'요구사항에 따른 개발',goal:'등록된 임무 조회',ownerRole:'단계책임자',integrationResponsibility:'원문과 검수 연결',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['핵심 동작 확인'],verificationRequirements:['필요 범위 검사'],included:['정확 임무'],excluded:['다른 프로젝트'],requiredCapabilities:[]},snapshot={definition,reason:'시험 원문',previousRef:null,basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN09',nodeId:'개발',taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},draftRef={id:aid,version:1,contentHash:hash(snapshot)},draft={projectId:pid,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 const confirmedSnapshot={draftRef,definition,reviewRefs:[ref],reason:'과거 내용 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},confirmedRef={id:aid,version:1,contentHash:hash(confirmedSnapshot)},confirmed={projectId:pid,ref:confirmedRef,snapshot:confirmedSnapshot,observedAt:at},decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:confirmedRef,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false},calls:string[]=[];let fault='',after=()=>{};
 const client=new ApiClient(async(url,options)=>{assert.equal(options?.method??'GET','GET');const path=String(url);calls.push(path);const base='/api/v1/projects/'+pid+'/';let value:any;
  if(path===base+'assignment-drafts/'+aid+'/versions/1')value=draft;
  else if(path===base+'assignment-drafts/'+aid+'/versions/1/decision')value=decision;
  else if(path===base+'assignments/'+aid+'/versions/1')value=confirmed;
  else if(path===base+'assignments/'+aid+'/versions/1/execution-preparation-state')value=state;
  else assert.fail('NO_UNREGISTERED_PATH');
  after();if(fault==='DENIED')return Response.json({error:{code:'FORBIDDEN'}},{status:403});if(fault==='HASH'&&value===confirmed)value={...confirmed,snapshot:{...confirmedSnapshot,reason:'변조'}};if(fault==='PROJECT'&&value===state)value={...state,projectId:aid};return Response.json(value);
 });return{client,draft,decision,confirmed,state,calls,fault:(v:string)=>fault=v,after:(fn:()=>void)=>after=fn};
}
test('상세화면선택은프로젝트·임무고정버전/hash를URL에보존하고오염된경로를다른임무로대체하지않는다',()=>{
 assert.equal(typeof routes.sessionDetailHref,'function');const f=fixture(),url=routes.sessionDetailHref(pid,f.draft.ref),parsed=parseRoute(url);assert.deepEqual(parsed,{screen:'session',projectId:pid,assignmentRef:f.draft.ref});
 for(const path of [url+'/extra',url.replace('/versions/1/','/versions/0/'),url.replace(f.draft.ref.contentHash,'z'.repeat(64)),url+'?other=1'])assert.equal(parseRoute(path).screen,'not-found');assert.throws(()=>routes.sessionDetailHref(pid,{...f.draft.ref,version:0}));
});
test('상세조회는기존GET의초안→판단→확정원문→역할/예약세션만연결하고재검토필요와실행false를보존한다',async()=>{
 assert.equal(typeof mod.readSessionDetail,'function');const f=fixture(),value=await mod.readSessionDetail(f.client,pid,f.draft.ref);assert.deepEqual(value.draft,f.draft);assert.deepEqual(value.confirmed,f.confirmed);assert.deepEqual(value.state,f.state);assert.equal(value.decision.latestReviewAccepted,false);assert.equal(f.calls.length,4);assert(f.calls.every(p=>p.startsWith('/api/v1/projects/'+pid+'/')));
});
test('다른프로젝트/원문hash손상/접근거절은상세현재상태를만들지않고화면이탈후후속GET도중단한다',async()=>{
 assert.equal(typeof mod.readSessionDetail,'function');for(const fault of ['HASH','PROJECT','DENIED']){const f=fixture();f.fault(fault);await assert.rejects(mod.readSessionDetail(f.client,pid,f.draft.ref));}
 const f=fixture();let active=true;f.after(()=>active=false);assert.equal(await mod.readSessionDetail(f.client,pid,f.draft.ref,()=>active),null);assert.equal(f.calls.length,1);
 const invalid=fixture();await assert.rejects(mod.readSessionDetail(invalid.client,'other-project',invalid.draft.ref));assert.equal(invalid.calls.length,0);
});
test('상세화면은고정임무·완료조건과누락증거를표시하고미관측실행을완료/가동으로꾸미지않는다',async()=>{
 const sourceUrl=new URL('../../../apps/web/src/features/session-detail/SessionDetailPage.tsx',import.meta.url),require=createRequire(import.meta.url),compiled=(await transformWithOxc(await readFile(sourceUrl,'utf8'),fileURLToPath(sourceUrl),{lang:'tsx'})).code,code=compiled.replace(/(from\s*['"])([^'"]+)(['"])/g,(_m,start,path,end)=>start+(path.startsWith('.')?new URL(path,sourceUrl).href:pathToFileURL(require.resolve(path)).href)+end),screen=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const f=fixture(),detail=await mod.readSessionDetail(f.client,pid,f.draft.ref),before=f.calls.length,html=renderToStaticMarkup(createElement(screen.SessionDetailContent,{detail}));assert.equal(f.calls.length,before);for(const value of ['등록된 임무 조회','핵심 동작 확인','재검토 필요','현재 실행 미확인','실행·변경·시험 증거 미연결'])assert(html.includes(value));assert(!html.includes('실행 완료'));
 detail.draft.snapshot.definition.goal='<script>private()</script>';const escaped=renderToStaticMarkup(createElement(screen.SessionDetailContent,{detail}));assert(!escaped.includes('<script>private'));assert(escaped.includes('&lt;script&gt;'));
 detail.state.bindings=[{ref, snapshot:{assignmentRef:{...ref,id:'33333333-3333-4333-8333-333333333333',contentHash:'c'.repeat(64)},roleRef:ref,connectionRef:ref,sessionRef:ref,generation:1}}];const other=renderToStaticMarkup(createElement(screen.SessionDetailContent,{detail}));assert(other.includes('다른 임무의 현재 예약'));assert(other.includes('33333333-3333-4333-8333-333333333333'));assert(other.includes('c'.repeat(64)));
 const empty=renderToStaticMarkup(createElement(screen.SessionDetailPage,{client:f.client,projectId:pid,onAuthenticationLost:()=>assert.fail('NO_AUTH_CHANGE')}));assert(empty.includes('프로젝트 작업에서 임무를 선택'));assert.equal(f.calls.length,before);
});
