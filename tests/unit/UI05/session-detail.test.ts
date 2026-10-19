import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {capabilityNames} from '../../../apps/web/src/features/connections/api.ts';
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
export function fixture(tools=false){
 const definition={taskRef:{planRef:ref,taskCode:'FN09',applicationRef:ref,nodeId:'개발'},baselineRefs:[],allowedScopes:[],environmentRef:null,budgetRef:null,parentAssignmentRef:null,recordingPolicyRef:null,purpose:'요구사항에 따른 개발',goal:'등록된 임무 조회',ownerRole:'단계책임자',integrationResponsibility:'원문과 검수 연결',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['핵심 동작 확인'],verificationRequirements:['필요 범위 검사'],included:['정확 임무'],excluded:['다른 프로젝트'],requiredCapabilities:[]},snapshot={definition,reason:'시험 원문',previousRef:null,basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN09',nodeId:'개발',taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},draftRef={id:aid,version:1,contentHash:hash(snapshot)},draft={projectId:pid,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 const confirmedSnapshot={draftRef,definition,reviewRefs:[ref],reason:'과거 내용 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},confirmedRef={id:aid,version:1,contentHash:hash(confirmedSnapshot)},confirmed={projectId:pid,ref:confirmedRef,snapshot:confirmedSnapshot,observedAt:at},decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:confirmedRef,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false},calls:string[]=[];let fault='',after=()=>{};
 const input={kind:'CONNECTION_CANDIDATE',candidateRef:null,policyRef:ref,expiresAt:'2099-01-01T00:00:00.000Z',candidate:{label:'저장된 도구 후보',toolProduct:'합성 코딩 도구',toolVersion:'시험 버전',adapterKind:'CLI'},reason:'도구 표시'},candidate={kind:input.kind,input,readiness:{state:'NOT_READY',executionAuthorized:false,missingRequirements:[]},capabilities:Object.keys(capabilityNames).map(code=>({code,documentation:null,measurement:{state:'UNVERIFIED',toolVersion:null,environmentRef:null,executionRef:null,evidenceRefs:[]},controlLevel:'UNVERIFIED',limitations:[]}))},toolRef={...ref,id:'33333333-3333-4333-8333-333333333333',contentHash:hash(candidate)},tool={ref:toolRef,candidate,expired:false,createdAt:at,recordedBy:pid,executionAuthorized:false,observedAt:at};
 if(tools){const roleSnapshot={kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'총괄',definedBy:{kind:'HUMAN',userId:pid},definedAt:at},roleRef={...ref,contentHash:hash(roleSnapshot)},bindingSnapshot={assignmentRef:confirmedRef,roleRef,connectionRef:toolRef,existingSessionBindingRef:null,reason:'예약',sessionRef:ref,generation:1,state:'RESERVED',externalSessionHandleRef:null,connectionReadiness:'CANDIDATE_ONLY',executionAuthorized:false,dispatchPerformed:false,boundBy:{kind:'HUMAN',userId:pid},boundAt:at};(state.roles as any[]).push({projectId:pid,ref:roleRef,snapshot:roleSnapshot});(state.bindings as any[]).push({projectId:pid,ref:{...ref,id:'44444444-4444-4444-8444-444444444444',contentHash:hash(bindingSnapshot)},snapshot:bindingSnapshot});}
 const client=new ApiClient(async(url,options)=>{assert.equal(options?.method??'GET','GET');const path=String(url);calls.push(path);const base='/api/v1/projects/'+pid+'/';let value:any;
  if(path===base+'assignment-drafts/'+aid+'/versions/1')value=draft;
  else if(path===base+'assignment-drafts/'+aid+'/versions/1/decision')value=decision;
  else if(path===base+'assignments/'+aid+'/versions/1')value=confirmed;
  else if(path===base+'assignments/'+aid+'/versions/1/execution-preparation-state')value=state;
  else if(path===base+'connection-candidates/'+toolRef.id+'/versions/1'){if(fault==='TOOL_DENIED')return Response.json({code:'ACCESS_DENIED'},{status:403});if(fault==='TOOL_EXPIRED_AUTH')return Response.json({code:'AUTH_REQUIRED'},{status:401});value=tool;}
  else assert.fail('NO_UNREGISTERED_PATH');
  after();if(fault==='DENIED')return Response.json({error:{code:'FORBIDDEN'}},{status:403});if(fault==='HASH'&&value===confirmed)value={...confirmed,snapshot:{...confirmedSnapshot,reason:'변조'}};if(fault==='PROJECT'&&value===state)value={...state,projectId:aid};return Response.json(value);
 });return{client,draft,decision,confirmed,state,tool,calls,fault:(v:string)=>fault=v,after:(fn:()=>void)=>after=fn};
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
test('책임도구는예약의정확후보원문을읽고403은미확인으로분리하며로그인만료는상세를반환하지않는다',async()=>{
 const f=fixture(true),value=await mod.readSessionDetail(f.client,pid,f.draft.ref);assert(Array.isArray(value.tools),'책임 도구 원문 조회가 누락됨');assert.deepEqual(value.tools[0].value,f.tool);assert.deepEqual(value.tools[0].connectionRef,f.tool.ref);assert.equal(f.calls.length,5);
 const denied=fixture(true);denied.fault('TOOL_DENIED');const safe=await mod.readSessionDetail(denied.client,pid,denied.draft.ref);assert.deepEqual(safe.draft,denied.draft);assert.equal(safe.tools[0].value,null);assert.equal(safe.tools[0].error,'ACCESS_DENIED');assert.equal(denied.calls.length,5);
 const lost=fixture(true);lost.fault('TOOL_EXPIRED_AUTH');await assert.rejects(mod.readSessionDetail(lost.client,pid,lost.draft.ref),(e:any)=>e.status===401);
});
test('상세화면은고정임무·완료조건과누락증거를표시하고미관측실행을완료/가동으로꾸미지않는다',async()=>{
 const sourceUrl=new URL('../../../apps/web/src/features/session-detail/SessionDetailPage.tsx',import.meta.url),require=createRequire(import.meta.url);
 const compile=async(url:URL,reviewModule?:string)=>{const compiled=(await transformWithOxc(await readFile(url,'utf8'),fileURLToPath(url),{lang:'tsx'})).code,code=compiled.replace(/(from\s*['"])([^'"]+)(['"])/g,(_m,start,path,end)=>start+(path==='./ResultReviewSources.tsx'&&reviewModule?reviewModule:path.startsWith('.')?new URL(path,url).href:pathToFileURL(require.resolve(path)).href)+end);return'data:text/javascript;base64,'+Buffer.from(code).toString('base64');};
 const reviewModule=await compile(new URL('./ResultReviewSources.tsx',sourceUrl)),screen=await import(await compile(sourceUrl,reviewModule));
 const f=fixture(),detail=await mod.readSessionDetail(f.client,pid,f.draft.ref),before=f.calls.length,html=renderToStaticMarkup(createElement(screen.SessionDetailContent,{detail}));assert.equal(f.calls.length,before);for(const value of ['등록된 임무 조회','핵심 동작 확인','재검토 필요','현재 실행 미확인','실제 관측·증거 검수 미연결'])assert(html.includes(value));assert(!html.includes('실행 완료'));
 detail.draft.snapshot.definition.goal='<script>private()</script>';const escaped=renderToStaticMarkup(createElement(screen.SessionDetailContent,{detail}));assert(!escaped.includes('<script>private'));assert(escaped.includes('&lt;script&gt;'));
 detail.state.bindings=[{ref, snapshot:{assignmentRef:{...ref,id:'33333333-3333-4333-8333-333333333333',contentHash:'c'.repeat(64)},roleRef:ref,connectionRef:ref,sessionRef:ref,generation:1}}];const other=renderToStaticMarkup(createElement(screen.SessionDetailContent,{detail}));assert(other.includes('다른 임무의 현재 예약'));assert(other.includes('33333333-3333-4333-8333-333333333333'));assert(other.includes('c'.repeat(64)));
 const empty=renderToStaticMarkup(createElement(screen.SessionDetailPage,{client:f.client,projectId:pid,onAuthenticationLost:()=>assert.fail('NO_AUTH_CHANGE')}));assert(empty.includes('프로젝트 작업에서 임무를 선택'));assert.equal(f.calls.length,before);
 const named=fixture(true),namedDetail=await mod.readSessionDetail(named.client,pid,named.draft.ref),namedHtml=renderToStaticMarkup(createElement(screen.SessionDetailContent,{detail:namedDetail}));for(const value of ['저장된 도구 후보','합성 코딩 도구','능력·실제 연결·가동 미확인'])assert(namedHtml.includes(value));
 const denied=fixture(true);denied.fault('TOOL_DENIED');const deniedHtml=renderToStaticMarkup(createElement(screen.SessionDetailContent,{detail:await mod.readSessionDetail(denied.client,pid,denied.draft.ref)}));assert(deniedHtml.includes('도구 후보 원문 미확인'));assert(deniedHtml.includes('ACCESS_DENIED'));assert(!deniedHtml.includes('저장된 도구 후보'));
});
