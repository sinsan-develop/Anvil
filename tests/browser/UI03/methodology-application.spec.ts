import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {validateMethodologyGraph} from '../../../apps/server/modules/methodologies/service.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
const builtin=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms)[0]!;
const pid='a6f20000-0000-4000-8000-000000000090',uid='a6f20000-0000-4000-8000-000000000091',cid='a6f20000-0000-4000-8000-000000000092',mid='a6f20000-0000-4000-8000-000000000093',aid='a6f20000-0000-4000-8000-000000000094',rid='a6f20000-0000-4000-8000-000000000095';
const ref={id:mid,version:1,contentHash:builtin.contentHash},reviewRef={id:rid,criteriaVersion:1,targetRef:ref,outcome:'ACCEPTED'};
const criteria=['METHOD_PURPOSE_SCOPE','METHOD_FLOW_CONTROL','METHOD_INPUT_OUTPUT','METHOD_COMPLETION_APPROVAL','METHOD_RECORD_LIMITS'];
const method={projectId:pid,ref,name:'별도 적용 절차',purpose:'확정과 적용 분리',scope:'PROJECT',systemCode:null,graph:builtin.graph,headVersion:1,applicationTransition:'EXECUTION_STATE_UNVERIFIED',reason:'합성 확정 원문',createdAt:'2026-10-20T00:00:00.000Z',runtimeReadiness:'PROJECT_BINDINGS_REQUIRED',validation:validateMethodologyGraph(builtin.graph,forms.forms.map(f=>f.ref)),contentReviewCriteria:{criteriaVersion:1,items:criteria.map(criterionId=>({criterionId,title:criterionId}))},contentReviews:[{ref:reviewRef,items:criteria.map(criterionId=>({criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'합성 검수'})),reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:'합성 검수',reviewedAt:'2026-10-20T00:00:00.000Z',serverSequence:1}],confirmation:{id:rid,decision:'CONFIRMED',decided_at:'2026-10-20T00:00:00.000Z',decidedBy:uid,reviewRefs:[reviewRef]}};
async function setup(page:Page){
 await page.addInitScript(({projectUrl})=>{
  const original=Response.prototype.json;
  Response.prototype.json=async function(){const value=await original.call(this);if(this.url===projectUrl)(window as any).__fn02ProjectBodies=((window as any).__fn02ProjectBodies??0)+1;if(this.url===projectUrl+'/commands')(window as any).__fn02CommandBodies=((window as any).__fn02CommandBodies??0)+1;return value;};
 },{projectUrl:'https://localhost:3830/api/v1/projects/'+pid});
 const state={requests:[] as any[],unexpected:[] as string[],errors:[] as string[],lose:false,expire:false,deny:false,userId:uid,clientId:cid,failReadback:false,readbackFailures:0,holdPrepare:false,release:null as null|(()=>Promise<void>),held:false,holdPost:false,releasePost:null as null|(()=>Promise<void>),applicationRef:null as any,receipt:null as any};
 page.on('pageerror',e=>state.errors.push(e.message));
 await page.route('https://localhost:3830/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/api/'))return route.fallback();if(route.request().method()!=='GET'||path!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(path))return route.abort();const name=path==='/'?'index.html':path.slice(1);return route.fulfill({body:await readFile(new URL('../../../apps/web/dist/'+name,import.meta.url)),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});});
 await page.route('**/api/v1/**',route=>{state.unexpected.push(route.request().url());return route.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:state.userId,displayName:'방법론 적용 QA'},clientId:state.clientId,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route('**/api/v1/projects?*',r=>r.fulfill({json:{items:[],observedAt:new Date().toISOString(),nextCursor:null,hasMore:false,baselineVersion:null}}));
 await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/,r=>r.fulfill({json:{items:[],observedAt:new Date().toISOString(),nextCursor:null,hasMore:false,baselineVersion:null}}));
 await page.route('**/api/v1/forms',r=>r.fulfill({json:{items:[],observedAt:new Date().toISOString(),nextCursor:null,hasMore:false,baselineVersion:null}}));
 await page.route('**/api/v1/projects/'+pid,async r=>{
  const response=()=>r.fulfill({json:{id:pid,currentMethodologyRef:state.applicationRef,participation:'OWNER',controlState:{actorId:state.userId,clientId:state.clientId,generation:3,status:'HELD'}}});
  if(state.holdPrepare){state.holdPrepare=false;state.held=true;state.release=response;return;}
  if(state.readbackFailures){state.readbackFailures--;return r.fulfill({status:503,json:{code:'SYNTHETIC_READBACK_UNAVAILABLE'}});}return response();
 });
 await page.route('**/api/v1/projects/'+pid+'/methodologies?limit=20',r=>r.fulfill({json:{projectId:pid,items:[{ref,name:method.name,purpose:method.purpose,scope:'PROJECT'}],hasMore:false,nextAfterId:null,observedAt:new Date().toISOString(),applicationTransition:'EXECUTION_STATE_UNVERIFIED'}}));
 await page.route('**/api/v1/projects/'+pid+'/methodologies/'+mid+'/versions/1',r=>r.fulfill({json:method}));
 await page.route('**/api/v1/projects/'+pid+'/commands',r=>{
  const request=r.request().postDataJSON();state.requests.push(request);if(request.operation!=='applyMethodology')state.unexpected.push(request.operation);
  if(state.deny)return r.fulfill({status:409,json:{code:'METHODOLOGY_ALREADY_APPLIED'}});
  const snapshot={name:method.name,purpose:method.purpose,graph:method.graph,sourceRef:ref};
  state.applicationRef={id:aid,version:1,contentHash:contentHash(canonicalJson(snapshot))};
  state.receipt??={operationId:rid,commandId:request.commandId,projectId:pid,status:'APPLIED',targetId:aid,version:1,data:{ref:state.applicationRef,status:'METHODOLOGY_APPLIED',snapshot,reason:request.payload.reason,previousApplicationRef:null},serverReceivedAt:'2026-10-20T00:00:00.000Z'};
  if(state.holdPost){state.holdPost=false;state.releasePost=()=>r.fulfill({status:503,json:{code:'SYNTHETIC_RECEIPT_UNAVAILABLE'}});return;}
  if(state.expire){state.expire=false;return r.fulfill({status:401,json:{code:'AUTH_REQUIRED'}});}
  if(state.lose){state.lose=false;return r.fulfill({status:503,json:{code:'SYNTHETIC_RECEIPT_UNAVAILABLE'}});}
  if(state.failReadback){state.failReadback=false;state.readbackFailures=1;}return r.fulfill({json:state.receipt});
 });
 await page.goto('/#/projects/'+pid+'/methodologies');await page.getByRole('button',{name:method.name+' v1 열기',exact:true}).click();
 return state;
}
async function begin(page:Page){await page.getByLabel('방법론 적용 이유',{exact:true}).fill('사람의 별도 적용');await page.getByLabel('저장·확정과 별개로 이 버전을 프로젝트에 적용합니다',{exact:true}).check();await page.getByRole('button',{name:'확정 방법론 별도 적용',exact:true}).click();}
test('명시 적용은 자동 실행하지 않고 503 뒤 화면 이동 후에도 같은 명령으로 결과를 확인한다',async({page})=>{
 const s=await setup(page);expect(s.requests).toHaveLength(0);await expect(page.getByRole('button',{name:'확정 방법론 별도 적용',exact:true})).toBeDisabled();s.lose=true;await begin(page);
 await expect(page.getByText('적용 결과 미확인 · 같은 명령만 다시 확인하세요.',{exact:true})).toBeVisible();expect(s.requests).toHaveLength(1);
 await page.evaluate(()=>{location.hash='#/projects';});await expect(page.getByRole('heading',{name:'프로젝트',exact:true})).toBeVisible();await page.evaluate(()=>{location.hash='#/projects/'+ 'a6f20000-0000-4000-8000-000000000090'+'/methodologies';});
 const recheck=page.getByRole('button',{name:'같은 적용 명령 결과 확인',exact:true});await expect(recheck).toBeVisible();expect(s.requests).toHaveLength(1);await recheck.click();
 await expect(page.getByText('서버 적용·재조회 확인 · 적용 세대 1',{exact:true})).toBeVisible();expect(s.requests).toHaveLength(2);expect(s.requests[0]).toEqual(s.requests[1]);expect(s.requests[0].targetId).toBe(pid);expect(s.requests[0].payload.methodologyRef).toEqual(ref);expect(s.errors).toEqual([]);expect(s.unexpected).toEqual([]);
});
test('적용 준비 GET 대기 중 화면을 떠나면 늦은 응답으로 POST하지 않는다',async({page})=>{
 const s=await setup(page);s.holdPrepare=true;await begin(page);await expect.poll(()=>s.held).toBe(true);await page.evaluate(()=>{location.hash='#/projects';});await expect(page.getByRole('heading',{name:'프로젝트',exact:true})).toBeVisible();const consumed=await page.evaluate(()=>(window as any).__fn02ProjectBodies??0);await s.release!();await page.waitForFunction(before=>((window as any).__fn02ProjectBodies??0)>before,consumed);
 await page.evaluate(()=>{location.hash='#/projects/a6f20000-0000-4000-8000-000000000090/methodologies';});await expect(page.getByRole('button',{name:method.name+' v1 열기',exact:true})).toBeVisible();expect(s.requests).toHaveLength(0);expect(s.unexpected).toEqual([]);expect(s.errors).toEqual([]);
});
test('적용 receipt를 받아도 재조회503이면 성공 표시 없이 원 명령을 보존한다',async({page})=>{
 const s=await setup(page);s.failReadback=true;await begin(page);await expect(page.getByText('적용 결과 미확인 · 같은 명령만 다시 확인하세요.',{exact:true})).toBeVisible();await expect(page.getByText('서버 적용·재조회 확인 · 적용 세대 1',{exact:true})).toHaveCount(0);expect(s.requests).toHaveLength(1);
 await page.getByRole('button',{name:'같은 적용 명령 결과 확인',exact:true}).click();await expect(page.getByText('서버 적용·재조회 확인 · 적용 세대 1',{exact:true})).toBeVisible();expect(s.requests).toHaveLength(2);expect(s.requests[0]).toEqual(s.requests[1]);expect(s.unexpected).toEqual([]);expect(s.errors).toEqual([]);
});
test('확정의 검토ref JSON 키 순서가 달라도 같은 적합 검토를 인식한다',async({page})=>{
 const original=method.confirmation.reviewRefs;method.confirmation.reviewRefs=[{outcome:'ACCEPTED',targetRef:ref,criteriaVersion:1,id:rid}];
 try{const s=await setup(page);await expect(page.getByLabel('방법론 적용 이유',{exact:true})).toBeEnabled();expect(s.requests).toHaveLength(0);expect(s.unexpected).toEqual([]);}finally{method.confirmation.reviewRefs=original;}
});
for(const mode of ['다른 사용자','같은 사용자 다른 기기'])test('주체 전환 '+mode+'에서 이전 미확인 적용을 노출·재전송하지 않는다',async({page})=>{
 const s=await setup(page);s.expire=true;await begin(page);await expect(page.getByRole('heading',{name:'로그인 확인 필요',exact:true})).toBeVisible();expect(s.requests).toHaveLength(1);
 s.clientId=aid;if(mode==='다른 사용자')s.userId=rid;await page.getByRole('button',{name:'접근 상태 다시 확인',exact:true}).click();
 await expect(page.getByText('다른 사용자·기기의 적용 입력이 남아 있습니다. 내용을 표시하거나 전송하지 않습니다.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'같은 적용 명령 결과 확인',exact:true})).toHaveCount(0);await expect(page.getByLabel('방법론 적용 이유',{exact:true})).toHaveCount(0);expect(s.requests).toHaveLength(1);expect(s.unexpected).toEqual([]);expect(s.errors).toEqual([]);
});
test('최초 전송의 명확한 비저장409는 이유를 보존하고 편집 잠금을 해제한다',async({page})=>{
 const s=await setup(page);s.deny=true;await begin(page);await expect(page.getByText('이번 적용은 거절됐으며 입력을 보존했습니다.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'같은 적용 명령 결과 확인',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'이 전용본 편집',exact:true})).toBeEnabled();await expect(page.getByLabel('방법론 적용 이유',{exact:true})).toHaveValue('사람의 별도 적용');expect(s.requests).toHaveLength(1);
});
test('과거503 뒤409는 최초 거절로 오분류하지 않고 원 명령을 유지한다',async({page})=>{
 const s=await setup(page);s.lose=true;await begin(page);await expect(page.getByRole('button',{name:'같은 적용 명령 결과 확인',exact:true})).toBeVisible();s.deny=true;await page.getByRole('button',{name:'같은 적용 명령 결과 확인',exact:true}).click();await expect(page.getByText('적용 결과 미확인 · 같은 명령만 다시 확인하세요.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'이 전용본 편집',exact:true})).toBeDisabled();expect(s.requests).toHaveLength(2);expect(s.requests[0]).toEqual(s.requests[1]);
});
test('기존 복사 준비 중에는 별도 적용을 잠가 미확인 명령을 덮어쓰지 않는다',async({page})=>{
 const s=await setup(page);await page.getByLabel('방법론 적용 이유',{exact:true}).fill('별도 적용 이유');await page.getByLabel('저장·확정과 별개로 이 버전을 프로젝트에 적용합니다',{exact:true}).check();await page.getByLabel('복사본 이름',{exact:true}).fill('복사 대기');s.holdPrepare=true;page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'프로젝트 전용으로 복사',exact:true}).click();await expect.poll(()=>s.held).toBe(true);await expect(page.getByRole('button',{name:'확정 방법론 별도 적용',exact:true})).toBeDisabled();expect(s.requests).toHaveLength(0);
 await page.evaluate(()=>{location.hash='#/projects';});await expect(page.getByRole('heading',{name:'프로젝트',exact:true})).toBeVisible();const consumed=await page.evaluate(()=>(window as any).__fn02ProjectBodies??0);await s.release!();await page.waitForFunction(before=>((window as any).__fn02ProjectBodies??0)>before,consumed);expect(s.requests).toHaveLength(0);expect(s.unexpected).toEqual([]);expect(s.errors).toEqual([]);
});
test('POST 대기 중 이탈한 뒤 늦은503과 재확인409에도 원 명령을 보존한다',async({page})=>{
 const s=await setup(page);s.holdPost=true;await begin(page);await expect.poll(()=>!!s.releasePost).toBe(true);await page.evaluate(()=>{location.hash='#/projects';});await expect(page.getByRole('heading',{name:'프로젝트',exact:true})).toBeVisible();const consumed=await page.evaluate(()=>(window as any).__fn02CommandBodies??0);await s.releasePost!();await page.waitForFunction(before=>((window as any).__fn02CommandBodies??0)>before,consumed);
 await page.evaluate(()=>{location.hash='#/projects/a6f20000-0000-4000-8000-000000000090/methodologies';});const recheck=page.getByRole('button',{name:'같은 적용 명령 결과 확인',exact:true});await expect(recheck).toBeVisible();expect(s.requests).toHaveLength(1);s.deny=true;await recheck.click();await expect(recheck).toBeVisible();await expect(page.getByText('적용 결과 미확인 · 같은 명령만 다시 확인하세요.',{exact:true})).toBeVisible();expect(s.requests).toHaveLength(2);expect(s.requests[0]).toEqual(s.requests[1]);expect(s.unexpected).toEqual([]);expect(s.errors).toEqual([]);
});
